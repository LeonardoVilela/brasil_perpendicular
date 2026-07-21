# Escopo do MVP — Brasil Perpendicular

Extensão de navegador (Chromium, Manifest V3) que adiciona indicadores explicativos sobre vídeos em páginas web, comunicando **evidências** de que o conteúdo foi gerado ou manipulado por IA — nunca veredictos categóricos.

Data: 2026-07-15
Status: aprovado para planejamento da primeira entrega
Documentos relacionados: [architecture.md](../architecture.md), [detection-pipeline.md](../detection-pipeline.md), [privacy.md](../privacy.md), [threat-model.md](../threat-model.md)

## 1. Problema

Vídeos sintéticos circulam em redes sociais sem sinalização consistente. Usuários brasileiros são alvo frequente de golpes que combinam deepfakes com padrões conhecidos (falsa indenização, benefício governamental, celebridade vendendo investimento). Plataformas rotulam conteúdo de IA de forma incompleta e inconsistente.

O produto oferece uma camada de transparência: agrega divulgações da plataforma, contexto da página, regras locais e (futuramente) análise visual, e comunica o resultado com incerteza explícita.

**O produto não prova que um vídeo é real ou falso.** Ausência de evidência não é evidência de autenticidade.

## 2. Público e idioma

- Usuários brasileiros de Chrome/Chromium.
- Toda a interface em português brasileiro.
- Código, identificadores e documentação técnica em inglês ou português consistente (este repositório usa docs em pt-BR e código em inglês).

## 3. Requisitos funcionais da primeira entrega

### RF-1 Detecção de vídeos
- Detectar elementos `<video>` presentes no carregamento e inseridos dinamicamente (SPA, scroll infinito).
- Suportar múltiplos vídeos simultâneos, elementos reciclados e troca de `src`.
- Sem polling agressivo: `MutationObserver` + `IntersectionObserver`, debounce, fila limitada.

### RF-2 Overlay
- Selo no canto superior do vídeo (esquerdo por padrão), sem cobrir controles nativos.
- Estados visuais: Aguardando análise; Analisando; Declarado como IA; Provavelmente IA; Possivelmente IA; Sem evidências suficientes; Inconclusivo; Erro de análise.
- Sem overlays duplicados; overlay pode ser fechado, minimizado ou expandido.
- Acessível por teclado; não bloqueia a thread principal nem quebra o player.

### RF-3 Painel de detalhes
Ao expandir, mostrar:
- classificação final e nível de confiança;
- lista de evidências (com rótulos responsáveis);
- análises executadas e análises indisponíveis;
- aviso de que o resultado não constitui prova definitiva;
- botão "Analisar com mais profundidade" (com consentimento explícito antes de enviar dados);
- botões de feedback (falso positivo / falso negativo).

### RF-4 Análise local (Camada 1)
- Disparada apenas após o vídeo permanecer visível pelo tempo mínimo configurado (padrão: 2 s com ≥50% visível).
- Motor de regras local sobre texto da página: título, descrição, hashtags, aria-labels, legendas no DOM, nome do canal/perfil, URLs, marcas de ferramentas de IA (Sora, Veo, Runway, Kling, Midjourney, Pika, Luma, Synthesia, HeyGen e similares), rótulos nativos de plataforma quando visíveis no DOM.
- Funciona sem backend e sem enviar frames.

### RF-5 Classificação e evidências
- Função central de agregação conforme [detection-pipeline.md](../detection-pipeline.md).
- Domínios de evidência mantidos separados: mídia sintética, procedência, divulgação da plataforma, risco contextual de golpe, checagem externa, disponibilidade técnica.
- Risco de golpe exibido como contexto, nunca somado à probabilidade de conteúdo sintético.

### RF-6 Cache local
- Evitar reanálise do mesmo conteúdo usando identidade estável (URL normalizada, id da publicação, duração, título, plataforma, hash de contexto).
- Nunca usar URLs `blob:` como identificador permanente.
- TTL e limite de entradas; interface preparada para hash perceptual futuro.

### RF-7 Configurações
Tela de opções com:
- análise automática local (liga/desliga);
- análise profunda no servidor (liga/desliga — padrão desligada);
- tempo mínimo de visibilidade;
- máximo de análises simultâneas;
- plataformas habilitadas;
- mostrar/esconder selo;
- modo desenvolvedor;
- endereço da API.

### RF-8 Popup
- Estado da página atual, atalho para configurações, botão "Analisar vídeos desta página" (injeção sob demanda via `activeTab` para páginas genéricas).

### RF-9 API mínima (FastAPI)
- Endpoints: `GET /health`, `POST /api/v1/analyze/context`, `POST /api/v1/analyze/frames`, `POST /api/v1/analyze/deep`, `POST /api/v1/feedback`.
- Validação estrita de payloads e limites de tamanho.
- **Sem análise real na primeira entrega**: endpoints de análise respondem honestamente `unavailable` com explicação; nunca inventam resultados.
- Feedback armazenado localmente sem dados sensíveis.

