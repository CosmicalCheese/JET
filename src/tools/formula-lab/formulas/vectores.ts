import { calc, fail, num, vec, type Formula, type Interpretation } from '../types'
import { fmt, fp, fvec, sum, toDeg, toRad } from '../format'

const L = String.raw

const mag = (v: number[]) => Math.sqrt(sum(v.map(c => c * c)))
const dotOf = (a: number[], b: number[]) => sum(a.map((c, i) => c * (b[i] ?? 0)))

function sameDims(a: number[], b: number[]) {
  if (a.length !== b.length) fail('Los dos vectores deben tener el mismo número de componentes.')
}

function angleWords(deg: number): Interpretation {
  if (Math.abs(deg - 90) < 1e-9) return { tone: 'good', text: 'Los vectores son **perpendiculares (ortogonales)**: ninguno avanza nada en la dirección del otro.' }
  if (deg < 1e-9) return { tone: 'good', text: 'Los vectores apuntan en **la misma dirección** (son paralelos): el producto punto es el máximo posible, $|\\vec a||\\vec b|$.' }
  if (Math.abs(deg - 180) < 1e-9) return { tone: 'good', text: 'Los vectores apuntan en **direcciones opuestas**: el producto punto es el mínimo posible, $-|\\vec a||\\vec b|$.' }
  if (deg < 90) return { tone: 'good', text: `El ángulo es **agudo** ($${fmt(deg, 2)}^\\circ$): los vectores apuntan “hacia el mismo lado”, por eso el producto punto es **positivo**.` }
  return { tone: 'good', text: `El ángulo es **obtuso** ($${fmt(deg, 2)}^\\circ$): los vectores apuntan “hacia lados contrarios”, por eso el producto punto es **negativo**.` }
}

// ─── Producto punto ──────────────────────────────────────────────────────────

interface DotResult { dot: number; ma: number; mb: number; cos: number; deg: number; proj: number }

