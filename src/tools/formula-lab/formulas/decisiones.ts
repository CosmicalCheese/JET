import { calc, fail, list, num, type CalcStep, type Formula, type Values } from '../types'
import { fmt } from '../format'
import { L, barsSpec, matrixTex, toneAt } from './oi-comun'

const TOL = 1e-9

// ─── Matriz de resultados ────────────────────────────────────────────────────

interface Matrix { M: number[][]; m: number; n: number }

function readMatrix(v: Values, pfx: string): Matrix {
  const n = num(v, `${pfx}estados`)
  if (!Number.isInteger(n) || n < 2 || n > 8) fail('El número de estados de la naturaleza debe ser un entero entre 2 y 8.')
  const flat = list(v, `${pfx}pay`)
  if (flat.length % n !== 0) fail(`Escribiste ${flat.length} números, pero con ${n} estados de la naturaleza deben ser un múltiplo de ${n} (un renglón de ${n} resultados por cada alternativa).`)
  const m = flat.length / n
  if (m < 2 || m > 8) fail('Debe haber entre 2 y 8 alternativas.')
  return { M: Array.from({ length: m }, (_, i) => flat.slice(i * n, (i + 1) * n)), m, n }
}

const altNames = (m: number) => Array.from({ length: m }, (_, i) => `A_{${i + 1}}`)
const stateNames = (n: number) => Array.from({ length: n }, (_, j) => `E_{${j + 1}}`)

const argBest = (xs: number[], dir: 1 | -1) => {
  const best = dir === 1 ? Math.max(...xs) : Math.min(...xs)
  return xs.flatMap((x, i) => (Math.abs(x - best) <= TOL * Math.max(1, Math.abs(best)) ? [i] : []))
}
const names = (idx: number[]) => idx.map(i => `A_{${i + 1}}`).join(L`\ \text{o}\ `)

const payInput = (pfx: string, def: number[]) => ({ kind: 'list' as const, id: `${pfx}pay`, label: 'Resultados por alternativa (un renglón tras otro)', symbol: L`M`, default: def })
const statesInput = (pfx: string) => ({ kind: 'number' as const, id: `${pfx}estados`, label: 'Número de estados de la naturaleza (columnas)', symbol: L`n`, default: 3 })

// ─── Criterios de decisión sin probabilidades ────────────────────────────────

interface Crit {
  s: 1 | -1
  M: number[][]
  worst: number[]
  best: number[]
  avg: number[]
  hur: number[]
  regret: number[][]
  maxRegret: number[]
  alpha: number
  picks: { wald: number[]; optim: number[]; laplace: number[]; hurwicz: number[]; savage: number[] }
}

function critCompute(v: Values, s: 1 | -1, pfx: string): Crit {
  const { M, n } = readMatrix(v, pfx)
  const alpha = num(v, `${pfx}alpha`)
  if (!(alpha >= 0 && alpha <= 1)) fail('El coeficiente de optimismo $\\alpha$ debe estar entre 0 y 1.')
  const G = M.map(r => r.map(x => s * x)) // siempre maximizamos G
  const worst = G.map(r => Math.min(...r)), best = G.map(r => Math.max(...r))
  const avg = G.map(r => r.reduce((t, x) => t + x, 0) / n)
  const hur = G.map((_, i) => alpha * best[i] + (1 - alpha) * worst[i])
  const colMax = Array.from({ length: n }, (_, j) => Math.max(...G.map(r => r[j])))
  const regret = G.map(r => r.map((x, j) => colMax[j] - x))
  const maxRegret = regret.map(r => Math.max(...r))
  return {
    s, M, alpha,
    worst: worst.map(x => s * x), best: best.map(x => s * x), avg: avg.map(x => s * x), hur: hur.map(x => s * x), regret, maxRegret,
    picks: { wald: argBest(worst, 1), optim: argBest(best, 1), laplace: argBest(avg, 1), hurwicz: argBest(hur, 1), savage: argBest(maxRegret, -1) },
  }
}

