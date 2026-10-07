import { fail, type Formula, type NumberInput, type Values } from '../types'
import { fmt, fp } from '../format'
import { ARCCOT, ARCCSC, ARCSEC, ARCSEN, L, SEN, bare, chainCalc, coef, derivCalc, lin } from './calculo-comun'

const n = (v: Values, k: string) => v[k] as number

/** base^e bonito: 'x', 'x^{3}', '1' */
function pw(base: string, e: number): string {
  if (e === 0) return '1'
  if (e === 1) return base
  return `${base}^{${fmt(e)}}`
}

// ─── Derivadas de funciones algebraicas ──────────────────────────────────────

const pq: NumberInput[] = [
  { kind: 'number', id: 'p', label: 'u = px + q: valor de p', symbol: 'p', default: 2 },
  { kind: 'number', id: 'q', label: 'u = px + q: valor de q', symbol: 'q', default: 1 },
  { kind: 'number', id: 'r', label: 'v = rx + s: valor de r', symbol: 'r', default: 1 },
  { kind: 'number', id: 's', label: 'v = rx + s: valor de s', symbol: 's', default: 3 },
]

const reglasDerivacion: Formula = {
  id: 'reglas-derivacion',
  name: 'Derivadas de funciones algebraicas',
  category: 'derivadas',
  latex: L`\frac{d}{dx}(x^n)=nx^{n-1}`,
  forms: [
    { label: '1) Constante', latex: L`\frac{d}{dx}(c)=0` },
    { label: '2–3) La variable y una constante por ella', latex: L`\frac{d}{dx}(x)=1\qquad\frac{d}{dx}(cx)=c` },
    { label: '5) Suma y resta', latex: L`\frac{d}{dx}(u\pm v\pm w\pm\cdots)=u'\pm v'\pm w'\pm\cdots` },
    { label: '6) Potencia de una función (regla de la cadena)', latex: L`\frac{d}{dx}(u^n)=nu^{n-1}\,u'` },
    { label: '7) Producto', latex: L`\frac{d}{dx}(uv)=uv'+vu'` },
    { label: '8) Cociente', latex: L`\frac{d}{dx}\left(\frac{u}{v}\right)=\frac{vu'-uv'}{v^2}` },
  ],
  summary: 'Las reglas para derivar potencias, sumas, productos y cocientes: la base de todas las demás derivadas.',
  goal: 'La **pendiente** de una función en cada punto: qué tan rápido cambia $y$ cuando $x$ cambia un poquito. Con estas ocho reglas se deriva cualquier polinomio o fracción de polinomios.',
  variables: [
    { symbol: L`\frac{d}{dx}`, meaning: '“La derivada respecto de $x$ de…”. También se escribe $y\'$ o $f\'(x)$' },
    { symbol: 'u,\\ v,\\ w', meaning: 'Funciones de $x$ (por ejemplo $u = 2x+1$)' },
    { symbol: "u',\\ v'", meaning: 'Sus derivadas: $u\' = \\frac{du}{dx}$' },
    { symbol: 'c', meaning: 'Una constante (un número fijo)' },
    { symbol: 'n', meaning: 'El exponente; puede ser negativo o fraccionario' },
  ],
  whenToUse: [
    '**Potencia**: cualquier término $x^n$, incluso raíces ($\\sqrt x = x^{1/2}$) y fracciones ($\\frac1{x^2} = x^{-2}$).',
    '**Producto**: dos funciones de $x$ multiplicadas, como $(2x+1)(x+3)$.',
    '**Cociente**: una función de $x$ dividida entre otra.',
    '**Cadena** ($u^n$): una expresión completa elevada a una potencia, como $(3x-1)^5$. No olvides multiplicar por $u\'$.',
    'Para encontrar máximos y mínimos: donde $y\' = 0$ la tangente es horizontal.',
  ],
  intuition: [
    'La derivada es la **pendiente de la recta tangente**. Si te acercas mucho a la gráfica, toda curva parece una recta; la derivada es la pendiente de esa recta.',
    '**Potencia**: el exponente “baja” multiplicando y se le resta 1. $x^3 \\to 3x^2$. Es así porque al crecer $x$ un poquito $h$, $(x+h)^3 \\approx x^3 + 3x^2h$: lo que cambia es $3x^2$ por cada unidad de $h$.',
    '**Producto**: piensa en un rectángulo de lados $u$ y $v$. Si ambos crecen un poco, el área aumenta en dos franjas: $u\\cdot\\Delta v$ y $v\\cdot\\Delta u$. Por eso $(uv)\' = uv\' + vu\'$, **no** $u\'v\'$.',
    '**Cadena**: si $u$ cambia $u\'$ veces más rápido que $x$, todo lo que dependa de $u$ también se acelera en ese factor.',
  ],
  derivation: {
    intro: 'Todas salen de la definición de derivada. Por ejemplo, la regla de la potencia para $n=2$:',
    steps: [
      { label: 'Definición', latex: L`f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}{h}` },
      { label: 'Con $f(x)=x^2$', latex: L`\frac{(x+h)^2-x^2}{h}=\frac{x^2+2xh+h^2-x^2}{h}=2x+h` },
      { label: 'Cuando $h\\to0$', latex: L`f'(x)=2x` },
    ],
    outro: 'Para cualquier $n$ se expande $(x+h)^n$ con el binomio de Newton: sólo sobrevive el término $nx^{n-1}h$.',
  },
  calculators: [
    derivCalc({
      id: 'potencia',
      label: 'Potencia c·xⁿ',
      example: '$y = 3x^4$ evaluada en $x = 1$',
      inputs: [
        { kind: 'number', id: 'c', label: 'Coeficiente', symbol: 'c', default: 3 },
        { kind: 'number', id: 'n', label: 'Exponente', symbol: 'n', default: 4 },
      ],
      x0: 1,
      fTex: (v) => `${coef(n(v, 'c'))}${pw('x', n(v, 'n'))}`,
      f: (x, v) => n(v, 'c') * x ** n(v, 'n'),
      d: (x, v) => n(v, 'c') * n(v, 'n') * x ** (n(v, 'n') - 1),
      check: (x0, v) => {
        const e = n(v, 'n')
        if (!Number.isInteger(e) && x0 < 0) fail('Con exponente fraccionario, $x$ no puede ser negativo (sería la raíz de un negativo).')
        if (x0 === 0 && e < 1 && e !== 0) fail('En $x=0$ esa potencia (o su derivada) se divide entre cero. Elige otro punto.')
      },
      steps: (v, x0) => {
        const c = n(v, 'c'), e = n(v, 'n')
        return [
          { label: 'Regla 4: el exponente baja y se le resta 1', latex: L`\frac{d}{dx}(x^n)=nx^{n-1}` },
          { label: 'La constante sólo acompaña', latex: L`y'=${fmt(c)}\cdot${fp(e)}\,x^{${fmt(e)}-1}=${coef(c * e) || '1'}${pw('x', e - 1)}` },
          { label: `Evaluamos en $x_0=${fmt(x0)}$`, latex: L`y'(${fmt(x0)})=${fmt(c * e)}\cdot${fp(x0)}^{${fmt(e - 1)}}=${fmt(c * e * x0 ** (e - 1))}` },
        ]
      },
    }),
    derivCalc({
      id: 'producto',
      label: 'Producto u·v',
      example: '$y = (2x+1)(x+3)$',
      inputs: pq,
      x0: 1,
      fTex: (v) => `(${lin(n(v, 'p'), n(v, 'q'))})(${lin(n(v, 'r'), n(v, 's'))})`,
      f: (x, v) => (n(v, 'p') * x + n(v, 'q')) * (n(v, 'r') * x + n(v, 's')),
      d: (x, v) => (n(v, 'p') * x + n(v, 'q')) * n(v, 'r') + (n(v, 'r') * x + n(v, 's')) * n(v, 'p'),
      steps: (v, x0) => {
        const p = n(v, 'p'), q = n(v, 'q'), r = n(v, 'r'), s = n(v, 's')
        const u0 = p * x0 + q, v0 = r * x0 + s
        return [
          { label: 'Regla 7', latex: L`\frac{d}{dx}(uv)=uv'+vu'` },
          { label: 'Identificamos las dos funciones y sus derivadas', latex: L`u=${lin(p, q)},\ u'=${fmt(p)}\qquad v=${lin(r, s)},\ v'=${fmt(r)}` },
          { label: 'Sustituimos', latex: L`y'=(${lin(p, q)})(${fmt(r)})+(${lin(r, s)})(${fmt(p)})` },
          { label: `En $x_0=${fmt(x0)}$: $u=${fmt(u0)}$, $v=${fmt(v0)}$`, latex: L`y'=(${fmt(u0)})(${fmt(r)})+(${fmt(v0)})(${fmt(p)})=${fmt(u0 * r + v0 * p)}` },
        ]
      },
    }),
    derivCalc({
      id: 'cociente',
      label: 'Cociente u/v',
      example: '$y = \\frac{2x+1}{x+3}$',
      inputs: pq,
      x0: 1,
      fTex: (v) => L`\frac{${lin(n(v, 'p'), n(v, 'q'))}}{${lin(n(v, 'r'), n(v, 's'))}}`,
      f: (x, v) => (n(v, 'p') * x + n(v, 'q')) / (n(v, 'r') * x + n(v, 's')),
      d: (x, v) => {
        const u = n(v, 'p') * x + n(v, 'q'), w = n(v, 'r') * x + n(v, 's')
        return (w * n(v, 'p') - u * n(v, 'r')) / (w * w)
      },
      check: (x0, v) => {
        if (n(v, 'r') * x0 + n(v, 's') === 0) fail('En ese punto el denominador $v$ vale 0: la función no existe ahí (hay una asíntota vertical).')
      },
      steps: (v, x0) => {
        const p = n(v, 'p'), q = n(v, 'q'), r = n(v, 'r'), s = n(v, 's')
        const u0 = p * x0 + q, v0 = r * x0 + s
        return [
          { label: 'Regla 8: “el de abajo por la derivada del de arriba, menos el de arriba por la derivada del de abajo”', latex: L`\frac{d}{dx}\left(\frac{u}{v}\right)=\frac{vu'-uv'}{v^2}` },
          { label: 'Identificamos', latex: L`u=${lin(p, q)},\ u'=${fmt(p)}\qquad v=${lin(r, s)},\ v'=${fmt(r)}` },
          { label: 'Sustituimos', latex: L`y'=\frac{(${lin(r, s)})(${fmt(p)})-(${lin(p, q)})(${fmt(r)})}{(${lin(r, s)})^2}` },
          { label: `En $x_0=${fmt(x0)}$: $u=${fmt(u0)}$, $v=${fmt(v0)}$`, latex: L`y'=\frac{(${fmt(v0)})(${fmt(p)})-(${fmt(u0)})(${fmt(r)})}{${fp(v0)}^2}=\frac{${fmt(v0 * p - u0 * r)}}{${fmt(v0 * v0)}}=${fmt((v0 * p - u0 * r) / (v0 * v0))}` },
        ]
      },
    }),
    chainCalc({
      id: 'cadena',
      label: 'Potencia de una función uⁿ',
      example: '$y = (2x+1)^3$',
      rule: L`\frac{d}{dx}(u^n)=nu^{n-1}\,u'`,
      extra: [{ kind: 'number', id: 'n', label: 'Exponente', symbol: 'n', default: 3 }],
      p: 2, q: 1, x0: 1,
      fTex: (u, v) => pw(u, n(v, 'n')),
      dTex: (u, v) => `${fmt(n(v, 'n'))}${pw(u, n(v, 'n') - 1)}`,
      f: (u, v) => u ** n(v, 'n'),
      df: (u, v) => n(v, 'n') * u ** (n(v, 'n') - 1),
      domain: (u, v) => {
        const e = n(v, 'n')
        if (!Number.isInteger(e) && u < 0) return `En ese punto $u=${fmt(u)}$ es negativo y el exponente es fraccionario.`
        if (u === 0 && e < 1 && e !== 0) return 'En ese punto $u=0$ y la derivada se divide entre cero.'
        return null
      },
    }),
  ],
  commonMistakes: [
    'Derivar un producto como el producto de las derivadas: $(uv)\' \\ne u\'v\'$.',
    'Olvidar multiplicar por $u\'$ en la regla de la cadena: $\\frac{d}{dx}(2x+1)^3 = 3(2x+1)^2\\cdot 2$, **no** sólo $3(2x+1)^2$.',
    'En el cociente, invertir el orden del numerador: es $vu\' - uv\'$ (el orden importa por la resta).',
    'Restar 1 al exponente negativo en la dirección equivocada: $\\frac{d}{dx}x^{-2} = -2x^{-3}$, no $-2x^{-1}$.',
    'Derivar una constante como si fuera $x$: $\\frac{d}{dx}(5) = 0$.',
  ],
  related: ['derivadas-exp-log', 'derivadas-trigonometricas', 'integrales-inmediatas', 'leyes-exponentes'],
  keywords: ['derivada', 'regla de la potencia', 'regla del producto', 'regla del cociente', 'regla de la cadena', 'pendiente', 'recta tangente', 'calculo diferencial'],
}

