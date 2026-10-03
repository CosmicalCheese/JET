import { calc, fail, num, type Formula, type Interpretation } from '../types'
import { fmt, fp, toDeg, toRad } from '../format'

const L = String.raw
/** Unidad en LaTeX */
const u = (s: string) => L`\,\mathrm{${s}}`

const G = 6.672e-11 // formulario 2.1
const K_COULOMB = 9e9 // formulario 2.1
const g = 9.81

function positive(x: number, name: string) {
  if (!(x > 0)) fail(`$${name}$ debe ser mayor que 0.`)
}

// ═══ Mecánica ════════════════════════════════════════════════════════════════

const mruaPosicion: Formula = {
  id: 'mrua-posicion',
  name: 'MRUA: posición y velocidad',
  category: 'mecanica',
  ref: '2.4',
  latex: L`x=x_0+v_0t+\tfrac12at^2`,
  forms: [
    { label: 'Velocidad', latex: L`v=v_0+at` },
    { label: 'Velocidad media', latex: L`\bar v=\tfrac12(v+v_0)` },
  ],
  summary: 'Dónde está y qué tan rápido va un objeto que acelera de manera constante.',
  goal: 'Predecir la posición y la velocidad de un objeto en cualquier instante cuando su aceleración no cambia (caída libre, un auto que frena parejo, etc.).',
  variables: [
    { symbol: 'x', meaning: 'Posición en el instante $t$', unit: 'm' },
    { symbol: 'x_0', meaning: 'Posición inicial', unit: 'm' },
    { symbol: 'v_0', meaning: 'Velocidad inicial', unit: 'm/s' },
    { symbol: 'a', meaning: 'Aceleración (constante)', unit: 'm/s²' },
    { symbol: 't', meaning: 'Tiempo transcurrido', unit: 's' },
  ],
  whenToUse: [
    'La aceleración es **constante**: caída libre ($a = -9.81\\ \\mathrm{m/s^2}$), frenado uniforme, arranque uniforme.',
    'Movimiento en línea recta (o en cada eje por separado, como en un tiro parabólico).',
  ],
  intuition: [
    'Si no hubiera aceleración, la posición crecería en línea recta: $x_0 + v_0t$. La aceleración agrega $\\tfrac12at^2$, un término que crece con el **cuadrado** del tiempo. Por eso la gráfica $x$–$t$ es una parábola.',
    '¿Por qué $\\tfrac12$? Porque la velocidad cambia de forma pareja de $v_0$ a $v$, así que en promedio el objeto viaja a la velocidad intermedia $\\tfrac12(v_0+v)$.',
  ],
  derivation: {
    steps: [
      { label: 'Aceleración constante: la velocidad crece en línea recta', latex: L`v=v_0+at` },
      { label: 'Con cambio parejo, la velocidad media es el promedio', latex: L`\bar v=\frac{v_0+v}{2}=\frac{v_0+(v_0+at)}{2}=v_0+\tfrac12at` },
      { label: 'Desplazamiento = velocidad media × tiempo', latex: L`x-x_0=\bar v\,t=v_0t+\tfrac12at^2` },
    ],
    outro: 'Visto en una gráfica $v$–$t$: el desplazamiento es el área bajo la recta, un rectángulo ($v_0t$) más un triángulo ($\\tfrac12\\cdot t\\cdot at$).',
  },
  calculators: [
    calc<{ x: number; v: number }>({
      id: 'xt',
      label: 'Posición y velocidad en t',
      example: 'un auto que va a 20 m/s y frena con 4 m/s². Prueba $t = 6$ s para ver qué pasa después de detenerse.',
      inputs: [
        { kind: 'number', id: 'x0', label: 'Posición inicial', symbol: 'x_0', default: 0, unit: 'm' },
        { kind: 'number', id: 'v0', label: 'Velocidad inicial', symbol: 'v_0', default: 20, unit: 'm/s' },
        { kind: 'number', id: 'a', label: 'Aceleración', symbol: 'a', default: -4, unit: 'm/s²' },
        { kind: 'number', id: 't', label: 'Tiempo', symbol: 't', default: 3, unit: 's' },
      ],
      compute: (v) => {
        const t = num(v, 't')
        if (t < 0) fail('El tiempo no puede ser negativo.')
        return { x: num(v, 'x0') + num(v, 'v0') * t + 0.5 * num(v, 'a') * t * t, v: num(v, 'v0') + num(v, 'a') * t }
      },
      steps: (v, r) => {
        const x0 = num(v, 'x0'), v0 = num(v, 'v0'), a = num(v, 'a'), t = num(v, 't')
        return [
          { label: 'Posición', latex: L`x=${fmt(x0)}+${fp(v0)}(${fmt(t)})+\tfrac12${fp(a)}(${fmt(t)})^2=${fmt(x0)}+${fp(v0 * t)}+${fp(0.5 * a * t * t)}=${fmt(r.x)}${u('m')}` },
          { label: 'Velocidad', latex: L`v=${fmt(v0)}+${fp(a)}(${fmt(t)})=${fmt(r.v)}${u('m/s')}` },
        ]
      },
      answer: (_v, r) => L`x=${fmt(r.x)}${u('m')},\qquad v=${fmt(r.v)}${u('m/s')}`,
      interpret: (v, r) => {
        const v0 = num(v, 'v0'), a = num(v, 'a'), t = num(v, 't')
        const out: Interpretation[] = [
          { tone: 'good', text: `A los $${fmt(t)}\\ \\mathrm{s}$ el objeto está en $x = ${fmt(r.x)}\\ \\mathrm{m}$ y se mueve a $${fmt(r.v)}\\ \\mathrm{m/s}$.` },
        ]
        if (a !== 0 && v0 * a < 0) {
          const tStop = -v0 / a
          out.push({
            tone: t > tStop ? 'warn' : 'info',
            text: `La aceleración va en contra del movimiento: la velocidad llega a 0 en $t = ${fmt(tStop)}\\ \\mathrm{s}$.` +
              (t > tStop ? ' Después de ese instante la fórmula supone que el objeto **regresa**. Si en realidad se detiene (un auto que frena), ya no aplica.' : ''),
          })
        }
        if (r.v * v0 > 0 && Math.abs(r.v) < Math.abs(v0)) out.push({ tone: 'info', text: 'Va frenando: la rapidez disminuye.' })
        return out
      },
      visual: (v) => ({ type: 'motion', x0: num(v, 'x0'), v0: num(v, 'v0'), a: num(v, 'a'), t: num(v, 't') }),
    }),
  ],
  commonMistakes: [
    'Mezclar signos: si eliges “arriba” como positivo, la gravedad es $a = -9.81\\ \\mathrm{m/s^2}$.',
    'Usarla cuando la aceleración cambia con el tiempo.',
    'Olvidar elevar $t$ al cuadrado en el último término.',
  ],
  related: ['torricelli', 'segunda-ley-newton'],
  keywords: ['cinematica', 'caida libre', 'aceleracion constante', 'tiro vertical', 'movimiento rectilineo'],
}

const torricelli: Formula = {
  id: 'torricelli',
  name: 'MRUA sin tiempo (ecuación de Torricelli)',
  category: 'mecanica',
  ref: '2.4',
  latex: L`v^2=v_0^2+2a(x-x_0)`,
  summary: 'Relaciona velocidad y distancia recorrida en un movimiento con aceleración constante, sin necesidad de conocer el tiempo.',
  goal: 'Responder preguntas como “¿qué distancia necesita un auto para frenar?” o “¿a qué velocidad llega al suelo?” sin calcular primero el tiempo.',
  variables: [
    { symbol: 'v', meaning: 'Velocidad final', unit: 'm/s' },
    { symbol: 'v_0', meaning: 'Velocidad inicial', unit: 'm/s' },
    { symbol: 'a', meaning: 'Aceleración constante', unit: 'm/s²' },
    { symbol: 'x-x_0', meaning: 'Desplazamiento', unit: 'm' },
  ],
  whenToUse: ['Aceleración constante, cuando el problema no menciona (ni pregunta) el tiempo.'],
  intuition: [
    'La distancia de frenado depende de $v_0^2$: si vas al **doble** de velocidad, necesitas **cuatro veces** más distancia para frenar.',
    'Esta ecuación es la versión cinemática de la conservación de la energía: multiplicada por $\\tfrac12m$ queda $\\tfrac12mv^2 = \\tfrac12mv_0^2 + ma\\,\\Delta x$.',
  ],
  derivation: {
    steps: [
      { label: 'Despejamos t de la velocidad', latex: L`t=\frac{v-v_0}{a}` },
      { label: 'Desplazamiento = velocidad media × tiempo', latex: L`x-x_0=\frac{v+v_0}{2}\cdot\frac{v-v_0}{a}=\frac{v^2-v_0^2}{2a}` },
      { label: 'Despejamos v²', latex: L`v^2=v_0^2+2a(x-x_0)` },
    ],
  },
  calculators: [
    calc<{ v2: number }>({
      id: 'v',
      label: 'Velocidad final',
      example: 'un objeto que cae desde el reposo 20 m.',
      inputs: [
        { kind: 'number', id: 'v0', label: 'Velocidad inicial', symbol: 'v_0', default: 0, unit: 'm/s' },
        { kind: 'number', id: 'a', label: 'Aceleración', symbol: 'a', default: 9.81, unit: 'm/s²' },
        { kind: 'number', id: 'dx', label: 'Desplazamiento', symbol: L`\Delta x`, default: 20, unit: 'm' },
      ],
      compute: (v) => {
        const v2 = num(v, 'v0') ** 2 + 2 * num(v, 'a') * num(v, 'dx')
        if (v2 < 0) fail(`$v^2$ sale negativo ($${fmt(v2)}$): el objeto se detiene antes de recorrer esa distancia.`)
        return { v2 }
      },
      steps: (v, r) => [
        { label: 'Sustituimos', latex: L`v^2=${fp(num(v, 'v0'))}^2+2${fp(num(v, 'a'))}(${fmt(num(v, 'dx'))})=${fmt(r.v2)}` },
        { label: 'Sacamos raíz', latex: L`v=\sqrt{${fmt(r.v2)}}=${fmt(Math.sqrt(r.v2))}${u('m/s')}` },
      ],
      answer: (_v, r) => L`v=${fmt(Math.sqrt(r.v2))}${u('m/s')}`,
      extras: (_v, r) => [{ label: 'En km/h', latex: L`${fmt(Math.sqrt(r.v2) * 3.6, 2)}${u('km/h')}` }],
      interpret: (v, r) => [
        { tone: 'good', text: `Tras recorrer $${fmt(num(v, 'dx'))}\\ \\mathrm{m}$ la rapidez es $${fmt(Math.sqrt(r.v2))}\\ \\mathrm{m/s}$ (unos $${fmt(Math.sqrt(r.v2) * 3.6, 0)}\\ \\mathrm{km/h}$).` },
        { tone: 'info', text: 'La raíz da la **rapidez**. El sentido del movimiento (signo de $v$) lo decides según el problema.' },
      ],
    }),
    calc<{ d: number }>({
      id: 'frenado',
      label: 'Distancia de frenado',
      example: 'un auto a 90 km/h (25 m/s) con buenos frenos.',
      inputs: [
        { kind: 'number', id: 'v0', label: 'Velocidad inicial', symbol: 'v_0', default: 25, unit: 'm/s' },
        { kind: 'number', id: 'decel', label: 'Desaceleración', symbol: '|a|', default: 7, unit: 'm/s²' },
      ],
      compute: (v) => {
        positive(num(v, 'decel'), '|a|')
        return { d: num(v, 'v0') ** 2 / (2 * num(v, 'decel')) }
      },
      steps: (v, r) => [
        { label: 'Al detenerse, v = 0 y a es negativa', latex: L`0=v_0^2-2|a|\,\Delta x\;\Rightarrow\;\Delta x=\frac{v_0^2}{2|a|}` },
        { label: 'Sustituimos', latex: L`\Delta x=\frac{${fp(num(v, 'v0'))}^2}{2(${fmt(num(v, 'decel'))})}=${fmt(r.d)}${u('m')}` },
      ],
      answer: (_v, r) => L`\Delta x=${fmt(r.d)}${u('m')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Yendo a $${fmt(num(v, 'v0'))}\\ \\mathrm{m/s}$ ($${fmt(num(v, 'v0') * 3.6, 0)}$ km/h) necesitas $${fmt(r.d)}\\ \\mathrm{m}$ para detenerte.` },
        { tone: 'warn', text: `Al doble de velocidad necesitarías $${fmt(4 * r.d)}\\ \\mathrm{m}$: **cuatro veces** más, porque la distancia depende de $v_0^2$.` },
      ],
    }),
  ],
  commonMistakes: [
    'Olvidar que al frenar la aceleración es negativa.',
    'Sacar raíz de $v_0^2 + 2a\\Delta x$ término por término.',
  ],
  related: ['mrua-posicion', 'energia-cinetica'],
  keywords: ['frenado', 'distancia de frenado', 'cinematica', 'velocidad final'],
}

