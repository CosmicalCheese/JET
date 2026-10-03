import { calc, fail, num, pairs, type Formula, type Interpretation } from '../types'
import { comb, factorial, fmt, pct, sum } from '../format'

const L = String.raw

function requireInt(x: number, name: string, min = 0) {
  if (!Number.isInteger(x) || x < min) fail(`$${name}$ debe ser un entero mayor o igual a ${min}.`)
}

// ─── Permutaciones y combinaciones ───────────────────────────────────────────

const conteo: Formula = {
  id: 'combinaciones-permutaciones',
  name: 'Permutaciones y combinaciones',
  category: 'probabilidad',
  ref: '1.9.1',
  latex: L`{}_nP_r=\frac{n!}{(n-r)!}\qquad {}_nC_r=\frac{n!}{(n-r)!\,r!}`,
  summary: 'De cuántas formas se pueden elegir r elementos de n, según si el orden importa o no.',
  goal: 'Contar posibilidades sin tener que listarlas una por una: cuántos podios, comités, ordenamientos o manos de cartas existen.',
  variables: [
    { symbol: 'n', meaning: 'Total de elementos disponibles' },
    { symbol: 'r', meaning: 'Cuántos se eligen' },
    { symbol: 'n!', meaning: 'Factorial: $n\\cdot(n-1)\\cdots 2\\cdot 1$' },
    { symbol: L`{}_nP_r`, meaning: 'Permutaciones: el **orden importa**' },
    { symbol: L`{}_nC_r`, meaning: 'Combinaciones: el **orden no importa**' },
  ],
  whenToUse: [
    '**Permutación**: cuando cambiar el orden produce un resultado distinto (1º, 2º y 3º lugar; presidente, secretario y tesorero).',
    '**Combinación**: cuando sólo importa quién quedó elegido (un comité, los números de una lotería).',
    'Para calcular probabilidades clásicas: $P(A)=\\frac{\\text{casos favorables}}{\\text{casos posibles}}$.',
  ],
  intuition: [
    'Para el primer lugar tienes $n$ opciones, para el segundo $n-1$, y así hasta completar $r$ lugares: $n(n-1)\\cdots(n-r+1)$. Eso es exactamente $\\frac{n!}{(n-r)!}$.',
    'Si el orden no importa, cada grupo de $r$ elementos se contó $r!$ veces (una por cada forma de ordenarlo). Por eso se divide entre $r!$: ${}_nC_r = \\frac{{}_nP_r}{r!}$.',
  ],
  derivation: {
    steps: [
      { label: 'Principio multiplicativo', latex: L`{}_nP_r=n(n-1)(n-2)\cdots(n-r+1)` },
      { label: 'Completamos el factorial arriba y abajo', latex: L`{}_nP_r=\frac{n(n-1)\cdots(n-r+1)\cdot(n-r)!}{(n-r)!}=\frac{n!}{(n-r)!}` },
      { label: 'Cada grupo aparece r! veces en distinto orden', latex: L`{}_nC_r=\frac{{}_nP_r}{r!}=\frac{n!}{(n-r)!\,r!}` },
    ],
  },
  calculators: [
    calc<{ P: number; C: number }>({
      id: 'conteo',
      label: 'Calcular',
      inputs: [
        { kind: 'number', id: 'n', label: 'Total', symbol: 'n', default: 10, step: 1 },
        { kind: 'number', id: 'r', label: 'Se eligen', symbol: 'r', default: 3, step: 1 },
      ],
      compute: (v) => {
        const n = num(v, 'n'), r = num(v, 'r')
        requireInt(n, 'n'); requireInt(r, 'r')
        if (r > n) fail('No puedes elegir más elementos ($r$) de los que hay ($n$).')
        if (n > 170) fail('$n$ es demasiado grande para calcular el factorial (máximo 170).')
        return { P: factorial(n) / factorial(n - r), C: comb(n, r) }
      },
      steps: (v, r) => {
        const n = num(v, 'n'), k = num(v, 'r')
        const prod = Array.from({ length: k }, (_, i) => n - i)
        return [
          {
            label: 'Permutaciones: multiplicamos las opciones de cada lugar',
            latex: L`{}_{${n}}P_{${k}}=\frac{${n}!}{${n - k}!}=` + (k === 0 ? '1' : k <= 8 ? prod.join(L`\cdot `) + `=${fmt(r.P)}` : fmt(r.P)),
          },
          { label: `Cada grupo de ${k} se puede ordenar de $${k}!=${fmt(factorial(k))}$ formas`, latex: L`${k}!=${fmt(factorial(k))}` },
          { label: 'Combinaciones: quitamos los órdenes repetidos', latex: L`{}_{${n}}C_{${k}}=\frac{${fmt(r.P)}}{${fmt(factorial(k))}}=${fmt(r.C)}` },
        ]
      },
      answer: (v, r) => L`{}_{${num(v, 'n')}}P_{${num(v, 'r')}}=${fmt(r.P)},\qquad {}_{${num(v, 'n')}}C_{${num(v, 'r')}}=${fmt(r.C)}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Si el **orden importa** (por ejemplo, asignar 1º, 2º, 3º…), hay $${fmt(r.P)}$ formas de elegir ${num(v, 'r')} de ${num(v, 'n')}.` },
        { tone: 'good', text: `Si el **orden no importa** (sólo quién queda elegido), hay $${fmt(r.C)}$ grupos distintos.` },
        { tone: 'info', text: `Si eliges un grupo al azar, la probabilidad de acertar uno en particular es $\\frac{1}{${fmt(r.C)}}\\approx${fmt(1 / r.C)}$.` },
      ],
    }),
  ],
  commonMistakes: [
    'Usar combinaciones cuando el orden sí importa (o al revés). Pregúntate: ¿“ABC” y “CBA” son resultados distintos?',
    'Recordar que $0! = 1$, por eso ${}_nC_0 = {}_nC_n = 1$.',
    'Usarlas cuando se permiten **repeticiones**: un PIN de 4 dígitos tiene $10^4 = 10\\,000$ opciones, no ${}_{10}P_4 = 5040$. Estas fórmulas cuentan elecciones **sin repetir** elementos.',
  ],
  related: ['binomial'],
  keywords: ['factorial', 'conteo', 'combinatoria', 'ncr', 'npr'],
}

