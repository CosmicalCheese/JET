import { calc, fail, num, pairs, type Formula, type Values } from '../types'
import { fmt, normalCDF, normalInv } from '../format'
import { L, close, robustRange, sample } from './calculo-comun'

function positive(v: Values, id: string, name: string) {
  if (!(num(v, id) > 0)) fail(`${name} debe ser mayor que 0.`)
}

const dInput = { kind: 'number' as const, id: 'D', label: 'Demanda anual', symbol: 'D', default: 1000, unit: 'unidades/año' }
const sInput = { kind: 'number' as const, id: 'S', label: 'Costo de hacer un pedido', symbol: 'S', default: 50, unit: '$/pedido' }
const hInput = { kind: 'number' as const, id: 'H', label: 'Costo de mantener una unidad un año', symbol: 'H', default: 2, unit: '$/unidad·año' }
const diasInput = { kind: 'number' as const, id: 'dias', label: 'Días de operación al año', symbol: L`\text{días}`, default: 365, unit: 'días' }

// ─── Lote económico (EOQ) ────────────────────────────────────────────────────

interface EoqResult { Q: number; N: number; T: number; days: number; order: number; hold: number; TC: number; purchase: number; H: number }

function eoqCompute(D: number, S: number, H: number, dias: number, C = 0): EoqResult {
  const Q = Math.sqrt((2 * D * S) / H)
  const order = (D / Q) * S, hold = (Q / 2) * H
  return { Q, N: D / Q, T: Q / D, days: (Q / D) * dias, order, hold, TC: order + hold + D * C, purchase: D * C, H }
}

function costCurves(D: number, S: number, H: number, Q: number, mark?: number) {
  const lo = Math.max(Q * 0.15, 1e-6), hi = Q * 2.4
  const total = (q: number) => (D / q) * S + (q / 2) * H
  const tcs = sample(total, lo, hi, 200)
  return {
    type: 'plot' as const,
    curves: [
      { points: sample(q => (D / q) * S, lo, hi, 200), tone: 'b' as const, label: L`\text{Pedir: }\frac{D}{Q}S` },
      { points: sample(q => (q / 2) * H, lo, hi, 200), tone: 'warn' as const, label: L`\text{Mantener: }\frac{Q}{2}H` },
      { points: tcs, tone: 'a' as const, label: L`\text{Total}` },
    ],
    segments: [{ from: [Q, 0] as [number, number], to: [Q, total(Q)] as [number, number], tone: 'accent' as const, dashed: true }],
    marks: [
      { x: Q, y: total(Q), tone: 'accent' as const, label: `Q* = ${fmt(Q, 4)}` },
      ...(mark !== undefined ? [{ x: mark, y: total(mark), tone: 'warn' as const, label: `Q = ${fmt(mark)}` }] : []),
    ],
    xRange: [lo, hi] as [number, number],
    yRange: robustRange([...tcs.map(p => p[1]), 0]),
    caption: 'Pedir mucho **sube** el costo de mantener; pedir poco **sube** el de pedir. El total es mínimo justo donde se cruzan las dos curvas.',
  }
}

