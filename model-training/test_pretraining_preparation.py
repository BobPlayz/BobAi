import json,tempfile,unittest
from pathlib import Path
from prepare_pretraining import split_file

class PretrainingPreparationTests(unittest.TestCase):
 def test_split_is_deterministic_and_preserves_records(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory); source=root/"source.jsonl"; train=root/"train.jsonl"; validation=root/"validation.jsonl"
   rows=[{"text":f"record {i}","sha256":f"{i:064x}"} for i in range(50)]
   source.write_text("".join(json.dumps(row)+"\n" for row in rows),encoding="utf-8")
   first=split_file(source,train,validation,.1); first_train=train.read_text(); first_validation=validation.read_text()
   train.unlink(); validation.unlink(); second=split_file(source,train,validation,.1)
   self.assertEqual(first,second); self.assertEqual(first_train,train.read_text()); self.assertEqual(first_validation,validation.read_text()); self.assertEqual(first[0]+first[1],50)

if __name__=="__main__": unittest.main()
