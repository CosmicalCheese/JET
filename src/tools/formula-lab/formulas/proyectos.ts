import { calc, fail, mat, num, type Formula } from '../types'
import { fmt, normalCDF, normalInv } from '../format'
import { L } from './oi-comun'

// ─── PERT ────────────────────────────────────────────────────────────────────

interface Act { a: number; m: number; b: number; te: number; v: number }
const toAct = (a: number, m: number, b: number): Act => ({ a, m, b, te: (a + 4 * m + b) / 6, v: ((b - a) / 6) ** 2 })

function checkTimes(a: number, m: number, b: number, label = '') {
  if (a < 0) fail(`${label}La duración optimista no puede ser negativa.`)
  if (!(a <= m && m <= b)) fail(`${label}Debe cumplirse optimista $a\\le$ más probable $m\\le$ pesimista $b$.`)
}

interface PertProj { acts: Act[]; mu: number; var: number; sd: number; z: number; p: number; T0: number; t95: number }

const pert: Formula = {
  id: 'pert',
  name: 'PERT: duración esperada y probabilidad de terminar a tiempo',
  category: 'proyectos',
  latex: L`t_e=\frac{a+4m+b}{6}\qquad\sigma^2=\left(\frac{b-a}{6}\right)^2`,
  forms: [
    { label: 'Duración y varianza de la ruta crítica', latex: L`\mu_T=\sum t_e\qquad\sigma_T^2=\sum\sigma^2` },
    { label: 'Probabilidad de terminar antes del plazo T₀', latex: L`P(T\le T_0)=\Phi\!\left(\frac{T_0-\mu_T}{\sigma_T}\right)` },
    { label: 'Plazo con cierta confianza', latex: L`T_p=\mu_T+z_p\,\sigma_T` },
  ],
  summary: 'Cuando las duraciones son inciertas, se estiman con tres números y se obtiene la **probabilidad** de cumplir el plazo.',
  goal: 'Estimar cuánto durará un proyecto y qué tan probable es terminar antes de una fecha, cuando cada actividad tiene duración incierta.',
  variables: [
    { symbol: 'a', meaning: 'Duración **optimista**: si todo sale perfecto' },
    { symbol: 'm', meaning: 'Duración **más probable** (la moda)' },
    { symbol: 'b', meaning: 'Duración **pesimista**: si todo sale mal (sin catástrofes)' },
    { symbol: 't_e', meaning: 'Duración esperada de la actividad' },
    { symbol: L`\sigma^2`, meaning: 'Varianza de la duración (incertidumbre)' },
    { symbol: L`\mu_T,\ \sigma_T`, meaning: 'Media y desviación de la duración total de la ruta crítica' },
    { symbol: 'T_0', meaning: 'El plazo (fecha límite) que quieres cumplir' },
  ],
  whenToUse: [
    'Proyectos nuevos o de investigación donde no hay datos exactos de duración.',
    'Para contestar: “¿cuál es la probabilidad de terminar en 14 semanas?”.',
    'Primero se encuentra la ruta crítica (con CPM, usando $t_e$ como duración) y luego se aplica la normal a **esa** ruta.',
  ],
  intuition: [
    'Las tres estimaciones dan una forma de campana asimétrica (distribución beta). $t_e$ es un promedio ponderado que da **4 veces más peso** a la estimación más probable.',
    'Si $b-m>m-a$ (el peor caso está más lejos que el mejor) $t_e$ queda **por encima** de $m$: los retrasos pesan más que los adelantos.',
    'La ruta crítica suma muchas actividades independientes, así que por el **teorema central del límite** su duración es aproximadamente normal. Las **varianzas** (no las desviaciones) se suman.',
    'El rango $b-a$ abarca unas 6 desviaciones estándar: de ahí $\\sigma=\\frac{b-a}{6}$.',
  ],
  calculators: [
    calc<Act>({
      id: 'actividad',
      label: 'Una actividad',
      example: 'Una actividad puede durar 2 semanas si todo sale bien, 4 lo más probable y 12 si todo sale mal.',
      inputs: [
        { kind: 'number', id: 'a', label: 'Optimista', symbol: 'a', default: 2 },
        { kind: 'number', id: 'm', label: 'Más probable', symbol: 'm', default: 4 },
        { kind: 'number', id: 'b', label: 'Pesimista', symbol: 'b', default: 12 },
      ],
      compute: (v) => { checkTimes(num(v, 'a'), num(v, 'm'), num(v, 'b')); return toAct(num(v, 'a'), num(v, 'm'), num(v, 'b')) },
      steps: (_v, r) => [
        { label: 'Duración esperada: la estimación más probable pesa 4 veces', latex: L`t_e=\frac{a+4m+b}{6}=\frac{${fmt(r.a)}+4(${fmt(r.m)})+${fmt(r.b)}}{6}=\frac{${fmt(r.a + 4 * r.m + r.b)}}{6}=${fmt(r.te)}` },
        { label: 'Desviación estándar (el rango equivale a unas 6 desviaciones)', latex: L`\sigma=\frac{b-a}{6}=\frac{${fmt(r.b)}-${fmt(r.a)}}{6}=${fmt(Math.sqrt(r.v))}` },
        { label: 'Varianza', latex: L`\sigma^2=\left(\frac{b-a}{6}\right)^2=${fmt(r.v)}` },
      ],
      answer: (_v, r) => L`t_e=${fmt(r.te)}\qquad\sigma=${fmt(Math.sqrt(r.v))}`,
      extras: (_v, r) => [
        { label: 'Varianza', latex: `\\sigma^2=${fmt(r.v)}` },
        { label: 'Promedio sencillo', latex: `\\frac{a+m+b}{3}=${fmt((r.a + r.m + r.b) / 3)}` },
      ],
      interpret: (_v, r) => [
        { tone: 'good', text: `Se espera que la actividad dure **${fmt(r.te, 4)}**, con una incertidumbre de ±${fmt(Math.sqrt(r.v), 3)}.` },
        r.te > r.m + 1e-9
          ? { tone: 'info', text: `$t_e$ ($${fmt(r.te)}$) queda **arriba** de la duración más probable ($${fmt(r.m)}$) porque el peor caso está más lejos que el mejor: los retrasos pesan más.` }
          : r.te < r.m - 1e-9
            ? { tone: 'info', text: `$t_e$ ($${fmt(r.te)}$) queda **debajo** de la más probable ($${fmt(r.m)}$) porque el mejor caso está más lejos que el peor.` }
            : { tone: 'info', text: 'Como las estimaciones son simétricas, $t_e$ coincide con la duración más probable.' },
      ],
      visual: (_v, r) => ({
        type: 'plot',
        curves: [{ points: [[r.a, 0], [r.m, 1], [r.b, 0]], tone: 'a', label: L`\text{Forma aproximada}` }],
        segments: [{ from: [r.te, 0], to: [r.te, 1], tone: 'warn', dashed: true }],
        marks: [{ x: r.te, y: 0.5, tone: 'warn', label: `tₑ = ${fmt(r.te, 3)}` }, { x: r.m, y: 1, tone: 'a', label: `m = ${fmt(r.m)}` }],
        xRange: [r.a - (r.b - r.a) * 0.1, r.b + (r.b - r.a) * 0.1],
        yRange: [0, 1.25],
        hideYTicks: true,
        caption: 'Triángulo con las tres estimaciones (la forma real es una beta, más suave). La línea punteada es la duración esperada: queda hacia el lado más largo.',
      }),
    }),
    calc<PertProj>({
      id: 'proyecto',
      label: 'Ruta crítica del proyecto',
      example: 'La ruta crítica tiene 3 actividades. Escribe en cada renglón las tres estimaciones (optimista, más probable y pesimista) de una actividad de la ruta crítica; agrega o quita renglones con los botones. Plazo: 14 semanas.',
      inputs: [
        { kind: 'matrix', id: 'abm', label: 'Actividades de la ruta crítica (una por renglón)', symbol: L`a,m,b`, default: [[2, 4, 6], [3, 5, 13], [1, 2, 3]], rowPrefix: 'Act ', colNames: ['Optimista a', 'Más probable m', 'Pesimista b'], fixedCols: true, minRows: 1, maxRows: 30 },
        { kind: 'number', id: 'T0', label: 'Plazo que quieres cumplir', symbol: 'T_0', default: 14 },
      ],
      compute: (v) => {
        const table = mat(v, 'abm')
        const acts: Act[] = table.map(([a, m, b], i) => { checkTimes(a, m, b, `Actividad ${i + 1}: `); return toAct(a, m, b) })
        const mu = acts.reduce((s, x) => s + x.te, 0), variance = acts.reduce((s, x) => s + x.v, 0)
        if (!(variance > 0)) fail('Todas las actividades tienen duración exacta ($a=m=b$): no hay incertidumbre y la probabilidad es 0 o 1. Usa CPM.')
        const sd = Math.sqrt(variance), T0 = num(v, 'T0'), z = (T0 - mu) / sd
        return { acts, mu, var: variance, sd, z, p: normalCDF(z), T0, t95: mu + normalInv(0.95) * sd }
      },
      steps: (_v, r) => {
        const rows = r.acts.map((x, i) => L`${i + 1}&${fmt(x.a)}&${fmt(x.m)}&${fmt(x.b)}&${fmt(x.te)}&${fmt(x.v)}`)
        return [
          { label: 'Duración esperada y varianza de cada actividad de la ruta crítica', latex: L`\begin{array}{c|ccc|cc}\text{Act}&a&m&b&t_e&\sigma^2\\${rows.join(L`\\`)}\\\Sigma&&&&${fmt(r.mu)}&${fmt(r.var)}\end{array}` },
          { label: 'Duración esperada del proyecto y desviación (las **varianzas** se suman)', latex: L`\mu_T=${fmt(r.mu)}\qquad\sigma_T=\sqrt{${fmt(r.var)}}=${fmt(r.sd)}` },
          { label: `Estandarizamos el plazo $T_0=${fmt(r.T0)}$`, latex: L`z=\frac{T_0-\mu_T}{\sigma_T}=\frac{${fmt(r.T0)}-${fmt(r.mu)}}{${fmt(r.sd)}}=${fmt(r.z)}` },
          { label: 'Probabilidad con la normal estándar', latex: L`P(T\le${fmt(r.T0)})=\Phi(${fmt(r.z)})=${fmt(r.p)}` },
          { label: 'Plazo con 95% de confianza', latex: L`T_{95}=\mu_T+1.645\,\sigma_T=${fmt(r.mu)}+1.645(${fmt(r.sd)})=${fmt(r.t95)}` },
        ]
      },
      answer: (_v, r) => L`P(T\le${fmt(r.T0)})=${fmt(r.p * 100, 4)}\%`,
      extras: (_v, r) => [
        { label: 'Duración esperada', latex: `\\mu_T=${fmt(r.mu)}` },
        { label: 'Desviación', latex: `\\sigma_T=${fmt(r.sd)}` },
        { label: 'Plazo con 95%', latex: fmt(r.t95) },
      ],
      interpret: (_v, r) => [
        { tone: 'good', text: `Hay una probabilidad de **${fmt(r.p * 100, 3)}%** de terminar en $${fmt(r.T0)}$ o menos. El proyecto durará en promedio $${fmt(r.mu)}$.` },
        r.p < 0.5
          ? { tone: 'warn', text: 'El plazo está por **debajo** de la duración esperada: es más probable incumplir que cumplir. Para tener 95% de confianza necesitas un plazo de $' + fmt(r.t95) + '$.' }
          : { tone: 'info', text: `Para tener **95%** de confianza de cumplir, el plazo debería ser de $${fmt(r.t95)}$.` },
        { tone: 'info', text: 'Cuidado: PERT sólo mira la ruta crítica. Si otra ruta casi igual de larga también tiene incertidumbre, la probabilidad real de cumplir es un poco **menor**.' },
      ],
      visual: (_v, r) => ({ type: 'normal', z: r.z, shade: 'left', label: 'Probabilidad de terminar a tiempo' }),
    }),
  ],
  commonMistakes: [
    'Sumar las **desviaciones** en vez de las varianzas: $\\sigma_T=\\sqrt{\\sum\\sigma^2}$, no $\\sum\\sigma$.',
    'Usar el promedio simple $\\frac{a+m+b}{3}$ en vez de $\\frac{a+4m+b}{6}$.',
    'Incluir en la suma actividades que **no** están en la ruta crítica.',
    'Olvidar que la ruta crítica se determina con $t_e$: una ruta con $t_e$ menor puede tener más varianza.',
  ],
  related: ['cpm', 'puntuacion-z'],
  keywords: ['pert', 'ruta critica', 'tres estimaciones', 'optimista pesimista', 'duracion esperada', 'proyectos', 'investigacion de operaciones', 'beta'],
}