function critCalc(s: 1 | -1) {
  const gains = s === 1
  const pfx = gains ? 'g.' : 'c.'
  return calc<Crit>({
    id: gains ? 'ganancias' : 'costos',
    label: gains ? 'Ganancias (maximizar)' : 'Costos (minimizar)',
    example: gains
      ? 'Tres alternativas de inversión (renglones) y tres escenarios de mercado: favorable, estable y desfavorable. Los números son ganancias.'
      : 'Tres alternativas (renglones) y tres escenarios. Los números son costos: se prefiere el menor.',
    inputs: [
      statesInput(pfx),
      payInput(pfx, gains ? [200, 100, -50, 120, 90, 30, 50, 50, 50] : [20, 35, 60, 30, 32, 40, 45, 45, 45]),
      { kind: 'number', id: `${pfx}alpha`, label: 'Coeficiente de optimismo (Hurwicz)', symbol: L`\alpha`, default: 0.6 },
    ],
    compute: (v) => critCompute(v, s, pfx),
    steps: (_v, r) => {
      const m = r.M.length, n = r.M[0].length
      const A = altNames(m), E = stateNames(n)
      const f = (x: number) => fmt(x)
      const best = gains ? 'mayor' : 'menor'
      const worstW = gains ? 'peor (el menor)' : 'peor (el mayor)'
      const bestW = gains ? 'mejor (el mayor)' : 'mejor (el menor)'
      const mark = (idx: number[]) => idx.map(i => `A_{${i + 1}}`).join(',')
      const steps: CalcStep[] = [
        { label: gains ? 'Matriz de ganancias (renglón = alternativa, columna = estado de la naturaleza)' : 'Matriz de costos (renglón = alternativa, columna = estado de la naturaleza)', latex: matrixTex(r.M, f, A, E) },
        {
          label: `Para cada alternativa: su ${worstW} resultado, su ${bestW}, el promedio y el valor de Hurwicz con $\\alpha=${fmt(r.alpha)}$`,
          latex: L`\begin{array}{c|rrrr}&\text{Peor}&\text{Mejor}&\text{Promedio}&\text{Hurwicz}\\${A.map((a, i) => `${a}&${f(r.worst[i])}&${f(r.best[i])}&${f(r.avg[i])}&${f(r.hur[i])}`).join(L`\\`)}\end{array}`,
        },
        {
          label: `**Wald** ${gains ? '(maximin)' : '(minimax)'}: elige la alternativa con el ${best} de los peores resultados`,
          latex: L`${gains ? '\\max' : '\\min'}\{${r.worst.map(f).join(',\\ ')}\}=${f(r.worst[r.picks.wald[0]])}\ \Rightarrow\ ${names(r.picks.wald)}`,
        },
        {
          label: `**Optimista** ${gains ? '(maximax)' : '(minimin)'}: elige la alternativa con el ${best} de los mejores resultados`,
          latex: L`${gains ? '\\max' : '\\min'}\{${r.best.map(f).join(',\\ ')}\}=${f(r.best[r.picks.optim[0]])}\ \Rightarrow\ ${names(r.picks.optim)}`,
        },
        {
          label: `**Laplace**: todos los estados son igual de probables, así que se ${gains ? 'maximiza' : 'minimiza'} el promedio`,
          latex: L`${gains ? '\\max' : '\\min'}\{${r.avg.map(f).join(',\\ ')}\}=${f(r.avg[r.picks.laplace[0]])}\ \Rightarrow\ ${names(r.picks.laplace)}`,
        },
        {
          label: `**Hurwicz** con $\\alpha=${fmt(r.alpha)}$: se mezcla lo mejor (peso $\\alpha$) y lo peor (peso $1-\\alpha$) de cada alternativa`,
          latex: L`H_i=\alpha\cdot\text{mejor}+(1-\alpha)\cdot\text{peor}\ \Rightarrow\ ${r.hur.map(f).join(',\\ ')}\ \Rightarrow\ ${names(r.picks.hurwicz)}`,
        },
        {
          label: `**Savage** (arrepentimiento): cuánto pierdes por no haber elegido la mejor alternativa en cada estado. Se elige la que tiene **menor arrepentimiento máximo**`,
          latex: L`\begin{array}{c|${'r'.repeat(n)}|r}&${E.join('&')}&\text{Máx}\\${A.map((a, i) => `${a}&${r.regret[i].map(f).join('&')}&${f(r.maxRegret[i])}`).join(L`\\`)}\end{array}`,
        },
        { label: 'Resumen', latex: L`\text{Wald: }${mark(r.picks.wald)}\quad\text{Optimista: }${mark(r.picks.optim)}\quad\text{Laplace: }${mark(r.picks.laplace)}\quad\text{Hurwicz: }${mark(r.picks.hurwicz)}\quad\text{Savage: }${mark(r.picks.savage)}` },
      ]
      return steps
    },
    answer: (_v, r) => L`\text{Wald }${names(r.picks.wald)},\ \text{optimista }${names(r.picks.optim)},\ \text{Laplace }${names(r.picks.laplace)},\ \text{Hurwicz }${names(r.picks.hurwicz)},\ \text{Savage }${names(r.picks.savage)}`,
    extras: (_v, r) => [
      { label: 'Wald (pesimista)', latex: names(r.picks.wald) },
      { label: 'Optimista', latex: names(r.picks.optim) },
      { label: 'Laplace', latex: names(r.picks.laplace) },
      { label: 'Hurwicz', latex: names(r.picks.hurwicz) },
      { label: 'Savage (arrepentimiento)', latex: names(r.picks.savage) },
    ],
    interpret: (_v, r) => {
      const all = [r.picks.wald, r.picks.optim, r.picks.laplace, r.picks.hurwicz, r.picks.savage].map(p => p.join(','))
      const same = new Set(all).size === 1
      const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = []
      if (same) out.push({ tone: 'good', text: `**Todos los criterios coinciden** en $${names(r.picks.wald)}$: es una decisión muy robusta.` })
      else out.push({ tone: 'warn', text: 'Los criterios **no coinciden**: cada uno refleja una actitud distinta ante el riesgo. No hay una “respuesta correcta” única sin probabilidades; hay que elegir según la actitud del que decide.' })
      out.push(
        { tone: 'info', text: `**Wald** es el pesimista: asume que ocurrirá el peor escenario y elige $${names(r.picks.wald)}$ para asegurar el mejor “peor caso”.` },
        { tone: 'info', text: `**Optimista** apuesta a que todo sale bien: $${names(r.picks.optim)}$.` },
        { tone: 'info', text: `**Laplace** trata los estados como igual de probables: $${names(r.picks.laplace)}$. **Hurwicz** con $\\alpha=${fmt(r.alpha)}$ es una mezcla entre optimista y pesimista: $${names(r.picks.hurwicz)}$.` },
        { tone: 'info', text: `**Savage** minimiza el arrepentimiento máximo: $${names(r.picks.savage)}$. Si te importa más “no equivocarte feo” que ganar lo máximo, es el criterio indicado.` },
      )
      if (r.picks.wald.length > 1 || r.picks.optim.length > 1 || r.picks.laplace.length > 1 || r.picks.hurwicz.length > 1 || r.picks.savage.length > 1) out.push({ tone: 'info', text: 'Cuando aparece “o” hay un empate entre alternativas.' })
      return out
    },
    visual: (_v, r) => {
      const m = r.M.length
      return {
        type: 'plot',
        curves: Array.from({ length: m }, (_, i) => ({ points: [[0, r.worst[i]], [1, r.best[i]]] as [number, number][], tone: toneAt(i), label: `A_{${i + 1}}` })),
        segments: [{ from: [r.alpha, Math.min(...r.worst, ...r.best)], to: [r.alpha, Math.max(...r.worst, ...r.best)], tone: 'warn', dashed: true }],
        marks: r.hur.map((h, i) => ({ x: r.alpha, y: h, tone: toneAt(i), label: i === r.picks.hurwicz[0] ? `A${i + 1} ★` : undefined })),
        xRange: [0, 1],
        caption: `Valor de Hurwicz de cada alternativa según el optimismo $\\alpha$ (0 = pesimista, 1 = optimista). ${gains ? 'En ganancias gana la línea **más alta**' : 'En costos gana la línea **más baja**'} en el $\\alpha$ elegido (línea punteada). Donde dos líneas se cruzan, cambia la mejor decisión.`,
      }
    },
  })
}