const productoPunto: Formula = {
  id: 'producto-punto',
  name: 'Producto punto (producto escalar)',
  category: 'vectores',
  latex: L`\vec a\cdot\vec b=a_1b_1+a_2b_2+a_3b_3=|\vec a|\,|\vec b|\cos\theta`,
  forms: [
    { label: 'Ángulo entre vectores', latex: L`\cos\theta=\frac{\vec a\cdot\vec b}{|\vec a|\,|\vec b|}` },
    { label: 'Proyección escalar de b sobre a', latex: L`\operatorname{comp}_{\vec a}\vec b=\frac{\vec a\cdot\vec b}{|\vec a|}=|\vec b|\cos\theta` },
  ],
  summary: 'Multiplica dos vectores y da un número que mide cuánto apunta uno en la dirección del otro.',
  goal: 'Un solo número que diga qué tan “alineados” están dos vectores. Con él se obtiene el ángulo entre ellos, se verifica si son perpendiculares y se calculan proyecciones.',
  variables: [
    { symbol: L`\vec a,\ \vec b`, meaning: 'Los dos vectores, con componentes $\\langle a_1,a_2,a_3\\rangle$ y $\\langle b_1,b_2,b_3\\rangle$' },
    { symbol: L`\vec a\cdot\vec b`, meaning: 'El producto punto: un **escalar** (un número), no un vector' },
    { symbol: L`|\vec a|`, meaning: 'Magnitud (longitud) de $\\vec a$: $\\sqrt{a_1^2+a_2^2+a_3^2}$' },
    { symbol: L`\theta`, meaning: 'Ángulo entre los vectores, $0 \\le \\theta \\le \\pi$' },
  ],
  whenToUse: [
    'Para encontrar el **ángulo** entre dos vectores.',
    'Para saber si dos vectores son **perpendiculares**: si ninguno es el vector cero, lo son si y sólo si $\\vec a\\cdot\\vec b = 0$.',
    'Para **proyectar** un vector sobre otro (la “sombra” de uno sobre el otro).',
    'En física: el **trabajo** es $W = \\vec F\\cdot\\vec d$, es decir, sólo cuenta la parte de la fuerza que va en la dirección del movimiento.',
    'En **multiplicación de matrices**: cada entrada del resultado es el producto punto de una fila por una columna.',
  ],
  intuition: [
    'El producto punto responde a la pregunta: **¿cuánto de $\\vec b$ va en la dirección de $\\vec a$?**',
    'Imagina una luz que cae perpendicular a $\\vec a$. La **sombra** de $\\vec b$ sobre $\\vec a$ mide $|\\vec b|\\cos\\theta$. El producto punto es esa sombra multiplicada por la longitud de $\\vec a$: $\\vec a\\cdot\\vec b = |\\vec a|\\,(|\\vec b|\\cos\\theta)$.',
    'Si apuntan hacia el mismo lado, la sombra es positiva. Si son perpendiculares no hay sombra (resultado 0). Si apuntan hacia lados contrarios, la sombra cae “hacia atrás” y el resultado es negativo.',
    'La forma por componentes funciona porque los ejes son perpendiculares entre sí: $\\hat i\\cdot\\hat j = 0$. Al multiplicar, sólo sobreviven las parejas del **mismo eje**: $a_1b_1 + a_2b_2 + a_3b_3$.',
  ],
  derivation: {
    intro: '¿Por qué la fórmula por componentes y la del coseno dan lo mismo? Sale de la ley de cosenos aplicada al triángulo que forman $\\vec a$, $\\vec b$ y $\\vec a - \\vec b$.',
    steps: [
      { label: 'Ley de cosenos en ese triángulo', latex: L`|\vec a-\vec b|^2=|\vec a|^2+|\vec b|^2-2|\vec a||\vec b|\cos\theta` },
      { label: 'La misma longitud, calculada con componentes', latex: L`|\vec a-\vec b|^2=\sum(a_i-b_i)^2=\sum a_i^2+\sum b_i^2-2\sum a_ib_i` },
      { label: 'Como $\\sum a_i^2=|\\vec a|^2$ y $\\sum b_i^2=|\\vec b|^2$, igualamos', latex: L`-2\sum a_ib_i=-2|\vec a||\vec b|\cos\theta` },
      { label: 'Conclusión', latex: L`a_1b_1+a_2b_2+a_3b_3=|\vec a|\,|\vec b|\cos\theta` },
    ],
    outro: 'Por eso el producto punto “sabe” el ángulo aunque sólo multipliques componentes.',
  },
  calculators: [
    calc<DotResult>({
      id: 'componentes',
      label: 'Con componentes',
      inputs: [
        { kind: 'vector', id: 'a', label: 'Vector a', symbol: L`\vec a`, default: [4, 1] },
        { kind: 'vector', id: 'b', label: 'Vector b', symbol: L`\vec b`, default: [2, 3] },
      ],
      compute: (v) => {
        const a = vec(v, 'a'), b = vec(v, 'b')
        sameDims(a, b)
        const dot = dotOf(a, b)
        const ma = mag(a), mb = mag(b)
        const cos = ma && mb ? Math.max(-1, Math.min(1, dot / (ma * mb))) : NaN
        return { dot, ma, mb, cos, deg: toDeg(Math.acos(cos)), proj: ma ? dot / ma : NaN }
      },
      steps: (v, r) => {
        const a = vec(v, 'a'), b = vec(v, 'b')
        const steps = [
          {
            label: 'Multiplicamos componente por componente (mismo eje) y sumamos',
            latex: L`\vec a\cdot\vec b=` + a.map((c, i) => L`(${fmt(c)})(${fmt(b[i])})`).join('+') +
              '=' + a.map((c, i) => fp(c * b[i])).join('+') + L`=${fmt(r.dot)}`,
          },
          { label: 'Magnitud de a', latex: L`|\vec a|=\sqrt{${a.map(c => L`${fp(c)}^2`).join('+')}}=\sqrt{${fmt(r.ma ** 2)}}=${fmt(r.ma)}` },
          { label: 'Magnitud de b', latex: L`|\vec b|=\sqrt{${b.map(c => L`${fp(c)}^2`).join('+')}}=\sqrt{${fmt(r.mb ** 2)}}=${fmt(r.mb)}` },
        ]
        if (!Number.isNaN(r.cos)) {
          steps.push(
            { label: 'Despejamos el coseno del ángulo', latex: L`\cos\theta=\frac{\vec a\cdot\vec b}{|\vec a||\vec b|}=\frac{${fmt(r.dot)}}{(${fmt(r.ma)})(${fmt(r.mb)})}=${fmt(r.cos)}` },
            { label: 'Ángulo', latex: L`\theta=\cos^{-1}(${fmt(r.cos)})=${fmt(r.deg, 2)}^\circ` },
            { label: 'Proyección escalar (la “sombra” de b sobre a)', latex: L`\operatorname{comp}_{\vec a}\vec b=\frac{${fmt(r.dot)}}{${fmt(r.ma)}}=${fmt(r.proj)}` },
          )
        }
        return steps
      },
      answer: (_v, r) => L`\vec a\cdot\vec b=${fmt(r.dot)}`,
      extras: (_v, r) => Number.isNaN(r.cos) ? [] : [
        { label: 'Ángulo', latex: L`\theta=${fmt(r.deg, 2)}^\circ` },
        { label: 'Coseno', latex: L`\cos\theta=${fmt(r.cos)}` },
        { label: 'Proyección', latex: L`\operatorname{comp}_{\vec a}\vec b=${fmt(r.proj)}` },
      ],
      interpret: (_v, r) => {
        if (Number.isNaN(r.cos)) {
          return [
            { tone: 'warn', text: 'Uno de los vectores es el **vector cero**: no tiene dirección, así que el ángulo no está definido. El producto punto con el vector cero siempre es 0.' },
          ]
        }
        return [
          angleWords(r.deg),
          { tone: 'info', text: `La parte de $\\vec b$ que va en la dirección de $\\vec a$ mide $${fmt(r.proj)}$ unidades (de una longitud total de $${fmt(r.mb)}$). Eso es $${fmt(Math.abs(r.cos) * 100, 1)}\\%$ de $\\vec b$.` },
          { tone: 'info', text: `Si $\\vec a$ fuera una fuerza y $\\vec b$ un desplazamiento, el trabajo realizado sería $W = ${fmt(r.dot)}$.` },
        ]
      },
      visual: (v) => vec(v, 'a').length === 3
        ? { type: 'vectors3d', mode: 'dot', a: vec(v, 'a'), b: vec(v, 'b') }
        : { type: 'vectors', a: vec(v, 'a'), b: vec(v, 'b') },
    }),
    calc<{ dot: number; cos: number }>({
      id: 'angulo',
      label: 'Con magnitudes y ángulo',
      inputs: [
        { kind: 'number', id: 'ma', label: 'Magnitud de a', symbol: L`|\vec a|`, default: 5 },
        { kind: 'number', id: 'mb', label: 'Magnitud de b', symbol: L`|\vec b|`, default: 3 },
        { kind: 'number', id: 'theta', label: 'Ángulo', symbol: L`\theta`, default: 60, unit: '°' },
      ],
      compute: (v) => {
        if (num(v, 'ma') < 0 || num(v, 'mb') < 0) fail('Las magnitudes no pueden ser negativas.')
        const cos = Math.cos(toRad(num(v, 'theta')))
        return { dot: num(v, 'ma') * num(v, 'mb') * cos, cos }
      },
      steps: (v, r) => [
        { label: 'Coseno del ángulo', latex: L`\cos(${fmt(num(v, 'theta'))}^\circ)=${fmt(r.cos)}` },
        { label: 'Multiplicamos', latex: L`\vec a\cdot\vec b=(${fmt(num(v, 'ma'))})(${fmt(num(v, 'mb'))})(${fmt(r.cos)})=${fmt(r.dot)}` },
      ],
      answer: (_v, r) => L`\vec a\cdot\vec b=${fmt(r.dot)}`,
      interpret: (v, r) => {
        let t = ((num(v, 'theta') % 360) + 360) % 360
        if (t > 180) t = 360 - t
        return [
          angleWords(t),
          { tone: 'info', text: `De la longitud de $\\vec b$, $${fmt(num(v, 'mb') * r.cos)}$ unidades van en la dirección de $\\vec a$ ($|\\vec b|\\cos\\theta$).` },
        ]
      },
      visual: (v) => {
        const t = toRad(num(v, 'theta'))
        return { type: 'vectors', a: [num(v, 'ma'), 0], b: [num(v, 'mb') * Math.cos(t), num(v, 'mb') * Math.sin(t)] }
      },
    }),
  ],
  commonMistakes: [
    'Creer que el resultado es un vector: $\\langle1,2\\rangle\\cdot\\langle3,4\\rangle = 11$, **no** $\\langle3,8\\rangle$.',
    'Confundirlo con el producto cruz, que sí da un vector y sólo existe en 3D.',
    'Tener la calculadora en radianes al sacar $\\cos^{-1}$ cuando quieres grados (o al revés).',
    'Olvidar los signos negativos al multiplicar componentes: $(-2)(3) = -6$.',
  ],
  related: ['producto-cruz', 'trabajo', 'ley-de-cosenos', 'distancia-puntos'],
  toolLink: { path: '/matrices/multiplication', label: 'Matrices → Multiplicación' },
  keywords: ['producto escalar', 'dot product', 'angulo entre vectores', 'proyeccion', 'ortogonal', 'perpendicular'],
}

