# Meu Treino

App web instalável (PWA) com o treino PPL semanal, guia de execução de cada exercício, registro de carga e repetições e histórico de evolução.

## Instalar no Android

1. Abra o link do app no Chrome.
2. Toque em **Instalar app** (botão no topo da página ou menu ⋮ do Chrome).
3. O app ganha ícone na tela inicial e funciona sem internet.

## Cronômetros

- **Iniciar treino** liga o contador do treino e uma barra fixa no rodapé.
- Toque no número de cada **série** ao terminá-la (ou em **Iniciar descanso** na barra): o descanso começa a contar e o app avisa (vibração, som e notificação) ao completar o tempo escolhido (padrão 2:00).
- O timer também aparece na tela de bloqueio e nas notificações do Android (ajustes do cronômetro).
- **Pausar/Retomar** congela os dois contadores (barra do rodapé ou botão play/pause da notificação).
- Na notificação, os botões de faixa funcionam como atalhos: **próxima** conclui a próxima série e **anterior** desfaz a última.
- **Finalizar** (barra do rodapé) salva a duração e as séries no histórico.

## Dados

Os registros ficam salvos no próprio aparelho (localStorage). Use **Histórico > Exportar backup** de vez em quando.

## Arquivos

- `index.html`, `style.css`, `app.js`: interface e lógica
- `data.js`: treino por dia e guia dos exercícios (edite aqui para mudar o plano)
- `sw.js` e `manifest.webmanifest`: instalação e uso offline
- `icons/`: ícones do app

Para publicar uma mudança no plano, altere `data.js` e, para forçar atualização do cache, troque o número da versão em `CACHE` no `sw.js`.