const eoq: Formula = {
  id: 'eoq',
  name: 'Lote económico de pedido (EOQ)',
  category: 'inventarios',
  latex: L`Q^*=\sqrt{\frac{2DS}{H}}`,
  forms: [
    { label: 'Costo anual total', latex: L`TC(Q)=\frac{D}{Q}S+\frac{Q}{2}H` },
    { label: 'Costo mínimo', latex: L`TC^*=\sqrt{2DSH}` },
    { label: 'Pedidos por año y tiempo entre pedidos', latex: L`N=\frac{D}{Q^*}\qquad T=\frac{Q^*}{D}` },
    { label: 'Con costo unitario C y tasa de mantener i', latex: L`H=iC` },
  ],
  summary: 'Cuánto pedir cada vez para que el costo de pedir y el de almacenar, juntos, sea el menor posible.',
  goal: 'Encontrar el tamaño de pedido $Q^*$ que **minimiza el costo anual de inventario** cuando la demanda es constante y conocida, el pedido llega completo de golpe y no se permiten faltantes.',
  variables: [
    { symbol: 'D', meaning: 'Demanda anual (unidades por año)' },
    { symbol: 'S', meaning: 'Costo fijo de **hacer un pedido** (papeleo, transporte, preparación), sin importar el tamaño' },
    { symbol: 'H', meaning: 'Costo de **mantener** una unidad en inventario durante un año (almacén, seguros, capital inmovilizado). Suele ser $H = iC$' },
    { symbol: 'C,\\ i', meaning: 'Costo unitario del artículo y tasa anual de mantener (por ejemplo, $i=20\\%$)' },
    { symbol: 'Q^*', meaning: 'Tamaño óptimo de pedido (el “lote económico”)' },
    { symbol: 'N,\\ T', meaning: 'Pedidos por año y tiempo entre pedidos' },
  ],
  whenToUse: [
    'Demanda **constante** y conocida, entrega inmediata del lote completo y sin faltantes.',
    'Para decidir cuántas unidades pedir de un artículo de almacén: tornillos, medicinas, papel…',
    'Si fabricas el lote poco a poco (no llega de golpe), usa el modelo de **producción** (EPQ). Si aceptas faltantes, el modelo con **faltantes**.',
  ],
  intuition: [
    'Pedir **poco** y seguido: el inventario es bajo (poco costo de mantener) pero haces muchos pedidos (mucho costo de pedir). Pedir **mucho** y de vez en cuando: pocos pedidos, pero el almacén se llena.',
    'El inventario promedio es $\\frac Q2$ (baja de $Q$ a 0 de forma pareja), por eso el costo de mantener es $\\frac Q2H$. Se hacen $\\frac DQ$ pedidos al año, de ahí $\\frac DQS$.',
    'El costo total es mínimo donde las dos partes **son iguales**: $\\frac DQS=\\frac Q2H$. Despejando sale la fórmula.',
    'La curva del costo total es muy **plana** cerca del mínimo: equivocarte 20–25% en $Q$ casi no cambia el costo. Por eso no hay que obsesionarse con redondear.',
  ],
  derivation: {
    intro: 'Se deriva el costo total respecto a $Q$ y se iguala a cero:',
    steps: [
      { label: 'Costo anual', latex: L`TC(Q)=\frac{DS}{Q}+\frac{HQ}{2}` },
      { label: 'Derivamos', latex: L`\frac{d\,TC}{dQ}=-\frac{DS}{Q^2}+\frac H2=0` },
      { label: 'Despejamos $Q$', latex: L`Q^2=\frac{2DS}{H}\ \Rightarrow\ Q^*=\sqrt{\frac{2DS}{H}}` },
      { label: 'La segunda derivada es positiva: es un mínimo', latex: L`\frac{d^2TC}{dQ^2}=\frac{2DS}{Q^3}>0` },
    ],
  },
  calculators: [
    calc<EoqResult>({
      id: 'basico',
      label: 'Lote óptimo',
      example: 'Se venden 1000 unidades al año; hacer un pedido cuesta 50 pesos y mantener una unidad un año cuesta 2 pesos.',
      inputs: [dInput, sInput, hInput, diasInput],
      compute: (v) => {
        positive(v, 'D', 'La demanda'); positive(v, 'S', 'El costo de pedido'); positive(v, 'H', 'El costo de mantener'); positive(v, 'dias', 'Los días de operación')
        return eoqCompute(num(v, 'D'), num(v, 'S'), num(v, 'H'), num(v, 'dias'))
      },
      steps: (v, r) => [
        { label: 'Fórmula del lote económico', latex: L`Q^*=\sqrt{\frac{2DS}{H}}` },
        { label: 'Sustituimos', latex: L`Q^*=\sqrt{\frac{2(${fmt(num(v, 'D'))})(${fmt(num(v, 'S'))})}{${fmt(num(v, 'H'))}}}=\sqrt{${fmt((2 * num(v, 'D') * num(v, 'S')) / num(v, 'H'))}}=${fmt(r.Q)}` },
        { label: 'Pedidos por año', latex: L`N=\frac{D}{Q^*}=\frac{${fmt(num(v, 'D'))}}{${fmt(r.Q)}}=${fmt(r.N)}` },
        { label: 'Tiempo entre pedidos', latex: L`T=\frac{Q^*}{D}=${fmt(r.T)}\ \text{años}=${fmt(r.days)}\ \text{días}` },
        { label: 'Costos anuales en el óptimo', latex: L`\frac{D}{Q^*}S=${fmt(r.order)}\qquad\frac{Q^*}{2}H=${fmt(r.hold)}\qquad TC^*=${fmt(r.TC)}` },
      ],
      answer: (_v, r) => L`Q^*=${fmt(r.Q)}\ \text{unidades por pedido}`,
      extras: (_v, r) => [
        { label: 'Pedidos al año', latex: fmt(r.N) },
        { label: 'Cada cuántos días', latex: fmt(r.days) },
        { label: 'Costo anual mínimo', latex: `${fmt(r.TC)}` },
      ],
      interpret: (_v, r) => {
        const pct = (k: number) => ((0.5 * (k + 1 / k) - 1) * 100)
        return [
          { tone: 'good', text: `Conviene pedir **${fmt(r.Q, 4)}** unidades cada vez (unos $${fmt(r.days, 3)}$ días entre pedidos), para un costo anual de inventario de **${fmt(r.TC)}**.` },
          { tone: 'info', text: `En el óptimo, el costo de pedir ($${fmt(r.order)}$) y el de mantener ($${fmt(r.hold)}$) son **iguales**. Si ves que uno es mucho mayor que el otro, no estás en el óptimo.` },
          { tone: 'info', text: `La curva es plana: pedir 25% más que $Q^*$ sólo sube el costo total ${fmt(pct(1.25), 3)}%, y pedir 25% menos, ${fmt(pct(0.75), 3)}%.` },
          { tone: 'info', text: '$Q^*$ crece con la **raíz** de la demanda: si $D$ se duplica, el lote sólo aumenta un 41% (no un 100%), y los pedidos por año aumentan un 41%.' },
        ]
      },
      visual: (v, r) => costCurves(num(v, 'D'), num(v, 'S'), num(v, 'H'), r.Q),
    }),
    calc<EoqResult>({
      id: 'costo-unitario',
      label: 'Con costo unitario y tasa de mantener',
      example: 'El artículo cuesta 10 pesos y mantenerlo cuesta 20% de su valor al año (así que $H = 0.20\\times10 = 2$).',
      inputs: [
        dInput, sInput,
        { kind: 'number', id: 'C', label: 'Costo unitario del artículo', symbol: 'C', default: 10, unit: '$' },
        { kind: 'number', id: 'i', label: 'Tasa anual de mantener', symbol: 'i', default: 20, unit: '%' },
        diasInput,
      ],
      compute: (v) => {
        positive(v, 'D', 'La demanda'); positive(v, 'S', 'El costo de pedido'); positive(v, 'C', 'El costo unitario'); positive(v, 'i', 'La tasa de mantener'); positive(v, 'dias', 'Los días de operación')
        return eoqCompute(num(v, 'D'), num(v, 'S'), (num(v, 'i') / 100) * num(v, 'C'), num(v, 'dias'), num(v, 'C'))
      },
      steps: (v, r) => [
        { label: 'El costo de mantener es un porcentaje del valor del artículo', latex: L`H=iC=${fmt(num(v, 'i') / 100)}\cdot${fmt(num(v, 'C'))}=${fmt(r.H)}` },
        { label: 'Lote económico', latex: L`Q^*=\sqrt{\frac{2DS}{H}}=\sqrt{\frac{2(${fmt(num(v, 'D'))})(${fmt(num(v, 'S'))})}{${fmt(r.H)}}}=${fmt(r.Q)}` },
        { label: 'Costo de pedir y de mantener', latex: L`\frac{D}{Q^*}S+\frac{Q^*}{2}H=${fmt(r.order)}+${fmt(r.hold)}=${fmt(r.order + r.hold)}` },
        { label: 'Costo de comprar la mercancía (no depende de $Q$)', latex: L`DC=${fmt(num(v, 'D'))}\cdot${fmt(num(v, 'C'))}=${fmt(r.purchase)}` },
        { label: 'Costo anual total', latex: L`TC=${fmt(r.order + r.hold)}+${fmt(r.purchase)}=${fmt(r.TC)}` },
      ],
      answer: (_v, r) => L`Q^*=${fmt(r.Q)}\ \text{unidades por pedido}`,
      extras: (_v, r) => [
        { label: 'H = iC', latex: fmt(r.H) },
        { label: 'Pedidos al año', latex: fmt(r.N) },
        { label: 'Costo total con compra', latex: fmt(r.TC) },
      ],
      interpret: (_v, r) => [
        { tone: 'good', text: `Pide **${fmt(r.Q, 4)}** unidades cada $${fmt(r.days, 3)}$ días.` },
        { tone: 'info', text: `La compra de la mercancía ($${fmt(r.purchase)}$) es un costo fijo que **no cambia** con $Q$: por eso no entra a la fórmula de $Q^*$. Sólo importa si hay descuentos por cantidad.` },
      ],
      visual: (v, r) => costCurves(num(v, 'D'), num(v, 'S'), r.H, r.Q),
    }),
    calc<{ eo: EoqResult; tc: number; extra: number }>({
      id: 'otro-lote',
      label: 'Comparar con otro lote',
      example: 'Si por comodidad se pide siempre de 400 en 400, ¿cuánto se pierde?',
      inputs: [dInput, sInput, hInput, { kind: 'number', id: 'Q', label: 'Tamaño de pedido que usas', symbol: 'Q', default: 400, unit: 'unidades' }],
      compute: (v) => {
        positive(v, 'D', 'La demanda'); positive(v, 'S', 'El costo de pedido'); positive(v, 'H', 'El costo de mantener'); positive(v, 'Q', 'El tamaño de pedido')
        const eo = eoqCompute(num(v, 'D'), num(v, 'S'), num(v, 'H'), 365)
        const tc = (num(v, 'D') / num(v, 'Q')) * num(v, 'S') + (num(v, 'Q') / 2) * num(v, 'H')
        return { eo, tc, extra: tc - eo.TC }
      },
      steps: (v, r) => {
        const Q = num(v, 'Q')
        return [
          { label: 'Costo anual con tu tamaño de pedido', latex: L`TC(Q)=\frac{D}{Q}S+\frac{Q}{2}H=\frac{${fmt(num(v, 'D'))}}{${fmt(Q)}}(${fmt(num(v, 'S'))})+\frac{${fmt(Q)}}{2}(${fmt(num(v, 'H'))})=${fmt(r.tc)}` },
          { label: 'Costo con el lote óptimo', latex: L`Q^*=${fmt(r.eo.Q)}\qquad TC^*=\sqrt{2DSH}=${fmt(r.eo.TC)}` },
          { label: 'Diferencia', latex: L`TC(Q)-TC^*=${fmt(r.tc)}-${fmt(r.eo.TC)}=${fmt(r.extra)}` },
          { label: 'Relación (sólo depende de $k=Q/Q^*$)', latex: L`\frac{TC(Q)}{TC^*}=\frac12\left(k+\frac1k\right)=\frac12\left(${fmt(Q / r.eo.Q)}+\frac{1}{${fmt(Q / r.eo.Q)}}\right)=${fmt(r.tc / r.eo.TC)}` },
        ]
      },
      answer: (v, r) => L`TC(${fmt(num(v, 'Q'))})=${fmt(r.tc)}\quad(+${fmt((r.tc / r.eo.TC - 1) * 100, 3)}\%)`,
      extras: (_v, r) => [
        { label: 'Lote óptimo', latex: fmt(r.eo.Q) },
        { label: 'Costo mínimo', latex: fmt(r.eo.TC) },
        { label: 'Costo extra por año', latex: fmt(r.extra) },
      ],
      interpret: (v, r) => [
        { tone: close(r.tc, r.eo.TC, 0.01) ? 'good' : 'info', text: `Con $Q=${fmt(num(v, 'Q'))}$ gastas **${fmt(r.extra)}** más al año que con el óptimo ($${fmt((r.tc / r.eo.TC - 1) * 100, 3)}\\%$ más).` },
        { tone: 'info', text: 'Si el costo extra es pequeño, un lote “redondo” (docena, caja, tarima) puede convenir más que el óptimo exacto.' },
      ],
      visual: (v, r) => costCurves(num(v, 'D'), num(v, 'S'), num(v, 'H'), r.eo.Q, num(v, 'Q')),
    }),
  ],
  commonMistakes: [
    'Mezclar unidades: $D$ y $H$ deben ser **anuales** (o los dos mensuales, etc.).',
    'Meter el costo de comprar la mercancía en $Q^*$: es constante y no cambia el óptimo (sí cambia el costo total).',
    'Olvidar el 2 de $2DS$, o confundir $H$ (costo por unidad al año) con el costo total de almacenar.',
    'Usar el EOQ cuando hay descuentos por cantidad o la demanda varía mucho: el modelo supone demanda constante.',
  ],
  related: ['epq', 'eoq-faltantes', 'punto-reorden'],
  keywords: ['eoq', 'lote economico', 'inventarios', 'costo de pedir', 'costo de mantener', 'cantidad economica de pedido', 'investigacion de operaciones', 'wilson'],
}

