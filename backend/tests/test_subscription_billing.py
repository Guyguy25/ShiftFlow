from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

from fastapi import HTTPException
from subscription_billing import resolve_price


class SubscriptionPriceTests(TestCase):
    def price(self, **changes):
        values = dict(id="price_live", nickname="shiftflow_monthly", currency="eur", unit_amount=7900,
                      recurring=SimpleNamespace(interval="month", interval_count=1))
        return SimpleNamespace(**{**values, **changes})

    def stripe(self, direct, fallback=()):
        return SimpleNamespace(Price=SimpleNamespace(list=Mock(side_effect=[
            SimpleNamespace(data=direct), SimpleNamespace(auto_paging_iter=lambda: iter(fallback))])))

    def test_lookup_key_is_preferred(self):
        price = self.price()
        stripe = self.stripe([price])
        self.assertIs(resolve_price(stripe, "shiftflow_monthly", {"interval": "month", "amount": 7900}), price)
        stripe.Price.list.assert_called_once_with(lookup_keys=["shiftflow_monthly"], active=True, limit=1)

    def test_exact_dashboard_nickname_resolves_when_lookup_key_is_missing(self):
        price = self.price()
        stripe = self.stripe([], [self.price(nickname="unrelated"), price])
        self.assertIs(resolve_price(stripe, "shiftflow_monthly", {"interval": "month", "amount": 7900}), price)

    def test_missing_duplicate_or_wrong_amount_nickname_is_rejected(self):
        for fallback in [[], [self.price(), self.price()], [self.price(unit_amount=4900)]]:
            with self.assertRaises(HTTPException) as error:
                resolve_price(self.stripe([], fallback), "shiftflow_monthly", {"interval": "month", "amount": 7900})
            self.assertEqual(error.exception.status_code, 503)

    def test_yearly_nickname_resolves_with_exact_annual_charge(self):
        price = self.price(nickname="shiftflow_yearly", unit_amount=71100,
                           recurring=SimpleNamespace(interval="year", interval_count=1))
        self.assertIs(resolve_price(self.stripe([], [price]), "shiftflow_yearly", {"interval": "year", "amount": 71100}), price)
