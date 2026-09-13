import unittest

from prepare_dataset import eligible, normalize, sanitize, split


class TrainingPolicyTests(unittest.TestCase):
    def test_missing_or_incomplete_consent_is_rejected(self):
        base = {
            "eligible_for_training": True,
            "messages": [
                {"role": "user", "content": "hello"},
                {"role": "assistant", "content": "hi"},
            ],
        }
        self.assertFalse(eligible({**base, "consent_scope": ""}))
        self.assertFalse(eligible({**base, "consent_scope": "preferences"}))
        self.assertTrue(eligible({**base, "consent_scope": "preferences-and-conversations"}))
        self.assertIsNone(normalize({**base, "consent_scope": ""}))

    def test_secrets_and_contact_data_are_sanitized(self):
        text = "email test@example.com phone +91 9876543210 token=abcdefghijklmnopqrstuvwxyz123456"
        clean = sanitize(text)
        self.assertNotIn("test@example.com", clean)
        self.assertNotIn("9876543210", clean)
        self.assertNotIn("abcdefghijklmnopqrstuvwxyz123456", clean)
        self.assertIn("[PRIVATE]", clean)
        self.assertIn("[REDACTED]", clean)

    def test_normalize_requires_user_and_assistant(self):
        base = {"eligible_for_training": True, "consent_scope": "preferences-and-conversations"}
        self.assertIsNone(normalize({**base, "messages": [{"role": "assistant", "content": "hi"}]}))
        self.assertIsNone(normalize({**base, "messages": [{"role": "user", "content": "hello"}]}))

    def test_split_is_deterministic_and_non_empty(self):
        rows = [
            {"fingerprint": f"{index:064x}", "messages": [{"role": "user", "content": str(index)}, {"role": "assistant", "content": "ok"}]}
            for index in range(20)
        ]
        first = split(rows)
        second = split(rows)
        self.assertEqual(first, second)
        self.assertTrue(all(first))
        self.assertEqual(sum(len(part) for part in first), 20)


if __name__ == "__main__":
    unittest.main()