// ─── Binomial ────────────────────────────────────────────────────────────────

interface BinResult { coef: number; px: number; cum: number; mu: number; varr: number; table: number[] }

const binomial: Formula = {
  id: 'binomial',
  name: 'Distribución binomial',
  category: 'probabilidad',
  ref: '1.9.2',
  latex: L`P(x)=\frac{n!}{(n-x)!\,x!}\,p^x\,q^{\,n-x}`,
  forms: [{ label: 'Media y varianza', latex: L`\mu=np,\qquad \sigma^2=npq` }],
  summary: 'La probabilidad de obtener exactamente x éxitos en n intentos independientes con la misma probabilidad de éxito.',
  goal: 'Saber qué tan probable es cada posible número de éxitos cuando repites el mismo experimento de “sí/no” varias veces.',
  variables: [
    { symbol: 'n', meaning: 'Número de ensayos' },
    { symbol: 'x', meaning: 'Número de éxitos que te interesa ($0 \\le x \\le n$)' },
    { symbol: 'p', meaning: 'Probabilidad de éxito en cada ensayo' },
    { symbol: 'q', meaning: 'Probabilidad de fracaso, $q = 1 - p$' },
  ],
  whenToUse: [
    'Un número **fijo** $n$ de ensayos.',
    'Cada ensayo tiene sólo dos resultados (éxito o fracaso).',
    'La probabilidad $p$ es **la misma** en todos, y los ensayos son **independientes**.',
    'Ejemplos: piezas defectuosas en un lote, preguntas acertadas al azar en un examen, tiros libres encestados.',
  ],
  intuition: [
    'Una secuencia concreta con $x$ éxitos y $n-x$ fracasos (por ejemplo ÉÉFÉF…) tiene probabilidad $p^x q^{n-x}$, porque los ensayos son independientes y las probabilidades se multiplican.',
    'Pero hay muchas secuencias con el mismo número de éxitos: tantas como formas de elegir en qué $x$ posiciones van, ${}_nC_x$. Como son excluyentes, se suman todas, y de ahí sale la fórmula.',
  ],
  derivation: {
    steps: [
      { label: 'Probabilidad de una secuencia específica', latex: L`\underbrace{p\cdots p}_{x}\;\underbrace{q\cdots q}_{n-x}=p^x q^{n-x}` },
      { label: 'Número de secuencias con x éxitos', latex: L`{}_nC_x=\frac{n!}{(n-x)!\,x!}` },
      { label: 'Sumamos todas (son excluyentes)', latex: L`P(x)={}_nC_x\,p^x q^{n-x}` },
    ],
  },
  calculators: [
    calc<BinResult>({
      id: 'px',
      label: 'P(X = x)',
      inputs: [
        { kind: 'number', id: 'n', label: 'Ensayos', symbol: 'n', default: 10, step: 1 },
        { kind: 'number', id: 'p', label: 'Prob. de éxito', symbol: 'p', default: 0.3, step: 0.01 },
        { kind: 'number', id: 'x', label: 'Éxitos', symbol: 'x', default: 4, step: 1 },
      ],
      compute: (v) => {
        const n = num(v, 'n'), p = num(v, 'p'), x = num(v, 'x')
        requireInt(n, 'n', 1); requireInt(x, 'x')
        if (n > 1000) fail('Usa $n \\le 1000$.')
        if (p < 0 || p > 1) fail('$p$ debe estar entre 0 y 1.')
        if (x > n) fail('No puede haber más éxitos ($x$) que ensayos ($n$).')
        const table = Array.from({ length: n + 1 }, (_, k) => comb(n, k) * p ** k * (1 - p) ** (n - k))
        return { coef: comb(n, x), px: table[x], cum: sum(table.slice(0, x + 1)), mu: n * p, varr: n * p * (1 - p), table }
      },
      steps: (v, r) => {
        const n = num(v, 'n'), p = num(v, 'p'), x = num(v, 'x')
        return [
          { label: 'Probabilidad de fracaso', latex: L`q=1-${fmt(p)}=${fmt(1 - p)}` },
          { label: '¿Cuántas secuencias tienen exactamente x éxitos?', latex: L`{}_{${n}}C_{${x}}=\frac{${n}!}{${n - x}!\,${x}!}=${fmt(r.coef)}` },
          { label: 'Probabilidad de cada secuencia', latex: L`p^x q^{n-x}=${fmt(p)}^{${x}}\cdot${fmt(1 - p)}^{${n - x}}=${fmt(p ** x * (1 - p) ** (n - x), 6)}` },
          { label: 'Multiplicamos', latex: L`P(${x})=${fmt(r.coef)}\cdot${fmt(p ** x * (1 - p) ** (n - x), 6)}=${fmt(r.px, 6)}` },
          { label: 'Media y varianza', latex: L`\mu=np=${fmt(r.mu)},\qquad \sigma^2=npq=${fmt(r.varr)}` },
        ]
      },
      answer: (v, r) => L`P(X=${num(v, 'x')})=${fmt(r.px, 6)}`,
      extras: (v, r) => [
        { label: 'Acumulada', latex: L`P(X\le ${num(v, 'x')})=${fmt(r.cum, 4)}` },
        { label: 'Media', latex: L`\mu=${fmt(r.mu)}` },
        { label: 'Desv. estándar', latex: L`\sigma=${fmt(Math.sqrt(r.varr))}` },
      ],
      interpret: (v, r) => {
        const x = num(v, 'x'), n = num(v, 'n')
        const mode = r.table.indexOf(Math.max(...r.table))
        const out: Interpretation[] = [
          { tone: 'good', text: `Hay una probabilidad de **$${pct(r.px)}$** de obtener exactamente ${x} éxitos en ${n} intentos.` },
          { tone: 'info', text: `En promedio esperarías $\\mu = ${fmt(r.mu)}$ éxitos, y el resultado más probable es $x = ${mode}$.` },
          { tone: 'info', text: `La probabilidad de obtener **${x} o menos** éxitos es $${pct(r.cum)}$, y la de obtener **más de ${x}** es $${pct(1 - r.cum)}$.` },
        ]
        // Lo “raro” se juzga con la cola (un resultado así de extremo), no con P(X = x):
        // con n grande hasta el valor más probable tiene P(X = x) < 5%
        const lower = r.cum, upper = 1 - r.cum + r.px
        if (Math.min(lower, upper) < 0.05) {
          const tail = lower < upper ? `${x} o menos` : `${x} o más`
          out.push({ tone: 'warn', text: `Obtener **${tail}** éxitos tiene una probabilidad de sólo $${pct(Math.min(lower, upper))}$: es un resultado inusual. Si te ocurre en la práctica, quizá $p$ no es la que supones.` })
        }
        return out
      },
      visual: (v, r) => ({ type: 'bars', xs: r.table.map((_, k) => k), ps: r.table, highlight: num(v, 'x') }),
      tryInTool: () => ({ path: '/probability/binomial', label: 'Abrir en Probability → Binomial' }),
    }),
  ],
  commonMistakes: [
    'Usarla cuando los ensayos no son independientes (por ejemplo, extraer sin reemplazo de un grupo pequeño). Ahí corresponde la hipergeométrica.',
    'Confundir “exactamente $x$” con “al menos $x$”: para “al menos” hay que sumar varias probabilidades.',
    'Olvidar el coeficiente ${}_nC_x$ y calcular sólo $p^x q^{n-x}$.',
  ],
  related: ['combinaciones-permutaciones', 'poisson', 'valor-esperado'],
  toolLink: { path: '/probability/binomial', label: 'Binomial' },
  keywords: ['ensayos', 'bernoulli', 'exito', 'fracaso', 'discreta'],
}