const newton: Formula = {
  id: 'segunda-ley-newton',
  name: 'Segunda ley de Newton',
  category: 'mecanica',
  ref: '2.3',
  latex: L`\sum\vec F=m\vec a`,
  forms: [{ label: 'Con el peso', latex: L`\vec F=\left(\frac{W}{g}\right)\vec a,\qquad W=mg` }],
  summary: 'La fuerza neta sobre un objeto es igual a su masa por su aceleración.',
  goal: 'Conectar las **causas** del movimiento (las fuerzas) con sus **efectos** (la aceleración).',
  variables: [
    { symbol: L`\sum\vec F`, meaning: 'Fuerza **neta** (suma de todas las fuerzas)', unit: 'N' },
    { symbol: 'm', meaning: 'Masa: resistencia a cambiar de velocidad', unit: 'kg' },
    { symbol: L`\vec a`, meaning: 'Aceleración', unit: 'm/s²' },
    { symbol: 'W', meaning: 'Peso, $W = mg$', unit: 'N' },
  ],
  whenToUse: [
    'Cualquier problema de dinámica: bloques, poleas, planos inclinados, elevadores.',
    'Para encontrar la aceleración conociendo las fuerzas, o la fuerza necesaria para lograr cierta aceleración.',
  ],
  intuition: [
    'La misma fuerza acelera mucho a un objeto ligero y poco a uno pesado: la masa es **inercia**.',
    'Importa la fuerza **neta**: si empujas un mueble con 100 N y la fricción hace 100 N en contra, la fuerza neta es 0 y no acelera (aunque estés empujando).',
    '$1\\ \\mathrm{N}$ es justamente la fuerza que acelera $1\\ \\mathrm{kg}$ a $1\\ \\mathrm{m/s^2}$.',
  ],
  calculators: [
    calc<{ F: number }>({
      id: 'F',
      label: 'Despejar F',
      example: 'acelerar un auto de 1200 kg a 3 m/s².',
      inputs: [
        { kind: 'number', id: 'm', label: 'Masa', symbol: 'm', default: 1200, unit: 'kg' },
        { kind: 'number', id: 'a', label: 'Aceleración', symbol: 'a', default: 3, unit: 'm/s²' },
      ],
      compute: (v) => { positive(num(v, 'm'), 'm'); return { F: num(v, 'm') * num(v, 'a') } },
      steps: (v, r) => [{ label: 'Multiplicamos', latex: L`F=ma=(${fmt(num(v, 'm'))})(${fmt(num(v, 'a'))})=${fmt(r.F)}${u('N')}` }],
      answer: (_v, r) => L`F=${fmt(r.F)}${u('N')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Se necesita una fuerza **neta** de $${fmt(r.F)}\\ \\mathrm{N}$ para acelerar $${fmt(num(v, 'm'))}\\ \\mathrm{kg}$ a $${fmt(num(v, 'a'))}\\ \\mathrm{m/s^2}$.` },
        { tone: 'info', text: `Como referencia, es $${fmt(r.F / (num(v, 'm') * g), 2)}$ veces el peso del propio objeto ($${fmt(num(v, 'm') * g)}\\ \\mathrm{N}$).` },
      ],
    }),
    calc<{ a: number }>({
      id: 'a',
      label: 'Despejar a',
      inputs: [
        { kind: 'number', id: 'F', label: 'Fuerza neta', symbol: 'F', default: 3600, unit: 'N' },
        { kind: 'number', id: 'm', label: 'Masa', symbol: 'm', default: 1200, unit: 'kg' },
      ],
      compute: (v) => { positive(num(v, 'm'), 'm'); return { a: num(v, 'F') / num(v, 'm') } },
      steps: (v, r) => [
        { label: 'Despejamos', latex: L`a=\frac{F}{m}` },
        { label: 'Sustituimos', latex: L`a=\frac{${fmt(num(v, 'F'))}}{${fmt(num(v, 'm'))}}=${fmt(r.a)}${u('m/s^2')}` },
      ],
      answer: (_v, r) => L`a=${fmt(r.a)}${u('m/s^2')}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `La velocidad cambia $${fmt(Math.abs(r.a))}\\ \\mathrm{m/s}$ cada segundo, es decir, $${fmt(Math.abs(r.a) / g, 2)}\\,g$.` },
      ],
    }),
    calc<{ m: number }>({
      id: 'm',
      label: 'Despejar m',
      inputs: [
        { kind: 'number', id: 'F', label: 'Fuerza neta', symbol: 'F', default: 3600, unit: 'N' },
        { kind: 'number', id: 'a', label: 'Aceleración', symbol: 'a', default: 3, unit: 'm/s²' },
      ],
      compute: (v) => { if (num(v, 'a') === 0) fail('Con $a = 0$ no se puede determinar la masa.'); return { m: num(v, 'F') / num(v, 'a') } },
      steps: (v, r) => [
        { label: 'Despejamos', latex: L`m=\frac{F}{a}` },
        { label: 'Sustituimos', latex: L`m=\frac{${fmt(num(v, 'F'))}}{${fmt(num(v, 'a'))}}=${fmt(r.m)}${u('kg')}` },
      ],
      answer: (_v, r) => L`m=${fmt(r.m)}${u('kg')}`,
      interpret: (_v, r) => [{ tone: r.m > 0 ? 'good' : 'warn', text: r.m > 0 ? `El objeto tiene una masa de $${fmt(r.m)}\\ \\mathrm{kg}$ (pesa $${fmt(r.m * g)}\\ \\mathrm{N}$ en la Tierra).` : 'Masa negativa: revisa los signos, la fuerza y la aceleración deben ir en la misma dirección.' }],
    }),
  ],
  commonMistakes: [
    'Usar una sola fuerza en vez de la fuerza **neta**.',
    'Confundir masa (kg) con peso (N): $W = mg$.',
    'Olvidar que es una ecuación vectorial: se aplica por separado en cada eje.',
  ],
  related: ['mrua-posicion', 'impulso-momento', 'gravitacion-universal'],
  keywords: ['fuerza', 'masa', 'aceleracion', 'dinamica', 'peso', 'f=ma'],
}

const gravitacion: Formula = {
  id: 'gravitacion-universal',
  name: 'Ley de gravitación universal',
  category: 'mecanica',
  ref: '2.3',
  latex: L`F=G\,\frac{mM}{r^2}`,
  summary: 'La fuerza de atracción entre dos masas cualesquiera.',
  goal: 'Calcular con qué fuerza se atraen dos cuerpos por su masa: planetas, satélites, o tú y la Tierra.',
  variables: [
    { symbol: 'F', meaning: 'Fuerza de atracción (igual sobre ambos cuerpos)', unit: 'N' },
    { symbol: 'G', meaning: 'Constante gravitacional, $6.672\\times10^{-11}$', unit: 'N·m²/kg²' },
    { symbol: 'm,\\ M', meaning: 'Masas de los dos cuerpos', unit: 'kg' },
    { symbol: 'r', meaning: 'Distancia entre sus **centros**', unit: 'm' },
  ],
  whenToUse: ['Órbitas, satélites, el peso en otros planetas, mareas.'],
  intuition: [
    '**Ley del inverso del cuadrado**: si duplicas la distancia, la fuerza baja a la cuarta parte. La “influencia” se reparte sobre una esfera cuya área crece como $r^2$.',
    '$G$ es diminuta: entre dos personas la atracción es imperceptible. Sólo se nota cuando una de las masas es enorme, como un planeta.',
    'El peso es un caso particular: $mg = G\\frac{mM_T}{R_T^2}$, de donde sale $g \\approx 9.8\\ \\mathrm{m/s^2}$.',
  ],
  calculators: [
    calc<{ F: number }>({
      id: 'F',
      label: 'Calcular F',
      example: 'la atracción entre la Tierra y la Luna (datos del formulario).',
      inputs: [
        { kind: 'number', id: 'm', label: 'Masa 1', symbol: 'm', default: 7.36e22, unit: 'kg' },
        { kind: 'number', id: 'M', label: 'Masa 2', symbol: 'M', default: 5.976e24, unit: 'kg' },
        { kind: 'number', id: 'r', label: 'Distancia', symbol: 'r', default: 3.84e8, unit: 'm' },
      ],
      compute: (v) => {
        positive(num(v, 'r'), 'r'); positive(num(v, 'm'), 'm'); positive(num(v, 'M'), 'M')
        return { F: (G * num(v, 'm') * num(v, 'M')) / num(v, 'r') ** 2 }
      },
      steps: (v, r) => [
        { label: 'Sustituimos', latex: L`F=(${fmt(G)})\frac{(${fmt(num(v, 'm'))})(${fmt(num(v, 'M'))})}{(${fmt(num(v, 'r'))})^2}` },
        { label: 'Numerador y denominador', latex: L`F=(${fmt(G)})\frac{${fmt(num(v, 'm') * num(v, 'M'))}}{${fmt(num(v, 'r') ** 2)}}=${fmt(r.F)}${u('N')}` },
      ],
      answer: (_v, r) => L`F=${fmt(r.F)}${u('N')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Los cuerpos se atraen con $${fmt(r.F)}\\ \\mathrm{N}$. Ambos sienten la **misma** fuerza (tercera ley de Newton), pero el de menor masa acelera más.` },
        { tone: 'info', text: `Aceleración de cada uno: $a_m = F/m = ${fmt(r.F / num(v, 'm'))}\\ \\mathrm{m/s^2}$ y $a_M = F/M = ${fmt(r.F / num(v, 'M'))}\\ \\mathrm{m/s^2}$.` },
        { tone: 'info', text: `A la mitad de distancia la fuerza sería $${fmt(4 * r.F)}\\ \\mathrm{N}$ (4 veces mayor).` },
      ],
    }),
  ],
  commonMistakes: [
    'Medir $r$ desde la superficie en lugar de desde el centro de los cuerpos.',
    'Olvidar elevar $r$ al cuadrado.',
    'Errores con la notación científica: $(3.84\\times10^8)^2 = 1.47\\times10^{17}$.',
  ],
  related: ['segunda-ley-newton', 'ley-de-coulomb'],
  keywords: ['gravedad', 'newton', 'orbita', 'atraccion', 'inverso del cuadrado'],
}

const impulso: Formula = {
  id: 'impulso-momento',
  name: 'Impulso y cantidad de movimiento',
  category: 'mecanica',
  ref: '2.3.1',
  latex: L`\vec I=\Delta\vec p=m\vec v_f-m\vec v_i`,
  forms: [
    { label: 'Cantidad de movimiento', latex: L`\vec p=m\vec v` },
    { label: 'Fuerza promedio', latex: L`\vec F_{prom}=\frac{\vec I}{\Delta t}` },
  ],
  summary: 'El cambio en la cantidad de movimiento de un objeto es igual al impulso que recibe (fuerza × tiempo).',
  goal: 'Analizar choques, golpes y frenados bruscos: cuánta fuerza actúa cuando la velocidad cambia en muy poco tiempo.',
  variables: [
    { symbol: L`\vec p`, meaning: 'Cantidad de movimiento (momento lineal)', unit: 'kg·m/s' },
    { symbol: L`\vec I`, meaning: 'Impulso', unit: 'N·s' },
    { symbol: L`\Delta t`, meaning: 'Duración del contacto', unit: 's' },
  ],
  whenToUse: [
    'Choques, rebotes, golpes, patadas, bolsas de aire.',
    'Cuando la fuerza es muy grande y muy breve, y es más fácil medir el cambio de velocidad que la fuerza.',
  ],
  intuition: [
    'Para detener un objeto hay que quitarle todo su $\\vec p$. Ese “trabajo” se puede hacer con una fuerza enorme en poco tiempo, o con una fuerza pequeña durante más tiempo.',
    'Por eso las bolsas de aire, los cascos y doblar las rodillas al caer **alargan** $\\Delta t$: el mismo cambio de momento con mucha menos fuerza.',
    'Un rebote cambia más el momento que un frenado: la velocidad no sólo llega a 0, además se invierte.',
  ],
  derivation: {
    steps: [
      { label: 'Segunda ley con aceleración promedio', latex: L`\vec F=m\vec a=m\frac{\vec v_f-\vec v_i}{\Delta t}` },
      { label: 'Multiplicamos por Δt', latex: L`\vec F\,\Delta t=m\vec v_f-m\vec v_i=\Delta\vec p` },
    ],
  },
  calculators: [
    calc<{ pi: number; pf: number; I: number; F: number }>({
      id: 'I',
      label: 'Impulso y fuerza',
      example: 'un balón de 0.45 kg que llega a 12 m/s y sale a 20 m/s en sentido contrario tras una patada de 0.01 s.',
      inputs: [
        { kind: 'number', id: 'm', label: 'Masa', symbol: 'm', default: 0.45, unit: 'kg' },
        { kind: 'number', id: 'vi', label: 'Velocidad inicial', symbol: 'v_i', default: -12, unit: 'm/s' },
        { kind: 'number', id: 'vf', label: 'Velocidad final', symbol: 'v_f', default: 20, unit: 'm/s' },
        { kind: 'number', id: 'dt', label: 'Tiempo de contacto', symbol: L`\Delta t`, default: 0.01, unit: 's' },
      ],
      compute: (v) => {
        positive(num(v, 'm'), 'm'); positive(num(v, 'dt'), '\\Delta t')
        const pi = num(v, 'm') * num(v, 'vi'), pf = num(v, 'm') * num(v, 'vf')
        return { pi, pf, I: pf - pi, F: (pf - pi) / num(v, 'dt') }
      },
      steps: (v, r) => [
        { label: 'Momento inicial', latex: L`p_i=(${fmt(num(v, 'm'))})${fp(num(v, 'vi'))}=${fmt(r.pi)}${u(L`kg\cdot m/s`)}` },
        { label: 'Momento final', latex: L`p_f=(${fmt(num(v, 'm'))})${fp(num(v, 'vf'))}=${fmt(r.pf)}${u(L`kg\cdot m/s`)}` },
        { label: 'Impulso = cambio de momento', latex: L`I=${fmt(r.pf)}-${fp(r.pi)}=${fmt(r.I)}${u(L`N\cdot s`)}` },
        { label: 'Fuerza promedio', latex: L`F=\frac{${fmt(r.I)}}{${fmt(num(v, 'dt'))}}=${fmt(r.F)}${u('N')}` },
      ],
      answer: (_v, r) => L`I=${fmt(r.I)}${u(L`N\cdot s`)},\qquad F_{prom}=${fmt(r.F)}${u('N')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Durante $${fmt(num(v, 'dt'))}\\ \\mathrm{s}$ actúa una fuerza promedio de $${fmt(r.F)}\\ \\mathrm{N}$, unas $${fmt(Math.abs(r.F) / (num(v, 'm') * g), 0)}$ veces el peso del objeto.` },
        ...(num(v, 'vi') * num(v, 'vf') < 0 ? [{ tone: 'info' as const, text: 'La velocidad cambió de sentido (rebote): el cambio de momento es mayor que si sólo se hubiera detenido.' }] : []),
        { tone: 'info', text: `Si el contacto durara el doble ($${fmt(2 * num(v, 'dt'))}\\ \\mathrm{s}$), la fuerza bajaría a la mitad: $${fmt(r.F / 2)}\\ \\mathrm{N}$.` },
      ],
    }),
  ],
  commonMistakes: [
    'Ignorar los signos: en un rebote, $v_i$ y $v_f$ tienen signos opuestos y $\\Delta v$ se **suma**.',
    'Confundir impulso (N·s) con fuerza (N).',
  ],
  related: ['segunda-ley-newton'],
  keywords: ['momento lineal', 'choque', 'colision', 'impetu', 'cantidad de movimiento'],
}

// ═══ Trabajo y energía ═══════════════════════════════════════════════════════

const trabajo: Formula = {
  id: 'trabajo',
  name: 'Trabajo mecánico',
  category: 'energia',
  ref: '2.7',
  latex: L`W=\vec F\cdot\vec d=F\,d\cos\theta`,
  summary: 'La energía que transfiere una fuerza al mover un objeto: sólo cuenta la parte de la fuerza que va en la dirección del movimiento.',
  goal: 'Medir cuánta energía aporta (o quita) una fuerza a un objeto que se desplaza.',
  variables: [
    { symbol: 'W', meaning: 'Trabajo', unit: 'J' },
    { symbol: 'F', meaning: 'Magnitud de la fuerza', unit: 'N' },
    { symbol: 'd', meaning: 'Magnitud del desplazamiento', unit: 'm' },
    { symbol: L`\theta`, meaning: 'Ángulo entre la fuerza y el desplazamiento' },
  ],
  whenToUse: [
    'Fuerza constante a lo largo de un desplazamiento recto.',
    'Para luego aplicar el teorema trabajo-energía: $W_{neto} = \\Delta K$.',
  ],
  intuition: [
    'Es un **producto punto**. Si jalas una maleta con la correa inclinada, sólo la componente horizontal $F\\cos\\theta$ la hace avanzar; la vertical no aporta trabajo.',
    'Una fuerza perpendicular al movimiento ($\\theta = 90^\\circ$) **no hace trabajo**: cargar una mochila mientras caminas en plano no le transfiere energía, aunque te canses.',
    'Si la fuerza va en contra del movimiento (fricción, frenos), el trabajo es **negativo**: le quita energía al objeto.',
  ],
  calculators: [
    calc<{ cos: number; W: number }>({
      id: 'W',
      label: 'Calcular W',
      example: 'jalar una maleta 10 m con 50 N, con la correa inclinada 30°.',
      inputs: [
        { kind: 'number', id: 'F', label: 'Fuerza', symbol: 'F', default: 50, unit: 'N' },
        { kind: 'number', id: 'd', label: 'Desplazamiento', symbol: 'd', default: 10, unit: 'm' },
        { kind: 'number', id: 'theta', label: 'Ángulo', symbol: L`\theta`, default: 30, unit: '°' },
      ],
      compute: (v) => {
        const cos = Math.cos(toRad(num(v, 'theta')))
        return { cos, W: num(v, 'F') * num(v, 'd') * cos }
      },
      steps: (v, r) => [
        { label: 'Componente útil de la fuerza', latex: L`F\cos\theta=(${fmt(num(v, 'F'))})\cos ${fmt(num(v, 'theta'))}^\circ=${fmt(num(v, 'F') * r.cos)}${u('N')}` },
        { label: 'Por la distancia', latex: L`W=(${fmt(num(v, 'F') * r.cos)})(${fmt(num(v, 'd'))})=${fmt(r.W)}${u('J')}` },
      ],
      answer: (_v, r) => L`W=${fmt(r.W)}${u('J')}`,
      interpret: (v, r) => {
        const out: Interpretation[] = []
        if (num(v, 'F') === 0 || num(v, 'd') === 0) out.push({ tone: 'good', text: 'Sin fuerza o sin desplazamiento no hay trabajo: $W = 0$.' })
        else if (Math.abs(r.cos) < 1e-9) out.push({ tone: 'good', text: 'La fuerza es perpendicular al movimiento: **no transfiere energía**.' })
        else if (r.W > 0) out.push({ tone: 'good', text: `La fuerza le **transfiere** $${fmt(r.W)}\\ \\mathrm{J}$ de energía al objeto.` })
        else out.push({ tone: 'good', text: `La fuerza le **quita** $${fmt(-r.W)}\\ \\mathrm{J}$ de energía al objeto (actúa en contra del movimiento).` })
        out.push({ tone: 'info', text: `Sólo se aprovecha el $${fmt(Math.abs(r.cos) * 100, 1)}$% de la fuerza. Aplicada en la misma dirección del movimiento, haría $${fmt(num(v, 'F') * num(v, 'd'))}\\ \\mathrm{J}$.` })
        return out
      },
      visual: (v) => {
        const t = toRad(num(v, 'theta'))
        // sólo importa la dirección de F; la dibujamos con un largo comparable a d
        const len = Math.abs(num(v, 'd')) * 0.8 || 1
        return { type: 'vectors', a: [num(v, 'd'), 0], b: [len * Math.cos(t), len * Math.sin(t)] }
      },
    }),
  ],
  commonMistakes: [
    'Usar el ángulo con la horizontal cuando el desplazamiento no es horizontal: $\\theta$ es el ángulo **entre** la fuerza y el desplazamiento.',
    'Usar $\\sin\\theta$ en lugar de $\\cos\\theta$.',
    'Pensar que sostener algo sin moverlo es trabajo: con $d = 0$, $W = 0$.',
  ],
  related: ['producto-punto', 'energia-cinetica'],
  keywords: ['trabajo', 'joule', 'fuerza por distancia', 'energia'],
}

const energiaCinetica: Formula = {
  id: 'energia-cinetica',
  name: 'Energía cinética y teorema trabajo-energía',
  category: 'energia',
  ref: '2.7',
  latex: L`K=\tfrac12mv^2`,
  forms: [{ label: 'Teorema trabajo-energía', latex: L`W_{neto}=\Delta K=K_f-K_i` }],
  summary: 'La energía que tiene un objeto por estar en movimiento.',
  goal: 'Cuantificar cuánta energía “guarda” un objeto por moverse, y por lo tanto cuánto trabajo hace falta para acelerarlo o detenerlo.',
  variables: [
    { symbol: 'K', meaning: 'Energía cinética', unit: 'J' },
    { symbol: 'm', meaning: 'Masa', unit: 'kg' },
    { symbol: 'v', meaning: 'Rapidez', unit: 'm/s' },
  ],
  whenToUse: [
    'Choques, frenado, rendimiento de vehículos y proyectiles.',
    'Problemas donde es más fácil razonar con energía que con fuerzas y tiempos.',
  ],
  intuition: [
    'La energía crece con el **cuadrado** de la velocidad: un auto a 100 km/h tiene **4 veces** la energía que a 50 km/h. Eso explica por qué los choques a alta velocidad son mucho más graves.',
    'No depende de la dirección: $v^2$ siempre es positivo, así que la energía cinética nunca es negativa.',
  ],
  derivation: {
    intro: 'Sale de combinar la segunda ley de Newton con la ecuación de Torricelli, sin cálculo.',
    steps: [
      { label: 'Trabajo de una fuerza neta constante', latex: L`W=F\,\Delta x=ma\,\Delta x` },
      { label: 'Torricelli', latex: L`v^2=v_0^2+2a\Delta x\;\Rightarrow\;a\,\Delta x=\frac{v^2-v_0^2}{2}` },
      { label: 'Sustituimos', latex: L`W=m\cdot\frac{v^2-v_0^2}{2}=\tfrac12mv^2-\tfrac12mv_0^2` },
    ],
    outro: 'La cantidad $\\tfrac12mv^2$ aparece de forma natural: eso es lo que llamamos energía cinética.',
  },
  calculators: [
    calc<{ K: number }>({
      id: 'K',
      label: 'Calcular K',
      example: 'un auto de 1000 kg a 100 km/h (27.78 m/s).',
      inputs: [
        { kind: 'number', id: 'm', label: 'Masa', symbol: 'm', default: 1000, unit: 'kg' },
        { kind: 'number', id: 'v', label: 'Rapidez', symbol: 'v', default: 27.78, unit: 'm/s' },
      ],
      compute: (v) => { positive(num(v, 'm'), 'm'); return { K: 0.5 * num(v, 'm') * num(v, 'v') ** 2 } },
      steps: (v, r) => [
        { label: 'Elevamos la velocidad al cuadrado', latex: L`v^2=${fp(num(v, 'v'))}^2=${fmt(num(v, 'v') ** 2)}` },
        { label: 'Multiplicamos', latex: L`K=\tfrac12(${fmt(num(v, 'm'))})(${fmt(num(v, 'v') ** 2)})=${fmt(r.K)}${u('J')}` },
      ],
      answer: (_v, r) => L`K=${fmt(r.K)}${u('J')}`,
      extras: (_v, r) => [{ label: 'En kJ', latex: L`${fmt(r.K / 1000)}${u('kJ')}` }],
      interpret: (v, r) => [
        { tone: 'good', text: `Para detener el objeto hay que quitarle $${fmt(r.K)}\\ \\mathrm{J}$ (por ejemplo, con el trabajo negativo de los frenos).` },
        { tone: 'info', text: `Al doble de velocidad ($${fmt(2 * num(v, 'v'))}\\ \\mathrm{m/s}$) tendría $${fmt(4 * r.K)}\\ \\mathrm{J}$: cuatro veces más.` },
        { tone: 'info', text: `Equivale a la energía potencial de subirlo $${fmt(r.K / (num(v, 'm') * g))}\\ \\mathrm{m}$ de altura.` },
      ],
    }),
  ],
  commonMistakes: [
    'Olvidar el $\\tfrac12$ o no elevar $v$ al cuadrado.',
    'Usar km/h: convierte a m/s dividiendo entre 3.6.',
  ],
  related: ['trabajo', 'energia-potencial', 'torricelli'],
  keywords: ['energia cinetica', 'movimiento', 'trabajo energia', 'joule'],
}

const energiaPotencial: Formula = {
  id: 'energia-potencial',
  name: 'Energía potencial gravitacional',
  category: 'energia',
  ref: '2.7',
  latex: L`U=mgy`,
  forms: [{ label: 'Conservación de la energía (sin fricción)', latex: L`\tfrac12mv_i^2+mgy_i=\tfrac12mv_f^2+mgy_f` }],
  summary: 'La energía almacenada por estar a cierta altura; se convierte en movimiento al caer.',
  goal: 'Medir cuánta energía “guarda” un objeto por su altura y predecir su velocidad al caer usando conservación de la energía.',
  variables: [
    { symbol: 'U', meaning: 'Energía potencial', unit: 'J' },
    { symbol: 'm', meaning: 'Masa', unit: 'kg' },
    { symbol: 'g', meaning: 'Aceleración de la gravedad, $9.81$', unit: 'm/s²' },
    { symbol: 'y', meaning: 'Altura sobre un nivel de referencia que tú eliges', unit: 'm' },
  ],
  whenToUse: ['Caídas, montañas rusas, péndulos, presas hidroeléctricas.'],
  intuition: [
    'Subir un objeto requiere trabajo contra la gravedad ($F = mg$ a lo largo de $y$). Ese trabajo no se pierde: queda **almacenado** y se recupera al caer.',
    'Sólo importan las **diferencias** de altura: el nivel $y = 0$ lo eliges tú (el piso, la mesa…), y el resultado físico no cambia.',
    'Al caer sin fricción, lo que pierde de $U$ lo gana en $K$: $mgh = \\tfrac12mv^2$. La masa se cancela, y por eso todos los objetos caen igual en el vacío.',
  ],
  calculators: [
    calc<{ U: number; vf: number }>({
      id: 'U',
      label: 'Calcular U y velocidad de caída',
      example: 'una maceta de 2 kg en un quinto piso (15 m).',
      inputs: [
        { kind: 'number', id: 'm', label: 'Masa', symbol: 'm', default: 2, unit: 'kg' },
        { kind: 'number', id: 'y', label: 'Altura', symbol: 'y', default: 15, unit: 'm' },
      ],
      compute: (v) => {
        positive(num(v, 'm'), 'm')
        const U = num(v, 'm') * g * num(v, 'y')
        return { U, vf: Math.sqrt(2 * g * Math.max(0, num(v, 'y'))) }
      },
      steps: (v, r) => [
        { label: 'Energía potencial', latex: L`U=(${fmt(num(v, 'm'))})(9.81)(${fmt(num(v, 'y'))})=${fmt(r.U)}${u('J')}` },
        { label: 'Si cae, toda U se vuelve K', latex: L`mgy=\tfrac12mv^2\;\Rightarrow\;v=\sqrt{2gy}=\sqrt{2(9.81)(${fmt(num(v, 'y'))})}=${fmt(r.vf)}${u('m/s')}` },
      ],
      answer: (_v, r) => L`U=${fmt(r.U)}${u('J')}`,
      extras: (_v, r) => [{ label: 'Velocidad al llegar a y = 0', latex: L`v=${fmt(r.vf)}${u('m/s')}` }],
      interpret: (v, r) => num(v, 'y') < 0
        ? [{ tone: 'info', text: 'Altura negativa: el objeto está **debajo** de tu nivel de referencia, así que su energía potencial es negativa respecto a él.' }]
        : [
            { tone: 'good', text: `A $${fmt(num(v, 'y'))}\\ \\mathrm{m}$ de altura el objeto almacena $${fmt(r.U)}\\ \\mathrm{J}$.` },
            { tone: 'info', text: `Si cae libremente llega a $y = 0$ con $${fmt(r.vf)}\\ \\mathrm{m/s}$ ($${fmt(r.vf * 3.6, 0)}$ km/h). Esa velocidad **no depende de la masa**.` },
          ],
    }),
  ],
  commonMistakes: [
    'Usar la masa en gramos.',
    'Cambiar el nivel de referencia a mitad del problema.',
    'Aplicar la conservación cuando hay fricción importante.',
  ],
  related: ['energia-cinetica', 'trabajo'],
  keywords: ['potencial', 'altura', 'conservacion de la energia', 'caida'],
}

// ═══ Electricidad ════════════════════════════════════════════════════════════

const coulomb: Formula = {
  id: 'ley-de-coulomb',
  name: 'Ley de Coulomb',
  category: 'electricidad',
  ref: '2.8',
  latex: L`F=k\,\frac{|q_1q_2|}{r^2}`,
  summary: 'La fuerza eléctrica entre dos cargas puntuales.',
  goal: 'Calcular con qué fuerza se atraen o repelen dos cargas eléctricas.',
  variables: [
    { symbol: 'F', meaning: 'Magnitud de la fuerza eléctrica', unit: 'N' },
    { symbol: 'k', meaning: 'Constante de Coulomb, $9\\times10^{9}$', unit: 'N·m²/C²' },
    { symbol: 'q_1,\\ q_2', meaning: 'Cargas (con signo)', unit: 'C' },
    { symbol: 'r', meaning: 'Distancia entre las cargas', unit: 'm' },
  ],
  whenToUse: ['Fuerzas entre cargas puntuales o esferas cargadas, en electrostática.'],
  intuition: [
    'Tiene la **misma forma** que la gravitación universal (inverso del cuadrado), pero con dos diferencias: hay cargas negativas, así que puede **repeler**, y $k$ es enorme comparada con $G$.',
    'Cargas del mismo signo se repelen y de signo opuesto se atraen. El valor absoluto da la magnitud; el signo del producto $q_1q_2$ da el tipo de fuerza.',
  ],
  calculators: [
    calc<{ F: number; prod: number }>({
      id: 'F',
      label: 'Calcular F',
      example: 'dos cargas de $2\\ \\mu\\mathrm{C}$ y $-3\\ \\mu\\mathrm{C}$ separadas 5 cm.',
      inputs: [
        { kind: 'number', id: 'q1', label: 'Carga 1', symbol: 'q_1', default: 2e-6, unit: 'C' },
        { kind: 'number', id: 'q2', label: 'Carga 2', symbol: 'q_2', default: -3e-6, unit: 'C' },
        { kind: 'number', id: 'r', label: 'Distancia', symbol: 'r', default: 0.05, unit: 'm' },
      ],
      compute: (v) => {
        positive(num(v, 'r'), 'r')
        const prod = num(v, 'q1') * num(v, 'q2')
        return { prod, F: (K_COULOMB * Math.abs(prod)) / num(v, 'r') ** 2 }
      },
      steps: (v, r) => [
        { label: 'Producto de las cargas', latex: L`q_1q_2=(${fmt(num(v, 'q1'))})(${fmt(num(v, 'q2'))})=${fmt(r.prod)}${u('C^2')}` },
        { label: 'Sustituimos', latex: L`F=(9\times10^{9})\frac{${fmt(Math.abs(r.prod))}}{(${fmt(num(v, 'r'))})^2}=${fmt(r.F)}${u('N')}` },
      ],
      answer: (_v, r) => L`F=${fmt(r.F)}${u('N')}`,
      interpret: (v, r) => [
        r.prod === 0
          ? { tone: 'info', text: 'Una de las cargas es 0: no hay fuerza eléctrica.' }
          : { tone: 'good', text: `Las cargas se **${r.prod < 0 ? 'atraen' : 'repelen'}** (${r.prod < 0 ? 'signos opuestos' : 'mismo signo'}) con una fuerza de $${fmt(r.F)}\\ \\mathrm{N}$.` },
        { tone: 'info', text: `Es como el peso de $${fmt(r.F / g)}\\ \\mathrm{kg}$. Al doble de distancia ($${fmt(2 * num(v, 'r'))}\\ \\mathrm{m}$) sería $${fmt(r.F / 4)}\\ \\mathrm{N}$.` },
      ],
    }),
  ],
  commonMistakes: [
    'Olvidar convertir microcoulombs: $1\\ \\mu\\mathrm{C} = 10^{-6}\\ \\mathrm{C}$.',
    'Usar la distancia en cm.',
    'Interpretar el signo de $F$ como dirección sin considerar dónde están las cargas.',
  ],
  related: ['gravitacion-universal', 'ley-de-ohm'],
  keywords: ['carga', 'electrostatica', 'fuerza electrica', 'coulomb'],
}

const ohm: Formula = {
  id: 'ley-de-ohm',
  name: 'Ley de Ohm',
  category: 'electricidad',
  ref: '2.9.1',
  latex: L`R=\frac{V}{I}\qquad V=IR`,
  forms: [{ label: 'Resistencia de un conductor', latex: L`R=\rho\frac{l}{A}` }],
  summary: 'Relación entre el voltaje aplicado, la corriente que circula y la resistencia de un conductor.',
  goal: 'Saber cuánta corriente pasará por un componente con cierto voltaje, o qué resistencia se necesita para limitarla.',
  variables: [
    { symbol: 'V', meaning: 'Voltaje (diferencia de potencial): el “empuje”', unit: 'V' },
    { symbol: 'I', meaning: 'Corriente: cuánta carga pasa por segundo', unit: 'A' },
    { symbol: 'R', meaning: 'Resistencia: qué tanto se opone al paso', unit: 'Ω' },
  ],
  whenToUse: ['Circuitos con resistencias y calentadores.', 'Elegir la resistencia en serie de un LED: $R = (V - V_f)/I$, donde $V_f \\approx 2\\ \\mathrm{V}$ es el voltaje que “consume” el LED.'],
  intuition: [
    'La analogía clásica es una tubería: el voltaje es la **presión**, la corriente es el **caudal** y la resistencia es qué tan **estrecho** es el tubo.',
    'Con el mismo voltaje, el doble de resistencia deja pasar la mitad de corriente.',
  ],
  calculators: [
    calc<{ I: number }>({
      id: 'I',
      label: 'Despejar I',
      example: 'una resistencia de 220 Ω conectada a 12 V.',
      inputs: [
        { kind: 'number', id: 'V', label: 'Voltaje', symbol: 'V', default: 12, unit: 'V' },
        { kind: 'number', id: 'R', label: 'Resistencia', symbol: 'R', default: 220, unit: 'Ω' },
      ],
      compute: (v) => { positive(num(v, 'R'), 'R'); return { I: num(v, 'V') / num(v, 'R') } },
      steps: (v, r) => [
        { label: 'Despejamos', latex: L`I=\frac{V}{R}` },
        { label: 'Sustituimos', latex: L`I=\frac{${fmt(num(v, 'V'))}}{${fmt(num(v, 'R'))}}=${fmt(r.I)}${u('A')}` },
      ],
      answer: (_v, r) => L`I=${fmt(r.I)}${u('A')}`,
      extras: (_v, r) => [{ label: 'En mA', latex: L`${fmt(r.I * 1000)}${u('mA')}` }],
      interpret: (v, r) => [
        { tone: 'good', text: `Con $${fmt(num(v, 'V'))}\\ \\mathrm{V}$ y $${fmt(num(v, 'R'))}\\ \\Omega$ circulan $${fmt(r.I * 1000)}\\ \\mathrm{mA}$.` },
        { tone: 'info', text: `El componente disipa $P = VI = ${fmt(num(v, 'V') * r.I)}\\ \\mathrm{W}$ como calor; revisa que soporte esa potencia.` },
      ],
    }),
    calc<{ V: number }>({
      id: 'V',
      label: 'Despejar V',
      inputs: [
        { kind: 'number', id: 'I', label: 'Corriente', symbol: 'I', default: 0.02, unit: 'A' },
        { kind: 'number', id: 'R', label: 'Resistencia', symbol: 'R', default: 220, unit: 'Ω' },
      ],
      compute: (v) => ({ V: num(v, 'I') * num(v, 'R') }),
      steps: (v, r) => [{ label: 'Multiplicamos', latex: L`V=IR=(${fmt(num(v, 'I'))})(${fmt(num(v, 'R'))})=${fmt(r.V)}${u('V')}` }],
      answer: (_v, r) => L`V=${fmt(r.V)}${u('V')}`,
      interpret: (v, r) => [{ tone: 'good', text: `Para que pasen $${fmt(num(v, 'I'))}\\ \\mathrm{A}$ por $${fmt(num(v, 'R'))}\\ \\Omega$ se necesitan $${fmt(r.V)}\\ \\mathrm{V}$. Ésa es también la “caída de voltaje” en la resistencia.` }],
    }),
    calc<{ R: number }>({
      id: 'R',
      label: 'Despejar R',
      inputs: [
        { kind: 'number', id: 'V', label: 'Voltaje', symbol: 'V', default: 12, unit: 'V' },
        { kind: 'number', id: 'I', label: 'Corriente', symbol: 'I', default: 0.02, unit: 'A' },
      ],
      compute: (v) => { if (num(v, 'I') === 0) fail('Con $I = 0$ la resistencia sería infinita (circuito abierto).'); return { R: num(v, 'V') / num(v, 'I') } },
      steps: (v, r) => [
        { label: 'Despejamos', latex: L`R=\frac{V}{I}` },
        { label: 'Sustituimos', latex: L`R=\frac{${fmt(num(v, 'V'))}}{${fmt(num(v, 'I'))}}=${fmt(r.R)}${u(L`\Omega`)}` },
      ],
      answer: (_v, r) => L`R=${fmt(r.R)}${u(L`\Omega`)}`,
      interpret: (v, r) => [{ tone: 'good', text: `Se necesita una resistencia de $${fmt(r.R)}\\ \\Omega$ para limitar la corriente a $${fmt(num(v, 'I'))}\\ \\mathrm{A}$ con $${fmt(num(v, 'V'))}\\ \\mathrm{V}$.` }],
    }),
  ],
  commonMistakes: [
    'Usar miliamperes sin convertir: $20\\ \\mathrm{mA} = 0.02\\ \\mathrm{A}$.',
    'Aplicarla directamente a componentes no óhmicos (LEDs, diodos, focos incandescentes), cuya resistencia cambia con el voltaje o la temperatura.',
  ],
  related: ['potencia-electrica'],
  keywords: ['voltaje', 'corriente', 'resistencia', 'circuito', 'ohm'],
}

const potenciaElectrica: Formula = {
  id: 'potencia-electrica',
  name: 'Potencia eléctrica',
  category: 'electricidad',
  ref: '2.9.1',
  latex: L`P=IV=I^2R=\frac{V^2}{R}`,
  summary: 'La rapidez con que un componente eléctrico convierte energía (en calor, luz o movimiento).',
  goal: 'Saber cuánta energía por segundo consume o disipa un aparato, y con ello estimar su costo o su calentamiento.',
  variables: [
    { symbol: 'P', meaning: 'Potencia', unit: 'W' },
    { symbol: 'I', meaning: 'Corriente', unit: 'A' },
    { symbol: 'V', meaning: 'Voltaje', unit: 'V' },
    { symbol: 'R', meaning: 'Resistencia', unit: 'Ω' },
  ],
  whenToUse: ['Consumo de aparatos, dimensionar resistencias y cables, recibos de luz (kWh).'],
  intuition: [
    'Voltaje es energía por unidad de carga, y corriente es carga por segundo. Su producto es **energía por segundo**: potencia.',
    'Las tres formas son equivalentes gracias a la ley de Ohm. Usa la que tenga los datos que conoces.',
  ],
  derivation: {
    steps: [
      { label: 'Definición', latex: L`P=\frac{\text{energía}}{\text{tiempo}}=\frac{\text{energía}}{\text{carga}}\cdot\frac{\text{carga}}{\text{tiempo}}=V\cdot I` },
      { label: 'Con V = IR', latex: L`P=I(IR)=I^2R` },
      { label: 'Con I = V/R', latex: L`P=\frac{V}{R}\cdot V=\frac{V^2}{R}` },
    ],
  },
  calculators: [
    calc<{ I: number; P: number }>({
      id: 'PVR',
      label: 'Con V y R',
      example: 'un calentador eléctrico de 12 Ω conectado a 127 V (la red doméstica en México).',
      inputs: [
        { kind: 'number', id: 'V', label: 'Voltaje', symbol: 'V', default: 127, unit: 'V' },
        { kind: 'number', id: 'R', label: 'Resistencia', symbol: 'R', default: 12, unit: 'Ω' },
        { kind: 'number', id: 'h', label: 'Horas de uso al día', symbol: 't', default: 2, unit: 'h' },
      ],
      compute: (v) => {
        positive(num(v, 'R'), 'R')
        return { I: num(v, 'V') / num(v, 'R'), P: num(v, 'V') ** 2 / num(v, 'R') }
      },
      steps: (v, r) => [
        { label: 'Potencia', latex: L`P=\frac{V^2}{R}=\frac{(${fmt(num(v, 'V'))})^2}{${fmt(num(v, 'R'))}}=${fmt(r.P)}${u('W')}` },
        { label: 'Corriente (comprobación)', latex: L`I=\frac{V}{R}=${fmt(r.I)}${u('A')},\qquad IV=${fmt(r.I * num(v, 'V'))}${u('W')}` },
        { label: 'Energía consumida al día', latex: L`E=Pt=(${fmt(r.P / 1000)}${u('kW')})(${fmt(num(v, 'h'))}${u('h')})=${fmt((r.P / 1000) * num(v, 'h'))}${u('kWh')}` },
      ],
      answer: (_v, r) => L`P=${fmt(r.P)}${u('W')}`,
      extras: (v, r) => [
        { label: 'Corriente', latex: L`I=${fmt(r.I)}${u('A')}` },
        { label: 'Al mes', latex: L`${fmt((r.P / 1000) * num(v, 'h') * 30)}${u('kWh')}` },
      ],
      interpret: (v, r) => [
        { tone: 'good', text: `El aparato convierte $${fmt(r.P)}\\ \\mathrm{J}$ de energía eléctrica cada segundo (en calor, luz, etc.).` },
        { tone: 'info', text: `Usado $${fmt(num(v, 'h'))}$ h al día consume unos $${fmt((r.P / 1000) * num(v, 'h') * 30, 1)}\\ \\mathrm{kWh}$ al mes, que es la unidad que cobra el recibo de luz.` },
        ...(r.I > 15 ? [{ tone: 'warn' as const, text: `Una corriente de $${fmt(r.I)}\\ \\mathrm{A}$ es alta para un circuito doméstico típico: requiere un cable y un interruptor adecuados.` }] : []),
      ],
    }),
  ],
  commonMistakes: [
    'Confundir potencia (W) con energía (J o kWh): la energía es potencia por tiempo.',
    'Usar $I^2R$ con la $R$ de otro componente del circuito.',
  ],
  related: ['ley-de-ohm'],
  keywords: ['watts', 'consumo', 'kwh', 'energia electrica', 'potencia'],
}

// ═══ Termodinámica ═══════════════════════════════════════════════════════════

const calor: Formula = {
  id: 'calor-sensible',
  name: 'Ecuación de calor',
  category: 'termodinamica',
  ref: '2.11',
  latex: L`Q=mc_p\Delta T`,
  summary: 'El calor necesario para cambiar la temperatura de una sustancia (sin cambiar de fase).',
  goal: 'Calcular cuánta energía hay que dar o quitar para calentar o enfriar algo cierta cantidad de grados.',
  variables: [
    { symbol: 'Q', meaning: 'Calor transferido (positivo si entra)', unit: 'J' },
    { symbol: 'm', meaning: 'Masa', unit: 'kg' },
    { symbol: 'c_p', meaning: 'Calor específico: energía para subir 1 kg en 1 °C', unit: 'J/(kg·K)' },
    { symbol: L`\Delta T`, meaning: 'Cambio de temperatura, $T_f - T_i$', unit: '°C o K' },
  ],
  whenToUse: [
    'Calentar o enfriar sólidos, líquidos o gases sin que cambien de estado. En gases el calor específico depende del proceso: $c_p$ a presión constante, $c_v$ a volumen constante.',
    'Problemas de calorimetría (mezclas que alcanzan el equilibrio).',
  ],
  intuition: [
    'El calor específico es la “inercia térmica”. El agua tiene un valor altísimo ($4186$), así que tarda en calentarse y en enfriarse. Por eso regula el clima de las costas.',
    'Un $\\Delta T$ vale lo mismo en °C que en K, porque las dos escalas tienen grados del mismo tamaño.',
  ],
  calculators: [
    calc<{ dT: number; Q: number }>({
      id: 'Q',
      label: 'Calcular Q',
      example: 'calentar 2 kg de agua de 20 °C a 80 °C.',
      inputs: [
        { kind: 'number', id: 'm', label: 'Masa', symbol: 'm', default: 2, unit: 'kg' },
        { kind: 'number', id: 'c', label: 'Calor específico', symbol: 'c_p', default: 4186, unit: 'J/(kg·K)' },
        { kind: 'number', id: 'Ti', label: 'Temp. inicial', symbol: 'T_i', default: 20, unit: '°C' },
        { kind: 'number', id: 'Tf', label: 'Temp. final', symbol: 'T_f', default: 80, unit: '°C' },
      ],
      compute: (v) => {
        positive(num(v, 'm'), 'm'); positive(num(v, 'c'), 'c_p')
        const dT = num(v, 'Tf') - num(v, 'Ti')
        return { dT, Q: num(v, 'm') * num(v, 'c') * dT }
      },
      steps: (v, r) => [
        { label: 'Cambio de temperatura', latex: L`\Delta T=${fmt(num(v, 'Tf'))}-${fp(num(v, 'Ti'))}=${fmt(r.dT)}^\circ\mathrm{C}` },
        { label: 'Sustituimos', latex: L`Q=(${fmt(num(v, 'm'))})(${fmt(num(v, 'c'))})(${fmt(r.dT)})=${fmt(r.Q)}${u('J')}` },
      ],
      answer: (_v, r) => L`Q=${fmt(r.Q)}${u('J')}`,
      extras: (_v, r) => [
        { label: 'En kJ', latex: L`${fmt(r.Q / 1000)}${u('kJ')}` },
        { label: 'En kcal', latex: L`${fmt(r.Q / 4186.8)}${u('kcal')}` },
      ],
      interpret: (_v, r) => [
        r.Q >= 0
          ? { tone: 'good', text: `Hay que **suministrar** $${fmt(r.Q / 1000)}\\ \\mathrm{kJ}$ de calor.` }
          : { tone: 'good', text: `Hay que **extraer** $${fmt(-r.Q / 1000)}\\ \\mathrm{kJ}$ de calor (el objeto se enfría).` },
        { tone: 'info', text: `Un calentador de 1500 W tardaría unos $${fmt(Math.abs(r.Q) / 1500 / 60, 1)}$ minutos (sin pérdidas).` },
        { tone: 'warn', text: 'Si la temperatura cruza un cambio de fase (como 100 °C para el agua), hay que sumar el calor latente: esta fórmula sola no basta.' },
      ],
    }),
  ],
  commonMistakes: [
    'Usar gramos con un $c_p$ en J/(kg·K).',
    'Incluir un cambio de fase sin agregar el calor latente.',
    'Restar al revés: $\\Delta T = T_f - T_i$.',
  ],
  related: ['gases-ideales', 'eficiencia-carnot'],
  keywords: ['calor especifico', 'calorimetria', 'temperatura', 'energia termica'],
}

const gasesIdeales: Formula = {
  id: 'gases-ideales',
  name: 'Ley de los gases ideales',
  category: 'termodinamica',
  ref: '2.11',
  latex: L`PV=nRT`,
  forms: [{ label: 'Como aparece en el formulario', latex: L`PV=mRT,\qquad R=\frac{R_u}{M}` }],
  summary: 'Relaciona presión, volumen, temperatura y cantidad de un gas.',
  goal: 'Predecir cómo responde un gas al comprimirlo, calentarlo o agregarle más moléculas.',
  variables: [
    { symbol: 'P', meaning: 'Presión', unit: 'atm' },
    { symbol: 'V', meaning: 'Volumen', unit: 'L' },
    { symbol: 'n', meaning: 'Cantidad de sustancia', unit: 'mol' },
    { symbol: 'R', meaning: 'Constante de los gases, $0.0821$', unit: 'L·atm/(mol·K)' },
    { symbol: 'T', meaning: 'Temperatura **absoluta**', unit: 'K' },
  ],
  whenToUse: [
    'Gases a presiones moderadas y temperaturas no muy bajas: aire, llantas, globos, tanques.',
    'El formulario usa $PV = mRT$ con la masa $m$ y una $R$ específica del gas ($R_u/M$). Es la misma ley, porque $n = m/M$.',
  ],
  intuition: [
    'Las moléculas chocan contra las paredes. Más moléculas ($n$) o moléculas más rápidas (mayor $T$) producen más choques, es decir, más presión.',
    'Si el recipiente es más grande ($V$), los choques se reparten en más área y la presión baja.',
    'Junta tres leyes clásicas: Boyle ($PV$ constante), Charles ($V \\propto T$) y Avogadro ($V \\propto n$).',
  ],
  calculators: [
    calc<{ T: number; P: number }>({
      id: 'P',
      label: 'Despejar P',
      inputs: [
        { kind: 'number', id: 'n', label: 'Moles', symbol: 'n', default: 1, unit: 'mol' },
        { kind: 'number', id: 'Tc', label: 'Temperatura', symbol: 'T', default: 25, unit: '°C' },
        { kind: 'number', id: 'V', label: 'Volumen', symbol: 'V', default: 10, unit: 'L' },
      ],
      compute: (v) => {
        const T = num(v, 'Tc') + 273.15
        positive(T, 'T'); positive(num(v, 'V'), 'V'); positive(num(v, 'n'), 'n')
        return { T, P: (num(v, 'n') * 0.0821 * T) / num(v, 'V') }
      },
      steps: (v, r) => [
        { label: 'Temperatura absoluta', latex: L`T=${fmt(num(v, 'Tc'))}+273.15=${fmt(r.T)}${u('K')}` },
        { label: 'Despejamos', latex: L`P=\frac{nRT}{V}` },
        { label: 'Sustituimos', latex: L`P=\frac{(${fmt(num(v, 'n'))})(0.0821)(${fmt(r.T)})}{${fmt(num(v, 'V'))}}=${fmt(r.P)}${u('atm')}` },
      ],
      answer: (_v, r) => L`P=${fmt(r.P)}${u('atm')}`,
      extras: (_v, r) => [{ label: 'En kPa', latex: L`${fmt(r.P * 101.325)}${u('kPa')}` }],
      interpret: (v, r) => [
        { tone: 'good', text: `$${fmt(num(v, 'n'))}\\ \\mathrm{mol}$ de gas en $${fmt(num(v, 'V'))}\\ \\mathrm{L}$ a $${fmt(num(v, 'Tc'))}^\\circ\\mathrm{C}$ ejercen $${fmt(r.P)}\\ \\mathrm{atm}$ ($${fmt(r.P, 2)}$ veces la presión atmosférica al nivel del mar).` },
        { tone: 'info', text: `Si duplicas la temperatura **absoluta** (a $${fmt(2 * r.T)}\\ \\mathrm{K}$) a volumen constante, la presión se duplica. Duplicar los °C no la duplica.` },
      ],
    }),
    calc<{ T: number; V: number }>({
      id: 'V',
      label: 'Despejar V',
      inputs: [
        { kind: 'number', id: 'n', label: 'Moles', symbol: 'n', default: 1, unit: 'mol' },
        { kind: 'number', id: 'Tc', label: 'Temperatura', symbol: 'T', default: 0, unit: '°C' },
        { kind: 'number', id: 'P', label: 'Presión', symbol: 'P', default: 1, unit: 'atm' },
      ],
      compute: (v) => {
        const T = num(v, 'Tc') + 273.15
        positive(T, 'T'); positive(num(v, 'P'), 'P')
        return { T, V: (num(v, 'n') * 0.0821 * T) / num(v, 'P') }
      },
      steps: (v, r) => [
        { label: 'Temperatura absoluta', latex: L`T=${fmt(num(v, 'Tc'))}+273.15=${fmt(r.T)}${u('K')}` },
        { label: 'Despejamos y sustituimos', latex: L`V=\frac{nRT}{P}=\frac{(${fmt(num(v, 'n'))})(0.0821)(${fmt(r.T)})}{${fmt(num(v, 'P'))}}=${fmt(r.V)}${u('L')}` },
      ],
      answer: (_v, r) => L`V=${fmt(r.V)}${u('L')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `El gas ocupa $${fmt(r.V)}\\ \\mathrm{L}$.` },
        ...(num(v, 'Tc') === 0 && num(v, 'P') === 1 ? [{ tone: 'info' as const, text: 'A 0 °C y 1 atm (condiciones normales), 1 mol de cualquier gas ideal ocupa unos 22.4 L: el **volumen molar** del formulario.' }] : []),
      ],
    }),
  ],
  commonMistakes: [
    'Usar °C en lugar de kelvin. Es el error más común.',
    'Mezclar unidades de $R$: con $0.0821$ usa atm y L; con $8.314$ usa Pa y m³.',
  ],
  related: ['calor-sensible', 'eficiencia-carnot'],
  keywords: ['gas ideal', 'presion', 'volumen', 'temperatura', 'moles', 'boyle', 'charles'],
}