// ─── Lote económico de producción (EPQ) ──────────────────────────────────────

interface EpqResult { Q: number; Imax: number; tp: number; T: number; N: number; TC: number; setup: number; hold: number; dias: number }

const epq: Formula = {
  id: 'epq',
  name: 'Lote económico de producción (EPQ)',
  category: 'inventarios',
  latex: L`Q^*=\sqrt{\frac{2DS}{H\left(1-\frac{D}{P}\right)}}`,
  forms: [
    { label: 'Inventario máximo', latex: L`I_{\max}=Q^*\left(1-\frac DP\right)` },
    { label: 'Costo anual total', latex: L`TC=\frac DQS+\frac{I_{\max}}{2}H` },
    { label: 'Costo mínimo', latex: L`TC^*=\sqrt{2DSH\left(1-\frac DP\right)}` },
    { label: 'Tiempo de producción', latex: L`t_p=\frac{Q^*}{P}` },
  ],
  summary: 'Como el EOQ, pero el lote **no llega de golpe**: se fabrica poco a poco mientras ya se está vendiendo.',
  goal: 'Cuántas unidades producir en cada corrida para minimizar el costo anual de **preparar** la máquina más el de mantener inventario.',
  variables: [
    { symbol: 'D', meaning: 'Demanda anual' },
    { symbol: 'P', meaning: 'Tasa de producción anual (cuánto produce la máquina si trabaja todo el año). Debe ser mayor que $D$' },
    { symbol: 'S', meaning: 'Costo de **preparar** la producción (ajustar la máquina, limpiar la línea)' },
    { symbol: 'H', meaning: 'Costo de mantener una unidad un año' },
    { symbol: 'I_{\\max}', meaning: 'Inventario máximo: se alcanza al terminar de producir' },
    { symbol: 't_p', meaning: 'Tiempo que dura cada corrida de producción' },
  ],
  whenToUse: [
    'El producto se **fabrica** internamente en lotes (no se compra) y se consume al mismo tiempo que se produce.',
    'Si $P\\to\\infty$ (el lote aparece de golpe) se vuelve el EOQ: $\\left(1-\\frac DP\\right)\\to1$.',
  ],
  intuition: [
    'Mientras se produce, el inventario sube sólo a la **diferencia** $P-D$ (porque a la vez se vende a razón $D$). Por eso nunca llega a $Q$: su máximo es $I_{\\max}=Q\\left(1-\\frac DP\\right)$.',
    'Como el inventario promedio es menor, mantener cuesta menos y conviene hacer **lotes más grandes** que en el EOQ: $Q^*_{EPQ}=Q^*_{EOQ}/\\sqrt{1-D/P}$.',
    'Cuanto más rápido produce la máquina ($P$ grande), más se parece el EPQ al EOQ.',
  ],
  derivation: {
    steps: [
      { label: 'Inventario promedio', latex: L`\frac{I_{\max}}{2}=\frac Q2\left(1-\frac DP\right)` },
      { label: 'Costo total', latex: L`TC=\frac{D}{Q}S+\frac Q2\left(1-\frac DP\right)H` },
      { label: 'Es un EOQ con costo de mantener “efectivo” $H(1-D/P)$', latex: L`Q^*=\sqrt{\frac{2DS}{H(1-D/P)}}` },
    ],
  },
  calculators: [
    calc<EpqResult>({
      id: 'epq',
      label: 'Lote de producción',
      example: 'Se venden 1000 unidades al año y la máquina podría producir 4000. Preparar la máquina cuesta 100 pesos y mantener una unidad cuesta 2 pesos al año.',
      inputs: [
        dInput,
        { kind: 'number', id: 'P', label: 'Capacidad de producción anual', symbol: 'P', default: 4000, unit: 'unidades/año' },
        { kind: 'number', id: 'S', label: 'Costo de preparación', symbol: 'S', default: 100, unit: '$' },
        hInput,
        diasInput,
      ],
      compute: (v) => {
        positive(v, 'D', 'La demanda'); positive(v, 'S', 'El costo de preparación'); positive(v, 'H', 'El costo de mantener'); positive(v, 'dias', 'Los días de operación')
        const D = num(v, 'D'), P = num(v, 'P'), S = num(v, 'S'), H = num(v, 'H')
        if (!(P > D)) fail('La capacidad de producción $P$ debe ser **mayor** que la demanda $D$; si no, nunca se acumula inventario y el modelo no aplica.')
        const k = 1 - D / P
        const Q = Math.sqrt((2 * D * S) / (H * k))
        const Imax = Q * k
        return { Q, Imax, tp: Q / P, T: Q / D, N: D / Q, setup: (D / Q) * S, hold: (Imax / 2) * H, TC: (D / Q) * S + (Imax / 2) * H, dias: num(v, 'dias') }
      },
      steps: (v, r) => {
        const D = num(v, 'D'), P = num(v, 'P'), S = num(v, 'S'), H = num(v, 'H'), k = 1 - D / P
        return [
          { label: 'Factor por producir mientras se vende', latex: L`1-\frac DP=1-\frac{${fmt(D)}}{${fmt(P)}}=${fmt(k)}` },
          { label: 'Lote económico de producción', latex: L`Q^*=\sqrt{\frac{2(${fmt(D)})(${fmt(S)})}{(${fmt(H)})(${fmt(k)})}}=${fmt(r.Q)}` },
          { label: 'Inventario máximo', latex: L`I_{\max}=Q^*\left(1-\frac DP\right)=${fmt(r.Q)}(${fmt(k)})=${fmt(r.Imax)}` },
          { label: 'Tiempos', latex: L`t_p=\frac{Q^*}{P}=${fmt(r.tp * r.dias)}\ \text{días de producción}\qquad T=\frac{Q^*}{D}=${fmt(r.T * r.dias)}\ \text{días por ciclo}` },
          { label: 'Costos anuales', latex: L`\frac DQS=${fmt(r.setup)}\qquad\frac{I_{\max}}{2}H=${fmt(r.hold)}\qquad TC^*=${fmt(r.TC)}` },
        ]
      },
      answer: (_v, r) => L`Q^*=${fmt(r.Q)}\ \text{unidades por corrida}`,
      extras: (_v, r) => [
        { label: 'Inventario máximo', latex: fmt(r.Imax) },
        { label: 'Corridas al año', latex: fmt(r.N) },
        { label: 'Costo anual mínimo', latex: fmt(r.TC) },
      ],
      interpret: (v, r) => {
        const eoqQ = Math.sqrt((2 * num(v, 'D') * num(v, 'S')) / num(v, 'H'))
        return [
          { tone: 'good', text: `Produce **${fmt(r.Q, 4)}** unidades en cada corrida. La producción dura $${fmt(r.tp * r.dias, 3)}$ días y todo el ciclo $${fmt(r.T * r.dias, 3)}$ días.` },
          { tone: 'info', text: `El inventario nunca pasa de $${fmt(r.Imax)}$ (no de $${fmt(r.Q)}$), porque mientras produces ya estás vendiendo.` },
          { tone: 'info', text: `Con el EOQ simple saldría $Q=${fmt(eoqQ)}$; el EPQ pide un lote **${fmt((r.Q / eoqQ - 1) * 100, 3)}%** más grande.` },
        ]
      },
      visual: (_v, r) => {
        const T = r.T * r.dias, tp = r.tp * r.dias
        const pts: [number, number][] = []
        for (let k = 0; k < 3; k++) pts.push([k * T, 0], [k * T + tp, r.Imax])
        pts.push([3 * T, 0])
        return {
          type: 'plot',
          curves: [{ points: pts, tone: 'a', label: L`\text{Inventario}` }],
          marks: [{ x: tp, y: r.Imax, tone: 'warn', label: `Imáx = ${fmt(r.Imax, 4)}` }],
          xRange: [0, 3 * T],
          yRange: [0, r.Imax * 1.2],
          caption: 'Tres ciclos de producción (el eje horizontal está en días). El inventario sube mientras se produce más rápido de lo que se vende y baja cuando se detiene la máquina.',
        }
      },
    }),
  ],
  commonMistakes: [
    'Usar $P<D$ (sin acumular inventario no hay lote).',
    'Confundir $P$ (tasa anual de producción) con el tamaño del lote.',
    'Usar $Q$ como inventario máximo: el máximo es $Q(1-D/P)$.',
  ],
  related: ['eoq', 'eoq-faltantes'],
  keywords: ['epq', 'lote de produccion', 'lote economico de produccion', 'inventarios', 'preparacion', 'produccion', 'investigacion de operaciones'],
}