// ─── Producto cruz ───────────────────────────────────────────────────────────

interface CrossResult { c: number[]; mc: number; ma: number; mb: number; deg: number }

const productoCruz: Formula = {
  id: 'producto-cruz',
  name: 'Producto cruz (producto vectorial)',
  category: 'vectores',
  latex: L`\vec a\times\vec b=\begin{vmatrix}\hat i&\hat j&\hat k\\a_1&a_2&a_3\\b_1&b_2&b_3\end{vmatrix}`,
  forms: [
    { label: 'Desarrollado', latex: L`(a_2b_3-a_3b_2)\,\hat i+(a_3b_1-a_1b_3)\,\hat j+(a_1b_2-a_2b_1)\,\hat k` },
    { label: 'Magnitud', latex: L`|\vec a\times\vec b|=|\vec a|\,|\vec b|\sin\theta` },
  ],
  summary: 'Multiplica dos vectores en 3D y da un vector perpendicular a ambos, cuya longitud es el área del paralelogramo que forman.',
  goal: 'Encontrar una dirección perpendicular a dos vectores dados (la normal de un plano) y medir el área que abarcan.',
  variables: [
    { symbol: L`\vec a\times\vec b`, meaning: 'Un **vector** perpendicular a $\\vec a$ y a $\\vec b$' },
    { symbol: L`\hat i,\hat j,\hat k`, meaning: 'Vectores unitarios de los ejes $x$, $y$, $z$' },
    { symbol: L`\theta`, meaning: 'Ángulo entre $\\vec a$ y $\\vec b$' },
  ],
  whenToUse: [
    'Para obtener el **vector normal** de un plano a partir de dos vectores contenidos en él.',
    'Para calcular **áreas**: de un paralelogramo $|\\vec a\\times\\vec b|$, o de un triángulo $\\tfrac12|\\vec a\\times\\vec b|$.',
    'En física: **momento (torque)** $\\vec M_O = \\vec r\\times\\vec F$ y fuerza magnética $\\vec F = q\\vec v\\times\\vec B$.',
  ],
  intuition: [
    'Mientras el producto punto mide qué tan **alineados** están dos vectores ($\\cos\\theta$), el producto cruz mide qué tan **separados** están ($\\sin\\theta$).',
    'Su magnitud es el área del paralelogramo formado por $\\vec a$ y $\\vec b$: base $|\\vec a|$ por altura $|\\vec b|\\sin\\theta$. Vectores paralelos no forman área, así que su producto cruz es $\\vec 0$.',
    'Su dirección sigue la **regla de la mano derecha**: dedos de $\\vec a$ hacia $\\vec b$, y el pulgar señala $\\vec a\\times\\vec b$. Por eso el orden importa: $\\vec b\\times\\vec a = -\\,\\vec a\\times\\vec b$.',
  ],
  derivation: {
    steps: [
      { label: 'Desarrollamos el determinante por la primera fila', latex: L`\hat i\begin{vmatrix}a_2&a_3\\b_2&b_3\end{vmatrix}-\hat j\begin{vmatrix}a_1&a_3\\b_1&b_3\end{vmatrix}+\hat k\begin{vmatrix}a_1&a_2\\b_1&b_2\end{vmatrix}` },
      { label: 'Es perpendicular a a: su producto punto da 0', latex: L`\vec a\cdot(\vec a\times\vec b)=a_1(a_2b_3-a_3b_2)+a_2(a_3b_1-a_1b_3)+a_3(a_1b_2-a_2b_1)=0` },
      { label: 'Identidad de Lagrange', latex: L`|\vec a\times\vec b|^2=|\vec a|^2|\vec b|^2-(\vec a\cdot\vec b)^2=|\vec a|^2|\vec b|^2(1-\cos^2\theta)` },
      { label: 'Por lo tanto', latex: L`|\vec a\times\vec b|=|\vec a|\,|\vec b|\sin\theta` },
    ],
  },
  calculators: [
    calc<CrossResult>({
      id: 'cruz',
      label: 'Calcular a × b',
      inputs: [
        { kind: 'vector', id: 'a', label: 'Vector a', symbol: L`\vec a`, default: [2, 0, 1], fixedDims: 3 },
        { kind: 'vector', id: 'b', label: 'Vector b', symbol: L`\vec b`, default: [0, 3, 1], fixedDims: 3 },
      ],
      compute: (v) => {
        const [a1, a2, a3] = vec(v, 'a'), [b1, b2, b3] = vec(v, 'b')
        const c = [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1]
        const ma = mag(vec(v, 'a')), mb = mag(vec(v, 'b'))
        const cos = ma && mb ? Math.max(-1, Math.min(1, dotOf(vec(v, 'a'), vec(v, 'b')) / (ma * mb))) : NaN
        return { c, mc: mag(c), ma, mb, deg: toDeg(Math.acos(cos)) }
      },
      steps: (v, r) => {
        const [a1, a2, a3] = vec(v, 'a'), [b1, b2, b3] = vec(v, 'b')
        return [
          { label: 'Planteamos el determinante', latex: L`\vec a\times\vec b=\begin{vmatrix}\hat i&\hat j&\hat k\\${fmt(a1)}&${fmt(a2)}&${fmt(a3)}\\${fmt(b1)}&${fmt(b2)}&${fmt(b3)}\end{vmatrix}` },
          { label: 'Componente i', latex: L`(${fmt(a2)})(${fmt(b3)})-(${fmt(a3)})(${fmt(b2)})=${fmt(r.c[0])}` },
          { label: 'Componente j', latex: L`(${fmt(a3)})(${fmt(b1)})-(${fmt(a1)})(${fmt(b3)})=${fmt(r.c[1])}` },
          { label: 'Componente k', latex: L`(${fmt(a1)})(${fmt(b2)})-(${fmt(a2)})(${fmt(b1)})=${fmt(r.c[2])}` },
          { label: 'Magnitud = área del paralelogramo', latex: L`|\vec a\times\vec b|=\sqrt{${r.c.map(c => L`${fp(c)}^2`).join('+')}}=${fmt(r.mc)}` },
          { label: 'Comprobación: es perpendicular a ambos', latex: L`\vec a\cdot(\vec a\times\vec b)=${fmt(dotOf(vec(v, 'a'), r.c))},\qquad \vec b\cdot(\vec a\times\vec b)=${fmt(dotOf(vec(v, 'b'), r.c))}` },
        ]
      },
      answer: (_v, r) => L`\vec a\times\vec b=${fvec(r.c)}`,
      extras: (_v, r) => [
        { label: 'Área paralelogramo', latex: L`${fmt(r.mc)}` },
        { label: 'Área triángulo', latex: L`${fmt(r.mc / 2)}` },
        ...(Number.isNaN(r.deg) ? [] : [{ label: 'Ángulo', latex: L`\theta=${fmt(r.deg, 2)}^\circ` }]),
      ],
      interpret: (_v, r) => {
        if (r.mc < 1e-12) {
          return [{ tone: 'warn', text: 'El resultado es el vector cero: los vectores son **paralelos** (o alguno es $\\vec 0$). No forman área, ni definen un plano único.' }]
        }
        return [
          { tone: 'good', text: `$${fvec(r.c)}$ es **perpendicular** tanto a $\\vec a$ como a $\\vec b$: sirve como vector normal del plano que forman.` },
          { tone: 'info', text: `El paralelogramo formado por $\\vec a$ y $\\vec b$ tiene área $${fmt(r.mc)}$; el triángulo, la mitad: $${fmt(r.mc / 2)}$.` },
          { tone: 'info', text: 'Si inviertes el orden ($\\vec b\\times\\vec a$) obtienes el mismo vector con el signo opuesto: apunta hacia el otro lado del plano.' },
        ]
      },
      visual: (v) => ({ type: 'vectors3d', mode: 'cross', a: vec(v, 'a'), b: vec(v, 'b') }),
    }),
  ],
  commonMistakes: [
    'Olvidar el signo negativo de la componente $\\hat j$ al desarrollar el determinante.',
    'Asumir que $\\vec a\\times\\vec b = \\vec b\\times\\vec a$: el orden cambia el sentido.',
    'Intentar usarlo en 2D. Para vectores en el plano, agrega $z = 0$ y el resultado apunta sobre el eje $z$.',
  ],
  related: ['producto-punto', 'area-vectores'],
  keywords: ['producto vectorial', 'cross product', 'normal', 'area paralelogramo', 'torque', 'momento'],
}

