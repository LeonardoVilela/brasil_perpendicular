# Publicação na Chrome Web Store

## Arquitetura distribuída

- D3, ONNX Runtime e WASM são empacotados no ZIP e executados no computador do usuário.
- STALL/DINOv3 roda em uma API HTTPS mantida pelo projeto.
- A extensão não baixa nem executa código remoto.

## Gerar o pacote

Depois que a API pública estiver disponível:

```powershell
npm run package:extension -- -ApiUrl "https://api.seudominio.com"
```

O script:

1. injeta a URL padrão da API no build;
2. limita `host_permissions` à origem dessa API;
3. valida modelo, WASM, worker, ícone e manifesto;
4. gera `release/brasil-perpendicular-0.3.0.zip`;
5. imprime o SHA-256.

Não publique um pacote gerado com `localhost`.

## Materiais

- ícone do pacote: `apps/extension/public/icons/icon-128.png`;
- promoção 440×280: `store-assets/promo-small.png`;
- textos da listagem e privacidade: `store-assets/listing-pt-BR.md`;
- política pública: `PRIVACY.md`;
- captura exigida, ainda pendente: `store-assets/screenshot-1.png`.

A captura precisa mostrar a extensão realmente executando no navegador. Abra
uma demo com a extensão carregada, dimensione a janela para 1280×800 e salve a
imagem nesse caminho. Não use uma composição ou mockup como captura da loja.

## Dashboard

1. Cadastre e configure a conta no Chrome Web Store Developer Dashboard.
2. Selecione **Add new item** e envie o ZIP.
3. Complete **Store listing**, **Privacy practices**, **Distribution** e **Test instructions**.
4. Use primeiro **Trusted testers** ou publicação adiada.
5. Só envie para revisão pública depois que a API HTTPS e a política de privacidade estiverem acessíveis.

## Política de privacidade

Após o push público, habilite GitHub Pages para a pasta `docs/` ou publique `PRIVACY.md` em uma URL HTTPS estável. O endereço precisa ser informado no dashboard e permanecer consistente com os controles exibidos na extensão.
