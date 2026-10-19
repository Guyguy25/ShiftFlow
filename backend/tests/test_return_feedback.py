import asyncio
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import TestCase, IsolatedAsyncioTestCase
from unittest.mock import Mock
from fastapi import HTTPException
from pydantic import ValidationError
from return_feedback import FeedbackIn, eligible, status, submit, discount_options

NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
USER = {"id": "u", "plan": "free", "visit_days": ["2026-10-12", "2026-10-14"]}
ANSWERS = dict(activity="Événementiel", role="Responsable planning", team_size="6–20",
    monthly_missions="4–10", current_tools="Excel et WhatsApp",
    workflow="Nous créons un planning puis appelons chaque intervenant pour confirmer.",
    main_obstacle="Je ne sais pas comment remplacer un intervenant indisponible rapidement.",
    desired_improvement="Je voudrais une liste de remplaçants disponibles pour chaque créneau.",
    impact="Deux heures perdues par mission pour les relances.", satisfaction=3)


class RulesTests(TestCase):
    def test_first_day_paid_owner_and_previous_subscriber_are_excluded(self):
        for changes in ({"visit_days": ["2026-10-14", "2026-10-14"]},
                        {"plan": "pro"}, {"role": "owner"}, {"stripe_subscription_id": "sub_old"}):
            self.assertFalse(eligible({**USER, **changes}))
        self.assertTrue(eligible(USER))

    def test_snooze_and_completion(self):
        self.assertTrue(status(USER, NOW)["show"])
        self.assertFalse(status({**USER, "feedback_snoozed_until": "2026-10-21T12:00:00+00:00"}, NOW)["show"])
        value = status({**USER, "return_feedback": {"promo_code": "AVIS-X"}}, NOW)
        self.assertFalse(value["show"])
        self.assertEqual(value["promo_code"], "AVIS-X")

    def test_answers_require_specific_details_and_valid_segments(self):
        for changes in ({"main_obstacle": "   "}, {"impact": "court"},
                        {"satisfaction": 11}, {"satisfaction": "5"}, {"team_size": "invalid"}):
            with self.assertRaises(ValidationError):
                FeedbackIn(**{**ANSWERS, **changes})

    def test_reward_rejects_other_users_annual_and_mission_payments(self):
        user = {**USER, "return_feedback": {"promo_code": "AVIS-X"}}
        stripe = Mock()
        for lookup, code in (("shiftflow_pro_yearly", "AVIS-X"),
                             ("shiftflow_mission", "AVIS-X"), ("shiftflow_monthly", "AVIS-Y")):
            with self.assertRaises(HTTPException):
                discount_options(stripe, user, lookup, code, "prod_pro")
        stripe.Coupon.create.assert_not_called()

    def test_discount_is_two_months_single_use_and_collects_card(self):
        class Missing(Exception):
            code = "resource_missing"
        coupon = {"valid": True}
        coupon = type("Coupon", (dict,), {"id": "coupon_u"})(coupon)
        stripe = SimpleNamespace(Coupon=Mock(), error=SimpleNamespace(InvalidRequestError=Missing))
        stripe.Coupon.retrieve.side_effect = Missing()
        stripe.Coupon.create.return_value = coupon
        result = discount_options(stripe, {**USER, "return_feedback": {"promo_code": "AVIS-X"}},
                                  "shiftflow_monthly", "AVIS-X", "prod_pro")
        self.assertEqual(result, {"discounts": [{"coupon": "coupon_u"}], "payment_method_collection": "always"})
        options = stripe.Coupon.create.call_args.kwargs
        self.assertEqual((options["percent_off"], options["duration"], options["duration_in_months"], options["max_redemptions"]), (100, "repeating", 2, 1))
        self.assertEqual(options["applies_to"], {"products": ["prod_pro"]})
        self.assertEqual(options["id"], "feedback-v1-AVIS-X")
        stripe.Coupon.retrieve.side_effect = None
        stripe.Coupon.retrieve.return_value = type("Coupon", (dict,), {"id": "coupon_u"})({"valid": False})
        with self.assertRaises(HTTPException):
            discount_options(stripe, {**USER, "return_feedback": {"promo_code": "AVIS-X"}}, "shiftflow_monthly", "AVIS-X", "prod_pro")


class SubmissionTests(IsolatedAsyncioTestCase):
    async def test_concurrent_retries_keep_one_reward_and_original_answers(self):
        class Users:
            def __init__(self): self.user = deepcopy(USER)
            async def update_one(self, query, update):
                if "return_feedback" not in self.user:
                    self.user.update(deepcopy(update["$set"]))
            async def find_one(self, *args): return deepcopy(self.user)
        users = Users()
        results = await asyncio.gather(*(submit(users, USER, FeedbackIn(**ANSWERS), NOW) for _ in range(5)))
        self.assertEqual(len({r["promo_code"] for r in results}), 1)
        await submit(users, USER, FeedbackIn(**{**ANSWERS, "satisfaction": 10}), NOW)
        self.assertEqual(users.user["return_feedback"]["answers"]["satisfaction"], 3)
