import { calc, fail, list, num, pairs, type Formula, type Interpretation, type Values } from '../types'
import { fmt, fp, normalCDF, normalInv, pct, sum, writeStored } from '../format'
import { tStudentCDF } from '../../probability/distributions'

const L = String.raw

// ─── Shared helpers ──────────────────────────────────────────────────────────

interface LinSums {
  n: number
  sx: number; sy: number; sxy: number; sx2: number; sy2: number
  xs: number[]; ys: number[]
}

function linSums(pts: [number, number][]): LinSums {
  if (pts.length < 2) fail('Necesitas al menos 2 pares de datos.')
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  return {
    n: pts.length, xs, ys,
    sx: sum(xs), sy: sum(ys),
    sxy: sum(pts.map(([x, y]) => x * y)),
    sx2: sum(xs.map(x => x * x)),
    sy2: sum(ys.map(y => y * y)),
  }
}

function sumsStep(s: LinSums, withY2 = false) {
  return {
    label: 'Calculamos las sumas que pide la fórmula',
    latex: L`\sum x=${fmt(s.sx)},\quad \sum y=${fmt(s.sy)},\quad \sum xy=${fmt(s.sxy)},\quad \sum x^2=${fmt(s.sx2)}` +
      (withY2 ? L`,\quad \sum y^2=${fmt(s.sy2)}` : ''),
  }
}

export function strengthOfR(r: number): string {
  const a = Math.abs(r)
  if (a >= 0.9) return 'muy fuerte'
  if (a >= 0.7) return 'fuerte'
  if (a >= 0.5) return 'moderada'
  if (a >= 0.3) return 'débil'
  return 'muy débil o inexistente'
}

function interpretR(r: number): Interpretation[] {
  if (Number.isNaN(r)) return [{ tone: 'warn', text: 'Todos los valores de $y$ son iguales: no hay variación que correlacionar, así que $r$ no está definido.' }]
  const dir = r > 0 ? 'positiva' : 'negativa'
  const out: Interpretation[] = [
    {
      tone: Math.abs(r) >= 0.7 ? 'good' : 'info',
      text: `$r = ${fmt(r, 4)}$ indica una asociación lineal **${dir} ${strengthOfR(r)}**: ` +
        (r > 0 ? 'cuando $x$ aumenta, $y$ tiende a aumentar.' : 'cuando $x$ aumenta, $y$ tiende a disminuir.') +
        ' (Escala orientativa común: lo que se considera “fuerte” depende del área de estudio.)',
    },
    {
      tone: 'info',
      text: `$r^2 = ${fmt(r * r, 4)}$: la relación lineal con $x$ explica aproximadamente el **$${fmt(r * r * 100, 1)}$%** de la variación de $y$.`,
    },
    { tone: 'warn', text: 'Correlación describe asociación, **no demuestra causalidad**: puede haber una tercera variable detrás de ambas.' },
  ]
  return out
}

const signed = (x: number) => (x < 0 ? `- ${fmt(-x)}` : `+ ${fmt(x)}`)

function prefillRegression(pts: [number, number][]) {
  writeStored('jet-regression-rows', pts.map(([x, y]) => ({ x: String(x), y: String(y) })))
}

/** El coeficiente de variación sólo tiene sentido con datos no negativos (escala de razón) y media positiva */
function cvApplies(r: { xs: number[]; mean: number }) {
  return r.mean > 0 && r.xs.every(x => x >= 0)
}

// ─── Regresión lineal (plantilla base) ───────────────────────────────────────

interface RegResult extends LinSums {
  den: number
  b1: number
  b0: number
  r: number
  sse: number
}

