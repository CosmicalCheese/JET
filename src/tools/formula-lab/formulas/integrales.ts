import { calc, fail, vec, type CalcStep, type Calculator, type Formula, type PlotArea, type Values, type VisualSpec } from '../types'
import { fmt, fp } from '../format'
import { ARCSEC, ARCSEN, L, SEN, close, coef, gcd, integrate, integralCalc, kx, robustRange, sample, type X } from './calculo-comun'

const n = (v: Values, k: string) => v[k] as number

/** u entre paréntesis salvo que sea sólo la variable */
const paren = (s: string) => (s === 'x' || s === 'u' ? s : `(${s})`)
/** Coeficiente delante de un número ya sustituido: '', '-', '\frac12\cdot' */
const times = (c: string) => (c === '' || c === '-' ? c : `${c}\\cdot `)

// ─── Integrales inmediatas ───────────────────────────────────────────────────

const pw = (base: string, e: number) => (e === 1 ? base : `${base}^{${fmt(e)}}`)

const integralesInmediatas: Formula = {
  id: 'integrales-inmediatas',
  name: 'Integrales inmediatas',
  category: 'integrales',
  latex: L`\int u^n\,du=\frac{u^{n+1}}{n+1}+C\qquad(n\ne-1)`,
  forms: [
    { label: '1) Suma', latex: L`\int[f(x)\pm g(x)]\,dx=\int f(x)\,dx\pm\int g(x)\,dx` },
    { label: '2–3) Constantes', latex: L`\int k\,du=k\int du=ku+C` },
    { label: '5) El caso n = −1', latex: L`\int\frac{du}{u}=\ln|u|+C` },
    { label: '6) Exponencial de base a', latex: L`\int a^u\,du=\frac{a^u}{\ln a}+C` },
    { label: '7) Exponencial de base e', latex: L`\int e^u\,du=e^u+C` },
    { label: 'Teorema fundamental del cálculo', latex: L`\int_a^b f(x)\,dx=F(b)-F(a)` },
  ],
  summary: 'Integrar es derivar al revés. Estas son las antiderivadas básicas y la regla para calcular áreas con ellas.',
  goal: 'Encontrar una función $F$ cuya derivada sea la que te dan (la **antiderivada**) y, con ella, calcular el área bajo una curva entre $a$ y $b$ sin sumar rectángulos.',
  variables: [
    { symbol: L`\int`, meaning: 'Integral: una suma continua. Sin límites es una antiderivada; con límites $\\int_a^b$ es un número (un área con signo).' },
    { symbol: 'du,\\ dx', meaning: 'Indica la variable de integración. Si $u$ depende de $x$, hay que convertir: $du = u\'\\,dx$.' },
    { symbol: 'C', meaning: 'Constante de integración: cualquier número, porque la derivada de una constante es 0' },
    { symbol: 'F(x)', meaning: 'Una antiderivada de $f$: cumple $F\'(x) = f(x)$' },
    { symbol: 'a,\\ b', meaning: 'Límites de integración (dónde empieza y dónde termina el área)' },
  ],
  whenToUse: [
    'Cuando la función es una potencia, $\\frac1x$ o una exponencial, o se convierte en una con una sustitución $u = g(x)$.',
    'Para calcular **áreas** bajo una curva, distancias a partir de la velocidad, trabajo a partir de una fuerza variable…',
    'Las raíces y fracciones se reescriben como potencias: $\\sqrt x = x^{1/2}$, $\\frac{1}{x^3} = x^{-3}$.',
  ],
  intuition: [
    'Derivar responde “¿qué tan rápido cambia?”; integrar responde “¿cuánto se acumuló?”. Son operaciones inversas.',
    'La regla de la potencia al revés: en vez de bajar el exponente y restar 1, **sumas 1 y divides** entre el nuevo exponente. Compruébalo derivando: $\\left(\\frac{x^4}{4}\\right)\' = x^3$.',
    'Con $n=-1$ la regla dividiría entre 0. Por eso $\\frac{1}{x}$ tiene su propia fórmula: el logaritmo.',
    '**Teorema fundamental**: el área acumulada entre $a$ y $b$ es cuánto cambió la antiderivada, $F(b) - F(a)$. La $C$ se cancela al restar.',
  ],
  derivation: {
    intro: 'Cada fórmula se comprueba derivando el resultado:',
    steps: [
      { label: 'Potencia', latex: L`\frac{d}{du}\left(\frac{u^{n+1}}{n+1}\right)=\frac{(n+1)u^n}{n+1}=u^n` },
      { label: 'Logaritmo (para $u<0$, $\\ln|u|=\\ln(-u)$ y la cadena da lo mismo)', latex: L`\frac{d}{du}\ln|u|=\frac1u` },
      { label: 'Exponencial', latex: L`\frac{d}{du}\left(\frac{a^u}{\ln a}\right)=\frac{a^u\ln a}{\ln a}=a^u` },
    ],
  },
  calculators: [
    integralCalc({
      id: 'potencia',
      label: 'Potencia c·xⁿ',
      example: 'Área bajo $y = 3x^2$ entre 0 y 2',
      inputs: [
        { kind: 'number', id: 'c', label: 'Coeficiente', symbol: 'c', default: 3 },
        { kind: 'number', id: 'n', label: 'Exponente', symbol: 'n', default: 2 },
      ],
      lo: 0, hi: 2,
      fTex: (v) => `${coef(n(v, 'c'))}${n(v, 'n') === 0 ? '1' : pw('x', n(v, 'n'))}`,
      f: (x, v) => n(v, 'c') * x ** n(v, 'n'),
      FTex: (x, v) => {
        const c = n(v, 'c'), e = n(v, 'n') + 1
        const k = Number.isInteger(c) && Number.isInteger(e) ? coef(c, e) : coef(c / e)
        return x === 'x' ? `${k}${pw('x', e)}` : `${times(k)}${pw(fp(x), e)}`
      },
      F: (x, v) => (n(v, 'c') * x ** (n(v, 'n') + 1)) / (n(v, 'n') + 1),
      setup: (v) => [
        { label: 'Regla 4: sumamos 1 al exponente y dividimos entre el nuevo exponente', latex: L`\int x^{${fmt(n(v, 'n'))}}\,dx=\frac{x^{${fmt(n(v, 'n') + 1)}}}{${fmt(n(v, 'n') + 1)}}+C` },
      ],
      check: (lo, hi, v) => {
        if (n(v, 'n') === -1) fail('Con $n=-1$ la regla dividiría entre cero: usa la pestaña **c/x** (da un logaritmo).')
        if (!Number.isInteger(n(v, 'n')) && Math.min(lo, hi) < 0) fail('Con exponente fraccionario la función no existe para $x<0$.')
      },
    }),
    integralCalc({
      id: 'reciproco',
      label: 'c/x',
      example: '$\\int_1^e \\frac{1}{x}\\,dx$: el área que define al número $e$',
      inputs: [{ kind: 'number', id: 'c', label: 'Coeficiente', symbol: 'c', default: 1 }],
      lo: 1, hi: 2.71828,
      fTex: (v) => n(v, 'c') === 1 ? L`\frac{1}{x}` : L`\frac{${fmt(n(v, 'c'))}}{x}`,
      f: (x, v) => n(v, 'c') / x,
      FTex: (x, v) => {
        const k = coef(n(v, 'c'))
        return x === 'x' ? L`${k}\ln|x|` : L`${times(k)}\ln|${fmt(x)}|`
      },
      F: (x, v) => n(v, 'c') * Math.log(Math.abs(x)),
      setup: () => [{ label: 'Regla 5', latex: L`\int\frac{du}{u}=\ln|u|+C` }],
      check: (lo, hi) => {
        if (lo * hi <= 0) fail('El intervalo no puede tocar ni cruzar $x=0$: ahí $\\frac1x$ se va a infinito.')
      },
    }),
    integralCalc({
      id: 'exp',
      label: 'eᵏˣ',
      example: '$\\int_0^1 e^{2x}\\,dx$',
      inputs: [{ kind: 'number', id: 'k', label: 'Coeficiente de x en el exponente', symbol: 'k', default: 2 }],
      lo: 0, hi: 1,
      fTex: (v) => `e^{${kx(n(v, 'k'))}}`,
      f: (x, v) => Math.exp(n(v, 'k') * x),
      FTex: (x, v) => {
        const k = n(v, 'k'), c = Number.isInteger(k) ? coef(1, k) : coef(1 / k)
        return x === 'x' ? `${c}e^{${kx(k)}}` : `${times(c)}e^{${kx(k, x)}}`
      },
      F: (x, v) => Math.exp(n(v, 'k') * x) / n(v, 'k'),
      setup: (v) => [
        { label: 'Sustitución: el exponente es $u$', latex: L`u=${kx(n(v, 'k'))}\qquad du=${fmt(n(v, 'k'))}\,dx\ \Rightarrow\ dx=\frac{du}{${fmt(n(v, 'k'))}}` },
        { label: 'Regla 7', latex: L`\int e^{u}\frac{du}{${fmt(n(v, 'k'))}}=\frac{1}{${fmt(n(v, 'k'))}}e^u+C` },
      ],
      check: (_lo, _hi, v) => { if (n(v, 'k') === 0) fail('Con $k=0$ la función es la constante 1; usa un $k$ distinto de 0.') },
    }),
    integralCalc({
      id: 'base-a',
      label: 'aˣ',
      example: '$\\int_0^3 2^x\\,dx$',
      inputs: [{ kind: 'number', id: 'a', label: 'Base', symbol: 'a', default: 2 }],
      lo: 0, hi: 3,
      fTex: (v) => `${fmt(n(v, 'a'))}^x`,
      f: (x, v) => n(v, 'a') ** x,
      FTex: (x, v) => L`\frac{${fmt(n(v, 'a'))}^{${x === 'x' ? 'x' : fmt(x)}}}{\ln ${fmt(n(v, 'a'))}}`,
      F: (x, v) => n(v, 'a') ** x / Math.log(n(v, 'a')),
      setup: () => [{ label: 'Regla 6', latex: L`\int a^u\,du=\frac{a^u}{\ln a}+C` }],
      check: (_lo, _hi, v) => { if (!(n(v, 'a') > 0) || n(v, 'a') === 1) fail('La base debe ser positiva y distinta de 1.') },
    }),
  ],
  commonMistakes: [
    'Olvidar la $+C$ en una integral indefinida.',
    'Usar la regla de la potencia con $n=-1$: $\\int x^{-1}dx = \\ln|x|$, no $\\frac{x^0}{0}$.',
    'Escribir $\\ln u$ en vez de $\\ln|u|$: el logaritmo de un negativo no existe, pero $\\frac1u$ sí se puede integrar para $u<0$. (En el formulario los corchetes $[\\ ]$ cumplen ese papel.)',
    'Olvidar ajustar $du$ en una sustitución: $\\int e^{3x}dx = \\frac13e^{3x}+C$, no $e^{3x}+C$.',
    'Integrar un producto como el producto de las integrales: $\\int fg \\ne \\int f\\int g$.',
  ],
  related: ['reglas-derivacion', 'integrales-trigonometricas', 'area-entre-curvas', 'derivadas-exp-log'],
  keywords: ['integral', 'antiderivada', 'primitiva', 'integral definida', 'teorema fundamental', 'F(b)-F(a)', 'area bajo la curva', 'calculo integral'],
}