const carnot: Formula = {
  id: 'eficiencia-carnot',
  name: 'Eficiencia de Carnot (máquina térmica ideal)',
  category: 'termodinamica',
  ref: '2.11',
  latex: L`\eta=1-\frac{T_F}{T_C}`,
  summary: 'La máxima eficiencia posible de cualquier máquina que convierte calor en trabajo entre dos temperaturas.',
  goal: 'Saber el límite teórico: qué fracción del calor puede convertirse, como máximo, en trabajo útil.',
  variables: [
    { symbol: L`\eta`, meaning: 'Eficiencia (entre 0 y 1)' },
    { symbol: 'T_C', meaning: 'Temperatura del foco caliente', unit: 'K' },
    { symbol: 'T_F', meaning: 'Temperatura del foco frío', unit: 'K' },
  ],
  whenToUse: ['Motores, plantas termoeléctricas, refrigeradores (a la inversa). Sirve para saber si un diseño es siquiera posible.'],
  intuition: [
    'Una máquina térmica funciona porque el calor “cae” de lo caliente a lo frío, como el agua que mueve un molino. Cuanto mayor es la caída de temperatura, más trabajo se puede extraer.',
    'Nunca llega al 100%: tendrías que expulsar el calor a $0\\ \\mathrm{K}$. Es una consecuencia de la **segunda ley** de la termodinámica.',
  ],
  calculators: [
    calc<{ TC: number; TF: number; eta: number }>({
      id: 'eta',
      label: 'Calcular η',
      example: 'una planta termoeléctrica con vapor a 500 °C y un condensador a 30 °C.',
      inputs: [
        { kind: 'number', id: 'Tc', label: 'Foco caliente', symbol: 'T_C', default: 500, unit: '°C' },
        { kind: 'number', id: 'Tf', label: 'Foco frío', symbol: 'T_F', default: 30, unit: '°C' },
      ],
      compute: (v) => {
        const TC = num(v, 'Tc') + 273.15, TF = num(v, 'Tf') + 273.15
        if (TF <= 0 || TC <= 0) fail('Las temperaturas deben estar por encima del cero absoluto (−273.15 °C).')
        if (TF >= TC) fail('El foco caliente debe estar a mayor temperatura que el frío.')
        return { TC, TF, eta: 1 - TF / TC }
      },
      steps: (v, r) => [
        { label: 'Pasamos a kelvin', latex: L`T_C=${fmt(num(v, 'Tc'))}+273.15=${fmt(r.TC)}${u('K')},\qquad T_F=${fmt(num(v, 'Tf'))}+273.15=${fmt(r.TF)}${u('K')}` },
        { label: 'Sustituimos', latex: L`\eta=1-\frac{${fmt(r.TF)}}{${fmt(r.TC)}}=${fmt(r.eta)}` },
      ],
      answer: (_v, r) => L`\eta=${fmt(r.eta * 100, 2)}\%`,
      interpret: (_v, r) => [
        { tone: 'good', text: `Como **máximo**, el $${fmt(r.eta * 100, 1)}$% del calor puede convertirse en trabajo; el $${fmt((1 - r.eta) * 100, 1)}$% restante se expulsa al foco frío.` },
        { tone: 'info', text: 'Las máquinas reales tienen fricción y pérdidas, así que su eficiencia es menor. Si alguien afirma superar este valor, hay un error.' },
      ],
    }),
  ],
  commonMistakes: [
    'Usar grados Celsius: la fórmula **sólo** funciona en kelvin.',
    'Intercambiar $T_C$ y $T_F$.',
  ],
  related: ['gases-ideales', 'calor-sensible'],
  keywords: ['segunda ley', 'maquina termica', 'eficiencia', 'carnot', 'motor'],
}

