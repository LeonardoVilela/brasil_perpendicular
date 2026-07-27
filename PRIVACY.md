# Política de privacidade — Brasil Perpendicular

Última atualização: 27 de julho de 2026.

## Finalidade

O Brasil Perpendicular analisa vídeos exibidos no navegador para apresentar sinais explicativos de possível geração ou manipulação por inteligência artificial.

## Dados processados no dispositivo

A extensão processa localmente:

- vídeos visíveis e até 16 frames JPEG reduzidos por passagem;
- texto e rótulos próximos ao vídeo;
- URL normalizada da página para identidade de cache;
- preferências e resultados de análise.

Esses dados são usados exclusivamente para o funcionamento da extensão. A extensão não lê cookies, senhas, tokens de autenticação ou mensagens privadas deliberadamente.

## Análise remota opcional

O envio visual ao servidor fica desligado por padrão. Ele ocorre somente quando o usuário:

1. habilita expressamente a análise visual automática nas configurações; ou
2. confirma uma análise manual no painel.

Cada chamada envia de 4 a 16 frames JPEG reduzidos, fingerprint, taxa de amostragem, duração e metadados técnicos do detector. Em contexto eleitoral, um resultado incerto pode gerar uma segunda chamada, limitada a mais 16 frames.

Não são enviados ao servidor: URL, domínio, título, legenda, hashtag, autor, plataforma, termo político, cookies, áudio ou vídeo integral.

## Retenção

- Frames: mantidos apenas em memória durante a análise e descartados em seguida.
- Cache local: assessments com prazo e limite de entradas; o usuário pode usar **Limpar cache**.
- Cache do servidor: fingerprint, versões dos detectores e resultado; nenhum pixel.
- Feedback: classificação, score, versões e opinião de falso positivo/negativo, sem frames.

## Compartilhamento e publicidade

Os dados não são vendidos, não são usados para publicidade e não são compartilhados para finalidades alheias à detecção. A API configurada é usada somente para executar a análise solicitada.

## Segurança

O pacote não executa código remoto. Modelo ONNX, WebAssembly e JavaScript ficam dentro da extensão. Toda transmissão de produção deve usar HTTPS.

## Controle e exclusão

O usuário pode:

- desligar análises automáticas;
- restringir o acesso da extensão por site;
- limpar o cache nas configurações;
- desinstalar a extensão para remover os dados locais.

## Contato

Questões de privacidade podem ser abertas em:
https://github.com/LeonardoVilela/brasil_perpendicular/issues
