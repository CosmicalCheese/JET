import { calc, fail, num, type Formula, type Interpretation, type PlotSegment, type VisualSpec } from '../types'
import { fmt, fp } from '../format'
import { L, SEN, close, rad, sample, unitCircle } from './calculo-comun'

// Todas las calculadoras de esta sección trabajan en grados
const sin = (deg: number) => Math.sin(rad(deg))
const cos = (deg: number) => Math.cos(rad(deg))
/** NaN cuando el denominador es 0 (fmt lo muestra como “indefinido”) */
const ratio = (a: number, b: number) => (Math.abs(b) < 1e-12 ? NaN : a / b)
const tan = (deg: number) => ratio(sin(deg), cos(deg))
const deg = (x: number) => L`${fmt(x)}^\circ`

const ok = (a: number, b: number): Interpretation =>
  close(a, b, 1e-9) || (Number.isNaN(a) && Number.isNaN(b))
    ? { tone: 'good', text: `Los dos lados de la identidad dan $${fmt(a)}$: se cumple.` }
    : { tone: 'warn', text: `Un lado da $${fmt(a)}$ y el otro $${fmt(b)}$.` }

/** Circunferencia unitaria con los ángulos indicados como radios */
function circleVisual(angles: { deg: number; tone: PlotSegment['tone']; label: string }[], caption?: string, extra: PlotSegment[] = []): VisualSpec {
  return {
    type: 'plot',
    curves: [{ points: unitCircle(), tone: 'muted' }],
    segments: [
      ...extra,
      ...angles.map(a => ({ from: [0, 0] as [number, number], to: [cos(a.deg), sin(a.deg)] as [number, number], tone: a.tone })),
    ],
    marks: angles.map(a => ({ x: cos(a.deg), y: sin(a.deg), tone: a.tone, label: a.label })),
    xRange: [-1.35, 1.35],
    yRange: [-1.25, 1.25],
    equal: true,
    caption,
  }
}

// ─── Razones trigonométricas ─────────────────────────────────────────────────

interface RazResult { co: number; ca: number; h: number; theta: number }

function razSteps(r: RazResult) {
  return [
    { label: 'Seno: opuesto entre hipotenusa', latex: L`${SEN}\theta=\frac{CO}{H}=\frac{${fmt(r.co)}}{${fmt(r.h)}}=${fmt(r.co / r.h)}` },
    { label: 'Coseno: adyacente entre hipotenusa', latex: L`\cos\theta=\frac{CA}{H}=\frac{${fmt(r.ca)}}{${fmt(r.h)}}=${fmt(r.ca / r.h)}` },
    { label: 'Tangente: opuesto entre adyacente', latex: L`\tan\theta=\frac{CO}{CA}=\frac{${fmt(r.co)}}{${fmt(r.ca)}}=${fmt(r.co / r.ca)}` },
    { label: 'Las recíprocas: se voltean las fracciones', latex: L`\csc\theta=\frac{${fmt(r.h)}}{${fmt(r.co)}}=${fmt(r.h / r.co)}\quad\sec\theta=\frac{${fmt(r.h)}}{${fmt(r.ca)}}=${fmt(r.h / r.ca)}\quad\cot\theta=\frac{${fmt(r.ca)}}{${fmt(r.co)}}=${fmt(r.ca / r.co)}` },
  ]
}

function triangleVisual(r: RazResult): VisualSpec {
  return {
    type: 'plot',
    segments: [
      { from: [0, 0], to: [r.ca, 0], tone: 'b', label: `CA = ${fmt(r.ca, 2)}` },
      { from: [r.ca, 0], to: [r.ca, r.co], tone: 'warn', label: `CO = ${fmt(r.co, 2)}` },
      { from: [0, 0], to: [r.ca, r.co], tone: 'a', label: `H = ${fmt(r.h, 2)}` },
    ],
    marks: [{ x: 0, y: 0, tone: 'accent', label: `θ = ${fmt(r.theta, 1)}°` }],
    equal: true,
    caption: 'El cateto **opuesto** (CO) está enfrente del ángulo $\\theta$; el **adyacente** (CA) lo forma junto con la hipotenusa (H).',
  }
}