// ═══ Ondas y óptica ══════════════════════════════════════════════════════════

const snell: Formula = {
  id: 'ley-de-snell',
  name: 'Ley de Snell (refracción)',
  category: 'ondas',
  ref: '2.13',
  latex: L`n_1\sin\theta_1=n_2\sin\theta_2`,
  forms: [
    { label: 'Índice de refracción', latex: L`n=\frac{c}{v}` },
    { label: 'Ángulo crítico (n₁ > n₂)', latex: L`\sin\theta_c=\frac{n_2}{n_1}` },
  ],
  summary: 'Cómo se desvía la luz al pasar de un medio a otro.',
  goal: 'Predecir el ángulo con el que sale la luz al cambiar de medio (aire, agua, vidrio) y cuándo queda atrapada por reflexión total interna.',
  variables: [
    { symbol: 'n_1,\\ n_2', meaning: 'Índices de refracción de cada medio (aire ≈ 1, agua ≈ 1.33, vidrio ≈ 1.5)' },
    { symbol: L`\theta_1`, meaning: 'Ángulo de incidencia, medido desde la **normal**' },
    { symbol: L`\theta_2`, meaning: 'Ángulo de refracción, medido desde la normal' },
  ],
  whenToUse: ['Lentes, prismas, fibra óptica, por qué un popote se ve “roto” dentro de un vaso con agua.'],
  intuition: [
    'La luz viaja más lento en medios con mayor $n$. Imagina un auto que entra en diagonal de pavimento a arena: la rueda que toca primero la arena frena antes, y el auto **gira**.',
    'Al entrar a un medio más lento, la luz se acerca a la normal. Al salir a uno más rápido, se aleja de ella.',
    'Si sale hacia un medio más rápido con un ángulo muy inclinado, $\\sin\\theta_2$ tendría que ser mayor que 1, lo cual es imposible. La luz no sale: se refleja por completo (**reflexión total interna**). Así funciona la fibra óptica.',
  ],
  calculators: [
    calc<{ s2: number; theta2: number | null; crit: number | null }>({
      id: 'theta2',
      label: 'Ángulo de refracción',
      example: 'luz que pasa del aire ($n = 1$) al agua ($n = 1.33$). Prueba vidrio ($1.5$) → aire ($1$) a $60^\\circ$.',
      inputs: [
        { kind: 'number', id: 'n1', label: 'Índice del medio 1', symbol: 'n_1', default: 1 },
        { kind: 'number', id: 'n2', label: 'Índice del medio 2', symbol: 'n_2', default: 1.33 },
        { kind: 'number', id: 'theta1', label: 'Ángulo de incidencia', symbol: L`\theta_1`, default: 45, unit: '°' },
      ],
      compute: (v) => {
        const n1 = num(v, 'n1'), n2 = num(v, 'n2'), t1 = num(v, 'theta1')
        if (n1 < 1 || n2 < 1) fail('Los índices de refracción son mayores o iguales a 1.')
        if (t1 < 0 || t1 >= 90) fail('El ángulo de incidencia debe estar entre 0° y 90°.')
        const s2 = (n1 * Math.sin(toRad(t1))) / n2
        return { s2, theta2: s2 <= 1 ? toDeg(Math.asin(s2)) : null, crit: n1 > n2 ? toDeg(Math.asin(n2 / n1)) : null }
      },
      steps: (v, r) => {
        const n1 = num(v, 'n1'), n2 = num(v, 'n2'), t1 = num(v, 'theta1')
        const steps = [
          { label: 'Despejamos', latex: L`\sin\theta_2=\frac{n_1\sin\theta_1}{n_2}` },
          { label: 'Sustituimos', latex: L`\sin\theta_2=\frac{(${fmt(n1)})\sin ${fmt(t1)}^\circ}{${fmt(n2)}}=\frac{${fmt(n1 * Math.sin(toRad(t1)))}}{${fmt(n2)}}=${fmt(r.s2)}` },
        ]
        if (r.theta2 !== null) steps.push({ label: 'Ángulo', latex: L`\theta_2=\sin^{-1}(${fmt(r.s2)})=${fmt(r.theta2, 2)}^\circ` })
        else steps.push({ label: 'Imposible: el seno no puede ser mayor que 1', latex: L`${fmt(r.s2)}>1\;\Rightarrow\;\text{reflexión total interna}` })
        return steps
      },
      answer: (_v, r) => r.theta2 !== null ? L`\theta_2=${fmt(r.theta2, 2)}^\circ` : L`\text{Reflexión total interna}`,
      extras: (_v, r) => r.crit !== null ? [{ label: 'Ángulo crítico', latex: L`\theta_c=${fmt(r.crit, 2)}^\circ` }] : [],
      interpret: (v, r) => {
        const n1 = num(v, 'n1'), n2 = num(v, 'n2')
        if (r.theta2 === null) return [{ tone: 'warn', text: `El ángulo supera el crítico ($${fmt(r.crit ?? 0, 2)}^\\circ$): la luz **no sale** del medio 1, se refleja por completo. Así viaja la luz dentro de una fibra óptica.` }]
        const out: Interpretation[] = [{
          tone: 'good',
          text: n2 > n1 ? `La luz entra a un medio más lento y **se acerca a la normal**: de $${fmt(num(v, 'theta1'))}^\\circ$ a $${fmt(r.theta2, 2)}^\\circ$.`
            : n2 < n1 ? `La luz sale a un medio más rápido y **se aleja de la normal**: de $${fmt(num(v, 'theta1'))}^\\circ$ a $${fmt(r.theta2, 2)}^\\circ$.`
              : 'Los índices son iguales: la luz no se desvía.',
        }]
        out.push({ tone: 'info', text: `En el medio 2 la luz viaja a $c/n_2 = ${fmt(3e8 / n2)}\\ \\mathrm{m/s}$.` })
        if (r.crit !== null) out.push({ tone: 'info', text: `Con ángulos mayores a $${fmt(r.crit, 2)}^\\circ$ ocurriría reflexión total interna.` })
        return out
      },
      visual: (v, r) => ({ type: 'snell', n1: num(v, 'n1'), n2: num(v, 'n2'), theta1: num(v, 'theta1'), theta2: r.theta2 }),
    }),
  ],
  commonMistakes: [
    'Medir los ángulos desde la superficie en lugar de desde la **normal** (la perpendicular).',
    'Tener la calculadora en radianes.',
  ],
  related: ['ondas'],
  keywords: ['refraccion', 'optica', 'indice de refraccion', 'reflexion total', 'luz'],
}

