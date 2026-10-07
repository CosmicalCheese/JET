import { calc, fail, num, type CalcStep, type Formula, type Interpretation } from '../types'
import { fmt, fp } from '../format'
import { L, close, coef, gcd, quad, robustRange, sample } from './calculo-comun'

const check = (a: number, b: number): Interpretation =>
  close(a, b, 1e-9)
    ? { tone: 'info', text: `Comprobación: calcular directo da $${fmt(b)}$, lo mismo que la fórmula.` }
    : { tone: 'warn', text: `La comprobación directa da $${fmt(b)}$ (diferencia por redondeo).` }

// ─── Productos notables ──────────────────────────────────────────────────────

const productosNotables: Formula = {
  id: 'productos-notables',
  name: 'Productos notables y factorización',
  category: 'algebra',
  latex: L`(a+b)^2=a^2+2ab+b^2`,
  forms: [
    { label: 'Binomio al cuadrado (resta)', latex: L`(a-b)^2=a^2-2ab+b^2` },
    { label: 'Diferencia de cuadrados', latex: L`a^2-b^2=(a+b)(a-b)` },
    { label: 'Binomio al cubo', latex: L`(a\pm b)^3=a^3\pm3a^2b+3ab^2\pm b^3` },
    { label: 'Diferencia de cubos', latex: L`a^3-b^3=(a-b)(a^2+ab+b^2)` },
    { label: 'Diferencia de potencias', latex: L`a^n-b^n=(a-b)(a^{n-1}+a^{n-2}b+\cdots+ab^{n-2}+b^{n-1})` },
  ],
  summary: 'Multiplicaciones que aparecen tanto que conviene saberlas de memoria, en las dos direcciones: para expandir y para factorizar.',
  goal: 'Expandir binomios sin multiplicar término por término y, al revés, **factorizar** expresiones para simplificar fracciones, resolver ecuaciones o calcular límites.',
  variables: [
    { symbol: 'a,\\ b', meaning: 'Cualquier número o expresión (por ejemplo $a = 2x$, $b = 3$)' },
    { symbol: 'n', meaning: 'Un entero positivo' },
  ],
  whenToUse: [
    'Para expandir $(x+3)^2$ o $(2x-1)^3$ rápidamente.',
    'Para **factorizar**: $x^2-9=(x+3)(x-3)$. Es la clave para simplificar fracciones y para límites del tipo $\\frac00$.',
    'Para **racionalizar**: multiplicar por el conjugado usa $(a+b)(a-b)=a^2-b^2$.',
    'Para cálculo mental: $51^2 = (50+1)^2 = 2500+100+1 = 2601$.',
  ],
  intuition: [
    '$(a+b)^2$ es el área de un cuadrado de lado $a+b$. Se parte en un cuadrado $a^2$, otro $b^2$ y **dos** rectángulos $ab$. Por eso $(a+b)^2 \\ne a^2+b^2$: faltarían los rectángulos.',
    'En la diferencia de cuadrados los términos cruzados se cancelan: $(a+b)(a-b) = a^2 - ab + ab - b^2$.',
    'Los coeficientes del cubo (1, 3, 3, 1) son una fila del **triángulo de Pascal**. La siguiente potencia usa 1, 4, 6, 4, 1.',
  ],
  derivation: {
    steps: [
      { label: 'Multiplicamos término por término', latex: L`(a+b)(a+b)=a\cdot a+a\cdot b+b\cdot a+b\cdot b` },
      { label: 'Los dos términos del medio son iguales', latex: L`=a^2+2ab+b^2` },
      { label: 'Para el cubo, multiplicamos otra vez por (a+b)', latex: L`(a^2+2ab+b^2)(a+b)=a^3+3a^2b+3ab^2+b^3` },
    ],
  },
  calculators: [
    calc<{ sum: number; diff: number }>({
      id: 'cuadrado',
      label: 'Binomio al cuadrado',
      example: 'El cuadrado de lado $3+2$',
      inputs: [
        { kind: 'number', id: 'a', label: 'Primer término', symbol: 'a', default: 3 },
        { kind: 'number', id: 'b', label: 'Segundo término', symbol: 'b', default: 2 },
      ],
      compute: (v) => {
        const a = num(v, 'a'), b = num(v, 'b')
        return { sum: a * a + 2 * a * b + b * b, diff: a * a - 2 * a * b + b * b }
      },
      steps: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b')
        return [
          { label: 'Cuadrado del primero, más el doble del producto, más el cuadrado del segundo', latex: L`(${fmt(a)}+${fp(b)})^2=${fp(a)}^2+2(${fmt(a)})(${fmt(b)})+${fp(b)}^2` },
          { label: 'Evaluamos cada término', latex: L`=${fmt(a * a)}+${fp(2 * a * b)}+${fmt(b * b)}=${fmt(r.sum)}` },
          { label: 'Con resta sólo cambia el signo del término del medio', latex: L`(${fmt(a)}-${fp(b)})^2=${fmt(a * a)}-${fp(2 * a * b)}+${fmt(b * b)}=${fmt(r.diff)}` },
        ]
      },
      answer: (v, r) => L`(${fmt(num(v, 'a'))}+${fp(num(v, 'b'))})^2=${fmt(r.sum)}`,
      extras: (v, r) => [
        { label: 'Con resta', latex: L`(a-b)^2=${fmt(r.diff)}` },
        { label: 'Error común', latex: L`a^2+b^2=${fmt(num(v, 'a') ** 2 + num(v, 'b') ** 2)}` },
      ],
      interpret: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b')
        return [
          check(r.sum, (a + b) ** 2),
          { tone: 'warn', text: `Si sólo elevaras cada término ($a^2+b^2$) obtendrías $${fmt(a * a + b * b)}$: te faltarían los dos rectángulos de $${fmt(a * b)}$.` },
        ]
      },
      visual: (v) => {
        const a = num(v, 'a'), b = num(v, 'b')
        // el dibujo de áreas sólo tiene sentido con longitudes positivas
        if (a <= 0 || b <= 0) return undefined
        const rect = (x0: number, y0: number, x1: number, y1: number, tone: 'a' | 'b' | 'accent') => ({
          upper: [[x0, y1], [x1, y1]] as [number, number][],
          lower: [[x0, y0], [x1, y0]] as [number, number][],
          tone,
        })
        const s = a + b
        return {
          type: 'plot',
          areas: [rect(0, b, a, s, 'a'), rect(a, 0, s, b, 'b'), rect(0, 0, a, b, 'accent'), rect(a, b, s, s, 'accent')],
          segments: [
            { from: [a, 0], to: [a, s], tone: 'muted' },
            { from: [0, b], to: [s, b], tone: 'muted' },
            { from: [0, 0], to: [s, 0], tone: 'muted' },
            { from: [0, s], to: [s, s], tone: 'muted' },
            { from: [0, 0], to: [0, s], tone: 'muted' },
            { from: [s, 0], to: [s, s], tone: 'muted' },
          ],
          marks: [
            { x: a / 2, y: b + a / 2, tone: 'a', label: `a² = ${fmt(a * a)}` },
            { x: a + b / 2, y: b / 2, tone: 'b', label: `b² = ${fmt(b * b)}` },
            { x: a / 2, y: b / 2, tone: 'accent', label: `ab = ${fmt(a * b)}` },
            { x: a + b / 2, y: b + a / 2, tone: 'accent', label: `ab` },
          ],
          equal: true,
          caption: 'El cuadrado de lado $a+b$ se parte en $a^2$, $b^2$ y **dos** rectángulos $ab$.',
        }
      },
    }),
    calc<{ sum: number; diff: number }>({
      id: 'cubo',
      label: 'Binomio al cubo',
      inputs: [
        { kind: 'number', id: 'a', label: 'Primer término', symbol: 'a', default: 3 },
        { kind: 'number', id: 'b', label: 'Segundo término', symbol: 'b', default: 2 },
      ],
      compute: (v) => {
        const a = num(v, 'a'), b = num(v, 'b')
        return { sum: a ** 3 + 3 * a * a * b + 3 * a * b * b + b ** 3, diff: a ** 3 - 3 * a * a * b + 3 * a * b * b - b ** 3 }
      },
      steps: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b')
        return [
          { label: 'Coeficientes 1, 3, 3, 1; la potencia de a baja y la de b sube', latex: L`(a+b)^3=a^3+3a^2b+3ab^2+b^3` },
          { label: 'Sustituimos', latex: L`=${fp(a)}^3+3${fp(a)}^2${fp(b)}+3${fp(a)}${fp(b)}^2+${fp(b)}^3` },
          { label: 'Evaluamos', latex: L`=${fmt(a ** 3)}+${fp(3 * a * a * b)}+${fp(3 * a * b * b)}+${fp(b ** 3)}=${fmt(r.sum)}` },
          { label: 'Con resta, los signos se alternan', latex: L`(a-b)^3=${fmt(a ** 3)}-${fp(3 * a * a * b)}+${fp(3 * a * b * b)}-${fp(b ** 3)}=${fmt(r.diff)}` },
        ]
      },
      answer: (v, r) => L`(${fmt(num(v, 'a'))}+${fp(num(v, 'b'))})^3=${fmt(r.sum)}`,
      extras: (_v, r) => [{ label: 'Con resta', latex: L`(a-b)^3=${fmt(r.diff)}` }],
      interpret: (v, r) => [check(r.sum, (num(v, 'a') + num(v, 'b')) ** 3)],
    }),
    calc<{ value: number; terms: string[] }>({
      id: 'potencias',
      label: 'Diferencia de potencias',
      example: '$a^4 - b^4$ con $a = 3$, $b = 2$',
      inputs: [
        { kind: 'number', id: 'a', label: 'Primer término', symbol: 'a', default: 3 },
        { kind: 'number', id: 'b', label: 'Segundo término', symbol: 'b', default: 2 },
        { kind: 'number', id: 'n', label: 'Exponente', symbol: 'n', default: 4 },
      ],
      compute: (v) => {
        const nn = num(v, 'n')
        if (!Number.isInteger(nn) || nn < 2 || nn > 12) fail('El exponente debe ser un entero entre 2 y 12.')
        const terms: string[] = []
        for (let k = nn - 1; k >= 0; k--) {
          const ea = k, eb = nn - 1 - k
          terms.push([ea ? (ea === 1 ? 'a' : `a^{${ea}}`) : '', eb ? (eb === 1 ? 'b' : `b^{${eb}}`) : ''].join('') || '1')
        }
        return { value: num(v, 'a') ** nn - num(v, 'b') ** nn, terms }
      },
      steps: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b'), nn = num(v, 'n')
        const second = Array.from({ length: nn }, (_, i) => a ** (nn - 1 - i) * b ** i).reduce((s, x) => s + x, 0)
        return [
          { label: 'Factorización: (a − b) por una suma donde la potencia de a baja y la de b sube', latex: L`a^{${nn}}-b^{${nn}}=(a-b)(${r.terms.join('+')})` },
          { label: 'Primer factor', latex: L`a-b=${fmt(a)}-${fp(b)}=${fmt(a - b)}` },
          { label: 'Segundo factor', latex: L`${r.terms.join('+')}=${fmt(second)}` },
          { label: 'Multiplicamos', latex: L`(${fmt(a - b)})(${fmt(second)})=${fmt((a - b) * second)}` },
        ]
      },
      answer: (v, r) => L`${fp(num(v, 'a'))}^{${num(v, 'n')}}-${fp(num(v, 'b'))}^{${num(v, 'n')}}=${fmt(r.value)}`,
      interpret: (v, r) => {
        const nn = num(v, 'n')
        const out: Interpretation[] = [check(r.value, num(v, 'a') ** nn - num(v, 'b') ** nn)]
        if (nn % 2 === 0) out.push({ tone: 'info', text: `Como $n=${nn}$ es par, también se puede factorizar como diferencia de cuadrados: $a^{${nn}}-b^{${nn}}=(a^{${nn / 2}}-b^{${nn / 2}})(a^{${nn / 2}}+b^{${nn / 2}})$.` })
        return out
      },
    }),
  ],
  commonMistakes: [
    '$(a+b)^2 \\ne a^2 + b^2$. Falta el término $2ab$.',
    'Olvidar el 3 en los términos del medio del cubo.',
    'Pensar que $a^2+b^2$ se factoriza: con números reales **no** se puede.',
    'Confundir el signo en la diferencia de cubos: $a^3-b^3=(a-b)(a^2\\mathbf{+}ab+b^2)$.',
  ],
  related: ['completar-cuadrado', 'leyes-exponentes', 'suma-fracciones'],
  keywords: ['binomio al cuadrado', 'trinomio cuadrado perfecto', 'diferencia de cuadrados', 'diferencia de cubos', 'factorizar', 'factorizacion', 'algebra'],
}

