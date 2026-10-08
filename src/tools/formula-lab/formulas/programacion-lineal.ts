import { calc, fail, type CalcStep, type Formula } from '../types'
import { fmt, fp } from '../format'
import {
  L, lin2, lpInputs, lpScene, objective, problemTex, readLP, solveLP,
  type LPProblem, type LPSolution, type Pt,
} from './lp'

const eq = (r: { a1: number; a2: number; b: number }) => `${lin2(r.a1, r.a2)}=${fmt(r.b)}`

// ─── Método gráfico ──────────────────────────────────────────────────────────

interface GraphResult { p: LPProblem; sol: LPSolution; slacks: number[] }

function graphCalc(sense: 'max' | 'min') {
  const prefix = sense
  const isMax = sense === 'max'
  return calc<GraphResult>({
    id: sense,
    label: isMax ? 'Maximizar (restricciones ≤)' : 'Minimizar (restricciones ≥)',
    example: isMax
      ? 'Una fábrica produce dos artículos con ganancias de 3 y 5 por unidad; cada recurso limita la producción. Cada restricción se escribe ⟨a₁, a₂, b⟩ y significa a₁x₁ + a₂x₂ ≤ b. Con ⟨0, 0, 0⟩ no se usa.'
      : 'Una dieta debe cubrir mínimos de nutrientes al menor costo. Cada restricción se escribe ⟨a₁, a₂, b⟩ y significa a₁x₁ + a₂x₂ ≥ b. Con ⟨0, 0, 0⟩ no se usa.',
    inputs: isMax
      ? lpInputs(prefix, [3, 5], [[1, 0, 4], [0, 2, 12], [3, 2, 18]])
      : lpInputs(prefix, [2, 3], [[1, 1, 4], [1, 3, 6], [2, 1, 5]]),
    compute: (v) => {
      const p = readLP(v, prefix, sense)
      const sol = solveLP(p)
      const x = sol.verts[sol.best[0]].x
      return { p, sol, slacks: p.rows.map(r => Math.abs(r.b - (r.a1 * x[0] + r.a2 * x[1]))) }
    },
    steps: (_v, { p, sol }) => {
      const [c1, c2] = p.c
      const best = new Set(sol.best)
      const steps: CalcStep[] = [
        { label: 'Planteamiento del problema', latex: problemTex(p) },
        {
          label: 'Cada desigualdad se convierte en igualdad para obtener su recta frontera (los ejes son $x_1=0$ y $x_2=0$)',
          latex: L`\begin{array}{ll}${p.rows.map(r => `R_${r.i}:&${eq(r)}`).join(L`\\`)}${p.rows.length ? L`\\` : ''}\text{ejes:}&x_1=0,\ x_2=0\end{array}`,
        },
        {
          label: `Los vértices son las intersecciones de dos rectas que además cumplen **todas** las restricciones. De las ${sol.pairs} intersecciones, ${sol.verts.length} son factibles; evaluamos $Z$ en cada una`,
          latex: L`\begin{array}{c|c|l|r|l}\text{Vértice}&(x_1,x_2)&Z=${lin2(c1, c2)}&Z&\\${sol.verts.map((q, k) =>
            L`${q.name}&(${fmt(q.x[0])},\ ${fmt(q.x[1])})&${fp(c1)}(${fmt(q.x[0])})+${fp(c2)}(${fmt(q.x[1])})&${fmt(q.z)}&${best.has(k) ? L`\leftarrow\text{${p.sense === 'max' ? 'mayor' : 'menor'}}` : ''}`).join(L`\\`)}\end{array}`,
        },
        {
          label: `El teorema fundamental dice que, si hay óptimo, está en un vértice. Elegimos el ${p.sense === 'max' ? 'mayor' : 'menor'} valor de $Z$`,
          latex: L`Z^*=${fmt(sol.zStar)}\quad\text{en}\quad ${sol.best.map(k => `${sol.verts[k].name}=(${fmt(sol.verts[k].x[0])},\\ ${fmt(sol.verts[k].x[1])})`).join(L`\ \text{y}\ `)}`,
        },
      ]
      return steps
    },
    answer: (_v, { sol }) => {
      const x = sol.verts[sol.best[0]].x
      return sol.best.length > 1
        ? L`Z^*=${fmt(sol.zStar)}\ \text{(óptimos alternativos)}`
        : L`Z^*=${fmt(sol.zStar)}\quad\text{con}\quad(x_1,x_2)=(${fmt(x[0])},\ ${fmt(x[1])})`
    },
    extras: (_v, { p, sol, slacks }) => {
      const x = sol.verts[sol.best[0]].x
      return [
        { label: 'Solución óptima', latex: L`x_1=${fmt(x[0])},\ x_2=${fmt(x[1])}` },
        { label: isMax ? 'Holguras (recurso que sobra)' : 'Excesos sobre el mínimo', latex: p.rows.map((r, k) => `${isMax ? 's' : 'e'}_${r.i}=${fmt(slacks[k])}`).join(',\\ ') || L`\text{sin restricciones}` },
        { label: 'Vértices factibles', latex: `${sol.verts.length}` },
      ]
    },
    interpret: (_v, { p, sol, slacks }) => {
      const x = sol.verts[sol.best[0]].x
      const binding = p.rows.filter((_, k) => slacks[k] < 1e-9)
      const loose = p.rows.filter((_, k) => slacks[k] >= 1e-9)
      const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
        { tone: 'good', text: `${isMax ? 'La mayor' : 'El menor'} $Z$ posible es **${fmt(sol.zStar)}**${sol.best.length === 1 ? `, y se logra con $x_1=${fmt(x[0])}$, $x_2=${fmt(x[1])}$` : ''}.` },
      ]
      if (sol.best.length > 1) {
        const [a, b] = [sol.verts[sol.best[0]], sol.verts[sol.best[1]]]
        out.push({ tone: 'warn', text: `**Óptimos alternativos**: los vértices ${a.name} y ${b.name} dan el mismo $Z$, y también todos los puntos del segmento que los une. Pasa cuando la recta de $Z$ es paralela a una restricción.` })
      }
      if (binding.length) {
        out.push({
          tone: 'info',
          text: `${binding.length === 1 ? 'La restricción' : 'Las restricciones'} ${binding.map(r => `$R_${r.i}$`).join(' y ')} ${binding.length === 1 ? 'se cumple' : 'se cumplen'} **con igualdad** en el óptimo (${isMax ? 'ese recurso se agota' : 'ese mínimo se cumple justo'}): son las que determinan el óptimo.`,
        })
      }
      if (loose.length) {
        const one = loose.length === 1
        out.push({
          tone: 'info',
          text: `${one ? 'La restricción' : 'Las restricciones'} ${loose.map(r => `$R_${r.i}$`).join(' y ')} ${isMax ? (one ? 'tiene **holgura**: sobra' : 'tienen **holgura**: sobran') : (one ? 'se **supera**:' : 'se **superan**:')} ${loose.map((r) => `$${fmt(Math.abs(r.b - (r.a1 * x[0] + r.a2 * x[1])))}$`).join(' y ')} ${isMax ? 'unidades' : 'unidades de más'}, así que no ${one ? 'limita' : 'limitan'}.`,
        })
      }
      out.push({ tone: 'info', text: 'La recta punteada de $Z$ se desliza en la dirección en que mejora hasta que toca la región por última vez: ese punto de contacto es el óptimo.' })
      return out
    },
    visual: (_v, { p, sol }) => lpScene(p, sol, undefined, `La región verde cumple todas las restricciones a la vez. Los vértices están marcados (en rojo el óptimo) y la recta punteada es $Z=${fmt(sol.zStar)}$.`),
  })
}