// ─── Poisson ─────────────────────────────────────────────────────────────────

interface PoiResult { px: number; cum: number; table: number[] }

const poisson: Formula = {
  id: 'poisson',
  name: 'Distribución de Poisson',
  category: 'probabilidad',
  ref: '1.9.2',
  latex: L`P(x)=\frac{\mu^x e^{-\mu}}{x!}`,
  forms: [
    { label: 'Media y desviación', latex: L`\mu=\lambda t,\qquad \sigma=\sqrt{\mu}` },
    { label: 'Al aproximar una binomial', latex: L`\mu=np` },
  ],
  summary: 'La probabilidad de que un evento ocurra x veces en un intervalo (de tiempo, espacio, etc.) cuando conoces su promedio.',
  goal: 'Modelar conteos de eventos “raros” que ocurren al azar: llamadas por hora, errores por página, clientes por minuto.',
  variables: [
    { symbol: L`\mu`, meaning: 'Promedio de ocurrencias en el intervalo (también se escribe $\\lambda$)' },
    { symbol: 'x', meaning: 'Número de ocurrencias que te interesa ($0, 1, 2, \\ldots$)' },
    { symbol: 'e', meaning: 'Número de Euler $\\approx 2.71828$' },
  ],
  whenToUse: [
    'Los eventos ocurren de forma independiente y a un ritmo promedio constante.',
    'Cuentas ocurrencias en un intervalo fijo, sin un máximo claro.',
    'Como aproximación a la binomial cuando $n$ es grande y $p$ pequeña (con $\\mu = np$).',
  ],
  intuition: [
    'Divide el intervalo en $n$ pedacitos tan pequeños que en cada uno sólo puede ocurrir 0 o 1 evento, con probabilidad $p = \\mu/n$. Eso es una binomial.',
    'Al hacer los pedacitos infinitamente pequeños ($n\\to\\infty$), la binomial se convierte en Poisson. Por eso sólo necesita un parámetro: el promedio $\\mu$.',
    'Una propiedad curiosa: la media y la varianza son iguales, $\\sigma^2 = \\mu$.',
  ],
  derivation: {
    steps: [
      { label: 'Binomial con p = μ/n', latex: L`P(x)=\frac{n!}{(n-x)!\,x!}\left(\frac{\mu}{n}\right)^x\left(1-\frac{\mu}{n}\right)^{n-x}` },
      { label: 'Reacomodamos', latex: L`P(x)=\frac{\mu^x}{x!}\cdot\frac{n(n-1)\cdots(n-x+1)}{n^x}\cdot\left(1-\frac{\mu}{n}\right)^{n}\left(1-\frac{\mu}{n}\right)^{-x}` },
      { label: 'Cuando n → ∞', latex: L`\frac{n(n-1)\cdots(n-x+1)}{n^x}\to1,\qquad\left(1-\frac{\mu}{n}\right)^{n}\to e^{-\mu},\qquad\left(1-\frac{\mu}{n}\right)^{-x}\to1` },
      { label: 'Resultado', latex: L`P(x)=\frac{\mu^x e^{-\mu}}{x!}` },
    ],
  },
  calculators: [
    calc<PoiResult>({
      id: 'px',
      label: 'P(X = x)',
      inputs: [
        { kind: 'number', id: 'mu', label: 'Promedio', symbol: L`\mu`, default: 3 },
        { kind: 'number', id: 'x', label: 'Ocurrencias', symbol: 'x', default: 5, step: 1 },
      ],
      compute: (v) => {
        const mu = num(v, 'mu'), x = num(v, 'x')
        if (mu <= 0) fail('$\\mu$ debe ser mayor que 0.')
        if (mu > 500) fail('Usa $\\mu \\le 500$.')
        requireInt(x, 'x')
        if (x > 170) fail('Usa $x \\le 170$.')
        const top = Math.max(x + 2, Math.ceil(mu + 4 * Math.sqrt(mu)))
        const table: number[] = []
        let p = Math.exp(-mu)
        for (let k = 0; k <= top; k++) { table.push(p); p = (p * mu) / (k + 1) }
        return { px: table[x], cum: sum(table.slice(0, x + 1)), table }
      },
      steps: (v, r) => {
        const mu = num(v, 'mu'), x = num(v, 'x')
        return [
          { label: 'Sustituimos', latex: L`P(${x})=\frac{${fmt(mu)}^{${x}}\,e^{-${fmt(mu)}}}{${x}!}` },
          // con potencias enormes (p. ej. 100^160) los pasos intermedios desbordan; sólo mostramos el resultado
          ...(Number.isFinite(mu ** x) && Number.isFinite(factorial(x)) ? [
            { label: 'Evaluamos cada parte', latex: L`${fmt(mu)}^{${x}}=${fmt(mu ** x)},\quad e^{-${fmt(mu)}}=${fmt(Math.exp(-mu), 6)},\quad ${x}!=${fmt(factorial(x))}` },
            { label: 'Resultado', latex: L`P(${x})=\frac{${fmt(mu ** x)}\cdot${fmt(Math.exp(-mu), 6)}}{${fmt(factorial(x))}}=${fmt(r.px, 6)}` },
          ] : [{ label: 'Resultado', latex: L`P(${x})=${fmt(r.px, 6)}` }]),
        ]
      },
      answer: (v, r) => L`P(X=${num(v, 'x')})=${fmt(r.px, 6)}`,
      extras: (v, r) => [
        { label: 'Acumulada', latex: L`P(X\le ${num(v, 'x')})=${fmt(r.cum, 4)}` },
        { label: 'Desv. estándar', latex: L`\sigma=\sqrt{\mu}=${fmt(Math.sqrt(num(v, 'mu')))}` },
      ],
      interpret: (v, r) => {
        const mu = num(v, 'mu'), x = num(v, 'x')
        return [
          { tone: 'good', text: `Si en promedio ocurren $${fmt(mu)}$ eventos por intervalo, la probabilidad de que ocurran **exactamente ${x}** es $${pct(r.px)}$.` },
          { tone: 'info', text: `Probabilidad de **${x} o menos**: $${pct(r.cum)}$; de **más de ${x}**: $${pct(1 - r.cum)}$.` },
          { tone: 'info', text: `Lo normal es observar entre $${fmt(Math.max(0, mu - 2 * Math.sqrt(mu)), 1)}$ y $${fmt(mu + 2 * Math.sqrt(mu), 1)}$ eventos ($\\mu \\pm 2\\sigma$).` },
        ]
      },
      visual: (v, r) => ({ type: 'bars', xs: r.table.map((_, k) => k), ps: r.table, highlight: num(v, 'x') }),
      tryInTool: () => ({ path: '/probability/poisson', label: 'Abrir en Probability → Poisson' }),
    }),
  ],
  commonMistakes: [
    'Usar un $\\mu$ de otro intervalo: si el promedio es 6 por hora y preguntan por 30 minutos, usa $\\mu = 3$.',
    'Aplicarla cuando los eventos no son independientes (por ejemplo, llegadas en grupo).',
  ],
  related: ['binomial', 'valor-esperado'],
  toolLink: { path: '/probability/poisson', label: 'Poisson' },
  keywords: ['lambda', 'eventos raros', 'conteo', 'tasa', 'discreta'],
}

