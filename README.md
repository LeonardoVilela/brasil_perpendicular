# brasil_perpendicular

Extensão brasileira que identifica e sinaliza possíveis vídeos gerados ou manipulados por IA diretamente no navegador porque, diante da desinformação, o Brasil precisa de uma direção perpendicular.

## O que é

Extensão para navegadores Chromium (Manifest V3) que sobrepõe um selo explicativo a vídeos em páginas web. A V3 combina divulgações da plataforma, contexto textual, análise visual local D3 e, quando autorizada, análise aprofundada STALL/DINOv3 no servidor. O resultado é comunicado como **evidência com incerteza explícita** — nunca como veredicto.

## Limitações desta versão

- **Não é prova definitiva.** O produto nunca afirma que um vídeo é "100% real" ou "0% IA"; ausência de evidência não é evidência de autenticidade.
- **Nenhum detector é infalível.** Vídeos inéditos, compressão, recortes curtos e ataques adversariais podem gerar falsos positivos e falsos negativos.
- **D3 local ainda não decide sozinho.** O modelo ONNX e a estatística temporal D3 são reais, mas os thresholds operacionais aguardam validação independente. Até lá, o resultado local é `uncertain` e serve para rotear a cascata sem fabricar evidência.
- **STALL exige infraestrutura externa.** O detector aprofundado usa a implementação oficial STALL com DINOv3 ViT-L/16. Os pesos DINOv3 não são redistribuídos neste repositório e precisam ser obtidos do fornecedor. Sem os artefatos configurados, a API responde `unavailable`.
- **Licença do STALL.** O código upstream é CC BY-NC; confirme que o uso é não comercial e compatível com seus termos antes de ativá-lo.
- **Adaptadores são heurísticos e versionados.** YouTube, TikTok, Instagram e X/Twitter têm extração dedicada e fallback genérico, mas mudanças no DOM das plataformas podem reduzir a cobertura até os seletores serem atualizados.
- **Sem áudio, C2PA ou fact-check.** Contexto político apenas aumenta a prioridade e nunca é tratado como evidência de IA.

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
```

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

O build da extensão roda três passes do Vite (worker ONNX, content script em IIFE e service worker/popup/options como ESM) e gera `apps/extension/dist/`.

Para gerar o ZIP de produção com a API HTTPS correta:

```powershell
npm run package:extension -- -ApiUrl "https://api.seudominio.com"
```

O modelo ONNX leve e o runtime WASM vão dentro do pacote; o STALL/DINOv3
continua na API do projeto.

## Carregar a extensão no Chrome ou Brave

1. Rode `npm run build` (ou `npm run build -w extension`).
2. Abra `chrome://extensions` no Chrome ou `brave://extensions` no Brave.
3. Ative o **Modo de desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `apps/extension/dist`.
5. Confirme que o card da extensão não mostra erros. No Brave, abra **Detalhes → Acesso ao site** e selecione **Em todos os sites**. Sem isso, o navegador só executa a extensão depois de um clique no ícone.
6. Após qualquer mudança de código: rode o build de novo e clique em recarregar (ícone circular) no card da extensão em `chrome://extensions`.

## Rodar a API (opcional)

A API só é necessária para a análise STALL e para `/api/v1/feedback`. Sem os artefatos STALL/DINOv3, ela inicia normalmente e informa `unavailable`.

```bash
cd apps/api
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

Verifique com `GET http://localhost:8000/health`.

## Configurar a URL da API

Na tela de opções da extensão há um campo **URL da API** (padrão `http://localhost:8000`) e dois controles independentes:

- **Análise automática local:** roda D3 no próprio navegador e fica ligada por padrão.
- **Análise visual automática no servidor:** envia até 16 frames JPEG reduzidos por chamada e fica desligada por padrão. Contexto eleitoral pode usar uma segunda janela, totalizando no máximo 32 frames.

O botão **Analisar com mais profundidade** continua disponível como ação manual e mostra exatamente o que será enviado. Frames, fingerprint e metadados técnicos são enviados; URL, legenda, termos políticos, autor e vídeo integral não são enviados.

## Demos locais

```bash
npm run demo
```

Serve `scripts/demo/` em `http://localhost:8080`. Abra `http://localhost:8080` e siga os links: vídeo único, vários vídeos, feed infinito, vídeo trocado, rótulo de IA, sem evidências, vídeo CORS, player customizado. O `content_scripts.matches` do manifest cobre páginas HTTP/HTTPS, então a extensão carregada ativa automaticamente nas demos e em sites comuns, sem clicar no popup a cada página. Na página **Rótulo de IA**, uma declaração explícita do autor produz `declared_ai` e mostra também o símbolo visual grande `Anti_AI.svg.webp`; pistas genéricas não mostram esse símbolo.

## Como adicionar um adaptador de plataforma

Resumo:

1. Implemente a interface `PlatformAdapter` (`apps/extension/src/platforms/types.ts`) em um novo arquivo, ex. `apps/extension/src/platforms/youtube.ts`.
2. Registre o adaptador em `apps/extension/src/platforms/registry.ts`, **antes** do `genericAdapter` (que permanece como último fallback).
3. Adicione testes de fixture (HTML de exemplo da plataforma) cobrindo `extractContext`.
4. Confirme a extração com fixtures de DOM normal, parcial e conteúdo associado ao post errado. O manifest V2 já cobre páginas HTTP/HTTPS.

## Como integrar um modelo de detecção visual

Contrato mínimo:

1. Implemente a interface `VisualDetector` (`apps/extension/src/detectors/types.ts`): `name`, `version`, `isMock`, `initialize()`, `analyzeFrames(frames)`.
2. Nunca produza saída sem rótulo `isMock` correto; um detector mock só pode ser instanciado com `devMode = true` e deve prefixar avisos/labels com `[MOCK]`.
3. Sem detector real disponível, o pipeline registra a análise em `unavailableAnalyses` — o score de `synthetic_media` **não** é penalizado por indisponibilidade.

## Passos manuais ainda pendentes (não automatizáveis neste ambiente)

- Carregar a extensão de fato em `chrome://extensions` e navegar pelas páginas de demo (passo a passo acima).
- Abrir o DevTools (aba **Network**) com a extensão ativa e confirmar que nenhuma requisição da extensão sai sem uma ação explícita do usuário ("Analisar com mais profundidade" ou envio de feedback). O carregamento dos vídeos pela própria página não conta como tráfego da extensão.

## Contribuindo

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md).