const razonesTrig: Formula = {
  id: 'razones-trigonometricas',
  name: 'Razones trigonométricas',
  category: 'trigonometria',
  latex: L`${SEN}\theta=\frac{CO}{H}\qquad\cos\theta=\frac{CA}{H}\qquad\tan\theta=\frac{CO}{CA}`,
  forms: [
    { label: 'Recíprocas', latex: L`\csc\theta=\frac{H}{CO}\qquad\sec\theta=\frac{H}{CA}\qquad\cot\theta=\frac{CA}{CO}` },
    { label: 'Teorema de Pitágoras', latex: L`H^2=CO^2+CA^2` },
  ],
  summary: 'Las seis razones entre los lados de un triángulo rectángulo. Con ellas se pasa de ángulos a longitudes y viceversa.',
  goal: 'Encontrar lados o ángulos de un triángulo rectángulo: alturas de edificios, inclinaciones de rampas, componentes de vectores.',
  variables: [
    { symbol: L`\theta`, meaning: 'Uno de los ángulos agudos del triángulo' },
    { symbol: 'CO', meaning: 'Cateto **opuesto**: el lado de enfrente del ángulo' },
    { symbol: 'CA', meaning: 'Cateto **adyacente**: el lado que toca al ángulo (y no es la hipotenusa)' },
    { symbol: 'H', meaning: 'Hipotenusa: el lado más largo, enfrente del ángulo recto' },
  ],
  whenToUse: [
    'Conoces un ángulo y un lado de un triángulo rectángulo y quieres otro lado.',
    'Conoces dos lados y quieres el ángulo (con la función inversa, por ejemplo $\\theta=\\tan^{-1}\\frac{CO}{CA}$).',
    'Para descomponer vectores: $F_x = F\\cos\\theta$, $F_y = F\\operatorname{sen}\\theta$.',
  ],
  intuition: [
    'Todos los triángulos rectángulos con el mismo ángulo $\\theta$ son **semejantes**: pueden ser grandes o chicos, pero la proporción entre sus lados es la misma. Por eso $\\operatorname{sen}\\theta$ depende sólo del ángulo.',
    'Regla para recordar: **SOH CAH TOA** — Seno = Opuesto/Hipotenusa, Coseno = Adyacente/Hipotenusa, Tangente = Opuesto/Adyacente.',
    'Las recíprocas son las mismas fracciones volteadas: $\\csc$ es $\\frac1{\\operatorname{sen}}$, $\\sec$ es $\\frac1{\\cos}$, $\\cot$ es $\\frac1{\\tan}$.',
  ],
  calculators: [
    calc<RazResult>({
      id: 'catetos',
      label: 'Con los dos catetos',
      example: 'El triángulo 3-4-5',
      inputs: [
        { kind: 'number', id: 'co', label: 'Cateto opuesto', symbol: 'CO', default: 3 },
        { kind: 'number', id: 'ca', label: 'Cateto adyacente', symbol: 'CA', default: 4 },
      ],
      compute: (v) => {
        const co = num(v, 'co'), ca = num(v, 'ca')
        if (co <= 0 || ca <= 0) fail('Los catetos deben ser positivos.')
        return { co, ca, h: Math.hypot(co, ca), theta: (Math.atan2(co, ca) * 180) / Math.PI }
      },
      steps: (_v, r) => [
        { label: 'Hipotenusa con Pitágoras', latex: L`H=\sqrt{${fmt(r.co)}^2+${fmt(r.ca)}^2}=\sqrt{${fmt(r.co ** 2 + r.ca ** 2)}}=${fmt(r.h)}` },
        ...razSteps(r),
        { label: 'Ángulo con la tangente inversa', latex: L`\theta=\tan^{-1}\frac{${fmt(r.co)}}{${fmt(r.ca)}}=${deg(r.theta)}` },
      ],
      answer: (_v, r) => L`\theta=${deg(r.theta)},\quad H=${fmt(r.h)}`,
      extras: (_v, r) => [
        { label: 'sen θ', latex: fmt(r.co / r.h) },
        { label: 'cos θ', latex: fmt(r.ca / r.h) },
        { label: 'tan θ', latex: fmt(r.co / r.ca) },
        { label: 'Otro ángulo agudo', latex: deg(90 - r.theta) },
      ],
      interpret: (_v, r) => [
        { tone: 'good', text: `El ángulo frente al cateto de $${fmt(r.co)}$ mide $${fmt(r.theta, 2)}^\\circ$, y el otro ángulo agudo $${fmt(90 - r.theta, 2)}^\\circ$ (entre los dos suman $90^\\circ$).` },
        { tone: 'info', text: `Para el otro ángulo, los papeles de los catetos se intercambian: su seno es $${fmt(r.ca / r.h)}$, que es el coseno de $\\theta$. De ahí el nombre “co-seno”: el seno del ángulo **complementario**.` },
      ],
      visual: (_v, r) => triangleVisual(r),
    }),
    calc<RazResult>({
      id: 'angulo',
      label: 'Con ángulo e hipotenusa',
      example: 'Una escalera de 5 m apoyada con un ángulo de 60° respecto al piso',
      inputs: [
        { kind: 'number', id: 'theta', label: 'Ángulo', symbol: L`\theta`, default: 60, unit: '°' },
        { kind: 'number', id: 'h', label: 'Hipotenusa', symbol: 'H', default: 5 },
      ],
      compute: (v) => {
        const t = num(v, 'theta'), h = num(v, 'h')
        if (t <= 0 || t >= 90) fail('En un triángulo rectángulo el ángulo agudo está entre $0^\\circ$ y $90^\\circ$.')
        if (h <= 0) fail('La hipotenusa debe ser positiva.')
        return { co: h * sin(t), ca: h * cos(t), h, theta: t }
      },
      steps: (v, r) => [
        { label: 'Despejamos el opuesto del seno', latex: L`CO=H\,${SEN}\theta=${fmt(r.h)}\,${SEN}${deg(num(v, 'theta'))}=${fmt(r.co)}` },
        { label: 'Despejamos el adyacente del coseno', latex: L`CA=H\cos\theta=${fmt(r.h)}\cos${deg(num(v, 'theta'))}=${fmt(r.ca)}` },
        { label: 'Comprobación con Pitágoras', latex: L`${fmt(r.co)}^2+${fmt(r.ca)}^2=${fmt(r.co ** 2 + r.ca ** 2)}=${fmt(r.h)}^2` },
      ],
      answer: (_v, r) => L`CO=${fmt(r.co)},\quad CA=${fmt(r.ca)}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `La escalera alcanza una altura de $${fmt(r.co)}$ y su base queda a $${fmt(r.ca)}$ de la pared.` },
        { tone: 'info', text: 'Así se descompone cualquier vector en componentes: la magnitud por el coseno da la parte horizontal y por el seno, la vertical.' },
      ],
      visual: (_v, r) => triangleVisual(r),
    }),
  ],
  commonMistakes: [
    'Confundir opuesto y adyacente: dependen de **cuál** ángulo estés usando.',
    'Tener la calculadora en radianes cuando el ángulo está en grados.',
    'Usar estas razones en triángulos que no son rectángulos: ahí se usan la ley de senos o de cosenos.',
  ],
  related: ['identidades-fundamentales', 'ley-de-cosenos', 'producto-punto'],
  keywords: ['seno', 'coseno', 'tangente', 'cateto opuesto', 'cateto adyacente', 'hipotenusa', 'soh cah toa', 'triangulo rectangulo', 'trigonometria'],
}

// ─── Identidades fundamentales ───────────────────────────────────────────────

const identidadesFundamentales: Formula = {
  id: 'identidades-fundamentales',
  name: 'Identidades pitagóricas, recíprocas y de argumentos negativos',
  category: 'trigonometria',
  latex: L`${SEN}^2A+\cos^2A=1`,
  forms: [
    { label: 'Pitagóricas con sec y csc', latex: L`\sec^2A-\tan^2A=1\qquad\csc^2A-\cot^2A=1` },
    { label: 'Recíprocas', latex: L`${SEN} A=\frac{1}{\csc A}\quad\cos A=\frac{1}{\sec A}\quad\tan A=\frac{1}{\cot A}` },
    { label: 'Cociente', latex: L`\tan A=\frac{${SEN} A}{\cos A}\qquad\cot A=\frac{\cos A}{${SEN} A}` },
    { label: 'Argumentos negativos: seno y tangente (impares)', latex: L`${SEN}(-A)=-${SEN} A\qquad\tan(-A)=-\tan A` },
    { label: 'Argumentos negativos: cot y csc (impares)', latex: L`\cot(-A)=-\cot A\qquad\csc(-A)=-\csc A` },
    { label: 'Argumentos negativos: coseno y secante (pares)', latex: L`\cos(-A)=\cos A\qquad\sec(-A)=\sec A` },
    { label: 'Con potencias', latex: L`${SEN}^nA=\tan^nA\cos^nA` },
    { label: 'Con potencias (coseno)', latex: L`\cos^nA=\cot^nA\,${SEN}^nA` },
  ],
  summary: 'Las relaciones que se cumplen para **cualquier** ángulo. Sirven para simplificar y para cambiar una función por otra.',
  goal: 'Reescribir expresiones trigonométricas en una forma más simple o más conveniente, por ejemplo para integrar o para resolver una ecuación.',
  variables: [
    { symbol: 'A', meaning: 'Cualquier ángulo (en grados o radianes)' },
    { symbol: L`${SEN}^2A`, meaning: 'Significa $(\\operatorname{sen}A)^2$, **no** $\\operatorname{sen}(A^2)$' },
  ],
  whenToUse: [
    'Para pasar de seno a coseno: $\\cos A=\\pm\\sqrt{1-\\operatorname{sen}^2A}$ (el signo depende del cuadrante).',
    'Para simplificar: $\\frac{\\operatorname{sen}^2x}{1-\\cos^2x} = 1$.',
    'En integrales: $\\sec^2x - 1 = \\tan^2x$ permite integrar $\\tan^2x$.',
    'Los argumentos negativos sirven para simplificar $\\cos(-30^\\circ)$ o para saber si una función es par o impar.',
  ],
  intuition: [
    'En la circunferencia de radio 1, el punto de ángulo $A$ tiene coordenadas $(\\cos A,\\ \\operatorname{sen}A)$. Su distancia al origen es 1, y por Pitágoras: $\\cos^2A+\\operatorname{sen}^2A=1$.',
    'Si divides esa identidad entre $\\cos^2A$ sale $\\tan^2A+1=\\sec^2A$. Si la divides entre $\\operatorname{sen}^2A$, sale $1+\\cot^2A=\\csc^2A$.',
    'Un ángulo negativo es el **reflejo** en el eje $x$: la $x$ (coseno) queda igual y la $y$ (seno) cambia de signo. Por eso el coseno es **par** y el seno **impar**.',
  ],
  derivation: {
    steps: [
      { label: 'Punto sobre la circunferencia unitaria', latex: L`(x,\ y)=(\cos A,\ ${SEN} A),\qquad x^2+y^2=1` },
      { label: 'Sustituimos', latex: L`\cos^2A+${SEN}^2A=1` },
      { label: 'Dividimos entre $\\cos^2A$', latex: L`1+\tan^2A=\sec^2A\ \Rightarrow\ \sec^2A-\tan^2A=1` },
      { label: 'Dividimos entre $\\operatorname{sen}^2A$', latex: L`\cot^2A+1=\csc^2A\ \Rightarrow\ \csc^2A-\cot^2A=1` },
    ],
  },
  calculators: [
    calc<{ s: number; c: number; t: number }>({
      id: 'pitagoricas',
      label: 'Pitagóricas',
      inputs: [{ kind: 'number', id: 'A', label: 'Ángulo', symbol: 'A', default: 35, unit: '°' }],
      compute: (v) => {
        const A = num(v, 'A')
        return { s: sin(A), c: cos(A), t: tan(A) }
      },
      steps: (v, r) => {
        const A = num(v, 'A')
        const sec = ratio(1, r.c), csc = ratio(1, r.s), cot = ratio(r.c, r.s)
        return [
          { label: 'Seno y coseno', latex: L`${SEN}${deg(A)}=${fmt(r.s)}\qquad\cos${deg(A)}=${fmt(r.c)}` },
          { label: 'Suma de cuadrados', latex: L`${fp(r.s)}^2+${fp(r.c)}^2=${fmt(r.s ** 2)}+${fmt(r.c ** 2)}=${fmt(r.s ** 2 + r.c ** 2)}` },
          { label: 'Con secante y tangente', latex: L`\sec^2A-\tan^2A=${fmt(sec ** 2)}-${fmt(r.t ** 2)}=${fmt(sec ** 2 - r.t ** 2)}` },
          { label: 'Con cosecante y cotangente', latex: L`\csc^2A-\cot^2A=${fmt(csc ** 2)}-${fmt(cot ** 2)}=${fmt(csc ** 2 - cot ** 2)}` },
        ]
      },
      answer: (v, r) => L`${SEN}^2${deg(num(v, 'A'))}+\cos^2${deg(num(v, 'A'))}=${fmt(r.s ** 2 + r.c ** 2)}`,
      extras: (_v, r) => [
        { label: 'sen A', latex: fmt(r.s) },
        { label: 'cos A', latex: fmt(r.c) },
        { label: 'tan A', latex: fmt(r.t) },
      ],
      interpret: (_v, r) => [
        ok(r.s ** 2 + r.c ** 2, 1),
        { tone: 'info', text: `Si sólo conoces $\\operatorname{sen}A=${fmt(r.s)}$, la identidad da $\\cos A=\\pm\\sqrt{1-${fmt(r.s ** 2)}}=\\pm${fmt(Math.abs(r.c))}$. Aquí el signo es **${r.c >= 0 ? 'positivo' : 'negativo'}** porque el ángulo está en un cuadrante donde $x$ es ${r.c >= 0 ? 'positiva' : 'negativa'}.` },
      ],
      visual: (v, r) => circleVisual(
        [{ deg: num(v, 'A'), tone: 'a', label: `(${fmt(r.c, 2)}, ${fmt(r.s, 2)})` }],
        'El punto está a distancia 1 del centro. Sus coordenadas son $(\\cos A,\\ \\operatorname{sen}A)$ y por Pitágoras $\\cos^2A+\\operatorname{sen}^2A=1$.',
        [
          { from: [0, 0], to: [r.c, 0], tone: 'b', label: 'cos' },
          { from: [r.c, 0], to: [r.c, r.s], tone: 'warn', label: 'sen' },
        ],
      ),
    }),
    calc<{ rows: [string, number, number, boolean][] }>({
      id: 'negativos',
      label: 'Argumentos negativos',
      inputs: [{ kind: 'number', id: 'A', label: 'Ángulo', symbol: 'A', default: 30, unit: '°' }],
      compute: (v) => {
        const A = num(v, 'A')
        const fns: [string, (x: number) => number, boolean][] = [
          [SEN, sin, false], [L`\cos`, cos, true], [L`\tan`, tan, false],
          [L`\cot`, x => ratio(cos(x), sin(x)), false], [L`\sec`, x => ratio(1, cos(x)), true], [L`\csc`, x => ratio(1, sin(x)), false],
        ]
        return { rows: fns.map(([name, f, even]) => [name, f(-A), f(A), even]) }
      },
      steps: (v, r) => r.rows.map(([name, neg, pos, even]) => ({
        label: even ? 'Par: el signo no cambia' : 'Impar: el signo sale de la función',
        latex: L`${name}(-${deg(num(v, 'A'))})=${fmt(neg)}\qquad ${even ? '' : '-'}${name}\,${deg(num(v, 'A'))}=${fmt(even ? pos : -pos)}`,
      })),
      answer: (v) => L`\cos(-${deg(num(v, 'A'))})=\cos ${deg(num(v, 'A'))},\quad ${SEN}(-${deg(num(v, 'A'))})=-${SEN}${deg(num(v, 'A'))}`,
      interpret: () => [
        { tone: 'good', text: 'Coseno y secante son **pares**: $f(-A)=f(A)$. Las otras cuatro son **impares**: $f(-A)=-f(A)$.' },
        { tone: 'warn', text: 'Algunos formularios escriben $\\cos(-A)=-\\cos A$ y $\\sec(-A)=-\\sec A$: **es un error**. Compruébalo con los números de la izquierda.' },
      ],
      visual: (v) => circleVisual(
        [
          { deg: num(v, 'A'), tone: 'a', label: 'A' },
          { deg: -num(v, 'A'), tone: 'warn', label: '−A' },
        ],
        'El ángulo $-A$ es el reflejo de $A$ en el eje $x$: la coordenada $x$ (el coseno) no cambia y la $y$ (el seno) cambia de signo.',
        [{ from: [cos(num(v, 'A')), sin(num(v, 'A'))], to: [cos(num(v, 'A')), -sin(num(v, 'A'))], tone: 'muted', dashed: true }],
      ),
    }),
  ],
  commonMistakes: [
    'Leer $\\operatorname{sen}^2A$ como $\\operatorname{sen}(A^2)$.',
    'Olvidar el $\\pm$ al despejar: $\\cos A=\\sqrt{1-\\operatorname{sen}^2A}$ sólo es cierto si $\\cos A\\ge0$ (primer y cuarto cuadrante).',
    '**Coseno y secante son pares**: $\\cos(-A)=+\\cos A$. Escribir $-\\cos A$ es un error frecuente en formularios.',
    'Confundir recíproca con inversa: $\\csc A=\\frac{1}{\\operatorname{sen}A}$, pero $\\operatorname{sen}^{-1}$ es el arco seno.',
  ],
  related: ['razones-trigonometricas', 'suma-diferencia-angulos', 'angulo-doble', 'derivadas-trigonometricas'],
  keywords: ['identidades trigonometricas', 'pitagoricas', 'sen2+cos2=1', 'reciprocas', 'argumentos negativos', 'par', 'impar', 'trigonometria'],
}

// ─── Suma y diferencia de ángulos ────────────────────────────────────────────

interface SumResult { S: number; C: number; T: number; sA: number; cA: number; sB: number; cB: number; tA: number; tB: number }

function sumCalc(sign: 1 | -1) {
  const op = sign === 1 ? '+' : '-'
  const opp = sign === 1 ? '-' : '+'
  return calc<SumResult>({
    id: sign === 1 ? 'suma' : 'resta',
    label: sign === 1 ? 'A + B' : 'A − B',
    example: sign === 1 ? '$75^\\circ = 45^\\circ + 30^\\circ$' : '$15^\\circ = 45^\\circ - 30^\\circ$',
    inputs: [
      { kind: 'number', id: 'A', label: 'Ángulo A', symbol: 'A', default: 45, unit: '°' },
      { kind: 'number', id: 'B', label: 'Ángulo B', symbol: 'B', default: 30, unit: '°' },
    ],
    compute: (v) => {
      const A = num(v, 'A'), B = num(v, 'B')
      const sA = sin(A), cA = cos(A), sB = sin(B), cB = cos(B), tA = tan(A), tB = tan(B)
      const S = sA * cB + sign * cA * sB
      const C = cA * cB - sign * sA * sB
      return { S, C, T: ratio(tA + sign * tB, 1 - sign * tA * tB), sA, cA, sB, cB, tA, tB }
    },
    steps: (v, r) => {
      const A = num(v, 'A'), B = num(v, 'B')
      return [
        { label: 'Valores de A y B', latex: L`${SEN} A=${fmt(r.sA)},\ \cos A=${fmt(r.cA)},\quad ${SEN} B=${fmt(r.sB)},\ \cos B=${fmt(r.cB)}` },
        { label: 'Seno: “seno coseno más coseno seno” (el signo se conserva)', latex: L`${SEN}(${deg(A)}${op}${deg(B)})=(${fmt(r.sA)})(${fmt(r.cB)})${op}(${fmt(r.cA)})(${fmt(r.sB)})=${fmt(r.S)}` },
        { label: 'Coseno: “coseno coseno menos seno seno” (el signo se invierte)', latex: L`\cos(${deg(A)}${op}${deg(B)})=(${fmt(r.cA)})(${fmt(r.cB)})${opp}(${fmt(r.sA)})(${fmt(r.sB)})=${fmt(r.C)}` },
        { label: 'Tangente', latex: L`\tan(A${op}B)=\frac{\tan A${op}\tan B}{1${opp}\tan A\tan B}=\frac{${fmt(r.tA)}${op}${fp(r.tB)}}{1${opp}(${fmt(r.tA)})(${fmt(r.tB)})}=${fmt(r.T)}` },
      ]
    },
    answer: (v, r) => L`${SEN}(${deg(num(v, 'A'))}${op}${deg(num(v, 'B'))})=${fmt(r.S)}`,
    extras: (_v, r) => [
      { label: `cos(A ${op} B)`, latex: fmt(r.C) },
      { label: `tan(A ${op} B)`, latex: fmt(r.T) },
    ],
    interpret: (v, r) => {
      const A = num(v, 'A'), B = num(v, 'B'), total = A + sign * B
      return [
        ok(r.S, sin(total)),
        { tone: 'warn', text: `Error común: sumar los senos daría $${fmt(r.sA)}${op}${fp(r.sB)}=${fmt(r.sA + sign * r.sB)}$, que **no** es $\\operatorname{sen}(${fmt(total)}^\\circ)$.` },
        { tone: 'info', text: 'Con ángulos “de tabla” (30°, 45°, 60°) esta fórmula da valores exactos de ángulos que no están en la tabla, como 15° o 75°.' },
      ]
    },
    visual: (v) => {
      const A = num(v, 'A'), B = num(v, 'B')
      return circleVisual([
        { deg: A, tone: 'a', label: 'A' },
        { deg: sign * B, tone: 'b', label: sign === 1 ? 'B' : '−B' },
        { deg: A + sign * B, tone: 'accent', label: `A ${op} B` },
      ], 'Sumar ángulos es girar uno a continuación del otro. La fórmula da las coordenadas del punto final sin medir el ángulo total.')
    },
  })
}

const sumaDiferenciaAngulos: Formula = {
  id: 'suma-diferencia-angulos',
  name: 'Seno, coseno y tangente de una suma o diferencia de ángulos',
  category: 'trigonometria',
  latex: L`${SEN}(A\pm B)=${SEN} A\cos B\pm\cos A\,${SEN} B`,
  forms: [
    { label: 'Coseno (el signo se invierte)', latex: L`\cos(A\pm B)=\cos A\cos B\mp${SEN} A\,${SEN} B` },
    { label: 'Tangente', latex: L`\tan(A\pm B)=\frac{\tan A\pm\tan B}{1\mp\tan A\tan B}` },
    { label: 'Cotangente de una suma', latex: L`\cot(A+B)=\frac{\cot A\cot B-1}{\cot A+\cot B}` },
    { label: 'Cotangente de una diferencia', latex: L`\cot(A-B)=\frac{\cot A\cot B+1}{\cot B-\cot A}` },
  ],
  summary: 'Cómo calcular el seno o coseno de una suma de ángulos a partir de los ángulos por separado. De aquí salen las de ángulo doble.',
  goal: 'Obtener valores exactos ($\\operatorname{sen}75^\\circ$, $\\cos15^\\circ$), simplificar expresiones y demostrar otras identidades.',
  variables: [{ symbol: 'A,\\ B', meaning: 'Dos ángulos cualesquiera' }],
  whenToUse: [
    'Para valores exactos: $\\cos15^\\circ = \\cos(45^\\circ-30^\\circ) = \\frac{\\sqrt6+\\sqrt2}{4}$.',
    'Para expandir $\\operatorname{sen}(x+\\frac\\pi2)$ y comprobar que es $\\cos x$.',
    'Con $A = B$ se obtienen las fórmulas de ángulo doble.',
  ],
  intuition: [
    '**El seno no se reparte**: $\\operatorname{sen}(A+B)\\ne\\operatorname{sen}A+\\operatorname{sen}B$. Con $A=B=90^\\circ$: el lado izquierdo es $\\operatorname{sen}180^\\circ=0$ y el derecho, 2.',
    'Seno: “**seno coseno, coseno seno**”, con el mismo signo de adentro. Coseno: “**coseno coseno, seno seno**”, con el signo contrario.',
    'Geométricamente: girar un punto un ángulo $A$ y después $B$ es lo mismo que girarlo $A+B$. Las fórmulas son la cuenta de ese doble giro.',
  ],
  derivation: {
    intro: 'Con la distancia entre dos puntos de la circunferencia unitaria:',
    steps: [
      { label: 'Los puntos de ángulos A y B están a una distancia que sólo depende de A − B', latex: L`(\cos A-\cos B)^2+(${SEN} A-${SEN} B)^2=(\cos(A-B)-1)^2+${SEN}^2(A-B)` },
      { label: 'Expandimos y usamos $\\operatorname{sen}^2+\\cos^2=1$ en cada lado', latex: L`2-2(\cos A\cos B+${SEN} A\,${SEN} B)=2-2\cos(A-B)` },
      { label: 'Conclusión', latex: L`\cos(A-B)=\cos A\cos B+${SEN} A\,${SEN} B` },
    ],
    outro: 'Las demás salen de ésta usando $B\\to-B$ y $\\operatorname{sen}x=\\cos(90^\\circ-x)$.',
  },
  calculators: [sumCalc(1), sumCalc(-1)],
  commonMistakes: [
    'Repartir la función: $\\operatorname{sen}(A+B)\\ne\\operatorname{sen}A+\\operatorname{sen}B$.',
    'En el coseno, usar el mismo signo: $\\cos(A+B)$ lleva **menos**.',
    'Confundir el orden en la de la cotangente de una resta: el denominador es $\\cot B-\\cot A$.',
  ],
  related: ['angulo-doble', 'identidades-fundamentales', 'sumas-productos-trig'],
  keywords: ['suma de angulos', 'diferencia de angulos', 'sen(a+b)', 'cos(a+b)', 'tan(a+b)', 'identidades', 'trigonometria'],
}

// ─── Ángulo doble ────────────────────────────────────────────────────────────

const anguloDoble: Formula = {
  id: 'angulo-doble',
  name: 'Funciones de ángulo doble y reducción de potencias',
  category: 'trigonometria',
  latex: L`${SEN}2A=2\,${SEN} A\cos A`,
  forms: [
    { label: 'Coseno del doble', latex: L`\cos2A=\cos^2A-${SEN}^2A=1-2${SEN}^2A=2\cos^2A-1` },
    { label: 'Producto seno coseno', latex: L`${SEN} A\cos A=\frac{${SEN}2A}{2}` },
    { label: 'Reducción de potencias', latex: L`${SEN}^2A=\frac{1-\cos2A}{2}\qquad\cos^2A=\frac{1+\cos2A}{2}` },
    { label: 'Tangente del doble', latex: L`\tan2A=\frac{2\tan A}{1-\tan^2A}` },
  ],
  summary: 'Las identidades para el doble de un ángulo. Leídas al revés, convierten cuadrados en ángulos dobles (clave para integrar).',
  goal: 'Simplificar expresiones con $2A$ y, sobre todo, **bajar el exponente** de $\\operatorname{sen}^2$ y $\\cos^2$ para poder integrarlos.',
  variables: [{ symbol: 'A', meaning: 'Cualquier ángulo' }],
  whenToUse: [
    'Para integrar $\\operatorname{sen}^2x$ o $\\cos^2x$: se reemplazan por $\\frac{1\\mp\\cos2x}{2}$.',
    'Para simplificar $\\operatorname{sen}x\\cos x$ como $\\frac12\\operatorname{sen}2x$.',
    'En física: el alcance de un proyectil es $\\frac{v^2\\operatorname{sen}2\\theta}{g}$, máximo con $\\theta=45^\\circ$.',
  ],
  intuition: [
    'Son las de suma de ángulos con $B = A$: $\\operatorname{sen}(A+A) = \\operatorname{sen}A\\cos A+\\cos A\\operatorname{sen}A$.',
    'Las tres versiones de $\\cos2A$ son la misma, cambiando $\\cos^2$ o $\\operatorname{sen}^2$ con $\\operatorname{sen}^2+\\cos^2=1$.',
    '$\\operatorname{sen}^2A$ oscila entre 0 y 1, con el doble de rapidez que $\\operatorname{sen}A$: es una onda de **ángulo doble** centrada en $\\frac12$. Eso dice exactamente $\\frac{1-\\cos2A}{2}$.',
  ],
  derivation: {
    steps: [
      { label: 'Suma de ángulos con B = A', latex: L`\cos(A+A)=\cos A\cos A-${SEN} A\,${SEN} A=\cos^2A-${SEN}^2A` },
      { label: 'Cambiamos $\\cos^2A=1-\\operatorname{sen}^2A$', latex: L`\cos2A=1-2${SEN}^2A` },
      { label: 'Despejamos $\\operatorname{sen}^2A$', latex: L`${SEN}^2A=\frac{1-\cos2A}{2}` },
    ],
  },
  calculators: [
    calc<{ s: number; c: number; s2: number; c2: number; t2: number }>({
      id: 'doble',
      label: 'Ángulo doble',
      inputs: [{ kind: 'number', id: 'A', label: 'Ángulo', symbol: 'A', default: 30, unit: '°' }],
      compute: (v) => {
        const A = num(v, 'A'), s = sin(A), c = cos(A), t = tan(A)
        return { s, c, s2: 2 * s * c, c2: c * c - s * s, t2: ratio(2 * t, 1 - t * t) }
      },
      steps: (v, r) => {
        const A = num(v, 'A')
        return [
          { label: 'Seno y coseno de A', latex: L`${SEN}${deg(A)}=${fmt(r.s)}\qquad\cos${deg(A)}=${fmt(r.c)}` },
          { label: 'Seno del doble', latex: L`${SEN}${deg(2 * A)}=2(${fmt(r.s)})(${fmt(r.c)})=${fmt(r.s2)}` },
          { label: 'Coseno del doble (las tres formas dan lo mismo)', latex: L`\cos${deg(2 * A)}=${fmt(r.c * r.c)}-${fmt(r.s * r.s)}=1-2(${fmt(r.s * r.s)})=2(${fmt(r.c * r.c)})-1=${fmt(r.c2)}` },
          { label: 'Tangente del doble', latex: L`\tan${deg(2 * A)}=\frac{2(${fmt(tan(A))})}{1-${fp(tan(A))}^2}=${fmt(r.t2)}` },
        ]
      },
      answer: (v, r) => L`${SEN}${deg(2 * num(v, 'A'))}=${fmt(r.s2)}`,
      extras: (_v, r) => [
        { label: 'cos 2A', latex: fmt(r.c2) },
        { label: 'tan 2A', latex: fmt(r.t2) },
      ],
      interpret: (v, r) => [
        ok(r.s2, sin(2 * num(v, 'A'))),
        { tone: 'warn', text: `Error común: $2\\operatorname{sen}A=${fmt(2 * r.s)}$ no es $\\operatorname{sen}2A$. Duplicar el ángulo **no** duplica el seno.` },
      ],
      visual: (v) => {
        const A = num(v, 'A')
        return {
          type: 'plot',
          curves: [
            { points: sample(sin, 0, 360, 240), tone: 'a', label: `${SEN} x` },
            { points: sample(x => sin(2 * x), 0, 360, 240), tone: 'accent', label: `${SEN} 2x` },
          ],
          marks: [
            { x: ((A % 360) + 360) % 360, y: sin(A), tone: 'a' },
            { x: ((A % 360) + 360) % 360, y: sin(2 * A), tone: 'accent', label: `sen 2A = ${fmt(sin(2 * A), 3)}` },
          ],
          xRange: [0, 360],
          yRange: [-1.2, 1.2],
          caption: 'El eje horizontal está en grados. $\\operatorname{sen}2x$ hace dos ondas completas mientras $\\operatorname{sen}x$ hace una.',
        }
      },
    }),
    calc<{ s: number; c: number; c2: number }>({
      id: 'reduccion',
      label: 'Reducción de potencias',
      example: 'Útil para integrar $\\operatorname{sen}^2x$',
      inputs: [{ kind: 'number', id: 'A', label: 'Ángulo', symbol: 'A', default: 30, unit: '°' }],
      compute: (v) => {
        const A = num(v, 'A')
        return { s: sin(A), c: cos(A), c2: cos(2 * A) }
      },
      steps: (v, r) => {
        const A = num(v, 'A')
        return [
          { label: 'Coseno del doble', latex: L`\cos${deg(2 * A)}=${fmt(r.c2)}` },
          { label: 'Seno al cuadrado', latex: L`${SEN}^2${deg(A)}=\frac{1-${fp(r.c2)}}{2}=${fmt((1 - r.c2) / 2)}` },
          { label: 'Coseno al cuadrado', latex: L`\cos^2${deg(A)}=\frac{1+${fp(r.c2)}}{2}=${fmt((1 + r.c2) / 2)}` },
        ]
      },
      answer: (v, r) => L`${SEN}^2${deg(num(v, 'A'))}=${fmt((1 - r.c2) / 2)}`,
      extras: (_v, r) => [{ label: 'cos² A', latex: fmt((1 + r.c2) / 2) }],
      interpret: (_v, r) => [
        ok((1 - r.c2) / 2, r.s * r.s),
        { tone: 'info', text: 'Así se integra: $\\int\\operatorname{sen}^2x\\,dx=\\int\\frac{1-\\cos2x}{2}dx=\\frac x2-\\frac{\\operatorname{sen}2x}{4}+C$.' },
      ],
      visual: (v) => {
        const A = num(v, 'A')
        return {
          type: 'plot',
          curves: [
            { points: sample(x => sin(x) ** 2, 0, 360, 240), tone: 'a', label: `${SEN}^2x` },
            { points: sample(x => (1 - cos(2 * x)) / 2, 0, 360, 240), tone: 'accent', dashed: true, label: L`\frac{1-\cos2x}{2}` },
            { points: [[0, 0.5], [360, 0.5]], tone: 'muted', dashed: true },
          ],
          marks: [{ x: ((A % 360) + 360) % 360, y: sin(A) ** 2, label: `A = ${fmt(A)}°` }],
          xRange: [0, 360],
          yRange: [-0.1, 1.15],
          caption: 'Las dos curvas coinciden: $\\operatorname{sen}^2x$ es una onda de ángulo doble centrada en $\\frac12$.',
        }
      },
    }),
  ],
  commonMistakes: [
    '$\\operatorname{sen}2A \\ne 2\\operatorname{sen}A$.',
    'Confundir los signos de la reducción: $\\operatorname{sen}^2$ lleva **menos**, $\\cos^2$ lleva **más**.',
    'Olvidar dividir entre 2.',
  ],
  related: ['suma-diferencia-angulos', 'identidades-fundamentales', 'integrales-trigonometricas'],
  keywords: ['angulo doble', 'sen2a', 'cos2a', 'reduccion de potencias', 'angulo medio', 'sen cuadrado', 'trigonometria'],
}

// ─── Productos y sumas de senos y cosenos ────────────────────────────────────

const sumasProductos: Formula = {
  id: 'sumas-productos-trig',
  name: 'Productos y sumas de senos y cosenos',
  category: 'trigonometria',
  latex: L`${SEN} A\,${SEN} B=\tfrac12\left[\cos(A-B)-\cos(A+B)\right]`,
  forms: [
    { label: 'Seno por coseno', latex: L`${SEN} A\cos B=\tfrac12\left[${SEN}(A-B)+${SEN}(A+B)\right]` },
    { label: 'Coseno por coseno', latex: L`\cos A\cos B=\tfrac12\left[\cos(A-B)+\cos(A+B)\right]` },
    { label: 'Suma de senos', latex: L`${SEN} A+${SEN} B=2\,${SEN}\tfrac12(A+B)\cos\tfrac12(A-B)` },
    { label: 'Diferencia de senos', latex: L`${SEN} A-${SEN} B=2\cos\tfrac12(A+B)\,${SEN}\tfrac12(A-B)` },
    { label: 'Suma de cosenos', latex: L`\cos A+\cos B=2\cos\tfrac12(A+B)\cos\tfrac12(A-B)` },
    { label: 'Diferencia de cosenos', latex: L`\cos A-\cos B=-2\,${SEN}\tfrac12(A+B)\,${SEN}\tfrac12(A-B)` },
  ],
  summary: 'Convierten productos de senos y cosenos en sumas, y sumas en productos.',
  goal: '**Producto → suma** para integrar cosas como $\\operatorname{sen}3x\\cos x$. **Suma → producto** para resolver ecuaciones como $\\operatorname{sen}x+\\operatorname{sen}3x=0$, o para entender batimientos de dos sonidos.',
  variables: [{ symbol: 'A,\\ B', meaning: 'Dos ángulos cualesquiera' }],
  whenToUse: [
    'Para integrar productos: $\\int\\operatorname{sen}3x\\cos x\\,dx = \\frac12\\int(\\operatorname{sen}2x+\\operatorname{sen}4x)\\,dx$.',
    'Para factorizar sumas de senos o cosenos al resolver ecuaciones (un producto es 0 si algún factor es 0).',
    'En física: dos ondas de frecuencias parecidas se suman en una onda “envuelta” (batimiento).',
  ],
  intuition: [
    'Salen de sumar y restar las fórmulas de suma de ángulos. Por ejemplo, $\\cos(A-B)-\\cos(A+B)$: los términos $\\cos A\\cos B$ se cancelan y queda $2\\operatorname{sen}A\\operatorname{sen}B$.',
    'Las de suma a producto son las mismas leídas al revés, con $A\\to\\frac{A+B}{2}$ y $B\\to\\frac{A-B}{2}$.',
  ],
  derivation: {
    steps: [
      { label: 'Escribimos las dos fórmulas', latex: L`\cos(A-B)=\cos A\cos B+${SEN} A\,${SEN} B\qquad\cos(A+B)=\cos A\cos B-${SEN} A\,${SEN} B` },
      { label: 'Restamos', latex: L`\cos(A-B)-\cos(A+B)=2\,${SEN} A\,${SEN} B` },
      { label: 'Dividimos entre 2', latex: L`${SEN} A\,${SEN} B=\tfrac12\left[\cos(A-B)-\cos(A+B)\right]` },
    ],
  },
  calculators: [
    calc<{ ss: number; sc: number; cc: number }>({
      id: 'producto',
      label: 'Producto → suma',
      inputs: [
        { kind: 'number', id: 'A', label: 'Ángulo A', symbol: 'A', default: 75, unit: '°' },
        { kind: 'number', id: 'B', label: 'Ángulo B', symbol: 'B', default: 15, unit: '°' },
      ],
      compute: (v) => {
        const A = num(v, 'A'), B = num(v, 'B')
        return {
          ss: (cos(A - B) - cos(A + B)) / 2,
          sc: (sin(A - B) + sin(A + B)) / 2,
          cc: (cos(A - B) + cos(A + B)) / 2,
        }
      },
      steps: (v, r) => {
        const A = num(v, 'A'), B = num(v, 'B')
        return [
          { label: 'Ángulos suma y diferencia', latex: L`A+B=${deg(A + B)}\qquad A-B=${deg(A - B)}` },
          { label: 'Seno por seno', latex: L`${SEN} A\,${SEN} B=\tfrac12[${fmt(cos(A - B))}-${fp(cos(A + B))}]=${fmt(r.ss)}` },
          { label: 'Seno por coseno', latex: L`${SEN} A\cos B=\tfrac12[${fmt(sin(A - B))}+${fp(sin(A + B))}]=${fmt(r.sc)}` },
          { label: 'Coseno por coseno', latex: L`\cos A\cos B=\tfrac12[${fmt(cos(A - B))}+${fp(cos(A + B))}]=${fmt(r.cc)}` },
        ]
      },
      answer: (v, r) => L`${SEN}${deg(num(v, 'A'))}\,${SEN}${deg(num(v, 'B'))}=${fmt(r.ss)}`,
      extras: (_v, r) => [
        { label: 'sen A cos B', latex: fmt(r.sc) },
        { label: 'cos A cos B', latex: fmt(r.cc) },
      ],
      interpret: (v, r) => [
        ok(r.ss, sin(num(v, 'A')) * sin(num(v, 'B'))),
        { tone: 'info', text: 'Un producto difícil de integrar se vuelve una **suma** de senos o cosenos sueltos, cada uno con su integral directa.' },
      ],
    }),
    calc<{ ps: number; ms: number; pc: number; mc: number }>({
      id: 'suma',
      label: 'Suma → producto',
      inputs: [
        { kind: 'number', id: 'A', label: 'Ángulo A', symbol: 'A', default: 75, unit: '°' },
        { kind: 'number', id: 'B', label: 'Ángulo B', symbol: 'B', default: 15, unit: '°' },
      ],
      compute: (v) => {
        const A = num(v, 'A'), B = num(v, 'B'), h = (A + B) / 2, d = (A - B) / 2
        return { ps: 2 * sin(h) * cos(d), ms: 2 * cos(h) * sin(d), pc: 2 * cos(h) * cos(d), mc: -2 * sin(h) * sin(d) }
      },
      steps: (v, r) => {
        const A = num(v, 'A'), B = num(v, 'B'), h = (A + B) / 2, d = (A - B) / 2
        return [
          { label: 'Semisuma y semidiferencia', latex: L`\tfrac12(A+B)=${deg(h)}\qquad\tfrac12(A-B)=${deg(d)}` },
          { label: 'Suma de senos', latex: L`${SEN} A+${SEN} B=2\,${SEN}${deg(h)}\cos${deg(d)}=${fmt(r.ps)}` },
          { label: 'Diferencia de senos', latex: L`${SEN} A-${SEN} B=2\cos${deg(h)}\,${SEN}${deg(d)}=${fmt(r.ms)}` },
          { label: 'Suma de cosenos', latex: L`\cos A+\cos B=2\cos${deg(h)}\cos${deg(d)}=${fmt(r.pc)}` },
          { label: 'Diferencia de cosenos', latex: L`\cos A-\cos B=-2\,${SEN}${deg(h)}\,${SEN}${deg(d)}=${fmt(r.mc)}` },
        ]
      },
      answer: (v, r) => L`${SEN}${deg(num(v, 'A'))}+${SEN}${deg(num(v, 'B'))}=${fmt(r.ps)}`,
      extras: (_v, r) => [
        { label: 'sen A − sen B', latex: fmt(r.ms) },
        { label: 'cos A + cos B', latex: fmt(r.pc) },
        { label: 'cos A − cos B', latex: fmt(r.mc) },
      ],
      interpret: (v, r) => [
        ok(r.ps, sin(num(v, 'A')) + sin(num(v, 'B'))),
        { tone: 'info', text: 'Como producto se ve cuándo la suma vale 0: basta con que **uno** de los factores sea 0.' },
      ],
    }),
  ],
  commonMistakes: [
    'Olvidar el $\\frac12$ en producto → suma, o el 2 en suma → producto.',
    'El signo de la diferencia de cosenos: lleva $-2$.',
    'En $\\operatorname{sen}A\\,\\operatorname{sen}B$, el orden es $\\cos(A-B)$ **menos** $\\cos(A+B)$.',
  ],
  related: ['suma-diferencia-angulos', 'angulo-doble', 'integrales-trigonometricas'],
  keywords: ['producto de senos', 'suma de senos', 'prostaferesis', 'producto a suma', 'suma a producto', 'trigonometria'],
}

export const TRIGONOMETRIA: Formula[] = [razonesTrig, identidadesFundamentales, sumaDiferenciaAngulos, anguloDoble, sumasProductos]