const criterios: Formula = {
  id: 'criterios-decision',
  name: 'Decisiones sin probabilidades: Wald, Laplace, Hurwicz y Savage',
  category: 'decisiones',
  latex: L`H_i=\alpha\,\max_jM_{ij}+(1-\alpha)\,\min_jM_{ij}`,
  forms: [
    { label: 'Wald (maximin)', latex: L`\max_i\ \min_j\ M_{ij}` },
    { label: 'Optimista (maximax)', latex: L`\max_i\ \max_j\ M_{ij}` },
    { label: 'Laplace', latex: L`\max_i\ \frac1n\sum_jM_{ij}` },
    { label: 'Savage (arrepentimiento mínimo)', latex: L`r_{ij}=\max_kM_{kj}-M_{ij}\qquad\min_i\ \max_j\ r_{ij}` },
  ],
  summary: 'Cómo elegir entre alternativas cuando se conocen los resultados posibles pero **no** las probabilidades de cada escenario.',
  goal: 'Escoger una alternativa de una tabla de resultados (alternativas × estados de la naturaleza) cuando es imposible asignar probabilidades confiables a los estados.',
  variables: [
    { symbol: 'A_i', meaning: 'Alternativas (lo que **tú** decides): invertir, construir, comprar…' },
    { symbol: 'E_j', meaning: 'Estados de la naturaleza (lo que **no** controlas): mercado alto, medio o bajo' },
    { symbol: 'M_{ij}', meaning: 'Resultado (ganancia o costo) de la alternativa $i$ si ocurre el estado $j$' },
    { symbol: L`\alpha`, meaning: 'Coeficiente de optimismo de Hurwicz, entre 0 (pesimista total) y 1 (optimista total)' },
    { symbol: 'r_{ij}', meaning: 'Arrepentimiento: cuánto menos ganas que con la mejor alternativa si ocurre $E_j$' },
  ],
  whenToUse: [
    'No hay datos para estimar probabilidades (producto nuevo, situaciones sin precedente).',
    'Para comparar actitudes ante el riesgo y ver qué tan **robusta** es una decisión: si varios criterios coinciden, conviene.',
    'Si sí puedes estimar probabilidades, usa el **valor esperado**.',
  ],
  intuition: [
    '**Wald** (pesimista): “Prepárate para lo peor”. Mira el peor resultado de cada alternativa y elige la que tenga el mejor “peor caso”. Seguro pero conservador.',
    '**Optimista**: “Apuesta a lo mejor”. Elige la que tenga el mejor “mejor caso”. Arriesgado.',
    '**Hurwicz**: un punto intermedio. Con $\\alpha=0$ es Wald y con $\\alpha=1$ es optimista. La gráfica muestra cómo cambia la mejor alternativa al variar $\\alpha$.',
    '**Laplace**: sin razón para preferir un estado, todos pesan igual, así que se promedia.',
    '**Savage**: no mide cuánto ganas sino cuánto **lamentarías** haber elegido mal. El arrepentimiento en cada estado es la diferencia con la mejor alternativa de ese estado.',
  ],
  calculators: [critCalc(1), critCalc(-1)],
  commonMistakes: [
    'Aplicar los criterios de **ganancias** a una tabla de **costos** (hay que invertir máximo y mínimo).',
    'En Savage, restar al revés: el arrepentimiento siempre es $\\ge0$ (mejor valor de la columna menos el tuyo, en ganancias).',
    'Esperar que todos los criterios den la misma alternativa: casi nunca pasa.',
    'Escribir los números en el orden equivocado: son renglones (alternativas), cada uno con tantos números como estados.',
  ],
  related: ['valor-esperado', 'juego-2x2'],
  keywords: ['decisiones', 'wald', 'maximin', 'maximax', 'laplace', 'hurwicz', 'savage', 'arrepentimiento', 'incertidumbre', 'teoria de decisiones', 'investigacion de operaciones', 'estados de la naturaleza'],
}