const ondas: Formula = {
  id: 'ondas',
  name: 'Velocidad de una onda',
  category: 'ondas',
  ref: '2.13',
  latex: L`c=f\lambda`,
  forms: [{ label: 'Para cualquier onda', latex: L`v=f\lambda,\qquad T=\frac1f` }],
  summary: 'Relaciona la velocidad de una onda con su frecuencia y su longitud de onda.',
  goal: 'Pasar de frecuencia a longitud de onda (o al revés): qué tamaño tiene una onda de radio, de sonido o de luz.',
  variables: [
    { symbol: 'c', meaning: 'Velocidad de la onda (luz en el vacío: $3\\times10^8$)', unit: 'm/s' },
    { symbol: 'f', meaning: 'Frecuencia: oscilaciones por segundo', unit: 'Hz' },
    { symbol: L`\lambda`, meaning: 'Longitud de onda: distancia entre dos crestas', unit: 'm' },
  ],
  whenToUse: ['Radio, WiFi, luz visible, sonido (con $v \\approx 343\\ \\mathrm{m/s}$ en el aire).'],
  intuition: [
    'En cada oscilación la onda avanza una longitud de onda $\\lambda$. Si oscila $f$ veces por segundo, avanza $f\\lambda$ metros por segundo.',
    'En un mismo medio la velocidad es fija, así que a **mayor frecuencia, menor longitud de onda**.',
  ],
  calculators: [
    calc<{ lambda: number }>({
      id: 'lambda',
      label: 'Despejar λ',
      example: 'una estación de radio FM de 100 MHz (las ondas de radio viajan a la velocidad de la luz).',
      inputs: [
        { kind: 'number', id: 'v', label: 'Velocidad', symbol: 'c', default: 3e8, unit: 'm/s' },
        { kind: 'number', id: 'f', label: 'Frecuencia', symbol: 'f', default: 100e6, unit: 'Hz' },
      ],
      compute: (v) => { positive(num(v, 'f'), 'f'); positive(num(v, 'v'), 'c'); return { lambda: num(v, 'v') / num(v, 'f') } },
      steps: (v, r) => [
        { label: 'Despejamos', latex: L`\lambda=\frac{c}{f}` },
        { label: 'Sustituimos', latex: L`\lambda=\frac{${fmt(num(v, 'v'))}}{${fmt(num(v, 'f'))}}=${fmt(r.lambda)}${u('m')}` },
      ],
      answer: (_v, r) => L`\lambda=${fmt(r.lambda)}${u('m')}`,
      extras: (v) => [{ label: 'Periodo', latex: L`T=${fmt(1 / num(v, 'f'))}${u('s')}` }],
      interpret: (v, r) => {
        const l = r.lambda
        // las etiquetas del espectro sólo aplican a ondas electromagnéticas (v ≈ c)
        if (Math.abs(num(v, 'v') - 3e8) / 3e8 > 0.05) return [{ tone: 'good', text: `Cada onda mide $${fmt(l)}\\ \\mathrm{m}$: es la distancia entre dos crestas consecutivas.` }]
        const scale = l >= 1 ? 'del tamaño de objetos cotidianos (por eso las antenas de radio miden metros)'
          : l >= 1e-3 ? 'de milímetros a decímetros, como las microondas y el WiFi'
            : l >= 380e-9 && l <= 750e-9 ? `en el rango de la **luz visible** (${fmt(l * 1e9, 0)} nm)`
              : l < 380e-9 ? 'más corta que la luz visible (ultravioleta, rayos X…)' : 'en el infrarrojo'
        return [{ tone: 'good', text: `Cada onda mide $${fmt(l)}\\ \\mathrm{m}$: ${scale}.` }]
      },
    }),
    calc<{ f: number }>({
      id: 'f',
      label: 'Despejar f',
      example: 'una onda de sonido en el aire (343 m/s).',
      inputs: [
        { kind: 'number', id: 'v', label: 'Velocidad', symbol: 'v', default: 343, unit: 'm/s' },
        { kind: 'number', id: 'lambda', label: 'Longitud de onda', symbol: L`\lambda`, default: 0.78, unit: 'm' },
      ],
      compute: (v) => { positive(num(v, 'lambda'), '\\lambda'); return { f: num(v, 'v') / num(v, 'lambda') } },
      steps: (v, r) => [
        { label: 'Despejamos', latex: L`f=\frac{v}{\lambda}` },
        { label: 'Sustituimos', latex: L`f=\frac{${fmt(num(v, 'v'))}}{${fmt(num(v, 'lambda'))}}=${fmt(r.f)}${u('Hz')}` },
      ],
      answer: (_v, r) => L`f=${fmt(r.f)}${u('Hz')}`,
      interpret: (_v, r) => [{ tone: 'good', text: `La onda oscila $${fmt(r.f)}$ veces por segundo.` + (r.f >= 20 && r.f <= 20000 ? ' Si es sonido, está dentro del rango audible (20 Hz a 20 kHz).' : '') }],
    }),
  ],
  commonMistakes: [
    'Olvidar los prefijos: $1\\ \\mathrm{MHz} = 10^6\\ \\mathrm{Hz}$, $1\\ \\mathrm{nm} = 10^{-9}\\ \\mathrm{m}$.',
    'Usar $c = 3\\times10^8$ para el sonido: cada tipo de onda tiene su propia velocidad.',
  ],
  related: ['ley-de-snell'],
  keywords: ['frecuencia', 'longitud de onda', 'luz', 'sonido', 'radio', 'espectro'],
}

