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
- `extractContext(video, doc)`: dado um `<video>` já detectado e o `Document` da página, retorna um `VideoContext` (título, descrição, hashtags, aria-labels, legendas, autor, declarações do autor, rótulos nativos, URL e duração). Nunca lança para conteúdo inesperado — degrada para campos vazios/`undefined`.

`VideoContext` está definido em `packages/shared/src/types.ts` e é o mesmo tipo consumido por `detection-core.assess()`, independentemente de qual adaptador o produziu.

## Seleção do adaptador ativo

`apps/extension/src/platforms/registry.ts`:

```ts
const adapters: PlatformAdapter[] = [
  youtubeAdapter,
  tiktokAdapter,
  instagramAdapter,
  twitterAdapter,
  genericAdapter,
];

export function pickAdapter(location: Location): PlatformAdapter {
  return adapters.find((adapter) => adapter.matches(location)) ?? genericAdapter;
}
```

Adaptadores específicos entram na lista **antes** do `genericAdapter`, que fica sempre por último como fallback — a ordem importa porque `pickAdapter` retorna o primeiro `match`.

## O adaptador genérico endurecido

`apps/extension/src/platforms/generic.ts` é o fallback universal. Extrai somente contexto HTML associado ao vídeo e normaliza texto com Unicode NFKC:

- **Título**: `document.title`, com fallback para `<meta property="og:title">`.
- **Descrição**: `<meta name="description">`, `<figcaption>` visível, alvos de `aria-describedby` e elementos explicitamente marcados com `data-bp-context`, truncada a 2000 caracteres.
- **Hashtags**: extraídas por regex Unicode (`#\p{L}[\p{L}\p{N}_]*`) do texto coletado acima, deduplicadas e em minúsculas.
- **Aria-labels**: apenas valores visíveis e semanticamente associados ao vídeo.
- **Legendas (`captions`)**: sempre vazio no genérico (não há convenção padrão de onde encontrá-las fora de plataformas específicas).
- **Declarações do autor**: somente elementos explicitamente marcados com `data-bp-author-statement`; o fallback não presume autoria a partir de texto solto.
- **Duração**: `video.duration`, se finito.
- **URL da página**: normalizada via `normalizeUrl()` (`packages/shared/src/url.ts`), que remove parâmetros de tracking antes de qualquer uso.

Texto oculto e o conteúdo arbitrário do elemento pai não são coletados. Isso reduz falsos positivos por comentários, recomendações e texto de outros posts.

## Adaptadores V2 implementados

A V2 inclui adaptadores dedicados em `youtube.ts`, `tiktok.ts`, `instagram.ts` e `twitter.ts`, registrados antes do fallback genérico:

- Seletores de DOM específicos para título, descrição, hashtags e nome do canal/perfil de cada plataforma.
- Extração do **rótulo nativo de IA** quando a plataforma o expõe visivelmente no mesmo post do vídeo. Isso produz origem `platform_disclosure`, domínio `platform_disclosure`, grupo `platform-label`, peso `1` e confiança `0.98`.
- `content_scripts.matches` já cobre páginas HTTP/HTTPS; novos adaptadores não precisam ampliar o acesso do manifest.
- Testes de fixture por plataforma cobrem extração, DOM parcial e associação ao post correto; no X, o texto de um post citado não é herdado pelo vídeo externo.

Mudanças de DOM nas plataformas quebram adaptadores silenciosamente com o tempo — por isso a extração degrada sempre para "Sem evidências suficientes"/"Análise inconclusiva" com a limitação registrada em `limitations`, nunca uma classificação inventada (ver `docs/threat-model.md` T7).

## Como adicionar um novo adaptador

1. Crie `apps/extension/src/platforms/<plataforma>.ts` implementando `PlatformAdapter`.
2. Implemente `matches()` checando o hostname relevante.
3. Implemente `extractContext()` reaproveitando utilitários de `@bp/shared` (`normalizeUrl`, tipos de `VideoContext`) — nunca duplique lógica de agregação/regras, que pertence a `detection-core`.
4. Registre o adaptador em `registry.ts`, antes de `genericAdapter`.
5. Adicione `<plataforma>.test.ts` com fixtures de HTML cobrindo os campos extraídos, incluindo casos de DOM ausente/inesperado (degradação graciosa).
6. Confirme que a plataforma usa HTTP/HTTPS. Qualquer necessidade de outro protocolo exige mudança explícita no manifest e revisão de `docs/privacy.md` §5.