// ─── Exponenciales y logarítmicas ────────────────────────────────────────────

const derivadasExpLog: Formula = {
  id: 'derivadas-exp-log',
  name: 'Derivadas de funciones exponenciales y logarítmicas',
  category: 'derivadas',
  latex: L`\frac{d}{dx}(e^u)=e^u\,u'`,
  forms: [
    { label: '10) Exponencial de otra base', latex: L`\frac{d}{dx}(a^u)=a^u\ln a\;u'` },
    { label: '11) Logaritmo natural', latex: L`\frac{d}{dx}(\ln u)=\frac{u'}{u}` },
    { label: '12) Logaritmo base 10', latex: L`\frac{d}{dx}(\log u)=\frac{\log e}{u}\,u'` },
  ],
  summary: '$e^x$ es la única función que es su propia derivada; el logaritmo se deriva como $\\frac{1}{u}$.',
  goal: 'Derivar crecimientos y decaimientos exponenciales (población, interés compuesto, radiactividad) y funciones con logaritmos.',
  variables: [
    { symbol: 'e', meaning: 'Número de Euler, $e\\approx2.71828$' },
    { symbol: 'a', meaning: 'Una base positiva distinta de 1' },
    { symbol: 'u', meaning: 'Una función de $x$; aquí $u = px+q$' },
    { symbol: "u'", meaning: 'La derivada de $u$ (regla de la cadena)' },
    { symbol: L`\ln`, meaning: 'Logaritmo natural (base $e$)' },
    { symbol: L`\log`, meaning: 'Logaritmo base 10. $\\log e \\approx 0.4343$' },
  ],
  whenToUse: [
    'Cuando la variable está **en el exponente**: $e^{3x}$, $2^x$.',
    'Para derivar logaritmos: $\\ln(5x-2)$, $\\log x$.',
    '**Derivación logarítmica**: para derivar $x^x$ o productos largos, se saca $\\ln$ de ambos lados primero.',
  ],
  intuition: [
    '$e^x$ crece exactamente a la velocidad de su propio valor: donde vale 10, su pendiente es 10. Por eso $(e^x)\' = e^x$.',
    'Cualquier otra base se reescribe con $e$: $a^x = e^{x\\ln a}$. Al derivar aparece el factor $\\ln a$ (para $a=2$, $\\ln 2\\approx0.693$: $2^x$ crece más lento que $e^x$).',
    'El logaritmo deshace la exponencial. Como $e^x$ crece cada vez más rápido, $\\ln x$ crece cada vez más **lento**: su pendiente es $\\frac{1}{x}$.',
  ],
  derivation: {
    intro: 'La derivada del logaritmo sale de derivar implícitamente su definición:',
    steps: [
      { label: 'Si $y = \\ln x$, entonces', latex: L`e^y=x` },
      { label: 'Derivamos ambos lados respecto de $x$', latex: L`e^y\,y'=1` },
      { label: 'Despejamos y usamos $e^y = x$', latex: L`y'=\frac{1}{e^y}=\frac{1}{x}` },
      { label: 'Para otra base, $\\log x = \\frac{\\ln x}{\\ln 10}$', latex: L`\frac{d}{dx}\log x=\frac{1}{x\ln10}=\frac{\log e}{x}` },
    ],
  },
  calculators: [
    chainCalc({
      id: 'exp',
      label: 'eᵘ',
      example: '$y = e^{2x+1}$ en $x=0$',
      rule: L`\frac{d}{dx}(e^u)=e^u\,u'`,
      p: 2, q: 1, x0: 0,
      fTex: (u) => `e^{${bare(u)}}`,
      dTex: (u) => `e^{${bare(u)}}`,
      f: (u) => Math.exp(u),
      df: (u) => Math.exp(u),
    }),
    chainCalc({
      id: 'base-a',
      label: 'aᵘ',
      example: '$y = 2^{3x}$ en $x=1$',
      rule: L`\frac{d}{dx}(a^u)=a^u\ln a\;u'`,
      extra: [{ kind: 'number', id: 'a', label: 'Base', symbol: 'a', default: 2 }],
      p: 3, q: 0, x0: 1,
      fTex: (u, v) => `${fmt(n(v, 'a'))}^{${bare(u)}}`,
      dTex: (u, v) => L`${fmt(n(v, 'a'))}^{${bare(u)}}\ln ${fmt(n(v, 'a'))}`,
      f: (u, v) => n(v, 'a') ** u,
      df: (u, v) => n(v, 'a') ** u * Math.log(n(v, 'a')),
      domain: (_u, v) => (n(v, 'a') > 0 && n(v, 'a') !== 1 ? null : 'La base $a$ debe ser positiva y distinta de 1.'),
    }),
    chainCalc({
      id: 'ln',
      label: 'ln u',
      example: '$y = \\ln(3x-1)$ en $x=1$',
      rule: L`\frac{d}{dx}(\ln u)=\frac{u'}{u}`,
      p: 3, q: -1, x0: 1,
      fTex: (u) => L`\ln ${u}`,
      dTex: (u) => L`\frac{1}{${bare(u)}}`,
      f: (u) => Math.log(u),
      df: (u) => 1 / u,
      domain: (u) => (u > 0 ? null : `En ese punto $u=${fmt(u)}$, y el logaritmo sólo existe para $u>0$.`),
    }),
    chainCalc({
      id: 'log',
      label: 'log u',
      example: '$y = \\log(5x)$ en $x=2$',
      rule: L`\frac{d}{dx}(\log u)=\frac{\log e}{u}\,u'`,
      p: 5, q: 0, x0: 2,
      fTex: (u) => L`\log ${u}`,
      dTex: (u) => L`\frac{\log e}{${bare(u)}}`,
      f: (u) => Math.log10(u),
      df: (u) => Math.LOG10E / u,
      domain: (u) => (u > 0 ? null : `En ese punto $u=${fmt(u)}$, y el logaritmo sólo existe para $u>0$.`),
    }),
  ],
  commonMistakes: [
    'Bajar el exponente como en una potencia: $\\frac{d}{dx}e^x \\ne xe^{x-1}$. La regla de la potencia sólo aplica si la variable está en la **base**.',
    'Olvidar la $u\'$: $\\frac{d}{dx}e^{3x} = 3e^{3x}$.',
    'Olvidar el $\\ln a$ en bases distintas de $e$: $\\frac{d}{dx}2^x = 2^x\\ln2$, no $2^x$.',
    'Confundir $\\ln$ (base $e$) con $\\log$ (base 10).',
  ],
  related: ['reglas-derivacion', 'propiedades-logaritmos', 'integrales-inmediatas'],
  keywords: ['derivada exponencial', 'derivada logaritmo', 'e a la x', 'ln', 'log', 'euler', 'regla de la cadena'],
}