// ─── Distancia entre dos puntos ──────────────────────────────────────────────

interface DistResult { d: number[]; dist: number }

const distancia: Formula = {
  id: 'distancia-puntos',
  name: 'Distancia entre dos puntos',
  category: 'vectores',
  latex: L`d=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2+(z_2-z_1)^2}`,
  forms: [
    { label: 'Vector que une P₁ y P₂', latex: L`\overrightarrow{P_1P_2}=[x_2-x_1,\ y_2-y_1,\ z_2-z_1]=[l,m,n]` },
    { label: 'Cosenos directores', latex: L`\cos\alpha=\frac{l}{d},\quad\cos\beta=\frac{m}{d},\quad\cos\gamma=\frac{n}{d}` },
  ],
  summary: 'La longitud del segmento que une dos puntos del plano o del espacio.',
  goal: 'Medir qué tan lejos están dos puntos en línea recta, conociendo sólo sus coordenadas.',
  variables: [
    { symbol: L`P_1(x_1,y_1,z_1)`, meaning: 'Punto inicial' },
    { symbol: L`P_2(x_2,y_2,z_2)`, meaning: 'Punto final' },
    { symbol: 'l,m,n', meaning: 'Diferencias en cada eje (componentes del vector $\\overrightarrow{P_1P_2}$)' },
    { symbol: L`\alpha,\beta,\gamma`, meaning: 'Ángulos que forma el vector $\\overrightarrow{P_1P_2}$ con los semiejes positivos $x$, $y$, $z$' },
  ],
  whenToUse: [
    'Longitudes de segmentos, lados de figuras, radios.',
    'La magnitud de cualquier vector es la distancia de su punta al origen.',
  ],
  intuition: [
    'Es el **teorema de Pitágoras** aplicado dos veces. En el piso, la diagonal entre los puntos mide $\\sqrt{l^2+m^2}$. Esa diagonal y la diferencia de altura $n$ forman otro triángulo rectángulo, cuya hipotenusa es $d$.',
    'Las diferencias se elevan al cuadrado, así que no importa cuál punto llames $P_1$ y cuál $P_2$.',
  ],
  derivation: {
    steps: [
      { label: 'Diagonal en el plano xy (Pitágoras)', latex: L`d_{xy}^2=l^2+m^2` },
      { label: 'Agregamos la altura (Pitágoras otra vez)', latex: L`d^2=d_{xy}^2+n^2=l^2+m^2+n^2` },
      { label: 'Sacamos raíz', latex: L`d=\sqrt{l^2+m^2+n^2}` },
    ],
  },
  calculators: [
    calc<DistResult>({
      id: 'dist',
      label: 'Calcular',
      inputs: [
        { kind: 'vector', id: 'p1', label: 'Punto P₁', symbol: 'P_1', default: [1, 2, 3] },
        { kind: 'vector', id: 'p2', label: 'Punto P₂', symbol: 'P_2', default: [4, 6, 15] },
      ],
      compute: (v) => {
        const p1 = vec(v, 'p1'), p2 = vec(v, 'p2')
        sameDims(p1, p2)
        const d = p2.map((c, i) => c - p1[i])
        return { d, dist: mag(d) }
      },
      steps: (v, r) => {
        const p1 = vec(v, 'p1'), p2 = vec(v, 'p2')
        const names = ['x', 'y', 'z']
        return [
          { label: 'Diferencias en cada eje', latex: r.d.map((c, i) => L`${names[i]}_2-${names[i]}_1=${fmt(p2[i])}-${fp(p1[i])}=${fmt(c)}`).join(L`,\quad `) },
          { label: 'Elevamos al cuadrado y sumamos', latex: L`d^2=${r.d.map(c => L`${fp(c)}^2`).join('+')}=${fmt(r.dist ** 2)}` },
          { label: 'Sacamos raíz', latex: L`d=\sqrt{${fmt(r.dist ** 2)}}=${fmt(r.dist)}` },
        ]
      },
      answer: (_v, r) => L`d=${fmt(r.dist)}`,
      extras: (_v, r) => [
        { label: 'Vector P₁P₂', latex: fvec(r.d) },
        ...(r.dist > 0 ? [{ label: 'Cosenos directores', latex: r.d.map((c, i) => L`\cos${[L`\alpha`, L`\beta`, L`\gamma`][i]}=${fmt(c / r.dist)}`).join(L`,\ `) }] : []),
      ],
      interpret: (_v, r) => {
        if (r.dist === 0) return [{ tone: 'warn', text: 'Los dos puntos son el mismo: la distancia es 0.' }]
        const out: Interpretation[] = [{ tone: 'good', text: `Los puntos están separados $${fmt(r.dist)}$ unidades en línea recta.` }]
        if (r.d.length === 3) {
          out.push({ tone: 'info', text: `El vector $\\overrightarrow{P_1P_2}$ forma ángulos de $${r.d.map(c => fmt(toDeg(Math.acos(c / r.dist)), 1) + '^\\circ').join(',\\ ')}$ con los semiejes positivos $x$, $y$, $z$. Los cosenos directores siempre cumplen $\\cos^2\\alpha+\\cos^2\\beta+\\cos^2\\gamma=1$.` })
        }
        return out
      },
      visual: (v) => ({ type: 'vectors3d', mode: 'points', a: vec(v, 'p1'), b: vec(v, 'p2'), view: vec(v, 'p1').length === 2 ? 'top' : undefined }),
    }),
  ],
  commonMistakes: [
    'Restar coordenadas de ejes distintos.',
    'Sumar las diferencias sin elevarlas al cuadrado.',
    'Escribir $\\sqrt{a^2+b^2} = a + b$: la raíz no se reparte en la suma.',
  ],
  related: ['producto-punto', 'ley-de-cosenos'],
  keywords: ['pitagoras', 'magnitud', 'longitud', 'cosenos directores', 'geometria analitica'],
}

