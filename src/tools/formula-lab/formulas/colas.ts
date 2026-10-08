import { calc, fail, num, type Formula, type NumberInput, type Values } from '../types'
import { fmt } from '../format'
import { L, sample } from './calculo-comun'

const lamInput: NumberInput = { kind: 'number', id: 'lam', label: 'Tasa de llegadas (clientes por unidad de tiempo)', symbol: L`\lambda`, default: 4, unit: '1/tiempo' }
const nInput: NumberInput = { kind: 'number', id: 'n', label: 'Probabilidad de que haya exactamente n en el sistema', symbol: 'n', default: 3 }

function positive(v: Values, id: string, name: string) {
  if (!(num(v, id) > 0)) fail(`${name} debe ser mayor que 0.`)
}
function wholeNumber(v: Values, id: string, name: string, min: number, max: number) {
  const x = num(v, id)
  if (!Number.isInteger(x) || x < min || x > max) fail(`${name} debe ser un entero entre ${min} y ${max}.`)
}

/** Distribución P_n recortada donde ya no importa, siempre incluyendo `must` */
function bars(pn: (n: number) => number, must: number, hardMax = 80) {
  const ps: number[] = []
  let cum = 0
  for (let k = 0; k <= hardMax; k++) {
    const q = pn(k)
    ps.push(q)
    cum += q
    if (cum > 0.9995 && k >= must) break
  }
  return { xs: ps.map((_, k) => k), ps }
}

// ─── M/M/1 ───────────────────────────────────────────────────────────────────

interface Mm1 { rho: number; L: number; Lq: number; W: number; Wq: number; P0: number; Pn: number; Pwait: number; Pwq: number; PgtN: number; mu: number }