// ─── EOQ con faltantes ───────────────────────────────────────────────────────

interface BackResult { Q: number; Imax: number; short: number; TC: number; order: number; hold: number; shortage: number; frac: number; T: number; dias: number }

const eoqFaltantes: Formula = {
  id: 'eoq-faltantes',
  name: 'Lote económico con faltantes diferidos',
  category: 'inventarios',
  latex: L`Q^*=\sqrt{\frac{2DS}{H}}\sqrt{\frac{H+B}{B}}`,
  forms: [
    { label: 'Inventario máximo', latex: L`I_{\max}=Q^*\,\frac{B}{H+B}` },
    { label: 'Faltante máximo', latex: L`s_{\max}=Q^*-I_{\max}=Q^*\,\frac{H}{H+B}` },
    { label: 'Costo anual mínimo', latex: L`TC^*=\sqrt{2DSH\,\frac{B}{H+B}}` },
  ],
  summary: 'Permite que a veces **falte** producto: el cliente espera y se le surte después, pagando un costo por cada unidad faltante.',
  goal: 'Decidir cuánto pedir cuando es aceptable tener faltantes diferidos (pedidos pendientes) a cambio de bajar el inventario.',
  variables: [
    { symbol: 'D,\\ S,\\ H', meaning: 'Igual que en el EOQ: demanda anual, costo de pedido y costo de mantener' },
    { symbol: 'B', meaning: 'Costo de **un faltante**: una unidad pendiente durante un año (pérdida de confianza, descuentos, urgencias)' },
    { symbol: 'I_{\\max}', meaning: 'Inventario máximo, justo después de recibir el pedido y surtir los pendientes' },
    { symbol: 's_{\\max}', meaning: 'Faltante máximo acumulado justo antes de que llegue el siguiente pedido' },
  ],
  whenToUse: [
    'Los clientes aceptan esperar (pedidos diferidos, “backorders”) y los faltantes tienen un costo conocido.',
    'Si $B\\to\\infty$ (no se tolera ningún faltante) el resultado es el EOQ simple.',
  ],
  intuition: [
    'Aceptar faltantes **ahorra** costo de mantener (el almacén pasa parte del ciclo vacío), así que conviene pedir **más** que en el EOQ: $Q^*=Q^*_{EOQ}\\sqrt{\\frac{H+B}{B}}$.',
    'La fracción del tiempo con producto disponible es $\\frac{I_{\\max}}{Q}=\\frac{B}{H+B}$. Si faltar es barato (B pequeña), te la pasas sin producto casi todo el tiempo. Si faltar es muy caro, casi nunca falta.',
    'Es una regla de proporción: se invierte en mantener y en faltar **en razón inversa** a sus costos.',
  ],
  derivation: {
    steps: [
      { label: 'Con inventario máximo $I$ y pedido $Q$: tiempo con producto $\\frac{I}{Q}$, sin producto $\\frac{Q-I}{Q}$', latex: L`TC=\frac DQS+\frac{I^2}{2Q}H+\frac{(Q-I)^2}{2Q}B` },
      { label: 'Derivadas parciales iguales a cero. De $\\partial/\\partial I$ sale', latex: L`I=\frac{BQ}{H+B}` },
      { label: 'Sustituimos en $\\partial/\\partial Q$', latex: L`Q^*=\sqrt{\frac{2DS(H+B)}{HB}}` },
    ],
  },
  calculators: [
    calc<BackResult>({
      id: 'faltantes',
      label: 'Con faltantes',
      example: 'Igual que el EOQ de 1000 unidades al año, pero ahora un faltante cuesta 8 pesos por unidad al año.',
      inputs: [dInput, sInput, hInput, { kind: 'number', id: 'B', label: 'Costo de un faltante por unidad al año', symbol: 'B', default: 8, unit: '$/unidad·año' }, diasInput],
      compute: (v) => {
        positive(v, 'D', 'La demanda'); positive(v, 'S', 'El costo de pedido'); positive(v, 'H', 'El costo de mantener'); positive(v, 'B', 'El costo de faltante'); positive(v, 'dias', 'Los días de operación')
        const D = num(v, 'D'), S = num(v, 'S'), H = num(v, 'H'), B = num(v, 'B')
        const Q = Math.sqrt((2 * D * S * (H + B)) / (H * B))
        const Imax = (Q * B) / (H + B), short = Q - Imax
        const order = (D / Q) * S, hold = (Imax * Imax * H) / (2 * Q), shortage = (short * short * B) / (2 * Q)
        return { Q, Imax, short, TC: order + hold + shortage, order, hold, shortage, frac: Imax / Q, T: Q / D, dias: num(v, 'dias') }
      },
      steps: (v, r) => {
        const D = num(v, 'D'), S = num(v, 'S'), H = num(v, 'H'), B = num(v, 'B')
        return [
          { label: 'Lote con faltantes', latex: L`Q^*=\sqrt{\frac{2DS(H+B)}{HB}}=\sqrt{\frac{2(${fmt(D)})(${fmt(S)})(${fmt(H + B)})}{(${fmt(H)})(${fmt(B)})}}=${fmt(r.Q)}` },
          { label: 'Inventario máximo', latex: L`I_{\max}=Q^*\frac{B}{H+B}=${fmt(r.Q)}\cdot\frac{${fmt(B)}}{${fmt(H + B)}}=${fmt(r.Imax)}` },
          { label: 'Faltante máximo', latex: L`s_{\max}=Q^*-I_{\max}=${fmt(r.Q)}-${fmt(r.Imax)}=${fmt(r.short)}` },
          { label: 'Costos anuales: pedir, mantener y faltar', latex: L`\frac{D}{Q}S=${fmt(r.order)}\quad\frac{I_{\max}^2}{2Q}H=${fmt(r.hold)}\quad\frac{s_{\max}^2}{2Q}B=${fmt(r.shortage)}` },
          { label: 'Total', latex: L`TC^*=${fmt(r.order)}+${fmt(r.hold)}+${fmt(r.shortage)}=${fmt(r.TC)}` },
        ]
      },
      answer: (_v, r) => L`Q^*=${fmt(r.Q)}\ \text{unidades por pedido}`,
      extras: (_v, r) => [
        { label: 'Inventario máximo', latex: fmt(r.Imax) },
        { label: 'Faltante máximo', latex: fmt(r.short) },
        { label: 'Costo anual mínimo', latex: fmt(r.TC) },
      ],
      interpret: (v, r) => {
        const noBack = Math.sqrt(2 * num(v, 'D') * num(v, 'S') * num(v, 'H'))
        return [
          { tone: 'good', text: `Pide **${fmt(r.Q, 4)}** unidades. Tras recibir el pedido surtes los pendientes y quedan $${fmt(r.Imax)}$ en almacén.` },
          { tone: 'info', text: `Hay producto disponible el **${fmt(r.frac * 100, 3)}%** del tiempo; el resto del ciclo hay pedidos pendientes (hasta $${fmt(r.short)}$ unidades).` },
          { tone: 'info', text: `Sin permitir faltantes, el EOQ costaría $${fmt(noBack)}$ al año; permitirlos baja el costo a $${fmt(r.TC)}$ (**${fmt((1 - r.TC / noBack) * 100, 3)}%** menos).` },
        ]
      },
      visual: (_v, r) => {
        const T = r.T * r.dias, t1 = (r.Imax / r.Q) * T
        const pts: [number, number][] = []
        for (let k = 0; k < 3; k++) pts.push([k * T, r.Imax], [k * T + t1, 0], [(k + 1) * T, -r.short])
        pts.push([3 * T, r.Imax])
        return {
          type: 'plot',
          curves: [{ points: pts, tone: 'a', label: L`\text{Inventario (negativo = faltante)}` }],
          marks: [{ x: 0, y: r.Imax, tone: 'warn', label: `Imáx = ${fmt(r.Imax, 4)}` }, { x: T, y: -r.short, tone: 'accent', label: `faltante máx = ${fmt(r.short, 4)}` }],
          xRange: [0, 3 * T],
          yRange: [-r.short * 1.6, r.Imax * 1.25],
          caption: 'Tres ciclos (eje horizontal en días). Cuando la línea baja de 0 hay clientes esperando; al llegar el pedido se surten primero los pendientes y el inventario salta a $I_{\\max}$.',
        }
      },
    }),
  ],
  commonMistakes: [
    'Confundir $B$ (costo de un faltante por unidad por año) con una multa total.',
    'Pensar que $Q^*$ es el inventario máximo: parte del pedido se usa para surtir los faltantes acumulados.',
    'Usarlo cuando los clientes no esperan (ventas perdidas): ese es otro modelo.',
  ],
  related: ['eoq', 'epq'],
  keywords: ['faltantes', 'backorders', 'pedidos diferidos', 'eoq con faltantes', 'inventarios', 'investigacion de operaciones'],
}

