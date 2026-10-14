import { calc, fail, list, num, type Formula } from '../types'
import { fmt } from '../format'

const L = String.raw
/** Unidad en LaTeX */
const u = (s: string) => L`\,\mathrm{${s}}`
const ohms = L`\,\Omega`

function positiveList(xs: number[], name: string) {
  if (xs.length === 0) fail(`Escribe al menos un valor de $${name}$.`)
  if (xs.some((x) => !(x > 0))) fail(`Todas las $${name}$ deben ser mayores que 0.`)
}

// ═══ Divisor de voltaje ══════════════════════════════════════════════════════

const divisor: Formula = {
  id: 'divisor-de-voltaje',
  name: 'Divisor de voltaje',
  category: 'electricidad',
  latex: L`V_{out}=V_{in}\,\frac{R_2}{R_1+R_2}`,
  forms: [{ label: 'Con n resistencias en serie', latex: L`V_k=V\,\frac{R_k}{R_1+R_2+\cdots+R_n}` }],
  summary: 'Cómo se reparte el voltaje entre resistencias conectadas en serie.',
  goal: 'Obtener un voltaje menor a partir de uno mayor, o saber cuánto voltaje “le toca” a cada resistencia de una cadena en serie.',
  variables: [
    { symbol: 'V_{in}', meaning: 'Voltaje aplicado a toda la cadena', unit: 'V' },
    { symbol: 'V_{out}', meaning: 'Voltaje en $R_2$ (entre el punto medio y tierra)', unit: 'V' },
    { symbol: 'R_1', meaning: 'Resistencia de arriba (entre $V_{in}$ y el punto medio)', unit: 'Ω' },
    { symbol: 'R_2', meaning: 'Resistencia de abajo (entre el punto medio y tierra)', unit: 'Ω' },
  ],
  whenToUse: [
    'Dos o más resistencias **en serie**: por todas pasa la misma corriente.',
    'Sensores resistivos (fotorresistencias, termistores, potenciómetros) que convierten un cambio de resistencia en un cambio de voltaje.',
  ],
  intuition: [
    'Por las dos resistencias pasa la **misma corriente**, así que cada una se queda con una parte del voltaje proporcional a su resistencia ($V = IR$).',
    'Si $R_2$ es el doble de $R_1$, se queda con el doble de voltaje: dos tercios del total.',
  ],
  derivation: {
    steps: [
      { label: 'La corriente es la misma en toda la serie', latex: L`I=\frac{V_{in}}{R_1+R_2}` },
      { label: 'Ley de Ohm en R₂', latex: L`V_{out}=IR_2=V_{in}\,\frac{R_2}{R_1+R_2}` },
    ],
  },
  calculators: [
    calc<{ I: number; Vout: number; V1: number }>({
      id: 'vout',
      label: 'Calcular V_out',
      example: '12 V repartidos entre 1 kΩ (arriba) y 2 kΩ (abajo).',
      inputs: [
        { kind: 'number', id: 'Vin', label: 'Voltaje de entrada', symbol: 'V_{in}', default: 12, unit: 'V' },
        { kind: 'number', id: 'R1', label: 'Resistencia de arriba', symbol: 'R_1', default: 1000, unit: 'Ω' },
        { kind: 'number', id: 'R2', label: 'Resistencia de abajo', symbol: 'R_2', default: 2000, unit: 'Ω' },
      ],
      compute: (v) => {
        const [Vin, R1, R2] = [num(v, 'Vin'), num(v, 'R1'), num(v, 'R2')]
        positiveList([R1, R2], 'R')
        const I = Vin / (R1 + R2)
        return { I, Vout: I * R2, V1: I * R1 }
      },
      steps: (v, r) => [
        { label: 'Corriente de la serie', latex: L`I=\frac{${fmt(num(v, 'Vin'))}}{${fmt(num(v, 'R1'))}+${fmt(num(v, 'R2'))}}=${fmt(r.I)}${u('A')}` },
        { label: 'Fórmula del divisor', latex: L`V_{out}=${fmt(num(v, 'Vin'))}\cdot\frac{${fmt(num(v, 'R2'))}}{${fmt(num(v, 'R1'))}+${fmt(num(v, 'R2'))}}=${fmt(r.Vout)}${u('V')}` },
      ],
      answer: (_v, r) => L`V_{out}=${fmt(r.Vout)}${u('V')}`,
      extras: (_v, r) => [
        { label: 'Voltaje en R₁', latex: L`V_1=${fmt(r.V1)}${u('V')}` },
        { label: 'Corriente', latex: L`I=${fmt(r.I * 1000)}${u('mA')}` },
      ],
      interpret: (v, r) => [
        { tone: 'good', text: `$R_2$ se queda con $${fmt(r.Vout)}\\ \\mathrm{V}$ y $R_1$ con $${fmt(r.V1)}\\ \\mathrm{V}$: juntas suman los $${fmt(num(v, 'Vin'))}\\ \\mathrm{V}$ de la entrada.` },
        { tone: 'info', text: 'Si conectas una carga en la salida, queda en paralelo con $R_2$ y el voltaje baja. El divisor sólo es exacto si la carga toma muy poca corriente (resistencia mucho mayor que $R_2$).' },
      ],
    }),
    calc<{ R2: number }>({
      id: 'R2',
      label: 'Diseñar: despejar R₂',
      example: 'bajar 9 V a 3.3 V con R₁ = 10 kΩ.',
      inputs: [
        { kind: 'number', id: 'Vin', label: 'Voltaje de entrada', symbol: 'V_{in}', default: 9, unit: 'V' },
        { kind: 'number', id: 'Vout', label: 'Voltaje deseado', symbol: 'V_{out}', default: 3.3, unit: 'V' },
        { kind: 'number', id: 'R1', label: 'Resistencia de arriba', symbol: 'R_1', default: 10000, unit: 'Ω' },
      ],
      compute: (v) => {
        const [Vin, Vout, R1] = [num(v, 'Vin'), num(v, 'Vout'), num(v, 'R1')]
        positiveList([R1], 'R_1')
        if (!(Vout > 0 && Vout < Vin)) fail('$V_{out}$ debe estar entre 0 y $V_{in}$: un divisor sólo puede bajar el voltaje.')
        return { R2: (R1 * Vout) / (Vin - Vout) }
      },
      steps: (v, r) => [
        { label: 'Despejamos R₂', latex: L`R_2=R_1\,\frac{V_{out}}{V_{in}-V_{out}}` },
        { label: 'Sustituimos', latex: L`R_2=${fmt(num(v, 'R1'))}\cdot\frac{${fmt(num(v, 'Vout'))}}{${fmt(num(v, 'Vin'))}-${fmt(num(v, 'Vout'))}}=${fmt(r.R2)}${ohms}` },
      ],
      answer: (_v, r) => L`R_2=${fmt(r.R2)}${ohms}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `Con $R_2 \\approx ${fmt(r.R2, 0)}\\ \\Omega$ obtienes el voltaje deseado. En la práctica eliges el valor comercial más cercano.` },
      ],
    }),
  ],
  commonMistakes: [
    'Intercambiar $R_1$ y $R_2$: en el numerador va la resistencia **sobre la que mides** el voltaje.',
    'Usarlo como fuente de alimentación de algo que consume mucha corriente.',
  ],
  related: ['resistencias-en-serie', 'ley-de-ohm', 'leyes-de-kirchhoff'],
  toolLink: { path: '/circuit-lab?ejemplo=divisor', label: 'Circuit Lab' },
  keywords: ['divisor', 'voltaje', 'serie', 'potenciometro', 'resistencias'],
}

// ═══ Serie y paralelo ════════════════════════════════════════════════════════

const serie: Formula = {
  id: 'resistencias-en-serie',
  name: 'Resistencias en serie',
  category: 'electricidad',
  latex: L`R_{eq}=R_1+R_2+\cdots+R_n`,
  summary: 'La resistencia total de varias resistencias conectadas una tras otra.',
  goal: 'Reemplazar una cadena de resistencias por una sola equivalente para calcular la corriente del circuito.',
  variables: [
    { symbol: 'R_{eq}', meaning: 'Resistencia equivalente', unit: 'Ω' },
    { symbol: 'R_k', meaning: 'Cada resistencia de la cadena', unit: 'Ω' },
  ],
  whenToUse: [
    'Las resistencias están conectadas **una tras otra, sin ramificaciones**: la corriente no tiene otro camino.',
  ],
  intuition: [
    'La corriente tiene que atravesar todas, así que los “obstáculos” se suman.',
    'La misma corriente pasa por todas; el voltaje se reparte (ver divisor de voltaje).',
  ],
  calculators: [
    calc<{ Req: number; I: number }>({
      id: 'Req',
      label: 'Resistencia equivalente',
      example: 'tres resistencias de 220 Ω, 470 Ω y 1 kΩ en serie con una batería de 9 V.',
      inputs: [
        { kind: 'list', id: 'R', label: 'Resistencias (Ω)', symbol: 'R_k', default: [220, 470, 1000] },
        { kind: 'number', id: 'V', label: 'Voltaje aplicado', symbol: 'V', default: 9, unit: 'V' },
      ],
      compute: (v) => {
        const Rs = list(v, 'R')
        positiveList(Rs, 'R')
        const Req = Rs.reduce((a, b) => a + b, 0)
        return { Req, I: num(v, 'V') / Req }
      },
      steps: (v, r) => [
        { label: 'Sumamos', latex: L`R_{eq}=${list(v, 'R').map((x) => fmt(x)).join('+')}=${fmt(r.Req)}${ohms}` },
        { label: 'Corriente (igual en todas)', latex: L`I=\frac{V}{R_{eq}}=\frac{${fmt(num(v, 'V'))}}{${fmt(r.Req)}}=${fmt(r.I)}${u('A')}` },
        ...list(v, 'R').map((R, k) => ({ label: `Voltaje en R${k + 1}`, latex: L`V_{${k + 1}}=IR_{${k + 1}}=${fmt(r.I * R)}${u('V')}` })),
      ],
      answer: (_v, r) => L`R_{eq}=${fmt(r.Req)}${ohms}`,
      interpret: (v, r) => [
        { tone: 'good', text: `La cadena se comporta como una sola resistencia de $${fmt(r.Req)}\\ \\Omega$; por todas pasan $${fmt(r.I * 1000)}\\ \\mathrm{mA}$.` },
        { tone: 'info', text: `Los voltajes de cada resistencia suman los $${fmt(num(v, 'V'))}\\ \\mathrm{V}$ aplicados (ley de voltajes de Kirchhoff).` },
      ],
    }),
  ],
  commonMistakes: ['Confundir serie con paralelo: si entre dos resistencias sale otro cable, ya no están en serie.'],
  related: ['resistencias-en-paralelo', 'divisor-de-voltaje', 'ley-de-ohm'],
  toolLink: { path: '/circuit-lab?ejemplo=divisor', label: 'Circuit Lab' },
  keywords: ['serie', 'resistencia equivalente', 'resistencias', 'circuito'],
}

const paralelo: Formula = {
  id: 'resistencias-en-paralelo',
  name: 'Resistencias en paralelo',
  category: 'electricidad',
  latex: L`\frac{1}{R_{eq}}=\frac{1}{R_1}+\frac{1}{R_2}+\cdots+\frac{1}{R_n}`,
  forms: [{ label: 'Dos resistencias', latex: L`R_{eq}=\frac{R_1R_2}{R_1+R_2}` }],
  summary: 'La resistencia total de varias resistencias conectadas entre los mismos dos puntos.',
  goal: 'Saber cuánta corriente toma en total un grupo de resistencias en paralelo y cómo se reparte entre ellas.',
  variables: [
    { symbol: 'R_{eq}', meaning: 'Resistencia equivalente', unit: 'Ω' },
    { symbol: 'R_k', meaning: 'Cada resistencia (rama)', unit: 'Ω' },
  ],
  whenToUse: [
    'Las resistencias comparten **los mismos dos nodos**: todas tienen el mismo voltaje.',
    'Aparatos de una casa: todos están en paralelo con la red eléctrica.',
  ],
  intuition: [
    'Cada rama es un camino más para la corriente, así que el conjunto deja pasar **más** corriente: $R_{eq}$ siempre es menor que la menor de las resistencias.',
    'La corriente prefiere el camino fácil: la rama de menor resistencia lleva más corriente ($I_k = V/R_k$).',
  ],
  derivation: {
    steps: [
      { label: 'Mismo voltaje en cada rama', latex: L`I_k=\frac{V}{R_k}` },
      { label: 'La corriente total es la suma (Kirchhoff)', latex: L`I=I_1+\cdots+I_n=V\left(\frac{1}{R_1}+\cdots+\frac{1}{R_n}\right)` },
      { label: 'Definimos R_eq = V/I', latex: L`\frac{1}{R_{eq}}=\frac{1}{R_1}+\cdots+\frac{1}{R_n}` },
    ],
  },
  calculators: [
    calc<{ Req: number; I: number; Is: number[] }>({
      id: 'Req',
      label: 'Resistencia equivalente',
      example: '3 kΩ y 6 kΩ en paralelo con una batería de 6 V.',
      inputs: [
        { kind: 'list', id: 'R', label: 'Resistencias (Ω)', symbol: 'R_k', default: [3000, 6000] },
        { kind: 'number', id: 'V', label: 'Voltaje aplicado', symbol: 'V', default: 6, unit: 'V' },
      ],
      compute: (v) => {
        const Rs = list(v, 'R')
        positiveList(Rs, 'R')
        const Req = 1 / Rs.reduce((a, R) => a + 1 / R, 0)
        return { Req, I: num(v, 'V') / Req, Is: Rs.map((R) => num(v, 'V') / R) }
      },
      steps: (v, r) => [
        { label: 'Sumamos los inversos', latex: L`\frac{1}{R_{eq}}=${list(v, 'R').map((x) => L`\frac{1}{${fmt(x)}}`).join('+')}=${fmt(1 / r.Req, 6)}` },
        { label: 'Invertimos', latex: L`R_{eq}=${fmt(r.Req)}${ohms}` },
        ...r.Is.map((I, k) => ({ label: `Corriente en la rama ${k + 1}`, latex: L`I_{${k + 1}}=\frac{V}{R_{${k + 1}}}=${fmt(I * 1000)}${u('mA')}` })),
      ],
      answer: (_v, r) => L`R_{eq}=${fmt(r.Req)}${ohms}`,
      extras: (_v, r) => [{ label: 'Corriente total', latex: L`I=${fmt(r.I * 1000)}${u('mA')}` }],
      interpret: (_v, r) => [
        { tone: 'good', text: `El grupo equivale a $${fmt(r.Req)}\\ \\Omega$, menos que cualquiera de sus ramas. En total toma $${fmt(r.I * 1000)}\\ \\mathrm{mA}$.` },
        { tone: 'info', text: 'Las corrientes de las ramas suman la corriente total: eso es la ley de corrientes de Kirchhoff en el nodo donde se separan.' },
      ],
    }),
  ],
  commonMistakes: [
    'Olvidar invertir al final: la suma de los inversos es $1/R_{eq}$, no $R_{eq}$.',
    'Usar $R_1R_2/(R_1+R_2)$ con más de dos resistencias.',
  ],
  related: ['resistencias-en-serie', 'leyes-de-kirchhoff', 'ley-de-ohm'],
  toolLink: { path: '/circuit-lab?ejemplo=paralelo', label: 'Circuit Lab' },
  keywords: ['paralelo', 'resistencia equivalente', 'ramas', 'resistencias', 'circuito'],
}

// ═══ Kirchhoff ═══════════════════════════════════════════════════════════════

const kirchhoff: Formula = {
  id: 'leyes-de-kirchhoff',
  name: 'Leyes de Kirchhoff',
  category: 'electricidad',
  latex: L`\sum I_{\text{entran}}=\sum I_{\text{salen}}\qquad \sum_{\text{lazo}} V=0`,
  forms: [
    { label: 'Ley de corrientes (nodos)', latex: L`\sum_k I_k=0` },
    { label: 'Ley de voltajes (lazos)', latex: L`\sum_k V_k=0` },
  ],
  summary: 'La carga no se acumula en los nodos y la energía no se crea al dar una vuelta a un circuito.',
  goal: 'Plantear las ecuaciones de cualquier circuito, aunque no se pueda reducir a serie y paralelo.',
  variables: [
    { symbol: 'I_k', meaning: 'Corrientes que llegan a un nodo (positivas si entran, negativas si salen)', unit: 'A' },
    { symbol: 'V_k', meaning: 'Subidas (+) y caídas (−) de voltaje al recorrer un lazo', unit: 'V' },
  ],
  whenToUse: [
    '**Corrientes:** en cualquier nodo (punto donde se unen tres o más cables).',
    '**Voltajes:** en cualquier camino cerrado del circuito.',
    'Es lo que hace un simulador por dentro: una ecuación de corrientes por cada nodo.',
  ],
  intuition: [
    'Corrientes: lo que entra a un nodo tiene que salir, como el agua en una unión de tuberías.',
    'Voltajes: si subes y bajas por un circuito y regresas al punto de partida, terminas a la misma “altura” de voltaje.',
  ],
  calculators: [
    calc<{ missing: number; sum: number }>({
      id: 'kcl',
      label: 'Corriente que falta en un nodo',
      example: 'a un nodo entran 3 mA y salen 2 mA por una rama; ¿qué pasa en la otra?',
      inputs: [
        { kind: 'list', id: 'I', label: 'Corrientes conocidas en mA (+ entran, − salen)', symbol: 'I_k', default: [3, -2] },
      ],
      compute: (v) => {
        const sum = list(v, 'I').reduce((a, b) => a + b, 0)
        return { sum, missing: -sum }
      },
      steps: (v, r) => [
        { label: 'Sumamos las conocidas', latex: L`${list(v, 'I').map((x) => fmt(x)).join('+').replace(/\+-/g, '-')}=${fmt(r.sum)}${u('mA')}` },
        { label: 'La suma total debe ser 0', latex: L`I_x=-(${fmt(r.sum)})=${fmt(r.missing)}${u('mA')}` },
      ],
      answer: (_v, r) => L`I_x=${fmt(r.missing)}${u('mA')}`,
      interpret: (_v, r) => [
        Math.abs(r.missing) < 1e-12
          ? { tone: 'good', text: 'Las corrientes conocidas ya se equilibran: por la rama que falta no pasa corriente.' }
          : { tone: 'good', text: `Por la rama que falta ${r.missing > 0 ? 'entran' : 'salen'} $${fmt(Math.abs(r.missing))}\\ \\mathrm{mA}$.` },
      ],
    }),
    calc<{ missing: number; sum: number }>({
      id: 'kvl',
      label: 'Voltaje que falta en un lazo',
      example: 'una batería de 12 V con dos resistencias; una tiene 4 V. ¿Cuánto cae en la otra?',
      inputs: [
        { kind: 'list', id: 'V', label: 'Voltajes conocidos (+ subidas, − caídas)', symbol: 'V_k', default: [12, -4] },
      ],
      compute: (v) => {
        const sum = list(v, 'V').reduce((a, b) => a + b, 0)
        return { sum, missing: -sum }
      },
      steps: (v, r) => [
        { label: 'Sumamos las conocidas', latex: L`${list(v, 'V').map((x) => fmt(x)).join('+').replace(/\+-/g, '-')}=${fmt(r.sum)}${u('V')}` },
        { label: 'Al dar la vuelta la suma es 0', latex: L`V_x=-(${fmt(r.sum)})=${fmt(r.missing)}${u('V')}` },
      ],
      answer: (_v, r) => L`V_x=${fmt(r.missing)}${u('V')}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `En el elemento que falta hay una ${r.missing < 0 ? 'caída' : 'subida'} de $${fmt(Math.abs(r.missing))}\\ \\mathrm{V}$.` },
      ],
    }),
  ],
  commonMistakes: [
    'Mezclar convenciones de signo a la mitad: decide una (p. ej. entran = +) y úsala en todo el nodo.',
    'Aplicar la ley de corrientes en un punto de un cable sin ramificación: ahí es trivial (entra lo mismo que sale).',
  ],
  related: ['resistencias-en-paralelo', 'divisor-de-voltaje', 'ley-de-ohm'],
  toolLink: { path: '/circuit-lab?ejemplo=paralelo', label: 'Circuit Lab' },
  keywords: ['kirchhoff', 'nodos', 'mallas', 'lazos', 'corriente', 'voltaje', 'kcl', 'kvl'],
}