// ─── Área con vectores ───────────────────────────────────────────────────────

interface AreaResult { a: number[]; b: number[]; c: number[]; par: number; is2D: boolean }

/** Producto cruz; en 2D se completa con z = 0 y sólo queda la componente z (el determinante) */
function areaOf(a: number[], b: number[]): AreaResult {
  sameDims(a, b)
  const is2D = a.length === 2
  const [a1, a2, a3 = 0] = a, [b1, b2, b3 = 0] = b
  const c = [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1]
  return { a, b, c, par: mag(c), is2D }
}

function areaSteps(r: AreaResult, names: [string, string]) {
  const [n1, n2] = names
  const [a1, a2] = r.a, [b1, b2] = r.b
  if (r.is2D) {
    return [
      { label: 'En el plano, el área es el determinante de las componentes', latex: L`\det=a_1b_2-a_2b_1=(${fmt(a1)})(${fmt(b2)})-(${fmt(a2)})(${fmt(b1)})=${fmt(r.c[2])}` },
      { label: 'Área del paralelogramo (valor absoluto)', latex: L`A=|${fmt(r.c[2])}|=${fmt(r.par)}` },
      { label: 'Área del triángulo (la mitad)', latex: L`A_{\triangle}=\tfrac12(${fmt(r.par)})=${fmt(r.par / 2)}` },
    ]
  }
  return [
    { label: `Producto cruz de ${n1} y ${n2}`, latex: L`${n1}\times${n2}=${fvec(r.c)}` },
    { label: 'Área del paralelogramo = magnitud del producto cruz', latex: L`A=\sqrt{${r.c.map(x => L`${fp(x)}^2`).join('+')}}=${fmt(r.par)}` },
    { label: 'Área del triángulo (la mitad)', latex: L`A_{\triangle}=\tfrac12(${fmt(r.par)})=${fmt(r.par / 2)}` },
  ]
}