const lpGrafico: Formula = {
  id: 'lp-grafico',
  name: 'Programación lineal: método gráfico',
  category: 'programacion-lineal',
  latex: L`\max\ Z=c_1x_1+c_2x_2\quad\text{s.a.}\quad a_{i1}x_1+a_{i2}x_2\le b_i,\ \ x_1,x_2\ge0`,
  forms: [
    { label: 'Minimizar', latex: L`\min\ Z=c_1x_1+c_2x_2\quad\text{s.a.}\quad a_{i1}x_1+a_{i2}x_2\ge b_i` },
    { label: 'Teorema fundamental', latex: L`\text{Si hay solución óptima, existe una en un vértice de la región factible}` },
  ],
  summary: 'Resuelve un problema de dos variables dibujando la región que cumple las restricciones y buscando su mejor vértice.',
  goal: 'Decidir **cuánto** de cada cosa hacer ($x_1$, $x_2$) para obtener la mayor ganancia (o el menor costo) $Z$ sin pasarse de los recursos disponibles.',
  variables: [
    { symbol: 'x_1,\\ x_2', meaning: 'Variables de decisión: cuánto producir, comprar, mezclar…' },
    { symbol: 'Z', meaning: 'Función objetivo: lo que quieres maximizar (ganancia) o minimizar (costo)' },
    { symbol: 'c_1,\\ c_2', meaning: 'Contribución a $Z$ de cada unidad de $x_1$ y de $x_2$' },
    { symbol: 'a_{ij}', meaning: 'Cuánto del recurso $i$ usa cada unidad de la variable $j$' },
    { symbol: 'b_i', meaning: 'Disponibilidad del recurso $i$ (o el mínimo exigido, si la restricción es $\\ge$)' },
    { symbol: 'x_1,x_2\\ge0', meaning: 'Restricción de no negatividad: no se puede producir una cantidad negativa' },
  ],
  whenToUse: [
    'Problemas de **asignación de recursos** con sólo dos variables: mezcla de productos, dietas, publicidad en dos medios…',
    'Para **entender** la programación lineal antes del símplex: la gráfica muestra por qué el óptimo está en una esquina.',
    'Con más de dos variables ya no se puede dibujar; entonces se usa el método símplex.',
  ],
  intuition: [
    'Cada restricción $a_1x_1+a_2x_2\\le b$ parte el plano en dos con una recta y sólo se permite uno de los lados. Las que cumplen **todas** a la vez forman la **región factible**, un polígono.',
    '$Z=c_1x_1+c_2x_2$ es una familia de rectas paralelas, una por cada valor de $Z$. Al aumentar $Z$ la recta se desliza hacia afuera. Quieres la que **todavía toque** la región: ese punto de contacto siempre es un **vértice** (o una arista entera si la recta de $Z$ es paralela a ella).',
    'Por eso basta evaluar $Z$ en los vértices: no hace falta probar los infinitos puntos del interior.',
    'Casos especiales: **sin solución** (región vacía: las restricciones se contradicen) y **no acotado** (la región se extiende sin límite en la dirección en que $Z$ mejora).',
  ],
  derivation: {
    intro: '¿Por qué el óptimo está en un vértice? Dentro de la región, $Z$ es una función lineal, y una función lineal no tiene máximos en el interior:',
    steps: [
      { label: 'Toma un punto interior $P$ y una dirección $\\vec d$ en la que $Z$ sube', latex: L`Z(P+t\vec d)=Z(P)+t\,(\vec c\cdot\vec d)` },
      { label: 'Si $\\vec c\\cdot\\vec d>0$, avanzar siempre mejora $Z$', latex: L`\text{puedes seguir avanzando hasta tocar la frontera}` },
      { label: 'Ya en la frontera (una arista) repites el argumento a lo largo de la arista', latex: L`\text{y avanzas hasta llegar a un vértice}` },
    ],
    outro: 'Si $\\vec c\\cdot\\vec d=0$ a lo largo de una arista, todos sus puntos empatan: óptimos alternativos.',
  },
  calculators: [graphCalc('max'), graphCalc('min')],
  commonMistakes: [
    'Olvidar la no negatividad ($x_1,x_2\\ge0$): la región es sólo el primer cuadrante.',
    'Evaluar $Z$ en una intersección que **no** cumple todas las restricciones: hay que descartarla.',
    'Mezclar los signos: en maximizar las restricciones son $\\le$ (recursos); en minimizar suelen ser $\\ge$ (mínimos).',
    'Pensar que el óptimo siempre es único: si la recta de $Z$ es paralela a una restricción, hay infinitos.',
  ],
  related: ['lp-simplex', 'area-entre-curvas'],
  keywords: ['programacion lineal', 'investigacion de operaciones', 'metodo grafico', 'region factible', 'restricciones', 'funcion objetivo', 'maximizar', 'minimizar', 'optimizacion', 'vertices'],
}

