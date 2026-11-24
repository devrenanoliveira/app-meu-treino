/* ---------- Guia de exercícios ---------- */
var EX = {
  "supino-reto": {
    n: "Supino reto com barra", m: "Peitoral, tríceps, ombro frontal",
    s: ["Deite com os olhos alinhados sob a barra e os pés firmes no chão.",
        "Junte as escápulas e leve-as para baixo, peito alto.",
        "Desça a barra até a linha do mamilo, cotovelos a cerca de 45 a 60 graus do tronco.",
        "Empurre até quase estender os braços, sem travar."],
    e: "Pense em empurrar o banco para longe de você, em vez de empurrar a barra para cima.",
    x: "Abrir os cotovelos a 90 graus, tirar o bumbum do banco ou quicar a barra no peito."
  },
  "supino-inc-halt": {
    n: "Supino inclinado com halteres", m: "Parte superior do peitoral, ombro frontal",
    s: ["Ajuste o banco entre 30 e 40 graus.",
        "Comece com os halteres na altura do peito, palmas para a frente.",
        "Empurre para cima aproximando os halteres no topo.",
        "Desça em 2 a 3 segundos até sentir o peito alongar."],
    e: "Imagine abraçar uma árvore larga enquanto sobe os halteres.",
    x: "Banco muito inclinado (acima de 45 graus) transforma o exercício em desenvolvimento de ombro."
  },
  "crossover-polia": {
    n: "Crossover na polia (alta para baixa)", m: "Peitoral, parte inferior e meio",
    s: ["Polias na altura dos ombros ou acima, uma alça em cada mão.",
        "Dê um passo à frente, tronco levemente inclinado, cotovelos levemente flexionados.",
        "Traga as mãos para frente e para baixo, cruzando na frente do quadril, apertando o peito.",
        "Volte devagar até sentir o peito alongar, sem deixar os ombros irem para frente."],
    e: "Imagine abraçar uma bola grande de cima para baixo, mantendo o ângulo dos cotovelos o tempo todo.",
    x: "Usar o corpo para jogar a carga. Reduza o peso e controle a volta."
  },
  "voador": {
    n: "Voador (peck deck)", m: "Peitoral",
    s: ["Ajuste o assento para as alças ficarem na altura do meio do peito.",
        "Costas coladas no encosto, peito alto, cotovelos levemente flexionados.",
        "Feche os braços à frente até as mãos quase se encontrarem, apertando o peito.",
        "Volte devagar até sentir o peito alongar, sem deixar os braços irem muito para trás."],
    e: "Imagine abraçar uma árvore larga, mantendo o mesmo ângulo nos cotovelos do início ao fim.",
    x: "Esticar demais os cotovelos, jogar os ombros para a frente ou deixar o peso bater no final."
  },
  "des-halt": {
    n: "Desenvolvimento com halteres", m: "Ombros, tríceps",
    s: ["Sentado com as costas apoiadas e o abdômen firme.",
        "Halteres na altura das orelhas, cotovelos um pouco à frente do corpo.",
        "Empurre para cima sem bater os halteres.",
        "Desça até os cotovelos formarem cerca de 90 graus."],
    e: "É como guardar uma caixa em uma prateleira alta, empurrando reto para cima.",
    x: "Arquear demais a lombar para ajudar a subir."
  },
  "elev-lat": {
    n: "Elevação lateral", m: "Ombro lateral (deltoide médio)",
    s: ["Em pé, halteres leves ao lado do corpo, cotovelos levemente flexionados.",
        "Levante os braços para os lados até a altura dos ombros.",
        "O cotovelo guia o movimento e a mão fica no máximo na altura dele.",
        "Desça devagar, sem deixar os halteres bater na coxa."],
    e: "Gire o punho como se derramasse uma jarra de água: o dedo mínimo fica um pouco mais alto que o polegar.",
    x: "Balançar o tronco para subir e encolher o trapézio. Se isso acontece, a carga está alta."
  },
  "triceps-polia": {
    n: "Tríceps na polia", m: "Tríceps",
    s: ["Em pé na frente da polia alta, com barra reta ou corda.",
        "Cotovelos colados ao lado do tronco, parados.",
        "Estenda os braços para baixo até quase travar.",
        "Volte controlando até o antebraço passar de 90 graus."],
    e: "Os cotovelos são dobradiças fixas: só o antebraço se move.",
    x: "Abrir os cotovelos ou jogar o peso do corpo sobre a barra."
  },
  "supino-inc-barra": {
    n: "Supino inclinado na barra ou máquina", m: "Parte superior do peitoral",
    s: ["Banco a 30 graus. Na máquina, ajuste o assento para as pegadas ficarem na altura do meio do peito.",
        "Escápulas juntas e para baixo.",
        "Desça a barra até a parte alta do peito.",
        "Empurre sem travar os cotovelos."],
    e: "Mesma ideia do supino reto, só que a barra desce um pouco mais perto da clavícula.",
    x: "Descer a barra até a barriga ou levantar o bumbum do banco."
  },
  "supino-reto-halt": {
    n: "Supino reto com halteres", m: "Peitoral, tríceps",
    s: ["Sente com os halteres sobre as coxas e deite chutando-os para cima.",
        "Halteres na linha do peito, punhos retos.",
        "Desça até os cotovelos ficarem um pouco abaixo da linha do banco.",
        "Suba aproximando os halteres sem batê-los."],
    e: "Os halteres dão mais amplitude que a barra: aproveite para alongar bem o peito embaixo.",
    x: "Descer rápido demais e perder o controle no fundo."
  },
  "des-maq": {
    n: "Desenvolvimento na máquina", m: "Ombros, tríceps",
    s: ["Ajuste o assento para as alças ficarem na altura dos ombros.",
        "Costas coladas no encosto.",
        "Empurre para cima até quase estender os braços.",
        "Volte em 2 a 3 segundos."],
    e: "A máquina guia o trajeto, então foque em sentir o ombro trabalhando, não o braço.",
    x: "Travar os cotovelos com força no topo."
  },
  "elev-lat-polia": {
    n: "Elevação lateral na polia", m: "Ombro lateral",
    s: ["Polia baixa ao seu lado, pegue o cabo com a mão mais distante dela.",
        "O cabo cruza na frente do corpo, cotovelo levemente flexionado.",
        "Levante o braço para o lado até a altura do ombro.",
        "Desça devagar mantendo a tensão do cabo."],
    e: "O cabo mantém tensão o tempo todo, inclusive embaixo, onde o halter não faz força.",
    x: "Dar impulso com o corpo para levantar o cabo."
  },
  "triceps-testa": {
    n: "Tríceps testa ou francês", m: "Tríceps (cabeça longa)",
    s: ["Testa: deitado, barra W ou halteres com os braços perpendiculares ao chão.",
        "Dobre só os cotovelos, levando o peso em direção à testa ou um pouco atrás da cabeça.",
        "Estenda de volta sem mover os ombros.",
        "Francês: sentado, um halter atrás da cabeça com as duas mãos, cotovelos apontando para cima."],
    e: "Os braços ficam parados como dois postes. Só o antebraço dobra e estica.",
    x: "Deixar os cotovelos abrirem e usar carga que machuca o cotovelo. Se doer, reduza o peso."
  },
  "puxada": {
    n: "Puxada vertical (pegada aberta)", m: "Dorsal, bíceps",
    s: ["Sentado com as coxas presas sob o apoio, barra com pegada um pouco mais larga que os ombros.",
        "Peito para cima e leve inclinação do tronco para trás.",
        "Puxe os cotovelos para baixo e para trás até a barra chegar perto da clavícula.",
        "Suba controlando até alongar o dorsal."],
    e: "Imagine enfiar os cotovelos nos bolsos de trás da calça.",
    x: "Puxar a barra atrás da nuca, balançar o tronco ou puxar só com as mãos e os braços."
  },
  "puxada-neutra": {
    n: "Puxada com pegada neutra", m: "Dorsal (parte inferior), bíceps",
    s: ["Use o triângulo ou a barra com pegadas paralelas.",
        "Peito alto, ombros longe das orelhas.",
        "Puxe até o triângulo chegar ao peito, cotovelos rentes ao corpo.",
        "Volte lentamente até alongar."],
    e: "Os cotovelos descem rentes às costelas, como se você apertasse uma folha de papel debaixo de cada axila.",
    x: "Dar tranco com o corpo para subir a carga."
  },
  "remada-horiz": {
    n: "Remada horizontal (polia ou máquina)", m: "Meio das costas, dorsal, bíceps",
    s: ["Sentado com os pés apoiados e os joelhos levemente flexionados.",
        "Peito alto, coluna reta.",
        "Puxe o cabo até o abdômen levando os cotovelos para trás.",
        "Junte as escápulas por 1 segundo e volte alongando, sem jogar o tronco para a frente."],
    e: "É como dar a partida em um motor de popa: o movimento nasce nos cotovelos.",
    x: "Balançar o tronco para frente e para trás e encolher os ombros."
  },
  "remada-unilat": {
    n: "Remada unilateral com halter", m: "Dorsal, meio das costas",
    s: ["Apoie um joelho e a mão do mesmo lado em um banco, costas retas.",
        "Halter na outra mão, braço esticado.",
        "Puxe o halter em direção ao quadril, cotovelo rente ao corpo.",
        "Desça alongando bem a costa."],
    e: "Parece serrar madeira ou ligar um cortador de grama, só que o cotovelo vai para o quadril.",
    x: "Girar o tronco para ajudar a subir."
  },
  "remada-curvada": {
    n: "Remada curvada com barra", m: "Costas, bíceps, lombar (estabilização)",
    s: ["Em pé, joelhos levemente flexionados, tronco inclinado a cerca de 45 graus.",
        "Coluna neutra e abdômen firme.",
        "Puxe a barra até o umbigo.",
        "Desça controlando sem soltar o peso."],
    e: "Imagine puxar a barra com os cotovelos em direção ao teto.",
    x: "Arredondar a lombar ou usar impulso do quadril. Se isso acontece, reduza a carga."
  },
  "crucifixo-inverso": {
    n: "Crucifixo inverso", m: "Ombro posterior, parte alta das costas",
    s: ["Na máquina (peck deck invertido) ou com halteres, inclinado à frente.",
        "Braços quase estendidos, cotovelos levemente flexionados.",
        "Abra os braços para trás até a linha do tronco.",
        "Segure 1 segundo e volte devagar."],
    e: "Parece abrir uma cortina pesada, uma de cada lado.",
    x: "Usar carga demais e transformar o movimento em remada."
  },
  "rosca-direta": {
    n: "Rosca direta", m: "Bíceps",
    s: ["Em pé, barra na pegada na largura dos ombros, cotovelos colados ao tronco.",
        "Suba a barra até a contração do bíceps.",
        "Aperte no topo por um instante.",
        "Desça em 2 a 3 segundos."],
    e: "Os cotovelos ficam presos no lugar. Se eles vão para a frente, a carga está alta.",
    x: "Balançar o corpo para ajudar a subir."
  },
  "rosca-martelo": {
    n: "Rosca martelo", m: "Braquial, antebraço, bíceps",
    s: ["Em pé ou sentado, halteres com as palmas voltadas uma para a outra.",
        "Cotovelos fixos ao lado do tronco.",
        "Suba um halter de cada vez ou os dois juntos.",
        "Desça controlando."],
    e: "Segure o halter como se fosse um martelo e bata em um prego na altura do ombro.",
    x: "Girar o punho no meio do movimento."
  },
  "rosca-alternada": {
    n: "Rosca alternada ou Scott", m: "Bíceps",
    s: ["Alternada: em pé, halteres ao lado, gire a palma para cima enquanto sobe.",
        "Scott: braços apoiados no banco inclinado, desça até quase estender, sem travar.",
        "Suba até a contração máxima.",
        "Desça em 2 a 3 segundos."],
    e: "No Scott, o apoio impede o balanço, então a carga precisa ser menor que na rosca direta.",
    x: "Estender totalmente o cotovelo de forma brusca no Scott."
  },
  "agachamento": {
    n: "Agachamento", m: "Quadríceps, glúteos, posteriores",
    s: ["Barra apoiada na parte alta das costas, pés na largura dos ombros, pontas levemente para fora.",
        "Respire, firme o abdômen e desça sentando para trás e para baixo.",
        "Joelhos seguem a direção dos pés, coluna neutra, até as coxas ficarem paralelas ou abaixo.",
        "Suba empurrando o chão com o pé todo."],
    e: "Imagine sentar em uma cadeira que está atrás de você.",
    x: "Joelhos para dentro, calcanhar saindo do chão, lombar arredondando no fundo."
  },
  "stiff": {
    n: "Stiff", m: "Posteriores de coxa, glúteos, lombar",
    s: ["Em pé com a barra ou halteres na frente das coxas, joelhos levemente flexionados e fixos.",
        "Empurre o quadril para trás, deixando o peso deslizar pelas coxas.",
        "Desça até sentir o posterior alongar, em geral perto do meio da canela.",
        "Suba levando o quadril para a frente."],
    e: "É como fechar a porta de um carro com o bumbum.",
    x: "Arredondar a coluna ou dobrar os joelhos demais (vira agachamento)."
  },
  "extensora": {
    n: "Cadeira extensora", m: "Quadríceps",
    s: ["Ajuste o encosto para o joelho ficar alinhado com o eixo da máquina.",
        "Estenda as pernas até quase travar os joelhos.",
        "Segure 1 segundo contraindo a frente da coxa.",
        "Desça em 2 a 3 segundos."],
    e: "Imagine chutar uma bola devagar e segurar a perna esticada por um instante.",
    x: "Usar impulso para subir e travar os joelhos com força."
  },
  "mesa-flexora": {
    n: "Mesa flexora", m: "Posteriores de coxa",
    s: ["Deitado de bruços, o rolo apoiado logo acima dos calcanhares.",
        "Quadril colado no banco.",
        "Dobre os joelhos levando os calcanhares em direção ao glúteo.",
        "Desça devagar até quase estender."],
    e: "Mantenha o quadril no banco como se uma mão o empurrasse para baixo.",
    x: "Levantar o quadril para completar a repetição."
  },
  "adutora": {
    n: "Cadeira adutora", m: "Adutores (parte interna da coxa)",
    s: ["Sente com as costas apoiadas e ajuste a abertura inicial das pernas para um alongamento confortável.",
        "Pés nos apoios, quadril firme no assento.",
        "Feche as pernas até os apoios se aproximarem, apertando a parte interna da coxa.",
        "Segure 1 segundo e abra devagar, sem deixar os pesos baterem."],
    e: "Imagine apertar uma bola entre os joelhos e soltar devagar.",
    x: "Abrir as pernas rápido demais na volta ou usar carga que tira o quadril do assento."
  },
  "abdutora": {
    n: "Cadeira abdutora", m: "Glúteo médio e mínimo, lateral do quadril",
    s: ["Sente com as costas apoiadas, joelhos nos apoios e pés nos suportes.",
        "Incline levemente o tronco à frente para enfatizar o glúteo.",
        "Abra as pernas até o limite confortável.",
        "Segure 1 segundo e volte controlando."],
    e: "Pense em empurrar duas portas pesadas para os lados com os joelhos.",
    x: "Usar impulso ou balançar o tronco para abrir as pernas."
  },
  "panturrilha-pe": {
    n: "Panturrilha em pé", m: "Panturrilha (gastrocnêmio)",
    s: ["Apoie a ponta dos pés em um degrau ou na máquina, calcanhares livres.",
        "Desça os calcanhares alongando ao máximo.",
        "Suba o mais alto que conseguir.",
        "Segure 1 segundo no topo."],
    e: "Suba na ponta dos pés como para alcançar algo em uma prateleira alta.",
    x: "Fazer movimentos curtos e rápidos."
  },
  "panturrilha-sentado": {
    n: "Panturrilha sentado", m: "Panturrilha (sóleo)",
    s: ["Sentado na máquina com os joelhos a 90 graus e a ponta dos pés na plataforma.",
        "Desça os calcanhares até alongar.",
        "Suba o máximo possível.",
        "Segure 1 segundo no topo."],
    e: "Com o joelho dobrado, o sóleo trabalha mais. Por isso ele completa a panturrilha em pé.",
    x: "Quicar embaixo para ganhar impulso."
  },
  "abdominal": {
    n: "Abdominal", m: "Reto abdominal",
    s: ["Deitado com os joelhos dobrados e as mãos ao lado da cabeça.",
        "Expire e eleve os ombros enrolando a coluna.",
        "Aperte o abdômen no topo.",
        "Volte devagar sem apoiar a cabeça."],
    e: "Pense em aproximar as costelas do quadril, sem puxar o pescoço com as mãos.",
    x: "Puxar o pescoço com as mãos e subir o tronco inteiro."
  },
  "leg-press": {
    n: "Leg press ou hack", m: "Quadríceps, glúteos",
    s: ["Pés no meio da plataforma, na largura dos ombros.",
        "Desça até os joelhos formarem cerca de 90 graus, sem descolar o quadril do banco.",
        "Empurre a plataforma sem travar os joelhos no topo.",
        "No hack, mantenha as costas apoiadas no encosto."],
    e: "Os joelhos seguem a direção dos pés, como no agachamento, só que com apoio.",
    x: "Descer fundo demais e o quadril levantar do banco, ou travar os joelhos."
  },
  "afundo": {
    n: "Afundo ou passada", m: "Quadríceps, glúteos",
    s: ["Dê um passo à frente com tronco ereto.",
        "Desça até os dois joelhos formarem cerca de 90 graus.",
        "Empurre com o calcanhar da perna da frente para voltar.",
        "Alterne as pernas ou faça todas as repetições de um lado."],
    e: "É como se ajoelhar para amarrar o sapato e levantar em seguida.",
    x: "Inclinar o tronco para a frente e deixar o joelho da frente cair para dentro."
  }
};