// ─── Integrales trigonométricas ──────────────────────────────────────────────

interface TrigCase {
  id: string
  label: string
  rule: string
  /** integrando y antiderivada en términos de u (u ya viene con paréntesis si hace falta) */
  fTex: (u: string) => string
  sign: 1 | -1
  FTex: (u: string) => string
  f: (u: number) => number
  F: (u: number) => number
  lo: number
  hi: number
}

function trigCalc(t: TrigCase): Calculator {
  const uTex = (k: number, x: X) => paren(kx(k, x))
  return integralCalc({
    id: t.id,
    label: t.label,
    example: 'Los ángulos están en **radianes** ($\\pi \\approx 3.1416$).',
    inputs: [{ kind: 'number', id: 'k', label: 'Coeficiente de x dentro de la función', symbol: 'k', default: 1 }],
    lo: t.lo, hi: t.hi,
    fTex: (v) => t.fTex(uTex(n(v, 'k'), 'x')),
    f: (x, v) => t.f(n(v, 'k') * x),
    FTex: (x, v) => {
      const k = n(v, 'k'), c = Number.isInteger(k) ? coef(t.sign, k) : coef(t.sign / k)
      return `${c}${t.FTex(uTex(k, x))}`
    },
    F: (x, v) => (t.sign * t.F(n(v, 'k') * x)) / n(v, 'k'),
    setup: (v) => {
      const k = n(v, 'k')
      const steps: CalcStep[] = [{ label: 'Fórmula del formulario', latex: t.rule }]
      if (k !== 1) steps.push({ label: 'Sustitución: lo de adentro es $u$, y despejamos $dx$', latex: L`u=${kx(k)}\qquad du=${fmt(k)}\,dx\ \Rightarrow\ dx=\frac{du}{${fmt(k)}}` })
      return steps
    },
    check: (_lo, _hi, v) => { if (n(v, 'k') === 0) fail('Con $k=0$ la función es constante; usa un $k$ distinto de 0.') },
  })
}

const sec = (u: number) => 1 / Math.cos(u)
const csc = (u: number) => 1 / Math.sin(u)
const cot = (u: number) => 1 / Math.tan(u)

const integralesTrig: Formula = {
  id: 'integrales-trigonometricas',
  name: 'Integrales de funciones trigonométricas',
  category: 'integrales',
  latex: L`\int ${SEN} u\,du=-\cos u+C`,
  forms: [
    { label: '9) Coseno', latex: L`\int\cos u\,du=${SEN} u+C` },
    { label: '10) Tangente', latex: L`\int\tan u\,du=\ln|\sec u|+C` },
    { label: '11) Cotangente', latex: L`\int\cot u\,du=\ln|${SEN} u|+C` },
    { label: '12) Secante', latex: L`\int\sec u\,du=\ln|\sec u+\tan u|+C` },
    { label: '13) Cosecante', latex: L`\int\csc u\,du=\ln|\csc u-\cot u|+C=\ln\left|\tan\tfrac u2\right|+C` },
    { label: '14) Secante al cuadrado', latex: L`\int\sec^2u\,du=\tan u+C` },
    { label: '15) Cosecante al cuadrado', latex: L`\int\csc^2u\,du=-\cot u+C` },
    { label: '16) Secante por tangente', latex: L`\int\sec u\tan u\,du=\sec u+C` },
    { label: '17) Cosecante por cotangente', latex: L`\int\csc u\cot u\,du=-\csc u+C` },
  ],
  summary: 'Las diez integrales trigonométricas del formulario. Las de 14 a 17 son las derivadas leídas al revés.',
  goal: 'Integrar funciones periódicas. Por ejemplo, el área bajo un arco del seno ($\\int_0^\\pi \\operatorname{sen}x\\,dx$) es exactamente 2.',
  variables: [
    { symbol: 'u', meaning: 'El ángulo, en **radianes**; aquí $u = kx$' },
    { symbol: 'du', meaning: 'Si $u = kx$, entonces $du = k\\,dx$: por eso aparece el factor $\\frac1k$' },
    { symbol: L`\ln|\ |`, meaning: 'Logaritmo natural del valor absoluto (en el formulario, los corchetes $[\\ ]$)' },
  ],
  whenToUse: [
    '**8, 9, 14–17**: son las derivadas trigonométricas al revés. Si reconoces la derivada de algo, ya tienes la integral.',
    '**10–13**: $\\tan$, $\\cot$, $\\sec$ y $\\csc$ solas dan logaritmos.',
    'Para potencias como $\\operatorname{sen}^2u$ primero usa las identidades de ángulo doble: $\\operatorname{sen}^2u = \\frac{1-\\cos2u}{2}$.',
  ],
  intuition: [
    'Como $\\frac{d}{du}\\cos u = -\\operatorname{sen}u$, para que la derivada salga $+\\operatorname{sen}u$ hay que poner un signo menos: $\\int\\operatorname{sen}u\\,du = -\\cos u$.',
    'Un arco completo del seno ($0$ a $2\\pi$) tiene integral 0: la mitad de arriba y la de abajo se cancelan.',
    'Con $u = kx$ la función oscila $k$ veces más rápido; cada “joroba” es $k$ veces más angosta, y por eso el área se divide entre $k$.',
  ],
  derivation: {
    intro: 'La de la tangente sale con una sustitución:',
    steps: [
      { label: 'Reescribimos', latex: L`\int\tan u\,du=\int\frac{${SEN} u}{\cos u}\,du` },
      { label: 'Sustitución $w=\\cos u$, $dw=-\\operatorname{sen}u\\,du$', latex: L`=-\int\frac{dw}{w}=-\ln|w|+C=-\ln|\cos u|+C` },
      { label: 'Como $-\\ln|\\cos u|=\\ln\\left|\\frac{1}{\\cos u}\\right|$', latex: L`=\ln|\sec u|+C` },
    ],
    outro: 'La de la secante usa un truco: multiplicar y dividir entre $\\sec u + \\tan u$; el numerador queda como la derivada del denominador.',
  },
  calculators: [
    trigCalc({ id: 'sen', label: 'sen', rule: L`\int ${SEN} u\,du=-\cos u+C`, fTex: u => L`${SEN} ${u}`, sign: -1, FTex: u => L`\cos ${u}`, f: Math.sin, F: Math.cos, lo: 0, hi: 3.1416 }),
    trigCalc({ id: 'cos', label: 'cos', rule: L`\int\cos u\,du=${SEN} u+C`, fTex: u => L`\cos ${u}`, sign: 1, FTex: u => L`${SEN} ${u}`, f: Math.cos, F: Math.sin, lo: 0, hi: 1.5708 }),
    trigCalc({ id: 'tan', label: 'tan', rule: L`\int\tan u\,du=\ln|\sec u|+C`, fTex: u => L`\tan ${u}`, sign: 1, FTex: u => L`\ln|\sec ${u}|`, f: Math.tan, F: u => Math.log(Math.abs(sec(u))), lo: 0, hi: 0.7854 }),
    trigCalc({ id: 'cot', label: 'cot', rule: L`\int\cot u\,du=\ln|${SEN} u|+C`, fTex: u => L`\cot ${u}`, sign: 1, FTex: u => L`\ln|${SEN} ${u}|`, f: cot, F: u => Math.log(Math.abs(Math.sin(u))), lo: 0.5, hi: 1.5 }),
    trigCalc({ id: 'sec', label: 'sec', rule: L`\int\sec u\,du=\ln|\sec u+\tan u|+C`, fTex: u => L`\sec ${u}`, sign: 1, FTex: u => L`\ln|\sec ${u}+\tan ${u}|`, f: sec, F: u => Math.log(Math.abs(sec(u) + Math.tan(u))), lo: 0, hi: 1 }),
    trigCalc({ id: 'csc', label: 'csc', rule: L`\int\csc u\,du=\ln|\csc u-\cot u|+C`, fTex: u => L`\csc ${u}`, sign: 1, FTex: u => L`\ln|\csc ${u}-\cot ${u}|`, f: csc, F: u => Math.log(Math.abs(csc(u) - cot(u))), lo: 0.5, hi: 2 }),
    trigCalc({ id: 'sec2', label: 'sec²', rule: L`\int\sec^2u\,du=\tan u+C`, fTex: u => L`\sec^2${u}`, sign: 1, FTex: u => L`\tan ${u}`, f: u => sec(u) ** 2, F: Math.tan, lo: 0, hi: 0.7854 }),
    trigCalc({ id: 'csc2', label: 'csc²', rule: L`\int\csc^2u\,du=-\cot u+C`, fTex: u => L`\csc^2${u}`, sign: -1, FTex: u => L`\cot ${u}`, f: u => csc(u) ** 2, F: cot, lo: 0.7854, hi: 1.5708 }),
    trigCalc({ id: 'sectan', label: 'sec·tan', rule: L`\int\sec u\tan u\,du=\sec u+C`, fTex: u => L`\sec ${u}\tan ${u}`, sign: 1, FTex: u => L`\sec ${u}`, f: u => sec(u) * Math.tan(u), F: sec, lo: 0, hi: 1 }),
    trigCalc({ id: 'csccot', label: 'csc·cot', rule: L`\int\csc u\cot u\,du=-\csc u+C`, fTex: u => L`\csc ${u}\cot ${u}`, sign: -1, FTex: u => L`\csc ${u}`, f: u => csc(u) * cot(u), F: csc, lo: 0.5, hi: 1.5 }),
  ],
  commonMistakes: [
    'Equivocarse de signo: $\\int\\operatorname{sen}u\\,du = -\\cos u$, pero $\\int\\cos u\\,du = +\\operatorname{sen}u$ (al revés que en las derivadas).',
    'Usar grados en vez de radianes.',
    'Olvidar dividir entre $k$: $\\int\\cos(3x)\\,dx = \\frac13\\operatorname{sen}(3x)+C$.',
    'Integrar a través de una asíntota de $\\tan$, $\\sec$, $\\cot$ o $\\csc$: ahí la integral no existe.',
  ],
  related: ['derivadas-trigonometricas', 'integrales-inmediatas', 'angulo-doble'],
  keywords: ['integral seno', 'integral coseno', 'integral tangente', 'integral secante', 'trigonometricas', 'calculo integral'],
}