// ─── Símplex ─────────────────────────────────────────────────────────────────

interface Snap { T: number[][]; basis: number[]; enter: number; leave: number; ratios: (number | null)[]; x: Pt }
interface SimplexResult { p: LPProblem; snaps: Snap[]; x: Pt; z: number; duals: number[]; sol: LPSolution }

const BLANK = 1e-9

function runSimplex(p: LPProblem): { snaps: Snap[]; T: number[][]; basis: number[] } {
  const m = p.rows.length, n = 2 + m
  for (const r of p.rows) {
    if (r.b < 0) fail(`La restricción ${r.i} tiene lado derecho negativo. El símplex básico necesita $b\\ge0$ para empezar en el origen; con $b<0$ hay que usar dos fases o el método de la $M$ grande.`)
  }
  const T: number[][] = [[-p.c[0], -p.c[1], ...Array(m).fill(0), 0]]
  p.rows.forEach((r, k) => T.push([r.a1, r.a2, ...Array.from({ length: m }, (_, j) => (j === k ? 1 : 0)), r.b]))
  const basis = Array.from({ length: m }, (_, k) => 2 + k)
  const snaps: Snap[] = []
  const xNow = (): Pt => {
    const val = (k: number) => { const row = basis.indexOf(k); return row < 0 ? 0 : T[row + 1][n] }
    return [val(0), val(1)]
  }
  for (let iter = 0; iter < 60; iter++) {
    let enter = -1, low = -BLANK
    for (let j = 0; j < n; j++) if (T[0][j] < low) { low = T[0][j]; enter = j }
    if (enter < 0) { snaps.push({ T: T.map(r => [...r]), basis: [...basis], enter: -1, leave: -1, ratios: [], x: xNow() }); return { snaps, T, basis } }
    const ratios = T.slice(1).map(r => (r[enter] > BLANK ? r[n] / r[enter] : null))
    let leave = -1
    ratios.forEach((q, i) => {
      if (q === null) return
      if (leave < 0 || q < (ratios[leave - 1] as number) - BLANK || (Math.abs(q - (ratios[leave - 1] as number)) <= BLANK && basis[i] < basis[leave - 1])) leave = i + 1
    })
    if (leave < 0) fail('Todos los números de la columna que entra son $\\le0$: la variable puede crecer sin límite sin romper ninguna restricción, así que $Z$ **no está acotado** (no hay máximo).')
    snaps.push({ T: T.map(r => [...r]), basis: [...basis], enter, leave, ratios, x: xNow() })
    const piv = T[leave][enter]
    T[leave] = T[leave].map(v => v / piv)
    for (let i = 0; i < T.length; i++) {
      if (i === leave) continue
      const f = T[i][enter]
      if (f !== 0) T[i] = T[i].map((v, j) => v - f * T[leave][j])
    }
    basis[leave - 1] = enter
  }
  return fail('El método no terminó en 60 iteraciones (posible ciclo por degeneración). Cambia ligeramente los datos.')
}

