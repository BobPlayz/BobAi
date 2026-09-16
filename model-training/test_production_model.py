import unittest
import torch

from production_model import BobProductionLM, ProductionConfig, parameter_count


class ProductionModelTests(unittest.TestCase):
    def test_forward_shape(self):
        config = ProductionConfig(vocab_size=512, context_size=64, d_model=64, n_heads=4, n_kv_heads=2, n_layers=2, ffn_dim=128)
        model = BobProductionLM(config)
        x = torch.randint(0, config.vocab_size, (2, 16))
        y = model(x)
        self.assertEqual(tuple(y.shape), (2, 16, config.vocab_size))
        self.assertGreater(parameter_count(model), 0)

    def test_generation_runs(self):
        config = ProductionConfig(vocab_size=512, context_size=32, d_model=64, n_heads=4, n_kv_heads=2, n_layers=1, ffn_dim=128)
        model = BobProductionLM(config)
        x = torch.randint(0, config.vocab_size, (1, 4))
        y = model.generate(x, max_new_tokens=2, temperature=0)
        self.assertEqual(y.shape[1], 6)

    def test_invalid_gqa_rejected(self):
        with self.assertRaises(ValueError):
            ProductionConfig(vocab_size=512, context_size=64, d_model=64, n_heads=6, n_kv_heads=4, n_layers=2, ffn_dim=128).validate()


if __name__ == "__main__":
    unittest.main()
