# Chrome Web Store — textos da listagem

## Nome

Brasil Perpendicular

## Descrição curta

Sinaliza evidências de que vídeos podem ter sido gerados ou manipulados por inteligência artificial.

## Descrição detalhada

O Brasil Perpendicular adiciona indicadores explicativos diretamente sobre vídeos exibidos no navegador.

A extensão combina:

- rótulos informados pela plataforma ou pelo autor;
- contexto associado ao vídeo;
- análise visual local com modelo ONNX;
- análise aprofundada opcional no servidor;
- prioridade adicional para conteúdo relacionado às eleições brasileiras.

O painel informa evidências, análises executadas, limitações e versões dos detectores. Não existe selo de “vídeo autêntico”: ausência de evidência não comprova que um conteúdo é real.

A análise visual local acontece no computador do usuário. O envio de frames reduzidos ao servidor fica desligado por padrão e exige opt-in nas configurações ou confirmação manual. O vídeo integral, áudio, URL, texto, autor e termos políticos não são enviados.

## Finalidade única

Identificar e explicar sinais de possível geração ou manipulação por IA em vídeos exibidos no navegador.

## Justificativas de permissões

- `storage`: salvar configurações e cache de assessments no dispositivo.
- `activeTab`: permitir que o usuário solicite novamente a análise da aba atual pelo popup.
- `scripting`: reinjetar o content script somente quando o usuário solicita essa ação.
- Acesso a páginas HTTP/HTTPS: localizar vídeos e mostrar os indicadores automaticamente, sem exigir clique no ícone em cada página.
- Host da API: enviar frames reduzidos exclusivamente após opt-in ou confirmação manual.

## Código remoto

Selecionar **Não**. A extensão não baixa nem executa JavaScript, WebAssembly ou modelos remotos. O servidor realiza uma operação de análise e retorna somente dados JSON.

## Declarações de dados

Declarar o tratamento de:

- conteúdo de sites, pois frames e texto próximo ao vídeo são processados;
- atividade de navegação, pois a URL normalizada participa localmente da identidade do cache.

O processamento local também deve ser declarado. Informar que apenas frames reduzidos e metadados técnicos podem ser transmitidos, mediante consentimento, e que não há venda, publicidade personalizada ou uso humano dos frames.

## Instruções para revisão

1. Instale a extensão e conceda acesso aos sites.
2. Abra uma página HTTP/HTTPS contendo um elemento `<video>`.
3. Aguarde dois segundos com o vídeo visível.
4. Verifique o selo e abra os detalhes.
5. A análise local funciona sem conta.
6. Para testar a API, habilite **Análise visual automática no servidor**; o texto ao lado do controle descreve o envio antes do opt-in.