// ─── Integrales que dan funciones trigonométricas inversas ───────────────────

const us = (x: X) => (x === 'x' ? 'u' : fp(x))
const positiveA = (v: Values) => { if (!(n(v, 'a') > 0)) fail('La constante $a$ debe ser positiva.') }
const aInput = (def: number) => ({ kind: 'number' as const, id: 'a', label: 'Constante a', symbol: 'a', default: def })
/** 1/a como coeficiente */
const inv = (a: number, k = 1) => (Number.isInteger(a) ? coef(1, k * a) : coef(1 / (k * a)))

const integralesArco: Formula = {
  id: 'integrales-arco',
  name: 'Integrales que dan arco seno, arco tangente y arco secante',
  category: 'integrales',
  latex: L`\int\frac{du}{\sqrt{a^2-u^2}}=${ARCSEN}\frac{u}{a}+C`,
  forms: [
    { label: '19) Suma de cuadrados', latex: L`\int\frac{du}{u^2+a^2}=\frac1a\arctan\frac ua+C` },
    { label: '20) Con u fuera de la raíz', latex: L`\int\frac{du}{u\sqrt{u^2-a^2}}=\frac1a${ARCSEC}\frac{|u|}{a}+C` },
    { label: 'Cuadrado de una suma de cuadrados', latex: L`\int\frac{du}{(u^2+a^2)^2}=\frac{u}{2a^2(u^2+a^2)}+\frac{1}{2a^3}\arctan\frac ua+C` },
  ],
  summary: 'Fracciones con $a^2 - u^2$ o $u^2 + a^2$ cuyo resultado es un **ángulo**.',
  goal: 'Integrar fracciones con sumas o restas de cuadrados. Aparecen al calcular áreas de círculos, ángulos de visión, y al completar el cuadrado en denominadores como $x^2+4x+13$.',
  variables: [
    { symbol: 'u', meaning: 'La variable (o una expresión de $x$, con $du = u\'\\,dx$)' },
    { symbol: 'a', meaning: 'Una constante positiva: la raíz del número que acompaña a $u^2$ (en $9+u^2$, $a = 3$)' },
  ],
  whenToUse: [
    '**18**: raíz de ($a^2$ menos $u^2$) en el denominador.',
    '**19**: $u^2 + a^2$ en el denominador, sin raíz.',
    '**20**: $u$ por la raíz de ($u^2$ menos $a^2$).',
    'Si el denominador es un trinomio como $x^2+6x+13$, primero **completa el cuadrado**: $(x+3)^2+4$, y usa la 19 con $u=x+3$, $a=2$.',
  ],
  intuition: [
    'Son las derivadas de las trigonométricas inversas leídas al revés: $\\frac{d}{du}\\operatorname{arcsen}u = \\frac{1}{\\sqrt{1-u^2}}$. La $a$ sólo “escala” el problema.',
    'Con $u = a\\operatorname{sen}\\theta$, la raíz $\\sqrt{a^2-u^2}$ se vuelve $a\\cos\\theta$: por eso el resultado es el ángulo $\\theta$.',
    'El área bajo $\\frac{1}{1+u^2}$ en toda la recta es exactamente $\\pi$, aunque la curva nunca llega a 0.',
  ],
  derivation: {
    intro: 'Fórmula 19 con la sustitución $u = a\\tan\\theta$:',
    steps: [
      { label: 'Sustituimos', latex: L`du=a\sec^2\theta\,d\theta\qquad u^2+a^2=a^2(\tan^2\theta+1)=a^2\sec^2\theta` },
      { label: 'Se cancela casi todo', latex: L`\int\frac{a\sec^2\theta\,d\theta}{a^2\sec^2\theta}=\frac1a\int d\theta=\frac{\theta}{a}+C` },
      { label: 'Regresamos a $u$: $\\theta=\\arctan\\frac ua$', latex: L`\frac1a\arctan\frac ua+C` },
    ],
  },
  calculators: [
    integralCalc({
      id: 'arcsen', label: '1/√(a²−u²)', dvar: 'u',
      example: '$\\int_0^1\\frac{du}{\\sqrt{4-u^2}}$',
      inputs: [aInput(2)], lo: 0, hi: 1,
      fTex: (v) => L`\frac{1}{\sqrt{${fmt(n(v, 'a') ** 2)}-u^2}}`,
      f: (x, v) => 1 / Math.sqrt(n(v, 'a') ** 2 - x * x),
      FTex: (x, v) => L`${ARCSEN}\frac{${us(x)}}{${fmt(n(v, 'a'))}}`,
      F: (x, v) => Math.asin(x / n(v, 'a')),
      setup: (v) => [{ label: `Fórmula 18 con $a=${fmt(n(v, 'a'))}$ (porque $a^2=${fmt(n(v, 'a') ** 2)}$)`, latex: L`\int\frac{du}{\sqrt{a^2-u^2}}=${ARCSEN}\frac{u}{a}+C` }],
      check: (lo, hi, v) => { positiveA(v); if (Math.max(Math.abs(lo), Math.abs(hi)) >= n(v, 'a')) fail('Los límites deben cumplir $|u|<a$: fuera de ahí la raíz es de un negativo (y en $|u|=a$ se divide entre 0).') },
    }),
    integralCalc({
      id: 'arctan', label: '1/(u²+a²)', dvar: 'u',
      example: '$\\int_0^3\\frac{du}{u^2+9}$',
      inputs: [aInput(3)], lo: 0, hi: 3,
      fTex: (v) => L`\frac{1}{u^2+${fmt(n(v, 'a') ** 2)}}`,
      f: (x, v) => 1 / (x * x + n(v, 'a') ** 2),
      FTex: (x, v) => L`${inv(n(v, 'a'))}\arctan\frac{${us(x)}}{${fmt(n(v, 'a'))}}`,
      F: (x, v) => Math.atan(x / n(v, 'a')) / n(v, 'a'),
      setup: (v) => [{ label: `Fórmula 19 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\frac{du}{u^2+a^2}=\frac1a\arctan\frac ua+C` }],
      check: (_lo, _hi, v) => positiveA(v),
    }),
    integralCalc({
      id: 'arcsec', label: '1/(u√(u²−a²))', dvar: 'u',
      example: '$\\int_2^4\\frac{du}{u\\sqrt{u^2-4}}$',
      inputs: [aInput(2)], lo: 2.5, hi: 4,
      fTex: (v) => L`\frac{1}{u\sqrt{u^2-${fmt(n(v, 'a') ** 2)}}}`,
      f: (x, v) => 1 / (x * Math.sqrt(x * x - n(v, 'a') ** 2)),
      FTex: (x, v) => L`${inv(n(v, 'a'))}${ARCSEC}\frac{|${x === 'x' ? 'u' : fmt(x)}|}{${fmt(n(v, 'a'))}}`,
      F: (x, v) => Math.acos(n(v, 'a') / Math.abs(x)) / n(v, 'a'),
      setup: (v) => [{ label: `Fórmula 20 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\frac{du}{u\sqrt{u^2-a^2}}=\frac1a${ARCSEC}\frac{|u|}{a}+C` }],
      check: (lo, hi, v) => {
        positiveA(v)
        const a = n(v, 'a')
        if (!((lo > a && hi > a) || (lo < -a && hi < -a))) fail('Los dos límites deben estar del mismo lado y cumplir $|u|>a$.')
      },
    }),
    integralCalc({
      id: 'cuadrado', label: '1/(u²+a²)²', dvar: 'u',
      example: '$\\int_0^1\\frac{du}{(u^2+1)^2}$',
      inputs: [aInput(1)], lo: 0, hi: 1,
      fTex: (v) => L`\frac{1}{(u^2+${fmt(n(v, 'a') ** 2)})^2}`,
      f: (x, v) => 1 / (x * x + n(v, 'a') ** 2) ** 2,
      FTex: (x, v) => {
        const a = n(v, 'a'), a2 = fmt(a * a)
        return L`\frac{${us(x)}}{${fmt(2 * a * a)}(${us(x)}^2+${a2})}+\frac{1}{${fmt(2 * a ** 3)}}\arctan\frac{${us(x)}}{${fmt(a)}}`
      },
      F: (x, v) => {
        const a = n(v, 'a')
        return x / (2 * a * a * (x * x + a * a)) + Math.atan(x / a) / (2 * a ** 3)
      },
      setup: () => [{ label: 'Fórmula (se obtiene con $u = a\\tan\\theta$ y la identidad $\\cos^2\\theta=\\frac{1+\\cos2\\theta}{2}$)', latex: L`\int\frac{du}{(u^2+a^2)^2}=\frac{u}{2a^2(u^2+a^2)}+\frac{1}{2a^3}\arctan\frac ua+C` }],
      check: (_lo, _hi, v) => positiveA(v),
    }),
  ],
  commonMistakes: [
    'Usar $a^2$ en vez de $a$: en $\\int\\frac{du}{u^2+9}$, $a=3$ y el resultado es $\\frac13\\arctan\\frac u3$.',
    'Confundir la 18 ($\\sqrt{a^2-u^2}$, da arco seno) con la 24 ($\\sqrt{u^2-a^2}$, da logaritmo).',
    'Olvidar el factor $\\frac1a$ en la 19 y la 20 (la 18 no lo lleva).',
  ],
  related: ['derivadas-trig-inversas', 'integrales-logaritmicas', 'integrales-raices', 'completar-cuadrado'],
  keywords: ['arcsen', 'arctan', 'arcsec', 'sustitucion trigonometrica', 'a2-u2', 'u2+a2', 'integral'],
}

