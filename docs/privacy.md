# Privacidade — Brasil Perpendicular

Data: 2026-07-25
Documento relacionado: [threat-model.md](threat-model.md)

## Princípios

1. Análise local é o padrão.
2. O envio visual automático é um opt-in separado e desligado por padrão.
3. O clique manual mostra uma confirmação antes do envio.
4. O vídeo integral nunca é enviado.
5. Frames não são persistidos nem registrados em logs.

## Dados tratados localmente

| Dado | Retenção |
|---|---|
| Preferências | `chrome.storage.local`, até limpar/desinstalar |
| Contexto próximo ao vídeo | memória da aba durante a análise |
| Até 16 frames e miniaturas 9×8 | memória, descartados após a passagem |
| Assessment e identidade normalizada | cache local com TTL e limite |
| Modelo ONNX | asset empacotado na extensão |

A extensão não lê cookies, tokens ou credenciais. Contexto político é processado localmente e não entra no payload visual.

## Dados enviados na análise visual

Somente depois do opt-in automático ou da confirmação manual:

- 4 a 16 frames JPEG reduzidos por chamada;
- fingerprint SHA-256 derivado de dHashes;
- taxa e duração fixas;
- motivo técnico da escalada;
- opcionalmente nome, versão, decisão e score do detector local.

Não são enviados:

- URL ou domínio da página;
- título, descrição, legenda ou hashtag;
- nome do autor ou plataforma;
- termos políticos encontrados;
- cookies, headers de sessão, histórico ou conteúdo de outras abas;
- vídeo ou áudio integral.

Em contexto eleitoral, um primeiro resultado incerto pode acionar uma segunda chamada de até 16 frames. O máximo dessa passagem é 32 frames.

## Servidor e retenção

Os bytes JPEG existem somente durante validação e inferência. A API não grava payloads nem frames. O cache SQLite contém apenas:

- fingerprint;
- versão do detector;
- versão da calibração;
- resultado JSON.

Resultados indisponíveis não são armazenados. O feedback continua separado e não contém frames.

## Controles

- **Análise automática local:** pode ser desligada nas opções.
- **Análise visual automática no servidor:** desligada por padrão.
- **Analisar com mais profundidade:** ação pontual com confirmação.
- **Acesso ao site:** pode ser limitado no Chrome/Brave.
- **Limpar cache:** remove assessments locais.

No Brave, escolher acesso **Em todos os sites** é necessário para os rótulos automáticos. Isso autoriza a execução do content script, não autoriza sozinho o envio remoto.

## Permissões do Manifest V3

| Permissão | Uso |
|---|---|
| `storage` | configurações e cache |
| `activeTab` | reinjeção manual solicitada pelo usuário |
| `scripting` | executar a reinjeção na aba ativa |
| HTTP/HTTPS em `content_scripts` | detectar vídeos automaticamente |

O worker, WASM e modelo ONNX são recursos locais da própria extensão. Não há código remoto.

## Logs e LGPD

Logs não devem conter frames, texto integral ou URLs privadas. A coleta mínima, transparência e controles locais apoiam os princípios de necessidade e minimização da LGPD. Antes da Chrome Web Store ou de uma API pública, ainda são necessárias política de privacidade publicada, revisão jurídica, autenticação e política operacional de retenção.
