# API de análise aprofundada

A API valida os frames, limita concorrência e executa STALL/DINOv3 quando os artefatos externos estão configurados. Caso contrário, responde `status: "unavailable"` sem inventar um resultado.

## Instalação básica

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Para instalar o backend STALL, use uma versão do PyTorch adequada ao hardware e depois:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev,stall]"
```

## Artefatos externos do STALL

Este repositório não redistribui STALL nem os pesos DINOv3. Configure:

```dotenv
STALL_ENABLED=true
STALL_NONCOMMERCIAL_ACKNOWLEDGED=true
STALL_REPO_DIR=C:\modelos\STALL
STALL_PARAMS_PATH=C:\modelos\STALL\precomputed\stall_params_vatex_dino_v3.npz
DINO_V3_REPO_DIR=C:\modelos\dinov3
DINO_V3_WEIGHTS=C:\modelos\dinov3\weights\dinov3_vitl16_pretrain_lvd1689m-8aa4cbdd.pth
STALL_DEVICE=cuda
STALL_MAX_CONCURRENT=1
STALL_CACHE_PATH=data\stall-cache.sqlite3
```

Use o commit STALL `bfcc603ae83b4e609681277b9b5e80e7a9497e15`. A API verifica o SHA-256 dos parâmetros VATEX: `beede546ca4385242c2a26075b8087ab51bee709549fc4ddc79d0eef5acce240`.

Os pesos DINOv3 ViT-L/16 precisam ser obtidos pelos canais oficiais da Meta. O código STALL upstream está sob CC BY-NC; `STALL_NONCOMMERCIAL_ACKNOWLEDGED=true` registra que o operador confirmou a restrição não comercial.

## Dados e retenção

- Cada chamada aceita de 4 a 16 JPEGs reduzidos, amostrados a 8 fps por 2 segundos.
- Os bytes dos frames ficam apenas em memória durante a inferência.
- O SQLite armazena somente resultado, fingerprint e versões; nunca pixels.
- Uma requisição eleitoral incerta pode gerar uma segunda chamada independente de 16 frames.

## Verificação

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m mypy app
```

O health check é `GET http://localhost:8000/health`.
