import { calc, fail, num, type CalcStep, type Formula, type Values } from '../types'
import { fmt, fp } from '../format'
import { L, barsSpec } from './oi-comun'
import { lin2, lpInputs, lpScene, opTex, problemTex, readLP, solveLP, type LPProblem, type LPSolution, type Op } from './lp'
import { solveSimplex, type SCon, type SimplexSol, type Snap } from './simplex'

const eq = (r: { a1: number; a2: number; b: number }) => `${lin2(r.a1, r.a2)}=${fmt(r.b)}`

/** c₁x₁ + c₂x₂ + … en LaTeX (para cualquier número de variables) */
function linN(c: number[]): string {
  const terms: string[] = []
  c.forEach((a, j) => {
    if (a === 0) return
    const mag = Math.abs(a) === 1 ? '' : fmt(Math.abs(a))
    terms.push(`${a < 0 ? '-' : terms.length ? '+' : ''}${mag}x_{${j + 1}}`)
  })
  return terms.length ? terms.join('') : '0'
}

// ─── Método gráfico ──────────────────────────────────────────────────────────

interface GraphResult { p: LPProblem; sol: LPSolution; slacks: number[] }

function graphCalc(id: string, label: string, example: string, sense: 1 | -1, c: number[], rows: number[][]) {
  return calc<GraphResult>({
    id,
    label,
    example,
    inputs: lpInputs(id, sense, c, rows),
    compute: (v) => {
      const p = readLP(v, id)
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
          label: 'Cada restricción se convierte en igualdad para obtener su recta frontera (los ejes son $x_1=0$ y $x_2=0$)',
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
        { label: 'Holgura / exceso de cada restricción', latex: p.rows.map((r, k) => `${r.op === 1 ? 'e' : 's'}_${r.i}=${fmt(slacks[k])}`).join(',\\ ') || L`\text{sin restricciones}` },
        { label: 'Vértices factibles', latex: `${sol.verts.length}` },
      ]
    },
    interpret: (_v, { p, sol, slacks }) => {
      const x = sol.verts[sol.best[0]].x
      const binding = p.rows.filter((_, k) => slacks[k] < 1e-9)
      const loose = p.rows.filter((_, k) => slacks[k] >= 1e-9)
      const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
        { tone: 'good', text: `${p.sense === 'max' ? 'La mayor' : 'El menor'} $Z$ posible es **${fmt(sol.zStar)}**${sol.best.length === 1 ? `, y se logra con $x_1=${fmt(x[0])}$, $x_2=${fmt(x[1])}$` : ''}.` },
      ]
      if (sol.best.length > 1) {
        const [a, b] = [sol.verts[sol.best[0]], sol.verts[sol.best[1]]]
        out.push({ tone: 'warn', text: `**Óptimos alternativos**: los vértices ${a.name} y ${b.name} dan el mismo $Z$, y también todos los puntos del segmento que los une. Pasa cuando la recta de $Z$ es paralela a una restricción.` })
      }
      if (binding.length) {
        out.push({
          tone: 'info',
          text: `${binding.length === 1 ? 'La restricción' : 'Las restricciones'} ${binding.map(r => `$R_${r.i}$`).join(' y ')} ${binding.length === 1 ? 'se cumple' : 'se cumplen'} **con igualdad** en el óptimo (están “activas”): ${binding.length === 1 ? 'es la que determina' : 'son las que determinan'} el óptimo. En una restricción $\\le$ eso significa que el recurso se agota.`,
        })
      }
      if (loose.length) {
        const one = loose.length === 1
        out.push({
          tone: 'info',
          text: `${one ? 'La restricción' : 'Las restricciones'} ${loose.map(r => `$R_${r.i}$`).join(' y ')} ${one ? 'tiene' : 'tienen'} **margen**: ${one ? 'sobra' : 'sobran'} ${loose.map((r) => `$${fmt(Math.abs(r.b - (r.a1 * x[0] + r.a2 * x[1])))}$`).join(' y ')} unidades, así que no ${one ? 'limita' : 'limitan'}.`,
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
    { label: 'Teorema fundamental', latex: L`\text{Si hay solución óptima, existe una en un vértice}` },
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
    'Puedes poner tantas restricciones como quieras (botón **+ Fila**) y cada una puede ser $\\le$, $=$ o $\\ge$.',
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
  calculators: [
    graphCalc('grafico', 'Ejemplo: fábrica (maximizar)', 'Una fábrica produce dos artículos con ganancias de 3 y 5 por unidad; cada recurso limita la producción. Cada renglón de la tabla es una restricción: coeficientes de $x_1$ y $x_2$, sentido (≤, = o ≥) y lado derecho. Agrega o quita renglones con los botones.', 1, [3, 5], [[1, 0, -1, 4], [0, 2, -1, 12], [3, 2, -1, 18]]),
    graphCalc('dieta', 'Ejemplo: dieta (minimizar)', 'Una dieta debe cubrir mínimos de nutrientes al menor costo, así que las restricciones son ≥.', -1, [2, 3], [[1, 1, 1, 4], [1, 3, 1, 6], [2, 1, 1, 5]]),
  ],
  commonMistakes: [
    'Olvidar la no negatividad ($x_1,x_2\\ge0$): la región es sólo el primer cuadrante.',
    'Evaluar $Z$ en una intersección que **no** cumple todas las restricciones: hay que descartarla.',
    'Mezclar los signos: en maximizar las restricciones suelen ser $\\le$ (recursos); en minimizar suelen ser $\\ge$ (mínimos).',
    'Pensar que el óptimo siempre es único: si la recta de $Z$ es paralela a una restricción, hay infinitos.',
  ],
  related: ['lp-simplex', 'area-entre-curvas'],
  keywords: ['programacion lineal', 'investigacion de operaciones', 'metodo grafico', 'region factible', 'restricciones', 'funcion objetivo', 'maximizar', 'minimizar', 'optimizacion', 'vertices'],
}

// ─── Símplex general ─────────────────────────────────────────────────────────

interface GenResult { sol: SimplexSol; cons: SCon[]; c: number[]; p2: LPProblem | null; geo: LPSolution | null }

function readGeneral(v: Values, prefix: string): { sense: 'max' | 'min'; c: number[]; cons: SCon[] } {
  const sense = num(v, `${prefix}.sense`) === -1 ? 'min' : 'max'
  const table = v[`${prefix}.rows`] as number[][]
  const c = v[`${prefix}.c`] as number[]
  const n = table[0].length - 2
  if (n < 1) fail('La tabla necesita al menos una columna de variables.')
  if (c.length !== n) fail(`La tabla tiene ${n} variable${n === 1 ? '' : 's'} (x₁…x${n}), así que escribe ${n} coeficiente${n === 1 ? '' : 's'} en la función objetivo (escribiste ${c.length}). Si agregas una columna a la tabla, agrega su coeficiente aquí.`)
  const cons: SCon[] = []
  table.forEach((r, k) => {
    const a = r.slice(0, n), op = r[n], b = r[n + 1]
    if (a.every(x => x === 0)) {
      if (b === 0) return
      fail(`La restricción R${k + 1} no tiene variables. Si no la quieres usar, déjala en ceros o quítala.`)
    }
    cons.push({ a, op: (op === 0 ? 0 : op < 0 ? -1 : 1) as Op, b })
  })
  if (cons.length === 0) fail('Escribe al menos una restricción.')
  return { sense, c, cons }
}

function generalInputs(prefix: string, sense: 1 | -1, c: number[], rows: number[][]) {
  return [
    { kind: 'select' as const, id: `${prefix}.sense`, label: 'Objetivo', symbol: 'Z', default: sense, options: [{ value: 1, label: 'Maximizar' }, { value: -1, label: 'Minimizar' }] },
    { kind: 'list' as const, id: `${prefix}.c`, label: 'Función objetivo: coeficientes c₁, c₂, … de cada variable', symbol: 'Z', default: c },
    {
      kind: 'matrix' as const, id: `${prefix}.rows`, label: 'Restricciones (un renglón por restricción)', symbol: 'R', default: rows,
      rowPrefix: 'R', colPrefix: 'x', senseCol: true, lastCol: 'Lado derecho', minRows: 1, minCols: 1, maxRows: 10, maxCols: 12,
    },
  ]
}

function tableauTex(s: Snap, boxed: boolean): string {
  const cols = s.names.length
  const cell = (v: number, i: number, j: number) => {
    const x = Math.abs(v) < 1e-10 ? 0 : v
    return boxed && i === s.leave && j === s.enter ? L`\boxed{${fmt(x)}}` : fmt(x)
  }
  const head = [L`\text{Base}`, ...s.names, L`\text{LD}`].join('&')
  const z = [s.phase === 1 ? 'W' : 'Z', ...s.T[0].map((v, j) => cell(v, 0, j))].join('&')
  const rows = s.T.slice(1).map((r, i) => [s.names[s.basis[i]], ...r.map((v, j) => cell(v, i + 1, j))].join('&'))
  return L`\begin{array}{c|${'r'.repeat(cols)}|r}${head}\\${z}\\${rows.join(L`\\`)}\end{array}`
}

function generalCalc(id: string, label: string, example: string, sense: 1 | -1, c: number[], rows: number[][]) {
  return calc<GenResult>({
    id,
    label,
    example,
    inputs: generalInputs(id, sense, c, rows),
    compute: (v) => {
      const { sense: sn, c: cc, cons } = readGeneral(v, id)
      const sol = solveSimplex(sn, cc, cons)
      let p2: LPProblem | null = null, geo: LPSolution | null = null
      if (cc.length === 2) {
        p2 = { sense: sn, c: [cc[0], cc[1]], rows: cons.map((k, i) => ({ a1: k.a[0], a2: k.a[1], b: k.b, op: k.op, i: i + 1 })) }
        try { geo = solveLP(p2) } catch { p2 = null }
      }
      return { sol, cons, c: cc, p2, geo }
    },
    steps: (_v, r) => {
      const { sol, cons } = r
      const n = sol.n
      const steps: CalcStep[] = [
        {
          label: 'Planteamiento',
          latex: L`${'\\' + sol.sense}\ Z=${linN(r.c)}\quad\text{s.a.}\quad\begin{cases}${cons.map(k => `${linN(k.a)}${opTex(k.op)}${fmt(k.b)}`).join(L`\\`)}\\x_1,\ldots,x_{${n}}\ge0\end{cases}`,
        },
        {
          label: 'Forma estándar: cada $\\le$ lleva una variable de **holgura** $s_i$ (suma lo que sobra); cada $\\ge$ lleva una de **exceso** $e_i$ (resta lo que sobra) y una **artificial** $R_i$; cada $=$ lleva sólo una artificial' + (sol.std.some(q => q.flipped) ? '. Los renglones con lado derecho negativo se multiplicaron por $-1$' : ''),
          latex: L`\begin{array}{l}${sol.std.map(q => `${linN(q.a)}${q.extra ? `${q.extra.startsWith('s') ? '+' : '-'}${q.extra}` : ''}${q.art ? `+${q.art}` : ''}=${fmt(q.b)}`).join(L`\\`)}\end{array}`,
        },
      ]
      const cnt = { 1: 0, 2: 0 }
      sol.snaps.forEach((s) => {
        cnt[s.phase]++
        const k = cnt[s.phase]
        const phase = sol.phase1 ? `Fase ${s.phase === 1 ? 'I' : 'II'}, tabla ${k}` : `Tabla ${k}`
        if (s.phase === 2 && k === 1 && sol.phase1) {
          steps.push({
            label: `La Fase I terminó con $W=0$: ya hay una solución factible${sol.redundant.length ? ` (la restricción ${sol.redundant.join(', ')} era redundante y se eliminó)` : ''}. Se quitan las columnas artificiales y se vuelve a la función objetivo real`,
            latex: L`W=0\ \Rightarrow\ \text{Fase II}`,
          })
        }
        if (s.phase === 1 && k === 1) {
          steps.push({ label: '**Fase I**: se minimiza la suma de las artificiales $W=\\sum R_i$ para encontrar una solución factible. Si $W$ no llega a 0, el problema no tiene solución', latex: L`\min W=${sol.std.filter(q => q.art).map(q => q.art).join('+')}` })
        }
        if (s.enter < 0) {
          steps.push({ label: `${phase}: ${s.phase === 1 ? 'ya no hay números negativos en el renglón $W$: fin de la Fase I' : 'todos los números del renglón $Z$ son $\\ge0$, **no se puede mejorar más**: óptimo'}`, latex: tableauTex(s, false) })
        } else {
          const rt = s.ratios.map((q, i) => (q === null ? null : `${fmt(s.T[i + 1][s.T[0].length - 1])}/${fmt(s.T[i + 1][s.enter])}=${fmt(q)}`)).filter(Boolean).join(',\\ ')
          steps.push({
            label: `${phase}. Entra $${s.names[s.enter]}$ (el número más negativo del renglón ${s.phase === 1 ? '$W$' : '$Z$'}: $${fmt(s.T[0][s.enter])}$). Razones $b_i/a_{ik}$: $${rt}$; la menor es la del renglón de $${s.names[s.basis[s.leave - 1]]}$, que **sale**. El pivote es el número en el recuadro`,
            latex: tableauTex(s, true),
          })
        }
      })
      return steps
    },
    answer: (_v, r) => L`Z^*=${fmt(r.sol.Z)}\quad\text{con}\quad ${r.sol.x.map((q, j) => `x_{${j + 1}}=${fmt(q)}`).join(',\\ ')}`,
    extras: (_v, r) => {
      const { sol } = r
      return [
        { label: 'Precios sombra (por unidad de lado derecho)', latex: sol.duals.map((y, i) => `y_{${i + 1}}=${fmt(y)}`).join(',\\ ') },
        { label: 'Holgura / exceso', latex: sol.slack.map((x, i) => `${sol.std[i]?.extra?.[0] ?? 's'}_{${i + 1}}=${fmt(x)}`).join(',\\ ') },
        { label: 'Costos reducidos', latex: sol.reduced.map((x, j) => `d_{${j + 1}}=${fmt(x)}`).join(',\\ ') },
        { label: 'Tablas', latex: `${sol.snaps.length}` },
      ]
    },
    interpret: (_v, r) => {
      const { sol, cons } = r
      const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
        { tone: 'good', text: `${sol.sense === 'max' ? 'El máximo' : 'El mínimo'} es $Z^*=${fmt(sol.Z)}$, con ${sol.x.map((q, j) => `$x_{${j + 1}}=${fmt(q)}$`).join(', ')}.` },
      ]
      const active = cons.flatMap((_, i) => (sol.slack[i] === 0 ? [i + 1] : []))
      const loose = cons.flatMap((_, i) => (sol.slack[i] > 0 ? [i] : []))
      if (active.length) out.push({ tone: 'info', text: `${active.length === 1 ? 'La restricción' : 'Las restricciones'} ${active.map(i => `$R_${i}$`).join(', ')} ${active.length === 1 ? 'se cumple' : 'se cumplen'} **con igualdad** en el óptimo (activas): ${active.length === 1 ? 'es la que limita' : 'son las que limitan'} el resultado.` })
      if (loose.length) out.push({ tone: 'info', text: `${loose.map(i => `$R_${i + 1}$ tiene ${cons[i].op === 1 ? 'un exceso' : 'una holgura'} de $${fmt(sol.slack[i])}$`).join('; ')}: no limita${loose.length > 1 ? 'n' : ''}, así que su precio sombra es 0.` })
      const pri = cons.flatMap((_, i) => (Math.abs(sol.duals[i]) > 1e-9 ? [i] : []))
      pri.forEach(i => {
        const [lo, hi] = sol.rhsRange[i]
        const fx = (x: number) => (x === Infinity ? '\\infty' : x === -Infinity ? '-\\infty' : fmt(x))
        out.push({ tone: 'info', text: `**Precio sombra de $R_${i + 1}$**: cada unidad más de su lado derecho ${sol.duals[i] > 0 ? 'aumenta' : 'disminuye'} $Z$ en $${fmt(Math.abs(sol.duals[i]))}$. Vale mientras el lado derecho se mantenga entre $${fx(lo)}$ y $${fx(hi)}$.` })
      })
      if (sol.alt) out.push({ tone: 'warn', text: '**Óptimos alternativos**: hay una variable fuera de la base con costo reducido 0 en la tabla final. Puede entrar sin cambiar $Z$, así que hay más de una solución con el mismo valor.' })
      if (sol.degenerate) out.push({ tone: 'info', text: 'La solución es **degenerada**: alguna variable básica vale 0. No cambia el resultado, pero el símplex puede dar pivotes que no mejoran $Z$.' })
      if (sol.redundant.length) out.push({ tone: 'info', text: `La restricción ${sol.redundant.join(', ')} es **redundante** (se deduce de las demás): no afecta el problema.` })
      return out
    },
    visual: (_v, r) => {
      if (r.p2 && r.geo) {
        const path = r.sol.snaps.filter(s => s.phase === 2).map(s => ({ x: [s.x[0], s.x[1]] as [number, number], z: 0 }))
        const uniq = path.filter((q, i) => i === 0 || Math.hypot(q.x[0] - path[i - 1].x[0], q.x[1] - path[i - 1].x[1]) > 1e-9)
        return lpScene(r.p2, r.geo, uniq.length > 1 ? uniq : undefined, 'La región verde cumple todas las restricciones. Los puntos numerados son los vértices que visita el símplex en la Fase II, mejorando $Z$ en cada salto hasta el óptimo (rojo).')
      }
      return barsSpec(r.sol.x, r.sol.x.map((_, j) => `x${j + 1}`), { caption: 'Valor de cada variable de decisión en la solución óptima.' })
    },
  })
}

const lpSimplex: Formula = {
  id: 'lp-simplex',
  name: 'Método símplex (dos fases)',
  category: 'programacion-lineal',
  latex: L`\theta=\min_i\left\{\frac{b_i}{a_{ik}}\ :\ a_{ik}>0\right\}`,
  forms: [
    { label: 'Forma estándar', latex: L`\sum_ja_{ij}x_j+s_i=b_i\quad(\le)\qquad\sum_ja_{ij}x_j-e_i+R_i=b_i\quad(\ge)` },
    { label: 'Renglón Z inicial', latex: L`Z-c_1x_1-\cdots-c_nx_n=0\ \Rightarrow\ \text{renglón }Z:\ (-c_1,\ldots,-c_n,0,\ldots)` },
    { label: 'Condición de optimalidad', latex: L`\text{Todos los números del renglón }Z\ \ge0` },
    { label: 'Fase I', latex: L`\min\ W=\sum R_i\ \Rightarrow\ \text{si }W>0,\ \text{no hay solución}` },
    { label: 'Precio sombra', latex: L`y_i=\dfrac{\partial Z^*}{\partial b_i}` },
  ],
  summary: 'Resuelve **cualquier** problema de programación lineal (cualquier número de variables y restricciones $\\le$, $=$, $\\ge$), saltando de vértice en vértice sin dejar de mejorar.',
  goal: 'Optimizar una función lineal sujeta a restricciones lineales cuando el problema es demasiado grande para dibujarlo. Aquí **tú escribes tu propio problema** en la tabla: agrega variables (columnas) y restricciones (renglones).',
  variables: [
    { symbol: 's_i', meaning: 'Variable de **holgura**: lo que sobra de un recurso en una restricción $\\le$' },
    { symbol: 'e_i', meaning: 'Variable de **exceso**: lo que sobra por encima del mínimo en una restricción $\\ge$' },
    { symbol: 'R_i', meaning: 'Variable **artificial**: un “andamio” que permite arrancar cuando no basta con holguras (restricciones $\\ge$ y $=$). Debe terminar en 0' },
    { symbol: 'LD', meaning: 'Lado derecho: valores actuales de las variables básicas (y de $Z$ en el renglón $Z$)' },
    { symbol: L`\theta`, meaning: 'Razón mínima: cuánto puede crecer la variable que entra antes de que otra llegue a 0' },
    { symbol: 'y_i', meaning: 'Precio sombra de la restricción $i$: cuánto cambia $Z$ por cada unidad más de $b_i$' },
  ],
  whenToUse: [
    'Problemas con tres o más variables (donde ya no se puede graficar).',
    'Con restricciones $\\ge$ o $=$, el método necesita la **Fase I** para encontrar un primer punto factible.',
    'Cuando necesitas los **precios sombra** y sus rangos (análisis de sensibilidad): cuánto vale un recurso extra.',
  ],
  intuition: [
    'Empieza en un vértice factible (el origen si todas son $\\le$) y pregunta: ¿qué variable, si la aumento, mejora más $Z$? Esa **entra**. Se aumenta hasta que alguna restricción se agota: esa variable **sale**.',
    'Cada tabla es un vértice de la región factible, y cada pivote es un paso a un vértice vecino con mejor $Z$. Con dos variables la gráfica muestra el recorrido.',
    'La **razón mínima** protege la factibilidad: hay que detenerse en la primera restricción que se agota, o alguna variable quedaría negativa.',
    '**Fase I**: si el origen no es factible (por restricciones $\\ge$ o $=$), se agregan variables artificiales $R_i$ y se minimiza su suma. Si llega a 0, ya hay un vértice factible desde donde arrancar la Fase II; si no, el problema es **infactible**.',
    'Cuando todos los números del renglón $Z$ son $\\ge0$, ninguna variable puede mejorar $Z$: óptimo. Si una variable fuera de la base tiene 0 ahí, hay **óptimos alternativos**.',
  ],
  calculators: [
    generalCalc('simplex', 'Ejemplo: fábrica (≤)', 'El problema de la fábrica con dos productos. Las restricciones son ≤ con lado derecho positivo, así que se arranca desde el origen.', 1, [3, 5], [[1, 0, -1, 4], [0, 2, -1, 12], [3, 2, -1, 18]]),
    generalCalc('dosfases', 'Ejemplo: con = y ≥ (dos fases)', 'Minimizar con una restricción = y otra ≥: el origen no es factible, así que se necesita la Fase I.', -1, [4, 1], [[3, 1, 0, 3], [4, 3, 1, 6], [1, 2, -1, 4]]),
    generalCalc('tres', 'Ejemplo: tres variables', 'Tres productos y tres recursos: con tres variables ya no se puede graficar.', 1, [3, 2, 5], [[1, 2, 1, -1, 430], [3, 0, 2, -1, 460], [1, 4, 0, -1, 420]]),
  ],
  commonMistakes: [
    'Elegir como variable de salida la de **mayor** razón: hay que tomar la **menor** razón positiva.',
    'Calcular razones con números negativos o cero en la columna que entra: esos renglones se ignoran.',
    'Olvidar cambiar los signos de $c$ al pasar al renglón $Z$: empieza con $-c_j$.',
    'Parar antes de tiempo: el óptimo es cuando **ningún** número del renglón $Z$ es negativo.',
    'En un problema de minimizar, olvidar que el símplex internamente maximiza $-Z$ (por eso aquí el resultado se reporta con su signo correcto).',
    'Aplicar los precios sombra fuera de su rango: sólo valen mientras la base final siga siendo la misma.',
  ],
  related: ['lp-grafico', 'transporte', 'juego-matricial'],
  keywords: ['simplex', 'metodo simplex', 'dos fases', 'fase I', 'gran m', 'programacion lineal', 'holgura', 'precio sombra', 'dual', 'sensibilidad', 'pivote', 'investigacion de operaciones'],
}

export const PROGRAMACION_LINEAL: Formula[] = [lpGrafico, lpSimplex]