// ─── Integrales que dan logaritmos ───────────────────────────────────────────

const integralesLog: Formula = {
  id: 'integrales-logaritmicas',
  name: 'Integrales con u² ± a² que dan logaritmos',
  category: 'integrales',
  latex: L`\int\frac{du}{u^2-a^2}=\frac{1}{2a}\ln\left|\frac{u-a}{u+a}\right|+C`,
  forms: [
    { label: '22) Al revés', latex: L`\int\frac{du}{a^2-u^2}=\frac{1}{2a}\ln\left|\frac{a+u}{a-u}\right|+C` },
    { label: '23) Raíz de una suma', latex: L`\int\frac{du}{\sqrt{u^2+a^2}}=\ln\left(u+\sqrt{u^2+a^2}\right)+C` },
    { label: '24) Raíz de una resta', latex: L`\int\frac{du}{\sqrt{u^2-a^2}}=\ln\left|u+\sqrt{u^2-a^2}\right|+C` },
  ],
  summary: 'Las diferencias de cuadrados (sin raíz) y las raíces de $u^2\\pm a^2$ se integran con logaritmos.',
  goal: 'Integrar fracciones con $u^2-a^2$, $a^2-u^2$ o con las raíces $\\sqrt{u^2\\pm a^2}$. Aparecen en fracciones parciales y en longitudes de curvas.',
  variables: [
    { symbol: 'u', meaning: 'La variable (o una expresión de $x$, con $du = u\'\\,dx$)' },
    { symbol: 'a', meaning: 'Constante positiva: la raíz del número que acompaña a $u^2$' },
  ],
  whenToUse: [
    '**21–22**: diferencia de cuadrados en el denominador, sin raíz. Se factoriza $(u-a)(u+a)$.',
    '**23–24**: la raíz de $u^2 + a^2$ o de $u^2 - a^2$ en el denominador.',
  ],
  intuition: [
    'La 21 sale de **fracciones parciales**: $\\frac{1}{u^2-a^2} = \\frac{1}{2a}\\left(\\frac{1}{u-a} - \\frac{1}{u+a}\\right)$, y cada pedazo da un logaritmo. Al restar logaritmos se dividen sus argumentos.',
    'La 21 y la 22 son la misma fórmula: $\\frac{1}{a^2-u^2} = -\\frac{1}{u^2-a^2}$, y el signo menos voltea la fracción dentro del logaritmo.',
    'La 23 y la 24 vienen de sustituir $u = a\\tan\\theta$ o $u = a\\sec\\theta$; el resultado se simplifica a un logaritmo.',
  ],
  derivation: {
    intro: 'Fórmula 21 por fracciones parciales:',
    steps: [
      { label: 'Separamos', latex: L`\frac{1}{(u-a)(u+a)}=\frac{A}{u-a}+\frac{B}{u+a}\ \Rightarrow\ A=\frac{1}{2a},\ B=-\frac{1}{2a}` },
      { label: 'Integramos cada parte', latex: L`\frac{1}{2a}\ln|u-a|-\frac{1}{2a}\ln|u+a|+C` },
      { label: 'Propiedad de los logaritmos', latex: L`=\frac{1}{2a}\ln\left|\frac{u-a}{u+a}\right|+C` },
    ],
  },
  calculators: [
    integralCalc({
      id: 'u2-a2', label: '1/(u²−a²)', dvar: 'u',
      example: '$\\int_3^5\\frac{du}{u^2-4}$',
      inputs: [aInput(2)], lo: 3, hi: 5,
      fTex: (v) => L`\frac{1}{u^2-${fmt(n(v, 'a') ** 2)}}`,
      f: (x, v) => 1 / (x * x - n(v, 'a') ** 2),
      FTex: (x, v) => { const a = fmt(n(v, 'a')); return L`${inv(n(v, 'a'), 2)}\ln\left|\frac{${us(x)}-${a}}{${us(x)}+${a}}\right|` },
      F: (x, v) => { const a = n(v, 'a'); return Math.log(Math.abs((x - a) / (x + a))) / (2 * a) },
      setup: (v) => [{ label: `Fórmula 21 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\frac{du}{u^2-a^2}=\frac{1}{2a}\ln\left|\frac{u-a}{u+a}\right|+C` }],
      check: (lo, hi, v) => { positiveA(v); const a = n(v, 'a'); if ([a, -a].some(p => Math.min(lo, hi) <= p && p <= Math.max(lo, hi))) fail('El intervalo no puede incluir $u=\\pm a$: ahí el denominador vale 0.') },
    }),
    integralCalc({
      id: 'a2-u2', label: '1/(a²−u²)', dvar: 'u',
      example: '$\\int_0^1\\frac{du}{4-u^2}$',
      inputs: [aInput(2)], lo: 0, hi: 1,
      fTex: (v) => L`\frac{1}{${fmt(n(v, 'a') ** 2)}-u^2}`,
      f: (x, v) => 1 / (n(v, 'a') ** 2 - x * x),
      FTex: (x, v) => { const a = fmt(n(v, 'a')); return L`${inv(n(v, 'a'), 2)}\ln\left|\frac{${a}+${us(x)}}{${a}-${us(x)}}\right|` },
      F: (x, v) => { const a = n(v, 'a'); return Math.log(Math.abs((a + x) / (a - x))) / (2 * a) },
      setup: (v) => [{ label: `Fórmula 22 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\frac{du}{a^2-u^2}=\frac{1}{2a}\ln\left|\frac{a+u}{a-u}\right|+C` }],
      check: (lo, hi, v) => { positiveA(v); const a = n(v, 'a'); if ([a, -a].some(p => Math.min(lo, hi) <= p && p <= Math.max(lo, hi))) fail('El intervalo no puede incluir $u=\\pm a$: ahí el denominador vale 0.') },
    }),
    integralCalc({
      id: 'raiz-suma', label: '1/√(u²+a²)', dvar: 'u',
      example: '$\\int_0^4\\frac{du}{\\sqrt{u^2+9}}$',
      inputs: [aInput(3)], lo: 0, hi: 4,
      fTex: (v) => L`\frac{1}{\sqrt{u^2+${fmt(n(v, 'a') ** 2)}}}`,
      f: (x, v) => 1 / Math.sqrt(x * x + n(v, 'a') ** 2),
      FTex: (x, v) => L`\ln\left(${us(x)}+\sqrt{${us(x)}^2+${fmt(n(v, 'a') ** 2)}}\right)`,
      F: (x, v) => Math.log(x + Math.sqrt(x * x + n(v, 'a') ** 2)),
      setup: (v) => [{ label: `Fórmula 23 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\frac{du}{\sqrt{u^2+a^2}}=\ln\left(u+\sqrt{u^2+a^2}\right)+C` }],
      check: (_lo, _hi, v) => positiveA(v),
    }),
    integralCalc({
      id: 'raiz-resta', label: '1/√(u²−a²)', dvar: 'u',
      example: '$\\int_3^5\\frac{du}{\\sqrt{u^2-4}}$',
      inputs: [aInput(2)], lo: 3, hi: 5,
      fTex: (v) => L`\frac{1}{\sqrt{u^2-${fmt(n(v, 'a') ** 2)}}}`,
      f: (x, v) => 1 / Math.sqrt(x * x - n(v, 'a') ** 2),
      FTex: (x, v) => L`\ln\left|${us(x)}+\sqrt{${us(x)}^2-${fmt(n(v, 'a') ** 2)}}\right|`,
      F: (x, v) => Math.log(Math.abs(x + Math.sqrt(x * x - n(v, 'a') ** 2))),
      setup: (v) => [{ label: `Fórmula 24 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\frac{du}{\sqrt{u^2-a^2}}=\ln\left|u+\sqrt{u^2-a^2}\right|+C` }],
      check: (lo, hi, v) => {
        positiveA(v)
        const a = n(v, 'a')
        if (!((lo > a && hi > a) || (lo < -a && hi < -a))) fail('Los dos límites deben estar del mismo lado y cumplir $|u|>a$.')
      },
    }),
  ],
  commonMistakes: [
    'Confundir el orden dentro del logaritmo: en la 21 es $\\frac{u-a}{u+a}$; en la 22, $\\frac{a+u}{a-u}$.',
    'Olvidar el factor $\\frac{1}{2a}$ en la 21 y la 22.',
    'Usar la 21 cuando hay una **suma** $u^2+a^2$: esa da arco tangente (fórmula 19).',
  ],
  related: ['integrales-arco', 'integrales-raices', 'propiedades-logaritmos'],
  keywords: ['fracciones parciales', 'diferencia de cuadrados', 'logaritmo', 'u2-a2', 'integral'],
}

// ─── Integrales de raíces ────────────────────────────────────────────────────

