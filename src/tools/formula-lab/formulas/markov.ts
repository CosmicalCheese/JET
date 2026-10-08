import { calc, fail, list, num, type Formula, type Values } from '../types'
import { fmt } from '../format'
import { L, barsSpec, matrixTex, solveLinear, squareMatrix, toneAt } from './oi-comun'

function readP(v: Values, id: string): number[][] {
  const P = squareMatrix(list(v, id), 'La matriz de transición P', 2, 6)
  P.forEach((row, i) => {
    if (row.some(x => x < 0 || x > 1 + 1e-9)) fail(`El renglón ${i + 1} tiene probabilidades fuera del rango 0 a 1.`)
    const s = row.reduce((t, x) => t + x, 0)
    if (Math.abs(s - 1) > 1e-6) fail(`El renglón ${i + 1} suma ${fmt(s)}: cada renglón de $P$ debe sumar **1** (de cada estado se pasa a alguno de los estados).`)
  })
  return P
}

const mul = (p: number[], P: number[][]) => P[0].map((_, j) => p.reduce((t, x, i) => t + x * P[i][j], 0))

function stationary(P: number[][]): number[] {
  const n = P.length
  // (Pᵀ − I)π = 0 con la última ecuación cambiada por Σπ = 1
  const A = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => P[i][j] - (i === j ? 1 : 0)))
  A[n - 1] = new Array(n).fill(1)
  const b = new Array(n).fill(0)
  b[n - 1] = 1
  const pi = solveLinear(A, b)
  if (!pi) fail('La cadena **no** tiene una única distribución estable: hay estados que no se comunican (por ejemplo, un estado absorbente o dos grupos separados), y el largo plazo depende de dónde empiezas.')
  if (pi.some(x => x < -1e-9)) fail('La distribución que sale no es válida (negativos): la cadena no es ergódica (tiene estados transitorios o periodicidad).')
  return pi.map(x => (Math.abs(x) < 1e-12 ? 0 : x))
}

