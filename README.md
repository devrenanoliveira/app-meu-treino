# Meu Treino

App web instalável (PWA) com o treino PPL semanal, guia de execução de cada exercício, registro de carga e repetições e histórico de evolução.

## Instalar no Android

1. Abra o link do app no Chrome.
2. Toque em **Instalar app** (botão no topo da página ou menu ⋮ do Chrome).
3. O app ganha ícone na tela inicial e funciona sem internet.

## Dados

Os registros ficam salvos no próprio aparelho (localStorage). Use **Histórico > Exportar backup** de vez em quando.

## Arquivos

- `index.html`, `style.css`, `app.js`: interface e lógica
- `data.js`: treino por dia e guia dos exercícios (edite aqui para mudar o plano)
- `sw.js` e `manifest.webmanifest`: instalação e uso offline
- `icons/`: ícones do app

Para publicar uma mudança no plano, altere `data.js` e, para forçar atualização do cache, troque o número da versão em `CACHE` no `sw.js`.