const mm1: Formula = {
  id: 'mm1',
  name: 'Cola M/M/1 (un servidor)',
  category: 'colas',
  latex: L`L=\frac{\rho}{1-\rho}=\frac{\lambda}{\mu-\lambda}`,
  forms: [
    { label: 'Utilización', latex: L`\rho=\frac{\lambda}{\mu}<1` },
    { label: 'Clientes en la fila', latex: L`L_q=\frac{\rho^2}{1-\rho}=\frac{\lambda^2}{\mu(\mu-\lambda)}` },
    { label: 'Tiempo en el sistema y en la fila', latex: L`W=\frac{1}{\mu-\lambda}\qquad W_q=\frac{\rho}{\mu-\lambda}` },
    { label: 'Probabilidades', latex: L`P_0=1-\rho\qquad P_n=(1-\rho)\rho^n\qquad P(W>t)=e^{-(\mu-\lambda)t}` },
    { label: 'Ley de Little (vale casi siempre)', latex: L`L=\lambda W\qquad L_q=\lambda W_q` },
  ],
  summary: 'Un solo servidor, llegadas aleatorias (Poisson) y tiempos de servicio exponenciales: cuánta gente espera y cuánto tarda.',
  goal: 'Medir el desempeño de una fila con **un** servidor (una caja, un cajero, una ventanilla): tamaño de la fila, tiempo de espera y qué tan ocupado está el servidor.',
  variables: [
    { symbol: L`\lambda`, meaning: 'Tasa de **llegadas**: clientes que llegan por unidad de tiempo (por ejemplo, 4 por hora)' },
    { symbol: L`\mu`, meaning: 'Tasa de **servicio**: clientes que el servidor atiende por unidad de tiempo **si nunca descansa**. El tiempo medio de servicio es $1/\\mu$' },
    { symbol: L`\rho`, meaning: 'Utilización: fracción del tiempo que el servidor está ocupado, $\\rho=\\lambda/\\mu$' },
    { symbol: 'L,\\ L_q', meaning: 'Número promedio de clientes en el **sistema** (fila + servicio) y en la **fila**' },
    { symbol: 'W,\\ W_q', meaning: 'Tiempo promedio en el sistema y sólo en la fila' },
    { symbol: 'P_n', meaning: 'Probabilidad de que haya exactamente $n$ clientes en el sistema' },
  ],
  whenToUse: [
    'Una sola fila con un servidor, **llegadas aleatorias** e independientes, y tiempos de servicio con mucha variación (exponenciales).',
    'Requiere $\\lambda<\\mu$: si llegan más rápido de lo que se atiende, la fila crece sin límite.',
    'Si el servicio no es exponencial usa M/G/1; con varios servidores, M/M/s.',
  ],
  intuition: [
    'El servidor está ocupado una fracción $\\rho$ del tiempo. Cuando $\\rho$ es pequeño casi nunca hay fila. Cuando $\\rho\\to1$ la fila **se dispara** de forma no lineal: $L=\\frac{\\rho}{1-\\rho}$ es 1 con $\\rho=50\\%$, 9 con $90\\%$ y 19 con $95\\%$.',
    'Por eso un servidor “casi saturado” da un mal servicio aunque en promedio alcance a atender a todos: la variación aleatoria de las llegadas y de los servicios hace que se acumule gente.',
    '**Ley de Little**: el promedio de clientes en el sistema es la tasa de llegada por el tiempo que cada uno se queda, $L=\\lambda W$. Es muy general: vale para casi cualquier sistema estable.',
  ],
  derivation: {
    intro: 'La distribución sale de balancear los flujos entre estados (ecuaciones de balance):',
    steps: [
      { label: 'En equilibrio, lo que sube de $n$ a $n+1$ iguala lo que baja de $n+1$ a $n$', latex: L`\lambda P_n=\mu P_{n+1}\ \Rightarrow\ P_{n+1}=\rho P_n` },
      { label: 'Entonces', latex: L`P_n=\rho^nP_0` },
      { label: 'Las probabilidades suman 1 (serie geométrica)', latex: L`P_0\sum_{n=0}^{\infty}\rho^n=\frac{P_0}{1-\rho}=1\ \Rightarrow\ P_0=1-\rho` },
      { label: 'El promedio $L=\\sum nP_n$', latex: L`L=\sum_{n=0}^\infty n(1-\rho)\rho^n=\frac{\rho}{1-\rho}` },
    ],
  },
  calculators: [
    calc<Mm1>({
      id: 'mm1',
      label: 'Medidas de desempeño',
      example: 'Llegan 4 clientes por hora y el cajero atiende 6 por hora. Queremos saber la fila y la espera.',
      inputs: [
        lamInput,
        { kind: 'number', id: 'mu', label: 'Tasa de servicio (clientes por unidad de tiempo)', symbol: L`\mu`, default: 6, unit: '1/tiempo' },
        nInput,
        { kind: 'number', id: 't', label: 'Tiempo t para la probabilidad de espera', symbol: 't', default: 0.5 },
      ],
      compute: (v) => {
        positive(v, 'lam', 'La tasa de llegadas'); positive(v, 'mu', 'La tasa de servicio')
        const lam = num(v, 'lam'), mu = num(v, 'mu'), n = num(v, 'n'), t = num(v, 't')
        if (lam >= mu) fail('Si $\\lambda\\ge\\mu$ los clientes llegan más rápido de lo que se atiende y la fila **crece sin límite**: no hay régimen estable. Necesitas $\\lambda<\\mu$ (más servicio o menos llegadas).')
        wholeNumber(v, 'n', 'n', 0, 80)
        if (t < 0) fail('El tiempo $t$ no puede ser negativo.')
        const rho = lam / mu
        return {
          rho, mu, L: rho / (1 - rho), Lq: (rho * rho) / (1 - rho), W: 1 / (mu - lam), Wq: rho / (mu - lam),
          P0: 1 - rho, Pn: (1 - rho) * rho ** n, PgtN: rho ** (n + 1), Pwait: Math.exp(-(mu - lam) * t), Pwq: rho * Math.exp(-(mu - lam) * t),
        }
      },
      steps: (v, r) => {
        const lam = num(v, 'lam'), mu = num(v, 'mu'), n = num(v, 'n'), t = num(v, 't')
        return [
          { label: 'Utilización del servidor (debe ser menor que 1)', latex: L`\rho=\frac{\lambda}{\mu}=\frac{${fmt(lam)}}{${fmt(mu)}}=${fmt(r.rho)}` },
          { label: 'Clientes en el sistema', latex: L`L=\frac{\rho}{1-\rho}=\frac{${fmt(r.rho)}}{1-${fmt(r.rho)}}=${fmt(r.L)}` },
          { label: 'Clientes en la fila', latex: L`L_q=\frac{\rho^2}{1-\rho}=\frac{${fmt(r.rho)}^2}{${fmt(1 - r.rho)}}=${fmt(r.Lq)}` },
          { label: 'Tiempo en el sistema', latex: L`W=\frac{1}{\mu-\lambda}=\frac{1}{${fmt(mu)}-${fmt(lam)}}=${fmt(r.W)}` },
          { label: 'Tiempo en la fila', latex: L`W_q=\frac{\rho}{\mu-\lambda}=\frac{${fmt(r.rho)}}{${fmt(mu - lam)}}=${fmt(r.Wq)}` },
          { label: 'Comprobación con la ley de Little', latex: L`\lambda W=(${fmt(lam)})(${fmt(r.W)})=${fmt(lam * r.W)}=L` },
          { label: `Probabilidad de que haya exactamente ${fmt(n)}`, latex: L`P_{${fmt(n)}}=(1-\rho)\rho^{${fmt(n)}}=(${fmt(1 - r.rho)})(${fmt(r.rho)})^{${fmt(n)}}=${fmt(r.Pn)}` },
          { label: `Probabilidad de esperar más de $t=${fmt(t)}$ en el sistema`, latex: L`P(W>t)=e^{-(\mu-\lambda)t}=e^{-${fmt(mu - lam)}\cdot${fmt(t)}}=${fmt(r.Pwait)}` },
        ]
      },
      answer: (_v, r) => L`L=${fmt(r.L)}\quad W=${fmt(r.W)}`,
      extras: (_v, r) => [
        { label: 'Utilización', latex: `\\rho=${fmt(r.rho * 100, 4)}\\%` },
        { label: 'Fila promedio', latex: `L_q=${fmt(r.Lq)}` },
        { label: 'Espera en la fila', latex: `W_q=${fmt(r.Wq)}` },
        { label: 'Servidor desocupado', latex: `P_0=${fmt(r.P0)}` },
        { label: 'Más de n en el sistema', latex: `P(N>n)=${fmt(r.PgtN)}` },
        { label: 'Espera en la fila > t', latex: `P(W_q>t)=${fmt(r.Pwq)}` },
      ],
      interpret: (_v, r) => {
        const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
          { tone: 'good', text: `El servidor está ocupado el **${fmt(r.rho * 100, 3)}%** del tiempo y libre el ${fmt(r.P0 * 100, 3)}%. En promedio hay **${fmt(r.L, 4)}** clientes en el sistema, de los cuales ${fmt(r.Lq, 4)} esperan en la fila.` },
          { tone: 'info', text: `Cada cliente pasa en promedio $${fmt(r.W)}$ en el sistema, de los cuales $${fmt(r.Wq)}$ son de espera y $${fmt(1 / r.mu)}$ de servicio.` },
        ]
        if (r.rho > 0.85) out.push({ tone: 'warn', text: `Con $\\rho=${fmt(r.rho * 100, 3)}\\%$ el sistema está **casi saturado**: un pequeño aumento en las llegadas dispara la fila (con $\\rho=95\\%$, $L=19$). Conviene más capacidad.` })
        else out.push({ tone: 'info', text: `Si las llegadas subieran a $${fmt(0.9 * r.mu)}$ ($\\rho=90\\%$), el sistema tendría $L=9$ clientes en promedio: la espera crece mucho más rápido que la carga.` })
        return out
      },
      visual: (v, r) => {
        const b = bars(k => (1 - r.rho) * r.rho ** k, num(v, 'n'))
        return { type: 'bars', xs: b.xs, ps: b.ps, highlight: num(v, 'n') }
      },
    }),
  ],
  commonMistakes: [
    'Usar $\\lambda\\ge\\mu$: no existe estado estable (la fila crece indefinidamente).',
    'Mezclar unidades: $\\lambda$ y $\\mu$ deben ir en la misma unidad de tiempo (los dos por hora, o los dos por minuto).',
    'Confundir $L$ (en el sistema) con $L_q$ (sólo en la fila): $L=L_q+\\rho$.',
    'Creer que con $\\rho=90\\%$ “todavía hay margen”: la espera ya es 9 veces el tiempo de servicio.',
    'Usar $\\mu$ como el tiempo de servicio: es la **tasa** ($1/\\mu$ es el tiempo).',
  ],
  related: ['mms', 'mm1k', 'mg1'],
  keywords: ['colas', 'filas', 'mm1', 'm/m/1', 'teoria de colas', 'ley de little', 'tiempo de espera', 'utilizacion', 'investigacion de operaciones', 'poisson', 'exponencial'],
}