const integralesRaices: Formula = {
  id: 'integrales-raices',
  name: 'Integrales de raíces √(a² ± u²)',
  category: 'integrales',
  latex: L`\int\sqrt{a^2-u^2}\,du=\frac u2\sqrt{a^2-u^2}+\frac{a^2}{2}${ARCSEN}\frac ua+C`,
  forms: [
    { label: '26) Raíz de una suma', latex: L`\int\sqrt{u^2+a^2}\,du=\frac u2\sqrt{u^2+a^2}+\frac{a^2}{2}\ln\left(u+\sqrt{u^2+a^2}\right)+C` },
    { label: '27) Raíz de una resta', latex: L`\int\sqrt{u^2-a^2}\,du=\frac u2\sqrt{u^2-a^2}-\frac{a^2}{2}\ln\left|u+\sqrt{u^2-a^2}\right|+C` },
  ],
  summary: 'Integrales de raíces cuadradas de sumas y restas de cuadrados. La 25 da el área de un círculo.',
  goal: 'Calcular áreas de círculos y elipses, y longitudes de parábolas (la longitud de arco de $y=x^2$ lleva a la 26).',
  variables: [
    { symbol: 'u', meaning: 'La variable de integración' },
    { symbol: 'a', meaning: 'Constante positiva. En la 25 es el **radio** del círculo $u^2+y^2=a^2$' },
  ],
  whenToUse: [
    '**25**: la raíz de ($a^2$ menos $u^2$): la mitad de arriba de un círculo de radio $a$.',
    '**26**: la raíz de una suma; aparece en la longitud de arco de una parábola.',
    '**27**: la raíz de ($u^2$ menos $a^2$): la mitad de arriba de una hipérbola.',
  ],
  intuition: [
    '$y=\\sqrt{a^2-u^2}$ es un semicírculo de radio $a$. Integrando de $0$ a $a$ sale un cuarto de círculo: $\\frac{\\pi a^2}{4}$. ¡De aquí sale la fórmula del área del círculo!',
    'Los dos términos del resultado tienen significado geométrico: $\\frac u2\\sqrt{a^2-u^2}$ es el área de un triángulo, y $\\frac{a^2}{2}\\operatorname{arcsen}\\frac ua$ la de un sector circular.',
  ],
  derivation: {
    intro: 'Fórmula 25 con $u = a\\operatorname{sen}\\theta$:',
    steps: [
      { label: 'Sustituimos', latex: L`du=a\cos\theta\,d\theta\qquad\sqrt{a^2-u^2}=a\cos\theta` },
      { label: 'Queda un coseno al cuadrado', latex: L`\int a^2\cos^2\theta\,d\theta=a^2\int\frac{1+\cos2\theta}{2}\,d\theta=\frac{a^2}{2}\left(\theta+${SEN}\theta\cos\theta\right)+C` },
      { label: 'Regresamos a $u$: $\\operatorname{sen}\\theta=\\frac ua$, $\\cos\\theta=\\frac{\\sqrt{a^2-u^2}}{a}$', latex: L`\frac{a^2}{2}${ARCSEN}\frac ua+\frac u2\sqrt{a^2-u^2}+C` },
    ],
  },
  calculators: [
    integralCalc({
      id: 'circulo', label: '√(a²−u²)', dvar: 'u',
      example: 'Un cuarto de círculo de radio 2: $\\int_0^2\\sqrt{4-u^2}\\,du = \\pi$',
      inputs: [aInput(2)], lo: 0, hi: 2,
      fTex: (v) => L`\sqrt{${fmt(n(v, 'a') ** 2)}-u^2}`,
      f: (x, v) => Math.sqrt(Math.max(0, n(v, 'a') ** 2 - x * x)),
      FTex: (x, v) => {
        const a = n(v, 'a'), a2 = fmt(a * a)
        return L`\frac{${us(x)}}{2}\sqrt{${a2}-${us(x)}^2}+\frac{${a2}}{2}${ARCSEN}\frac{${us(x)}}{${fmt(a)}}`
      },
      F: (x, v) => {
        const a = n(v, 'a')
        return (x / 2) * Math.sqrt(Math.max(0, a * a - x * x)) + ((a * a) / 2) * Math.asin(Math.max(-1, Math.min(1, x / a)))
      },
      setup: (v) => [{ label: `Fórmula 25 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\sqrt{a^2-u^2}\,du=\frac u2\sqrt{a^2-u^2}+\frac{a^2}{2}${ARCSEN}\frac ua+C` }],
      check: (lo, hi, v) => { positiveA(v); if (Math.max(Math.abs(lo), Math.abs(hi)) > n(v, 'a')) fail('Los límites deben cumplir $|u|\\le a$: fuera del círculo la raíz es de un negativo.') },
    }),
    integralCalc({
      id: 'suma', label: '√(u²+a²)', dvar: 'u',
      example: '$\\int_0^2\\sqrt{u^2+1}\\,du$',
      inputs: [aInput(1)], lo: 0, hi: 2,
      fTex: (v) => L`\sqrt{u^2+${fmt(n(v, 'a') ** 2)}}`,
      f: (x, v) => Math.sqrt(x * x + n(v, 'a') ** 2),
      FTex: (x, v) => {
        const a2 = fmt(n(v, 'a') ** 2)
        return L`\frac{${us(x)}}{2}\sqrt{${us(x)}^2+${a2}}+\frac{${a2}}{2}\ln\left(${us(x)}+\sqrt{${us(x)}^2+${a2}}\right)`
      },
      F: (x, v) => {
        const a2 = n(v, 'a') ** 2, r = Math.sqrt(x * x + a2)
        return (x / 2) * r + (a2 / 2) * Math.log(x + r)
      },
      setup: (v) => [{ label: `Fórmula 26 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\sqrt{u^2+a^2}\,du=\frac u2\sqrt{u^2+a^2}+\frac{a^2}{2}\ln\left(u+\sqrt{u^2+a^2}\right)+C` }],
      check: (_lo, _hi, v) => positiveA(v),
    }),
    integralCalc({
      id: 'resta', label: '√(u²−a²)', dvar: 'u',
      example: '$\\int_1^3\\sqrt{u^2-1}\\,du$',
      inputs: [aInput(1)], lo: 1, hi: 3,
      fTex: (v) => L`\sqrt{u^2-${fmt(n(v, 'a') ** 2)}}`,
      f: (x, v) => Math.sqrt(Math.max(0, x * x - n(v, 'a') ** 2)),
      FTex: (x, v) => {
        const a2 = fmt(n(v, 'a') ** 2)
        return L`\frac{${us(x)}}{2}\sqrt{${us(x)}^2-${a2}}-\frac{${a2}}{2}\ln\left|${us(x)}+\sqrt{${us(x)}^2-${a2}}\right|`
      },
      F: (x, v) => {
        const a2 = n(v, 'a') ** 2, r = Math.sqrt(Math.max(0, x * x - a2))
        return (x / 2) * r - (a2 / 2) * Math.log(Math.abs(x + r))
      },
      setup: (v) => [{ label: `Fórmula 27 con $a=${fmt(n(v, 'a'))}$`, latex: L`\int\sqrt{u^2-a^2}\,du=\frac u2\sqrt{u^2-a^2}-\frac{a^2}{2}\ln\left|u+\sqrt{u^2-a^2}\right|+C` }],
      check: (lo, hi, v) => {
        positiveA(v)
        const a = n(v, 'a')
        if (!((lo >= a && hi >= a) || (lo <= -a && hi <= -a))) fail('Los dos límites deben estar del mismo lado y cumplir $|u|\\ge a$.')
      },
    }),
  ],
  commonMistakes: [
    'Confundir los signos: en la 27 el logaritmo **resta**; en la 26, suma.',
    'En la 25 usar $\\ln$ en vez de $\\operatorname{arcsen}$ (la 25 viene de un círculo; las de suma y resta, de hipérbolas).',
    'Olvidar que el $\\frac{a^2}{2}$ multiplica sólo al segundo término.',
  ],
  related: ['integrales-arco', 'integrales-logaritmicas', 'longitud-de-arco'],
  keywords: ['raiz', 'area del circulo', 'sustitucion trigonometrica', 'semicirculo', 'integral'],
}

// ─── Polinomios (para las aplicaciones) ──────────────────────────────────────

/** Coeficientes en orden ascendente: [c0, c1, c2, …] */
type Poly = number[]

const fromVec = (abc: number[]): Poly => [abc[2], abc[1], abc[0]] // ⟨A, B, C⟩ = Ax² + Bx + C
const pEval = (p: Poly, x: number) => p.reduceRight((acc, c) => acc * x + c, 0)
const pSub = (p: Poly, q: Poly): Poly => Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) - (q[i] ?? 0))
const pMul = (p: Poly, q: Poly): Poly => {
  const out = new Array(p.length + q.length - 1).fill(0)
  p.forEach((a, i) => q.forEach((b, j) => { out[i + j] += a * b }))
  return out
}
const pInt = (p: Poly): Poly => [0, ...p.map((c, i) => c / (i + 1))]
const pDeriv = (p: Poly): Poly => p.slice(1).map((c, i) => c * (i + 1))

/** Polinomio en LaTeX; si `dens` viene, cada coeficiente se escribe como fracción c/den */
function polyTex(p: Poly, dens?: number[], x = 'x'): string {
  const terms: string[] = []
  for (let k = p.length - 1; k >= 0; k--) {
    const num = p[k], den = dens?.[k] ?? 1
    if (Math.abs(num) < 1e-12) continue
    const sign = num < 0 ? '-' : terms.length ? '+' : ''
    let mag: string
    if (den !== 1 && Number.isInteger(num) && num % den !== 0) {
      const g = gcd(num, den)
      mag = `\\frac{${Math.abs(num) / g}}{${den / g}}`
    } else {
      const val = Math.abs(num / den)
      mag = k > 0 && Math.abs(val - 1) < 1e-12 ? '' : fmt(val)
    }
    terms.push(`${sign}${mag}${k === 0 ? '' : k === 1 ? x : `${x}^{${k}}`}`)
  }
  return terms.length ? terms.join('') : '0'
}

/** Antiderivada de un polinomio con coeficientes como fracciones exactas */
const polyIntTex = (p: Poly) => polyTex([0, ...p], [1, ...p.map((_, i) => i + 1)])

const coefInput = (id: string, label: string, symbol: string, def: number[]) =>
  ({ kind: 'vector' as const, id, label, symbol, default: def, fixedDims: 3 })

function realRoots(p: Poly): number[] {
  const [c, b, a] = [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0]
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b]
  const disc = b * b - 4 * a * c
  if (disc < 0) return []
  const r = Math.sqrt(disc)
  return [(-b - r) / (2 * a), (-b + r) / (2 * a)].sort((x, y) => x - y)
}

/** Región entre f y g pintada de azul donde f ≥ g y de rojo donde g > f */
function bandAreas(f: (x: number) => number, g: (x: number) => number, a: number, b: number): PlotArea[] {
  const xs = sample(x => x, a, b, 200).map(p => p[0])
  return [
    { upper: xs.map(x => [x, Math.max(f(x), g(x))]), lower: xs.map(x => [x, g(x)]), tone: 'a' },
    { upper: xs.map(x => [x, g(x)]), lower: xs.map(x => [x, Math.min(f(x), g(x))]), tone: 'warn' },
  ]
}

// ─── Área entre curvas ───────────────────────────────────────────────────────

interface AreaResult { d: Poly; a: number; b: number; signed: number; total: number; Fa: number; Fb: number; roots: number[] }