function areaWords(r: AreaResult): Interpretation[] {
  if (r.par < 1e-12) return [{ tone: 'warn', text: 'El área es 0: los vectores son **paralelos** (o alguno es cero). No encierran ninguna superficie, y si son tres puntos, están alineados.' }]
  const out: Interpretation[] = [
    { tone: 'good', text: `El paralelogramo que forman mide $${fmt(r.par)}$ unidades cuadradas, y el triángulo (la mitad) $${fmt(r.par / 2)}$.` },
  ]
  if (r.is2D) out.push({ tone: 'info', text: r.c[2] > 0 ? 'El determinante es positivo: para ir del primer vector al segundo se gira en sentido **antihorario**.' : 'El determinante es negativo: para ir del primer vector al segundo se gira en sentido **horario**. El área se toma en valor absoluto.' })
  else out.push({ tone: 'info', text: `El vector $${fvec(r.c)}$ es perpendicular a la superficie: es su vector normal.` })
  return out
}

const areaVectores: Formula = {
  id: 'area-vectores',
  name: 'Área entre vectores (paralelogramo y triángulo)',
  category: 'vectores',
  latex: L`A=|\vec a\times\vec b|,\qquad A_{\triangle}=\tfrac12|\vec a\times\vec b|`,
  forms: [
    { label: 'En el plano (2D)', latex: L`A=|a_1b_2-a_2b_1|` },
    { label: 'Con el ángulo', latex: L`A=|\vec a|\,|\vec b|\sin\theta` },
    { label: 'Triángulo con tres puntos', latex: L`A_{\triangle PQR}=\tfrac12\left|\overrightarrow{PQ}\times\overrightarrow{PR}\right|` },
  ],
  summary: 'El área que encierran dos vectores es la magnitud de su producto cruz; la mitad es el área del triángulo.',
  goal: 'Calcular el área de un paralelogramo o de un triángulo conociendo sólo las coordenadas de sus lados o de sus vértices, sin medir alturas.',
  variables: [
    { symbol: L`\vec a,\ \vec b`, meaning: 'Dos lados que salen del mismo vértice' },
    { symbol: 'A', meaning: 'Área del paralelogramo que forman' },
    { symbol: L`A_{\triangle}`, meaning: 'Área del triángulo: la mitad del paralelogramo' },
    { symbol: L`\theta`, meaning: 'Ángulo entre los dos vectores' },
  ],
  whenToUse: [
    'Área de triángulos y paralelogramos dados por coordenadas, en 2D o 3D.',
    'Saber si tres puntos están alineados: lo están si el área es 0.',
    'Calcular áreas de superficies en gráficos 3D y en física (flujo a través de una superficie).',
  ],
  intuition: [
    'El área de un paralelogramo es **base × altura**. Si la base es $\\vec a$, la altura es la parte de $\\vec b$ perpendicular a ella: $|\\vec b|\\sin\\theta$.',
    'Eso es exactamente la magnitud del producto cruz, $|\\vec a||\\vec b|\\sin\\theta$. El producto cruz “calcula la altura” por ti, sin medir ángulos.',
    'Cualquier triángulo es medio paralelogramo (córtalo por la diagonal), por eso su área es la mitad.',
    'En 2D el producto cruz sólo tiene componente $z$, que es el determinante $a_1b_2 - a_2b_1$. Su **signo** dice hacia dónde gira $\\vec b$ respecto a $\\vec a$.',
  ],
  derivation: {
    steps: [
      { label: 'Área = base × altura', latex: L`A=|\vec a|\cdot h` },
      { label: 'La altura es la componente de b perpendicular a a', latex: L`h=|\vec b|\sin\theta` },
      { label: 'Ésa es la magnitud del producto cruz', latex: L`A=|\vec a|\,|\vec b|\sin\theta=|\vec a\times\vec b|` },
      { label: 'En 2D, con z = 0', latex: L`\langle a_1,a_2,0\rangle\times\langle b_1,b_2,0\rangle=\langle0,\,0,\,a_1b_2-a_2b_1\rangle` },
    ],
  },
  calculators: [
    calc<AreaResult>({
      id: 'vectores',
      label: 'Con dos vectores',
      example: 'los lados $\\vec a = \\langle 4, 1\\rangle$ y $\\vec b = \\langle 1, 3\\rangle$. Cambia a 3D para vectores en el espacio.',
      inputs: [
        { kind: 'vector', id: 'a', label: 'Vector a', symbol: L`\vec a`, default: [4, 1] },
        { kind: 'vector', id: 'b', label: 'Vector b', symbol: L`\vec b`, default: [1, 3] },
      ],
      compute: (v) => areaOf(vec(v, 'a'), vec(v, 'b')),
      steps: (_v, r) => areaSteps(r, [L`\vec a`, L`\vec b`]),
      answer: (_v, r) => L`A=${fmt(r.par)},\qquad A_{\triangle}=${fmt(r.par / 2)}`,
      extras: (_v, r) => [{ label: r.is2D ? 'Determinante' : 'a × b', latex: r.is2D ? fmt(r.c[2]) : fvec(r.c) }],
      interpret: (_v, r) => areaWords(r),
      visual: (v) => ({ type: 'vectors3d', mode: 'area', a: vec(v, 'a'), b: vec(v, 'b'), view: vec(v, 'a').length === 2 ? 'top' : undefined }),
    }),
    calc<AreaResult & { P: number[] }>({
      id: 'puntos',
      label: 'Triángulo con tres puntos',
      example: 'el triángulo con vértices $P(1, 1)$, $Q(5, 2)$ y $R(2, 5)$.',
      inputs: [
        { kind: 'vector', id: 'P', label: 'Punto P', symbol: 'P', default: [1, 1] },
        { kind: 'vector', id: 'Q', label: 'Punto Q', symbol: 'Q', default: [5, 2] },
        { kind: 'vector', id: 'R', label: 'Punto R', symbol: 'R', default: [2, 5] },
      ],
      compute: (v) => {
        const P = vec(v, 'P'), Q = vec(v, 'Q'), Rr = vec(v, 'R')
        sameDims(P, Q); sameDims(P, Rr)
        return { ...areaOf(Q.map((q, i) => q - P[i]), Rr.map((x, i) => x - P[i])), P }
      },
      steps: (_v, r) => [
        { label: 'Vectores que salen de P', latex: L`\overrightarrow{PQ}=Q-P=${fvec(r.a)},\qquad \overrightarrow{PR}=R-P=${fvec(r.b)}` },
        ...areaSteps(r, [L`\overrightarrow{PQ}`, L`\overrightarrow{PR}`]),
      ],
      answer: (_v, r) => L`A_{\triangle PQR}=${fmt(r.par / 2)}`,
      extras: (_v, r) => [{ label: 'Paralelogramo', latex: fmt(r.par) }],
      interpret: (_v, r) => areaWords(r),
      visual: (_v, r) => ({ type: 'vectors3d', mode: 'area', a: r.a, b: r.b, origin: r.P, view: r.is2D ? 'top' : undefined }),
    }),
  ],
  commonMistakes: [
    'Olvidar el $\\tfrac12$ cuando piden el área del **triángulo**.',
    'Dejar el determinante negativo: el área siempre es positiva, toma el valor absoluto.',
    'Usar el producto punto: ése da $|\\vec a||\\vec b|\\cos\\theta$ (qué tan alineados están), no el área.',
    'Restar al revés las coordenadas: $\\overrightarrow{PQ} = Q - P$ (punto final menos punto inicial).',
  ],
  related: ['producto-cruz', 'producto-punto', 'distancia-puntos'],
  keywords: ['area entre vectores', 'paralelogramo', 'triangulo', 'determinante', 'tres puntos', 'colineales'],
}