// ─── Punto de reorden y existencia de seguridad ──────────────────────────────

interface RopResult { mu: number; sigmaL: number; z: number; ss: number; rop: number }

const puntoReorden: Formula = {
  id: 'punto-reorden',
  name: 'Punto de reorden y existencia de seguridad',
  category: 'inventarios',
  latex: L`ROP=\bar d\,L+z\,\sigma_d\sqrt L`,
  forms: [
    { label: 'Con demanda constante', latex: L`ROP=d\,L` },
    { label: 'Existencia de seguridad', latex: L`SS=z\,\sigma_d\sqrt L` },
    { label: 'Demanda durante el tiempo de entrega', latex: L`\mu_L=\bar d\,L\qquad\sigma_L=\sigma_d\sqrt L` },
  ],
  summary: 'Cuánto inventario debe quedar para hacer el siguiente pedido, con un colchón para cubrir la variación de la demanda.',
  goal: 'Saber **cuándo** pedir (el EOQ dice cuánto): cuando el inventario baje a $ROP$, alcanzará hasta que llegue el pedido con la probabilidad de servicio que quieras.',
  variables: [
    { symbol: L`\bar d`, meaning: 'Demanda promedio por día (o semana, mes: la misma unidad que $L$)' },
    { symbol: L`\sigma_d`, meaning: 'Desviación estándar de la demanda en ese mismo periodo' },
    { symbol: 'L', meaning: 'Tiempo de entrega (lead time): cuánto tarda en llegar un pedido' },
    { symbol: 'z', meaning: 'Valor de la normal estándar para el **nivel de servicio** deseado (95% → $z=1.645$)' },
    { symbol: 'SS', meaning: 'Existencia de seguridad (colchón)' },
  ],
  whenToUse: [
    'Revisión continua del inventario: cada vez que baja a cierto nivel se hace un pedido.',
    'La demanda varía de un día a otro pero tiene media y desviación conocidas (aproximadamente normal).',
  ],
  intuition: [
    'Si la demanda fuera exacta, bastaría pedir cuando queden $dL$ unidades: llegarían justo cuando se acaban.',
    'Como la demanda varía, a veces se gastará más. El colchón $z\\sigma_L$ cubre esa variación: con $z=1.645$ el inventario alcanza el 95% de los ciclos.',
    'Las desviaciones **no** se suman, se suman las varianzas: por eso aparece $\\sqrt L$ y no $L$. Esperar el doble de días aumenta el colchón sólo un 41%.',
    'Subir el nivel de servicio **cuesta**: pasar de 95% a 99% exige un colchón casi 40% más grande.',
  ],
  calculators: [
    calc<RopResult>({
      id: 'incierto',
      label: 'Demanda variable',
      example: 'Se venden en promedio 50 unidades al día (desviación 10), el proveedor tarda 9 días y quieres 95% de nivel de servicio.',
      inputs: [
        { kind: 'number', id: 'd', label: 'Demanda promedio diaria', symbol: L`\bar d`, default: 50, unit: 'unid/día' },
        { kind: 'number', id: 'sd', label: 'Desviación estándar diaria', symbol: L`\sigma_d`, default: 10, unit: 'unid/día' },
        { kind: 'number', id: 'L', label: 'Tiempo de entrega', symbol: 'L', default: 9, unit: 'días' },
        { kind: 'number', id: 'nivel', label: 'Nivel de servicio', symbol: L`\alpha`, default: 95, unit: '%' },
      ],
      compute: (v) => {
        positive(v, 'd', 'La demanda'); positive(v, 'L', 'El tiempo de entrega')
        if (num(v, 'sd') < 0) fail('La desviación estándar no puede ser negativa.')
        const nivel = num(v, 'nivel')
        if (!(nivel > 50 && nivel < 100)) fail('El nivel de servicio debe estar entre 50% y 100% (sin incluir 100%: pedir con certeza total costaría infinito).')
        const mu = num(v, 'd') * num(v, 'L'), sigmaL = num(v, 'sd') * Math.sqrt(num(v, 'L'))
        const z = normalInv(nivel / 100)
        return { mu, sigmaL, z, ss: z * sigmaL, rop: mu + z * sigmaL }
      },
      steps: (v, r) => [
        { label: 'Demanda esperada durante el tiempo de entrega', latex: L`\mu_L=\bar dL=(${fmt(num(v, 'd'))})(${fmt(num(v, 'L'))})=${fmt(r.mu)}` },
        { label: 'Su desviación estándar (las varianzas se suman, por eso $\\sqrt L$)', latex: L`\sigma_L=\sigma_d\sqrt L=${fmt(num(v, 'sd'))}\sqrt{${fmt(num(v, 'L'))}}=${fmt(r.sigmaL)}` },
        { label: `Valor $z$ que deja ${fmt(num(v, 'nivel'))}% a la izquierda en la normal estándar`, latex: L`P(Z\le z)=${fmt(num(v, 'nivel') / 100)}\ \Rightarrow\ z=${fmt(r.z)}` },
        { label: 'Existencia de seguridad', latex: L`SS=z\sigma_L=(${fmt(r.z)})(${fmt(r.sigmaL)})=${fmt(r.ss)}` },
        { label: 'Punto de reorden', latex: L`ROP=\mu_L+SS=${fmt(r.mu)}+${fmt(r.ss)}=${fmt(r.rop)}` },
      ],
      answer: (_v, r) => L`ROP=${fmt(r.rop)}\ \text{unidades}`,
      extras: (_v, r) => [
        { label: 'Existencia de seguridad', latex: fmt(r.ss) },
        { label: 'Demanda en la entrega', latex: fmt(r.mu) },
        { label: 'z', latex: fmt(r.z) },
      ],
      interpret: (v, r) => [
        { tone: 'good', text: `Haz el pedido cuando el inventario baje a **${fmt(r.rop, 4)}** unidades: de ${fmt(r.mu)} esperas gastar mientras llega, y ${fmt(r.ss)} son el colchón.` },
        { tone: 'info', text: `Con este colchón te quedas sin producto en aproximadamente el **${fmt(100 - num(v, 'nivel'), 3)}%** de los ciclos de reorden.` },
        { tone: 'info', text: 'Cada punto extra de nivel de servicio cuesta cada vez más: la curva normal es muy plana en la cola.' },
      ],
      visual: (v, r) => ({ type: 'normal', z: r.z, shade: 'left', label: `Nivel de servicio (${fmt(num(v, 'nivel'))}%)` }),
    }),
    calc<{ rop: number }>({
      id: 'cierto',
      label: 'Demanda constante',
      example: 'Con demanda exacta no hace falta colchón.',
      inputs: [
        { kind: 'number', id: 'd', label: 'Demanda promedio diaria', symbol: L`\bar d`, default: 50, unit: 'unid/día' },
        { kind: 'number', id: 'L', label: 'Tiempo de entrega', symbol: 'L', default: 9, unit: 'días' },
      ],
      compute: (v) => {
        positive(v, 'd', 'La demanda'); positive(v, 'L', 'El tiempo de entrega')
        return { rop: num(v, 'd') * num(v, 'L') }
      },
      steps: (v, r) => [{ label: 'Lo que se vende mientras llega el pedido', latex: L`ROP=dL=(${fmt(num(v, 'd'))})(${fmt(num(v, 'L'))})=${fmt(r.rop)}` }],
      answer: (_v, r) => L`ROP=${fmt(r.rop)}\ \text{unidades}`,
      interpret: (v, r) => [{ tone: 'good', text: `Pide cuando queden $${fmt(r.rop)}$ unidades: se terminarán justo cuando llegue el pedido (en ${fmt(num(v, 'L'))} días).` }],
    }),
  ],
  commonMistakes: [
    'Mezclar unidades: si la demanda es **diaria** el tiempo de entrega debe estar en **días**.',
    'Sumar las desviaciones en vez de las varianzas: la desviación durante $L$ días es $\\sigma_d\\sqrt L$, no $\\sigma_dL$.',
    'Confundir el **nivel de servicio por ciclo** (probabilidad de no quedarte sin producto) con el porcentaje de unidades surtidas.',
  ],
  related: ['eoq', 'newsvendor'],
  keywords: ['punto de reorden', 'existencia de seguridad', 'stock de seguridad', 'nivel de servicio', 'lead time', 'inventarios', 'investigacion de operaciones'],
}

