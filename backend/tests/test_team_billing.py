from unittest import TestCase
from unittest.mock import Mock
from types import SimpleNamespace
from fastapi import HTTPException
from subscription_billing import ensure_team_prices, tier_from_subscription, TEAM_PRICES, TEAM_PRODUCT

class Obj(dict):
    def __getattr__(self,key): return self.get(key)

class TeamBillingTests(TestCase):
    def price(self, lookup):
        expected=TEAM_PRICES[lookup]
        return Obj(id='price_'+lookup, product=TEAM_PRODUCT,currency='eur',unit_amount=expected['amount'],
                   nickname=lookup,lookup_key=lookup,recurring=Obj(interval=expected['interval'],interval_count=1))

    def provider(self):
        missing=type('InvalidRequestError',(Exception,),{})
        stripe=SimpleNamespace(error=SimpleNamespace(InvalidRequestError=missing),
            Product=SimpleNamespace(retrieve=Mock(return_value=Obj(id=TEAM_PRODUCT,active=True,metadata={'app':'shiftflow'})),create=Mock()),
            Price=SimpleNamespace(list=Mock(),create=Mock(),retrieve=Mock()),Invoice=SimpleNamespace(retrieve=Mock(return_value=Obj(paid=True,status='paid'))))
        stripe.Price.list.side_effect=lambda **kwargs: SimpleNamespace(data=[self.price(kwargs['lookup_keys'][0])])
        return stripe

    def test_existing_exact_prices_are_reused_without_creating_anything(self):
        stripe=self.provider(); result=ensure_team_prices(stripe)
        self.assertEqual(set(result),set(TEAM_PRICES))
        self.assertEqual(result['shiftflow_team_monthly'].unit_amount,8900)
        self.assertEqual(result['shiftflow_team_yearly'].unit_amount,74760)
        stripe.Product.create.assert_not_called(); stripe.Price.create.assert_not_called()

    def test_missing_catalog_is_created_with_stable_product_and_idempotency_keys(self):
        stripe=self.provider()
        error=stripe.error.InvalidRequestError(); error.code='resource_missing'
        stripe.Product.retrieve.side_effect=error
        stripe.Product.create.return_value=Obj(id=TEAM_PRODUCT,active=True,metadata={'app':'shiftflow'})
        counts={}
        def prices(**kwargs):
            lookup=kwargs['lookup_keys'][0]; counts[lookup]=counts.get(lookup,0)+1
            return SimpleNamespace(data=[] if counts[lookup]==1 else [self.price(lookup)])
        stripe.Price.list.side_effect=prices
        ensure_team_prices(stripe)
        self.assertEqual(stripe.Product.create.call_args.kwargs['id'],TEAM_PRODUCT)
        self.assertEqual(stripe.Price.create.call_count,2)
        for call in stripe.Price.create.call_args_list:
            lookup=call.kwargs['lookup_key']
            self.assertEqual(call.kwargs['unit_amount'],TEAM_PRICES[lookup]['amount'])
            self.assertIn(lookup,call.kwargs['idempotency_key'])

    def test_wrong_price_or_product_is_rejected(self):
        for changes in ({'unit_amount':1},{'product':'another_product'},{'currency':'usd'}):
            stripe=self.provider()
            stripe.Price.list.side_effect=lambda **kwargs: SimpleNamespace(data=[Obj({**self.price(kwargs['lookup_keys'][0]),**changes})])
            with self.subTest(changes=changes),self.assertRaises(HTTPException): ensure_team_prices(stripe)
            stripe.Price.create.assert_not_called()

    def test_team_access_requires_actual_valid_team_price_and_settled_invoice(self):
        stripe=self.provider()
        subscription=Obj(items={'data':[{'price':self.price('shiftflow_team_monthly')}]},latest_invoice='in_paid')
        self.assertEqual(tier_from_subscription(stripe,subscription),'team')
        stripe.Invoice.retrieve.return_value=Obj(paid=False,status='open')
        self.assertEqual(tier_from_subscription(stripe,subscription),'pro')
        stripe.Invoice.retrieve.return_value=Obj(paid=True,status='paid')
        self.assertEqual(tier_from_subscription(stripe,Obj({**subscription,'pending_update':{'expires_at':1}})),'pro')
        self.assertEqual(tier_from_subscription(stripe,Obj(items={'data':[{'price':Obj(id='price_pro',lookup_key='shiftflow_monthly')}]},latest_invoice='in_paid')),'pro')

    def test_portal_groups_all_four_prices_and_requires_explicit_stripe_confirmation(self):
        from subscription_billing import team_portal_configuration
        stripe=self.provider()
        def list_prices(**kwargs):
            lookup=kwargs['lookup_keys'][0]
            price=self.price(lookup) if lookup in TEAM_PRICES else Obj(id='price_'+lookup,product='prod_pro',currency='eur',
                unit_amount=7900 if lookup.endswith('monthly') else 71100,
                recurring=Obj(interval='month' if lookup.endswith('monthly') else 'year',interval_count=1))
            return SimpleNamespace(data=[price])
        stripe.Price.list.side_effect=list_prices
        stripe.billing_portal=SimpleNamespace(Configuration=SimpleNamespace(create=Mock(return_value=Obj(id='bpc_team'))))
        result=team_portal_configuration(stripe,{'shiftflow_monthly':{'amount':7900,'interval':'month'},'shiftflow_yearly':{'amount':71100,'interval':'year'}})
        self.assertEqual(result.id,'bpc_team')
        update=stripe.billing_portal.Configuration.create.call_args.kwargs['features']['subscription_update']
        self.assertTrue(update['enabled']);self.assertEqual(update['default_allowed_updates'],['price'])
        self.assertEqual(sum(len(product['prices']) for product in update['products']),4)
        self.assertEqual(update['proration_behavior'],'always_invoice')