// ─── Ley de cosenos ──────────────────────────────────────────────────────────

const leyCosenos: Formula = {
  id: 'ley-de-cosenos',
  name: 'Ley de cosenos',
  category: 'geometria',
  latex: L`c^2=a^2+b^2-2ab\cos C`,
  forms: [{ label: 'Para encontrar un ángulo', latex: L`\cos C=\frac{a^2+b^2-c^2}{2ab}` }],
  summary: 'Relaciona los tres lados de cualquier triángulo con uno de sus ángulos. Es Pitágoras generalizado.',
  goal: 'Resolver triángulos que **no** son rectángulos: encontrar el tercer lado conociendo dos lados y el ángulo entre ellos, o un ángulo conociendo los tres lados.',
  variables: [
    { symbol: 'a,\\ b', meaning: 'Dos lados del triángulo' },
    { symbol: 'C', meaning: 'Ángulo **entre** los lados $a$ y $b$' },
    { symbol: 'c', meaning: 'Lado opuesto al ángulo $C$' },
  ],
  whenToUse: [
    'Conoces dos lados y el ángulo **entre** ellos (LAL) y quieres el tercer lado.',
    'Conoces los tres lados (LLL) y quieres un ángulo.',
    'Para obtener la magnitud de la suma o resta de dos vectores (por ejemplo, fuerzas que forman un ángulo).',
  ],
  intuition: [
    'Si $C = 90^\\circ$, entonces $\\cos C = 0$ y la fórmula se convierte en Pitágoras: $c^2 = a^2 + b^2$.',
    'El término $-2ab\\cos C$ es la **corrección** por no ser un ángulo recto. Si $C$ es agudo ($\\cos C > 0$), $c$ sale más corto que en Pitágoras. Si es obtuso ($\\cos C < 0$), el lado se “abre” y sale más largo.',
  ],
  derivation: {
    intro: 'Coloca el vértice $C$ en el origen y el lado $a$ sobre el eje $x$.',
    steps: [
      { label: 'Coordenadas de los otros dos vértices', latex: L`B=(a,\,0),\qquad A=(b\cos C,\ b\sin C)` },
      { label: 'c es la distancia entre A y B', latex: L`c^2=(b\cos C-a)^2+(b\sin C)^2` },
      { label: 'Expandimos', latex: L`c^2=b^2\cos^2C-2ab\cos C+a^2+b^2\sin^2C` },
      { label: 'Como $\\sin^2C+\\cos^2C=1$', latex: L`c^2=a^2+b^2-2ab\cos C` },
    ],
  },
  calculators: [
    calc<{ c: number; cos: number }>({
      id: 'lado',
      label: 'Encontrar el lado c',
      inputs: [
        { kind: 'number', id: 'a', label: 'Lado a', symbol: 'a', default: 7 },
        { kind: 'number', id: 'b', label: 'Lado b', symbol: 'b', default: 5 },
        { kind: 'number', id: 'C', label: 'Ángulo C', symbol: 'C', default: 60, unit: '°' },
      ],
      compute: (v) => {
        const a = num(v, 'a'), b = num(v, 'b'), C = num(v, 'C')
        if (a <= 0 || b <= 0) fail('Los lados deben ser positivos.')
        if (C <= 0 || C >= 180) fail('El ángulo de un triángulo debe estar entre 0° y 180°.')
        const cos = Math.cos(toRad(C))
        return { cos, c: Math.sqrt(a * a + b * b - 2 * a * b * cos) }
      },
      steps: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b'), C = num(v, 'C')
        return [
          { label: 'Sustituimos', latex: L`c^2=${fmt(a)}^2+${fmt(b)}^2-2(${fmt(a)})(${fmt(b)})\cos ${fmt(C)}^\circ` },
          { label: 'Evaluamos', latex: L`c^2=${fmt(a * a)}+${fmt(b * b)}-${fmt(2 * a * b)}(${fmt(r.cos)})=${fmt(r.c ** 2)}` },
          { label: 'Sacamos raíz', latex: L`c=\sqrt{${fmt(r.c ** 2)}}=${fmt(r.c)}` },
        ]
      },
      answer: (_v, r) => L`c=${fmt(r.c)}`,
      interpret: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b'), C = num(v, 'C')
        const pyth = Math.sqrt(a * a + b * b)
        return [
          { tone: 'good', text: `El lado opuesto al ángulo de $${fmt(C)}^\\circ$ mide $${fmt(r.c)}$.` },
          {
            tone: 'info',
            text: C === 90 ? 'Con $90^\\circ$ el resultado coincide con Pitágoras.' :
              `Con un ángulo recto mediría $${fmt(pyth)}$. Como el ángulo es ${C < 90 ? 'agudo, el lado queda **más corto**' : 'obtuso, el lado queda **más largo**'}.`,
          },
        ]
      },
    }),
    calc<{ cos: number; deg: number }>({
      id: 'angulo',
      label: 'Encontrar el ángulo C',
      inputs: [
        { kind: 'number', id: 'a', label: 'Lado a', symbol: 'a', default: 7 },
        { kind: 'number', id: 'b', label: 'Lado b', symbol: 'b', default: 5 },
        { kind: 'number', id: 'c', label: 'Lado c', symbol: 'c', default: 6.245 },
      ],
      compute: (v) => {
        const a = num(v, 'a'), b = num(v, 'b'), c = num(v, 'c')
        if (a <= 0 || b <= 0 || c <= 0) fail('Los lados deben ser positivos.')
        if (a + b <= c || a + c <= b || b + c <= a) fail('Esos lados no forman un triángulo: cada lado debe ser menor que la suma de los otros dos.')
        const cos = (a * a + b * b - c * c) / (2 * a * b)
        return { cos, deg: toDeg(Math.acos(cos)) }
      },
      steps: (v, r) => {
        const a = num(v, 'a'), b = num(v, 'b'), c = num(v, 'c')
        return [
          { label: 'Despejamos cos C', latex: L`\cos C=\frac{${fmt(a)}^2+${fmt(b)}^2-${fmt(c)}^2}{2(${fmt(a)})(${fmt(b)})}=\frac{${fmt(a * a + b * b - c * c)}}{${fmt(2 * a * b)}}=${fmt(r.cos)}` },
          { label: 'Ángulo', latex: L`C=\cos^{-1}(${fmt(r.cos)})=${fmt(r.deg, 2)}^\circ` },
        ]
      },
      answer: (_v, r) => L`C=${fmt(r.deg, 2)}^\circ`,
      interpret: (_v, r) => [
        { tone: 'good', text: `El ángulo opuesto al lado $c$ mide $${fmt(r.deg, 2)}^\\circ$, es decir, es un ángulo **${Math.abs(r.deg - 90) < 1e-6 ? 'recto' : r.deg < 90 ? 'agudo' : 'obtuso'}**.` },
      ],
    }),
  ],
  commonMistakes: [
    'Usar un ángulo que **no** está entre los lados $a$ y $b$.',
    'Calcular $a^2+b^2-2ab$ y después multiplicar por $\\cos C$: el coseno sólo multiplica a $2ab$.',
    'Tener la calculadora en radianes.',
  ],
  related: ['producto-punto', 'distancia-puntos'],
  keywords: ['triangulo', 'pitagoras', 'trigonometria', 'resolver triangulos'],
}

export const VECTORES: Formula[] = [productoPunto, productoCruz, areaVectores, distancia, leyCosenos]