const regresion: Formula = {
  id: 'regresion-lineal',
  name: 'Regresión lineal',
  category: 'estadistica',
  ref: '1.9.5',
  latex: L`\hat y = b_0 + b_1x`,
  forms: [
    { label: 'Pendiente', latex: L`b_1=\frac{n\sum xy-\sum x\sum y}{n\sum x^2-\left(\sum x\right)^2}` },
    { label: 'Intercepto', latex: L`b_0=\frac{\sum y\sum x^2-\sum x\sum xy}{n\sum x^2-\left(\sum x\right)^2}=\bar y-b_1\bar x` },
  ],
  summary: 'La recta que mejor resume la relación entre dos variables y permite predecir una a partir de la otra.',
  goal: 'Una recta $\\hat y = b_0 + b_1x$ que pase “lo más cerca posible” de todos los puntos a la vez, para describir cómo cambia $y$ cuando cambia $x$.',
  variables: [
    { symbol: L`\hat y`, meaning: 'Valor estimado (predicho) de $y$ para un cierto $x$' },
    { symbol: 'x', meaning: 'Variable independiente: la que conoces o controlas' },
    { symbol: 'b_1', meaning: 'Pendiente: cambio promedio de $y$ por cada unidad que aumenta $x$' },
    { symbol: 'b_0', meaning: 'Intercepto: valor de $\\hat y$ cuando $x = 0$' },
    { symbol: 'n', meaning: 'Número de pares de datos $(x, y)$' },
  ],
  whenToUse: [
    'Tienes pares de datos $(x, y)$ y quieres **predecir** $y$ a partir de $x$.',
    'La nube de puntos se ve aproximadamente como una línea (revísalo en el diagrama de dispersión).',
    'Quieres cuantificar **cuánto** cambia $y$ cuando $x$ cambia una unidad.',
  ],
  intuition: [
    'Ninguna recta pasa por todos los puntos, así que cada punto deja un **residuo**: la distancia vertical $e_i = y_i - \\hat y_i$ entre el dato real y lo que predice la recta.',
    'Si sumáramos los residuos tal cual, los positivos y los negativos se cancelarían. Por eso se elevan al cuadrado. En la gráfica cada residuo se dibuja como un **cuadrado** cuya área es $e_i^2$.',
    'La recta de regresión es la que hace **mínima el área total de esos cuadrados**: $\\min \\sum_{i=1}^{n}(y_i-\\hat y_i)^2$. De ahí el nombre de método de **mínimos cuadrados**.',
    'Cambia un dato en la calculadora y observa: un punto muy alejado genera un cuadrado enorme y “jala” la recta hacia él.',
  ],
  derivation: {
    intro: 'Buscamos los valores de $b_0$ y $b_1$ que hacen más pequeña la suma de errores al cuadrado.',
    steps: [
      { label: 'Función a minimizar', latex: L`S(b_0,b_1)=\sum_{i=1}^{n}\left(y_i-b_0-b_1x_i\right)^2` },
      { label: 'Derivamos respecto a $b_0$ e igualamos a 0', latex: L`\frac{\partial S}{\partial b_0}=-2\sum\left(y_i-b_0-b_1x_i\right)=0\;\Rightarrow\;\sum y=nb_0+b_1\sum x` },
      { label: 'Derivamos respecto a $b_1$ e igualamos a 0', latex: L`\frac{\partial S}{\partial b_1}=-2\sum x_i\left(y_i-b_0-b_1x_i\right)=0\;\Rightarrow\;\sum xy=b_0\sum x+b_1\sum x^2` },
      { label: 'Multiplicamos la 1ª por $\\sum x$, la 2ª por $n$ y restamos para eliminar $b_0$', latex: L`b_1\left(n\sum x^2-\left(\sum x\right)^2\right)=n\sum xy-\sum x\sum y` },
      { label: 'Despejamos la pendiente', latex: L`b_1=\frac{n\sum xy-\sum x\sum y}{n\sum x^2-\left(\sum x\right)^2}` },
      { label: 'Despejamos $b_0$ de la primera ecuación', latex: L`b_0=\frac{\sum y-b_1\sum x}{n}=\bar y-b_1\bar x` },
    ],
    outro: 'Consecuencia útil: como $b_0 = \\bar y - b_1\\bar x$, la recta **siempre pasa por el punto promedio** $(\\bar x, \\bar y)$. La forma de $b_0$ del formulario es la misma expresión con $b_1$ ya sustituido.',
  },
  calculators: [
    calc<RegResult>({
      id: 'recta',
      label: 'Calcular la recta',
      inputs: [
        { kind: 'pairs', id: 'data', label: 'Datos', symbol: '(x,y)', xLabel: 'x', yLabel: 'y', default: [[1, 2], [2, 4], [3, 5], [4, 4], [5, 6]] },
      ],
      compute: (v: Values) => {
        const s = linSums(pairs(v, 'data'))
        const den = s.n * s.sx2 - s.sx ** 2
        if (den === 0) fail('Todos los valores de $x$ son iguales: la recta sería vertical y no hay una pendiente única.')
        const b1 = (s.n * s.sxy - s.sx * s.sy) / den
        const b0 = (s.sy - b1 * s.sx) / s.n
        const denY = s.n * s.sy2 - s.sy ** 2
        const r = denY === 0 ? NaN : (s.n * s.sxy - s.sx * s.sy) / Math.sqrt(den * denY)
        const sse = sum(s.xs.map((x, i) => (s.ys[i] - (b0 + b1 * x)) ** 2))
        return { ...s, den, b1, b0, r, sse }
      },
      steps: (_v, r) => [
        { label: 'Contamos los pares de datos', latex: L`n=${r.n}` },
        sumsStep(r),
        {
          label: 'Pendiente',
          latex: L`b_1=\frac{${r.n}(${fmt(r.sxy)})-(${fmt(r.sx)})(${fmt(r.sy)})}{${r.n}(${fmt(r.sx2)})-(${fmt(r.sx)})^2}=\frac{${fmt(r.n * r.sxy - r.sx * r.sy)}}{${fmt(r.den)}}=${fmt(r.b1)}`,
        },
        {
          label: 'Intercepto',
          latex: L`b_0=\frac{\sum y-b_1\sum x}{n}=\frac{${fmt(r.sy)}-${fp(r.b1)}(${fmt(r.sx)})}{${r.n}}=${fmt(r.b0)}`,
        },
        { label: 'Sustituimos en la recta', latex: L`\hat y=${fmt(r.b0)} ${signed(r.b1)}x` },
        {
          label: 'Error que deja la recta (área total de los cuadrados)',
          latex: L`\sum\left(y_i-\hat y_i\right)^2=${fmt(r.sse)}`,
        },
      ],
      answer: (_v, r) => L`\hat y=${fmt(r.b0)} ${signed(r.b1)}x`,
      extras: (_v, r) => [
        { label: 'Correlación', latex: L`r=${fmt(r.r)}` },
        { label: 'Determinación', latex: L`r^2=${fmt(r.r * r.r)}` },
        { label: 'Punto promedio', latex: L`(\bar x,\bar y)=(${fmt(r.sx / r.n)},\ ${fmt(r.sy / r.n)})` },
      ],
      interpret: (_v, r) => {
        const minX = Math.min(...r.xs), maxX = Math.max(...r.xs)
        const out: Interpretation[] = []
        if (Math.abs(r.b1) < 1e-12) {
          out.push({ tone: 'info', text: 'La pendiente es 0: según los datos, $y$ no cambia (en promedio) cuando cambia $x$.' })
        } else {
          out.push({
            tone: 'good',
            text: `**Pendiente** $b_1 = ${fmt(r.b1)}$: por cada unidad que aumenta $x$, $y$ ${r.b1 > 0 ? 'aumenta' : 'disminuye'} en promedio $${fmt(Math.abs(r.b1))}$ unidades.`,
          })
        }
        out.push({
          tone: minX <= 0 && 0 <= maxX ? 'info' : 'warn',
          text: `**Intercepto** $b_0 = ${fmt(r.b0)}$: es lo que la recta predice cuando $x = 0$.` +
            (minX <= 0 && 0 <= maxX ? '' : ` Ojo: tus datos van de $x = ${fmt(minX)}$ a $x = ${fmt(maxX)}$, así que $x = 0$ es una extrapolación y $b_0$ puede no tener significado real.`),
        })
        out.push(...interpretR(r.r))
        if (r.n === 2) out.push({ tone: 'warn', text: 'Con sólo 2 puntos la recta pasa exactamente por ambos: no hay información sobre qué tan bien ajusta.' })
        out.push({ tone: 'info', text: `Para predecir, sustituye un $x$ dentro del rango observado ($${fmt(minX)}$ a $${fmt(maxX)}$). Fuera de él la tendencia podría no mantenerse.` })
        return out
      },
      visual: (v, r) => ({ type: 'regression', points: pairs(v, 'data'), b0: r.b0, b1: r.b1 }),
      tryInTool: (v) => ({
        path: '/regression',
        label: 'Probar con mis datos en Reg. Lineal',
        prefill: () => prefillRegression(pairs(v, 'data')),
      }),
    }),
  ],
  commonMistakes: [
    'Confundir $\\sum x^2$ (suma de los cuadrados) con $(\\sum x)^2$ (cuadrado de la suma).',
    '**Extrapolar**: usar la recta para predecir muy fuera del rango de $x$ observado.',
    'Interpretar el intercepto cuando $x = 0$ no tiene sentido (por ejemplo, una estatura de 0 cm).',
    'Concluir causalidad: la regresión mide asociación, no demuestra que $x$ cause $y$.',
    'Intercambiar $x$ e $y$: la recta de $y$ sobre $x$ **no** es la misma que la de $x$ sobre $y$.',
  ],
  related: ['correlacion-lineal', 'media-desviacion'],
  toolLink: { path: '/regression', label: 'Reg. Lineal' },
  keywords: ['minimos cuadrados', 'recta', 'pendiente', 'intercepto', 'prediccion', 'ajuste'],
}

