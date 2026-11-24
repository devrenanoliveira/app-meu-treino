# Meu Treino

App web instalável (PWA) com o treino PPL semanal, guia de execução de cada exercício, registro de carga e repetições e histórico de evolução.

## Instalar no Android

1. Abra o link do app no Chrome.
2. Toque em **Instalar app** (botão no topo da página ou menu ⋮ do Chrome).
3. O app ganha ícone na tela inicial e funciona sem internet.

## Telas

- **Treino**: um exercício por vez. Toque nos números do topo, em Anterior/Próximo ou deslize para o lado para trocar.
- **Registro por série**: carga e reps de cada série, com a última vez já preenchida, sugestão de carga (quando você bate o topo das reps), botão Copiar última vez e aquecimento calculado.
- **Trocar exercício**: substitui um exercício só por hoje (o plano não muda).
- **Histórico**: resumo da semana (treinos, séries, tempo, séries por grupo muscular, dias seguidos), gráfico de evolução e recordes por exercício.
- **Corpo**: peso e medidas com gráfico.
- **Ajustes**: descanso (automático por exercício ou fixo), tela ligada, notificações, timer flutuante, lembretes no calendário, regras da semana, backup e CSV.

## Cronômetros

- **Iniciar treino** liga o painel de timers fixo no topo (descanso grande e tempo total do treino), visível em todas as abas.
- **Série feita** (botão grande do painel) ou o número da série no cartão começa o descanso. O app avisa (vibração, som e notificação) ao completar o tempo escolhido (padrão 2:00).
- O timer também aparece na tela de bloqueio e nas notificações do Android, e o título da aba mostra o descanso.
- **Timer flutuante** (Ajustes, experimental): mini janela por cima de outros apps via Picture-in-Picture.
- **Pausar/Retomar** congela os dois contadores. Na notificação, **próxima** conclui a próxima série e **anterior** desfaz a última.
- **Finalizar** salva a duração e as séries no histórico.
- Se o Chrome estiver em "Site para computador", o app amplia a página sozinho para caber na tela.

## Dados

Os registros ficam salvos no próprio aparelho (localStorage). Use **Ajustes > Exportar backup** de vez em quando.

## Arquivos

- `index.html`, `style.css`, `app.js`: interface e lógica
- `data.js`: treino por dia e guia dos exercícios (edite aqui para mudar o plano)
- `sw.js` e `manifest.webmanifest`: instalação e uso offline
- `icons/`: ícones do app

Para publicar uma mudança no plano, altere `data.js` e, para forçar atualização do cache, troque o número da versão em `CACHE` no `sw.js`.