const pInput = (def: number[]) => ({ kind: 'list' as const, id: 'P', label: 'Matriz de transición P (n×n, un renglón tras otro)', symbol: L`P`, default: def })
const P3 = [0.7, 0.2, 0.1, 0.3, 0.5, 0.2, 0.2, 0.3, 0.5]
const stateNames = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1}`)

interface Stat { P: number[][]; pi: number[]; back: number[] }
interface Steps { P: number[][]; hist: number[][]; n: number; stat: number[] | null }

const markov: Formula = {
  id: 'cadenas-markov',
  name: 'Cadenas de Markov: estado estable y n pasos',
  category: 'markov',
  latex: L`\pi P=\pi\qquad\sum_i\pi_i=1`,
  forms: [
    { label: 'Distribución después de n pasos', latex: L`p^{(n)}=p^{(0)}P^{\,n}` },
    { label: 'Ecuaciones de Chapman–Kolmogorov', latex: L`P^{(m+n)}=P^{(m)}P^{(n)}` },
    { label: 'Cadena de dos estados', latex: L`\pi=\left(\frac{p_{21}}{p_{12}+p_{21}},\ \frac{p_{12}}{p_{12}+p_{21}}\right)` },
    { label: 'Tiempo medio de regreso a un estado', latex: L`\mu_i=\frac{1}{\pi_i}` },
  ],
  summary: 'Un sistema que cambia de estado al azar, donde el siguiente estado sólo depende del estado **actual**.',
  goal: 'Predecir a qué estados tiende un sistema con el tiempo: el clima, la participación de mercado de marcas, el estado de una máquina, un cliente que cambia de proveedor.',
  variables: [
    { symbol: 'P', meaning: 'Matriz de transición: $p_{ij}$ es la probabilidad de pasar del estado $i$ al $j$ en un paso. Cada **renglón suma 1**' },
    { symbol: L`p^{(n)}`, meaning: 'Vector de probabilidades de estar en cada estado después de $n$ pasos' },
    { symbol: L`\pi`, meaning: 'Distribución **estable** (o estacionaria): el reparto al que tiende el sistema a largo plazo' },
    { symbol: L`\mu_i`, meaning: 'Pasos promedio para regresar al estado $i$ cuando se parte de él' },
  ],
  whenToUse: [
    'Procesos donde basta conocer el estado de hoy para predecir mañana (propiedad de **Markov**): “sin memoria”.',
    'Para **participación de mercado** a largo plazo, confiabilidad de equipos, análisis de inventarios o de clientes.',
    'Requiere que todos los estados se puedan alcanzar entre sí (cadena **ergódica**) para que exista un único estado estable.',
  ],
  intuition: [
    'Multiplicar el vector de probabilidades por $P$ avanza un paso. Repitiendo muchas veces, el resultado se **estabiliza** en $\\pi$, sin importar el punto de partida (si la cadena es ergódica).',
    'En el estado estable el flujo que entra a cada estado **iguala** al que sale: por eso $\\pi P=\\pi$. Es un punto fijo, y se obtiene resolviendo ese sistema junto con $\\sum\\pi_i=1$.',
    'Lo que importa no es dónde empiezas sino la matriz: dos puntos de partida distintos llegan al mismo $\\pi$. Cuánto tardan depende de qué tan “mezcladora” sea $P$.',
    '$\\pi_i$ también es la fracción del tiempo que pasas en el estado $i$ a largo plazo, y $1/\\pi_i$ cada cuántos pasos regresas a él.',
  ],
  calculators: [
    calc<Stat>({
      id: 'estable',
      label: 'Estado estable',
      example: 'Clima de una ciudad: soleado, nublado y lluvioso (en ese orden). Si hoy está soleado, mañana lo estará con probabilidad 0.7, etc.',
      inputs: [pInput(P3)],
      compute: (v) => {
        const P = readP(v, 'P')
        const pi = stationary(P)
        return { P, pi, back: pi.map(x => 1 / x) }
      },
      steps: (_v, r) => {
        const n = r.P.length, f = (x: number) => fmt(x)
        const eqs = Array.from({ length: n }, (_, j) => `\\pi_${j + 1}=${r.P.map((row, i) => `${f(row[j])}\\pi_${i + 1}`).join('+')}`)
        return [
          { label: 'Matriz de transición (cada renglón suma 1)', latex: matrixTex(r.P, f, stateNames(n).map(s => `\\text{de }${s}`), stateNames(n).map(s => `\\text{a }${s}`)) },
          { label: 'Estado estable: $\\pi P=\\pi$. Cada $\\pi_j$ es lo que entra a $j$ desde todos los estados', latex: L`\begin{array}{l}${eqs.join(L`\\`)}\end{array}` },
          { label: 'Una de esas ecuaciones sobra (son dependientes): la cambiamos por $\\sum\\pi_i=1$ y resolvemos', latex: L`\pi_1+\cdots+\pi_${n}=1\ \Rightarrow\ \pi=(${r.pi.map(f).join(',\\ ')})` },
          { label: 'Comprobación: $\\pi P=\\pi$', latex: L`\pi P=(${mul(r.pi, r.P).map(f).join(',\\ ')})=\pi` },
          { label: 'Tiempo medio de regreso a cada estado $=1/\\pi_i$', latex: L`\mu=(${r.back.map(f).join(',\\ ')})` },
        ]
      },
      answer: (_v, r) => L`\pi=(${r.pi.map(x => fmt(x)).join(',\\ ')})`,
      extras: (_v, r) => r.pi.map((x, i) => ({ label: `Estado ${i + 1}`, latex: `${fmt(x * 100, 4)}\\%` })),
      interpret: (_v, r) => {
        const top = r.pi.indexOf(Math.max(...r.pi))
        return [
          { tone: 'good', text: `A largo plazo el sistema pasa ${r.pi.map((x, i) => `**${fmt(x * 100, 3)}%** del tiempo en el estado ${i + 1}`).join(', ')}. El estado más frecuente es el **${top + 1}**.` },
          { tone: 'info', text: `En promedio, el sistema regresa al estado ${top + 1} cada $${fmt(r.back[top], 3)}$ pasos (el inverso de su probabilidad).` },
          { tone: 'info', text: 'Este reparto **no depende** de dónde empiece el sistema: es el mismo si hoy está soleado o lluvioso (siempre que la cadena sea ergódica).' },
        ]
      },
      visual: (_v, r) => barsSpec(r.pi, r.pi.map((_, i) => `E${i + 1}`), { highlight: [r.pi.indexOf(Math.max(...r.pi))], format: x => `${fmt(x * 100, 3)}%`, caption: 'Distribución estable: la fracción del tiempo que el sistema pasa en cada estado a largo plazo (en rojo el más frecuente).' }),
    }),
    calc<Steps>({
      id: 'pasos',
      label: 'Después de n pasos',
      example: 'Si hoy está soleado, ¿qué probabilidad hay de cada tipo de clima dentro de 5 días?',
      inputs: [
        pInput(P3),
        { kind: 'list', id: 'p0', label: 'Distribución inicial p⁽⁰⁾ (probabilidad de empezar en cada estado)', symbol: L`p^{(0)}`, default: [1, 0, 0] },
        { kind: 'number', id: 'n', label: 'Número de pasos', symbol: 'n', default: 5 },
      ],
      compute: (v) => {
        const P = readP(v, 'P')
        const p0 = list(v, 'p0'), n = num(v, 'n')
        if (p0.length !== P.length) fail(`La distribución inicial debe tener ${P.length} números (uno por estado) y escribiste ${p0.length}.`)
        if (p0.some(x => x < 0) || Math.abs(p0.reduce((t, x) => t + x, 0) - 1) > 1e-6) fail('La distribución inicial debe tener probabilidades no negativas que sumen 1.')
        if (!Number.isInteger(n) || n < 0 || n > 500) fail('El número de pasos debe ser un entero entre 0 y 500.')
        const hist = [p0]
        for (let k = 0; k < Math.max(n, 30); k++) hist.push(mul(hist[k], P))
        let stat: number[] | null = null
        try { stat = stationary(P) } catch { stat = null }
        return { P, hist, n, stat }
      },
      steps: (_v, r) => {
        const f = (x: number) => fmt(x)
        const n = r.P.length
        const show = r.n <= 8 ? Array.from({ length: r.n + 1 }, (_, k) => k) : [0, 1, 2, 3, r.n - 1, r.n]
        const rows = show.map(k => `${k}&${r.hist[k].map(f).join('&')}`)
        return [
          { label: 'Cada paso es multiplicar el vector de probabilidades por la matriz: $p^{(k+1)}=p^{(k)}P$', latex: L`p^{(k+1)}_j=\sum_ip^{(k)}_i\,p_{ij}` },
          { label: r.n > 8 ? 'Distribuciones paso a paso (se muestran los primeros pasos y los últimos)' : 'Distribuciones paso a paso', latex: L`\begin{array}{c|${'r'.repeat(n)}}k&${stateNames(n).map(s => `E_{${s}}`).join('&')}\\${rows.join(L`\\`)}\end{array}` },
          { label: `Después de ${r.n} pasos`, latex: L`p^{(${r.n})}=(${r.hist[r.n].map(f).join(',\\ ')})` },
          ...(r.stat ? [{ label: 'Distribución estable (a la que tiende)', latex: L`\pi=(${r.stat.map(f).join(',\\ ')})` }] : []),
        ]
      },
      answer: (_v, r) => L`p^{(${r.n})}=(${r.hist[r.n].map(x => fmt(x)).join(',\\ ')})`,
      extras: (_v, r) => r.hist[r.n].map((x, i) => ({ label: `Estado ${i + 1} en el paso ${r.n}`, latex: `${fmt(x * 100, 4)}\\%` })),
      interpret: (_v, r) => {
        const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
          { tone: 'good', text: `Después de $${r.n}$ pasos, las probabilidades son ${r.hist[r.n].map((x, i) => `**${fmt(x * 100, 3)}%** en el estado ${i + 1}`).join(', ')}.` },
        ]
        if (r.stat) {
          const dist = Math.max(...r.hist[r.n].map((x, i) => Math.abs(x - r.stat![i])))
          out.push(dist < 1e-3
            ? { tone: 'info', text: 'Ya prácticamente alcanzó la **distribución estable**: cambiar el número de pasos casi no cambiaría nada.' }
            : { tone: 'info', text: `Todavía está a $${fmt(dist, 3)}$ de la distribución estable (la gráfica muestra cómo se acerca).` })
        }
        return out
      },
      visual: (_v, r) => {
        const K = Math.min(Math.max(r.n * 1.6, 12), 60)
        return {
          type: 'plot',
          curves: r.P.map((_, i) => ({ points: r.hist.slice(0, Math.ceil(K) + 1).map((p, k) => [k, p[i]] as [number, number]), tone: toneAt(i), label: `E_{${i + 1}}` })),
          segments: [{ from: [r.n, 0], to: [r.n, 1], tone: 'warn', dashed: true }],
          xRange: [0, Math.ceil(K)],
          yRange: [0, 1.02],
          caption: 'Probabilidad de estar en cada estado en cada paso. Las curvas se aplanan al acercarse a la distribución estable; la línea punteada es el paso que pediste.',
        }
      },
    }),
  ],
  commonMistakes: [
    'Que un renglón de $P$ no sume 1 (las **columnas** no tienen que sumar 1).',
    'Multiplicar $P\\cdot p$ en vez de $p\\cdot P$: el vector inicial va como **renglón** y a la izquierda.',
    'Confundir $\\pi$ con $p^{(n)}$: $\\pi$ es el límite cuando $n\\to\\infty$.',
    'Esperar un único estado estable si hay **estados absorbentes** (de los que no se sale) o grupos de estados separados.',
  ],
  related: ['mm1', 'criterios-decision'],
  keywords: ['markov', 'cadenas de markov', 'matriz de transicion', 'estado estable', 'distribucion estacionaria', 'participacion de mercado', 'procesos estocasticos', 'investigacion de operaciones', 'probabilidad'],
}

export const MARKOV: Formula[] = [markov]