// ─── Correlación lineal ──────────────────────────────────────────────────────

interface CorrResult extends LinSums { num: number; dx: number; dy: number; r: number }

const correlacion: Formula = {
  id: 'correlacion-lineal',
  name: 'Correlación lineal (r de Pearson)',
  category: 'estadistica',
  ref: '1.9.4',
  latex: L`r=\frac{n\sum xy-\sum x\sum y}{\sqrt{n\sum x^2-\left(\sum x\right)^2}\,\sqrt{n\sum y^2-\left(\sum y\right)^2}}`,
  summary: 'Un número entre −1 y 1 que mide qué tan fuerte y en qué dirección se relacionan linealmente dos variables.',
  goal: 'Un solo número que diga si los puntos $(x, y)$ se acomodan sobre una línea (y si sube o baja), sin importar las unidades de $x$ y de $y$.',
  variables: [
    { symbol: 'r', meaning: 'Coeficiente de correlación, siempre entre $-1$ y $1$' },
    { symbol: 'n', meaning: 'Número de pares de datos' },
    { symbol: L`\sum xy`, meaning: 'Suma de los productos $x_i y_i$' },
    { symbol: L`\sum x^2,\ \sum y^2`, meaning: 'Sumas de los cuadrados de cada variable' },
  ],
  whenToUse: [
    'Antes de hacer una regresión, junto con el diagrama de dispersión, para saber si una recta tiene sentido.',
    'Para comparar qué tan relacionadas están distintas parejas de variables.',
  ],
  intuition: [
    'Traza una cruz en el punto promedio $(\\bar x, \\bar y)$. Los puntos arriba-derecha y abajo-izquierda tienen $(x-\\bar x)(y-\\bar y) > 0$; los otros dos cuadrantes dan productos negativos.',
    'Si la mayoría de los puntos caen en los cuadrantes “positivos”, la suma es positiva y $r > 0$; cuanto más se alinean los puntos sobre una recta, más se acerca $r$ a $1$. Con los cuadrantes “negativos” pasa lo mismo hacia $-1$. Si están repartidos, se cancelan y $r \\approx 0$.',
    'Al dividir entre la dispersión de $x$ y de $y$, el resultado ya no depende de las unidades: medir en cm o en m da la misma $r$.',
  ],
  derivation: {
    steps: [
      { label: 'Centramos los datos en su promedio', latex: L`(x_i-\bar x),\quad (y_i-\bar y)` },
      { label: 'Sumamos los productos (covarianza sin dividir)', latex: L`S_{xy}=\sum (x_i-\bar x)(y_i-\bar y)=\sum xy-\frac{\sum x\sum y}{n}` },
      { label: 'Hacemos lo mismo con cada variable consigo misma', latex: L`S_{xx}=\sum x^2-\frac{\left(\sum x\right)^2}{n},\qquad S_{yy}=\sum y^2-\frac{\left(\sum y\right)^2}{n}` },
      { label: 'Normalizamos para quitar las unidades', latex: L`r=\frac{S_{xy}}{\sqrt{S_{xx}}\sqrt{S_{yy}}}` },
      { label: 'Multiplicando arriba y abajo por $n$ queda la forma del formulario', latex: L`r=\frac{n\sum xy-\sum x\sum y}{\sqrt{n\sum x^2-\left(\sum x\right)^2}\,\sqrt{n\sum y^2-\left(\sum y\right)^2}}` },
    ],
    outro: 'Por la desigualdad de Cauchy–Schwarz, $|S_{xy}| \\le \\sqrt{S_{xx}S_{yy}}$, y por eso $r$ nunca sale de $[-1, 1]$.',
  },
  calculators: [
    calc<CorrResult>({
      id: 'r',
      label: 'Calcular r',
      inputs: [
        { kind: 'pairs', id: 'data', label: 'Datos', symbol: '(x,y)', xLabel: 'x', yLabel: 'y', default: [[1, 2], [2, 4], [3, 5], [4, 4], [5, 6]] },
      ],
      compute: (v) => {
        const s = linSums(pairs(v, 'data'))
        const numr = s.n * s.sxy - s.sx * s.sy
        const dx = s.n * s.sx2 - s.sx ** 2
        const dy = s.n * s.sy2 - s.sy ** 2
        if (dx === 0) fail('Todos los valores de $x$ son iguales: no hay variación en $x$ y $r$ no está definido.')
        if (dy === 0) fail('Todos los valores de $y$ son iguales: no hay variación en $y$ y $r$ no está definido.')
        return { ...s, num: numr, dx, dy, r: numr / Math.sqrt(dx * dy) }
      },
      steps: (_v, r) => [
        { latex: L`n=${r.n}` },
        sumsStep(r, true),
        { label: 'Numerador', latex: L`n\sum xy-\sum x\sum y=${r.n}(${fmt(r.sxy)})-(${fmt(r.sx)})(${fmt(r.sy)})=${fmt(r.num)}` },
        { label: 'Dispersión de x', latex: L`n\sum x^2-\left(\sum x\right)^2=${r.n}(${fmt(r.sx2)})-(${fmt(r.sx)})^2=${fmt(r.dx)}` },
        { label: 'Dispersión de y', latex: L`n\sum y^2-\left(\sum y\right)^2=${r.n}(${fmt(r.sy2)})-(${fmt(r.sy)})^2=${fmt(r.dy)}` },
        { label: 'Dividimos', latex: L`r=\frac{${fmt(r.num)}}{\sqrt{${fmt(r.dx)}}\sqrt{${fmt(r.dy)}}}=\frac{${fmt(r.num)}}{${fmt(Math.sqrt(r.dx * r.dy))}}=${fmt(r.r)}` },
      ],
      answer: (_v, r) => L`r=${fmt(r.r)}`,
      extras: (_v, r) => [{ label: 'Determinación', latex: L`r^2=${fmt(r.r * r.r)}` }],
      interpret: (_v, r) => [
        ...interpretR(r.r),
        { tone: 'info', text: '$r$ sólo detecta relaciones **lineales**: una curva perfecta (como una parábola) puede dar $r \\approx 0$. Mira siempre la gráfica.' },
      ],
      visual: (v, r) => {
        const b1 = r.num / r.dx
        return { type: 'regression', points: pairs(v, 'data'), b0: (r.sy - b1 * r.sx) / r.n, b1 }
      },
      tryInTool: (v) => ({
        path: '/regression',
        label: 'Probar con mis datos en Reg. Lineal',
        prefill: () => prefillRegression(pairs(v, 'data')),
      }),
    }),
  ],
  commonMistakes: [
    'Creer que $r = 0$ significa “sin relación”: sólo significa sin relación **lineal**.',
    'Confundir correlación fuerte con causalidad.',
    'Leer $r = -0.9$ como una relación débil: el signo sólo indica la dirección; la fuerza es $|r|$.',
  ],
  related: ['regresion-lineal', 'media-desviacion'],
  toolLink: { path: '/regression', label: 'Reg. Lineal' },
  keywords: ['pearson', 'asociacion', 'covarianza', 'r cuadrada'],
}

