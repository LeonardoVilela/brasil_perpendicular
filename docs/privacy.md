# Privacidade — Brasil Perpendicular

Data: 2026-07-15
Documentos relacionados: [threat-model.md](threat-model.md), [mvp-scope.md](product/mvp-scope.md)

Privacidade é requisito de produto, não polimento opcional. Qualquer mudança que adicione permissão, chamada de rede, campo de armazenamento ou telemetria **deve** atualizar este documento antes do merge.

## 1. Princípios

1. Análise local é o padrão; o servidor só recebe dados após ação explícita do usuário ou opt-in claro nas configurações.
2. Nenhuma mídia é enviada automaticamente. Upload de vídeo integral é proibido no MVP.
3. O usuário é informado, antes do envio, exatamente sobre quais dados serão transmitidos.
4. Coleta mínima: se um dado não é necessário para a funcionalidade, ele não é lido, armazenado nem transmitido.
5. Nenhum comportamento de rede oculto: toda requisição parte de uma ação rastreável no código e é documentada aqui.

## 2. O que a extensão NUNCA faz

- Não coleta cookies, tokens de sessão ou credenciais.
- Não procura cookies, credenciais ou áreas de mensagens. Como o content script roda em páginas HTTP/HTTPS, texto próximo a um vídeo em uma página autenticada ou privada pode ser processado localmente; esse texto não é persistido nem enviado automaticamente.
- Não persiste frames de vídeo por padrão.
- Não registra URLs privadas por padrão.
- Não envia dados a terceiros; a única origem remota possível é a API configurada pelo usuário.
- Não contém analytics/telemetria (adicionar exigiria documentação, opt-in e aprovação explícita).
- Não loga frames, texto integral de páginas nem payloads sensíveis, mesmo em modo desenvolvedor.

## 3. Dados tratados

### 3.1 Local (sempre)

| Dado | Onde | Retenção | Controle do usuário |
|---|---|---|---|
| Preferências (settings) | `chrome.storage.local` | Até desinstalar/limpar | Tela de opções |
| Contexto textual próximo a vídeos visíveis | Memória da aba, durante a análise local | Descartado após gerar o assessment; apenas um hash entra na identidade de cache | Desativar análise automática nas opções ou limitar o acesso a sites no navegador |
| Cache de assessments (identidade do vídeo normalizada + resultado + versões) | `chrome.storage.local` | TTL 7 dias, máx. 500 entradas, LRU | Botão "limpar cache" nas opções |
| Estado de overlay (fechado/minimizado) | Memória da aba | Sessão da aba | Fechar aba |

A identidade de vídeo no cache usa URL **normalizada** (sem parâmetros de tracking) e hash de contexto — nunca o texto integral da publicação.

### 3.2 Enviados à API (somente com ação explícita)

Ao clicar em "Analisar com mais profundidade", a extensão mostra um diálogo de consentimento listando o que será enviado:

- contexto textual extraído (título, descrição, hashtags — truncados aos limites documentados);
- URL da página normalizada (tracking removido);
- plataforma;
- futuramente (Fase 3, com novo consentimento): frames redimensionados.

O que **não** é enviado: cookies, headers de sessão, histórico, conteúdo de outras abas, vídeo integral.

### 3.3 Feedback

`POST /feedback` envia apenas: resumo do assessment (classificação, score, versões), avaliação do usuário (falso positivo/negativo) e comentário opcional. Sem frames e sem identificadores pessoais. Armazenado em JSONL local no servidor.

## 4. Normalização de URLs

Antes de armazenar ou transmitir qualquer URL, remover parâmetros de tracking — lista mantida em `packages/shared/src/url.ts` e coberta por testes:

`utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `igshid`, `igsh`, `si`, `feature`, `ref`, `ref_src`, `ref_url`, `mc_cid`, `mc_eid`, `yclid`, `twclid`, `ttclid`.

Fragmentos (`#...`) são descartados, exceto quando fazem parte de rota de SPA conhecida pelos adaptadores.

## 5. Permissões do Manifest V3 e justificativas

| Permissão | Justificativa | Escopo |
|---|---|---|
| `storage` | Settings e cache local | Local à extensão |
| `activeTab` | Reinjeção manual de fallback pelo popup | Aba ativa, uma vez |
| `scripting` | Executar a reinjeção manual solicitada pelo usuário | Depende de `activeTab` |
| `content_scripts.matches` | Detectar vídeos automaticamente, sem clique por página | `http://*/*` e `https://*/*`; não inclui `file://` nem outros protocolos |

O navegador informa esse acesso durante a instalação/atualização. O usuário pode limitar o acesso por site nas configurações do navegador ou desligar a análise automática nas opções da extensão. O acesso amplo não autoriza tráfego de rede: a análise local continua sem upload, e análise profunda/feedback continuam dependendo de ação explícita.

Regra: adicionar qualquer permissão exige justificar necessidade, minimizar escopo, documentar retenção e controle aqui, e atualizar o [threat-model.md](threat-model.md).

## 6. LGPD

- **Base legal**: legítimo interesse do usuário que instala a ferramenta para sua própria proteção; dados tratados localmente por padrão.
- **Minimização (art. 6º, III)**: apenas contexto textual necessário; sem identificadores pessoais coletados deliberadamente.
- **Transparência (art. 9º)**: este documento + diálogo de consentimento pré-envio + README.
- **Riscos documentados**: texto de publicações pode conter dados pessoais de terceiros; mitigação: truncamento, não persistência no servidor (análises não são armazenadas), logs sem payload.
- **Direitos do titular**: dados locais são apagáveis pelo usuário (limpar cache/desinstalar); feedback não contém identificadores que permitam vínculo a pessoa natural.
- Pendência registrada para fase de distribuição pública: política de privacidade própria e revisão jurídica antes de publicar na Chrome Web Store.

## 7. Logs

- Produção: sem logs de conteúdo. Erros logados com códigos e mensagens genéricas.
- Modo desenvolvedor: logs estruturados (`logger` compartilhado) podem incluir metadados de pipeline (tempos, contagens, classificações), **nunca** frames, texto integral ou URLs com parâmetros de tracking.
- API: logs de acesso sem corpo de requisição; erros de validação sem eco do payload.
