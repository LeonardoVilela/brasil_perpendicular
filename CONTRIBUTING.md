# Contribuindo — Brasil Perpendicular

## Fluxo de branch

- `main` é a branch estável.
- Trabalho novo acontece em uma branch de feature (`feature/<nome-curto>`) a partir de `main`.
- Mantenha commits pequenos e coerentes; não misture limpeza não relacionada com trabalho de feature.
- Antes de abrir PR, rode a suíte de verificação completa (seção abaixo) e confirme que passa.

## Comandos oficiais

Raiz do repositório (workspaces TypeScript):

```bash
npm install
npm test              # Vitest — todos os pacotes
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit, na ordem de dependência dos pacotes
npm run build           # build da extensão (apps/extension/dist)
npm run demo            # serve scripts/demo em :8080
```

`apps/api` (ambiente virtual próprio, isolado do resto do repo):

```bash
cd apps/api
python -m venv .venv
.venv/Scripts/python.exe -m pip install -e ".[dev]"
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe -m ruff check .
.venv/Scripts/python.exe -m mypy app
```

Não existe script que rode as duas suítes (TS e Python) juntas — rode ambas antes de considerar uma mudança pronta.

## Estilo de código

O estilo de código está definido em [`docs/architecture.md` §5 (Convenções)](docs/architecture.md#5-convenções). Pontos centrais:

- TypeScript strict em todos os pacotes; `any` proibido sem justificativa em comentário.
- ESLint + Prettier na raiz; Ruff + mypy (`strict = true`) na API.
- Strings de UI centralizadas em `packages/ui/src/strings.ts`, em pt-BR.
- Seletores de DOM específicos de plataforma só existem em `apps/extension/src/platforms/*` — nunca em `detection-core` ou `ui`.
- Código pragmático: funções fazem algo de verdade (sem wrappers de uma linha que só repassam argumentos), sem cadeias de indireção desnecessárias, interfaces apenas onde existe substituição real (detectores visuais, adaptadores de plataforma), classes só para estado com ciclo de vida. Prefira explícito repetido a abstração prematura usada uma vez.

## Testes obrigatórios (TDD)

Para qualquer mudança de comportamento:

1. Escreva ou identifique um teste que falhe pelo motivo esperado.
2. Confirme que ele falha.
3. Implemente a menor mudança que o faça passar.
4. Confirme que o teste alvo passa.
5. Rode a suíte mais ampla relevante (`npm test` e/ou `pytest`) antes de finalizar.

Não é aceitável adicionar comportamento novo sem teste correspondente. A cobertura mínima inclui agregação de evidências, thresholds de classificação, normalização de URL, cache/identidade de vídeo, deduplicação de overlay, limpeza de observers, inserção dinâmica de vídeo, adaptadores, mensageria, validação de payload da API, defaults de privacidade, comportamento sem detector visual e isolamento do mock.

## Commits

- Mensagens curtas, estilo convencional: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
- Sem rodapés/trailers e sem qualquer referência a ferramentas de IA na mensagem ou no conteúdo commitado. Divulgação de autoria, quando houver, é decisão do mantenedor no README — não do commit.
- Um commit por mudança coerente; evite empacotar tarefas não relacionadas.

## Antes de abrir um PR

Rode a verificação final completa:

```bash
npm test && npm run lint && npm run typecheck && npm run build -w extension
cd apps/api && .venv/Scripts/python.exe -m pytest && .venv/Scripts/python.exe -m ruff check . && .venv/Scripts/python.exe -m mypy app
```

Se algo falhar, corrija antes de pedir revisão — não documente uma limitação conhecida como se fosse aceitável sem justificativa.