// ─── Media y desviación estándar ─────────────────────────────────────────────

interface MeanResult { n: number; xs: number[]; total: number; mean: number; ss: number; s: number; sigma: number }

const mediaDesviacion: Formula = {
  id: 'media-desviacion',
  name: 'Media y desviación estándar',
  category: 'estadistica',
  ref: '1.9.2',
  latex: L`\bar x=\frac{\sum x}{n}\qquad s=\sqrt{\frac{\sum\left(x-\bar x\right)^2}{n-1}}`,
  forms: [
    { label: 'Desviación estándar poblacional', latex: L`\sigma=\sqrt{\frac{\sum\left(x-\mu\right)^2}{N}}` },
    { label: 'Varianza', latex: L`s^2=\frac{\sum\left(x-\bar x\right)^2}{n-1}` },
  ],
  summary: 'La media dice dónde está el centro de los datos; la desviación estándar, qué tan dispersos están alrededor de él.',
  goal: 'Dos números que resuman un conjunto de datos: un valor “típico” (la media) y la distancia típica de los datos a ese valor (la desviación estándar).',
  variables: [
    { symbol: L`\bar x`, meaning: 'Media de la muestra (promedio)' },
    { symbol: 's', meaning: 'Desviación estándar de una **muestra**' },
    { symbol: L`\sigma`, meaning: 'Desviación estándar de toda la **población**' },
    { symbol: 'n', meaning: 'Número de datos' },
    { symbol: L`x-\bar x`, meaning: 'Desviación de cada dato respecto a la media' },
  ],
  whenToUse: [
    'Para describir cualquier conjunto de datos numéricos.',
    'Usa $s$ (con $n-1$) cuando tus datos son una **muestra** y quieres estimar la población; usa $\\sigma$ (con $N$) cuando tienes a **todos** los elementos.',
  ],
  intuition: [
    'La media es el “punto de equilibrio”: las desviaciones positivas y negativas se cancelan exactamente, $\\sum(x-\\bar x)=0$.',
    'Precisamente por eso no podemos promediar las desviaciones tal cual. Las elevamos al cuadrado (todas quedan positivas), las promediamos y al final sacamos raíz para volver a las unidades originales.',
    '¿Por qué $n-1$? Como las desviaciones deben sumar 0, sólo $n-1$ de ellas son “libres”: la última queda determinada. Dividir entre $n-1$ corrige que $\\bar x$ se calculó con los mismos datos: así la varianza $s^2$ no subestima, en promedio, la varianza real $\\sigma^2$.',
  ],
  calculators: [
    calc<MeanResult>({
      id: 'stats',
      label: 'Calcular',
      inputs: [{ kind: 'list', id: 'xs', label: 'Datos', symbol: 'x', default: [4, 8, 6, 5, 3, 7, 9, 6] }],
      compute: (v) => {
        const xs = list(v, 'xs')
        if (xs.length < 2) fail('Necesitas al menos 2 datos.')
        const n = xs.length
        const total = sum(xs)
        const mean = total / n
        const ss = sum(xs.map(x => (x - mean) ** 2))
        return { n, xs, total, mean, ss, s: Math.sqrt(ss / (n - 1)), sigma: Math.sqrt(ss / n) }
      },
      steps: (_v, r) => {
        const shown = r.xs.length <= 8
        return [
          { label: 'Contamos y sumamos', latex: L`n=${r.n},\qquad \sum x=${fmt(r.total)}` },
          { label: 'Media', latex: L`\bar x=\frac{${fmt(r.total)}}{${r.n}}=${fmt(r.mean)}` },
          {
            label: 'Sumamos las desviaciones al cuadrado',
            latex: shown
              ? L`\sum(x-\bar x)^2=` + r.xs.map(x => L`(${fmt(x)}-${fmt(r.mean)})^2`).join('+') + L`=${fmt(r.ss)}`
              : L`\sum(x-\bar x)^2=${fmt(r.ss)}`,
          },
          { label: 'Varianza muestral', latex: L`s^2=\frac{${fmt(r.ss)}}{${r.n}-1}=${fmt(r.ss / (r.n - 1))}` },
          { label: 'Sacamos raíz', latex: L`s=\sqrt{${fmt(r.ss / (r.n - 1))}}=${fmt(r.s)}` },
        ]
      },
      answer: (_v, r) => L`\bar x=${fmt(r.mean)},\qquad s=${fmt(r.s)}`,
      extras: (_v, r) => [
        { label: 'Poblacional', latex: L`\sigma=${fmt(r.sigma)}` },
        { label: 'Varianza', latex: L`s^2=${fmt(r.s * r.s)}` },
        ...(cvApplies(r) ? [{ label: 'Coef. de variación', latex: L`\frac{s}{\bar x}=${pct(r.s / r.mean, 1)}` }] : []),
      ],
      interpret: (_v, r) => {
        const inside = r.xs.filter(x => Math.abs(x - r.mean) <= r.s).length
        return [
          { tone: 'good', text: `El valor típico es $\\bar x = ${fmt(r.mean)}$, y la distancia típica de los datos a la media es de unas $${fmt(r.s)}$ unidades.` },
          { tone: 'info', text: `${inside} de ${r.n} datos ($${fmt((inside / r.n) * 100, 0)}$%) caen entre $\\bar x - s = ${fmt(r.mean - r.s)}$ y $\\bar x + s = ${fmt(r.mean + r.s)}$. En datos con forma de campana esto suele rondar el 68%.` },
          ...(cvApplies(r) ? [{
            tone: 'info' as const,
            text: `Coeficiente de variación de $${pct(r.s / r.mean, 1)}$: ` +
              (r.s / r.mean < 0.15 ? 'datos bastante homogéneos' : r.s / r.mean < 0.3 ? 'dispersión moderada' : 'datos muy dispersos respecto a su media') +
              ' (según una escala orientativa; los umbrales varían por disciplina).',
          }] : []),
        ]
      },
    }),
  ],
  commonMistakes: [
    'Usar $n$ en lugar de $n-1$ con datos de una muestra (o al revés).',
    'Olvidar la raíz: $s^2$ es la varianza, no la desviación estándar.',
    'Comparar desviaciones de variables con unidades o escalas distintas; para eso sirve el coeficiente de variación.',
  ],
  related: ['puntuacion-z', 'distribucion-muestral'],
  keywords: ['promedio', 'varianza', 'dispersion', 'desviacion estandar', 'media aritmetica'],
}