// ─── Valor esperado ──────────────────────────────────────────────────────────

const valorEsperado: Formula = {
  id: 'valor-esperado',
  name: 'Valor esperado y desviación de una distribución',
  category: 'probabilidad',
  ref: '1.9.1',
  latex: L`\mu=E(x)=\sum\left[x\cdot P(x)\right]`,
  forms: [{ label: 'Desviación estándar', latex: L`\sigma=\sqrt{\sum\left[x^2\cdot P(x)\right]-\mu^2}` }],
  summary: 'El promedio a largo plazo de una variable aleatoria: lo que obtendrías en promedio si repitieras el experimento muchísimas veces.',
  goal: 'Resumir una distribución de probabilidad en un “resultado promedio” y medir qué tanto se aleja cada resultado de él.',
  variables: [
    { symbol: 'x', meaning: 'Cada valor posible de la variable' },
    { symbol: 'P(x)', meaning: 'Probabilidad de ese valor (deben sumar 1)' },
    { symbol: L`\mu`, meaning: 'Valor esperado (media de la distribución)' },
    { symbol: L`\sigma`, meaning: 'Desviación estándar de la distribución' },
  ],
  whenToUse: [
    'Para decidir si un juego, apuesta o inversión conviene a largo plazo.',
    'Para calcular la media de cualquier distribución discreta dada como tabla.',
  ],
  intuition: [
    'Es un **promedio ponderado**: cada valor pesa según qué tan probable es. Un premio enorme con probabilidad diminuta aporta poco.',
    'El formulario muestra la conexión directa con la media de una tabla de frecuencias: $\\mu=\\frac{\\sum f x}{N}=\\sum x\\cdot\\frac{f}{N}$. La frecuencia relativa $f/N$ se convierte en la probabilidad $P(x)$.',
    'El valor esperado puede ser un valor que **nunca** ocurre en un solo intento (por ejemplo, 3.5 en un dado). Describe el largo plazo, no un resultado individual.',
  ],
  derivation: {
    steps: [
      { label: 'Media de datos agrupados', latex: L`\mu=\frac{\sum f\cdot x}{N}` },
      { label: 'Repartimos N dentro de la suma', latex: L`\mu=\sum x\cdot\frac{f}{N}` },
      { label: 'Con muchas repeticiones, f/N → P(x)', latex: L`\mu=\sum x\cdot P(x)` },
      { label: 'Igual para la varianza', latex: L`\sigma^2=\sum(x-\mu)^2P(x)=\sum x^2P(x)-\mu^2` },
    ],
  },
  calculators: [
    calc<{ mu: number; ex2: number; sigma: number; total: number }>({
      id: 'ev',
      label: 'Calcular',
      example: 'un juego donde pierdes 10 con probabilidad 0.9, ganas 50 con 0.08 o ganas 200 con 0.02.',
      inputs: [
        { kind: 'pairs', id: 'dist', label: 'Distribución', symbol: 'x,\\ P(x)', xLabel: 'x', yLabel: 'P(x)', default: [[-10, 0.9], [50, 0.08], [200, 0.02]] },
      ],
      compute: (v) => {
        const d = pairs(v, 'dist')
        if (d.length < 1) fail('Agrega al menos un valor.')
        if (d.some(([, p]) => p < 0 || p > 1)) fail('Cada $P(x)$ debe estar entre 0 y 1.')
        const total = sum(d.map(([, p]) => p))
        if (Math.abs(total - 1) > 1e-6) fail(`Las probabilidades deben sumar 1, y suman $${fmt(total, 6)}$.`)
        const mu = sum(d.map(([x, p]) => x * p))
        const ex2 = sum(d.map(([x, p]) => x * x * p))
        return { mu, ex2, sigma: Math.sqrt(Math.max(0, ex2 - mu * mu)), total }
      },
      steps: (v, r) => {
        const d = pairs(v, 'dist')
        return [
          { label: 'Verificamos que las probabilidades sumen 1', latex: L`\sum P(x)=${fmt(r.total)}\;\checkmark` },
          { label: 'Multiplicamos cada valor por su probabilidad y sumamos', latex: L`\mu=` + d.map(([x, p]) => L`(${fmt(x)})(${fmt(p)})`).join('+') + L`=${fmt(r.mu)}` },
          { label: 'Lo mismo con los cuadrados', latex: L`\sum x^2P(x)=` + d.map(([x, p]) => L`(${fmt(x)})^2(${fmt(p)})`).join('+') + L`=${fmt(r.ex2)}` },
          { label: 'Desviación estándar', latex: L`\sigma=\sqrt{${fmt(r.ex2)}-(${fmt(r.mu)})^2}=${fmt(r.sigma)}` },
        ]
      },
      answer: (_v, r) => L`\mu=${fmt(r.mu)},\qquad\sigma=${fmt(r.sigma)}`,
      interpret: (_v, r) => [
        {
          tone: r.mu >= 0 ? 'good' : 'warn',
          text: `Si repites el experimento muchas veces, el resultado **promedio por intento** tiende a $${fmt(r.mu)}$.` +
            (r.mu < 0 ? ' Si $x$ representa ganancias, a largo plazo **pierdes**: el juego no te conviene.' : r.mu > 0 ? ' Si $x$ representa ganancias, a largo plazo ganas.' : ' Es un juego “justo”.'),
        },
        { tone: 'info', text: `La desviación $\\sigma = ${fmt(r.sigma)}$ mide el riesgo: qué tanto puede variar un resultado individual respecto a ese promedio.` },
      ],
    }),
  ],
  commonMistakes: [
    'Olvidar restar $\\mu^2$ en la fórmula de $\\sigma$.',
    'Usar probabilidades que no suman 1.',
    'Esperar obtener $\\mu$ en un solo intento.',
  ],
  related: ['binomial', 'poisson', 'media-desviacion'],
  keywords: ['esperanza', 'media de una distribucion', 'promedio ponderado', 'apuesta'],
}

export const PROBABILIDAD: Formula[] = [conteo, binomial, poisson, valorEsperado]