function areaCompute(f: Poly, g: Poly, a: number, b: number): AreaResult {
  const d = pSub(f, g)
  const D = pInt(d)
  const Fa = pEval(D, a), Fb = pEval(D, b)
  const roots = realRoots(d).filter(r => r > Math.min(a, b) + 1e-9 && r < Math.max(a, b) - 1e-9)
  // área total: integramos |f−g| tramo por tramo entre los cruces
  const cuts = [Math.min(a, b), ...roots, Math.max(a, b)]
  let total = 0
  for (let i = 0; i < cuts.length - 1; i++) total += Math.abs(pEval(D, cuts[i + 1]) - pEval(D, cuts[i]))
  return { d, a, b, signed: Fb - Fa, total, Fa, Fb, roots }
}

function areaSteps(f: Poly, g: Poly, r: AreaResult): CalcStep[] {
  const steps: CalcStep[] = [
    { label: 'Restamos: la de arriba menos la de abajo', latex: L`f(x)-g(x)=(${polyTex(f)})-(${polyTex(g)})=${polyTex(r.d)}` },
    { label: 'Antiderivada de la resta', latex: L`F(x)=${polyIntTex(r.d)}` },
    { label: 'Teorema fundamental', latex: L`A=F(${fmt(r.b)})-F(${fmt(r.a)})=${fmt(r.Fb)}-${fp(r.Fa)}=${fmt(r.signed)}` },
  ]
  if (r.roots.length) {
    steps.push({ label: `Las curvas se cruzan en $x=${r.roots.map(x => fmt(x)).join(',\\ ')}$: sumamos cada tramo en valor absoluto`, latex: L`A_{\text{total}}=\int_{${fmt(r.a)}}^{${fmt(r.b)}}|f(x)-g(x)|\,dx=${fmt(r.total)}` })
  }
  return steps
}

function areaVisual(f: Poly, g: Poly, a: number, b: number): VisualSpec {
  const F = (x: number) => pEval(f, x), G = (x: number) => pEval(g, x)
  const pad = Math.max((b - a) * 0.3, 0.5)
  const curves = [
    { points: sample(F, a - pad, b + pad), tone: 'a' as const, label: `f(x)=${polyTex(f)}` },
    { points: sample(G, a - pad, b + pad), tone: 'b' as const, label: `g(x)=${polyTex(g)}` },
  ]
  return {
    type: 'plot',
    curves,
    areas: bandAreas(F, G, a, b),
    xRange: [a - pad, b + pad],
    yRange: robustRange(curves.flatMap(c => c.points.map(p => p[1]))),
    caption: 'Azul: tramos donde $f$ va arriba. Rojo: donde $g$ va arriba (en $\\int(f-g)$ esos tramos **restan**).',
  }
}

const areaEntreCurvas: Formula = {
  id: 'area-entre-curvas',
  name: 'Área entre dos curvas',
  category: 'aplicaciones-integral',
  latex: L`A=\int_a^b\left[f(x)-g(x)\right]dx`,
  forms: [
    { label: 'Si las curvas se cruzan', latex: L`A=\int_a^b\left|f(x)-g(x)\right|dx` },
    { label: 'Integrando respecto de y', latex: L`A=\int_c^d\left[x_{\text{der}}(y)-x_{\text{izq}}(y)\right]dy` },
  ],
  summary: 'El área encerrada entre dos gráficas: la integral de “la de arriba menos la de abajo”.',
  goal: 'Medir el área de una región limitada por dos curvas, por ejemplo una parábola y una recta.',
  variables: [
    { symbol: 'f(x)', meaning: 'La curva de **arriba** en el intervalo' },
    { symbol: 'g(x)', meaning: 'La curva de **abajo**' },
    { symbol: 'a,\\ b', meaning: 'Dónde empieza y termina la región; muchas veces son los puntos donde las curvas se cruzan ($f(x)=g(x)$)' },
  ],
  whenToUse: [
    'Para el área encerrada entre dos gráficas.',
    'Si no te dan los límites, iguala las funciones y resuelve $f(x) = g(x)$: los cruces son $a$ y $b$.',
    'Si las curvas se cruzan dentro del intervalo, parte la integral en tramos y en cada uno resta “la de arriba menos la de abajo”.',
  ],
  intuition: [
    'Corta la región en rebanadas verticales muy delgadas. Cada una es un rectángulo de altura $f(x)-g(x)$ y ancho $dx$. La integral las suma todas.',
    'No importa si las curvas están debajo del eje $x$: la **resta** $f-g$ ya mide la altura de cada rebanada.',
    'El área bajo una sola curva es el caso $g(x) = 0$ (el eje $x$).',
  ],
  calculators: [
    calc<AreaResult>({
      id: 'cruces',
      label: 'Región entre los cruces',
      example: 'La parábola $f(x)=-x^2+4$ y la recta $g(x)=x+2$. Escribe los coeficientes de $Ax^2+Bx+C$.',
      inputs: [
        coefInput('f', 'Coeficientes A, B, C de f(x) = Ax² + Bx + C', 'f', [-1, 0, 4]),
        coefInput('g', 'Coeficientes A, B, C de g(x) = Ax² + Bx + C', 'g', [0, 1, 2]),
      ],
      compute: (v) => {
        const f = fromVec(vec(v, 'f')), g = fromVec(vec(v, 'g'))
        const roots = realRoots(pSub(f, g))
        if (roots.length < 2 || close(roots[0], roots[1], 1e-9)) fail('Las curvas no se cruzan en dos puntos, así que no encierran una región. Usa la pestaña **En un intervalo [a, b]**.')
        return areaCompute(f, g, roots[0], roots[1])
      },
      steps: (v, r) => {
        const f = fromVec(vec(v, 'f')), g = fromVec(vec(v, 'g'))
        return [
          { label: 'Igualamos las curvas para encontrar los cruces', latex: L`${polyTex(r.d)}=0\ \Rightarrow\ x=${fmt(r.a)},\quad x=${fmt(r.b)}` },
          ...areaSteps(f, g, r),
        ]
      },
      answer: (_v, r) => L`A=${fmt(Math.abs(r.signed))}`,
      extras: (_v, r) => [
        { label: 'Cruces', latex: L`x=${fmt(r.a)},\ x=${fmt(r.b)}` },
        { label: 'Ancho de la región', latex: fmt(r.b - r.a) },
      ],
      interpret: (_v, r) => [
        { tone: 'good', text: `Las curvas encierran una región de $${fmt(Math.abs(r.signed))}$ unidades² entre $x=${fmt(r.a)}$ y $x=${fmt(r.b)}$.` },
        r.signed < 0
          ? { tone: 'warn', text: 'La integral de $f-g$ salió **negativa**: en esa región $g$ va arriba de $f$. El área es el valor absoluto (o integra $g-f$).' }
          : { tone: 'info', text: 'La integral salió positiva: $f$ es la curva de arriba en toda la región.' },
      ],
      visual: (v, r) => areaVisual(fromVec(vec(v, 'f')), fromVec(vec(v, 'g')), r.a, r.b),
    }),
    calc<AreaResult>({
      id: 'intervalo',
      label: 'En un intervalo [a, b]',
      example: '$f(x)=x^2$ y $g(x)=x$ entre 0 y 2: se cruzan en $x=1$',
      inputs: [
        coefInput('fi', 'Coeficientes A, B, C de f(x) = Ax² + Bx + C', 'f', [1, 0, 0]),
        coefInput('gi', 'Coeficientes A, B, C de g(x) = Ax² + Bx + C', 'g', [0, 1, 0]),
        { kind: 'number', id: 'a', label: 'Desde', symbol: 'a', default: 0 },
        { kind: 'number', id: 'b', label: 'Hasta', symbol: 'b', default: 2 },
      ],
      compute: (v) => {
        const a = n(v, 'a'), b = n(v, 'b')
        if (a >= b) fail('El límite $a$ debe ser menor que $b$.')
        return areaCompute(fromVec(vec(v, 'fi')), fromVec(vec(v, 'gi')), a, b)
      },
      steps: (v, r) => areaSteps(fromVec(vec(v, 'fi')), fromVec(vec(v, 'gi')), r),
      answer: (_v, r) => L`A=${fmt(r.total)}`,
      extras: (_v, r) => [{ label: 'Integral con signo', latex: L`\int_a^b(f-g)\,dx=${fmt(r.signed)}` }],
      interpret: (_v, r) => r.roots.length
        ? [
          { tone: 'warn', text: `Las curvas **se cruzan** en $x=${r.roots.map(x => fmt(x)).join('$ y $x=')}$. La integral directa de $f-g$ da $${fmt(r.signed)}$ porque los tramos rojos restan; el área real es $${fmt(r.total)}$.` },
          { tone: 'info', text: 'Siempre dibuja las curvas antes de integrar: así sabes cuál va arriba en cada tramo.' },
        ]
        : [{ tone: 'good', text: `${r.signed >= 0 ? '$f$' : '$g$'} va arriba en todo el intervalo, así que el área es $${fmt(r.total)}$ unidades².` }],
      visual: (v) => areaVisual(fromVec(vec(v, 'fi')), fromVec(vec(v, 'gi')), n(v, 'a'), n(v, 'b')),
    }),
  ],
  commonMistakes: [
    'Restar al revés (la de abajo menos la de arriba): el resultado sale negativo.',
    'Integrar de corrido cuando las curvas se cruzan: los tramos se cancelan y el área sale menor.',
    'No buscar los cruces: los límites casi siempre son las soluciones de $f(x)=g(x)$.',
  ],
  related: ['integrales-inmediatas', 'volumen-revolucion', 'longitud-de-arco'],
  keywords: ['area entre curvas', 'area entre graficas', 'region', 'integral definida', 'aplicaciones de la integral'],
}

// ─── Longitud de arco ────────────────────────────────────────────────────────

interface ArcResult { L: number; chord: number; ya: number; yb: number }