// ─── Puntuación Z ────────────────────────────────────────────────────────────

const puntuacionZ: Formula = {
  id: 'puntuacion-z',
  name: 'Puntuación Z (valor estandarizado)',
  category: 'estadistica',
  ref: '1.9.2',
  latex: L`z=\frac{x-\mu}{\sigma}`,
  forms: [{ label: 'Con datos de una muestra', latex: L`z=\frac{x-\bar x}{s}` }],
  summary: 'Cuántas desviaciones estándar está un valor por encima o por debajo de la media.',
  goal: 'Poner en una escala común valores que vienen de distribuciones distintas, para saber qué tan “normal” o “raro” es un dato.',
  variables: [
    { symbol: 'z', meaning: 'Puntuación estandarizada (sin unidades)' },
    { symbol: 'x', meaning: 'El valor que quieres evaluar' },
    { symbol: L`\mu`, meaning: 'Media de la población' },
    { symbol: L`\sigma`, meaning: 'Desviación estándar de la población' },
  ],
  whenToUse: [
    'Para comparar valores de escalas distintas (por ejemplo, un 85 en un examen difícil contra un 90 en uno fácil).',
    'Para buscar probabilidades en la tabla de la distribución normal.',
    'Para detectar datos atípicos.',
  ],
  intuition: [
    'Restar $\\mu$ **mueve** la distribución para que su centro quede en 0. Dividir entre $\\sigma$ cambia la **unidad de medida**: ahora 1 significa “una desviación estándar”.',
    'Así, cualquier distribución normal $N(\\mu, \\sigma)$ se convierte en la normal estándar $N(0, 1)$. Por eso una sola tabla Z sirve para todos los problemas.',
  ],
  calculators: [
    calc<{ z: number; p: number }>({
      id: 'z',
      label: 'Calcular z',
      example: 'un 85 en un examen cuyo promedio fue 70 con desviación estándar 10.',
      inputs: [
        { kind: 'number', id: 'x', label: 'Valor', symbol: 'x', default: 85 },
        { kind: 'number', id: 'mu', label: 'Media', symbol: L`\mu`, default: 70 },
        { kind: 'number', id: 'sigma', label: 'Desviación estándar', symbol: L`\sigma`, default: 10 },
      ],
      compute: (v) => {
        const sigma = num(v, 'sigma')
        if (sigma <= 0) fail('La desviación estándar debe ser mayor que 0.')
        const z = (num(v, 'x') - num(v, 'mu')) / sigma
        return { z, p: normalCDF(z) }
      },
      steps: (v, r) => [
        { label: 'Distancia a la media', latex: L`x-\mu=${fmt(num(v, 'x'))}-${fp(num(v, 'mu'))}=${fmt(num(v, 'x') - num(v, 'mu'))}` },
        { label: 'La medimos en desviaciones estándar', latex: L`z=\frac{${fmt(num(v, 'x') - num(v, 'mu'))}}{${fmt(num(v, 'sigma'))}}=${fmt(r.z)}` },
        { label: 'Área a la izquierda (tabla Z)', latex: L`P(Z<${fmt(r.z, 2)})\approx${fmt(r.p)}` },
      ],
      answer: (_v, r) => L`z=${fmt(r.z)}`,
      extras: (_v, r) => [
        { label: 'Menores que x', latex: L`P(Z<z)=${pct(r.p)}` },
        { label: 'Mayores que x', latex: L`P(Z>z)=${pct(1 - r.p)}` },
      ],
      interpret: (_v, r) => {
        const a = Math.abs(r.z)
        const out: Interpretation[] = [{
          tone: 'good',
          text: r.z === 0 ? 'El valor está exactamente en la media.' :
            `El valor está **${fmt(a, 2)} desviaciones estándar ${r.z > 0 ? 'por encima' : 'por debajo'}** de la media.`,
        }, {
          tone: 'info',
          text: `Si la distribución es normal, aproximadamente el **$${fmt(r.p * 100, 1)}$%** de los valores son menores que $x$ (percentil ${Math.round(r.p * 100)}).`,
        }]
        if (a > 3) out.push({ tone: 'warn', text: 'Con $|z| > 3$ el valor es **muy inusual**: si los datos son aproximadamente normales, menos del 0.3% están tan lejos. Revisa si es un error de captura o un caso atípico real.' })
        else if (a > 2) out.push({ tone: 'warn', text: 'Con $|z| > 2$ el valor es **inusual**: si los datos son aproximadamente normales, sólo alrededor del 5% están tan lejos de la media.' })
        return out
      },
      visual: (_v, r) => ({ type: 'normal', z: r.z, shade: 'left', label: 'P(Z < z)' }),
      tryInTool: () => ({ path: '/probability/gauss', label: 'Abrir la tabla Z (Gauss)' }),
    }),
  ],
  commonMistakes: [
    'Invertir la resta: es $x - \\mu$, no $\\mu - x$ (cambia el signo de $z$).',
    'Dividir entre la varianza $\\sigma^2$ en lugar de la desviación estándar $\\sigma$.',
    'Leer la tabla como área a la derecha: la tabla del formulario da el área acumulada a la **izquierda**.',
  ],
  related: ['media-desviacion', 'intervalo-confianza', 'distribucion-muestral'],
  toolLink: { path: '/probability/gauss', label: 'Gauss (Tabla Z)' },
  keywords: ['estandarizar', 'tabla z', 'normal', 'percentil', 'atipico'],
}

// ─── Distribución muestral de la media ───────────────────────────────────────