const cleanNum = (x: number) => (Math.abs(x) < 1e-10 ? 0 : x)

function tableauTex(p: LPProblem, s: Snap, boxed: boolean): string {
  const n = 2 + p.rows.length
  const names = ['x_1', 'x_2', ...p.rows.map(r => `s_${r.i}`)]
  const cell = (v: number, i: number, j: number) => (boxed && i === s.leave && j === s.enter ? L`\boxed{${fmt(cleanNum(v))}}` : fmt(cleanNum(v)))
  const head = [L`\text{Base}`, ...names, L`\text{LD}`].join('&')
  const z = ['Z', ...s.T[0].map((v, j) => cell(v, 0, j))].join('&')
  const rows = s.T.slice(1).map((r, i) => [names[s.basis[i]], ...r.map((v, j) => cell(v, i + 1, j))].join('&'))
  return L`\begin{array}{c|${'r'.repeat(n)}|r}${head}\\${z}\\${rows.join(L`\\`)}\end{array}`
}

const lpSimplex: Formula = {
  id: 'lp-simplex',
  name: 'Método símplex (tabla)',
  category: 'programacion-lineal',
  latex: L`\theta=\min_i\left\{\frac{b_i}{a_{ik}}\ :\ a_{ik}>0\right\}`,
  forms: [
    { label: 'Forma estándar (se agrega una holgura por restricción)', latex: L`a_{i1}x_1+a_{i2}x_2+s_i=b_i,\qquad x_1,x_2,s_i\ge0` },
    { label: 'Fila Z inicial', latex: L`Z-c_1x_1-c_2x_2=0\ \Rightarrow\ \text{fila }Z:\ (-c_1,\ -c_2,\ 0,\ldots)` },
    { label: 'Condición de optimalidad', latex: L`\text{Todos los números de la fila }Z\ \ge0` },
    { label: 'Precio sombra', latex: L`y_i=\text{valor bajo }s_i\text{ en la fila }Z\text{ final}` },
  ],
  summary: 'Recorre los vértices de la región factible, de uno en uno y siempre mejorando $Z$, hasta que ya no se puede mejorar.',
  goal: 'Resolver problemas de programación lineal de **cualquier tamaño** con una receta mecánica de tablas. Aquí se muestran las tablas de un problema con dos variables y hasta tres restricciones $\\le$.',
  variables: [
    { symbol: 's_i', meaning: 'Variable de **holgura**: cuánto sobra del recurso $i$. Convierte $\\le$ en $=$.' },
    { symbol: 'LD', meaning: 'Lado derecho: valores actuales de las variables básicas (y de $Z$ en la fila $Z$)' },
    { symbol: 'a_{ik}', meaning: 'Elemento de la columna que entra ($k$), en el renglón $i$' },
    { symbol: L`\theta`, meaning: 'Razón mínima: cuánto puede crecer la variable que entra antes de que otra llegue a 0' },
    { symbol: 'y_i', meaning: 'Precio sombra de la restricción $i$' },
  ],
  whenToUse: [
    'Problemas de programación lineal con más de dos variables (donde ya no se puede graficar).',
    'Cuando necesitas los **precios sombra** (cuánto vale una unidad extra de cada recurso).',
    'Esta calculadora cubre el caso estándar: **maximizar** con restricciones $\\le$ y lados derechos $b\\ge0$.',
  ],
  intuition: [
    'Empieza en el origen (no producir nada) y pregunta: ¿qué variable, si la aumento, mejora más $Z$? Esa **entra**. Se aumenta hasta que alguna restricción se agota: esa variable **sale**.',
    'Cada tabla es un vértice de la región factible, y cada pivote es un paso a un vértice vecino con mejor $Z$. Mira la gráfica: el recorrido sigue las aristas.',
    'La **razón mínima** protege la factibilidad: hay que detenerse en la primera restricción que se agota, o alguna variable quedaría negativa.',
    'Cuando todos los números de la fila $Z$ son $\\ge0$, ninguna variable puede mejorar $Z$: se llegó al óptimo.',
    'Los números de la fila $Z$ bajo las holguras son los **precios sombra**: cuánto aumenta $Z$ por cada unidad extra de ese recurso (mientras el conjunto de restricciones activas no cambie).',
  ],
  calculators: [
    calc<SimplexResult>({
      id: 'simplex',
      label: 'Maximizar (restricciones ≤)',
      example: 'El mismo problema de la fábrica. Cada restricción se escribe ⟨a₁, a₂, b⟩ y significa a₁x₁ + a₂x₂ ≤ b, con $b\\ge0$. Con ⟨0, 0, 0⟩ no se usa.',
      inputs: lpInputs('simplex', [3, 5], [[1, 0, 4], [0, 2, 12], [3, 2, 18]]),
      compute: (v) => {
        const p = readLP(v, 'simplex', 'max')
        const { snaps, T, basis } = runSimplex(p)
        const n = 2 + p.rows.length
        const val = (k: number) => { const row = basis.indexOf(k); return row < 0 ? 0 : cleanNum(T[row + 1][n]) }
        const duals = p.rows.map((_, k) => cleanNum(T[0][2 + k]))
        return { p, snaps, x: [val(0), val(1)], z: cleanNum(T[0][n]), duals, sol: solveLP(p) }
      },
      steps: (_v, r) => {
        const { p, snaps } = r
        const steps: CalcStep[] = [
          { label: 'Planteamiento', latex: problemTex(p) },
          {
            label: 'Forma estándar: sumamos una variable de holgura $s_i$ a cada restricción y escribimos $Z-c_1x_1-c_2x_2=0$',
            latex: L`\begin{array}{l}Z${p.c[0] === 0 ? '' : `${p.c[0] > 0 ? '-' : '+'}${Math.abs(p.c[0]) === 1 ? '' : fmt(Math.abs(p.c[0]))}x_1`}${p.c[1] === 0 ? '' : `${p.c[1] > 0 ? '-' : '+'}${Math.abs(p.c[1]) === 1 ? '' : fmt(Math.abs(p.c[1]))}x_2`}=0\\${p.rows.map(q => `${lin2(q.a1, q.a2)}+s_${q.i}=${fmt(q.b)}`).join(L`\\`)}\end{array}`,
          },
        ]
        snaps.forEach((s, k) => {
          const names = ['x_1', 'x_2', ...p.rows.map(q => `s_${q.i}`)]
          if (s.enter < 0) {
            steps.push({
              label: k === 0 ? 'Tabla inicial: ya no hay números negativos en la fila $Z$' : `Tabla ${k}: todos los números de la fila $Z$ son $\\ge0$, **no se puede mejorar más**: óptimo`,
              latex: tableauTex(p, s, false),
            })
          } else {
            const ratioTxt = s.ratios.map((q, i) => (q === null ? null : `${fmt(s.T[i + 1][2 + p.rows.length])}/${fmt(s.T[i + 1][s.enter])}=${fmt(q)}`)).filter(Boolean).join(',\\ ')
            steps.push({
              label: `${k === 0 ? 'Tabla inicial (el origen)' : `Tabla ${k}`}. Entra $${names[s.enter]}$ (el número más negativo de la fila $Z$: $${fmt(s.T[0][s.enter])}$). Razones $b_i/a_{ik}$: $${ratioTxt}$; la menor es la del renglón de $${names[s.basis[s.leave - 1]]}$, que **sale**. El pivote es el número en el recuadro`,
              latex: tableauTex(p, s, true),
            })
          }
        })
        return steps
      },
      answer: (_v, r) => L`Z^*=${fmt(r.z)}\quad\text{con}\quad x_1=${fmt(r.x[0])},\ x_2=${fmt(r.x[1])}`,
      extras: (_v, r) => [
        { label: 'Precios sombra', latex: r.p.rows.length ? r.p.rows.map((q, k) => `y_${q.i}=${fmt(r.duals[k])}`).join(',\\ ') : L`\text{sin restricciones}` },
        { label: 'Tablas', latex: `${r.snaps.length}` },
        { label: 'Pivotes', latex: `${r.snaps.length - 1}` },
      ],
      interpret: (_v, r) => {
        const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
          { tone: 'good', text: `El máximo es $Z^*=${fmt(r.z)}$, con $x_1=${fmt(r.x[0])}$ y $x_2=${fmt(r.x[1])}$. Se llegó en **${r.snaps.length - 1}** ${r.snaps.length - 1 === 1 ? 'pivote' : 'pivotes'}.` },
        ]
        const useful = r.p.rows.filter((_, k) => r.duals[k] > 1e-9)
        const useless = r.p.rows.filter((_, k) => r.duals[k] <= 1e-9)
        if (useful.length) {
          out.push({
            tone: 'info',
            text: `**Precios sombra**: ${useful.map(q => `una unidad más de $b_${q.i}$ aumenta $Z$ en $${fmt(r.duals[r.p.rows.indexOf(q)])}$`).join('; ')}. Es lo máximo que valdría la pena pagar por conseguir esa unidad extra (mientras las mismas restricciones sigan siendo las activas).`,
          })
        }
        if (useless.length) {
          out.push({ tone: 'info', text: `${useless.map(q => `$R_${q.i}$`).join(' y ')} ${useless.length === 1 ? 'tiene' : 'tienen'} precio sombra 0: ${useless.length === 1 ? 'no se agota' : 'no se agotan'}, así que más recurso ahí no sirve de nada.` })
        }
        return out
      },
      visual: (_v, r) => lpScene(r.p, r.sol, r.snaps.map(s => ({ x: s.x, z: objective(r.p, s.x) })), 'El símplex empieza en el origen y salta de vértice en vértice por las aristas de la región, mejorando $Z$ en cada salto, hasta el óptimo (rojo).'),
    }),
  ],
  commonMistakes: [
    'Elegir como variable de salida la de **mayor** razón: hay que tomar la **menor** razón positiva.',
    'Calcular razones con números negativos o cero en la columna que entra: esos renglones se ignoran.',
    'Olvidar cambiar los signos de $c$ al pasar a la fila $Z$: la fila empieza con $-c_j$.',
    'Parar antes de tiempo: el óptimo es cuando **ningún** número de la fila $Z$ es negativo.',
    'Interpretar los precios sombra como válidos para cualquier cambio: sólo valen para cambios pequeños.',
  ],
  related: ['lp-grafico'],
  keywords: ['simplex', 'metodo simplex', 'tabla simplex', 'programacion lineal', 'holgura', 'precio sombra', 'dual', 'pivote', 'investigacion de operaciones'],
}

export const PROGRAMACION_LINEAL: Formula[] = [lpGrafico, lpSimplex]