const longitudArco: Formula = {
  id: 'longitud-de-arco',
  name: 'Longitud de arco de una curva',
  category: 'aplicaciones-integral',
  latex: L`L=\int_a^b\sqrt{1+\left[f'(x)\right]^2}\,dx`,
  forms: [
    { label: 'Curva en forma paramétrica', latex: L`L=\int_{t_1}^{t_2}\sqrt{\left(\frac{dx}{dt}\right)^2+\left(\frac{dy}{dt}\right)^2}\,dt` },
  ],
  summary: 'Mide qué tan larga es una curva entre dos puntos, como si la estiraras.',
  goal: 'La longitud de un tramo de curva: un cable que cuelga, una carretera con curvas, la trayectoria de un proyectil.',
  variables: [
    { symbol: 'L', meaning: 'Longitud de la curva' },
    { symbol: "f'(x)", meaning: 'La derivada (pendiente) de la curva' },
    { symbol: 'a,\\ b', meaning: 'Dónde empieza y termina el tramo, en $x$' },
  ],
  whenToUse: [
    'Para medir la longitud de una gráfica $y = f(x)$ entre $x = a$ y $x = b$.',
    'Si la función es una recta, la fórmula da lo mismo que la distancia entre dos puntos.',
  ],
  intuition: [
    'Divide la curva en pedacitos casi rectos. Cada uno avanza $dx$ en horizontal y $dy$ en vertical, así que por Pitágoras mide $\\sqrt{dx^2+dy^2}$.',
    'Sacando $dx$ de la raíz: $\\sqrt{1+\\left(\\frac{dy}{dx}\\right)^2}\\,dx$. La integral suma todos los pedacitos.',
    'Donde la curva es plana ($f\'=0$) cada pedacito mide sólo $dx$; donde es empinada, mide mucho más.',
    'La curva siempre es al menos tan larga como la cuerda (la recta entre sus extremos).',
  ],
  calculators: [
    calc<ArcResult>({
      id: 'parabola',
      label: 'Parábola Ax² + Bx + C',
      example: '$y = x^2$ entre 0 y 1',
      inputs: [
        coefInput('f', 'Coeficientes A, B, C de f(x) = Ax² + Bx + C', 'f', [1, 0, 0]),
        { kind: 'number', id: 'a', label: 'Desde', symbol: 'a', default: 0 },
        { kind: 'number', id: 'b', label: 'Hasta', symbol: 'b', default: 1 },
      ],
      compute: (v) => {
        const p = fromVec(vec(v, 'f')), a = n(v, 'a'), b = n(v, 'b')
        if (a >= b) fail('El límite $a$ debe ser menor que $b$.')
        const dp = pDeriv(p)
        const Lval = integrate(x => Math.sqrt(1 + pEval(dp, x) ** 2), a, b)
        const ya = pEval(p, a), yb = pEval(p, b)
        return { L: Lval, chord: Math.hypot(b - a, yb - ya), ya, yb }
      },
      steps: (v, r) => {
        const [A, B] = vec(v, 'f'), a = n(v, 'a'), b = n(v, 'b')
        const dTex = polyTex([B, 2 * A])
        const steps: CalcStep[] = [
          { label: 'Derivamos', latex: L`f'(x)=${dTex}` },
          { label: 'Sustituimos en la fórmula', latex: L`L=\int_{${fmt(a)}}^{${fmt(b)}}\sqrt{1+(${dTex})^2}\,dx` },
        ]
        if (A !== 0) {
          const t1 = 2 * A * a + B, t2 = 2 * A * b + B
          steps.push(
            { label: `Cambio de variable $t=${dTex}$, $dt=${fmt(2 * A)}\\,dx$: queda la fórmula 26 con $a=1$`, latex: L`L=\frac{1}{${fmt(2 * A)}}\int_{${fmt(t1)}}^{${fmt(t2)}}\sqrt{t^2+1}\,dt` },
            { label: 'Fórmula 26', latex: L`\int\sqrt{t^2+1}\,dt=\frac t2\sqrt{t^2+1}+\frac12\ln\left(t+\sqrt{t^2+1}\right)` },
          )
        } else {
          steps.push({ label: 'Con $A=0$ es una recta: la raíz es constante', latex: L`L=\sqrt{1+${fp(B)}^2}\,(${fmt(b)}-${fp(a)})` })
        }
        steps.push({ label: 'Resultado', latex: L`L=${fmt(r.L)}` })
        return steps
      },
      answer: (_v, r) => L`L=${fmt(r.L)}`,
      extras: (v, r) => [
        { label: 'Extremos', latex: L`(${fmt(n(v, 'a'))},\ ${fmt(r.ya)})\to(${fmt(n(v, 'b'))},\ ${fmt(r.yb)})` },
        { label: 'Cuerda (línea recta)', latex: fmt(r.chord) },
      ],
      interpret: (_v, r) => [
        { tone: 'good', text: `Si estiraras ese tramo de curva, mediría $${fmt(r.L)}$ unidades.` },
        close(r.L, r.chord, 1e-6)
          ? { tone: 'info', text: 'Mide lo mismo que la cuerda: el tramo es una **recta**.' }
          : { tone: 'info', text: `La línea recta entre los extremos mide $${fmt(r.chord)}$: la curva es $${fmt(((r.L - r.chord) / r.chord) * 100, 2)}\\%$ más larga por sus vueltas.` },
      ],
      visual: (v, r) => {
        const p = fromVec(vec(v, 'f')), a = n(v, 'a'), b = n(v, 'b')
        const pad = (b - a) * 0.3
        const F = (x: number) => pEval(p, x)
        const all = sample(F, a - pad, b + pad)
        return {
          type: 'plot',
          curves: [
            { points: all, tone: 'muted' },
            { points: sample(F, a, b), tone: 'a', label: `f(x)=${polyTex(p)}` },
          ],
          segments: [{ from: [a, r.ya], to: [b, r.yb], tone: 'accent', dashed: true }],
          marks: [{ x: a, y: r.ya, tone: 'a' }, { x: b, y: r.yb, tone: 'a', label: `L = ${fmt(r.L, 3)}` }],
          caption: 'En azul el tramo que se mide; la línea punteada es la cuerda (el camino recto).',
          yRange: robustRange(all.map(q => q[1])),
          xRange: [a - pad, b + pad],
          equal: true,
        }
      },
    }),
    calc<ArcResult & { theta: number }>({
      id: 'circulo',
      label: 'Arco de círculo √(r² − x²)',
      example: 'Comprueba la fórmula con un círculo: el arco debe medir $r\\theta$',
      inputs: [
        { kind: 'number', id: 'r', label: 'Radio', symbol: 'r', default: 2 },
        { kind: 'number', id: 'ca', label: 'Desde', symbol: 'a', default: 0 },
        { kind: 'number', id: 'cb', label: 'Hasta', symbol: 'b', default: 1 },
      ],
      compute: (v) => {
        const R = n(v, 'r'), a = n(v, 'ca'), b = n(v, 'cb')
        if (!(R > 0)) fail('El radio debe ser positivo.')
        if (a >= b) fail('El límite $a$ debe ser menor que $b$.')
        if (Math.abs(a) >= R || Math.abs(b) >= R) fail('Los límites deben cumplir $|x|<r$ (en los bordes la tangente es vertical).')
        const f = (x: number) => Math.sqrt(R * R - x * x)
        const theta = Math.asin(b / R) - Math.asin(a / R)
        return { L: R * theta, theta, chord: Math.hypot(b - a, f(b) - f(a)), ya: f(a), yb: f(b) }
      },
      steps: (v, r) => {
        const R = n(v, 'r'), a = n(v, 'ca'), b = n(v, 'cb')
        return [
          { label: 'Derivamos $f(x)=\\sqrt{r^2-x^2}$', latex: L`f'(x)=\frac{-x}{\sqrt{r^2-x^2}}` },
          { label: 'Simplificamos lo de adentro de la raíz', latex: L`1+[f'(x)]^2=1+\frac{x^2}{r^2-x^2}=\frac{r^2}{r^2-x^2}` },
          { label: 'Queda la fórmula 18 multiplicada por r', latex: L`L=\int_{${fmt(a)}}^{${fmt(b)}}\frac{${fmt(R)}}{\sqrt{${fmt(R * R)}-x^2}}\,dx=${fmt(R)}\left[${ARCSEN}\frac{x}{${fmt(R)}}\right]_{${fmt(a)}}^{${fmt(b)}}` },
          { label: 'Evaluamos', latex: L`L=${fmt(R)}\,(${fmt(Math.asin(b / R))}-${fp(Math.asin(a / R))})=${fmt(r.L)}` },
        ]
      },
      answer: (_v, r) => L`L=${fmt(r.L)}`,
      extras: (_v, r) => [{ label: 'Ángulo del arco', latex: L`\theta=${fmt(r.theta)}\ \text{rad}=${fmt((r.theta * 180) / Math.PI, 2)}^\circ` }],
      interpret: (v, r) => [
        { tone: 'good', text: `La integral da $${fmt(r.L)}$, exactamente $r\\theta = ${fmt(n(v, 'r'))}\\times${fmt(r.theta)}$: la fórmula de longitud de arco reproduce la del círculo.` },
        { tone: 'info', text: `La cuerda mide $${fmt(r.chord)}$, un poco menos que el arco.` },
      ],
      visual: (v, r) => {
        const R = n(v, 'r'), a = n(v, 'ca'), b = n(v, 'cb')
        const f = (x: number) => Math.sqrt(R * R - x * x)
        return {
          type: 'plot',
          curves: [
            { points: sample(f, -R, R, 300), tone: 'muted' },
            { points: sample(f, a, b), tone: 'a', label: L`\text{arco}` },
          ],
          segments: [
            { from: [0, 0], to: [a, r.ya], tone: 'muted', dashed: true },
            { from: [0, 0], to: [b, r.yb], tone: 'muted', dashed: true },
            { from: [a, r.ya], to: [b, r.yb], tone: 'accent', dashed: true },
          ],
          marks: [{ x: b, y: r.yb, tone: 'a', label: `L = ${fmt(r.L, 3)}` }],
          xRange: [-R * 1.1, R * 1.1],
          yRange: [-R * 0.1, R * 1.15],
          equal: true,
        }
      },
    }),
  ],
  commonMistakes: [
    'Olvidar elevar la derivada al cuadrado, o el “$1+$” dentro de la raíz.',
    'Sacar la raíz término por término: $\\sqrt{1+(f\')^2} \\ne 1 + f\'$.',
    'La mayoría de estas integrales no tienen antiderivada sencilla: en el examen suelen elegir curvas que simplifican (como $y = x^{3/2}$).',
  ],
  related: ['integrales-raices', 'area-entre-curvas', 'reglas-derivacion'],
  keywords: ['longitud de arco', 'longitud de curva', 'arco', 'aplicaciones de la integral'],
}

// ─── Volumen de sólidos de revolución ────────────────────────────────────────

interface VolResult { V: number; P: Poly; Fa: number; Fb: number; negative: boolean }