const distribucionMuestral: Formula = {
  id: 'distribucion-muestral',
  name: 'Distribución muestral de la media',
  category: 'estadistica',
  latex: L`z=\frac{\bar x-\mu}{\sigma/\sqrt{n}}`,
  forms: [{ label: 'Error estándar', latex: L`\sigma_{\bar x}=\frac{\sigma}{\sqrt n}` }],
  summary: 'Qué tan probable es obtener cierto promedio muestral si conocemos la media y la desviación de la población.',
  goal: 'Entender cómo varía el **promedio** de una muestra de una muestra a otra, y calcular probabilidades sobre ese promedio.',
  variables: [
    { symbol: L`\bar x`, meaning: 'Media de la muestra' },
    { symbol: L`\mu`, meaning: 'Media de la población' },
    { symbol: L`\sigma`, meaning: 'Desviación estándar de la población' },
    { symbol: 'n', meaning: 'Tamaño de la muestra' },
    { symbol: L`\sigma/\sqrt n`, meaning: '**Error estándar**: la desviación estándar de los promedios' },
  ],
  whenToUse: [
    'Preguntas del tipo “¿cuál es la probabilidad de que el promedio de 36 piezas sea menor que…?”.',
    'Cuando la población es normal, o cuando $n$ es grande (Teorema del Límite Central). Como regla práctica $n \\ge 30$ suele bastar; con poblaciones muy sesgadas puede requerirse más.',
  ],
  intuition: [
    'Un dato individual puede ser muy alto o muy bajo, pero en un **promedio** los extremos se compensan entre sí. Por eso los promedios varían menos que los datos individuales.',
    'Esa variación se reduce con $\\sqrt n$, no con $n$: para reducir el error a la mitad necesitas **cuatro veces** más datos.',
    'El Teorema del Límite Central añade algo sorprendente: con $n$ suficientemente grande, $\\bar x$ se distribuye casi normal **aunque la población no lo sea**.',
  ],
  derivation: {
    steps: [
      { label: 'La media muestral es una suma dividida entre n', latex: L`\bar x=\frac{x_1+x_2+\cdots+x_n}{n}` },
      { label: 'Su valor esperado es la media poblacional', latex: L`E(\bar x)=\frac{n\mu}{n}=\mu` },
      { label: 'Si los datos son independientes, las varianzas se suman', latex: L`\operatorname{Var}(\bar x)=\frac{1}{n^2}\left(n\sigma^2\right)=\frac{\sigma^2}{n}` },
      { label: 'Sacamos raíz: el error estándar', latex: L`\sigma_{\bar x}=\frac{\sigma}{\sqrt n}` },
      { label: 'Estandarizamos igual que cualquier valor', latex: L`z=\frac{\bar x-\mu}{\sigma/\sqrt n}` },
    ],
  },
  calculators: [
    calc<{ se: number; z: number; p: number }>({
      id: 'prob',
      label: 'P(x̄ < valor)',
      example: 'una población con $\\mu = 50$ y $\\sigma = 12$, de la que tomas 36 datos y obtienes un promedio de 53.',
      inputs: [
        { kind: 'number', id: 'mu', label: 'Media poblacional', symbol: L`\mu`, default: 50 },
        { kind: 'number', id: 'sigma', label: 'Desv. poblacional', symbol: L`\sigma`, default: 12 },
        { kind: 'number', id: 'n', label: 'Tamaño de muestra', symbol: 'n', default: 36, step: 1 },
        { kind: 'number', id: 'xbar', label: 'Media muestral', symbol: L`\bar x`, default: 53 },
      ],
      compute: (v) => {
        const n = num(v, 'n'), sigma = num(v, 'sigma')
        if (n < 1 || !Number.isInteger(n)) fail('$n$ debe ser un entero positivo.')
        if (sigma <= 0) fail('$\\sigma$ debe ser mayor que 0.')
        const se = sigma / Math.sqrt(n)
        const z = (num(v, 'xbar') - num(v, 'mu')) / se
        return { se, z, p: normalCDF(z) }
      },
      steps: (v, r) => [
        { label: 'Error estándar', latex: L`\sigma_{\bar x}=\frac{${fmt(num(v, 'sigma'))}}{\sqrt{${num(v, 'n')}}}=${fmt(r.se)}` },
        { label: 'Estandarizamos el promedio', latex: L`z=\frac{${fmt(num(v, 'xbar'))}-${fp(num(v, 'mu'))}}{${fmt(r.se)}}=${fmt(r.z)}` },
        { label: 'Área a la izquierda', latex: L`P(\bar x<${fmt(num(v, 'xbar'))})=P(Z<${fmt(r.z, 2)})\approx${fmt(r.p)}` },
      ],
      answer: (v, r) => L`P(\bar x<${fmt(num(v, 'xbar'))})\approx${fmt(r.p)}`,
      extras: (v, r) => [
        { label: 'Mayor que', latex: L`P(\bar x>${fmt(num(v, 'xbar'))})\approx${fmt(1 - r.p)}` },
        { label: 'Error estándar', latex: L`\sigma_{\bar x}=${fmt(r.se)}` },
      ],
      interpret: (v, r) => {
        const out: Interpretation[] = [
          { tone: 'good', text: `Los promedios de muestras de tamaño ${num(v, 'n')} varían alrededor de $${fmt(num(v, 'mu'))}$ con una desviación de sólo $${fmt(r.se)}$, contra $${fmt(num(v, 'sigma'))}$ de los datos individuales.` },
          { tone: 'info', text: `Hay una probabilidad de **$${pct(r.p)}$** de que el promedio de una muestra sea menor que $${fmt(num(v, 'xbar'))}$.` },
        ]
        if (Math.abs(r.z) > 2) out.push({ tone: 'warn', text: `Obtener este promedio sería poco común si de verdad $\\mu = ${fmt(num(v, 'mu'))}$. Si te ocurre en la práctica, es evidencia de que la media real podría ser otra.` })
        if (num(v, 'n') < 30) out.push({ tone: 'warn', text: 'Con $n < 30$ este cálculo sólo es confiable si la población es aproximadamente normal.' })
        return out
      },
      visual: (_v, r) => ({ type: 'normal', z: r.z, shade: 'left', label: 'P(x̄ < valor)' }),
      tryInTool: () => ({ path: '/sampling', label: 'Ver todas las muestras posibles en Dist. Muestral' }),
    }),
  ],
  commonMistakes: [
    'Usar $\\sigma$ en lugar de $\\sigma/\\sqrt n$: estarías tratando el promedio como si fuera un dato individual.',
    'Aplicarlo con muestras pequeñas de poblaciones muy sesgadas.',
    'Olvidar la corrección por población finita: si muestreas **sin reemplazo** más del 5% de la población, el error estándar es $\\frac{\\sigma}{\\sqrt n}\\sqrt{\\frac{N-n}{N-1}}$ (es la que usa la herramienta Dist. Muestral).',
  ],
  related: ['puntuacion-z', 'intervalo-confianza', 't-student'],
  toolLink: { path: '/sampling', label: 'Dist. Muestral' },
  keywords: ['error estandar', 'limite central', 'tlc', 'media muestral'],
}

