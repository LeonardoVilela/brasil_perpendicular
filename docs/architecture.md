# Arquitetura — Brasil Perpendicular

Data: 2026-07-25
Documentos relacionados: [detection-pipeline.md](detection-pipeline.md), [privacy.md](privacy.md), [threat-model.md](threat-model.md)

## 1. Visão geral

Monorepo com uma extensão Chromium (Manifest V3) e uma API FastAPI opcional. O núcleo de detecção é uma biblioteca TypeScript pura, sem dependência de DOM, React, APIs de navegador ou plataforma específica.

```text
brasil_perpendicular/
├── apps/
│   ├── extension/          # integração com o navegador
│   └── api/                # FastAPI (análise profunda explícita)
├── packages/
│   ├── shared/             # tipos, schemas zod, utilitários (URL, hash)
│   ├── detection-core/     # evidências, regras, agregação, classificação
│   └── ui/                 # componentes React de apresentação
├── docs/
│   └── product/
├── scripts/
│   └── demo/               # páginas HTML locais de teste
├── package.json            # npm workspaces
└── README.md
```

### Regras de dependência

```text
apps/extension ──> packages/ui ──> packages/shared
apps/extension ──> packages/detection-core ──> packages/shared
apps/api       ──> (independente; contratos espelhados via schemas)
```

- `detection-core` **não** importa React, `chrome.*`, DOM nem seletores de plataforma.
- `ui` **não** implementa lógica de pontuação; recebe `DetectionAssessment` pronto.
- Comportamento específico de plataforma vive em adaptadores dentro de `apps/extension/src/platforms/`.

## 2. Extensão — componentes

```text
apps/extension/src/
├── manifest.json
├── content/
│   ├── index.ts            # bootstrap do content script
│   ├── video-registry.ts   # WeakMap de vídeos rastreados + identidade
│   ├── observers.ts        # MutationObserver + IntersectionObserver + debounce
│   ├── analysis-queue.ts   # fila com limite de concorrência
│   ├── overlay-manager.ts  # cria/atualiza/remove hosts Shadow DOM
│   └── pipeline.ts         # orquestra adapter → core → overlay → cache
├── platforms/
│   ├── types.ts            # PlatformAdapter, DetectedVideo, VideoContext
│   ├── registry.ts         # seleção do adaptador ativo
│   ├── extract.ts          # texto visível, normalização e associação ao post
│   ├── generic.ts          # fallback genérico endurecido
│   └── youtube.ts, tiktok.ts, instagram.ts, twitter.ts
├── detectors/
│   ├── types.ts            # VisualDetector, VisualDetectionResult
│   ├── mock.ts             # apenas dev mode; saída rotulada como mock
│   ├── onnx.ts             # sinal temporal D3 e contrato local
│   ├── inference-client.ts # cliente do worker dedicado
│   └── inference-worker.ts # ONNX Runtime Web: WebGPU → WASM
├── background/
│   └── service-worker.ts   # cache, settings, cliente da API, mensagens
├── popup/                  # React
├── options/                # React
└── messaging/
    └── protocol.ts         # uniões discriminadas tipadas (validação zod)
```

### Fluxo principal

1. `observers` detecta `<video>` (carga inicial + mutações, com debounce) e registra no `video-registry` (WeakMap — sem vazamento com elementos reciclados).
2. `IntersectionObserver` marca visibilidade; um timer de permanência (padrão 2 s, configurável) enfileira a análise na `analysis-queue` (concorrência padrão 2).
3. `pipeline` resolve a identidade, extrai o contexto e encerra cedo quando existe uma declaração explícita confiável.
4. Até 16 frames reduzidos alimentam o detector D3 local no worker. Contexto político altera prioridade, mas não o score.
5. Com opt-in ou confirmação manual, o service worker envia somente frames e metadados técnicos ao STALL. Um resultado eleitoral incerto pode usar outra janela de 16 frames.
6. O resultado fundido atualiza o overlay e é persistido sem pixels no cache.

### Mensageria

Protocolo tipado em `messaging/protocol.ts`, validado com zod na recepção:

- `content ↔ service worker`: `CACHE_GET`, `CACHE_PUT`, `SETTINGS_GET`, `DEEP_ANALYZE_REQUEST`, `DEEP_VISUAL_ANALYZE_REQUEST`, `FEEDBACK_SUBMIT`.
- `popup/options ↔ service worker`: `SETTINGS_GET/SET`, `PAGE_STATUS_GET`, `INJECT_CONTENT_SCRIPT` (reinjeção manual de fallback via `activeTab` + `chrome.scripting`; o bootstrap é idempotente).

O service worker é a única fonte de verdade para settings e cache (`chrome.storage.local`). A pontuação roda no content script (função pura, rápida, sem rede).

## 3. Decisões arquiteturais (com alternativas)

### D1 — Monorepo: npm workspaces
- **Alternativas**: pnpm (+velocidade, −atrito de instalação; symlinks problemáticos em Windows/OneDrive), Turborepo/Nx (orquestração desnecessária para 4 pacotes — YAGNI).
- **Decisão**: npm workspaces. Scripts raiz encadeiam builds na ordem de dependência.

### D2 — Build da extensão: Vite "puro" com múltiplas entradas
- **Alternativas**: CRXJS (HMR excelente, histórico de manutenção instável), WXT (framework completo, acoplamento e convenções próprias).
- **Decisão**: Vite sem plugins de extensão. Três passes de build: (a) worker ONNX; (b) content script em formato IIFE; (c) service worker, popup e options como ESM. `manifest.json` estático é copiado para `dist/`.
- **Trade-off aceito**: sem HMR; em troca, saída determinística e zero dependência frágil.