// ─── M/M/s ───────────────────────────────────────────────────────────────────

interface MmsRes { a: number; rho: number; P0: number; Pw: number; Lq: number; Wq: number; W: number; L: number; Pwq: number; Pn: number; sum: number; last: number; pn: (n: number) => number }

function mmsCompute(lam: number, mu: number, s: number, n: number, t: number): MmsRes {
  const a = lam / mu, rho = a / s
  let term = 1, sum = 0
  for (let k = 0; k < s; k++) { sum += term; term = (term * a) / (k + 1) }
  const last = term / (1 - rho)
  const P0 = 1 / (sum + last)
  const Pw = last * P0
  const Lq = (Pw * rho) / (1 - rho)
  const pn = (k: number) => {
    let q = P0, tk = 1
    for (let j = 1; j <= k; j++) { tk = (tk * a) / Math.min(j, s); q = P0 * tk }
    return k === 0 ? P0 : q
  }
  const Wq = Lq / lam
  return { a, rho, P0, Pw, Lq, Wq, W: Wq + 1 / mu, L: Lq + a, Pwq: Pw * Math.exp(-s * mu * (1 - rho) * t), Pn: pn(n), sum, last, pn }
}

const mms: Formula = {
  id: 'mms',
  name: 'Cola M/M/s (varios servidores) y fórmula de Erlang C',
  category: 'colas',
  latex: L`L_q=\frac{P_0\,a^s\,\rho}{s!\,(1-\rho)^2}`,
  forms: [
    { label: 'Carga ofrecida y utilización', latex: L`a=\frac\lambda\mu\qquad\rho=\frac{\lambda}{s\mu}<1` },
    { label: 'Probabilidad de que todo esté vacío', latex: L`P_0=\left[\sum_{n=0}^{s-1}\frac{a^n}{n!}+\frac{a^s}{s!\,(1-\rho)}\right]^{-1}` },
    { label: 'Probabilidad de esperar (Erlang C)', latex: L`P_w=\frac{a^s}{s!\,(1-\rho)}\,P_0` },
    { label: 'Tiempos y clientes', latex: L`W_q=\frac{L_q}{\lambda}\qquad W=W_q+\frac1\mu\qquad L=L_q+a` },
    { label: 'Probabilidad de esperar más de un tiempo t', latex: L`P(W_q>t)=P_w\,e^{-s\mu(1-\rho)t}` },
  ],
  summary: 'Una sola fila que alimenta a $s$ servidores iguales (cajas de un banco, agentes de un call center).',
  goal: 'Saber cuántos servidores se necesitan: probabilidad de que un cliente tenga que esperar, tiempo de espera y tamaño de la fila para distintos $s$.',
  variables: [
    { symbol: L`\lambda`, meaning: 'Tasa de llegadas al sistema' },
    { symbol: L`\mu`, meaning: 'Tasa de servicio **de cada servidor** (no del conjunto)' },
    { symbol: 's', meaning: 'Número de servidores' },
    { symbol: 'a', meaning: 'Carga ofrecida $a=\\lambda/\\mu$: cuántos servidores estarían ocupados en promedio (se mide en “erlangs”)' },
    { symbol: L`\rho`, meaning: 'Utilización de cada servidor, $\\rho=\\lambda/(s\\mu)$. Debe ser menor que 1' },
    { symbol: 'P_w', meaning: 'Probabilidad de que un cliente que llega tenga que **esperar** (todos ocupados): la fórmula de **Erlang C**' },
  ],
  whenToUse: [
    'Una fila común para $s$ servidores idénticos (no una fila por servidor).',
    'Para dimensionar: ¿cuántas cajas, agentes o ventanillas necesito para que la espera sea aceptable?',
  ],
  intuition: [
    'Con $s$ servidores se necesita al menos $a=\\lambda/\\mu$ de ellos sólo para **no saturarse** ($s>a$). El exceso sobre $a$ es el colchón que absorbe las rachas.',
    'Agregar un servidor reduce la espera mucho más de lo que se esperaría: pasando de $s=3$ a $s=4$ con $a=2.5$, la probabilidad de esperar baja de 70% a 34%.',
    '**Una fila para todos** es mejor que una fila por servidor: nadie se queda atrás de un cliente lento mientras otro servidor está libre.',
    'Un servidor $s$ veces más rápido (con tasa $s\\mu$) todavía es mejor que $s$ servidores lentos: la espera en la fila es parecida pero el servicio mismo es más corto.',
  ],
  calculators: [
    calc<MmsRes>({
      id: 'mms',
      label: 'Medidas de desempeño',
      example: 'Un banco recibe 10 clientes por hora y cada cajero atiende 4 por hora. ¿Qué pasa con 3 cajeros?',
      inputs: [
        { ...lamInput, default: 10 },
        { kind: 'number', id: 'mu', label: 'Tasa de servicio de cada servidor', symbol: L`\mu`, default: 4, unit: '1/tiempo' },
        { kind: 'number', id: 's', label: 'Número de servidores', symbol: 's', default: 3 },
        { ...nInput, default: 5 },
        { kind: 'number', id: 't', label: 'Tiempo t para la probabilidad de espera', symbol: 't', default: 0.1 },
      ],
      compute: (v) => {
        positive(v, 'lam', 'La tasa de llegadas'); positive(v, 'mu', 'La tasa de servicio')
        wholeNumber(v, 's', 'El número de servidores', 1, 100); wholeNumber(v, 'n', 'n', 0, 150)
        if (num(v, 't') < 0) fail('El tiempo $t$ no puede ser negativo.')
        const lam = num(v, 'lam'), mu = num(v, 'mu'), s = num(v, 's')
        if (lam >= s * mu) fail(`Con ${s} servidor${s === 1 ? '' : 'es'} la capacidad total es $s\\mu=${fmt(s * mu)}$, menor o igual que las llegadas ($\\lambda=${fmt(lam)}$): la fila crece sin límite. Necesitas más de $${fmt(lam / mu)}$ servidores.`)
        return mmsCompute(lam, mu, s, num(v, 'n'), num(v, 't'))
      },
      steps: (v, r) => {
        const lam = num(v, 'lam'), mu = num(v, 'mu'), s = num(v, 's'), n = num(v, 'n'), t = num(v, 't')
        return [
          { label: 'Carga ofrecida y utilización de cada servidor', latex: L`a=\frac{\lambda}{\mu}=\frac{${fmt(lam)}}{${fmt(mu)}}=${fmt(r.a)}\qquad\rho=\frac{a}{s}=\frac{${fmt(r.a)}}{${fmt(s)}}=${fmt(r.rho)}` },
          { label: `Probabilidad de que el sistema esté vacío (suma de ${s} términos + el término final)`, latex: L`P_0=\left[${fmt(r.sum)}+\frac{a^{${fmt(s)}}}{${fmt(s)}!\,(1-\rho)}\right]^{-1}=\left[${fmt(r.sum)}+${fmt(r.last)}\right]^{-1}=${fmt(r.P0)}` },
          { label: 'Probabilidad de que un cliente espere (Erlang C)', latex: L`P_w=${fmt(r.last)}\cdot${fmt(r.P0)}=${fmt(r.Pw)}` },
          { label: 'Clientes en la fila', latex: L`L_q=P_w\,\frac{\rho}{1-\rho}=${fmt(r.Pw)}\cdot\frac{${fmt(r.rho)}}{${fmt(1 - r.rho)}}=${fmt(r.Lq)}` },
          { label: 'Tiempos (ley de Little)', latex: L`W_q=\frac{L_q}{\lambda}=${fmt(r.Wq)}\qquad W=W_q+\frac1\mu=${fmt(r.Wq)}+${fmt(1 / mu)}=${fmt(r.W)}` },
          { label: 'Clientes en el sistema', latex: L`L=L_q+a=${fmt(r.Lq)}+${fmt(r.a)}=${fmt(r.L)}` },
          { label: `Probabilidad de que haya exactamente ${fmt(n)}`, latex: L`P_{${fmt(n)}}=${fmt(r.Pn)}` },
          { label: `Probabilidad de esperar más de $t=${fmt(t)}$ en la fila`, latex: L`P(W_q>t)=P_w\,e^{-s\mu(1-\rho)t}=${fmt(r.Pw)}\,e^{-${fmt(s * mu * (1 - r.rho))}\cdot${fmt(t)}}=${fmt(r.Pwq)}` },
        ]
      },
      answer: (_v, r) => L`P_w=${fmt(r.Pw)}\quad W_q=${fmt(r.Wq)}`,
      extras: (_v, r) => [
        { label: 'Utilización por servidor', latex: `\\rho=${fmt(r.rho * 100, 4)}\\%` },
        { label: 'Fila promedio', latex: `L_q=${fmt(r.Lq)}` },
        { label: 'Tiempo en el sistema', latex: `W=${fmt(r.W)}` },
        { label: 'Clientes en el sistema', latex: `L=${fmt(r.L)}` },
        { label: 'Espera en la fila > t', latex: `P(W_q>t)=${fmt(r.Pwq)}` },
      ],
      interpret: (v, r) => {
        const s = num(v, 's'), mu = num(v, 'mu'), lam = num(v, 'lam')
        const out: { tone: 'good' | 'info' | 'warn'; text: string }[] = [
          { tone: 'good', text: `Un cliente tiene que **esperar** con probabilidad **${fmt(r.Pw * 100, 3)}%** (todos los servidores ocupados). Cuando espera, lo hace en promedio $${fmt(1 / (s * mu - lam))}$.` },
          { tone: 'info', text: `En promedio hay $${fmt(r.Lq)}$ clientes en la fila y cada cliente pasa $${fmt(r.W)}$ en el sistema. Cada servidor está ocupado el ${fmt(r.rho * 100, 3)}% del tiempo.` },
        ]
        if (r.rho > 0.85) out.push({ tone: 'warn', text: 'La utilización por servidor es mayor al 85%: sistema muy cargado. Agregar un servidor reduciría mucho la espera.' })
        const next = s + 1
        if (lam < next * mu) {
          const m2 = mmsCompute(lam, mu, next, num(v, 'n'), num(v, 't'))
          out.push({ tone: 'info', text: `Con **${next}** servidores, la probabilidad de esperar bajaría a ${fmt(m2.Pw * 100, 3)}% y la espera en la fila a $${fmt(m2.Wq)}$.` })
        }
        out.push({ tone: 'info', text: `Un solo servidor ${s} veces más rápido (tasa $${fmt(s * mu)}$) daría un tiempo en el sistema de $${fmt(1 / (s * mu - lam))}$, menor que los $${fmt(r.W)}$ con ${s} servidores lentos.` })
        return out
      },
      visual: (v, r) => {
        const b = bars(r.pn, num(v, 'n'), 120)
        return { type: 'bars', xs: b.xs, ps: b.ps, highlight: num(v, 'n') }
      },
    }),
  ],
  commonMistakes: [
    'Usar $\\mu$ del conjunto: aquí $\\mu$ es la tasa de **cada** servidor.',
    'Tomar $\\rho=\\lambda/\\mu$ (eso es $a$): la utilización por servidor es $\\lambda/(s\\mu)$.',
    'Comparar con una fila por servidor: el modelo supone una **sola fila común**.',
    'Elegir $s$ con $\\rho$ muy cercana a 1 “porque alcanza”: la espera es enorme.',
  ],
  related: ['mm1', 'mm1k', 'mg1'],
  keywords: ['colas', 'mms', 'm/m/s', 'm/m/c', 'erlang c', 'multiples servidores', 'call center', 'cajas', 'investigacion de operaciones', 'teoria de colas'],
}

