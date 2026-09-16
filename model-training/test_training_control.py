import tempfile, unittest
from pathlib import Path
from training_control import read_status, set_command

class TrainingControlTests(unittest.TestCase):
 def test_control_command_is_atomic_and_status_fallback_is_safe(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); self.assertEqual(read_status(root)["state"],"not_started")
   set_command(root,"pause")
   self.assertEqual((root/"training-control.json").exists(),True)

if __name__=="__main__": unittest.main()