// ─── Intervalo de confianza ──────────────────────────────────────────────────

const intervaloConfianza: Formula = {
  id: 'intervalo-confianza',
  name: 'Intervalo de confianza para la media',
  category: 'estadistica',
  ref: '1.9.3',
  latex: L`\bar x-E<\mu<\bar x+E,\qquad E=z_{\alpha/2}\cdot\frac{\sigma}{\sqrt n}`,
  summary: 'Un rango de valores donde, con cierto nivel de confianza, se encuentra la media real de la población.',
  goal: 'Dar no sólo una estimación de $\\mu$ (el promedio de tu muestra), sino también un **margen de error** honesto alrededor de ella.',
  variables: [
    { symbol: L`\bar x`, meaning: 'Media de la muestra (estimación puntual)' },
    { symbol: 'E', meaning: 'Margen de error' },
    { symbol: L`z_{\alpha/2}`, meaning: 'Valor crítico: 1.645 (90%), 1.96 (95%), 2.576 (99%)' },
    { symbol: L`\sigma`, meaning: 'Desviación estándar de la población' },
    { symbol: 'n', meaning: 'Tamaño de la muestra' },
  ],
  whenToUse: [
    'Para reportar una estimación con su incertidumbre (“el promedio es 52 ± 3”).',
    'Cuando conoces $\\sigma$, o cuando $n$ es grande y puedes usar $s$ en su lugar.',
  ],
  intuition: [
    'Tu $\\bar x$ casi nunca es exactamente $\\mu$, pero sabemos cuánto suele alejarse: unas $\\sigma/\\sqrt n$ (el error estándar).',
    'El 95% de las muestras dan un $\\bar x$ a menos de $1.96$ errores estándar de $\\mu$. Si construyes $\\bar x \\pm E$, ese intervalo atrapa a $\\mu$ en el 95% de las muestras.',
    'Hay un balance: más confianza produce un intervalo **más ancho**, y más datos producen uno **más angosto**.',
  ],
  derivation: {
    steps: [
      { label: 'Por la distribución muestral', latex: L`Z=\frac{\bar x-\mu}{\sigma/\sqrt n}\sim N(0,1)` },
      { label: 'El área central es el nivel de confianza', latex: L`P\left(-z_{\alpha/2}<\frac{\bar x-\mu}{\sigma/\sqrt n}<z_{\alpha/2}\right)=1-\alpha` },
      { label: 'Multiplicamos por el error estándar', latex: L`-z_{\alpha/2}\frac{\sigma}{\sqrt n}<\bar x-\mu<z_{\alpha/2}\frac{\sigma}{\sqrt n}` },
      { label: 'Despejamos μ', latex: L`\bar x-E<\mu<\bar x+E` },
    ],
  },
  calculators: [
    calc<{ z: number; se: number; E: number }>({
      id: 'ic',
      label: 'Calcular intervalo',
      example: '40 mediciones con promedio 52 y $\\sigma = 8$.',
      inputs: [
        { kind: 'number', id: 'xbar', label: 'Media muestral', symbol: L`\bar x`, default: 52 },
        { kind: 'number', id: 'sigma', label: 'Desv. estándar', symbol: L`\sigma`, default: 8 },
        { kind: 'number', id: 'n', label: 'Tamaño de muestra', symbol: 'n', default: 40, step: 1 },
        { kind: 'number', id: 'conf', label: 'Confianza', symbol: L`\%`, default: 95, unit: '%' },
      ],
      compute: (v) => {
        const conf = num(v, 'conf'), n = num(v, 'n'), sigma = num(v, 'sigma')
        if (conf <= 0 || conf >= 100) fail('La confianza debe estar entre 0 y 100%.')
        if (n < 1 || !Number.isInteger(n)) fail('$n$ debe ser un entero positivo.')
        if (sigma <= 0) fail('$\\sigma$ debe ser mayor que 0.')
        const z = normalInv(1 - (1 - conf / 100) / 2)
        const se = sigma / Math.sqrt(n)
        return { z, se, E: z * se }
      },
      steps: (v, r) => [
        { label: 'Valor crítico', latex: L`\alpha=1-${fmt(num(v, 'conf') / 100)}=${fmt(1 - num(v, 'conf') / 100)}\;\Rightarrow\; z_{\alpha/2}=${fmt(r.z, 3)}` },
        { label: 'Error estándar', latex: L`\frac{\sigma}{\sqrt n}=\frac{${fmt(num(v, 'sigma'))}}{\sqrt{${num(v, 'n')}}}=${fmt(r.se)}` },
        { label: 'Margen de error', latex: L`E=${fmt(r.z, 3)}\cdot${fmt(r.se)}=${fmt(r.E)}` },
        { label: 'Intervalo', latex: L`${fmt(num(v, 'xbar'))}-${fmt(r.E)}<\mu<${fmt(num(v, 'xbar'))}+${fmt(r.E)}` },
      ],
      answer: (v, r) => L`${fmt(num(v, 'xbar') - r.E)}<\mu<${fmt(num(v, 'xbar') + r.E)}`,
      extras: (_v, r) => [{ label: 'Margen', latex: L`E=\pm${fmt(r.E)}` }],
      interpret: (v, r) => [
        { tone: 'good', text: `Con **$${fmt(num(v, 'conf'))}$% de confianza**, la media real de la población está entre $${fmt(num(v, 'xbar') - r.E)}$ y $${fmt(num(v, 'xbar') + r.E)}$.` },
        { tone: 'info', text: `Significa que si repitieras el muestreo muchas veces, el $${fmt(num(v, 'conf'))}$% de los intervalos construidos así contendrían a $\\mu$. No significa que $\\mu$ “se mueva”: lo aleatorio es el intervalo.` },
        { tone: 'info', text: `Para reducir el margen a la mitad ($\\pm${fmt(r.E / 2)}$) necesitarías $n = ${num(v, 'n') * 4}$ datos (4 veces más).` },
      ],
      visual: (_v, r) => ({ type: 'normal', z: r.z, shade: 'center', label: 'Nivel de confianza' }),
    }),
  ],
  commonMistakes: [
    'Decir “hay 95% de probabilidad de que $\\mu$ esté en este intervalo”. La interpretación correcta habla del **método**: el 95% de los intervalos así construidos aciertan.',
    'Usar $z_{\\alpha}$ en vez de $z_{\\alpha/2}$: el error se reparte en las **dos** colas.',
    'Usar $z$ con muestras pequeñas y $\\sigma$ desconocida; ahí corresponde la t de Student.',
  ],
  related: ['distribucion-muestral', 't-student', 'puntuacion-z'],
  keywords: ['margen de error', 'confianza', 'estimacion', 'z alfa'],
}