// ─── Completar el cuadrado ───────────────────────────────────────────────────

interface SqResult { h: number; k: number; roots: number[] }

const completarCuadrado: Formula = {
  id: 'completar-cuadrado',
  name: 'Completar el cuadrado',
  category: 'algebra',
  latex: L`ax^2+bx+c=a\left(x+\frac{b}{2a}\right)^2+c-\frac{b^2}{4a}`,
  forms: [
    { label: 'Forma de vértice', latex: L`y=a(x-h)^2+k,\qquad h=-\frac{b}{2a},\quad k=c-\frac{b^2}{4a}` },
    { label: 'De aquí sale la fórmula general', latex: L`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}` },
  ],
  summary: 'Reescribe un trinomio como un binomio al cuadrado más una constante. Da el vértice de la parábola y la fórmula general.',
  goal: 'Pasar $ax^2+bx+c$ a la forma $a(x-h)^2+k$. Así se ve de inmediato el **vértice** $(h, k)$ de la parábola, se resuelven ecuaciones cuadráticas y se preparan integrales como $\\int\\frac{dx}{x^2+4x+13}$.',
  variables: [
    { symbol: 'a,\\ b,\\ c', meaning: 'Coeficientes del trinomio ($a\\ne0$)' },
    { symbol: '(h,\\ k)', meaning: 'Vértice de la parábola: su punto más bajo (si $a>0$) o más alto (si $a<0$)' },
  ],
  whenToUse: [
    'Para encontrar el **vértice** (máximo o mínimo) de una parábola.',
    'Para resolver $ax^2+bx+c=0$ cuando no factoriza fácil.',
    'En integrales: convierte $x^2+6x+13$ en $(x+3)^2+4$, que encaja con $\\int\\frac{du}{u^2+a^2}$.',
    'Para identificar circunferencias: $x^2+y^2-4x+6y=3$ se vuelve $(x-2)^2+(y+3)^2=16$.',
  ],
  intuition: [
    '$x^2+bx$ es un cuadrado de lado $x$ más un rectángulo de $x\\times b$. Si partes el rectángulo en dos tiras de $\\frac b2$ y las pegas a dos lados del cuadrado, casi formas un cuadrado más grande de lado $x+\\frac b2$: sólo falta la esquina, de área $\\left(\\frac b2\\right)^2$.',
    '“Completar” es sumar esa esquina, y restarla también para no cambiar el valor.',
    'Un cuadrado nunca es negativo. Por eso en $a(x-h)^2+k$ se ve que el valor extremo es $k$ y que ocurre cuando $x=h$.',
  ],
  derivation: {
    steps: [
      { label: 'Factorizamos a de los dos primeros términos', latex: L`ax^2+bx+c=a\left(x^2+\frac bax\right)+c` },
      { label: 'Sumamos y restamos el cuadrado de la mitad de b/a', latex: L`=a\left(x^2+\frac bax+\frac{b^2}{4a^2}-\frac{b^2}{4a^2}\right)+c` },
      { label: 'Los tres primeros forman un binomio al cuadrado', latex: L`=a\left(x+\frac{b}{2a}\right)^2-\frac{b^2}{4a}+c` },
    ],
  },
  calculators: [
    calc<SqResult>({
      id: 'vertice',
      label: 'Forma de vértice',
      example: '$y = x^2 - 4x + 1$',
      inputs: [
        { kind: 'number', id: 'a', label: 'Coeficiente de x²', symbol: 'a', default: 1 },
        { kind: 'number', id: 'b', label: 'Coeficiente de x', symbol: 'b', default: -4 },
        { kind: 'number', id: 'c', label: 'Término independiente', symbol: 'c', default: 1 },
      ],
      compute: (v) => {
        const a = num(v, 'a'), b = num(v, 'b'), c = num(v, 'c')
        if (a === 0) fail('Con $a=0$ no es una parábola sino una recta.')
        const h = -b / (2 * a), k = c - (b * b) / (4 * a)
        const disc = b * b - 4 * a * c
        const roots = disc < 0 ? [] : disc === 0 ? [h] : [h - Math.sqrt(disc) / (2 * Math.abs(a)), h + Math.sqrt(disc) / (2 * Math.abs(a))]
        return { h, k, roots }
      },
      steps: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b'), c = num(v, 'c')
        const half = b / (2 * a)
        const steps: CalcStep[] = []
        if (a !== 1) steps.push({ label: 'Factorizamos a de los términos con x', latex: L`${quad(a, b, c)}=${fmt(a)}\left(x^2${b / a < 0 ? '' : '+'}${fmt(b / a)}x\right)${c < 0 ? '' : '+'}${fmt(c)}` })
        steps.push(
          { label: 'La mitad del coeficiente de x, al cuadrado', latex: L`\left(\frac{${fmt(b / a)}}{2}\right)^2=${fp(half)}^2=${fmt(half * half)}` },
          { label: 'Sumamos y restamos ese número dentro del paréntesis', latex: L`${coef(a)}\left(x^2${b / a < 0 ? '' : '+'}${fmt(b / a)}x+${fmt(half * half)}-${fmt(half * half)}\right)${c < 0 ? '' : '+'}${fmt(c)}` },
          { label: 'Agrupamos el binomio al cuadrado y sacamos la constante', latex: L`${coef(a)}\left(x${half < 0 ? '' : '+'}${fmt(half)}\right)^2${-a * half * half + c < 0 ? '' : '+'}${fmt(c - a * half * half)}` },
          { label: 'Vértice', latex: L`h=-\frac{b}{2a}=${fmt(r.h)},\qquad k=c-\frac{b^2}{4a}=${fmt(r.k)}` },
        )
        return steps
      },
      answer: (v, r) => L`${quad(num(v, 'a'), num(v, 'b'), num(v, 'c'))}=${coef(num(v, 'a'))}\left(x${r.h > 0 ? '-' : '+'}${fmt(Math.abs(r.h))}\right)^2${r.k < 0 ? '' : '+'}${fmt(r.k)}`,
      extras: (_v, r) => [
        { label: 'Vértice', latex: L`(${fmt(r.h)},\ ${fmt(r.k)})` },
        { label: 'Raíces', latex: r.roots.length ? r.roots.map(x => `x=${fmt(x)}`).join(',\\ ') : L`\text{no tiene reales}` },
      ],
      interpret: (v, r) => {
        const a = num(v, 'a')
        return [
          { tone: 'good', text: `La parábola abre hacia ${a > 0 ? '**arriba**' : '**abajo**'}, así que su ${a > 0 ? '**mínimo**' : '**máximo**'} es $y=${fmt(r.k)}$ y ocurre en $x=${fmt(r.h)}$.` },
          r.roots.length === 0
            ? { tone: 'info', text: `Como el vértice está ${a > 0 ? 'arriba' : 'abajo'} del eje y la parábola abre hacia ${a > 0 ? 'arriba' : 'abajo'}, **nunca cruza** el eje $x$: no hay raíces reales.` }
            : { tone: 'info', text: `Cruza el eje $x$ en ${r.roots.map(x => `$x=${fmt(x)}$`).join(' y ')}: las raíces quedan a la misma distancia del vértice.` },
        ]
      },
      visual: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b'), c = num(v, 'c')
        const f = (x: number) => a * x * x + b * x + c
        const w = Math.max(3, ...r.roots.map(x => Math.abs(x - r.h) * 1.4))
        const pts = sample(f, r.h - w, r.h + w)
        return {
          type: 'plot',
          curves: [{ points: pts, tone: 'a', label: `y=${quad(a, b, c)}` }],
          segments: [{ from: [r.h, Math.min(0, r.k)], to: [r.h, Math.max(0, r.k)], tone: 'muted', dashed: true }],
          marks: [
            { x: r.h, y: r.k, label: `vértice (${fmt(r.h, 2)}, ${fmt(r.k, 2)})` },
            ...r.roots.map(x => ({ x, y: 0, tone: 'b' as const })),
          ],
          yRange: robustRange([...pts.map(p => p[1]), 0]),
        }
      },
    }),
  ],
  commonMistakes: [
    'Sumar el número para completar sin restarlo: cambias la expresión.',
    'Olvidar factorizar $a$ primero cuando $a\\ne1$.',
    'Equivocarse de signo en el vértice: en $(x-3)^2$ el vértice está en $x=+3$, y en $(x+3)^2$ en $x=-3$.',
  ],
  related: ['productos-notables', 'integrales-arco'],
  keywords: ['completar el cuadrado', 'trinomio', 'vertice', 'parabola', 'formula general', 'cuadratica', 'algebra'],
}

