# Modelo de ameaças — Brasil Perpendicular

Data: 2026-07-25
Documentos relacionados: [privacy.md](privacy.md), [architecture.md](architecture.md)

## 1. Ativos a proteger

- **A1** Confiança do usuário no selo (integridade da classificação exibida).
- **A2** Dados locais do usuário (settings, cache de assessments, histórico de navegação implícito no cache).
- **A3** Conteúdo das páginas visitadas (não deve vazar).
- **A4** A API e seus dados de feedback.
- **A5** Reputação de terceiros (pessoas em vídeos não devem ser acusadas indevidamente).

## 2. Adversários e cenários

| ID | Adversário | Objetivo |
|---|---|---|
| ADV-1 | Autor de conteúdo enganoso | Evitar que seu vídeo sintético seja sinalizado |
| ADV-2 | Página/script malicioso | Manipular ou explorar a extensão; extrair dados |
| ADV-3 | Golpista imitando a extensão | Exibir selo falso de "verificado" para dar credibilidade a golpe |
| ADV-4 | Cliente abusivo da API | Flood, payloads maliciosos, exfiltração |
| ADV-5 | Cadeia de suprimentos (dependências) | Injetar código malicioso no build |

## 3. Ameaças e mitigações

### T1 — Injeção adversarial de contexto (ADV-1, ADV-2)
A Camada 1 lê texto do DOM controlado pelo autor da página. Um autor pode: (a) omitir sinais de IA; (b) injetar texto invisível com padrões que geram falsos positivos em conteúdo de concorrentes; (c) poluir o DOM para "afogar" regras.

**Mitigações**
- Evidências de texto livre têm origem `page_context`, peso limitado e nunca produzem `declared_ai` sozinhas. Só texto atribuído ao autor pelo adaptador recebe origem `author_statement`.
- A extração ignora texto oculto e não coleta indiscriminadamente todo o elemento pai do vídeo.
- Tetos de agregação impedem que muitas evidências fracas gerem classificação forte ([detection-pipeline.md](detection-pipeline.md) §5).
- Rótulos exibidos são probabilísticos e explicáveis: o painel mostra *qual* texto gerou a evidência, permitindo ao usuário julgar.
- Limites de tamanho na extração de contexto (campos truncados) reduzem poluição do DOM.
- Ausência de sinal ⇒ "Sem evidências suficientes", nunca "autêntico" — omissão não produz selo de confiança (A5, A1).

### T2 — Sanitização de conteúdo da página (ADV-2)
Texto extraído do DOM é dado não confiável.

**Mitigações**
- Nunca usar `innerHTML`/`dangerouslySetInnerHTML` com conteúdo da página; React renderiza texto como texto.
- Overlay em Shadow DOM; nenhum dado da página vira seletor, URL de requisição arbitrária ou código.
- Payloads para a API validados com zod antes do envio e Pydantic na recepção.

### T3 — Selo falsificado (ADV-3)
Uma página pode desenhar um selo idêntico ao nosso sobre um vídeo, sugerindo "verificação".

**Mitigações (parciais — risco residual documentado)**
- O selo nunca afirma autenticidade (não existe estado "verificado/real") — imitar nosso selo não dá o selo de "conteúdo confiável", pois ele não existe.
- Popup da extensão (UI fora do alcance da página) mostra o estado real da página atual; documentação orienta conferir pelo popup.
- Risco residual aceito no MVP; reavaliação na fase de distribuição.

### T4 — Vazamento de dados de navegação (ADV-2, bugs próprios)
Cache e mensagens carregam URLs e contexto.

**Mitigações**
- URLs normalizadas (tracking removido) antes de armazenar/transmitir; cache com TTL e teto; sem sync em nuvem.
- Nenhuma requisição visual sem confirmação manual ou opt-in automático separado ([privacy.md](privacy.md)); API configurável apenas pelo usuário.
- Content script não expõe funções no `window` da página; mensageria só via `chrome.runtime` com validação de origem (`sender.id`).
- Logs sem payload sensível mesmo em dev mode.

### T5 — Abuso da API (ADV-4)
**Mitigações**
- Limites estritos de payload (413) e validação (422); sem persistência de frames; feedback sanitizado.
- CORS restrito a origens de extensão; rate limiting simples por IP registrado como pendência para exposição pública (MVP roda localmente).
- Logs de acesso sem corpo de requisição.

### T6 — Cadeia de suprimentos (ADV-5)
**Mitigações**
- Dependências com lockfile; modelo ONNX com SHA-256; commits e hashes dos artefatos D3/STALL registrados.
- STALL e DINOv3 ficam fora do repositório e não são baixados durante a inferência.
- Sem scripts de pós-instalação customizados; builds determinísticos; revisão de novas dependências no code review.

### T7 — Degradação por plataformas (não adversarial, mas sistêmico)
Mudanças de DOM quebram adaptadores silenciosamente.

**Mitigações**
- Seletores centralizados por adaptador com testes de fixture; falha de extração degrada para "Sem evidências suficientes"/"Análise inconclusiva" com limitação registrada — nunca classificação inventada.

### T8 — Uso indevido do mock (nós mesmos)
Mock apresentado como análise real destruiria A1/A5.

**Mitigações**
- `MockVisualDetector` só instancia com dev mode ligado; saída marcada `isMock`, label "[MOCK]", nunca persistida no cache como avaliação genuína; teste automatizado garante isolamento.

### T9 — Escopo automático em páginas HTTP/HTTPS (ADV-2, bugs próprios)
O content script é carregado automaticamente em sites HTTP/HTTPS para que os rótulos apareçam sem um clique por página. Isso aumenta a superfície de execução e pode incluir páginas autenticadas com vídeos.

**Mitigações**
- O script roda em mundo isolado, não lê cookies, tokens ou credenciais e não expõe funções no `window` da página.
- A extração é limitada ao título, metadados e texto próximo ao elemento de vídeo; o contexto integral não é persistido.
- Nenhum frame é enviado automaticamente sem o opt-in visual separado. URL, texto, autor e termo político nunca entram no payload STALL.
- O usuário pode desligar a análise automática nas opções ou restringir o acesso por site nas configurações do navegador.
- O manifesto cobre apenas HTTP/HTTPS, não `<all_urls>`.

### T10 — Evasão do detector visual e vídeo político adversarial (ADV-1)
Um autor pode recomprimir, recortar, inserir ruído, misturar trechos reais e sintéticos ou escolher geradores fora da calibração.

**Mitigações**
- Cascata espacial-temporal, segunda janela em contexto eleitoral e thresholds STALL conservadores.
- D3 e STALL compartilham um único grupo de evidência; discordância não é contada duas vezes.
- Resultado incerto permanece incerto, nunca “real”.
- Versões e detalhes técnicos ficam visíveis para auditoria.
- Risco residual alto: validação adversarial e monitoramento de drift são obrigatórios antes do uso eleitoral público.

## 4. Fora de escopo do MVP (registrado)

- Ataques ao navegador em si; usuário com máquina comprometida.
- Autenticação/autorização da API (roda localmente; obrigatória antes de exposição pública).
- Anti-fingerprinting da extensão (páginas detectarem que a extensão está instalada).
- Adversário estatal ou ataques direcionados sofisticados.

## 5. Gatilhos de revisão deste documento

Revisar quando: nova permissão; novo endpoint ou campo de payload; content script em novas origens; telemetria; armazenamento novo; novo modelo ou threshold; exposição pública da API; publicação na Chrome Web Store.