### RF-10 Detector visual
- Interface `VisualDetector` desacoplada.
- `MockVisualDetector` disponível **apenas** em modo desenvolvedor, com saída visivelmente rotulada como mock.
- Stub `OnnxVisualDetector` preparado para modelo local futuro (ONNX Runtime Web, WebGPU/WASM).
- Em produção, análise visual aparece como "indisponível" — nunca como resultado fabricado.

### RF-11 Páginas de demonstração
Páginas HTML locais para: vídeo único; vários vídeos; feed infinito; vídeo substituído; texto com rótulo de IA; conteúdo sem evidências; erro de CORS; player customizado.

## 4. Requisitos não funcionais

- **Privacidade por padrão**: nenhum upload automático de mídia; nada de cookies ou tokens; contexto próximo a vídeos pode ser processado apenas em memória, inclusive em páginas autenticadas; parâmetros de tracking removidos de URLs; ver [privacy.md](../privacy.md).
- **Permissões explícitas** no Manifest V3 (`storage`, `activeTab`, `scripting`; content script automático restrito a páginas HTTP/HTTPS).
- **Desempenho**: observers com debounce, fila com limite de concorrência, limpeza de listeners, `WeakMap`/`WeakSet` para elementos processados.
- **Degradação graciosa**: CORS, canvas contaminado e DRM tratados como "não foi possível analisar".
- **TypeScript strict**; sem `any` não justificado; testes determinísticos.
- **Rótulos responsáveis**: nunca "100% real", "0% IA" ou acusação categórica.

## 5. Fora de escopo da primeira entrega

- Modelo visual real; a V2 já inclui adaptadores específicos de YouTube/TikTok/Instagram/X e fallback genérico.
- Extração real de frames e modelo ONNX real (Fase 3).
- Análise de áudio, temporal, C2PA, hash perceptual, busca em fact-checking (Fase 4 — apenas interfaces).
- Telemetria (exigiria documentação e aprovação explícitas).
- Upload de vídeo integral (proibido no MVP).
- Loja Chrome / distribuição.

## 6. Critérios de aceitação da primeira entrega

1. `npm install` + build produzem uma extensão carregável em `chrome://extensions` (modo desenvolvedor).
2. Nas páginas de demonstração, overlays aparecem sobre vídeos (inclusive inseridos dinamicamente), sem duplicação, e só analisam após a permanência mínima em viewport.
3. Declaração confiável da plataforma/autor produz `declared_ai`; texto genérico equivalente permanece incerto; página sem sinais produz "Sem evidências suficientes".
4. Painel de detalhes mostra evidências, análises indisponíveis e aviso de limitação.
5. Cache impede reanálise imediata do mesmo vídeo (verificável em modo desenvolvedor).
6. Configurações persistem e alteram o comportamento (ex.: esconder selo).
7. API sobe localmente, responde `/health`, valida payloads, rejeita payloads acima do limite e responde `unavailable` sem inventar análise.
8. Suítes de teste (Vitest e pytest), lint e typecheck passam nos comandos oficiais do repositório.
9. Nenhuma requisição de rede ocorre sem ação explícita do usuário (verificável no DevTools).
10. Documentação permite instalar, rodar, testar e carregar a extensão do zero.

## 7. Premissas registradas (decisões conservadoras)

- **P-1**: O repositório `brasil_perpendicular` é a raiz do monorepo; o nome do produto é "Brasil Perpendicular".
- **P-2**: Sem análise real no servidor na primeira entrega; endpoints honestos evitam duplicar o motor de regras em Python (evita drift; revisão na Fase 3).
- **P-3**: Por decisão de produto de 2026-07-21, o suporte genérico é automático em páginas HTTP/HTTPS para não exigir um clique por página. Protocolos adicionais permanecem fora; análise profunda e qualquer envio continuam explícitos.
- **P-4**: Vídeos dentro de Shadow DOM fechado de terceiros ficam fora do alcance do MVP (limitação documentada).
- **P-5**: npm workspaces (sem pnpm/turbo) para reduzir atrito em Windows/OneDrive.
- **P-6**: `.gitignore` atual (template Python) será estendido, não substituído.

## 8. Riscos principais

| Risco | Impacto | Mitigação |
|---|---|---|
| Plataformas mudam DOM e quebram extração de contexto | Evidências vazias | Seletores centralizados em adaptadores; degradação para "sem evidências suficientes" |
| Falsos positivos geram acusações indevidas | Dano reputacional | Rótulos probabilísticos, thresholds conservadores, feedback de usuário |
| Página maliciosa injeta texto para manipular classificação | Selo enganoso | Ver [threat-model.md](../threat-model.md); pesos limitados para evidências de texto livre |
| Overlay conflita com players customizados | UX quebrada | Shadow DOM, posicionamento não intrusivo, botão de fechar |
| Fila de análise excessiva em feeds longos | Consumo de CPU | Fila limitada, análise só em viewport, cache |

## 9. Referências de rótulos permitidos

`Declarado como IA` · `Provavelmente gerado por IA` · `Possivelmente gerado ou manipulado por IA` · `Sem evidências suficientes` · `Análise inconclusiva` · `Não foi possível analisar`
