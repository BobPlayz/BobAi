import unittest

import torch

from native_model import ASSISTANT, BOS, BobNativeLM, VOCAB_SIZE, encode_messages


class NativeModelTests(unittest.TestCase):
    def test_model_shape_and_forward(self):
        model = BobNativeLM()
        ids = encode_messages([{"role": "user", "content": "hello"}])
        logits = model(torch.tensor([ids], dtype=torch.long))
        self.assertEqual(logits.shape, (1, len(ids), VOCAB_SIZE))

    def test_protocol_tokens_are_distinct(self):
        ids = encode_messages([{"role": "user", "content": "hello"}, {"role": "assistant", "content": "world"}])
        self.assertEqual(ids[0], BOS)
        self.assertIn(ASSISTANT, ids)
        self.assertEqual(ids[-1], 257)


if __name__ == "__main__":
    unittest.main()