// ─── Modelo del vendedor de periódicos ───────────────────────────────────────

const loss = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) - z * (1 - normalCDF(z))

interface NewsResult { cu: number; co: number; cr: number; Q: number; z?: number; profit: number; sales: number; left: number }

function priceInputs() {
  return [
    { kind: 'number' as const, id: 'p', label: 'Precio de venta', symbol: 'p', default: 12, unit: '$' },
    { kind: 'number' as const, id: 'c', label: 'Costo de compra', symbol: 'c', default: 5, unit: '$' },
    { kind: 'number' as const, id: 's', label: 'Valor de rescate de lo que sobra', symbol: 's', default: 2, unit: '$' },
  ]
}

function costsOf(v: Values) {
  const p = num(v, 'p'), c = num(v, 'c'), s = num(v, 's')
  if (!(p > c)) fail('El precio de venta debe ser mayor que el costo ($p>c$); si no, no conviene comprar nada.')
  if (!(c > s)) fail('El costo debe ser mayor que el valor de rescate ($c>s$); si no, conviene comprar sin límite.')
  return { cu: p - c, co: c - s, p, c, s }
}

const newsvendor: Formula = {
  id: 'newsvendor',
  name: 'Modelo del vendedor de periódicos (un solo periodo)',
  category: 'inventarios',
  latex: L`F(Q^*)=\frac{C_u}{C_u+C_o}`,
  forms: [
    { label: 'Costo de quedarse corto y de pasarse', latex: L`C_u=p-c\qquad C_o=c-s` },
    { label: 'Demanda normal', latex: L`Q^*=\mu+z\,\sigma,\qquad z=\Phi^{-1}\!\left(\frac{C_u}{C_u+C_o}\right)` },
  ],
  summary: 'Cuánto comprar **una sola vez** cuando lo que sobre se vende barato (o se tira) y lo que falte es venta perdida.',
  goal: 'Decidir la cantidad $Q^*$ que maximiza la utilidad esperada de un producto de temporada: periódicos, pan, ropa de moda, boletos.',
  variables: [
    { symbol: 'p', meaning: 'Precio de venta al cliente' },
    { symbol: 'c', meaning: 'Costo de comprar o producir cada unidad' },
    { symbol: 's', meaning: 'Valor de rescate de lo que **sobra** (puede ser 0)' },
    { symbol: 'C_u', meaning: 'Costo de **subestimar**: la utilidad que pierdes por cada unidad que faltó, $p-c$' },
    { symbol: 'C_o', meaning: 'Costo de **sobreestimar**: lo que pierdes por cada unidad que sobró, $c-s$' },
    { symbol: 'F(Q)', meaning: 'Probabilidad de que la demanda sea $\\le Q$' },
  ],
  whenToUse: [
    'Una **sola** decisión de compra antes de conocer la demanda (producto perecedero o de temporada).',
    'Lo que sobra tiene poco o ningún valor, y lo que falta es venta perdida.',
  ],
  intuition: [
    'Pregunta marginal: ¿compro una unidad más? Con probabilidad $1-F(Q)$ se vende y ganas $C_u$; con probabilidad $F(Q)$ sobra y pierdes $C_o$. Conviene comprar mientras $(1-F)C_u\\ge FC_o$, es decir, hasta que $F(Q)=\\frac{C_u}{C_u+C_o}$.',
    'Esa fracción se llama **razón crítica**. Si ganas mucho por unidad vendida y pierdes poco por la que sobra, la razón crítica es alta y conviene comprar **más que la demanda promedio**.',
    'Si $C_u=C_o$ la razón es 50% y compras justo la mediana de la demanda.',
  ],
  calculators: [
    calc<NewsResult>({
      id: 'normal',
      label: 'Demanda normal',
      example: 'Se vende a 12 pesos, cuesta 5 pesos y lo que sobra se rescata en 2 pesos. La demanda es normal con media 200 y desviación 40.',
      inputs: [
        ...priceInputs(),
        { kind: 'number', id: 'mu', label: 'Demanda promedio', symbol: L`\mu`, default: 200 },
        { kind: 'number', id: 'sigma', label: 'Desviación estándar de la demanda', symbol: L`\sigma`, default: 40 },
      ],
      compute: (v) => {
        const { cu, co, p, c, s } = costsOf(v)
        const mu = num(v, 'mu'), sigma = num(v, 'sigma')
        if (!(sigma > 0)) fail('La desviación estándar debe ser mayor que 0.')
        const cr = cu / (cu + co), z = normalInv(cr), Q = mu + z * sigma
        const sales = mu - sigma * loss(z), left = Q - sales
        return { cu, co, cr, Q, z, sales, left, profit: p * sales + s * left - c * Q }
      },
      steps: (v, r) => [
        { label: 'Costo de quedarse corto y de pasarse', latex: L`C_u=p-c=${fmt(num(v, 'p'))}-${fmt(num(v, 'c'))}=${fmt(r.cu)}\qquad C_o=c-s=${fmt(num(v, 'c'))}-${fmt(num(v, 's'))}=${fmt(r.co)}` },
        { label: 'Razón crítica', latex: L`\frac{C_u}{C_u+C_o}=\frac{${fmt(r.cu)}}{${fmt(r.cu + r.co)}}=${fmt(r.cr)}` },
        { label: 'Valor $z$ con esa probabilidad acumulada', latex: L`z=\Phi^{-1}(${fmt(r.cr)})=${fmt(r.z!)}` },
        { label: 'Cantidad óptima', latex: L`Q^*=\mu+z\sigma=${fmt(num(v, 'mu'))}+(${fmt(r.z!)})(${fmt(num(v, 'sigma'))})=${fmt(r.Q)}` },
        { label: 'Utilidad esperada (con la función de pérdida normal $L(z)=\\varphi(z)-z[1-\\Phi(z)]$)', latex: L`E[\text{ventas}]=\mu-\sigma L(z)=${fmt(r.sales)}\qquad E[\text{sobrante}]=Q^*-E[\text{ventas}]=${fmt(r.left)}` },
        { label: 'Utilidad', latex: L`E[U]=p\cdot${fmt(r.sales)}+s\cdot${fmt(r.left)}-c\cdot${fmt(r.Q)}=${fmt(r.profit)}` },
      ],
      answer: (_v, r) => L`Q^*=${fmt(r.Q)}\ \text{unidades}`,
      extras: (_v, r) => [
        { label: 'Razón crítica', latex: `${fmt(r.cr * 100, 3)}\\%` },
        { label: 'Utilidad esperada', latex: fmt(r.profit) },
        { label: 'Sobrante esperado', latex: fmt(r.left) },
      ],
      interpret: (v, r) => [
        { tone: 'good', text: `Compra **${fmt(r.Q, 4)}** unidades. Con esa cantidad la probabilidad de que alcance es del **${fmt(r.cr * 100, 3)}%**.` },
        { tone: 'info', text: r.Q > num(v, 'mu') ? `Conviene comprar **más** que la demanda promedio ($${fmt(num(v, 'mu'))}$): perder una venta ($${fmt(r.cu)}$) duele más que quedarte con un sobrante ($${fmt(r.co)}$).` : r.Q < num(v, 'mu') ? `Conviene comprar **menos** que la demanda promedio ($${fmt(num(v, 'mu'))}$): un sobrante ($${fmt(r.co)}$) duele más que perder una venta ($${fmt(r.cu)}$).` : 'Como ambos costos son iguales, compras justo la demanda promedio.' },
        { tone: 'info', text: `En promedio venderás $${fmt(r.sales)}$ unidades y te sobrarán $${fmt(r.left)}$; la utilidad esperada es **${fmt(r.profit)}**.` },
      ],
      visual: (_v, r) => ({ type: 'normal', z: r.z!, shade: 'left', label: 'Probabilidad de que alcance el inventario' }),
    }),
    calc<NewsResult>({
      id: 'discreta',
      label: 'Demanda discreta',
      example: 'Misma economía, pero la demanda sólo puede tomar los valores de la tabla.',
      inputs: [
        ...priceInputs(),
        { kind: 'pairs', id: 'dem', label: 'Distribución de la demanda', symbol: 'X', xLabel: 'Demanda', yLabel: 'Probabilidad', default: [[10, 0.1], [20, 0.2], [30, 0.3], [40, 0.25], [50, 0.15]] },
      ],
      compute: (v) => {
        const { cu, co, p, c, s } = costsOf(v)
        const rows = [...pairs(v, 'dem')].sort((a, b) => a[0] - b[0])
        if (rows.length < 2) fail('Escribe al menos dos valores de demanda.')
        if (rows.some(([, q]) => q < 0)) fail('Las probabilidades no pueden ser negativas.')
        if (Math.abs(rows.reduce((t, [, q]) => t + q, 0) - 1) > 1e-6) fail('Las probabilidades deben sumar 1.')
        const cr = cu / (cu + co)
        let cum = 0, Q = rows[rows.length - 1][0]
        for (const [x, q] of rows) { cum += q; if (cum >= cr - 1e-9) { Q = x; break } }
        const sales = rows.reduce((t, [x, q]) => t + q * Math.min(x, Q), 0)
        const left = Q - sales
        return { cu, co, cr, Q, sales, left, profit: p * sales + s * left - c * Q }
      },
      steps: (v, r) => {
        const rows = [...pairs(v, 'dem')].sort((a, b) => a[0] - b[0])
        let cum = 0
        const table = rows.map(([x, q]) => { cum += q; return L`${fmt(x)}&${fmt(q)}&${fmt(cum)}&${cum >= r.cr - 1e-9 ? L`\checkmark` : ''}` })
        return [
          { label: 'Razón crítica', latex: L`\frac{C_u}{C_u+C_o}=\frac{${fmt(r.cu)}}{${fmt(r.cu + r.co)}}=${fmt(r.cr)}` },
          { label: 'Probabilidad acumulada $F(x)$. Se elige la **primera** demanda cuyo $F(x)$ alcanza la razón crítica', latex: L`\begin{array}{ccc|c}x&P(x)&F(x)&F\ge${fmt(r.cr)}\\${table.join(L`\\`)}\end{array}` },
          { label: 'Cantidad óptima', latex: L`Q^*=${fmt(r.Q)}` },
          { label: 'Utilidad esperada', latex: L`E[U]=p\,E[\min(X,Q^*)]+s\,E[(Q^*-X)^+]-cQ^*=${fmt(num(v, 'p'))}(${fmt(r.sales)})+${fmt(num(v, 's'))}(${fmt(r.left)})-${fmt(num(v, 'c'))}(${fmt(r.Q)})=${fmt(r.profit)}` },
        ]
      },
      answer: (_v, r) => L`Q^*=${fmt(r.Q)}\ \text{unidades}`,
      extras: (_v, r) => [
        { label: 'Razón crítica', latex: `${fmt(r.cr * 100, 3)}\\%` },
        { label: 'Utilidad esperada', latex: fmt(r.profit) },
      ],
      interpret: (_v, r) => [
        { tone: 'good', text: `La cantidad óptima es **${fmt(r.Q)}**: es la primera de la tabla donde la probabilidad acumulada llega a la razón crítica (${fmt(r.cr * 100, 3)}%).` },
        { tone: 'info', text: `Venderás en promedio $${fmt(r.sales)}$ unidades y te sobrarán $${fmt(r.left)}$; utilidad esperada **${fmt(r.profit)}**.` },
      ],
      visual: (v, r) => {
        const rows = [...pairs(v, 'dem')].sort((a, b) => a[0] - b[0])
        const lo = rows[0][0] - (rows[rows.length - 1][0] - rows[0][0]) * 0.15, hi = rows[rows.length - 1][0] + (rows[rows.length - 1][0] - rows[0][0]) * 0.15
        const pts: [number, number][] = [[lo, 0]]
        let cum = 0
        for (const [x, q] of rows) { pts.push([x, cum]); cum += q; pts.push([x, cum]) }
        pts.push([hi, 1])
        return {
          type: 'plot',
          curves: [
            { points: pts, tone: 'a', label: L`F(x)` },
            { points: [[lo, r.cr], [hi, r.cr]], tone: 'warn', dashed: true, label: L`\frac{C_u}{C_u+C_o}` },
          ],
          marks: [{ x: r.Q, y: r.cr, tone: 'accent', label: `Q* = ${fmt(r.Q)}` }],
          xRange: [lo, hi],
          yRange: [-0.03, 1.05],
          caption: 'La probabilidad acumulada sube a saltos. El óptimo es el primer escalón que alcanza (o rebasa) la línea punteada de la razón crítica.',
        }
      },
    }),
  ],
  commonMistakes: [
    'Comprar exactamente la demanda promedio: sólo es correcto si $C_u=C_o$.',
    'Calcular $C_u$ con el precio completo: la utilidad perdida por unidad es $p-c$ (no $p$).',
    'Olvidar el valor de rescate: $C_o=c-s$, no $c$.',
    'Usar este modelo para compras repetidas: aquí es una sola decisión antes de conocer la demanda.',
  ],
  related: ['punto-reorden', 'eoq'],
  keywords: ['vendedor de periodicos', 'newsvendor', 'razon critica', 'periodo unico', 'inventario perecedero', 'investigacion de operaciones', 'sobrante'],
}

export const INVENTARIOS: Formula[] = [eoq, epq, eoqFaltantes, puntoReorden, newsvendor]