// ═══ Fluidos ═════════════════════════════════════════════════════════════════

const presionHidrostatica: Formula = {
  id: 'presion-hidrostatica',
  name: 'Presión hidrostática',
  category: 'fluidos',
  ref: '2.14',
  latex: L`P=P_0+\rho gh`,
  forms: [{ label: 'Presión', latex: L`P=\frac{F}{A}` }],
  summary: 'La presión dentro de un líquido aumenta con la profundidad.',
  goal: 'Calcular la presión a cierta profundidad: buceo, presas, tanques, tuberías.',
  variables: [
    { symbol: 'P', meaning: 'Presión a la profundidad $h$', unit: 'Pa' },
    { symbol: 'P_0', meaning: 'Presión en la superficie (atmosférica ≈ 101 300)', unit: 'Pa' },
    { symbol: L`\rho`, meaning: 'Densidad del fluido (agua: 1000)', unit: 'kg/m³' },
    { symbol: 'h', meaning: 'Profundidad', unit: 'm' },
  ],
  whenToUse: ['Fluidos en reposo: buceo, presas, tanques, manómetros.'],
  intuition: [
    'A cierta profundidad, el agua debe sostener el peso de toda la columna de líquido que tiene encima. Esa columna pesa $\\rho g h$ por cada metro cuadrado.',
    'Sólo importa la **profundidad**, no la forma del recipiente: a 2 m de profundidad hay la misma presión en una cubeta grande que en un lago (con el mismo líquido).',
    'En agua, cada 10 m de profundidad se agrega aproximadamente **1 atmósfera**.',
  ],
  derivation: {
    steps: [
      { label: 'Peso de una columna de base A y altura h', latex: L`W=mg=(\rho Ah)g` },
      { label: 'Presión = fuerza / área', latex: L`\frac{W}{A}=\rho gh` },
      { label: 'Sumamos la presión de la superficie', latex: L`P=P_0+\rho gh` },
    ],
  },
  calculators: [
    calc<{ dP: number; P: number }>({
      id: 'P',
      label: 'Calcular P',
      example: 'un buzo a 10 m bajo el agua.',
      inputs: [
        { kind: 'number', id: 'P0', label: 'Presión en la superficie', symbol: 'P_0', default: 101300, unit: 'Pa' },
        { kind: 'number', id: 'rho', label: 'Densidad', symbol: L`\rho`, default: 1000, unit: 'kg/m³' },
        { kind: 'number', id: 'h', label: 'Profundidad', symbol: 'h', default: 10, unit: 'm' },
      ],
      compute: (v) => {
        positive(num(v, 'rho'), '\\rho')
        if (num(v, 'h') < 0) fail('La profundidad no puede ser negativa.')
        const dP = num(v, 'rho') * g * num(v, 'h')
        return { dP, P: num(v, 'P0') + dP }
      },
      steps: (v, r) => [
        { label: 'Presión de la columna de líquido', latex: L`\rho gh=(${fmt(num(v, 'rho'))})(9.81)(${fmt(num(v, 'h'))})=${fmt(r.dP)}${u('Pa')}` },
        { label: 'Más la presión de la superficie', latex: L`P=${fmt(num(v, 'P0'))}+${fmt(r.dP)}=${fmt(r.P)}${u('Pa')}` },
      ],
      answer: (_v, r) => L`P=${fmt(r.P)}${u('Pa')}`,
      extras: (_v, r) => [
        { label: 'En atm', latex: L`${fmt(r.P / 101300, 3)}${u('atm')}` },
        { label: 'Manométrica', latex: L`${fmt(r.dP)}${u('Pa')}` },
      ],
      interpret: (v, r) => [
        { tone: 'good', text: `A $${fmt(num(v, 'h'))}\\ \\mathrm{m}$ de profundidad la presión total es $${fmt(r.P / 101300, 2)}\\ \\mathrm{atm}$. El líquido aporta $${fmt(r.dP / 101300, 2)}\\ \\mathrm{atm}$ y la atmósfera el resto.` },
        { tone: 'info', text: `Sobre cada cm² (la yema de un dedo) actúa una fuerza de $${fmt(r.P * 1e-4)}\\ \\mathrm{N}$.` },
      ],
    }),
  ],
  commonMistakes: [
    'Olvidar sumar $P_0$ cuando piden la presión **absoluta**. Sin $P_0$ es la presión **manométrica**.',
    'Medir $h$ desde el fondo en lugar de desde la superficie.',
  ],
  related: ['bernoulli', 'continuidad'],
  keywords: ['presion', 'profundidad', 'hidrostatica', 'densidad', 'buceo', 'pascal'],
}

