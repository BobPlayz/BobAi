import json,tempfile,unittest
from pathlib import Path
from tokenizers import Tokenizer
from train_tokenizer import iter_text

class TokenizerInputTests(unittest.TestCase):
 def test_accepts_raw_text_and_messages(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/"data.jsonl"; path.write_text(json.dumps({"text":"Hello తెలుగు"})+"\n"+json.dumps({"messages":[{"role":"user","content":"hi"},{"role":"assistant","content":"hello"}]})+"\n",encoding="utf-8")
   rows=list(iter_text([path])); self.assertEqual(len(rows),2); self.assertIn("Hello",rows[0]); self.assertIn("<|user|>",rows[1])

if __name__=="__main__": unittest.main()