// ─── CPM ─────────────────────────────────────────────────────────────────────

interface Cpm {
  n: number
  d: number[]
  preds: number[][]
  ES: number[]
  EF: number[]
  LS: number[]
  LF: number[]
  slack: number[]
  critical: boolean[]
  duration: number
  paths: number[][]
}

const cpm: Formula = {
  id: 'cpm',
  name: 'CPM: ruta crítica y holguras',
  category: 'proyectos',
  latex: L`EF_i=ES_i+d_i\qquad LS_i=LF_i-d_i`,
  forms: [
    { label: 'Pase hacia adelante', latex: L`ES_j=\max_{i\in\text{pred}(j)}EF_i` },
    { label: 'Pase hacia atrás', latex: L`LF_i=\min_{j\in\text{suc}(i)}LS_j\quad(\text{o la duración del proyecto})` },
    { label: 'Holgura total', latex: L`H_i=LS_i-ES_i=LF_i-EF_i` },
    { label: 'Actividad crítica', latex: L`H_i=0` },
  ],
  summary: 'Encuentra la **ruta más larga** del proyecto: las actividades que no pueden retrasarse sin retrasar todo.',
  goal: 'Saber cuánto dura el proyecto como mínimo, qué actividades son críticas y cuánto se puede retrasar cada una de las demás.',
  variables: [
    { symbol: 'd_i', meaning: 'Duración de la actividad $i$' },
    { symbol: 'ES,\\ EF', meaning: 'Inicio más temprano (*earliest start*) y terminación más temprana' },
    { symbol: 'LS,\\ LF', meaning: 'Inicio más tardío y terminación más tardía **sin retrasar el proyecto**' },
    { symbol: 'H_i', meaning: 'Holgura total: cuánto se puede retrasar la actividad sin alargar el proyecto' },
  ],
  whenToUse: [
    'Proyectos con actividades de duración conocida y relaciones de precedencia.',
    'Para decidir dónde poner recursos: acelerar una actividad **crítica** acorta el proyecto; una con holgura, no.',
    'Si las duraciones son inciertas, calcula primero la ruta crítica con $t_e$ y luego usa PERT.',
  ],
  intuition: [
    '**Hacia adelante**: una actividad no puede empezar hasta que **todas** sus predecesoras terminen, así que $ES$ es el **mayor** $EF$ de ellas. La duración del proyecto es el mayor $EF$ de todas.',
    '**Hacia atrás**: ¿cuál es la última hora a la que puede terminar una actividad sin retrasar a las siguientes? Es el **menor** $LS$ de sus sucesoras.',
    'La **holgura** mide el margen: si $H=0$ no hay margen (crítica). Ojo: la holgura de varias actividades en una misma ruta es **compartida**: usarla en una consume la de las otras.',
    'Las actividades críticas forman un camino continuo del inicio al fin: la **ruta crítica**. Puede haber más de una.',
  ],
  calculators: [
    calc<Cpm>({
      id: 'cpm',
      label: 'Calcular ruta crítica',
      example: 'Cada renglón es una actividad: su duración y hasta tres predecesoras (el **número de renglón** de las actividades que deben terminar antes; 0 = ninguna). Una predecesora debe estar en un renglón anterior. Agrega o quita actividades con los botones.',
      inputs: [
        { kind: 'matrix', id: 'act', label: 'Actividades (una por renglón)', symbol: L`d,p_i`, default: [[3, 0, 0, 0], [4, 1, 0, 0], [2, 1, 0, 0], [5, 2, 0, 0], [3, 3, 0, 0], [2, 4, 5, 0]], rowPrefix: 'Act ', colNames: ['Duración', 'Pred. 1', 'Pred. 2', 'Pred. 3'], fixedCols: true, minRows: 1, maxRows: 40 },
      ],
      compute: (v) => {
        const table = mat(v, 'act')
        const n = table.length
        const d: number[] = [], preds: number[][] = []
        table.forEach((row, i) => {
          const dur = row[0]
          if (dur < 0) fail(`La actividad ${i + 1} tiene duración negativa.`)
          const ps = row.slice(1).filter(p => p !== 0)
          for (const p of ps) {
            if (!Number.isInteger(p) || p < 1 || p >= i + 1) fail(`La actividad ${i + 1} tiene predecesora ${p}: debe ser el número de renglón de una actividad **anterior** (1 a ${i}), o 0 si no tiene.`)
          }
          d.push(dur)
          preds.push([...new Set(ps)].map(p => p - 1))
        })
        const ES = new Array(n).fill(0), EF = new Array(n).fill(0)
        for (let i = 0; i < n; i++) {
          ES[i] = preds[i].length ? Math.max(...preds[i].map(p => EF[p])) : 0
          EF[i] = ES[i] + d[i]
        }
        const duration = Math.max(...EF)
        const succ: number[][] = Array.from({ length: n }, () => [])
        preds.forEach((ps, j) => ps.forEach(p => succ[p].push(j)))
        const LS = new Array(n).fill(0), LF = new Array(n).fill(0)
        for (let i = n - 1; i >= 0; i--) {
          LF[i] = succ[i].length ? Math.min(...succ[i].map(j => LS[j])) : duration
          LS[i] = LF[i] - d[i]
        }
        const slack = ES.map((e: number, i: number) => Math.round((LS[i] - e) * 1e9) / 1e9)
        const critical = slack.map((s: number) => Math.abs(s) < 1e-9)
        const paths: number[][] = []
        const dfs = (i: number, path: number[]) => {
          if (paths.length >= 8) return
          const next = [...path, i]
          const nxt = succ[i].filter(j => critical[j] && Math.abs(ES[j] - EF[i]) < 1e-9)
          if (nxt.length === 0) { if (Math.abs(EF[i] - duration) < 1e-9) paths.push(next); return }
          nxt.forEach(j => dfs(j, next))
        }
        for (let i = 0; i < n; i++) if (critical[i] && preds[i].length === 0 && ES[i] === 0) dfs(i, [])
        return { n, d, preds, ES, EF, LS, LF, slack, critical, duration, paths }
      },
      steps: (_v, r) => {
        const names = Array.from({ length: r.n }, (_, i) => `${i + 1}`)
        const predTxt = (i: number) => (r.preds[i].length ? r.preds[i].map(p => p + 1).join(',') : '-')
        const fwd = names.map((nm, i) => L`${nm}&${predTxt(i)}&${fmt(r.d[i])}&${r.preds[i].length ? `\\max(${r.preds[i].map(p => `EF_{${p + 1}}`).join(',')})=` : ''}${fmt(r.ES[i])}&${fmt(r.ES[i])}+${fmt(r.d[i])}=${fmt(r.EF[i])}`)
        const succ = (i: number) => r.preds.flatMap((ps, j) => (ps.includes(i) ? [j] : []))
        const bwd = names.map((nm, i) => L`${nm}&${succ(i).length ? `\\min(${succ(i).map(j => `LS_{${j + 1}}`).join(',')})=` : `T=`}${fmt(r.LF[i])}&${fmt(r.LF[i])}-${fmt(r.d[i])}=${fmt(r.LS[i])}`)
        const fin = names.map((nm, i) => L`${nm}&${fmt(r.d[i])}&${fmt(r.ES[i])}&${fmt(r.EF[i])}&${fmt(r.LS[i])}&${fmt(r.LF[i])}&${fmt(r.slack[i])}&${r.critical[i] ? L`\text{crítica}` : ''}`)
        return [
          { label: 'Pase **hacia adelante**: $ES$ es el mayor $EF$ de las predecesoras y $EF=ES+d$', latex: L`\begin{array}{c|c|c|r|r}\text{Act}&\text{Pred}&d&ES&EF\\${fwd.join(L`\\`)}\end{array}` },
          { label: `La duración del proyecto es el mayor $EF$: $T=${fmt(r.duration)}$. Pase **hacia atrás**: $LF$ es el menor $LS$ de las sucesoras (o $T$ si no tiene) y $LS=LF-d$`, latex: L`\begin{array}{c|r|r}\text{Act}&LF&LS\\${bwd.join(L`\\`)}\end{array}` },
          { label: 'Holgura $H=LS-ES$. Las actividades con holgura 0 son **críticas**', latex: L`\begin{array}{c|ccccc|c|l}\text{Act}&d&ES&EF&LS&LF&H&\\${fin.join(L`\\`)}\end{array}` },
          { label: r.paths.length > 1 ? 'Rutas críticas (hay más de una)' : 'Ruta crítica: las actividades críticas encadenadas', latex: r.paths.map(p => p.map(i => i + 1).join(L`\to`)).join(L`\qquad`) || L`\text{—}` },
        ]
      },
      answer: (_v, r) => L`T=${fmt(r.duration)}\quad\text{ruta crítica: }${r.paths[0] ? r.paths[0].map(i => i + 1).join(L`\to`) : '—'}`,
      extras: (_v, r) => [
        { label: 'Actividades críticas', latex: r.critical.flatMap((c, i) => (c ? [`${i + 1}`] : [])).join(',\\ ') },
        { label: 'Rutas críticas', latex: `${r.paths.length}` },
        { label: 'Mayor holgura', latex: fmt(Math.max(...r.slack)) },
      ],
      interpret: (_v, r) => {
        const loose = r.slack.flatMap((s, i) => (s > 1e-9 ? [{ i, s }] : []))
        const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
          { tone: 'good', text: `El proyecto dura como mínimo **${fmt(r.duration)}** unidades de tiempo. Las actividades críticas son ${r.critical.flatMap((c, i) => (c ? [`**${i + 1}**`] : [])).join(', ')}: si cualquiera de ellas se retrasa, el proyecto se retrasa lo mismo.` },
        ]
        if (loose.length) out.push({ tone: 'info', text: `Las demás tienen holgura: ${loose.map(x => `la **${x.i + 1}** puede retrasarse hasta $${fmt(x.s)}$`).join('; ')} sin afectar el plazo. Esa holgura es **compartida** con las otras actividades de su misma ruta.` })
        else out.push({ tone: 'info', text: 'Todas las actividades son críticas: el proyecto es una sola cadena.' })
        if (r.paths.length > 1) out.push({ tone: 'warn', text: `Hay **${r.paths.length} rutas críticas**: para acortar el proyecto hay que acelerar una actividad en **cada** una.` })
        out.push({ tone: 'info', text: 'Para acortar el proyecto sólo sirve acelerar actividades críticas; acelerar una con holgura no cambia la duración.' })
        return out
      },
      visual: (_v, r) => ({
        type: 'plot',
        segments: r.d.flatMap((_, i) => {
          const y = r.n - i
          return [
            ...(r.slack[i] > 1e-9 ? [{ from: [r.EF[i], y] as [number, number], to: [r.LF[i], y] as [number, number], tone: 'muted' as const, dashed: true }] : []),
            { from: [r.ES[i], y] as [number, number], to: [r.EF[i], y] as [number, number], tone: r.critical[i] ? 'warn' as const : 'a' as const, label: `${i + 1}` },
          ]
        }),
        xRange: [0, r.duration * 1.03],
        yRange: [0.2, r.n + 0.9],
        hideYTicks: true,
        caption: 'Diagrama de Gantt. Cada barra va de su inicio a su fin más tempranos: en **rojo** las críticas, en azul las que tienen holgura (la línea punteada es la holgura disponible).',
      }),
    }),
  ],
  commonMistakes: [
    'Sumar las duraciones de **todas** las actividades: la duración del proyecto es la de la ruta **más larga**, no la suma.',
    'En el pase hacia adelante, usar la predecesora que termina **antes**: hay que tomar la que termina **después**.',
    'En el pase hacia atrás, tomar el máximo de los $LS$ de las sucesoras: es el **mínimo**.',
    'Pensar que la holgura de cada actividad es independiente: en una misma ruta se comparte.',
  ],
  related: ['pert'],
  keywords: ['cpm', 'ruta critica', 'holgura', 'diagrama de gantt', 'precedencias', 'proyectos', 'investigacion de operaciones', 'camino critico', 'pert'],
}

export const PROYECTOS: Formula[] = [pert, cpm]
