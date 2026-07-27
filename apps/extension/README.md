# Extensão Chromium

Build:

```powershell
npm run build -w extension
```

O resultado fica em `apps/extension/dist/`.

## Carregar no Chrome ou Brave

1. Abra `chrome://extensions` ou `brave://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Escolha **Carregar sem compactação** e selecione `apps/extension/dist`.
4. No Brave, abra **Detalhes → Acesso ao site → Em todos os sites**. Essa opção é necessária para a extensão iniciar automaticamente em cada página, sem clicar no ícone.
5. Recarregue as abas que já estavam abertas.

Depois de alterar o código, rode o build novamente e use o botão **Recarregar** no card da extensão.

## Modos de análise

- D3 local: automático, executado em worker com WebGPU ou WASM; nenhum frame sai do navegador.
- STALL remoto automático: desligado por padrão; habilite nas opções se desejar a cascata completa.
- STALL remoto manual: abra os detalhes do selo, clique em **Analisar com mais profundidade** e confirme o envio.

A análise remota recebe somente frames JPEG reduzidos, fingerprint e metadados técnicos. Não recebe URL, texto da publicação, autor, termo político nem o vídeo integral.

Para testar com as demos locais:

```powershell
npm run demo
```

Abra `http://localhost:8080`. Para testar STALL, mantenha a API em `http://localhost:8000` ou ajuste a URL nas opções.