// ─── M/M/1/K ─────────────────────────────────────────────────────────────────

interface Mm1k { rho: number; P0: number; PK: number; lamEf: number; L: number; Lq: number; W: number; Wq: number; Pn: number; util: number; probs: number[] }

const mm1k: Formula = {
  id: 'mm1k',
  name: 'Cola M/M/1/K (capacidad limitada)',
  category: 'colas',
  latex: L`P_n=\frac{(1-\rho)\rho^n}{1-\rho^{K+1}}\qquad n=0,1,\ldots,K`,
  forms: [
    { label: 'Cuando ρ = 1', latex: L`P_n=\frac{1}{K+1}` },
    { label: 'Probabilidad de bloqueo (cliente rechazado)', latex: L`P_K=\frac{(1-\rho)\rho^K}{1-\rho^{K+1}}` },
    { label: 'Tasa efectiva de llegadas', latex: L`\lambda_{ef}=\lambda\,(1-P_K)` },
    { label: 'Clientes en el sistema', latex: L`L=\sum_{n=0}^{K}nP_n=\frac{\rho}{1-\rho}-\frac{(K+1)\rho^{K+1}}{1-\rho^{K+1}}` },
    { label: 'Little con la tasa efectiva', latex: L`W=\frac{L}{\lambda_{ef}}\qquad W_q=\frac{L_q}{\lambda_{ef}}\qquad L_q=L-(1-P_0)` },
  ],
  summary: 'Un servidor, pero el sistema sólo admite $K$ clientes; los que llegan con el sistema lleno **se pierden**.',
  goal: 'Medir cuánta gente se pierde (o rechaza) cuando la sala de espera es finita: un estacionamiento pequeño, un conmutador con $K$ líneas, un taller con espacio limitado.',
  variables: [
    { symbol: 'K', meaning: 'Capacidad máxima del sistema (fila **y** servicio)' },
    { symbol: L`\lambda,\ \mu`, meaning: 'Tasas de llegadas y de servicio' },
    { symbol: L`\rho`, meaning: '$\\lambda/\\mu$. Aquí **puede ser mayor que 1**: como el sistema se llena, no se desborda' },
    { symbol: 'P_K', meaning: 'Probabilidad de que el sistema esté lleno al llegar un cliente (se pierde)' },
    { symbol: L`\lambda_{ef}`, meaning: 'Llegadas que realmente entran al sistema' },
  ],
  whenToUse: [
    'Hay un espacio limitado de espera y los clientes que llegan a un sistema lleno **se van** (se pierden).',
    'Para decidir cuánto espacio de espera construir: compara $P_K$ para distintos $K$.',
  ],
  intuition: [
    'Es como M/M/1 pero cortando la distribución en $K$: la fila nunca pasa de $K-1$ esperando.',
    'Aunque $\\lambda>\\mu$ (llega más de lo que se atiende) el sistema **sí** es estable porque lo que sobra se pierde: la tasa que entra es $\\lambda_{ef}\\le\\mu$.',
    'Pasar de $K$ a $K+1$ reduce las pérdidas, pero con rendimientos decrecientes. Hay que comparar el costo del espacio contra el de los clientes perdidos.',
  ],
  calculators: [
    calc<Mm1k>({
      id: 'mm1k',
      label: 'Medidas de desempeño',
      example: 'Llegan 5 clientes por hora, se atienden 6 por hora y en el local caben 5 personas (incluida la que atienden).',
      inputs: [
        { ...lamInput, default: 5 },
        { kind: 'number', id: 'mu', label: 'Tasa de servicio (clientes por unidad de tiempo)', symbol: L`\mu`, default: 6, unit: '1/tiempo' },
        { kind: 'number', id: 'K', label: 'Capacidad del sistema', symbol: 'K', default: 5 },
      ],
      compute: (v) => {
        positive(v, 'lam', 'La tasa de llegadas'); positive(v, 'mu', 'La tasa de servicio')
        wholeNumber(v, 'K', 'La capacidad K', 1, 200)
        const lam = num(v, 'lam'), mu = num(v, 'mu'), K = num(v, 'K'), rho = lam / mu
        const w = Array.from({ length: K + 1 }, (_, k) => rho ** k)
        const tot = w.reduce((s, x) => s + x, 0)
        const probs = w.map(x => x / tot)
        const lamEf = lam * (1 - probs[K])
        const Lsys = probs.reduce((s, q, k) => s + k * q, 0)
        const Lq = Lsys - (1 - probs[0])
        return { rho, P0: probs[0], PK: probs[K], lamEf, L: Lsys, Lq, W: Lsys / lamEf, Wq: Lq / lamEf, Pn: probs[K], util: 1 - probs[0], probs }
      },
      steps: (v, r) => {
        const lam = num(v, 'lam'), mu = num(v, 'mu'), K = num(v, 'K')
        return [
          { label: 'Carga', latex: L`\rho=\frac{\lambda}{\mu}=\frac{${fmt(lam)}}{${fmt(mu)}}=${fmt(r.rho)}` },
          { label: 'Probabilidad de que el sistema esté vacío', latex: Math.abs(r.rho - 1) < 1e-12 ? L`P_0=\frac{1}{K+1}=${fmt(r.P0)}` : L`P_0=\frac{1-\rho}{1-\rho^{K+1}}=\frac{1-${fmt(r.rho)}}{1-${fmt(r.rho)}^{${fmt(K + 1)}}}=${fmt(r.P0)}` },
          { label: 'Probabilidad de que esté lleno (cliente perdido)', latex: L`P_K=P_0\,\rho^K=${fmt(r.P0)}\cdot${fmt(r.rho)}^{${fmt(K)}}=${fmt(r.PK)}` },
          { label: 'Llegadas que sí entran', latex: L`\lambda_{ef}=\lambda(1-P_K)=${fmt(lam)}(1-${fmt(r.PK)})=${fmt(r.lamEf)}` },
          { label: 'Clientes en el sistema y en la fila', latex: L`L=\sum nP_n=${fmt(r.L)}\qquad L_q=L-(1-P_0)=${fmt(r.L)}-${fmt(r.util)}=${fmt(r.Lq)}` },
          { label: 'Tiempos (Little con $\\lambda_{ef}$)', latex: L`W=\frac{L}{\lambda_{ef}}=\frac{${fmt(r.L)}}{${fmt(r.lamEf)}}=${fmt(r.W)}\qquad W_q=\frac{L_q}{\lambda_{ef}}=${fmt(r.Wq)}` },
        ]
      },
      answer: (_v, r) => L`P_K=${fmt(r.PK)}\quad L=${fmt(r.L)}\quad W=${fmt(r.W)}`,
      extras: (v, r) => [
        { label: 'Clientes perdidos por unidad de tiempo', latex: fmt(num(v, 'lam') - r.lamEf) },
        { label: 'Llegadas que entran', latex: `\\lambda_{ef}=${fmt(r.lamEf)}` },
        { label: 'Utilización del servidor', latex: `${fmt(r.util * 100, 4)}\\%` },
        { label: 'Fila promedio', latex: `L_q=${fmt(r.Lq)}` },
      ],
      interpret: (v, r) => [
        { tone: 'good', text: `Con probabilidad **${fmt(r.PK * 100, 3)}%** un cliente llega y encuentra el sistema lleno y se pierde: unos $${fmt(num(v, 'lam') - r.lamEf)}$ clientes por unidad de tiempo.` },
        { tone: 'info', text: `El servidor está ocupado el ${fmt(r.util * 100, 3)}% del tiempo y cada cliente que entra pasa $${fmt(r.W)}$ en el sistema.` },
        r.rho >= 1
          ? { tone: 'info', text: 'Como $\\rho\\ge1$ el servidor casi nunca descansa, pero el sistema no se desborda: lo que sobra se pierde.' }
          : { tone: 'info', text: 'Aumentar $K$ reduce las pérdidas pero con rendimientos decrecientes: compara el costo del espacio contra el de los clientes perdidos.' },
      ],
      visual: (v, r) => ({ type: 'bars', xs: r.probs.map((_, k) => k), ps: r.probs, highlight: num(v, 'K') }),
    }),
  ],
  commonMistakes: [
    'Exigir $\\rho<1$: aquí no hace falta.',
    'Usar $\\lambda$ en la ley de Little: hay que usar $\\lambda_{ef}=\\lambda(1-P_K)$.',
    'Confundir $K$ (capacidad **total**, con el que está en servicio) con la longitud máxima de la fila ($K-1$).',
  ],
  related: ['mm1', 'mms'],
  keywords: ['colas', 'capacidad limitada', 'mm1k', 'm/m/1/k', 'bloqueo', 'clientes perdidos', 'investigacion de operaciones', 'teoria de colas'],
}