// ─── t de Student ────────────────────────────────────────────────────────────

const tStudent: Formula = {
  id: 't-student',
  name: 'Estadístico t de Student',
  category: 'estadistica',
  latex: L`t=\frac{\bar x-\mu_0}{s/\sqrt n},\qquad gl=n-1`,
  summary: 'Compara el promedio de una muestra con un valor de referencia cuando no se conoce σ.',
  goal: 'Decidir si la diferencia entre tu promedio $\\bar x$ y un valor esperado $\\mu_0$ es real, o si se puede explicar sólo por el azar del muestreo.',
  variables: [
    { symbol: 't', meaning: 'Estadístico t: cuántos errores estándar separan a $\\bar x$ de $\\mu_0$' },
    { symbol: L`\mu_0`, meaning: 'Valor de referencia (hipótesis)' },
    { symbol: 's', meaning: 'Desviación estándar de la **muestra**' },
    { symbol: 'gl', meaning: 'Grados de libertad, $n - 1$' },
  ],
  whenToUse: [
    'Cuando $\\sigma$ es desconocida y la estimas con $s$ (sobre todo con muestras pequeñas).',
    'Requisito: muestra aleatoria de una población **aproximadamente normal**. Con $n$ grande esta condición pierde importancia.',
    'Para pruebas de hipótesis sobre una media (“¿el llenado promedio es realmente 500 ml?”).',
  ],
  intuition: [
    'Es igual que $z$, pero usando $s$ (estimada de la propia muestra) en lugar de $\\sigma$. Esa estimación añade incertidumbre.',
    'Por eso la distribución t tiene **colas más gruesas** que la normal: valores grandes son menos sorprendentes. Conforme $n$ crece, $s$ se vuelve confiable y t se parece cada vez más a $Z$.',
  ],
  calculators: [
    calc<{ se: number; t: number; df: number; p: number }>({
      id: 't',
      label: 'Calcular t',
      example: '15 botellas que deberían tener 500 ml en promedio. Su promedio es 492 ml y $s = 12$.',
      inputs: [
        { kind: 'number', id: 'xbar', label: 'Media muestral', symbol: L`\bar x`, default: 492 },
        { kind: 'number', id: 'mu0', label: 'Valor de referencia', symbol: L`\mu_0`, default: 500 },
        { kind: 'number', id: 's', label: 'Desv. de la muestra', symbol: 's', default: 12 },
        { kind: 'number', id: 'n', label: 'Tamaño de muestra', symbol: 'n', default: 15, step: 1 },
      ],
      compute: (v) => {
        const n = num(v, 'n'), s = num(v, 's')
        if (n < 2 || !Number.isInteger(n)) fail('$n$ debe ser un entero mayor o igual a 2.')
        if (s <= 0) fail('$s$ debe ser mayor que 0.')
        const se = s / Math.sqrt(n)
        const t = (num(v, 'xbar') - num(v, 'mu0')) / se
        const df = n - 1
        const p = 2 * (1 - tStudentCDF(Math.abs(t), df))
        return { se, t, df, p: Math.min(1, Math.max(0, p)) }
      },
      steps: (v, r) => [
        { label: 'Error estándar estimado', latex: L`\frac{s}{\sqrt n}=\frac{${fmt(num(v, 's'))}}{\sqrt{${num(v, 'n')}}}=${fmt(r.se)}` },
        { label: 'Estadístico', latex: L`t=\frac{${fmt(num(v, 'xbar'))}-${fp(num(v, 'mu0'))}}{${fmt(r.se)}}=${fmt(r.t)}` },
        { label: 'Grados de libertad', latex: L`gl=${num(v, 'n')}-1=${r.df}` },
        { label: 'Valor p (dos colas)', latex: L`p=2\,P(T_{${r.df}}>|${fmt(r.t, 3)}|)\approx${fmt(r.p)}` },
      ],
      answer: (_v, r) => L`t=${fmt(r.t)}\quad(gl=${r.df})`,
      extras: (_v, r) => [{ label: 'Valor p', latex: L`p\approx${fmt(r.p)}` }],
      interpret: (v, r) => [
        { tone: 'info', text: `El promedio de la muestra está a $${fmt(Math.abs(r.t), 2)}$ errores estándar ${r.t >= 0 ? 'por encima' : 'por debajo'} de $\\mu_0 = ${fmt(num(v, 'mu0'))}$.` },
        r.p < 0.05
          ? { tone: 'good', text: `Con $p = ${fmt(r.p)} < 0.05$, una diferencia así sería rara si de verdad $\\mu = ${fmt(num(v, 'mu0'))}$. Hay **evidencia significativa** de que la media es distinta (al 5%).` }
          : { tone: 'warn', text: `Con $p = ${fmt(r.p)} \\ge 0.05$, la diferencia se puede explicar por azar: **no hay evidencia suficiente** para decir que la media es distinta de $${fmt(num(v, 'mu0'))}$.` },
        { tone: 'info', text: '“No hay evidencia” no es lo mismo que “demostramos que son iguales”: con una muestra más grande podría detectarse la diferencia.' },
      ],
      tryInTool: () => ({ path: '/probability/tstudent', label: 'Ver la distribución en T-Student' }),
    }),
  ],
  commonMistakes: [
    'Usar $n$ en lugar de $n - 1$ grados de libertad al buscar en la tabla.',
    'Usar la tabla $Z$ con muestras pequeñas.',
    'Confundir “no significativo” con “no hay diferencia”.',
  ],
  related: ['intervalo-confianza', 'distribucion-muestral'],
  toolLink: { path: '/probability/tstudent', label: 'T-Student' },
  keywords: ['prueba de hipotesis', 'valor p', 'grados de libertad', 'student'],
}

export const ESTADISTICA: Formula[] = [
  regresion, correlacion, mediaDesviacion, puntuacionZ, distribucionMuestral, intervaloConfianza, tStudent,
]