// ─── Trigonométricas directas ────────────────────────────────────────────────

const RADIANES = 'Los ángulos están en **radianes**.'
const cosNonZero = (u: number) => (Math.abs(Math.cos(u)) < 1e-9 ? 'En ese punto $\\cos u=0$ y la función no existe (asíntota vertical).' : null)
const senNonZero = (u: number) => (Math.abs(Math.sin(u)) < 1e-9 ? 'En ese punto $\\operatorname{sen} u=0$ y la función no existe (asíntota vertical).' : null)

const derivadasTrig: Formula = {
  id: 'derivadas-trigonometricas',
  name: 'Derivadas de funciones trigonométricas',
  category: 'derivadas',
  latex: L`\frac{d}{dx}(${SEN} u)=\cos u\;u'`,
  forms: [
    { label: '14) Coseno', latex: L`\frac{d}{dx}(\cos u)=-${SEN} u\;u'` },
    { label: '15) Tangente', latex: L`\frac{d}{dx}(\tan u)=\sec^2u\;u'` },
    { label: '16) Cotangente', latex: L`\frac{d}{dx}(\cot u)=-\csc^2u\;u'` },
    { label: '17) Secante', latex: L`\frac{d}{dx}(\sec u)=\sec u\tan u\;u'` },
    { label: '18) Cosecante', latex: L`\frac{d}{dx}(\csc u)=-\csc u\cot u\;u'` },
  ],
  summary: 'Las seis derivadas trigonométricas. Las que empiezan con “co” llevan signo negativo.',
  goal: 'Derivar funciones periódicas: oscilaciones, ondas, movimiento circular. Por ejemplo, si una posición es $x(t)=\\operatorname{sen}t$, la velocidad es $\\cos t$.',
  variables: [
    { symbol: 'u', meaning: 'El ángulo, que puede ser una función de $x$; aquí $u = px+q$. **En radianes**.' },
    { symbol: "u'", meaning: 'La derivada del ángulo (regla de la cadena)' },
    { symbol: L`\sec,\ \csc,\ \cot`, meaning: '$\\sec u = \\frac{1}{\\cos u}$, $\\csc u = \\frac{1}{\\operatorname{sen} u}$, $\\cot u = \\frac{\\cos u}{\\operatorname{sen} u}$' },
  ],
  whenToUse: [
    'Para derivar cualquier expresión con $\\operatorname{sen}$, $\\cos$, $\\tan$, $\\cot$, $\\sec$ o $\\csc$.',
    'En física: si la posición es $x = A\\operatorname{sen}(\\omega t)$, la velocidad es $A\\omega\\cos(\\omega t)$.',
    'Al revés, leídas de derecha a izquierda, dan las integrales 8–17.',
  ],
  intuition: [
    'Mira la gráfica del seno: donde está en su punto más alto, su pendiente es 0 (y $\\cos$ vale 0 ahí). Donde cruza el eje subiendo, su pendiente es máxima, 1 (y $\\cos$ vale 1). La pendiente del seno **es** el coseno.',
    'El coseno es el seno adelantado $90^\\circ$; su pendiente es $-\\operatorname{sen}$. Derivar cuatro veces regresa a la función original: $\\operatorname{sen}\\to\\cos\\to-\\operatorname{sen}\\to-\\cos\\to\\operatorname{sen}$.',
    'Regla para recordar los signos: las “**co**” ($\\cos$, $\\cot$, $\\csc$) tienen derivada **negativa**.',
  ],
  derivation: {
    intro: 'Las de $\\tan$, $\\cot$, $\\sec$ y $\\csc$ salen de la regla del cociente. Por ejemplo, la tangente:',
    steps: [
      { label: 'Reescribimos', latex: L`\tan u=\frac{${SEN} u}{\cos u}` },
      { label: 'Regla del cociente', latex: L`\frac{\cos u\cdot\cos u-${SEN} u\cdot(-${SEN} u)}{\cos^2u}\,u'` },
      { label: 'Identidad pitagórica en el numerador', latex: L`=\frac{\cos^2u+${SEN}^2u}{\cos^2u}\,u'=\frac{1}{\cos^2u}\,u'=\sec^2u\;u'` },
    ],
  },
  calculators: [
    chainCalc({
      id: 'sen', label: 'sen u', example: `$y = \\operatorname{sen}(2x)$ en $x=0.5$. ${RADIANES}`,
      rule: L`\frac{d}{dx}(${SEN} u)=\cos u\;u'`, p: 2, q: 0, x0: 0.5,
      fTex: (u) => L`${SEN} ${u}`, dTex: (u) => L`\cos ${u}`,
      f: Math.sin, df: Math.cos,
    }),
    chainCalc({
      id: 'cos', label: 'cos u', example: `$y = \\cos(3x)$ en $x=0.4$. ${RADIANES}`,
      rule: L`\frac{d}{dx}(\cos u)=-${SEN} u\;u'`, p: 3, q: 0, x0: 0.4,
      fTex: (u) => L`\cos ${u}`, dTex: (u) => L`-${SEN} ${u}`,
      f: Math.cos, df: (u) => -Math.sin(u),
    }),
    chainCalc({
      id: 'tan', label: 'tan u', example: `$y = \\tan(x)$ en $x=0.8$. ${RADIANES}`,
      rule: L`\frac{d}{dx}(\tan u)=\sec^2u\;u'`, p: 1, q: 0, x0: 0.8,
      fTex: (u) => L`\tan ${u}`, dTex: (u) => L`\sec^2${u}`,
      f: Math.tan, df: (u) => 1 / Math.cos(u) ** 2, domain: cosNonZero,
    }),
    chainCalc({
      id: 'cot', label: 'cot u', example: `$y = \\cot(x)$ en $x=1$. ${RADIANES}`,
      rule: L`\frac{d}{dx}(\cot u)=-\csc^2u\;u'`, p: 1, q: 0, x0: 1,
      fTex: (u) => L`\cot ${u}`, dTex: (u) => L`-\csc^2${u}`,
      f: (u) => 1 / Math.tan(u), df: (u) => -1 / Math.sin(u) ** 2, domain: senNonZero,
    }),
    chainCalc({
      id: 'sec', label: 'sec u', example: `$y = \\sec(x)$ en $x=0.6$. ${RADIANES}`,
      rule: L`\frac{d}{dx}(\sec u)=\sec u\tan u\;u'`, p: 1, q: 0, x0: 0.6,
      fTex: (u) => L`\sec ${u}`, dTex: (u) => L`\sec ${u}\tan ${u}`,
      f: (u) => 1 / Math.cos(u), df: (u) => Math.tan(u) / Math.cos(u), domain: cosNonZero,
    }),
    chainCalc({
      id: 'csc', label: 'csc u', example: `$y = \\csc(x)$ en $x=1.2$. ${RADIANES}`,
      rule: L`\frac{d}{dx}(\csc u)=-\csc u\cot u\;u'`, p: 1, q: 0, x0: 1.2,
      fTex: (u) => L`\csc ${u}`, dTex: (u) => L`-\csc ${u}\cot ${u}`,
      f: (u) => 1 / Math.sin(u), df: (u) => -1 / (Math.sin(u) * Math.tan(u)), domain: senNonZero,
    }),
  ],
  commonMistakes: [
    'Usar grados: estas fórmulas sólo valen con el ángulo en **radianes**. En grados aparecería un factor extra $\\frac{\\pi}{180}$.',
    'Olvidar el signo negativo en las “co”: $\\frac{d}{dx}\\cos x = -\\operatorname{sen}x$.',
    'Olvidar la $u\'$: $\\frac{d}{dx}\\operatorname{sen}(5x) = 5\\cos(5x)$.',
    'Escribir $\\sec^2u$ como $\\sec(u^2)$: $\\sec^2u$ significa $(\\sec u)^2$.',
  ],
  related: ['derivadas-trig-inversas', 'integrales-trigonometricas', 'identidades-fundamentales'],
  keywords: ['derivada seno', 'derivada coseno', 'derivada tangente', 'secante', 'cosecante', 'cotangente', 'trigonometricas', 'calculo'],
}