// ─── Leyes de los exponentes y radicales ─────────────────────────────────────

const leyesExponentes: Formula = {
  id: 'leyes-exponentes',
  name: 'Leyes de los exponentes y de los radicales',
  category: 'algebra',
  latex: L`a^m\,a^n=a^{m+n}`,
  forms: [
    { label: 'Potencia de una potencia', latex: L`(a^m)^n=a^{mn}` },
    { label: 'Potencia de un producto', latex: L`(ab)^n=a^nb^n` },
    { label: 'Cociente', latex: L`\frac{a^m}{a^n}=a^{m-n}` },
    { label: 'Exponentes cero y negativo', latex: L`a^0=1\qquad a^{-m}=\frac{1}{a^m}` },
    { label: 'Exponente fraccionario', latex: L`\sqrt[n]{a^m}=a^{\frac mn}\qquad\frac{1}{a^{m/n}}=a^{-\frac mn}` },
    { label: 'Raíz de un producto y de un cociente', latex: L`\sqrt[n]{ab}=\sqrt[n]a\sqrt[n]b\qquad\sqrt[n]{\frac ab}=\frac{\sqrt[n]a}{\sqrt[n]b}=a^{\frac1n}b^{-\frac1n}` },
  ],
  summary: 'Las reglas para multiplicar, dividir y elevar potencias, y para convertir raíces en exponentes fraccionarios.',
  goal: 'Simplificar expresiones con potencias y raíces, y reescribirlas en la forma $x^n$ que necesitan las derivadas y las integrales.',
  variables: [
    { symbol: 'a,\\ b', meaning: 'La base (el número que se multiplica)' },
    { symbol: 'm,\\ n', meaning: 'Exponentes (cuántas veces se multiplica la base)' },
    { symbol: L`\sqrt[n]{\ }`, meaning: 'Raíz $n$-ésima: el número que elevado a la $n$ da lo de adentro' },
  ],
  whenToUse: [
    'Antes de derivar o integrar: $\\frac{1}{\\sqrt x}=x^{-1/2}$ ya se puede usar con la regla de la potencia.',
    'Para simplificar fracciones con potencias de la misma base.',
    'En notación científica: $(3\\times10^5)(2\\times10^{-2})=6\\times10^{3}$.',
  ],
  intuition: [
    '$a^3a^2 = (a\\cdot a\\cdot a)(a\\cdot a) = a^5$: al multiplicar, se **cuentan** todos los factores, por eso los exponentes se suman.',
    'Dividir cancela factores: $\\frac{a^5}{a^2}=a^3$. Si cancelas todos, $\\frac{a^3}{a^3}=a^0=1$. Si cancelas de más, quedan abajo: exponente negativo.',
    'Una raíz es un exponente fraccionario porque $\\left(a^{1/2}\\right)^2 = a^{1}$: dos mitades hacen un entero.',
  ],
  calculators: [
    calc<{ prod: number; pow: number; quo: number; neg: number }>({
      id: 'exponentes',
      label: 'Exponentes',
      inputs: [
        { kind: 'number', id: 'a', label: 'Base', symbol: 'a', default: 2 },
        { kind: 'number', id: 'm', label: 'Exponente m', symbol: 'm', default: 3 },
        { kind: 'number', id: 'n', label: 'Exponente n', symbol: 'n', default: 2 },
      ],
      compute: (v) => {
        const a = num(v, 'a'), m = num(v, 'm'), nn = num(v, 'n')
        if (a === 0 && (m <= 0 || nn <= 0)) fail('Con base 0 los exponentes deben ser positivos ($0^0$ y $0^{-1}$ no están definidos).')
        if (a < 0 && (!Number.isInteger(m) || !Number.isInteger(nn))) fail('Con base negativa usa exponentes enteros (si no, saldría la raíz de un negativo).')
        return { prod: a ** (m + nn), pow: a ** (m * nn), quo: a ** (m - nn), neg: a ** -m }
      },
      steps: (v, r) => {
        const a = fp(num(v, 'a')), m = num(v, 'm'), nn = num(v, 'n')
        return [
          { label: 'Producto: se suman los exponentes', latex: L`${a}^{${fmt(m)}}\cdot${a}^{${fmt(nn)}}=${a}^{${fmt(m)}+${fp(nn)}}=${a}^{${fmt(m + nn)}}=${fmt(r.prod)}` },
          { label: 'Potencia de potencia: se multiplican', latex: L`\left(${a}^{${fmt(m)}}\right)^{${fmt(nn)}}=${a}^{${fmt(m)}\cdot${fp(nn)}}=${a}^{${fmt(m * nn)}}=${fmt(r.pow)}` },
          { label: 'Cociente: se restan', latex: L`\frac{${a}^{${fmt(m)}}}{${a}^{${fmt(nn)}}}=${a}^{${fmt(m)}-${fp(nn)}}=${a}^{${fmt(m - nn)}}=${fmt(r.quo)}` },
          { label: 'Exponente negativo: recíproco', latex: L`${a}^{-${fp(m)}}=\frac{1}{${a}^{${fmt(m)}}}=${fmt(r.neg)}` },
        ]
      },
      answer: (v, r) => L`${fp(num(v, 'a'))}^{${fmt(num(v, 'm'))}}\cdot${fp(num(v, 'a'))}^{${fmt(num(v, 'n'))}}=${fmt(r.prod)}`,
      extras: (_v, r) => [
        { label: 'Potencia de potencia', latex: fmt(r.pow) },
        { label: 'Cociente', latex: fmt(r.quo) },
        { label: 'Exponente negativo', latex: fmt(r.neg) },
      ],
      interpret: (v, r) => {
        const a = num(v, 'a'), m = num(v, 'm'), nn = num(v, 'n')
        return [
          check(r.prod, a ** m * a ** nn),
          { tone: 'warn', text: `Error común: multiplicar los exponentes en el producto daría $${fp(a)}^{${fmt(m * nn)}}=${fmt(a ** (m * nn))}$, que es otra cosa.` },
        ]
      },
    }),
    calc<{ value: number }>({
      id: 'radicales',
      label: 'Radicales',
      example: '$\\sqrt[3]{8^2}$',
      inputs: [
        { kind: 'number', id: 'ra', label: 'Radicando (lo de adentro)', symbol: 'a', default: 8 },
        { kind: 'number', id: 'rm', label: 'Exponente de adentro', symbol: 'm', default: 2 },
        { kind: 'number', id: 'rn', label: 'Índice de la raíz', symbol: 'n', default: 3 },
      ],
      compute: (v) => {
        const a = num(v, 'ra'), m = num(v, 'rm'), nn = num(v, 'rn')
        if (!Number.isInteger(nn) || nn < 2) fail('El índice de la raíz debe ser un entero mayor o igual a 2.')
        const inside = a ** m
        if (inside < 0 && nn % 2 === 0) fail('Una raíz de índice par de un número negativo no existe en los reales.')
        const value = inside < 0 ? -(Math.abs(inside) ** (1 / nn)) : inside ** (1 / nn)
        return { value }
      },
      steps: (v, r) => {
        const a = num(v, 'ra'), m = num(v, 'rm'), nn = num(v, 'rn')
        const g = Number.isInteger(m) ? gcd(m, nn) : 1
        const steps: CalcStep[] = [
          { label: 'El índice pasa a ser el denominador del exponente', latex: L`\sqrt[${nn}]{${fp(a)}^{${fmt(m)}}}=${fp(a)}^{\frac{${fmt(m)}}{${nn}}}` },
        ]
        if (g > 1) steps.push({ label: 'Simplificamos la fracción del exponente', latex: L`${fp(a)}^{\frac{${fmt(m)}}{${nn}}}=${fp(a)}^{\frac{${m / g}}{${nn / g}}}` })
        steps.push({ label: 'Evaluamos', latex: L`=${fmt(r.value)}` })
        return steps
      },
      answer: (v, r) => L`\sqrt[${num(v, 'rn')}]{${fp(num(v, 'ra'))}^{${fmt(num(v, 'rm'))}}}=${fmt(r.value)}`,
      extras: (v) => [{ label: 'Como exponente', latex: L`${fp(num(v, 'ra'))}^{${fmt(num(v, 'rm'))}/${num(v, 'rn')}}` }],
      interpret: (v, r) => [
        { tone: 'good', text: `$${fmt(r.value)}$ elevado a la $${num(v, 'rn')}$ da $${fmt(r.value ** num(v, 'rn'))}$, que es lo de adentro de la raíz.` },
        { tone: 'info', text: 'Escribir raíces como exponentes fraccionarios es el primer paso para derivarlas o integrarlas con la regla de la potencia.' },
      ],
    }),
  ],
  commonMistakes: [
    'Multiplicar exponentes en un producto: $a^2a^3=a^5$, **no** $a^6$.',
    'Distribuir una potencia sobre una suma: $(a+b)^2 \\ne a^2+b^2$ (sólo vale con productos).',
    'Pensar que $a^{-2}$ es negativo: es $\\frac{1}{a^2}$, positivo.',
    'Separar una raíz de una suma: $\\sqrt{a+b} \\ne \\sqrt a+\\sqrt b$.',
  ],
  related: ['propiedades-logaritmos', 'productos-notables', 'reglas-derivacion'],
  keywords: ['exponentes', 'potencias', 'radicales', 'raices', 'exponente negativo', 'exponente fraccionario', 'leyes de los exponentes', 'algebra'],
}