// ═══ Circuitos RC y RL ═══════════════════════════════════════════════════════

/** Curva de 0 a 5τ para el visual. */
function expCurve(f: (t: number) => number, tau: number): [number, number][] {
  return Array.from({ length: 81 }, (_, k) => {
    const t = (k / 80) * 5 * tau
    return [t, f(t)]
  })
}

const rcCircuit: Formula = {
  id: 'circuito-rc',
  name: 'Circuito RC: carga y descarga',
  category: 'electricidad',
  latex: L`V_C(t)=V\left(1-e^{-t/RC}\right)`,
  forms: [
    { label: 'Descarga', latex: L`V_C(t)=V_0\,e^{-t/RC}` },
    { label: 'Constante de tiempo', latex: L`\tau=RC` },
    { label: 'Corriente al cargar', latex: L`i(t)=\frac{V}{R}\,e^{-t/RC}` },
  ],
  summary: 'Cómo sube (o baja) el voltaje de un capacitor que se carga a través de una resistencia.',
  goal: 'Saber cuánto tarda un capacitor en cargarse o descargarse: temporizadores, filtros, el “fade” de un LED, el flash de una cámara.',
  variables: [
    { symbol: 'V_C', meaning: 'Voltaje del capacitor en el instante $t$', unit: 'V' },
    { symbol: 'V', meaning: 'Voltaje de la fuente (hacia donde se carga)', unit: 'V' },
    { symbol: 'R', meaning: 'Resistencia por la que pasa la carga', unit: 'Ω' },
    { symbol: 'C', meaning: 'Capacitancia', unit: 'F' },
    { symbol: '\\tau', meaning: 'Constante de tiempo $RC$', unit: 's' },
  ],
  whenToUse: [
    'Un capacitor que se carga o descarga a través de una resistencia, con una fuente de voltaje constante.',
    'Si hay más resistencias, usa como $R$ la resistencia de Thévenin que “ve” el capacitor.',
  ],
  intuition: [
    'Al principio el capacitor está vacío y se comporta como un cable: pasa mucha corriente ($V/R$) y se carga rápido.',
    'Conforme se llena, su voltaje “empuja de regreso”: queda menos voltaje en la resistencia, pasa menos corriente y se carga cada vez más lento.',
    'En cada constante de tiempo $\\tau$ recorre el **63 %** de lo que le falta. Tras $5\\tau$ está al 99 %: en la práctica, cargado.',
  ],
  derivation: {
    steps: [
      { label: 'Ley de voltajes en el lazo', latex: L`V=iR+V_C` },
      { label: 'Corriente del capacitor', latex: L`i=C\frac{dV_C}{dt}\;\Rightarrow\;RC\frac{dV_C}{dt}=V-V_C` },
      { label: 'Separamos e integramos (V_C(0) = 0)', latex: L`\int_0^{V_C}\frac{dV_C}{V-V_C}=\int_0^t\frac{dt}{RC}\;\Rightarrow\;-\ln\frac{V-V_C}{V}=\frac{t}{RC}` },
      { label: 'Despejamos', latex: L`V_C=V\left(1-e^{-t/RC}\right)` },
    ],
  },
  calculators: [
    calc<{ tau: number; Vc: number; I: number; pct: number }>({
      id: 'carga',
      label: 'Carga',
      example: 'una batería de 10 V carga un capacitor de 100 µF a través de 1 kΩ.',
      inputs: [
        { kind: 'number', id: 'V', label: 'Voltaje de la fuente', symbol: 'V', default: 10, unit: 'V' },
        { kind: 'number', id: 'R', label: 'Resistencia', symbol: 'R', default: 1000, unit: 'Ω' },
        { kind: 'number', id: 'C', label: 'Capacitancia (µF)', symbol: 'C', default: 100, unit: 'µF' },
        { kind: 'number', id: 't', label: 'Tiempo (ms)', symbol: 't', default: 100, unit: 'ms' },
      ],
      compute: (v) => {
        const [V, R, C, t] = [num(v, 'V'), num(v, 'R'), num(v, 'C') * 1e-6, num(v, 't') * 1e-3]
        positiveList([R, C], 'R,\\ C')
        if (t < 0) fail('El tiempo no puede ser negativo.')
        const tau = R * C
        const e = Math.exp(-t / tau)
        return { tau, Vc: V * (1 - e), I: (V / R) * e, pct: 100 * (1 - e) }
      },
      steps: (v, r) => [
        { label: 'Constante de tiempo', latex: L`\tau=RC=(${fmt(num(v, 'R'))})(${fmt(num(v, 'C'))}\times10^{-6})=${fmt(r.tau * 1000)}${u('ms')}` },
        { label: 'Sustituimos', latex: L`V_C=${fmt(num(v, 'V'))}\left(1-e^{-${fmt(num(v, 't'))}/${fmt(r.tau * 1000)}}\right)=${fmt(r.Vc)}${u('V')}` },
        { label: 'Corriente en ese instante', latex: L`i=\frac{V}{R}e^{-t/\tau}=${fmt(r.I * 1000)}${u('mA')}` },
      ],
      answer: (_v, r) => L`V_C=${fmt(r.Vc)}${u('V')}`,
      extras: (_v, r) => [
        { label: 'Constante de tiempo', latex: L`\tau=${fmt(r.tau * 1000)}${u('ms')}` },
        { label: 'Avance', latex: L`${fmt(r.pct, 1)}\,\%` },
      ],
      interpret: (v, r) => [
        { tone: 'good', text: `A los $${fmt(num(v, 't'))}\\ \\mathrm{ms}$ el capacitor lleva el $${fmt(r.pct, 1)}\\,\\%$ de la carga: $${fmt(r.Vc)}\\ \\mathrm{V}$ de $${fmt(num(v, 'V'))}\\ \\mathrm{V}$.` },
        { tone: 'info', text: `Estará prácticamente cargado tras $5\\tau = ${fmt(5 * r.tau * 1000)}\\ \\mathrm{ms}$.` },
      ],
      visual: (v, r) => {
        const V = num(v, 'V')
        const ms = (t: number) => t * 1000
        const curve = expCurve((t) => V * (1 - Math.exp(-t / r.tau)), r.tau).map(([t, y]): [number, number] => [ms(t), y])
        return {
          type: 'plot',
          curves: [
            { points: curve, tone: 'a', label: 'V_C(t)' },
            { points: [[0, V], [ms(5 * r.tau), V]], tone: 'muted', dashed: true },
          ],
          segments: [{ from: [ms(r.tau), 0], to: [ms(r.tau), V * (1 - Math.exp(-1))], tone: 'muted', dashed: true, label: 'τ' }],
          marks: [{ x: num(v, 't'), y: r.Vc, tone: 'accent', label: `${fmt(r.Vc, 2)} V` }],
          caption: 'Eje x en ms. La línea punteada marca τ: ahí va en 63 %.',
        }
      },
    }),
    calc<{ tau: number; Vc: number }>({
      id: 'descarga',
      label: 'Descarga',
      example: 'un capacitor de 100 µF cargado a 10 V se descarga por 1 kΩ.',
      inputs: [
        { kind: 'number', id: 'V0', label: 'Voltaje inicial', symbol: 'V_0', default: 10, unit: 'V' },
        { kind: 'number', id: 'R', label: 'Resistencia', symbol: 'R', default: 1000, unit: 'Ω' },
        { kind: 'number', id: 'C', label: 'Capacitancia (µF)', symbol: 'C', default: 100, unit: 'µF' },
        { kind: 'number', id: 't', label: 'Tiempo (ms)', symbol: 't', default: 100, unit: 'ms' },
      ],
      compute: (v) => {
        const [R, C, t] = [num(v, 'R'), num(v, 'C') * 1e-6, num(v, 't') * 1e-3]
        positiveList([R, C], 'R,\\ C')
        const tau = R * C
        return { tau, Vc: num(v, 'V0') * Math.exp(-t / tau) }
      },
      steps: (v, r) => [
        { label: 'Constante de tiempo', latex: L`\tau=RC=${fmt(r.tau * 1000)}${u('ms')}` },
        { label: 'Sustituimos', latex: L`V_C=${fmt(num(v, 'V0'))}\,e^{-${fmt(num(v, 't'))}/${fmt(r.tau * 1000)}}=${fmt(r.Vc)}${u('V')}` },
      ],
      answer: (_v, r) => L`V_C=${fmt(r.Vc)}${u('V')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Le queda el $${fmt((100 * r.Vc) / num(v, 'V0'), 1)}\\,\\%$ del voltaje inicial.` },
      ],
      visual: (v, r) => ({
        type: 'plot',
        curves: [{
          points: expCurve((t) => num(v, 'V0') * Math.exp(-t / r.tau), r.tau).map(([t, y]): [number, number] => [t * 1000, y]),
          tone: 'b', label: 'V_C(t)',
        }],
        marks: [{ x: num(v, 't'), y: r.Vc, tone: 'accent', label: `${fmt(r.Vc, 2)} V` }],
        caption: 'Eje x en ms.',
      }),
    }),
  ],
  commonMistakes: [
    'Olvidar los prefijos: $100\\ \\mu\\mathrm{F} = 100\\times10^{-6}\\ \\mathrm{F}$.',
    'Creer que el capacitor “termina” de cargarse: en teoría nunca llega exactamente a $V$; en la práctica basta con $5\\tau$.',
  ],
  related: ['circuito-rl', 'ley-de-ohm', 'leyes-de-kirchhoff'],
  toolLink: { path: '/circuit-lab?ejemplo=rc', label: 'Circuit Lab' },
  keywords: ['capacitor', 'condensador', 'rc', 'constante de tiempo', 'carga', 'descarga', 'tau'],
}

