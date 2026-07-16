# extension

Build: `npm run build -w extension` (gera `apps/extension/dist/`).

## Carregar/recarregar no Chrome

1. Rode o build acima.
2. Abra `chrome://extensions` e ative o "Modo de desenvolvedor".
3. Clique em "Carregar sem compactação" e selecione a pasta `apps/extension/dist`.
4. Confirme que o card da extensão não mostra erros.
5. Após mudanças: rode o build de novo e clique em recarregar no card da extensão.