// ─── Propiedades de los logaritmos ───────────────────────────────────────────

const propiedadesLogaritmos: Formula = {
  id: 'propiedades-logaritmos',
  name: 'Propiedades de los logaritmos',
  category: 'algebra',
  latex: L`\ln(AB)=\ln A+\ln B`,
  forms: [
    { label: '1–2) Valores básicos', latex: L`\ln1=0\qquad\ln e=1` },
    { label: '4) Cociente', latex: L`\ln\frac AB=\ln A-\ln B` },
    { label: '5) Potencia', latex: L`\ln A^n=n\ln A` },
    { label: '6) Raíz', latex: L`\ln\sqrt[n]{A^m}=\ln A^{\frac mn}=\frac mn\ln A` },
    { label: 'Cambio de base', latex: L`\log_bx=\frac{\ln x}{\ln b}` },
  ],
  summary: 'Los logaritmos convierten productos en sumas y potencias en multiplicaciones.',
  goal: 'Simplificar expresiones con logaritmos, despejar una incógnita que está en el exponente y preparar funciones para derivarlas.',
  variables: [
    { symbol: L`\ln`, meaning: 'Logaritmo natural: el exponente al que hay que elevar $e\\approx2.718$' },
    { symbol: 'A,\\ B', meaning: 'Números **positivos** (el logaritmo de 0 o de un negativo no existe)' },
    { symbol: 'n', meaning: 'Cualquier número real' },
  ],
  whenToUse: [
    'Para despejar $x$ de ecuaciones como $2^x=10$: sacas $\\ln$ y queda $x\\ln2=\\ln10$.',
    'Para separar un logaritmo complicado antes de derivarlo: $\\ln\\frac{x^2}{x+1}=2\\ln x-\\ln(x+1)$.',
    'En química ($\\text{pH}$), sonido (decibeles) y sismos (Richter): escalas logarítmicas.',
  ],
  intuition: [
    'Un logaritmo **es un exponente**. Como al multiplicar potencias los exponentes se suman ($e^ae^b=e^{a+b}$), el logaritmo de un producto es la suma de los logaritmos.',
    'Por eso $\\ln1=0$ ($e^0=1$) y $\\ln e=1$ ($e^1=e$).',
    'Antes de las calculadoras, así se multiplicaba: se sumaban los logaritmos en una tabla y se buscaba el resultado.',
  ],
  derivation: {
    steps: [
      { label: 'Llamamos', latex: L`x=\ln A,\quad y=\ln B\ \Rightarrow\ A=e^x,\quad B=e^y` },
      { label: 'Multiplicamos', latex: L`AB=e^xe^y=e^{x+y}` },
      { label: 'Sacamos logaritmo', latex: L`\ln(AB)=x+y=\ln A+\ln B` },
    ],
  },
  calculators: [
    calc<{ prod: number; quo: number; pow: number }>({
      id: 'propiedades',
      label: 'Propiedades',
      inputs: [
        { kind: 'number', id: 'A', label: 'Primer número', symbol: 'A', default: 8 },
        { kind: 'number', id: 'B', label: 'Segundo número', symbol: 'B', default: 2 },
        { kind: 'number', id: 'n', label: 'Exponente', symbol: 'n', default: 3 },
      ],
      compute: (v) => {
        const A = num(v, 'A'), B = num(v, 'B')
        if (A <= 0 || B <= 0) fail('$A$ y $B$ deben ser positivos: el logaritmo de 0 o de un negativo no existe.')
        return { prod: Math.log(A) + Math.log(B), quo: Math.log(A) - Math.log(B), pow: num(v, 'n') * Math.log(A) }
      },
      steps: (v, r) => {
        const A = num(v, 'A'), B = num(v, 'B'), nn = num(v, 'n')
        const lA = Math.log(A), lB = Math.log(B)
        return [
          { label: 'Logaritmos de cada número', latex: L`\ln ${fmt(A)}=${fmt(lA)}\qquad\ln ${fmt(B)}=${fmt(lB)}` },
          { label: 'Producto → suma', latex: L`\ln(${fmt(A)}\cdot${fmt(B)})=${fmt(lA)}+${fp(lB)}=${fmt(r.prod)}` },
          { label: 'Cociente → resta', latex: L`\ln\frac{${fmt(A)}}{${fmt(B)}}=${fmt(lA)}-${fp(lB)}=${fmt(r.quo)}` },
          { label: 'Potencia → multiplicación', latex: L`\ln ${fmt(A)}^{${fmt(nn)}}=${fmt(nn)}\cdot${fp(lA)}=${fmt(r.pow)}` },
        ]
      },
      answer: (v, r) => L`\ln(${fmt(num(v, 'A'))}\cdot${fmt(num(v, 'B'))})=${fmt(r.prod)}`,
      extras: (_v, r) => [
        { label: 'Cociente', latex: L`\ln\frac AB=${fmt(r.quo)}` },
        { label: 'Potencia', latex: L`\ln A^n=${fmt(r.pow)}` },
      ],
      interpret: (v, r) => {
        const A = num(v, 'A'), B = num(v, 'B')
        return [
          check(r.prod, Math.log(A * B)),
          { tone: 'warn', text: `Error común: $\\ln(A+B)$ **no** se separa. $\\ln(${fmt(A)}+${fmt(B)})=${fmt(Math.log(A + B))}$, que no es $\\ln A+\\ln B=${fmt(r.prod)}$.` },
        ]
      },
    }),
    calc<{ value: number }>({
      id: 'cambio-base',
      label: 'Cambio de base',
      example: '$\\log_2 32$: ¿a qué potencia hay que elevar 2 para obtener 32?',
      inputs: [
        { kind: 'number', id: 'x', label: 'Número', symbol: 'x', default: 32 },
        { kind: 'number', id: 'b', label: 'Base', symbol: 'b', default: 2 },
      ],
      compute: (v) => {
        const x = num(v, 'x'), b = num(v, 'b')
        if (x <= 0) fail('El número debe ser positivo.')
        if (b <= 0 || b === 1) fail('La base debe ser positiva y distinta de 1.')
        return { value: Math.log(x) / Math.log(b) }
      },
      steps: (v, r) => {
        const x = num(v, 'x'), b = num(v, 'b')
        return [
          { label: 'Cambio de base a logaritmo natural', latex: L`\log_{${fmt(b)}}${fmt(x)}=\frac{\ln ${fmt(x)}}{\ln ${fmt(b)}}=\frac{${fmt(Math.log(x))}}{${fmt(Math.log(b))}}=${fmt(r.value)}` },
          { label: 'Comprobación', latex: L`${fmt(b)}^{${fmt(r.value)}}=${fmt(b ** r.value)}` },
        ]
      },
      answer: (v, r) => L`\log_{${fmt(num(v, 'b'))}}${fmt(num(v, 'x'))}=${fmt(r.value)}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Hay que elevar $${fmt(num(v, 'b'))}$ a la potencia $${fmt(r.value)}$ para obtener $${fmt(num(v, 'x'))}$.` },
        { tone: 'info', text: 'Con la base 10 da el $\\log$ de la calculadora; también funciona dividiendo $\\log x/\\log b$.' },
      ],
    }),
  ],
  commonMistakes: [
    '$\\ln(A+B) \\ne \\ln A+\\ln B$. La propiedad es para **productos**.',
    '$\\frac{\\ln A}{\\ln B} \\ne \\ln\\frac AB$.',
    '$(\\ln A)^n \\ne n\\ln A$: el exponente debe estar **dentro** del logaritmo.',
    'Sacar el logaritmo de un número negativo o de cero.',
  ],
  related: ['leyes-exponentes', 'derivadas-exp-log', 'ph'],
  keywords: ['logaritmo', 'ln', 'log', 'logaritmo natural', 'cambio de base', 'propiedades de los logaritmos', 'algebra'],
}