// ─── Valor esperado ──────────────────────────────────────────────────────────

interface Ev { s: 1 | -1; M: number[][]; p: number[]; emv: number[]; best: number[]; bestV: number; evpi: number; evwpi: number; eol: number[] }

function evCompute(v: Values, s: 1 | -1, pfx: string): Ev {
  const { M, n } = readMatrix(v, pfx)
  const p = list(v, `${pfx}prob`)
  if (p.length !== n) fail(`Necesitas ${n} probabilidades (una por estado de la naturaleza) y escribiste ${p.length}.`)
  if (p.some(x => x < 0)) fail('Las probabilidades no pueden ser negativas.')
  if (Math.abs(p.reduce((t, x) => t + x, 0) - 1) > 1e-6) fail(`Las probabilidades deben sumar 1 (ahora suman ${fmt(p.reduce((t, x) => t + x, 0))}).`)
  const emv = M.map(r => r.reduce((t, x, j) => t + x * p[j], 0))
  const best = argBest(emv, s)
  const perfect = Array.from({ length: n }, (_, j) => (s === 1 ? Math.max(...M.map(r => r[j])) : Math.min(...M.map(r => r[j]))))
  const evwpi = perfect.reduce((t, x, j) => t + x * p[j], 0)
  const eol = M.map(r => r.reduce((t, x, j) => t + p[j] * Math.abs(perfect[j] - x), 0))
  return { s, M, p, emv, best, bestV: emv[best[0]], evwpi, evpi: Math.abs(evwpi - emv[best[0]]), eol }
}