// ─── Trigonométricas inversas ────────────────────────────────────────────────

const inside1 = (u: number) => (Math.abs(u) < 1 ? null : `En ese punto $u=${fmt(u)}$; esta derivada sólo existe para $-1<u<1$.`)
const outside1 = (u: number) => (Math.abs(u) > 1 ? null : `En ese punto $u=${fmt(u)}$; esta función sólo existe para $|u|>1$.`)

const derivadasTrigInversas: Formula = {
  id: 'derivadas-trig-inversas',
  name: 'Derivadas de funciones trigonométricas inversas',
  category: 'derivadas',
  latex: L`\frac{d}{dx}(${ARCSEN} u)=\frac{u'}{\sqrt{1-u^2}}`,
  forms: [
    { label: '20) Arco coseno', latex: L`\frac{d}{dx}(\arccos u)=-\frac{u'}{\sqrt{1-u^2}}` },
    { label: '21) Arco tangente', latex: L`\frac{d}{dx}(\arctan u)=\frac{u'}{1+u^2}` },
    { label: '22) Arco cotangente', latex: L`\frac{d}{dx}(${ARCCOT} u)=-\frac{u'}{1+u^2}` },
    { label: '23) Arco secante', latex: L`\frac{d}{dx}(${ARCSEC} u)=\frac{u'}{|u|\sqrt{u^2-1}}` },
    { label: '24) Arco cosecante', latex: L`\frac{d}{dx}(${ARCCSC} u)=-\frac{u'}{|u|\sqrt{u^2-1}}` },
  ],
  summary: 'Las funciones que devuelven un ángulo tienen derivadas **algebraicas**: raíces y fracciones, sin funciones trigonométricas.',
  goal: 'Derivar $\\operatorname{arcsen}$, $\\arccos$, $\\arctan$… y, leídas al revés, reconocer las integrales que dan un ángulo (18–20).',
  variables: [
    { symbol: L`${ARCSEN} u`, meaning: 'El ángulo cuyo seno es $u$ (también se escribe $\\operatorname{sen}^{-1}u$). Devuelve radianes.' },
    { symbol: 'u', meaning: 'Una función de $x$; aquí $u = px+q$' },
    { symbol: "u'", meaning: 'Su derivada (regla de la cadena)' },
  ],
  whenToUse: [
    'Para derivar cualquier función “arco”.',
    'Para reconocer integrales con $\\sqrt{1-u^2}$ o $1+u^2$ en el denominador: el resultado es un ángulo.',
  ],
  intuition: [
    'Cada par “función – co-función” tiene la misma derivada con el signo cambiado: $\\arccos u = \\frac{\\pi}{2} - \\operatorname{arcsen}u$, y una constante no afecta la derivada.',
    '$\\operatorname{arcsen}$ sólo acepta valores entre $-1$ y $1$ (un seno nunca sale de ahí). Cerca de los bordes su gráfica se vuelve vertical, por eso $\\sqrt{1-u^2}\\to0$ y la derivada se dispara.',
    '$\\arctan$ acepta cualquier número y su pendiente $\\frac{1}{1+u^2}$ es máxima (1) en $u=0$ y se aplana hacia los lados: la función se acerca a $\\pm\\frac{\\pi}{2}$ sin llegar nunca.',
  ],
  derivation: {
    intro: 'Derivación implícita, igual que con el logaritmo:',
    steps: [
      { label: 'Si $y = \\operatorname{arcsen}x$', latex: L`${SEN} y=x` },
      { label: 'Derivamos ambos lados', latex: L`\cos y\;y'=1\ \Rightarrow\ y'=\frac{1}{\cos y}` },
      { label: 'Identidad pitagórica ($\\cos y\\ge0$ porque $y\\in[-\\frac\\pi2,\\frac\\pi2]$)', latex: L`\cos y=\sqrt{1-${SEN}^2y}=\sqrt{1-x^2}` },
      { label: 'Resultado', latex: L`\frac{d}{dx}(${ARCSEN} x)=\frac{1}{\sqrt{1-x^2}}` },
    ],
  },
  calculators: [
    chainCalc({
      id: 'arcsen', label: 'arcsen u', example: '$y = \\operatorname{arcsen}(2x)$ en $x=0.2$',
      rule: L`\frac{d}{dx}(${ARCSEN} u)=\frac{u'}{\sqrt{1-u^2}}`, p: 2, q: 0, x0: 0.2,
      fTex: (u) => L`${ARCSEN} ${u}`, dTex: (u) => L`\frac{1}{\sqrt{1-${u}^2}}`,
      f: Math.asin, df: (u) => 1 / Math.sqrt(1 - u * u), domain: inside1,
    }),
    chainCalc({
      id: 'arccos', label: 'arccos u', example: '$y = \\arccos(x)$ en $x=0.5$',
      rule: L`\frac{d}{dx}(\arccos u)=-\frac{u'}{\sqrt{1-u^2}}`, p: 1, q: 0, x0: 0.5,
      fTex: (u) => L`\arccos ${u}`, dTex: (u) => L`-\frac{1}{\sqrt{1-${u}^2}}`,
      f: Math.acos, df: (u) => -1 / Math.sqrt(1 - u * u), domain: inside1,
    }),
    chainCalc({
      id: 'arctan', label: 'arctan u', example: '$y = \\arctan(3x)$ en $x=0.5$',
      rule: L`\frac{d}{dx}(\arctan u)=\frac{u'}{1+u^2}`, p: 3, q: 0, x0: 0.5,
      fTex: (u) => L`\arctan ${u}`, dTex: (u) => L`\frac{1}{1+${u}^2}`,
      f: Math.atan, df: (u) => 1 / (1 + u * u),
    }),
    chainCalc({
      id: 'arccot', label: 'arccot u', example: '$y = \\operatorname{arccot}(x)$ en $x=1$',
      rule: L`\frac{d}{dx}(${ARCCOT} u)=-\frac{u'}{1+u^2}`, p: 1, q: 0, x0: 1,
      fTex: (u) => L`${ARCCOT} ${u}`, dTex: (u) => L`-\frac{1}{1+${u}^2}`,
      f: (u) => Math.PI / 2 - Math.atan(u), df: (u) => -1 / (1 + u * u),
    }),
    chainCalc({
      id: 'arcsec', label: 'arcsec u', example: '$y = \\operatorname{arcsec}(x)$ en $x=2$',
      rule: L`\frac{d}{dx}(${ARCSEC} u)=\frac{u'}{|u|\sqrt{u^2-1}}`, p: 1, q: 0, x0: 2,
      fTex: (u) => L`${ARCSEC} ${u}`, dTex: (u) => L`\frac{1}{|${bare(u)}|\sqrt{${u}^2-1}}`,
      f: (u) => Math.acos(1 / u), df: (u) => 1 / (Math.abs(u) * Math.sqrt(u * u - 1)), domain: outside1,
    }),
    chainCalc({
      id: 'arccsc', label: 'arccsc u', example: '$y = \\operatorname{arccsc}(x)$ en $x=2$',
      rule: L`\frac{d}{dx}(${ARCCSC} u)=-\frac{u'}{|u|\sqrt{u^2-1}}`, p: 1, q: 0, x0: 2,
      fTex: (u) => L`${ARCCSC} ${u}`, dTex: (u) => L`-\frac{1}{|${bare(u)}|\sqrt{${u}^2-1}}`,
      f: (u) => Math.asin(1 / u), df: (u) => -1 / (Math.abs(u) * Math.sqrt(u * u - 1)), domain: outside1,
    }),
  ],
  commonMistakes: [
    'Confundir $\\operatorname{sen}^{-1}u$ (arco seno) con $\\frac{1}{\\operatorname{sen}u}$ (cosecante).',
    'En $\\operatorname{arcsec}$ y $\\operatorname{arccsc}$, muchos formularios escriben $u\\sqrt{u^2-1}$ sin valor absoluto. Eso sólo es correcto para $u>1$: con $u<-1$ el signo sale al revés (con el rango usual $[0,\\pi]$ del arco secante).',
    'Evaluar $\\operatorname{arcsen}$ o $\\arccos$ fuera de $[-1,1]$: no existen.',
  ],
  related: ['derivadas-trigonometricas', 'integrales-arco'],
  keywords: ['arco seno', 'arcsen', 'arccos', 'arctan', 'arcsec', 'inversas', 'derivada trigonometrica inversa'],
}

export const DERIVADAS: Formula[] = [reglasDerivacion, derivadasExpLog, derivadasTrig, derivadasTrigInversas]