function volCompute(f: Poly, g: Poly | null, a: number, b: number): VolResult {
  if (a >= b) fail('El límite $a$ debe ser menor que $b$.')
  const P = g ? pSub(pMul(f, f), pMul(g, g)) : pMul(f, f)
  const D = pInt(P)
  const Fa = pEval(D, a), Fb = pEval(D, b)
  const negative = g ? sample(x => Math.abs(pEval(f, x)) - Math.abs(pEval(g, x)), a, b, 200).some(([, y]) => y < -1e-9) : false
  return { V: Math.PI * (Fb - Fa), P, Fa, Fb, negative }
}

function volVisual(f: Poly, g: Poly | null, a: number, b: number): VisualSpec {
  const F = (x: number) => Math.abs(pEval(f, x)), G = (x: number) => (g ? Math.abs(pEval(g, x)) : 0)
  const xs = sample(x => x, a, b, 160).map(p => p[0])
  const areas: PlotArea[] = [
    { upper: xs.map(x => [x, F(x)]), lower: xs.map(x => [x, G(x)]), tone: 'a', label: L`\text{región que gira}` },
    { upper: xs.map(x => [x, -G(x)]), lower: xs.map(x => [x, -F(x)]), tone: 'muted' },
  ]
  const curves = [
    { points: sample(F, a, b), tone: 'a' as const, label: `R(x)=|f(x)|` },
    { points: sample(x => -F(x), a, b), tone: 'muted' as const, dashed: true },
    ...(g ? [
      { points: sample(G, a, b), tone: 'b' as const, label: `r(x)=|g(x)|` },
      { points: sample(x => -G(x), a, b), tone: 'muted' as const, dashed: true },
    ] : []),
  ]
  const top = Math.max(...xs.map(F))
  return {
    type: 'plot',
    curves,
    areas,
    segments: [{ from: [a, 0], to: [b, 0], tone: 'accent', label: 'eje de giro' }],
    yRange: [-top * 1.15 - 0.1, top * 1.15 + 0.1],
    caption: 'La región azul gira alrededor del eje $x$; la parte gris es su reflejo: juntas muestran el perfil del sólido.',
  }
}

const volumenRevolucion: Formula = {
  id: 'volumen-revolucion',
  name: 'Volumen de un sólido de revolución (discos y arandelas)',
  category: 'aplicaciones-integral',
  latex: L`V=\pi\int_a^b\left(\left[f(x)\right]^2-\left[g(x)\right]^2\right)dx`,
  forms: [
    { label: 'Discos (sin hueco)', latex: L`V=\pi\int_a^b\left[f(x)\right]^2dx` },
    { label: 'Cascarones (girando alrededor del eje y)', latex: L`V=2\pi\int_a^b x\,f(x)\,dx` },
  ],
  summary: 'El volumen del sólido que se forma al girar una región alrededor del eje $x$. Con hueco son “arandelas” (rondanas).',
  goal: 'Calcular volúmenes de objetos con simetría de rotación: vasos, conos, esferas, tubos, piezas torneadas.',
  variables: [
    { symbol: 'f(x)', meaning: 'Radio **exterior**: distancia del eje a la curva de afuera' },
    { symbol: 'g(x)', meaning: 'Radio **interior** (el hueco). Si no hay hueco, $g = 0$ y quedan discos' },
    { symbol: 'a,\\ b', meaning: 'Dónde empieza y termina el sólido sobre el eje $x$' },
    { symbol: L`\pi`, meaning: 'Viene del área de cada círculo: $\\pi r^2$' },
  ],
  whenToUse: [
    'Una región gira alrededor del eje $x$ y quieres el volumen del sólido que forma.',
    '**Discos**: la región toca el eje de giro (no hay hueco).',
    '**Arandelas (rondanas)**: la región está separada del eje, así que el sólido queda hueco por dentro.',
  ],
  intuition: [
    'Corta el sólido en rebanadas perpendiculares al eje. Cada rebanada es un disco de radio $f(x)$ y grosor $dx$: su volumen es $\\pi[f(x)]^2\\,dx$.',
    'Si hay hueco, cada rebanada es una arandela: el disco grande menos el chico, $\\pi\\left([f(x)]^2 - [g(x)]^2\\right)dx$.',
    'Cuidado: es $f^2 - g^2$, **no** $(f-g)^2$. Se restan las **áreas** de los círculos, no los radios.',
    'Comprobación: girar la recta $y = \\frac{r}{h}x$ de $0$ a $h$ da un cono, y la fórmula da $\\frac13\\pi r^2h$.',
  ],
  calculators: [
    calc<VolResult>({
      id: 'discos',
      label: 'Discos',
      example: 'Girar $y = x$ entre 0 y 3 da un cono de radio 3 y altura 3: $V = 9\\pi$',
      inputs: [
        coefInput('f', 'Coeficientes A, B, C de f(x) = Ax² + Bx + C', 'f', [0, 1, 0]),
        { kind: 'number', id: 'a', label: 'Desde', symbol: 'a', default: 0 },
        { kind: 'number', id: 'b', label: 'Hasta', symbol: 'b', default: 3 },
      ],
      compute: (v) => volCompute(fromVec(vec(v, 'f')), null, n(v, 'a'), n(v, 'b')),
      steps: (v, r) => {
        const f = fromVec(vec(v, 'f')), a = n(v, 'a'), b = n(v, 'b')
        return [
          { label: 'Elevamos el radio al cuadrado', latex: L`[f(x)]^2=(${polyTex(f)})^2=${polyTex(r.P)}` },
          { label: 'Integramos', latex: L`\int[f(x)]^2dx=${polyIntTex(r.P)}` },
          { label: 'Evaluamos entre los límites', latex: L`F(${fmt(b)})-F(${fmt(a)})=${fmt(r.Fb)}-${fp(r.Fa)}=${fmt(r.Fb - r.Fa)}` },
          { label: 'Multiplicamos por π', latex: L`V=${fmt(r.Fb - r.Fa)}\pi=${fmt(r.V)}` },
        ]
      },
      answer: (_v, r) => L`V=${fmt(r.V / Math.PI)}\pi\approx${fmt(r.V)}`,
      interpret: (v, r) => [
        { tone: 'good', text: `El sólido tiene un volumen de $${fmt(r.V)}$ unidades³.` },
        { tone: 'info', text: `Un cilindro del mismo largo con el radio máximo tendría $${fmt(Math.PI * Math.max(...sample(x => pEval(fromVec(vec(v, 'f')), x) ** 2, n(v, 'a'), n(v, 'b'), 200).map(p => p[1])) * (n(v, 'b') - n(v, 'a')))}$: el sólido ocupa una parte de ese cilindro.` },
      ],
      visual: (v) => volVisual(fromVec(vec(v, 'f')), null, n(v, 'a'), n(v, 'b')),
    }),
    calc<VolResult>({
      id: 'arandelas',
      label: 'Arandelas (con hueco)',
      example: 'La región entre $y = x$ (afuera) y $y = x^2$ (adentro), de 0 a 1, girando alrededor del eje $x$',
      inputs: [
        coefInput('fo', 'Radio exterior f(x) = Ax² + Bx + C', 'f', [0, 1, 0]),
        coefInput('gi', 'Radio interior g(x) = Ax² + Bx + C', 'g', [1, 0, 0]),
        { kind: 'number', id: 'wa', label: 'Desde', symbol: 'a', default: 0 },
        { kind: 'number', id: 'wb', label: 'Hasta', symbol: 'b', default: 1 },
      ],
      compute: (v) => volCompute(fromVec(vec(v, 'fo')), fromVec(vec(v, 'gi')), n(v, 'wa'), n(v, 'wb')),
      steps: (v, r) => {
        const f = fromVec(vec(v, 'fo')), g = fromVec(vec(v, 'gi')), a = n(v, 'wa'), b = n(v, 'wb')
        return [
          { label: 'Radio exterior al cuadrado', latex: L`[f(x)]^2=(${polyTex(f)})^2=${polyTex(pMul(f, f))}` },
          { label: 'Radio interior al cuadrado', latex: L`[g(x)]^2=(${polyTex(g)})^2=${polyTex(pMul(g, g))}` },
          { label: 'Restamos las áreas de los círculos (no los radios)', latex: L`[f(x)]^2-[g(x)]^2=${polyTex(r.P)}` },
          { label: 'Integramos', latex: L`F(x)=${polyIntTex(r.P)}` },
          { label: 'Evaluamos y multiplicamos por π', latex: L`V=\pi\left[F(${fmt(b)})-F(${fmt(a)})\right]=\pi\left(${fmt(r.Fb)}-${fp(r.Fa)}\right)=${fmt(r.V / Math.PI)}\pi=${fmt(r.V)}` },
        ]
      },
      answer: (_v, r) => L`V=${fmt(r.V / Math.PI)}\pi\approx${fmt(r.V)}`,
      interpret: (_v, r) => [
        r.negative
          ? { tone: 'warn', text: 'En parte del intervalo el radio “interior” queda **más lejos** del eje que el exterior: revisa cuál curva va afuera. El resultado no representa un volumen real.' }
          : { tone: 'good', text: `El sólido hueco tiene un volumen de $${fmt(r.V)}$ unidades³.` },
        { tone: 'info', text: 'Si quitaras el hueco ($g = 0$), usarías la fórmula de discos.' },
      ],
      visual: (v) => volVisual(fromVec(vec(v, 'fo')), fromVec(vec(v, 'gi')), n(v, 'wa'), n(v, 'wb')),
    }),
  ],
  commonMistakes: [
    'Escribir $(f-g)^2$ en vez de $f^2 - g^2$.',
    'Olvidar el $\\pi$.',
    'Confundir cuál es el radio exterior: es la curva **más lejana al eje de giro**, no necesariamente la “de arriba”.',
    'Usar la fórmula de discos cuando el sólido tiene hueco.',
  ],
  related: ['area-entre-curvas', 'integrales-inmediatas', 'longitud-de-arco'],
  keywords: ['volumen', 'solido de revolucion', 'discos', 'arandelas', 'rondanas', 'aplicaciones de la integral', 'cono'],
}

export const INTEGRALES: Formula[] = [
  integralesInmediatas, integralesTrig, integralesArco, integralesLog, integralesRaices,
  areaEntreCurvas, longitudArco, volumenRevolucion,
]
