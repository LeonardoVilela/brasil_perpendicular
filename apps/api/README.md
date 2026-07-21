# apps/api

API honesta (opt-in): nunca fabrica análise, só valida/limita e responde
`status: "unavailable"`. `/api/v1/feedback` grava JSONL local de verdade.

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -e ".[dev]"
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
.venv/Scripts/python.exe -m pytest
```