const continuidad: Formula = {
  id: 'continuidad',
  name: 'Ecuación de continuidad',
  category: 'fluidos',
  ref: '2.14',
  latex: L`A_1v_1=A_2v_2`,
  forms: [{ label: 'Gasto (caudal)', latex: L`Q=vA` }],
  summary: 'En un tubo, el fluido acelera donde el tubo se estrecha, porque el caudal se conserva.',
  goal: 'Calcular la velocidad de un fluido en distintas secciones de una tubería.',
  variables: [
    { symbol: 'A_1,\\ A_2', meaning: 'Áreas transversales', unit: 'm²' },
    { symbol: 'v_1,\\ v_2', meaning: 'Velocidades del fluido', unit: 'm/s' },
    { symbol: 'Q', meaning: 'Gasto: volumen por segundo', unit: 'm³/s' },
  ],
  whenToUse: ['Fluidos incompresibles (líquidos) en tuberías, mangueras, ríos, arterias.'],
  intuition: [
    'El agua no se acumula ni desaparece dentro del tubo: lo que entra por segundo debe salir por segundo. Si el tubo se estrecha, el agua tiene que ir **más rápido** para que pase el mismo volumen.',
    'Es lo que haces al tapar parcialmente una manguera con el dedo.',
    'Como el área depende del **cuadrado** del diámetro, reducir el diámetro a la mitad multiplica la velocidad por 4.',
  ],
  calculators: [
    calc<{ A1: number; A2: number; v2: number; Q: number }>({
      id: 'v2',
      label: 'Velocidad en la sección 2',
      example: 'una manguera de 2 cm que se reduce a 1 cm en la boquilla.',
      inputs: [
        { kind: 'number', id: 'd1', label: 'Diámetro 1', symbol: 'd_1', default: 0.02, unit: 'm' },
        { kind: 'number', id: 'v1', label: 'Velocidad 1', symbol: 'v_1', default: 1.5, unit: 'm/s' },
        { kind: 'number', id: 'd2', label: 'Diámetro 2', symbol: 'd_2', default: 0.01, unit: 'm' },
      ],
      compute: (v) => {
        positive(num(v, 'd1'), 'd_1'); positive(num(v, 'd2'), 'd_2')
        const A1 = (Math.PI * num(v, 'd1') ** 2) / 4, A2 = (Math.PI * num(v, 'd2') ** 2) / 4
        return { A1, A2, v2: (A1 * num(v, 'v1')) / A2, Q: A1 * num(v, 'v1') }
      },
      steps: (v, r) => [
        { label: 'Áreas', latex: L`A=\frac{\pi d^2}{4}:\quad A_1=${fmt(r.A1)}${u('m^2')},\quad A_2=${fmt(r.A2)}${u('m^2')}` },
        { label: 'Despejamos', latex: L`v_2=\frac{A_1v_1}{A_2}` },
        { label: 'Sustituimos', latex: L`v_2=\frac{(${fmt(r.A1)})(${fmt(num(v, 'v1'))})}{${fmt(r.A2)}}=${fmt(r.v2)}${u('m/s')}` },
        { label: 'Gasto', latex: L`Q=A_1v_1=${fmt(r.Q)}${u('m^3/s')}=${fmt(r.Q * 1000 * 60, 2)}${u('L/min')}` },
      ],
      answer: (_v, r) => L`v_2=${fmt(r.v2)}${u('m/s')}`,
      extras: (_v, r) => [{ label: 'Gasto', latex: L`${fmt(r.Q * 1000 * 60, 2)}${u('L/min')}` }],
      interpret: (v, r) => [
        { tone: 'good', text: `En la sección 2 el fluido va a $${fmt(r.v2)}\\ \\mathrm{m/s}$, es decir, $${fmt(r.v2 / num(v, 'v1'), 2)}$ veces más ${r.v2 >= num(v, 'v1') ? 'rápido' : 'lento'}.` },
        { tone: 'info', text: `El área cambió en un factor de $${fmt(r.A1 / r.A2, 2)}$ (el cuadrado de la razón de diámetros, $${fmt(num(v, 'd1') / num(v, 'd2'), 2)}$²).` },
      ],
    }),
  ],
  commonMistakes: [
    'Usar diámetros en lugar de áreas: $A = \\pi d^2/4$.',
    'Aplicarla a gases muy comprimibles.',
  ],
  related: ['bernoulli', 'presion-hidrostatica'],
  keywords: ['caudal', 'gasto', 'tuberia', 'flujo', 'manguera'],
}