// ─── M/G/1 ───────────────────────────────────────────────────────────────────

interface Mg1 { rho: number; Lq: number; L: number; Wq: number; W: number; cv: number; lqExp: number; lqDet: number }

const mg1: Formula = {
  id: 'mg1',
  name: 'Cola M/G/1 (Pollaczek–Khinchine)',
  category: 'colas',
  latex: L`L_q=\frac{\lambda^2\sigma^2+\rho^2}{2(1-\rho)}`,
  forms: [
    { label: 'Utilización', latex: L`\rho=\lambda\,E[S]<1` },
    { label: 'Resto de las medidas', latex: L`W_q=\frac{L_q}{\lambda}\qquad W=W_q+E[S]\qquad L=L_q+\rho` },
    { label: 'Con el coeficiente de variación c = σ / E[S]', latex: L`L_q=\frac{\rho^2(1+c^2)}{2(1-\rho)}` },
    { label: 'Servicio exponencial (c = 1): M/M/1', latex: L`L_q=\frac{\rho^2}{1-\rho}` },
    { label: 'Servicio constante (c = 0): M/D/1', latex: L`L_q=\frac{\rho^2}{2(1-\rho)}` },
  ],
  summary: 'Una cola de un servidor donde el tiempo de servicio puede tener **cualquier** distribución (sólo importan su media y su desviación).',
  goal: 'Ver cómo la **variabilidad** del servicio —no sólo su promedio— alarga la fila.',
  variables: [
    { symbol: L`\lambda`, meaning: 'Tasa de llegadas (Poisson)' },
    { symbol: 'E[S]', meaning: 'Tiempo medio de servicio ($=1/\\mu$)' },
    { symbol: L`\sigma`, meaning: 'Desviación estándar del tiempo de servicio' },
    { symbol: L`\rho`, meaning: 'Utilización $\\lambda E[S]$, debe ser menor que 1' },
    { symbol: 'c', meaning: 'Coeficiente de variación $\\sigma/E[S]$: qué tan variable es el servicio respecto a su promedio' },
  ],
  whenToUse: [
    'Servicio con una distribución que **no** es exponencial: una máquina que tarda casi lo mismo ($\\sigma$ pequeña), o un cajero con casos muy desiguales ($\\sigma$ grande).',
    'Para estimar el beneficio de **estandarizar** el servicio (reducir su variabilidad).',
  ],
  intuition: [
    'La fila depende de dos cosas: qué tan cargado está el servidor ($\\rho$) y qué tan **irregular** es el servicio ($1+c^2$).',
    'Con servicio exacto ($c=0$) la fila es **la mitad** de la de M/M/1. Reducir la variabilidad es una forma barata de reducir las esperas, sin comprar más capacidad.',
    'Con servicio más variable que el exponencial ($c>1$) la fila es todavía mayor: unos pocos servicios muy largos bloquean a muchos clientes.',
  ],
  calculators: [
    calc<Mg1>({
      id: 'mg1',
      label: 'Medidas de desempeño',
      example: 'Llegan 4 por hora; el servicio dura en promedio 0.15 h (9 minutos) con desviación 0.05 h.',
      inputs: [
        lamInput,
        { kind: 'number', id: 'ES', label: 'Tiempo medio de servicio', symbol: 'E[S]', default: 0.15, unit: 'tiempo' },
        { kind: 'number', id: 'sigma', label: 'Desviación estándar del servicio', symbol: L`\sigma`, default: 0.05, unit: 'tiempo' },
      ],
      compute: (v) => {
        positive(v, 'lam', 'La tasa de llegadas'); positive(v, 'ES', 'El tiempo medio de servicio')
        if (num(v, 'sigma') < 0) fail('La desviación estándar no puede ser negativa.')
        const lam = num(v, 'lam'), ES = num(v, 'ES'), sg = num(v, 'sigma'), rho = lam * ES
        if (rho >= 1) fail(`La utilización $\\rho=\\lambda E[S]=${fmt(rho)}$ es mayor o igual que 1: la fila crece sin límite. Necesitas $\\lambda E[S]<1$.`)
        const Lq = (lam * lam * sg * sg + rho * rho) / (2 * (1 - rho))
        return { rho, Lq, L: Lq + rho, Wq: Lq / lam, W: Lq / lam + ES, cv: sg / ES, lqExp: (rho * rho) / (1 - rho), lqDet: (rho * rho) / (2 * (1 - rho)) }
      },
      steps: (v, r) => {
        const lam = num(v, 'lam'), ES = num(v, 'ES'), sg = num(v, 'sigma')
        return [
          { label: 'Utilización', latex: L`\rho=\lambda E[S]=(${fmt(lam)})(${fmt(ES)})=${fmt(r.rho)}` },
          { label: 'Fórmula de Pollaczek–Khinchine', latex: L`L_q=\frac{\lambda^2\sigma^2+\rho^2}{2(1-\rho)}=\frac{(${fmt(lam)})^2(${fmt(sg)})^2+(${fmt(r.rho)})^2}{2(1-${fmt(r.rho)})}=\frac{${fmt(lam * lam * sg * sg + r.rho * r.rho)}}{${fmt(2 * (1 - r.rho))}}=${fmt(r.Lq)}` },
          { label: 'Espera en la fila (Little)', latex: L`W_q=\frac{L_q}{\lambda}=\frac{${fmt(r.Lq)}}{${fmt(lam)}}=${fmt(r.Wq)}` },
          { label: 'Tiempo en el sistema', latex: L`W=W_q+E[S]=${fmt(r.Wq)}+${fmt(ES)}=${fmt(r.W)}` },
          { label: 'Clientes en el sistema', latex: L`L=L_q+\rho=${fmt(r.Lq)}+${fmt(r.rho)}=${fmt(r.L)}` },
          { label: 'Coeficiente de variación del servicio', latex: L`c=\frac{\sigma}{E[S]}=\frac{${fmt(sg)}}{${fmt(ES)}}=${fmt(r.cv)}` },
        ]
      },
      answer: (_v, r) => L`L_q=${fmt(r.Lq)}\quad W_q=${fmt(r.Wq)}`,
      extras: (_v, r) => [
        { label: 'Utilización', latex: `\\rho=${fmt(r.rho * 100, 4)}\\%` },
        { label: 'Tiempo en el sistema', latex: `W=${fmt(r.W)}` },
        { label: 'Con servicio exponencial', latex: `L_q=${fmt(r.lqExp)}` },
        { label: 'Con servicio constante', latex: `L_q=${fmt(r.lqDet)}` },
      ],
      interpret: (_v, r) => [
        { tone: 'good', text: `La fila promedio es de **${fmt(r.Lq, 4)}** clientes y la espera de $${fmt(r.Wq)}$. El servidor trabaja el ${fmt(r.rho * 100, 3)}% del tiempo.` },
        r.cv < 1
          ? { tone: 'info', text: `Como el servicio es **más regular** que el exponencial ($c=${fmt(r.cv, 3)}<1$), la fila es menor que en M/M/1 (que daría $${fmt(r.lqExp)}$): se ahorra el ${fmt((1 - r.Lq / r.lqExp) * 100, 3)}%.` }
          : r.cv > 1
            ? { tone: 'warn', text: `Como el servicio es **más irregular** que el exponencial ($c=${fmt(r.cv, 3)}>1$), la fila es mayor que en M/M/1 (que daría $${fmt(r.lqExp)}$).` }
            : { tone: 'info', text: 'Con $c=1$ el servicio es exponencial y el resultado coincide con M/M/1.' },
        { tone: 'info', text: `Con servicio **exacto** ($\\sigma=0$) la fila sería $${fmt(r.lqDet)}$, la mitad que en M/M/1: estandarizar el servicio reduce la espera sin comprar capacidad.` },
      ],
      visual: (_v, r) => {
        const lq = (rho: number, c: number) => (rho * rho * (1 + c * c)) / (2 * (1 - rho))
        const hi = Math.max(r.rho * 1.5, 0.9)
        const top = Math.min(lq(hi, Math.max(r.cv, 1)), 25)
        return {
          type: 'plot',
          curves: [
            { points: sample(x => lq(x, 0), 0.02, Math.min(hi, 0.97), 160), tone: 'b', label: L`c=0\ \text{(constante)}` },
            { points: sample(x => lq(x, 1), 0.02, Math.min(hi, 0.97), 160), tone: 'a', label: L`c=1\ \text{(exponencial)}` },
            ...(Math.abs(r.cv - 1) > 1e-9 && r.cv > 0 ? [{ points: sample(x => lq(x, r.cv), 0.02, Math.min(hi, 0.97), 160), tone: 'accent' as const, label: L`c=${fmt(r.cv, 3)}\ \text{(tuyo)}` }] : []),
          ],
          marks: [{ x: r.rho, y: r.Lq, tone: 'warn', label: `L_q = ${fmt(r.Lq, 3)}` }],
          xRange: [0, Math.min(hi, 0.97)],
          yRange: [0, top],
          caption: 'Fila promedio contra utilización. Todas las curvas se disparan cuando $\\rho\\to1$, pero la de servicio constante crece a la mitad de velocidad que la exponencial.',
        }
      },
    }),
  ],
  commonMistakes: [
    'Usar la desviación estándar de las llegadas: aquí $\\sigma$ es la del **servicio**.',
    'Olvidar que $\\rho$ debe ser menor que 1.',
    'Mezclar $\\mu$ y $E[S]$: $E[S]=1/\\mu$.',
  ],
  related: ['mm1', 'mms'],
  keywords: ['mg1', 'm/g/1', 'pollaczek khinchine', 'servicio general', 'variabilidad', 'coeficiente de variacion', 'colas', 'investigacion de operaciones'],
}

export const COLAS: Formula[] = [mm1, mms, mm1k, mg1]