/* ---------- Treinos por dia ---------- */
var DAYS = [
  { id: "seg", d: "Seg", t: "Push", l: "Pesado", c: "push", title: "Segunda · Push A", sub: "Dia pesado", items: [
    ["supino-reto", "3x6-8", { d: "23/11", w: "30 kg", r: "8", n: "drop na última" }],
    ["supino-inc-halt", "3x8-10", { d: "23/11", w: "25 kg por lado", r: "10", n: "drop na última" }],
    ["voador", "3x10-12", { d: "23/11", w: "9 placas", r: "", n: "drop na última" }],
    ["des-halt", "3x8-10", { d: "23/11", w: "10 placas", r: "10", n: "drop na última" }],
    ["elev-lat", "3x12-15", { d: "23/11", w: "14 kg", r: "10", n: "drop na última" }],
    ["triceps-polia", "3x10-12", { d: "23/11", w: "12 placas", r: "10", n: "drop na última" }] ] },
  { id: "ter", d: "Ter", t: "Pull", l: "A", c: "pull", title: "Terça · Pull A", sub: "Puxada como exercício principal", items: [
    ["puxada", "3x6-10"], ["remada-horiz", "3x8-10"], ["remada-unilat", "3x10-12"], ["crucifixo-inverso", "3x12-15"], ["rosca-direta", "3x8-10"], ["rosca-martelo", "3x10-12"] ] },
  { id: "qua", d: "Qua", t: "Legs", l: "Pesado", c: "legs", title: "Quarta · Legs A", sub: "Dia pesado", items: [
    ["agachamento", "3x6-8"], ["stiff", "3x8-10"], ["extensora", "3x10-12"], ["mesa-flexora", "3x10-12"], ["adutora", "3x12-15"], ["panturrilha-pe", "4x12-15"], ["abdominal", "3x12-15"] ] },
  { id: "qui", d: "Qui", t: "Push", l: "Leve", c: "push", title: "Quinta · Push B", sub: "Outros ângulos e mais repetições", items: [
    ["supino-inc-barra", "3x8-10"], ["supino-reto-halt", "3x10-12"], ["crossover-polia", "3x12-15"], ["des-maq", "3x10-12"], ["elev-lat-polia", "3x12-15"], ["triceps-testa", "3x10-12"] ] },
  { id: "sex", d: "Sex", t: "Pull", l: "B", c: "pull", title: "Sexta · Pull B", sub: "Remada horizontal como exercício principal", items: [
    ["remada-horiz", "3x6-8"], ["puxada-neutra", "3x10-12"], ["remada-curvada", "2x10-12"], ["crucifixo-inverso", "3x12-15"], ["rosca-alternada", "3x10-12"], ["rosca-martelo", "3x10-12"] ] },
  { id: "sab", d: "Sáb", t: "Legs", l: "Leve", c: "legs", title: "Sábado · Legs B", sub: "Mais repetições, menos carga", items: [
    ["leg-press", "3x10-12"], ["afundo", "3x10-12 por perna"], ["mesa-flexora", "3x10-12"], ["extensora", "2x12-15"], ["abdutora", "3x12-15"], ["panturrilha-sentado", "4x12-15"], ["abdominal", "3x12-15"] ] },
  { id: "dom", d: "Dom", t: "Off", l: "", c: "rest", title: "Domingo · Descanso", sub: "Recuperação", items: [] }
];