// ─── Fracciones ──────────────────────────────────────────────────────────────

interface FracResult { num: number; den: number; g: number }

const sumaFracciones: Formula = {
  id: 'suma-fracciones',
  name: 'Suma y resta de fracciones',
  category: 'algebra',
  latex: L`\frac ab+\frac cd=\frac{ad+bc}{bd}`,
  forms: [
    { label: 'Mismo denominador', latex: L`\frac ab+\frac cb=\frac{a+c}{b}` },
    { label: 'Resta', latex: L`\frac ab-\frac cd=\frac{ad-bc}{bd}` },
  ],
  summary: 'Para sumar fracciones hay que llevarlas a un denominador común.',
  goal: 'Sumar o restar fracciones (numéricas o algebraicas) y dejar el resultado simplificado.',
  variables: [
    { symbol: 'a,\\ c', meaning: 'Numeradores' },
    { symbol: 'b,\\ d', meaning: 'Denominadores (nunca 0)' },
  ],
  whenToUse: [
    'Para sumar fracciones con denominadores distintos (“multiplicación cruzada”).',
    'Con fracciones algebraicas: $\\frac1x+\\frac1{x+1}=\\frac{x+1+x}{x(x+1)}$.',
    'Al revés, para separar en **fracciones parciales** antes de integrar.',
  ],
  intuition: [
    'Sólo se pueden sumar pedazos del **mismo tamaño**. Medios y tercios no se suman directamente, pero ambos se pueden partir en sextos.',
    'Multiplicar $\\frac ab$ por $\\frac dd$ (que vale 1) no cambia su valor, sólo el tamaño de los pedazos.',
    'El denominador $bd$ siempre funciona, aunque a veces el mínimo común múltiplo da números más chicos.',
  ],
  calculators: [
    calc<FracResult>({
      id: 'suma',
      label: 'Sumar',
      example: '$\\frac12+\\frac13$',
      inputs: [
        { kind: 'number', id: 'a', label: 'Numerador 1', symbol: 'a', default: 1 },
        { kind: 'number', id: 'b', label: 'Denominador 1', symbol: 'b', default: 2 },
        { kind: 'number', id: 'c', label: 'Numerador 2', symbol: 'c', default: 1 },
        { kind: 'number', id: 'd', label: 'Denominador 2', symbol: 'd', default: 3 },
      ],
      compute: (v) => {
        const a = num(v, 'a'), b = num(v, 'b'), c = num(v, 'c'), d = num(v, 'd')
        if (b === 0 || d === 0) fail('Los denominadores no pueden ser 0.')
        if (![a, b, c, d].every(Number.isInteger)) fail('Usa números enteros para ver la fracción simplificada.')
        const nume = a * d + b * c, den = b * d
        return { num: nume, den, g: gcd(nume, den) || 1 }
      },
      steps: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b'), c = num(v, 'c'), d = num(v, 'd')
        const steps: CalcStep[] = [
          { label: 'Multiplicación cruzada', latex: L`\frac{${a}}{${b}}+\frac{${c}}{${d}}=\frac{(${a})(${d})+(${b})(${c})}{(${b})(${d})}=\frac{${r.num}}{${r.den}}` },
        ]
        if (r.g > 1) steps.push({ label: `Simplificamos dividiendo entre ${r.g} (máximo común divisor)`, latex: L`\frac{${r.num}}{${r.den}}=\frac{${r.num / r.g}}{${r.den / r.g}}` })
        return steps
      },
      answer: (v, r) => {
        const s = r.den / r.g < 0 ? -1 : 1
        const top = (s * r.num) / r.g, bot = (s * r.den) / r.g
        return L`\frac{${num(v, 'a')}}{${num(v, 'b')}}+\frac{${num(v, 'c')}}{${num(v, 'd')}}=${bot === 1 ? top : L`${top < 0 ? '-' : ''}\frac{${Math.abs(top)}}{${bot}}`}`
      },
      extras: (_v, r) => [{ label: 'Decimal', latex: fmt(r.num / r.den) }],
      interpret: (v, r) => {
        const b = num(v, 'b'), d = num(v, 'd')
        const lcm = Math.abs(b * d) / gcd(b, d)
        const out: Interpretation[] = [{ tone: 'good', text: `El resultado es $${fmt(r.num / r.den)}$ en decimal.` }]
        if (lcm !== Math.abs(b * d)) out.push({ tone: 'info', text: `Con el mínimo común múltiplo ($${lcm}$) como denominador los números quedan más chicos, pero el resultado simplificado es el mismo.` })
        out.push({ tone: 'warn', text: `Error común: sumar numeradores y denominadores daría $\\frac{${num(v, 'a') + num(v, 'c')}}{${b + d}}$, que es incorrecto.` })
        return out
      },
    }),
  ],
  commonMistakes: [
    'Sumar numeradores y denominadores por separado: $\\frac12+\\frac13 \\ne \\frac25$.',
    'Olvidar simplificar el resultado.',
    'En fracciones algebraicas, cancelar términos que se suman: en $\\frac{x+2}{x}$ no se puede tachar la $x$.',
  ],
  related: ['productos-notables', 'integrales-logaritmicas'],
  keywords: ['fracciones', 'suma de fracciones', 'denominador comun', 'multiplicacion cruzada', 'algebra'],
}

export const ALGEBRA: Formula[] = [productosNotables, completarCuadrado, leyesExponentes, propiedadesLogaritmos, sumaFracciones]
