import { calc, fail, mat, num, type CalcStep, type Formula, type Values, type VisualSpec } from '../types'
import { fmt } from '../format'
import { L, barsSpec, matrixTex, toneAt } from './oi-comun'
import { solveSimplex, type SCon } from './simplex'

const TOL = 1e-9

// ─── Matriz de resultados ────────────────────────────────────────────────────

interface Matrix { M: number[][]; m: number; n: number }

function readMatrix(v: Values, pfx: string): Matrix {
  const M = mat(v, `${pfx}M`)
  const m = M.length, n = M[0].length
  if (m < 2) fail('Necesitas al menos dos alternativas (renglones).')
  if (n < 2) fail('Necesitas al menos dos estados de la naturaleza (columnas).')
  return { M, m, n }
}

const altNames = (m: number) => Array.from({ length: m }, (_, i) => `A_{${i + 1}}`)
const stateNames = (n: number) => Array.from({ length: n }, (_, j) => `E_{${j + 1}}`)

const argBest = (xs: number[], dir: 1 | -1) => {
  const best = dir === 1 ? Math.max(...xs) : Math.min(...xs)
  return xs.flatMap((x, i) => (Math.abs(x - best) <= TOL * Math.max(1, Math.abs(best)) ? [i] : []))
}
const names = (idx: number[]) => idx.map(i => `A_{${i + 1}}`).join(L`\ \text{o}\ `)

const payInput = (pfx: string, def: number[][], lastRow?: string) => ({
  kind: 'matrix' as const,
  id: `${pfx}M`,
  label: lastRow ? 'Resultados de cada alternativa (renglones) en cada estado de la naturaleza (columnas); el último renglón es la probabilidad de cada estado' : 'Resultados de cada alternativa (renglones) en cada estado de la naturaleza (columnas)',
  symbol: L`M`,
  default: def,
  rowPrefix: 'A',
  colPrefix: 'E',
  corner: 'Resultado',
  lastRow,
  minRows: 2,
  minCols: 2,
  maxRows: 8,
  maxCols: 8,
})

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
      payInput(pfx, gains ? [[200, 100, -50], [120, 90, 30], [50, 50, 50]] : [[20, 35, 60], [30, 32, 40], [45, 45, 45]]),
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
  related: ['valor-esperado', 'juego-matricial'],
  keywords: ['decisiones', 'wald', 'maximin', 'maximax', 'laplace', 'hurwicz', 'savage', 'arrepentimiento', 'incertidumbre', 'teoria de decisiones', 'investigacion de operaciones', 'estados de la naturaleza'],
}

// ─── Valor esperado ──────────────────────────────────────────────────────────

interface Ev { s: 1 | -1; M: number[][]; p: number[]; emv: number[]; best: number[]; bestV: number; evpi: number; evwpi: number; eol: number[] }