function evCalc(s: 1 | -1) {
  const gains = s === 1
  const pfx = gains ? 'g.' : 'c.'
  return calc<Ev>({
    id: gains ? 'ganancias' : 'costos',
    label: gains ? 'Ganancias (maximizar)' : 'Costos (minimizar)',
    example: gains ? 'Las mismas tres inversiones, pero ahora sabes que el mercado será favorable 30%, estable 50% y desfavorable 20%.' : 'Tres alternativas con costos; probabilidades 30%, 50% y 20%.',
    inputs: [
      statesInput(pfx),
      payInput(pfx, gains ? [200, 100, -50, 120, 90, 30, 50, 50, 50] : [20, 35, 60, 30, 32, 40, 45, 45, 45]),
      { kind: 'list', id: `${pfx}prob`, label: 'Probabilidad de cada estado de la naturaleza', symbol: 'P', default: [0.3, 0.5, 0.2] },
    ],
    compute: (v) => evCompute(v, s, pfx),
    steps: (_v, r) => {
      const m = r.M.length, n = r.M[0].length
      const A = altNames(m), E = stateNames(n)
      const f = (x: number) => fmt(x)
      const emvLines = A.map((a, i) => `EMV(${a})=${r.M[i].map((x, j) => `${fmt(r.p[j])}(${fmt(x)})`).join('+')}=${f(r.emv[i])}`)
      const perfect = Array.from({ length: n }, (_, j) => (gains ? Math.max(...r.M.map(row => row[j])) : Math.min(...r.M.map(row => row[j]))))
      return [
        { label: 'Matriz de resultados y probabilidades de cada estado', latex: L`\begin{array}{c|${'r'.repeat(n)}}&${E.join('&')}\\P&${r.p.map(f).join('&')}\\${A.map((a, i) => `${a}&${r.M[i].map(f).join('&')}`).join(L`\\`)}\end{array}` },
        { label: 'Valor esperado de cada alternativa: se multiplica cada resultado por su probabilidad y se suma', latex: L`\begin{array}{l}${emvLines.join(L`\\`)}\end{array}` },
        { label: `La mejor es la de ${gains ? 'mayor' : 'menor'} valor esperado`, latex: L`EMV^*=${f(r.bestV)}\ \Rightarrow\ ${names(r.best)}` },
        { label: `**Información perfecta**: si supieras de antemano el estado, elegirías en cada columna lo ${gains ? 'mejor (mayor)' : 'mejor (menor)'}`, latex: L`EV_{PI}=${perfect.map((x, j) => `${fmt(r.p[j])}(${fmt(x)})`).join('+')}=${f(r.evwpi)}` },
        { label: 'Valor esperado de la información perfecta', latex: L`EVPI=\left|EV_{PI}-EMV^*\right|=|${f(r.evwpi)}-${f(r.bestV)}|=${f(r.evpi)}` },
        { label: 'Comprobación: el mínimo costo de oportunidad esperado (EOL) es igual', latex: L`EOL=\left(${r.eol.map(f).join(',\\ ')}\right)\ \Rightarrow\ \min EOL=${f(Math.min(...r.eol))}=EVPI` },
      ]
    },
    answer: (_v, r) => L`${names(r.best)}\ \text{con}\ EMV=${fmt(r.bestV)}`,
    extras: (_v, r) => [
      { label: 'Valor esperado de la información perfecta', latex: `EVPI=${fmt(r.evpi)}` },
      { label: 'Con información perfecta', latex: `EV_{PI}=${fmt(r.evwpi)}` },
      ...r.emv.map((x, i) => ({ label: `Valor esperado de A${i + 1}`, latex: fmt(x) })),
    ],
    interpret: (_v, r) => [
      { tone: 'good', text: `Conviene **${r.best.map(i => `A${i + 1}`).join(' o ')}**: su valor esperado es **${fmt(r.bestV)}**, el ${gains ? 'mayor' : 'menor'} de todas las alternativas.` },
      { tone: 'info', text: `**EVPI = ${fmt(r.evpi)}**: es lo máximo que valdría la pena pagar por una predicción **perfecta** del estado de la naturaleza (un estudio de mercado jamás vale más que esto).` },
      { tone: 'info', text: 'El valor esperado es el resultado **promedio a largo plazo** si repitieras la decisión muchas veces. En una decisión única puede ocurrir un resultado distinto al esperado: compáralo con los criterios sin probabilidades si el riesgo importa.' },
    ],
    visual: (_v, r) => barsSpec(r.emv, r.emv.map((_, i) => `A${i + 1}`), {
      highlight: r.best,
      line: { y: r.evwpi, label: 'con información perfecta' },
      caption: `Valor esperado de cada alternativa (en rojo la mejor). La línea punteada es lo que obtendrías con información perfecta: la distancia entre las dos es el EVPI (${fmt(r.evpi)}).`,
    }),
  })
}

const valorEsperado: Formula = {
  id: 'valor-esperado',
  name: 'Valor esperado y valor de la información perfecta',
  category: 'decisiones',
  latex: L`EMV(A_i)=\sum_jP(E_j)\,M_{ij}`,
  forms: [
    { label: 'Valor esperado con información perfecta', latex: L`EV_{PI}=\sum_jP(E_j)\,\max_iM_{ij}` },
    { label: 'Valor esperado de la información perfecta', latex: L`EVPI=EV_{PI}-EMV^*` },
    { label: 'Costo de oportunidad esperado', latex: L`EOL(A_i)=\sum_jP(E_j)\,r_{ij}\qquad\min_iEOL=EVPI` },
  ],
  summary: 'Elige la alternativa con mejor resultado **promedio** y calcula cuánto valdría conocer el futuro.',
  goal: 'Decidir cuando sí tienes probabilidades de los estados, y saber cuánto vale la pena gastar en información (un estudio, una encuesta, un piloto).',
  variables: [
    { symbol: 'P(E_j)', meaning: 'Probabilidad del estado de la naturaleza $E_j$ (suman 1)' },
    { symbol: 'M_{ij}', meaning: 'Resultado de la alternativa $i$ si ocurre $E_j$' },
    { symbol: 'EMV', meaning: 'Valor monetario esperado de una alternativa' },
    { symbol: 'EV_{PI}', meaning: 'Valor esperado si **supieras** el estado antes de decidir' },
    { symbol: 'EVPI', meaning: 'Cuánto aumentaría tu valor esperado con información perfecta: **el máximo** que pagarías por información' },
  ],
  whenToUse: [
    'Decisiones con probabilidades estimadas (históricos, expertos, estudios).',
    'Para poner un **tope** al precio de cualquier información: nunca vale más que el EVPI.',
  ],
  intuition: [
    'El valor esperado es un promedio ponderado: cada resultado pesa según su probabilidad. Es lo que ganarías en promedio si repitieras la misma decisión muchas veces.',
    'Con información perfecta, en cada estado eliges la mejor alternativa de **esa** columna. Pesando esas mejores opciones sale $EV_{PI}$. La mejora respecto a decidir sin saber es el EVPI.',
    'El EVPI es siempre $\\ge0$ y se anula si una alternativa es la mejor en **todos** los estados (no hay nada que aprender).',
  ],
  calculators: [evCalc(1), evCalc(-1)],
  commonMistakes: [
    'Que las probabilidades no sumen 1.',
    'Pagar por información más de lo que vale el EVPI: aunque fuera perfecta, no valdría la pena.',
    'Creer que el valor esperado es un resultado que **realmente** ocurrirá: es un promedio.',
  ],
  related: ['criterios-decision', 'newsvendor'],
  keywords: ['valor esperado', 'emv', 'evpi', 'informacion perfecta', 'arbol de decision', 'decisiones con riesgo', 'costo de oportunidad', 'investigacion de operaciones'],
}