const rlCircuit: Formula = {
  id: 'circuito-rl',
  name: 'Circuito RL',
  category: 'electricidad',
  latex: L`I(t)=\frac{V}{R}\left(1-e^{-tR/L}\right)`,
  forms: [
    { label: 'Constante de tiempo', latex: L`\tau=\frac{L}{R}` },
    { label: 'Al quitar la fuente', latex: L`I(t)=I_0\,e^{-tR/L}` },
  ],
  summary: 'Cómo crece la corriente en una bobina conectada a una fuente a través de una resistencia.',
  goal: 'Saber cuánto tarda en establecerse la corriente de un motor, un relevador o un electroimán, y qué pasa al desconectarlo.',
  variables: [
    { symbol: 'I', meaning: 'Corriente de la bobina en el instante $t$', unit: 'A' },
    { symbol: 'V', meaning: 'Voltaje de la fuente', unit: 'V' },
    { symbol: 'R', meaning: 'Resistencia del circuito', unit: 'Ω' },
    { symbol: 'L', meaning: 'Inductancia', unit: 'H' },
    { symbol: '\\tau', meaning: 'Constante de tiempo $L/R$', unit: 's' },
  ],
  whenToUse: ['Una bobina en serie con una resistencia y una fuente de voltaje constante.'],
  intuition: [
    'La bobina se opone a que la corriente cambie: al conectarla, al principio se comporta como un circuito **abierto** y la corriente arranca en 0.',
    'Con el tiempo deja de oponerse y termina comportándose como un cable: la corriente llega a $V/R$.',
    'Es el “espejo” del circuito RC: allá lo que no cambia de golpe es el voltaje; aquí es la corriente.',
  ],
  calculators: [
    calc<{ tau: number; I: number; Imax: number }>({
      id: 'subida',
      label: 'Corriente al conectar',
      example: 'una bobina de 1 H con 100 Ω conectada a 10 V.',
      inputs: [
        { kind: 'number', id: 'V', label: 'Voltaje', symbol: 'V', default: 10, unit: 'V' },
        { kind: 'number', id: 'R', label: 'Resistencia', symbol: 'R', default: 100, unit: 'Ω' },
        { kind: 'number', id: 'L', label: 'Inductancia', symbol: 'L', default: 1, unit: 'H' },
        { kind: 'number', id: 't', label: 'Tiempo (ms)', symbol: 't', default: 10, unit: 'ms' },
      ],
      compute: (v) => {
        const [V, R, Lh, t] = [num(v, 'V'), num(v, 'R'), num(v, 'L'), num(v, 't') * 1e-3]
        positiveList([R, Lh], 'R,\\ L')
        const tau = Lh / R
        return { tau, Imax: V / R, I: (V / R) * (1 - Math.exp(-t / tau)) }
      },
      steps: (v, r) => [
        { label: 'Constante de tiempo', latex: L`\tau=\frac{L}{R}=\frac{${fmt(num(v, 'L'))}}{${fmt(num(v, 'R'))}}=${fmt(r.tau * 1000)}${u('ms')}` },
        { label: 'Corriente final', latex: L`I_\infty=\frac{V}{R}=${fmt(r.Imax * 1000)}${u('mA')}` },
        { label: 'Sustituimos', latex: L`I=${fmt(r.Imax * 1000)}\left(1-e^{-${fmt(num(v, 't'))}/${fmt(r.tau * 1000)}}\right)=${fmt(r.I * 1000)}${u('mA')}` },
      ],
      answer: (_v, r) => L`I=${fmt(r.I * 1000)}${u('mA')}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `La corriente va en el $${fmt((100 * r.I) / r.Imax, 1)}\\,\\%$ de su valor final ($${fmt(r.Imax * 1000)}\\ \\mathrm{mA}$).` },
        { tone: 'warn', text: 'Si abres el circuito de golpe, la bobina intenta mantener su corriente y genera un pico de voltaje muy alto. Por eso los relevadores llevan un diodo en paralelo.' },
      ],
      visual: (v, r) => ({
        type: 'plot',
        curves: [{
          points: expCurve((t) => r.Imax * 1000 * (1 - Math.exp(-t / r.tau)), r.tau).map(([t, y]): [number, number] => [t * 1000, y]),
          tone: 'a', label: 'I(t) en mA',
        }],
        marks: [{ x: num(v, 't'), y: r.I * 1000, tone: 'accent', label: `${fmt(r.I * 1000, 2)} mA` }],
        caption: 'Eje x en ms.',
      }),
    }),
  ],
  commonMistakes: ['Usar $RL$ en lugar de $L/R$ como constante de tiempo.'],
  related: ['circuito-rc', 'ley-de-ohm'],
  toolLink: { path: '/circuit-lab?ejemplo=rl', label: 'Circuit Lab' },
  keywords: ['bobina', 'inductor', 'inductancia', 'rl', 'constante de tiempo', 'tau'],
}

// ═══ Diodos ══════════════════════════════════════════════════════════════════

const VT = 0.025852

const diodo: Formula = {
  id: 'diodo',
  name: 'Diodos y LEDs',
  category: 'electricidad',
  latex: L`I=I_s\left(e^{V/nV_T}-1\right)`,
  forms: [
    { label: 'Aproximación práctica (silicio)', latex: L`V_D\approx0.7\ \mathrm{V}\ \text{si conduce}` },
    { label: 'Resistencia para un LED', latex: L`R=\frac{V_{fuente}-V_f}{I}` },
    { label: 'Regulador Zener', latex: L`V_{out}\approx V_Z,\qquad I_Z=\frac{V_{in}-V_Z}{R}-\frac{V_Z}{R_L}` },
  ],
  summary: 'Un diodo deja pasar la corriente en un solo sentido; su corriente crece exponencialmente con el voltaje.',
  goal: 'Saber cuánta corriente pasa por un diodo o un LED, qué resistencia ponerle a un LED, o cómo un Zener mantiene un voltaje fijo.',
  variables: [
    { symbol: 'I', meaning: 'Corriente del ánodo al cátodo', unit: 'A' },
    { symbol: 'V', meaning: 'Voltaje del ánodo respecto al cátodo', unit: 'V' },
    { symbol: 'I_s', meaning: 'Corriente de saturación (diminuta, ~$10^{-14}$ A en silicio)', unit: 'A' },
    { symbol: 'n', meaning: 'Factor de idealidad (1 a 2)' },
    { symbol: 'V_T', meaning: 'Voltaje térmico $kT/q \\approx 25.9$ mV a temperatura ambiente', unit: 'V' },
    { symbol: 'V_f', meaning: 'Voltaje directo de un LED (≈ 1.9 V rojo, 3 V azul)', unit: 'V' },
  ],
  whenToUse: [
    'Rectificar (convertir AC en DC), proteger contra polaridad invertida, iluminar con LEDs, regular voltaje con un Zener.',
    'Para cálculos rápidos basta la aproximación de caída fija; la exponencial explica por qué funciona.',
  ],
  intuition: [
    'En **directa** (ánodo más positivo) la corriente crece tan rápido que, una vez que conduce, el voltaje casi no cambia: unos 0.7 V en silicio. Cada 60 mV más multiplican la corriente por 10.',
    'En **inversa** casi no pasa corriente: el diodo es una válvula de un solo sentido.',
    'Un **LED** es un diodo que emite luz; su caída es mayor (1.8–3.3 V según el color) y necesita una resistencia en serie que limite la corriente.',
    'Un **Zener** está hecho para conducir en inversa al llegar a $V_Z$, y mantiene ese voltaje casi constante.',
  ],
  calculators: [
    calc<{ R: number; P: number }>({
      id: 'led',
      label: 'Resistencia para un LED',
      example: 'un LED rojo (1.9 V) a 15 mA con una batería de 9 V.',
      inputs: [
        { kind: 'number', id: 'V', label: 'Voltaje de la fuente', symbol: 'V_{fuente}', default: 9, unit: 'V' },
        { kind: 'number', id: 'Vf', label: 'Voltaje del LED', symbol: 'V_f', default: 1.9, unit: 'V' },
        { kind: 'number', id: 'I', label: 'Corriente deseada (mA)', symbol: 'I', default: 15, unit: 'mA' },
      ],
      compute: (v) => {
        const [V, Vf, I] = [num(v, 'V'), num(v, 'Vf'), num(v, 'I') / 1000]
        if (!(I > 0)) fail('La corriente debe ser mayor que 0.')
        if (!(V > Vf)) fail('La fuente debe tener más voltaje que el LED; si no, no enciende.')
        return { R: (V - Vf) / I, P: (V - Vf) * I }
      },
      steps: (v, r) => [
        { label: 'Voltaje que debe absorber la resistencia', latex: L`V_R=${fmt(num(v, 'V'))}-${fmt(num(v, 'Vf'))}=${fmt(num(v, 'V') - num(v, 'Vf'))}${u('V')}` },
        { label: 'Ley de Ohm', latex: L`R=\frac{${fmt(num(v, 'V') - num(v, 'Vf'))}}{${fmt(num(v, 'I') / 1000)}}=${fmt(r.R)}${ohms}` },
        { label: 'Potencia en la resistencia', latex: L`P=V_RI=${fmt(r.P * 1000)}${u('mW')}` },
      ],
      answer: (_v, r) => L`R=${fmt(r.R)}${ohms}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `Usa una resistencia de al menos $${fmt(r.R, 0)}\\ \\Omega$ (el valor comercial inmediato superior).` },
        { tone: 'info', text: `Disipa $${fmt(r.P * 1000)}\\ \\mathrm{mW}$: una resistencia común de 1/4 W (250 mW) ${r.P < 0.2 ? 'basta' : 'no basta; usa una de mayor potencia'}.` },
      ],
      tryInTool: () => ({ path: '/circuit-lab?ejemplo=led', label: 'Probar en Circuit Lab' }),
    }),
    calc<{ IR: number; IL: number; IZ: number }>({
      id: 'zener',
      label: 'Regulador Zener',
      example: '12 V con 470 Ω, un Zener de 5.1 V y una carga de 1 kΩ.',
      inputs: [
        { kind: 'number', id: 'Vin', label: 'Voltaje de entrada', symbol: 'V_{in}', default: 12, unit: 'V' },
        { kind: 'number', id: 'Vz', label: 'Voltaje Zener', symbol: 'V_Z', default: 5.1, unit: 'V' },
        { kind: 'number', id: 'R', label: 'Resistencia en serie', symbol: 'R', default: 470, unit: 'Ω' },
        { kind: 'number', id: 'RL', label: 'Carga', symbol: 'R_L', default: 1000, unit: 'Ω' },
      ],
      compute: (v) => {
        const [Vin, Vz, R, RL] = [num(v, 'Vin'), num(v, 'Vz'), num(v, 'R'), num(v, 'RL')]
        positiveList([R, RL], 'R')
        const IR = (Vin - Vz) / R
        const IL = Vz / RL
        return { IR, IL, IZ: IR - IL }
      },
      steps: (v, r) => [
        { label: 'Corriente por la resistencia', latex: L`I_R=\frac{V_{in}-V_Z}{R}=\frac{${fmt(num(v, 'Vin'))}-${fmt(num(v, 'Vz'))}}{${fmt(num(v, 'R'))}}=${fmt(r.IR * 1000)}${u('mA')}` },
        { label: 'Corriente de la carga', latex: L`I_L=\frac{V_Z}{R_L}=${fmt(r.IL * 1000)}${u('mA')}` },
        { label: 'Lo que sobra va por el Zener', latex: L`I_Z=I_R-I_L=${fmt(r.IZ * 1000)}${u('mA')}` },
      ],
      answer: (_v, r) => L`I_Z=${fmt(r.IZ * 1000)}${u('mA')}`,
      interpret: (v, r) => [
        r.IZ > 0.001
          ? { tone: 'good', text: `El Zener regula: la carga recibe $\\approx ${fmt(num(v, 'Vz'))}\\ \\mathrm{V}$ y el Zener absorbe $${fmt(r.IZ * 1000)}\\ \\mathrm{mA}$ de sobra.` }
          : { tone: 'warn', text: 'La carga pide más corriente de la que deja pasar la resistencia: el Zener se apaga y el voltaje cae por debajo de $V_Z$. Baja $R$ o usa una carga más ligera.' },
        { tone: 'info', text: `El Zener disipa $P = V_Z I_Z = ${fmt(num(v, 'Vz') * r.IZ * 1000)}\\ \\mathrm{mW}$.` },
      ],
      tryInTool: () => ({ path: '/circuit-lab?ejemplo=zener', label: 'Probar en Circuit Lab' }),
    }),
    calc<{ I: number }>({
      id: 'shockley',
      label: 'Ecuación de Shockley',
      example: 'un diodo de silicio ($I_s = 10^{-14}$ A, $n = 1$) con 0.65 V.',
      inputs: [
        { kind: 'number', id: 'V', label: 'Voltaje', symbol: 'V', default: 0.65, unit: 'V', step: 0.01 },
        { kind: 'number', id: 'n', label: 'Factor de idealidad', symbol: 'n', default: 1, step: 0.1 },
      ],
      compute: (v) => {
        const n = num(v, 'n')
        if (!(n > 0)) fail('$n$ debe ser mayor que 0.')
        return { I: 1e-14 * Math.expm1(num(v, 'V') / (n * VT)) }
      },
      steps: (v, r) => [
        { label: 'Exponente', latex: L`\frac{V}{nV_T}=\frac{${fmt(num(v, 'V'))}}{${fmt(num(v, 'n'))}\cdot0.025852}=${fmt(num(v, 'V') / (num(v, 'n') * VT))}` },
        { label: 'Corriente', latex: L`I=10^{-14}\left(e^{${fmt(num(v, 'V') / (num(v, 'n') * VT))}}-1\right)=${fmt(r.I)}${u('A')}` },
      ],
      answer: (_v, r) => L`I=${fmt(r.I)}${u('A')}`,
      interpret: (v) => [
        { tone: 'info', text: `Prueba subir el voltaje 0.06 V: la corriente se multiplica por $e^{0.06/${fmt(num(v, 'n') * VT)}} \\approx ${fmt(Math.exp(0.06 / (num(v, 'n') * VT)), 1)}$.` },
      ],
      visual: (v, r) => ({
        type: 'plot',
        curves: [{
          points: Array.from({ length: 61 }, (_, k): [number, number] => {
            const V = (k / 60) * 0.8
            return [V, 1e3 * 1e-14 * Math.expm1(V / (num(v, 'n') * VT))]
          }).filter(([, y]) => y < 60),
          tone: 'a', label: 'I (mA)',
        }],
        marks: r.I * 1e3 < 60 ? [{ x: num(v, 'V'), y: r.I * 1e3, tone: 'accent', label: `${fmt(r.I * 1e3, 2)} mA` }] : [],
        caption: 'Eje x: voltaje (V). Casi nada hasta ~0.6 V; después la corriente se dispara.',
      }),
    }),
  ],
  commonMistakes: [
    'Conectar un LED directo a la batería sin resistencia: la corriente sólo la limita la exponencial y se quema.',
    'Poner el diodo al revés: la barra (cátodo) va hacia el lado negativo para que conduzca.',
    'Olvidar que el Zener se conecta en **inversa** para regular.',
  ],
  related: ['ley-de-ohm', 'potencia-electrica', 'leyes-de-kirchhoff'],
  toolLink: { path: '/circuit-lab?ejemplo=led', label: 'Circuit Lab' },
  keywords: ['diodo', 'led', 'zener', 'shockley', 'rectificador', 'semiconductor', 'regulador'],
}

export const CIRCUITOS: Formula[] = [divisor, serie, paralelo, kirchhoff, rcCircuit, rlCircuit, diodo]