function evCompute(v: Values, s: 1 | -1, pfx: string): Ev {
  const T = mat(v, `${pfx}M`)
  const M = T.slice(0, -1), p = T[T.length - 1]
  const n = p.length
  if (M.length < 2) fail('Necesitas al menos dos alternativas (renglones antes del renglón de probabilidades).')
  if (n < 2) fail('Necesitas al menos dos estados de la naturaleza (columnas).')
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
      payInput(pfx, gains ? [[200, 100, -50], [120, 90, 30], [50, 50, 50], [0.3, 0.5, 0.2]] : [[20, 35, 60], [30, 32, 40], [45, 45, 45], [0.3, 0.5, 0.2]], 'Probabilidad'),
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

// ─── Juego de suma cero m×n ──────────────────────────────────────────────────

interface Game {
  A: number[][]
  m: number
  n: number
  rowMin: number[]
  colMax: number[]
  maximin: number
  minimax: number
  saddles: [number, number][]
  p: number[]
  q: number[]
  v: number
  shift: number
  lpX: number[]
  lpY: number[]
}

export function solveGame(A: number[][]): Game {
  const m = A.length, n = A[0].length
  const rowMin = A.map(r => Math.min(...r)), colMax = Array.from({ length: n }, (_, j) => Math.max(...A.map(r => r[j])))
  const maximin = Math.max(...rowMin), minimax = Math.min(...colMax)
  const saddles: [number, number][] = []
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (Math.abs(A[i][j] - rowMin[i]) < 1e-9 && Math.abs(A[i][j] - colMax[j]) < 1e-9) saddles.push([i, j])
  if (saddles.length) {
    const [i, j] = saddles[0]
    return { A, m, n, rowMin, colMax, maximin, minimax, saddles, p: A.map((_, k) => (k === i ? 1 : 0)), q: Array.from({ length: n }, (_, k) => (k === j ? 1 : 0)), v: A[i][j], shift: 0, lpX: [], lpY: [] }
  }
  // sin punto silla: programación lineal. Se suma k para que todos los pagos sean positivos (el valor del juego pasa a ser v + k > 0)
  const mn = Math.min(...A.flat())
  const shift = mn >= 1 ? 0 : 1 - mn
  const cons: SCon[] = Array.from({ length: n }, (_, j) => ({ a: A.map(r => r[j] + shift), op: 1, b: 1 }))
  const sol = solveSimplex('min', new Array(m).fill(1), cons)
  const total = sol.x.reduce((t, x) => t + x, 0)
  const vp = 1 / total
  const p = sol.x.map(x => x * vp)
  const q = sol.duals.map(y => y * vp)
  return { A, m, n, rowMin, colMax, maximin, minimax, saddles, p, q, v: vp - shift, shift, lpX: sol.x, lpY: sol.duals }
}

const juego: Formula = {
  id: 'juego-matricial',
  name: 'Juegos de suma cero: punto silla y estrategias mixtas',
  category: 'decisiones',
  latex: L`\max_i\min_ja_{ij}\ \le\ v\ \le\ \min_j\max_ia_{ij}`,
  forms: [
    { label: 'Punto silla (solución pura)', latex: L`\max_i\min_ja_{ij}=\min_j\max_ia_{ij}=v` },
    { label: 'Pago esperado de A con la mezcla p', latex: L`E(p,j)=\sum_ip_i\,a_{ij}\ \ge v\ \ \text{para toda columna }j` },
    { label: 'Caso 2×2: estrategia de A', latex: L`p^*=\frac{a_{22}-a_{21}}{a_{11}-a_{12}-a_{21}+a_{22}}` },
    { label: 'Caso 2×2: estrategia de B', latex: L`q^*=\frac{a_{22}-a_{12}}{a_{11}-a_{12}-a_{21}+a_{22}}` },
    { label: 'Caso 2×2: valor del juego', latex: L`v=\frac{a_{11}a_{22}-a_{12}a_{21}}{a_{11}-a_{12}-a_{21}+a_{22}}` },
  ],
  summary: 'Dos jugadores con intereses opuestos: lo que uno gana lo pierde el otro. ¿Qué estrategia conviene a cada uno?',
  goal: 'Hallar la mejor estrategia (pura o **mixta**, al azar con ciertas probabilidades) de cada jugador y el **valor del juego**, para una tabla de pagos de **cualquier tamaño**.',
  variables: [
    { symbol: 'a_{ij}', meaning: 'Pago al jugador de los **renglones** (A) cuando A elige su estrategia $i$ y el jugador de las columnas (B) elige $j$. B paga lo mismo' },
    { symbol: 'p_i', meaning: 'Probabilidad con que A debe elegir su estrategia $i$' },
    { symbol: 'q_j', meaning: 'Probabilidad con que B debe elegir su estrategia $j$' },
    { symbol: 'v', meaning: 'Valor del juego: el pago esperado de A con estrategias óptimas. Si $v>0$ el juego favorece a A' },
  ],
  whenToUse: [
    'Competencia entre dos partes donde lo que gana una lo pierde la otra: precios, publicidad, campañas, deportes.',
    'Se resuelve en dos pasos: buscar un **punto silla** (solución con estrategias puras); si no existe, se resuelve con programación lineal (una tabla $m\\times n$ cualquiera).',
  ],
  intuition: [
    'A quiere asegurar lo más posible: mira el peor pago de cada renglón y elige el mejor (**maximin**). B hace lo contrario con las columnas (**minimax**). Si los dos números coinciden hay **punto silla**: ninguno quiere cambiar, y la solución es pura.',
    'Si no coinciden, cada jugador puede mejorar **escondiendo** su elección: juega al azar con las probabilidades $p$ y $q$. Así el rival no puede aprovechar ninguna jugada. El teorema del minimax de von Neumann garantiza que siempre existe una solución así.',
    'Cuando B juega contra la mezcla óptima de A, **todas** las jugadas que B usa en su mezcla le dan a A exactamente $v$; las que B no usa le dan a A más. Eso es lo que muestra la gráfica en el caso $2\\times n$.',
    'La programación lineal sale de pedir que la mezcla $p$ garantice al menos $v$ contra **cada** columna. El problema de A y el de B son duales: por eso los precios sombra del símplex son la estrategia de B.',
  ],
  calculators: [
    calc<Game>({
      id: 'juego',
      label: 'Ejemplo: 2×2',
      example: 'Pagos al jugador A (renglones). Con la tabla de abajo, si A elige 1 y B elige 1, A gana 3; si A elige 1 y B elige 2, A pierde 1. Agrega o quita estrategias con los botones.',
      inputs: [{ kind: 'matrix', id: 'a2', label: 'Pagos al jugador A (renglones = estrategias de A, columnas = estrategias de B)', symbol: 'a_{ij}', default: [[3, -1], [-2, 4]], rowPrefix: 'A', colPrefix: 'B', corner: 'Pago', minRows: 2, minCols: 2, maxRows: 7, maxCols: 7 }],
      compute: (v) => solveGame(mat(v, 'a2')),
      steps: (_v, r) => gameSteps(r),
      answer: (_v, r) => (r.saddles.length ? L`v=${fmt(r.v)}\quad\text{(punto silla)}` : L`v=${fmt(r.v)}`),
      extras: (_v, r) => gameExtras(r),
      interpret: (_v, r) => gameInterpret(r),
      visual: (_v, r) => gameVisual(r),
    }),
    calc<Game>({
      id: 'mxn',
      label: 'Ejemplo: 3×3 (piedra, papel o tijera)',
      example: 'Piedra, papel o tijera: ganar paga 1, perder paga −1 y empatar 0. No hay punto silla; la solución mixta es jugar cada una con probabilidad 1/3.',
      inputs: [{ kind: 'matrix', id: 'a3', label: 'Pagos al jugador A (renglones = estrategias de A, columnas = estrategias de B)', symbol: 'a_{ij}', default: [[0, -1, 1], [1, 0, -1], [-1, 1, 0]], rowPrefix: 'A', colPrefix: 'B', corner: 'Pago', minRows: 2, minCols: 2, maxRows: 7, maxCols: 7 }],
      compute: (v) => solveGame(mat(v, 'a3')),
      steps: (_v, r) => gameSteps(r),
      answer: (_v, r) => (r.saddles.length ? L`v=${fmt(r.v)}\quad\text{(punto silla)}` : L`v=${fmt(r.v)}`),
      extras: (_v, r) => gameExtras(r),
      interpret: (_v, r) => gameInterpret(r),
      visual: (_v, r) => gameVisual(r),
    }),
    calc<Game>({
      id: 'silla',
      label: 'Ejemplo: con punto silla',
      example: 'Aquí el maximin y el minimax coinciden: la solución es pura.',
      inputs: [{ kind: 'matrix', id: 'as', label: 'Pagos al jugador A (renglones = estrategias de A, columnas = estrategias de B)', symbol: 'a_{ij}', default: [[4, 2, 3], [3, 1, 5], [6, 2, 4]], rowPrefix: 'A', colPrefix: 'B', corner: 'Pago', minRows: 2, minCols: 2, maxRows: 7, maxCols: 7 }],
      compute: (v) => solveGame(mat(v, 'as')),
      steps: (_v, r) => gameSteps(r),
      answer: (_v, r) => (r.saddles.length ? L`v=${fmt(r.v)}\quad\text{(punto silla)}` : L`v=${fmt(r.v)}`),
      extras: (_v, r) => gameExtras(r),
      interpret: (_v, r) => gameInterpret(r),
      visual: (_v, r) => gameVisual(r),
    }),
  ],
  commonMistakes: [
    'Usar los pagos del jugador equivocado: la matriz da los pagos del jugador de los **renglones**; B paga lo mismo.',
    'Aplicar una mezcla cuando **sí** hay punto silla: primero hay que revisar maximin = minimax.',
    'Creer que jugar mixto es “indecisión”: es la única forma de no ser explotado cuando no hay punto silla.',
    'Olvidar que las probabilidades de cada jugador suman 1.',
  ],
  related: ['criterios-decision', 'valor-esperado', 'lp-simplex'],
  keywords: ['teoria de juegos', 'juego de suma cero', 'punto silla', 'estrategia mixta', 'maximin', 'minimax', 'valor del juego', 'investigacion de operaciones', 'dos jugadores', 'piedra papel tijera'],
}

function gameSteps(r: Game): CalcStep[] {
  const f = (x: number) => fmt(x)
  const A = r.A.map((_, i) => `A_{${i + 1}}`), B = r.A[0].map((_, j) => `B_{${j + 1}}`)
  const steps: CalcStep[] = [
    {
      label: 'Matriz de pagos al jugador A (renglones). A la derecha, el mínimo de cada renglón; abajo, el máximo de cada columna',
      latex: L`\begin{array}{c|${'r'.repeat(r.n)}|r}&${B.join('&')}&\text{mín fila}\\${r.A.map((row, i) => `${A[i]}&${row.map(f).join('&')}&${f(r.rowMin[i])}`).join(L`\\`)}\\\text{máx col}&${r.colMax.map(f).join('&')}&\end{array}`,
    },
    {
      label: 'A busca el mejor de sus peores casos (maximin); B busca el menor de sus pérdidas máximas (minimax)',
      latex: L`\text{maximin}=\max\{${r.rowMin.map(f).join(',\\ ')}\}=${f(r.maximin)}\qquad\text{minimax}=\min\{${r.colMax.map(f).join(',\\ ')}\}=${f(r.minimax)}`,
    },
  ]
  if (r.saddles.length) {
    steps.push({
      label: `Coinciden: hay **punto silla** en ${r.saddles.map(([i, j]) => `$(A_{${i + 1}},B_{${j + 1}})$`).join(' y ')}. La solución es con estrategias puras`,
      latex: L`v=${f(r.v)}`,
    })
    return steps
  }
  const sh = r.shift
  steps.push({
    label: `No coinciden (${f(r.maximin)} < ${f(r.minimax)}): **no hay punto silla** y hay que mezclar. Se resuelve con programación lineal${sh ? `: primero se suma $k=${f(sh)}$ a todos los pagos para que sean positivos (el valor del juego se corre $k$)` : ''}`,
    latex: L`\min\ \sum_ix_i\quad\text{s.a.}\quad\sum_i(a_{ij}${sh ? `+${f(sh)}` : ''})\,x_i\ge1\ \ (j=1,\ldots,${r.n}),\ \ x_i\ge0`,
  })
  steps.push({
    label: 'Solución del problema lineal (con el método símplex): $x$ y sus precios sombra $y$ (los de las restricciones)',
    latex: L`x=(${r.lpX.map(f).join(',\\ ')})\qquad y=(${r.lpY.map(f).join(',\\ ')})\qquad\sum x=${f(r.lpX.reduce((t, x) => t + x, 0))}`,
  })
  steps.push({
    label: 'Se vuelve a las probabilidades: el valor del juego desplazado es $1/\\sum x$, y se normaliza',
    latex: L`v'=\frac{1}{\sum x}=${f(1 / r.lpX.reduce((t, x) => t + x, 0))}\qquad p=v'x=(${r.p.map(f).join(',\\ ')})\qquad q=v'y=(${r.q.map(f).join(',\\ ')})\qquad v=v'${sh ? `-${f(sh)}` : ''}=${f(r.v)}`,
  })
  if (r.m === 2 && r.n === 2) {
    const D = r.A[0][0] - r.A[0][1] - r.A[1][0] + r.A[1][1]
    steps.push({ label: 'En el caso 2×2 también sale con las fórmulas cerradas (mismo resultado)', latex: L`p^*=\frac{a_{22}-a_{21}}{D}=${f((r.A[1][1] - r.A[1][0]) / D)}\qquad q^*=\frac{a_{22}-a_{12}}{D}=${f((r.A[1][1] - r.A[0][1]) / D)}\qquad D=${f(D)}` })
  }
  const eA = r.A[0].map((_, j) => r.A.reduce((t, row, i) => t + r.p[i] * row[j], 0))
  const eB = r.A.map(row => row.reduce((t, a, j) => t + a * r.q[j], 0))
  steps.push({
    label: 'Comprobación: contra **cada** columna A obtiene al menos $v$, y contra cada renglón B paga como máximo $v$',
    latex: L`\sum_ip_ia_{ij}=(${eA.map(f).join(',\\ ')})\ge${f(r.v)}\qquad\sum_ja_{ij}q_j=(${eB.map(f).join(',\\ ')})\le${f(r.v)}`,
  })
  return steps
}

function gameExtras(r: Game) {
  return [
    { label: 'Estrategia de A', latex: `p=(${r.p.map(x => fmt(x)).join(',\\ ')})` },
    { label: 'Estrategia de B', latex: `q=(${r.q.map(x => fmt(x)).join(',\\ ')})` },
    { label: 'Maximin / minimax', latex: `${fmt(r.maximin)}\\ /\\ ${fmt(r.minimax)}` },
  ]
}

function gameInterpret(r: Game) {
  const side = Math.abs(r.v) < 1e-9 ? 'es **justo**: ninguno tiene ventaja' : r.v > 0 ? `**favorece a A**: A gana en promedio ${fmt(r.v)} por partida` : `**favorece a B**: B gana en promedio ${fmt(-r.v)} por partida`
  const pct = (xs: number[], name: string) => xs.flatMap((x, i) => (x > 1e-9 ? [`$${name}_{${i + 1}}$ con **${fmt(x * 100, 3)}%**`] : [])).join(', ')
  const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = []
  if (r.saddles.length) {
    out.push({ tone: 'good', text: `Hay **punto silla**: A siempre juega $A_{${r.saddles[0][0] + 1}}$ y B siempre juega $B_{${r.saddles[0][1] + 1}}$. El valor del juego es **${fmt(r.v)}** y ${side}.` })
    if (r.saddles.length > 1) out.push({ tone: 'info', text: `Hay ${r.saddles.length} puntos silla con el mismo valor: ${r.saddles.map(([i, j]) => `$(A_{${i + 1}},B_{${j + 1}})$`).join(', ')}.` })
    out.push({ tone: 'info', text: 'En un punto silla ningún jugador gana nada cambiando su estrategia: la solución es estable y no hace falta ser impredecible.' })
  } else {
    out.push({ tone: 'good', text: `No hay punto silla, así que ambos deben jugar al azar. A elige ${pct(r.p, 'A')}. B elige ${pct(r.q, 'B')}.` })
    out.push({ tone: 'info', text: `El juego ${side}. Con esas probabilidades A obtiene al menos $${fmt(r.v)}$ **sin importar** lo que haga B.` })
    out.push({ tone: 'info', text: `Sin mezclar, A sólo podría asegurar $${fmt(r.maximin)}$ (maximin) y B no podría limitar sus pérdidas a menos de $${fmt(r.minimax)}$ (minimax): mezclar cierra esa brecha hasta $${fmt(r.v)}$.` })
  }
  return out
}

function gameVisual(r: Game): VisualSpec | undefined {
  const { A, m, n } = r
  if (m === 2) {
    const lines = Array.from({ length: n }, (_, j) => ({ f: (p: number) => p * A[0][j] + (1 - p) * A[1][j], j }))
    const env = (p: number) => Math.min(...lines.map(l => l.f(p)))
    const pStar = r.p[0]
    const pts = Array.from({ length: 101 }, (_, k) => [k / 100, env(k / 100)] as [number, number])
    const all = lines.flatMap(l => [l.f(0), l.f(1)])
    return {
      type: 'plot',
      curves: [
        ...lines.map((l, k) => ({ points: [[0, l.f(0)], [1, l.f(1)]] as [number, number][], tone: toneAt(k), label: `B_{${l.j + 1}}` })),
        { points: pts, tone: 'warn', dashed: true, label: L`\text{lo que A asegura}` },
      ],
      marks: [{ x: pStar, y: r.v, tone: 'warn', label: `p = ${fmt(pStar, 3)}, v = ${fmt(r.v, 3)}` }],
      xRange: [0, 1],
      yRange: [Math.min(...all) - 0.3, Math.max(...all) + 0.3],
      caption: 'Pago esperado de A según la probabilidad $p$ de jugar $A_1$ (eje horizontal), contra cada jugada de B. B se queda con la peor para A (línea punteada); A escoge el $p$ donde esa “peor” es lo más alta posible (punto rojo).',
    }
  }
  if (n === 2) {
    const lines = Array.from({ length: m }, (_, i) => ({ f: (q: number) => q * A[i][0] + (1 - q) * A[i][1], i }))
    const env = (q: number) => Math.max(...lines.map(l => l.f(q)))
    const pts = Array.from({ length: 101 }, (_, k) => [k / 100, env(k / 100)] as [number, number])
    const all = lines.flatMap(l => [l.f(0), l.f(1)])
    return {
      type: 'plot',
      curves: [
        ...lines.map((l, k) => ({ points: [[0, l.f(0)], [1, l.f(1)]] as [number, number][], tone: toneAt(k), label: `A_{${l.i + 1}}` })),
        { points: pts, tone: 'warn', dashed: true, label: L`\text{lo máximo que B paga}` },
      ],
      marks: [{ x: r.q[0], y: r.v, tone: 'warn', label: `q = ${fmt(r.q[0], 3)}, v = ${fmt(r.v, 3)}` }],
      xRange: [0, 1],
      yRange: [Math.min(...all) - 0.3, Math.max(...all) + 0.3],
      caption: 'Lo que A obtiene según la probabilidad $q$ de que B juegue $B_1$, contra cada jugada de A. A se queda con la mejor para él (línea punteada); B escoge el $q$ donde esa “mejor” es lo más baja posible (punto rojo).',
    }
  }
  return barsSpec([...r.p, ...r.q], [...r.p.map((_, i) => `A${i + 1}`), ...r.q.map((_, j) => `B${j + 1}`)], { caption: 'Probabilidad con que cada jugador debe elegir cada estrategia (A primero, luego B).', format: x => `${fmt(x * 100, 3)}%` })
}

export const DECISIONES: Formula[] = [criterios, valorEsperado, juego]
