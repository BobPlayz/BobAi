import unittest

import torch

from specialist_models import SPECIALISTS, loss_for, make_model


class SpecialistModelTests(unittest.TestCase):
    def test_all_specialists_have_finite_forward_and_loss(self):
        torch.manual_seed(1)
        cases = {
            "embed": lambda model: ({"ids_a": torch.randint(0, 261, (2, 8)), "ids_b": torch.randint(0, 261, (2, 8)), "mask_a": torch.ones(2, 8, dtype=torch.bool), "mask_b": torch.ones(2, 8, dtype=torch.bool), "label": torch.tensor([0.0, 1.0])},),
            "reranker": lambda model: ({"query": torch.randn(2, 128), "document": torch.randn(2, 128), "label": torch.tensor([0.0, 1.0])},),
            "vision": lambda model: ({"image": torch.rand(2, 3, 64, 64), "label": torch.randn(2, 128)},),
            "asr": lambda model: ({"mel": torch.randn(2, 80, 64), "targets": torch.tensor([1, 2, 3, 4]), "input_lengths": torch.tensor([16, 16]), "target_lengths": torch.tensor([2, 2])},),
            "tts": lambda model: ({"ids": torch.randint(0, 261, (2, 8)), "mel": torch.randn(2, 80, 16)},),
            "image": lambda model: ({"ids": torch.randint(0, 261, (2, 8)), "image": torch.rand(2, 3, 32, 32)},),
        }
        for kind in SPECIALISTS:
            model = make_model(kind)
            batch = cases[kind](model)[0]
            loss = loss_for(kind, model, batch)
            self.assertTrue(torch.isfinite(loss).item(), kind)


if __name__ == "__main__":
    unittest.main()
