# brasil_perpendicular

Extensão brasileira que identifica e sinaliza possíveis vídeos gerados ou manipulados por IA diretamente no navegador porque, diante da desinformação, o Brasil precisa de uma direção perpendicular.

## O que é

Extensão para navegadores Chromium (Manifest V3) que sobrepõe um selo explicativo a vídeos em páginas web, combinando divulgações da plataforma, contexto textual da página, regras locais e (nas próximas fases) análise visual e checagem externa. O resultado é comunicado como **evidência com incerteza explícita** — nunca como veredicto.

## Limitações desta versão

- **Não é prova definitiva.** O produto nunca afirma que um vídeo é "100% real" ou "0% IA"; ausência de evidência não é evidência de autenticidade.
- **Análise visual indisponível.** A interface `VisualDetector` existe, com um mock (apenas em modo desenvolvedor) e um stub ONNX, mas nenhum modelo real está integrado ao pipeline nesta entrega. Todo assessment marca `visual_model` em `unavailableAnalyses`.
- **API sem análise real.** Os endpoints `/api/v1/analyze/*` existem, validam e limitam payloads, mas sempre respondem `{"status": "unavailable"}` — nunca um resultado fabricado.
- **Apenas o adaptador genérico.** YouTube, TikTok, Instagram e X/Twitter ainda não têm adaptadores dedicados (Fase 2); a extensão usa extração de contexto genérica (meta tags, `figcaption`, `aria-label`, texto ao redor do vídeo).
- **Sem áudio, temporal, C2PA, hash perceptual ou fact-check** — apenas interfaces declaradas (Fase 4).

Veja [`docs/roadmap.md`](docs/roadmap.md) para o que cada fase adiciona e [`docs/product/mvp-scope.md`](docs/product/mvp-scope.md) para o escopo completo.

## Estrutura do monorepo

```text
apps/
  extension/          # extensão Chromium (Manifest V3)
  api/                 # API FastAPI opcional (análise profunda honesta)
packages/
  shared/              # @bp/shared — tipos, schemas zod, URL, hash
  detection-core/      # @bp/detection-core — evidências, regras, agregação, classificação
  ui/                  # @bp/ui — componentes React de apresentação
scripts/
  demo/                # páginas HTML locais para teste manual
docs/                  # arquitetura, pipeline de detecção, privacidade, ameaças, plano
```

Detalhes de arquitetura, decisões e convenções de código: [`docs/architecture.md`](docs/architecture.md).

## Pré-requisitos

- Node.js 20+ (testado com 22) e npm.
- Python 3.12+ (apenas para `apps/api`, opcional).

## Instalação

```bash
npm install
```

Isso instala as dependências de todos os workspaces (`packages/*` e `apps/extension`).

A API tem seu próprio ambiente virtual, isolado do restante do repositório:

```bash
cd apps/api
python -m venv .venv
.venv/Scripts/python.exe -m pip install -e ".[dev]"
```

(em Linux/macOS: `.venv/bin/python -m pip install -e ".[dev]"`)

## Rodar os testes

```bash
npm test              # Vitest — todos os pacotes TS (workspace)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit em cada pacote, na ordem de dependência
```

API:

```bash
cd apps/api
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe -m ruff check .
.venv/Scripts/python.exe -m mypy app
```

## Build

```bash
npm run build           # equivalente a: npm run build -w extension
```

O build da extensão roda dois passes do Vite (content script em IIFE, depois service worker/popup/options como ESM) e gera `apps/extension/dist/`.

## Carregar a extensão no Chrome

1. Rode `npm run build` (ou `npm run build -w extension`).
2. Abra `chrome://extensions`.
3. Ative o **Modo de desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `apps/extension/dist`.
5. Confirme que o card da extensão não mostra erros.
6. Após qualquer mudança de código: rode o build de novo e clique em recarregar (ícone circular) no card da extensão em `chrome://extensions`.

## Rodar a API (opcional)

A API só é necessária para a "análise com mais profundidade" (que hoje responde honestamente `unavailable`) e para `/api/v1/feedback`.

```bash
cd apps/api
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

Verifique com `GET http://localhost:8000/health`.

## Configurar a URL da API

Na tela de opções da extensão (ícone da extensão → **Configurações**, ou clique em "Configurações" no popup), há um campo **URL da API** (padrão `http://localhost:8000`). A "Análise profunda no servidor" fica **desligada por padrão** — é preciso ativá-la explicitamente nas opções antes de qualquer envio ao servidor, e o painel de detalhes pede consentimento antes de cada envio.

## Demos locais

```bash
npm run demo
```

Serve `scripts/demo/` em `http://localhost:8080`. Abra `http://localhost:8080` e siga os links: vídeo único, vários vídeos, feed infinito, vídeo trocado, rótulo de IA, sem evidências, vídeo CORS, player customizado. O `content_scripts.matches` do manifest já cobre `http://localhost/*` e `http://127.0.0.1/*`, então a extensão carregada ativa normalmente nessas páginas.

## Como adicionar um adaptador de plataforma

Veja o guia completo em [`docs/platform-adapters.md`](docs/platform-adapters.md). Resumo:

1. Implemente a interface `PlatformAdapter` (`apps/extension/src/platforms/types.ts`) em um novo arquivo, ex. `apps/extension/src/platforms/youtube.ts`.
2. Registre o adaptador em `apps/extension/src/platforms/registry.ts`, **antes** do `genericAdapter` (que permanece como último fallback).
3. Adicione testes de fixture (HTML de exemplo da plataforma) cobrindo `extractContext`.
4. Adicione o domínio da plataforma em `content_scripts.matches` no manifest, se necessário.

## Como integrar um modelo de detecção visual

Veja o contrato completo em [`docs/detection-pipeline.md`](docs/detection-pipeline.md) §7 e o guia em [`docs/model-integration.md`](docs/model-integration.md). Resumo:

1. Implemente a interface `VisualDetector` (`apps/extension/src/detectors/types.ts`): `name`, `version`, `isMock`, `initialize()`, `analyzeFrames(frames)`.
2. Nunca produza saída sem rótulo `isMock` correto; um detector mock só pode ser instanciado com `devMode = true` e deve prefixar avisos/labels com `[MOCK]`.
3. Sem detector real disponível, o pipeline registra `visual_model` em `unavailableAnalyses` — o score de `synthetic_media` **não** é penalizado por indisponibilidade.

## Passos manuais ainda pendentes (não automatizáveis neste ambiente)

- Carregar a extensão de fato em `chrome://extensions` e navegar pelas páginas de demo (passo a passo acima).
- Abrir o DevTools (aba **Network**) com a extensão ativa e confirmar que nenhuma requisição de rede sai sem uma ação explícita do usuário (clique em "Analisar vídeos desta página" ou em "Analisar com mais profundidade").

## Contribuindo

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md).
