# Adaptadores de plataforma — Brasil Perpendicular

Data: 2026-07-20
Documentos relacionados: [architecture.md](architecture.md), [detection-pipeline.md](detection-pipeline.md)

Comportamento específico de plataforma (seletores de DOM, rótulos nativos, estrutura de página) vive **exclusivamente** em `apps/extension/src/platforms/`. O núcleo de detecção (`detection-core`) nunca conhece uma plataforma específica.

## O contrato: `PlatformAdapter`

Definido em `apps/extension/src/platforms/types.ts`:

```ts
import type { VideoContext } from "@bp/shared";

export interface PlatformAdapter {
  name: "generic" | "youtube" | "tiktok" | "instagram" | "twitter";
  matches(location: Location): boolean;
  extractContext(video: HTMLVideoElement, doc: Document): VideoContext;
}
```

- `matches(location)`: decide se este adaptador é responsável pela página atual (normalmente checando `location.hostname`).
- `extractContext(video, doc)`: dado um `<video>` já detectado e o `Document` da página, retorna um `VideoContext` (título, descrição, hashtags, aria-labels, legendas, nome do autor, URL normalizada da página, duração). Nunca lança para conteúdo inesperado — degrada para campos vazios/`undefined`.

`VideoContext` está definido em `packages/shared/src/types.ts` e é o mesmo tipo consumido por `detection-core.assess()`, independentemente de qual adaptador o produziu.

## Seleção do adaptador ativo

`apps/extension/src/platforms/registry.ts`:

```ts
const adapters: PlatformAdapter[] = [genericAdapter];

export function pickAdapter(location: Location): PlatformAdapter {
  return adapters.find((adapter) => adapter.matches(location)) ?? genericAdapter;
}
```

Adaptadores específicos entram na lista **antes** do `genericAdapter`, que fica sempre por último como fallback — a ordem importa porque `pickAdapter` retorna o primeiro `match`.

## O adaptador genérico (Fase 1 — implementado)

`apps/extension/src/platforms/generic.ts` é o único adaptador desta entrega. `matches()` sempre retorna `true` (fallback universal). Extrai contexto apenas de marcação HTML padrão, sem nenhum seletor de plataforma:

- **Título**: `document.title`, com fallback para `<meta property="og:title">`.
- **Descrição**: concatenação de `<meta name="description">`, `<figcaption>` dentro de um `<figure>` ancestral do vídeo, e o texto do elemento pai do vídeo — truncada a 2000 caracteres.
- **Hashtags**: extraídas por regex Unicode (`#\p{L}[\p{L}\p{N}_]*`) do texto coletado acima, deduplicadas e em minúsculas.
- **Aria-labels**: sobe até 3 níveis de ancestrais do vídeo coletando `aria-label` não vazios.
- **Legendas (`captions`)**: sempre vazio no genérico (não há convenção padrão de onde encontrá-las fora de plataformas específicas).
- **Nome do autor**: sempre `undefined` no genérico.
- **Duração**: `video.duration`, se finito.
- **URL da página**: normalizada via `normalizeUrl()` (`packages/shared/src/url.ts`), que remove parâmetros de tracking antes de qualquer uso.

Cobertura de teste: `apps/extension/src/platforms/generic.test.ts` (13 testes com fixtures de HTML variadas).

## O que a Fase 2 adiciona

A Fase 2 (fora do escopo desta entrega) adiciona adaptadores dedicados para as quatro plataformas-alvo do produto, cada um em seu próprio arquivo (`youtube.ts`, `tiktok.ts`, `instagram.ts`, `twitter.ts`), registrados em `registry.ts` antes do genérico:

- Seletores de DOM específicos para título, descrição, hashtags e nome do canal/perfil de cada plataforma.
- Extração do **rótulo nativo de IA** quando a plataforma expõe um selo próprio no DOM (produz evidência do domínio `platform_disclosure`, grupo `platform-label`, weight 0.95/confidence 0.95 — só o adaptador específico gera esse tipo; o genérico não gera `platform_disclosure`).
- `content_scripts.matches` do manifest passa a incluir os domínios dessas plataformas (hoje cobre apenas `http://localhost/*` e `http://127.0.0.1/*`, usados pelas demos).
- Testes de fixture por plataforma (HTML capturado/reduzido de páginas reais), seguindo o mesmo padrão de `generic.test.ts`.

Mudanças de DOM nas plataformas quebram adaptadores silenciosamente com o tempo — por isso a extração degrada sempre para "Sem evidências suficientes"/"Análise inconclusiva" com a limitação registrada em `limitations`, nunca uma classificação inventada (ver `docs/threat-model.md` T7).

## Como adicionar um novo adaptador

1. Crie `apps/extension/src/platforms/<plataforma>.ts` implementando `PlatformAdapter`.
2. Implemente `matches()` checando o hostname relevante.
3. Implemente `extractContext()` reaproveitando utilitários de `@bp/shared` (`normalizeUrl`, tipos de `VideoContext`) — nunca duplique lógica de agregação/regras, que pertence a `detection-core`.
4. Registre o adaptador em `registry.ts`, antes de `genericAdapter`.
5. Adicione `<plataforma>.test.ts` com fixtures de HTML cobrindo os campos extraídos, incluindo casos de DOM ausente/inesperado (degradação graciosa).
6. Se a plataforma precisar de content script ativo automaticamente (não só via `activeTab`), adicione o domínio em `content_scripts.matches` no `manifest.json` e documente a justificativa em `docs/privacy.md` §5.