### D3 — Overlay: Shadow DOM + React por host
- Host `<div>` posicionado sobre o vídeo (canto superior), com `ShadowRoot` isolando estilos (CSS injetado inline no shadow root; CSS Modules nos componentes).
- Em `declared_ai` e `likely_ai`, a UI adiciona o asset local `Anti_AI.svg.webp` como marca visual acessível.
- Um root React por host; hosts existem apenas para vídeos em/perto do viewport (limite via fila). Se o número de roots virar gargalo, migrar para um root único com portais (registrado como evolução, não implementado — YAGNI).
- `pointer-events` apenas nos elementos interativos do selo; controles nativos do player permanecem clicáveis.

### D4 — Núcleo puro e inversão de dependência
- `detection-core` expõe `assess(context, options): DetectionAssessment` e o motor de regras configurável.
- Detectores visuais e adaptadores implementam interfaces (`VisualDetector`, `PlatformAdapter`) injetadas no pipeline — trocáveis sem tocar no núcleo.

### D5 — Permissões mínimas (ver [privacy.md](privacy.md))
- `permissions`: `storage`, `activeTab`, `scripting`.
- `content_scripts.matches`: páginas `http://*/*` e `https://*/*`, para detectar vídeos automaticamente sem exigir um clique por página.
- O escopo não usa `<all_urls>`: protocolos como `file://` e `ftp://` ficam fora. `activeTab` + `scripting` permanecem somente como fallback manual.
- **Trade-off aceito**: o navegador pede acesso a todos os sites HTTP/HTTPS. D3 é local; o STALL automático exige opt-in independente e o STALL manual exige confirmação.

### D6 — Identidade de vídeo e cache
- `VideoIdentity` = plataforma + melhor identificador disponível (id de publicação > URL canônica do vídeo > URL normalizada da página + posição estável) + `contextHash` (FNV-1a de título|descrição|duração — hash simples de cache, sem função criptográfica).
- URLs `blob:` nunca são identificador permanente.
- Cache LRU em `chrome.storage.local`: TTL 7 dias, máx. 500 entradas.
- Interface `PerceptualHashProvider` declarada e não implementada (Fase 4).

### D7 — API STALL opcional
- `/api/v1/analyze/frames` valida JPEGs e executa STALL/DINOv3 quando os artefatos externos estão configurados.
- Sem licença reconhecida, pesos ou parâmetros válidos, responde `unavailable` em vez de fabricar um score.
- Inferência é limitada por semáforo; o cache SQLite guarda apenas fingerprint, versões e resultado.

### D8 — Validação de contratos: zod (TS) + Pydantic (Python)
- Schemas zod em `packages/shared` validam mensagens internas e payloads da API no lado da extensão; Pydantic valida no servidor. Contratos espelhados manualmente e cobertos por testes de payload em ambos os lados.

### D9 — Testes
- Vitest (+ Testing Library + happy-dom) para pacotes TS; mocks explícitos para `chrome.*`, `MutationObserver`, `IntersectionObserver`.
- pytest + httpx para a API; Ruff + mypy.
- Playwright como smoke test opcional (Chromium com `--load-extension` sobre página de demonstração) — última tarefa do plano, não bloqueia a entrega.

### D10 — Estados do overlay
Máquina de estados por vídeo: `waiting → analyzing → {declared_ai | likely_ai | possibly_ai | insufficient_evidence | inconclusive | error}`, com `closed` e `minimized` ortogonais (preferência do usuário por vídeo/sessão).

## 4. Tratamento de erros

- Toda falha de análise vira estado `error`/`inconclusive` com motivo em `limitations` — nunca trava o overlay em "Analisando".
- CORS/canvas contaminado/DRM: o extrator degrada para `visual_capture` indisponível sem alterar o score.
- Mensageria: respostas sempre tipadas `{ ok: true, data } | { ok: false, error }`; timeouts no content script.
- API: erros de validação → 422; payload excedente → 413; erros internos sem vazamento de detalhes.
- Logs estruturados apenas em modo desenvolvedor; nunca logar frames, URLs privadas ou texto integral da página.

## 5. Convenções

- TypeScript strict em todos os pacotes; `any` proibido sem justificativa em comentário.
- ESLint + Prettier na raiz; Ruff/mypy na API.
- Strings de UI centralizadas (`packages/ui/src/strings.ts`) em pt-BR.
- Seletores de DOM específicos de plataforma existem apenas em `apps/extension/src/platforms/*`.
- Commits pequenos e coerentes, com mensagens curtas em estilo convencional (`feat:`, `fix:`, `docs:`).

### Estilo de código

Código pragmático e legível, como um time pequeno escreveria:

- funções fazem algo de verdade; sem wrappers de uma linha que só repassam argumentos;
- sem cadeias de indireção (função → função → classe → classe) para agradar padrão de projeto;
- interfaces apenas onde existe substituição real (detectores visuais, adaptadores de plataforma, providers futuros) — o resto é função e objeto simples;
- classes só quando há estado com ciclo de vida (ex.: fila de análise, registro de vídeos); caso contrário, módulos com funções;
- nomes naturais e diretos; comentários raros, apenas para restrições não óbvias;
- preferir código explícito repetido duas vezes a abstração prematura usada uma vez.