// ─── Juego de suma cero 2×2 ──────────────────────────────────────────────────

interface Game { a: number[][]; maximin: number; minimax: number; saddle: boolean; row: number; col: number; p: number; q: number; v: number; rowMin: number[]; colMax: number[]; D: number }

const juego: Formula = {
  id: 'juego-2x2',
  name: 'Juegos de suma cero 2×2: punto silla y estrategia mixta',
  category: 'decisiones',
  latex: L`p^*=\frac{a_{22}-a_{21}}{a_{11}-a_{12}-a_{21}+a_{22}}`,
  forms: [
    { label: 'Estrategia óptima del otro jugador', latex: L`q^*=\frac{a_{22}-a_{12}}{a_{11}-a_{12}-a_{21}+a_{22}}` },
    { label: 'Valor del juego', latex: L`v=\frac{a_{11}a_{22}-a_{12}a_{21}}{a_{11}-a_{12}-a_{21}+a_{22}}` },
    { label: 'Punto silla', latex: L`\max_i\min_ja_{ij}=\min_j\max_ia_{ij}=v` },
  ],
  summary: 'Dos jugadores con intereses opuestos: lo que uno gana lo pierde el otro. ¿Qué estrategia conviene a cada uno?',
  goal: 'Hallar la mejor estrategia (pura o **mixta**, al azar con ciertas probabilidades) de cada jugador y el **valor del juego**: lo que gana en promedio el jugador de los renglones.',
  variables: [
    { symbol: 'a_{ij}', meaning: 'Pago al jugador de los **renglones** (A) cuando A elige su estrategia $i$ y el jugador de las columnas (B) elige $j$. B paga lo mismo' },
    { symbol: 'p^*', meaning: 'Probabilidad con que A debe elegir su estrategia 1 (y $1-p^*$ la 2)' },
    { symbol: 'q^*', meaning: 'Probabilidad con que B debe elegir su estrategia 1' },
    { symbol: 'v', meaning: 'Valor del juego: el pago esperado de A con estrategias óptimas. Si $v>0$ el juego favorece a A' },
  ],
  whenToUse: [
    'Competencia entre dos partes donde lo que gana una lo pierde la otra: precios, publicidad, campañas, deportes.',
    'Se resuelve en dos pasos: buscar un **punto silla** (solución con estrategias puras); si no existe, usar la fórmula de estrategia mixta.',
  ],
  intuition: [
    'A quiere asegurar lo más posible: mira el peor pago de cada renglón y elige el mejor (**maximin**). B hace lo contrario con las columnas (**minimax**). Si los dos números coinciden hay **punto silla**: ninguno quiere cambiar, y la solución es pura.',
    'Si no coinciden, cada jugador puede mejorar **escondiendo** su elección: juega al azar con las probabilidades $p^*$ y $q^*$. Así el rival no puede aprovechar ninguna jugada.',
    'La probabilidad $p^*$ hace que A obtenga **lo mismo** sin importar qué haga B (se igualan los pagos esperados). Eso es lo que muestra la gráfica: el cruce de las dos rectas.',
  ],
  derivation: {
    steps: [
      { label: 'Si A usa la estrategia 1 con probabilidad $p$, su pago esperado contra cada columna es', latex: L`E_1(p)=pa_{11}+(1-p)a_{21}\qquad E_2(p)=pa_{12}+(1-p)a_{22}` },
      { label: 'A elige $p$ para maximizar el **peor** de los dos: se igualan', latex: L`E_1(p)=E_2(p)\ \Rightarrow\ p(a_{11}-a_{21}-a_{12}+a_{22})=a_{22}-a_{21}` },
      { label: 'Despejamos', latex: L`p^*=\frac{a_{22}-a_{21}}{a_{11}-a_{12}-a_{21}+a_{22}}` },
    ],
  },
  calculators: [
    calc<Game>({
      id: 'juego',
      label: 'Resolver el juego',
      example: 'Pagos al jugador A (renglones). Si A elige 1 y B elige 1, A gana 3; si A elige 1 y B elige 2, A pierde 1; etc.',
      inputs: [
        { kind: 'number', id: 'a11', label: 'Pago si A elige 1 y B elige 1', symbol: 'a_{11}', default: 3 },
        { kind: 'number', id: 'a12', label: 'Pago si A elige 1 y B elige 2', symbol: 'a_{12}', default: -1 },
        { kind: 'number', id: 'a21', label: 'Pago si A elige 2 y B elige 1', symbol: 'a_{21}', default: -2 },
        { kind: 'number', id: 'a22', label: 'Pago si A elige 2 y B elige 2', symbol: 'a_{22}', default: 4 },
      ],
      compute: (v) => {
        const a = [[num(v, 'a11'), num(v, 'a12')], [num(v, 'a21'), num(v, 'a22')]]
        const rowMin = a.map(r => Math.min(...r)), colMax = [Math.max(a[0][0], a[1][0]), Math.max(a[0][1], a[1][1])]
        const maximin = Math.max(...rowMin), minimax = Math.min(...colMax)
        const saddle = Math.abs(maximin - minimax) < 1e-9
        const D = a[0][0] - a[0][1] - a[1][0] + a[1][1]
        const row = rowMin[0] >= rowMin[1] ? 0 : 1, col = colMax[0] <= colMax[1] ? 0 : 1
        if (!saddle && Math.abs(D) < 1e-12) fail('Con esos pagos no se puede resolver el juego (denominador 0). Cambia algún número.')
        if (saddle) return { a, maximin, minimax, saddle, row, col, p: row === 0 ? 1 : 0, q: col === 0 ? 1 : 0, v: maximin, rowMin, colMax, D }
        return { a, maximin, minimax, saddle, row, col, p: (a[1][1] - a[1][0]) / D, q: (a[1][1] - a[0][1]) / D, v: (a[0][0] * a[1][1] - a[0][1] * a[1][0]) / D, rowMin, colMax, D }
      },
      steps: (_v, r) => {
        const f = (x: number) => fmt(x)
        const steps: CalcStep[] = [
          { label: 'Matriz de pagos al jugador A (renglones). Al lado, el mínimo de cada renglón y, abajo, el máximo de cada columna', latex: L`\begin{array}{c|rr|r}&B_1&B_2&\text{mín fila}\\A_1&${f(r.a[0][0])}&${f(r.a[0][1])}&${f(r.rowMin[0])}\\A_2&${f(r.a[1][0])}&${f(r.a[1][1])}&${f(r.rowMin[1])}\\\text{máx col}&${f(r.colMax[0])}&${f(r.colMax[1])}&\end{array}` },
          { label: 'A busca el mejor de sus peores casos (maximin); B busca el menor de sus pérdidas máximas (minimax)', latex: L`\text{maximin}=\max\{${f(r.rowMin[0])},${f(r.rowMin[1])}\}=${f(r.maximin)}\qquad\text{minimax}=\min\{${f(r.colMax[0])},${f(r.colMax[1])}\}=${f(r.minimax)}` },
        ]
        if (r.saddle) {
          steps.push({ label: 'Coinciden: hay **punto silla**. La solución es con estrategias puras', latex: L`v=${f(r.v)}\quad\text{A juega }A_${r.row + 1}\quad\text{B juega }B_${r.col + 1}` })
        } else {
          steps.push(
            { label: 'No coinciden: no hay punto silla y hay que **mezclar**. Denominador común', latex: L`D=a_{11}-a_{12}-a_{21}+a_{22}=${f(r.a[0][0])}-${f(r.a[0][1])}-${f(r.a[1][0])}+${f(r.a[1][1])}=${f(r.D)}` },
            { label: 'Probabilidad de que A juegue $A_1$', latex: L`p^*=\frac{a_{22}-a_{21}}{D}=\frac{${f(r.a[1][1])}-${f(r.a[1][0])}}{${f(r.D)}}=${f(r.p)}` },
            { label: 'Probabilidad de que B juegue $B_1$', latex: L`q^*=\frac{a_{22}-a_{12}}{D}=\frac{${f(r.a[1][1])}-${f(r.a[0][1])}}{${f(r.D)}}=${f(r.q)}` },
            { label: 'Valor del juego', latex: L`v=\frac{a_{11}a_{22}-a_{12}a_{21}}{D}=\frac{(${f(r.a[0][0])})(${f(r.a[1][1])})-(${f(r.a[0][1])})(${f(r.a[1][0])})}{${f(r.D)}}=${f(r.v)}` },
            { label: 'Comprobación: A obtiene $v$ contra cualquier columna', latex: L`E_1=${f(r.p)}(${f(r.a[0][0])})+${f(1 - r.p)}(${f(r.a[1][0])})=${f(r.p * r.a[0][0] + (1 - r.p) * r.a[1][0])}\qquad E_2=${f(r.p)}(${f(r.a[0][1])})+${f(1 - r.p)}(${f(r.a[1][1])})=${f(r.p * r.a[0][1] + (1 - r.p) * r.a[1][1])}` },
          )
        }
        return steps
      },
      answer: (_v, r) => r.saddle ? L`v=${fmt(r.v)}\quad\text{(punto silla: }A_${r.row + 1},B_${r.col + 1}\text{)}` : L`v=${fmt(r.v)}\quad p^*=${fmt(r.p)}\quad q^*=${fmt(r.q)}`,
      extras: (_v, r) => r.saddle
        ? [{ label: 'Tipo de solución', latex: L`\text{pura}` }, { label: 'Maximin = minimax', latex: fmt(r.maximin) }]
        : [{ label: 'A juega A₁ con', latex: `${fmt(r.p * 100, 4)}\\%` }, { label: 'B juega B₁ con', latex: `${fmt(r.q * 100, 4)}\\%` }, { label: 'Maximin / minimax', latex: `${fmt(r.maximin)}\\ /\\ ${fmt(r.minimax)}` }],
      interpret: (_v, r) => {
        const side = Math.abs(r.v) < 1e-9 ? 'es **justo**: ninguno tiene ventaja' : r.v > 0 ? `**favorece a A**: A gana en promedio ${fmt(r.v)} por partida` : `**favorece a B**: B gana en promedio ${fmt(-r.v)} por partida`
        return r.saddle
          ? [
            { tone: 'good', text: `Hay **punto silla**: A siempre juega $A_${r.row + 1}$ y B siempre juega $B_${r.col + 1}$. El valor del juego es **${fmt(r.v)}** y ${side}.` },
            { tone: 'info', text: 'En un punto silla ningún jugador gana nada cambiando su estrategia: la solución es estable y no hace falta ser impredecible.' },
          ]
          : [
            { tone: 'good', text: `No hay punto silla, así que ambos deben jugar al azar. A elige $A_1$ con probabilidad **${fmt(r.p * 100, 3)}%** y $A_2$ con ${fmt((1 - r.p) * 100, 3)}%. B elige $B_1$ con **${fmt(r.q * 100, 3)}%** y $B_2$ con ${fmt((1 - r.q) * 100, 3)}%.` },
            { tone: 'info', text: `El juego ${side}. Con estas probabilidades A obtiene $${fmt(r.v)}$ **sin importar** lo que haga B.` },
            { tone: 'info', text: `Sin mezclar, A sólo podría asegurar $${fmt(r.maximin)}$ (maximin): mezclar mejora la garantía hasta $${fmt(r.v)}$.` },
          ]
      },
      visual: (_v, r) => {
        const e1 = (p: number) => p * r.a[0][0] + (1 - p) * r.a[1][0], e2 = (p: number) => p * r.a[0][1] + (1 - p) * r.a[1][1]
        return {
          type: 'plot',
          curves: [
            { points: [[0, e1(0)], [1, e1(1)]], tone: 'a', label: L`\text{Si B juega }B_1` },
            { points: [[0, e2(0)], [1, e2(1)]], tone: 'b', label: L`\text{Si B juega }B_2` },
          ],
          marks: [{ x: r.p, y: r.v, tone: 'warn', label: `p = ${fmt(r.p, 3)}, v = ${fmt(r.v, 3)}` }],
          segments: [{ from: [r.p, Math.min(e1(0), e1(1), e2(0), e2(1))], to: [r.p, r.v], tone: 'warn', dashed: true }],
          xRange: [0, 1],
          caption: 'Pago esperado de A según la probabilidad $p$ de jugar $A_1$ (eje horizontal), contra cada jugada de B. B se queda con la peor de las dos rectas para A; A escoge el $p$ donde esa “peor” es lo más alta posible (punto rojo).',
        }
      },
    }),
  ],
  commonMistakes: [
    'Usar los pagos del jugador equivocado: la matriz da los pagos del jugador de los **renglones**; B paga lo mismo.',
    'Aplicar la fórmula mixta cuando **sí** hay punto silla: primero hay que revisar maximin = minimax.',
    'Olvidar que $p^*$ es la probabilidad de la **primera** estrategia.',
    'Creer que jugar mixto es “indecisión”: es la única forma de no ser explotado cuando no hay punto silla.',
  ],
  related: ['criterios-decision', 'valor-esperado'],
  keywords: ['teoria de juegos', 'juego de suma cero', 'punto silla', 'estrategia mixta', 'maximin', 'minimax', 'valor del juego', 'investigacion de operaciones', 'dos jugadores'],
}

export const DECISIONES: Formula[] = [criterios, valorEsperado, juego]