const bernoulli: Formula = {
  id: 'bernoulli',
  name: 'Ecuación de Bernoulli',
  category: 'fluidos',
  ref: '2.14',
  latex: L`P_1+\rho gy_1+\tfrac12\rho v_1^2=P_2+\rho gy_2+\tfrac12\rho v_2^2`,
  summary: 'Conservación de la energía para un fluido en movimiento: donde va más rápido, la presión es menor.',
  goal: 'Relacionar presión, velocidad y altura de un fluido en distintos puntos de su recorrido.',
  variables: [
    { symbol: 'P', meaning: 'Presión', unit: 'Pa' },
    { symbol: L`\rho gy`, meaning: 'Energía potencial por unidad de volumen', unit: 'Pa' },
    { symbol: L`\tfrac12\rho v^2`, meaning: 'Energía cinética por unidad de volumen', unit: 'Pa' },
  ],
  whenToUse: [
    'Fluido incompresible, sin fricción y en flujo estable.',
    'Tubos de Venturi, sustentación de alas (simplificado), velocidad de salida de un tanque (Torricelli).',
  ],
  intuition: [
    'Cada término es energía por unidad de volumen: presión, altura y velocidad. Su suma se mantiene constante a lo largo del flujo.',
    'Si el fluido acelera (por ejemplo, en un estrechamiento), esa energía cinética extra debe salir de algún lado: **la presión baja**. Así funcionan el tubo de Venturi y los atomizadores: el aire rápido crea una zona de baja presión que succiona el líquido.',
  ],
  calculators: [
    calc<{ P2: number; terms1: number[]; terms2: number[] }>({
      id: 'P2',
      label: 'Despejar P₂',
      inputs: [
        { kind: 'number', id: 'P1', label: 'Presión 1', symbol: 'P_1', default: 200000, unit: 'Pa' },
        { kind: 'number', id: 'v1', label: 'Velocidad 1', symbol: 'v_1', default: 1.5, unit: 'm/s' },
        { kind: 'number', id: 'y1', label: 'Altura 1', symbol: 'y_1', default: 0, unit: 'm' },
        { kind: 'number', id: 'v2', label: 'Velocidad 2', symbol: 'v_2', default: 6, unit: 'm/s' },
        { kind: 'number', id: 'y2', label: 'Altura 2', symbol: 'y_2', default: 5, unit: 'm' },
        { kind: 'number', id: 'rho', label: 'Densidad', symbol: L`\rho`, default: 1000, unit: 'kg/m³' },
      ],
      compute: (v) => {
        const rho = num(v, 'rho')
        positive(rho, '\\rho')
        const terms1 = [num(v, 'P1'), rho * g * num(v, 'y1'), 0.5 * rho * num(v, 'v1') ** 2]
        const terms2 = [rho * g * num(v, 'y2'), 0.5 * rho * num(v, 'v2') ** 2]
        return { P2: terms1[0] + terms1[1] + terms1[2] - terms2[0] - terms2[1], terms1, terms2 }
      },
      steps: (_v, r) => [
        { label: 'Energía total por volumen en el punto 1', latex: L`${fmt(r.terms1[0])}+${fmt(r.terms1[1])}+${fmt(r.terms1[2])}=${fmt(r.terms1[0] + r.terms1[1] + r.terms1[2])}${u('Pa')}` },
        { label: 'Altura y velocidad en el punto 2', latex: L`\rho gy_2=${fmt(r.terms2[0])},\qquad \tfrac12\rho v_2^2=${fmt(r.terms2[1])}` },
        { label: 'Despejamos', latex: L`P_2=${fmt(r.terms1[0] + r.terms1[1] + r.terms1[2])}-${fmt(r.terms2[0])}-${fmt(r.terms2[1])}=${fmt(r.P2)}${u('Pa')}` },
      ],
      answer: (_v, r) => L`P_2=${fmt(r.P2)}${u('Pa')}`,
      extras: (_v, r) => [{ label: 'En atm', latex: L`${fmt(r.P2 / 101300, 3)}${u('atm')}` }],
      interpret: (v, r) => {
        const out: Interpretation[] = [{
          tone: r.P2 > 2300 ? 'good' : 'warn',
          text: r.P2 > 2300
            ? `La presión en el punto 2 es $${fmt(r.P2)}\\ \\mathrm{Pa}$, ${r.P2 < num(v, 'P1') ? 'menor' : 'mayor'} que en el punto 1.`
            : 'Si usaste presiones **absolutas**, $P_2$ queda por debajo de la presión de vapor del agua (≈ 2.3 kPa a 20 °C): el agua empezaría a formar burbujas de vapor (**cavitación**) y el flujo no puede llegar así. Si usaste presiones **manométricas**, un valor negativo sólo significa que está por debajo de la presión atmosférica.',
        }]
        const dK = r.terms2[1] - r.terms1[2], dU = r.terms2[0] - r.terms1[1]
        if (dK > 0) out.push({ tone: 'info', text: `Acelerar el fluido le “cuesta” $${fmt(dK)}\\ \\mathrm{Pa}$ de presión.` })
        if (dU > 0) out.push({ tone: 'info', text: `Subirlo le cuesta $${fmt(dU)}\\ \\mathrm{Pa}$ más.` })
        return out
      },
    }),
  ],
  commonMistakes: [
    'Mezclar presión absoluta y manométrica entre los dos puntos.',
    'Aplicarla con mucha fricción (tubos largos y delgados) o con fluidos compresibles.',
  ],
  related: ['continuidad', 'presion-hidrostatica', 'energia-cinetica'],
  keywords: ['bernoulli', 'venturi', 'fluido', 'presion', 'dinamica de fluidos'],
}

export const FISICA: Formula[] = [
  mruaPosicion, torricelli, newton, gravitacion, impulso,
  trabajo, energiaCinetica, energiaPotencial,
  coulomb, ohm, potenciaElectrica,
  calor, gasesIdeales, carnot,
  snell, ondas,
  presionHidrostatica, continuidad, bernoulli,
]
