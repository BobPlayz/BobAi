import unittest

from prepare_dataset import normalize, sanitize, split


class TrainingPolicyTests(unittest.TestCase):
    def test_missing_consent_is_rejected(self):
        self.assertIsNone(
            normalize(
                {
                    "eligible_for_training": False,
                    "consent_scope": "preferences-and-conversations",
                    "messages": [
                        {"role": "user", "content": "hello"},
                        {"role": "assistant", "content": "hi"},
                    ],
                }
            )
        )

    def test_secrets_and_contact_data_are_sanitized(self):
        text = "email test@example.com token=abcdefghijklmnopqrstuvwxyz123456"
        clean = sanitize(text)
        self.assertNotIn("test@example.com", clean)
        self.assertNotIn("abcdefghijklmnopqrstuvwxyz123456", clean)
        self.assertIn("[PRIVATE]", clean)
        self.assertIn("[REDACTED]", clean)

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
