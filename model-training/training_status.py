from __future__ import annotations
import json
from pathlib import Path

def load(output_dir: str | Path = 'model-training/output/bob-production') -> dict:
    path=Path(output_dir)/'training-status.json'
    if not path.exists(): return {'state':'not_started','message':'no training status yet'}
    try: return json.loads(path.read_text(encoding='utf-8'))
    except (OSError,json.JSONDecodeError): return {'state':'unknown','message':'status is temporarily unavailable'}

if __name__=='__main__': print(json.dumps(load(),indent=2))
