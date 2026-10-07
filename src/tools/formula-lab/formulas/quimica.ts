import { calc, fail, num, pairs, type Formula, type Interpretation } from '../types'
import { fmt, fp, sum } from '../format'

const L = String.raw
const u = (s: string) => L`\,\mathrm{${s}}`

// Constantes (formulario §2.1 y §3.1)
const h = 6.626e-34 // J·s
const c = 3e8 // m/s
const eV = 1.602e-19 // J
const me = 9.109e-31 // kg
const NA = 6.022e23 // 1/mol
const F = 96485 // C/mol
const R = 8.314 // J/(mol·K)
const RH_CM = 109677 // cm⁻¹ (hidrógeno)

function positive(x: number, name: string) {
  if (!(x > 0)) fail(`$${name}$ debe ser mayor que 0.`)
}
function requireInt(x: number, name: string, min: number) {
  if (!Number.isInteger(x) || x < min) fail(`$${name}$ debe ser un entero mayor o igual a ${min}.`)
}

/** Región del espectro y color aproximado para una longitud de onda en nm */
export function spectrumRegion(nm: number): string {
  if (nm < 10) return 'rayos X o gamma'
  if (nm < 380) return 'ultravioleta (invisible)'
  if (nm < 450) return 'luz visible **violeta**'
  if (nm < 495) return 'luz visible **azul**'
  if (nm < 570) return 'luz visible **verde**'
  if (nm < 590) return 'luz visible **amarilla**'
  if (nm < 620) return 'luz visible **naranja**'
  if (nm <= 750) return 'luz visible **roja**'
  if (nm < 1e6) return 'infrarrojo (invisible, se siente como calor)'
  return 'microondas u ondas de radio'
}

/** Qué enlaces puede romper un mol de fotones con esta energía (kJ/mol) */
function bondWords(kJ: number): string {
  if (kJ >= 345) return ' Es suficiente para romper la mayoría de los enlaces comunes, como C–C (≈345 kJ/mol) o C–H (≈415): por eso la radiación UV daña moléculas como el ADN.'
  if (kJ >= 150) return ' Alcanza para romper sólo los enlaces más débiles, como Cl–Cl (≈243 kJ/mol) o I–I (≈151), pero no los C–C o C–H de la materia orgánica.'
  return ' Es menos que casi cualquier enlace químico (≈150–500 kJ/mol): esta radiación calienta o hace vibrar moléculas, pero no las rompe.'
}

// ═══ Disoluciones ════════════════════════════════════════════════════════════

const molaridad: Formula = {
  id: 'molaridad',
  name: 'Molaridad (y normalidad)',
  category: 'disoluciones',
  latex: L`M=\frac{\text{moles de soluto}}{\text{litros de disolución}}=\frac{n}{V}`,
  forms: [
    { label: 'Moles a partir de la masa', latex: L`n=\frac{m}{\text{masa molar}}` },
    { label: 'Normalidad', latex: L`N=\frac{\#\text{equivalentes}}{V}=M\cdot\theta` },
  ],
  summary: 'Cuántos moles de soluto hay por cada litro de disolución: la forma más usada de expresar concentración en el laboratorio.',
  goal: 'Saber qué tan concentrada está una disolución, o cuánto soluto pesar para preparar una con la concentración que necesitas.',
  variables: [
    { symbol: 'M', meaning: 'Molaridad', unit: 'mol/L' },
    { symbol: 'n', meaning: 'Moles de soluto', unit: 'mol' },
    { symbol: 'V', meaning: 'Volumen de **disolución** (no de disolvente)', unit: 'L' },
    { symbol: 'm', meaning: 'Masa de soluto', unit: 'g' },
    { symbol: L`\theta`, meaning: 'Equivalentes por mol: $\\mathrm{H^+}$ que cede un ácido, $\\mathrm{OH^-}$ de una base, o electrones en redox' },
  ],
  whenToUse: [
    'Preparar disoluciones en el laboratorio y hacer cálculos estequiométricos con volúmenes.',
    'La normalidad se usa en titulaciones: en el punto de equivalencia $N_1V_1 = N_2V_2$.',
  ],
  intuition: [
    'Un mol es un “paquete” de $6.022\\times10^{23}$ partículas. La molaridad cuenta cuántos de esos paquetes hay en cada litro, sin importar qué tan pesadas sean las partículas.',
    'Por eso dos disoluciones 1 M de sustancias distintas tienen el **mismo número de partículas** por litro, aunque pesen distinto. Eso es lo que importa en una reacción.',
    'La normalidad cuenta “unidades reactivas”: el $\\mathrm{H_2SO_4}$ cede 2 $\\mathrm{H^+}$ por molécula, así que una disolución 0.5 M de ácido sulfúrico es 1 N.',
  ],
  calculators: [
    calc<{ n: number; VL: number; M: number }>({
      id: 'M',
      label: 'Calcular M',
      example: 'disolver 5.85 g de NaCl (masa molar 58.44 g/mol) y completar a 250 mL.',
      inputs: [
        { kind: 'number', id: 'm', label: 'Masa de soluto', symbol: 'm', default: 5.85, unit: 'g' },
        { kind: 'number', id: 'MM', label: 'Masa molar', symbol: L`\text{MM}`, default: 58.44, unit: 'g/mol' },
        { kind: 'number', id: 'VmL', label: 'Volumen de disolución', symbol: 'V', default: 250, unit: 'mL' },
      ],
      compute: (v) => {
        positive(num(v, 'm'), 'm'); positive(num(v, 'MM'), '\\text{MM}'); positive(num(v, 'VmL'), 'V')
        const n = num(v, 'm') / num(v, 'MM'), VL = num(v, 'VmL') / 1000
        return { n, VL, M: n / VL }
      },
      steps: (v, r) => [
        { label: 'Pasamos la masa a moles', latex: L`n=\frac{${fmt(num(v, 'm'))}${u('g')}}{${fmt(num(v, 'MM'))}${u('g/mol')}}=${fmt(r.n)}${u('mol')}` },
        { label: 'Pasamos el volumen a litros', latex: L`V=\frac{${fmt(num(v, 'VmL'))}${u('mL')}}{1000}=${fmt(r.VL)}${u('L')}` },
        { label: 'Dividimos', latex: L`M=\frac{${fmt(r.n)}}{${fmt(r.VL)}}=${fmt(r.M)}${u('mol/L')}` },
      ],
      answer: (_v, r) => L`M=${fmt(r.M)}${u('mol/L')}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `Cada litro de esta disolución contiene $${fmt(r.M)}$ moles de soluto: es una disolución $${fmt(r.M, 3)}\\ \\mathrm{M}$ (“$${fmt(r.M, 3)}$ molar”).` },
        { tone: 'info', text: `En $10\\ \\mathrm{mL}$ de ella hay $${fmt(r.M * 0.01)}\\ \\mathrm{mol}$, unas $${fmt(r.M * 0.01 * NA)}$ partículas de soluto.` },
      ],
    }),
    calc<{ VL: number; n: number; m: number }>({
      id: 'preparar',
      label: 'Preparar una disolución',
      example: 'preparar 500 mL de NaCl 0.5 M.',
      inputs: [
        { kind: 'number', id: 'Mt', label: 'Molaridad deseada', symbol: 'M', default: 0.5, unit: 'mol/L' },
        { kind: 'number', id: 'VmL', label: 'Volumen a preparar', symbol: 'V', default: 500, unit: 'mL' },
        { kind: 'number', id: 'MM', label: 'Masa molar', symbol: L`\text{MM}`, default: 58.44, unit: 'g/mol' },
      ],
      compute: (v) => {
        positive(num(v, 'Mt'), 'M'); positive(num(v, 'VmL'), 'V'); positive(num(v, 'MM'), '\\text{MM}')
        const VL = num(v, 'VmL') / 1000, n = num(v, 'Mt') * VL
        return { VL, n, m: n * num(v, 'MM') }
      },
      steps: (v, r) => [
        { label: 'Moles necesarios', latex: L`n=M\cdot V=(${fmt(num(v, 'Mt'))})(${fmt(r.VL)}${u('L')})=${fmt(r.n)}${u('mol')}` },
        { label: 'Los pasamos a gramos', latex: L`m=n\cdot\text{MM}=(${fmt(r.n)})(${fmt(num(v, 'MM'))})=${fmt(r.m)}${u('g')}` },
      ],
      answer: (_v, r) => L`m=${fmt(r.m)}${u('g')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Pesa $${fmt(r.m)}\\ \\mathrm{g}$ de soluto, disuélvelo en un poco de agua y **completa (afora) hasta $${fmt(num(v, 'VmL'))}\\ \\mathrm{mL}$** de disolución total.` },
        { tone: 'warn', text: `No agregues $${fmt(num(v, 'VmL'))}\\ \\mathrm{mL}$ de agua al soluto: el volumen final sería mayor y la concentración, menor.` },
      ],
    }),
    calc<{ N: number }>({
      id: 'N',
      label: 'Normalidad',
      example: 'ácido sulfúrico $\\mathrm{H_2SO_4}$ 0.5 M, que cede 2 $\\mathrm{H^+}$ por molécula.',
      inputs: [
        { kind: 'number', id: 'M', label: 'Molaridad', symbol: 'M', default: 0.5, unit: 'mol/L' },
        { kind: 'number', id: 'theta', label: 'Equivalentes por mol', symbol: L`\theta`, default: 2, step: 1 },
      ],
      compute: (v) => {
        positive(num(v, 'M'), 'M'); positive(num(v, 'theta'), '\\theta')
        return { N: num(v, 'M') * num(v, 'theta') }
      },
      steps: (v, r) => [{ label: 'Multiplicamos', latex: L`N=M\cdot\theta=(${fmt(num(v, 'M'))})(${fmt(num(v, 'theta'))})=${fmt(r.N)}${u('eq/L')}` }],
      answer: (_v, r) => L`N=${fmt(r.N)}${u('eq/L')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Cada litro aporta $${fmt(r.N)}$ equivalentes: $${fmt(num(v, 'theta'))}$ unidades reactivas por cada mol de soluto.` },
        { tone: 'info', text: 'En una titulación ácido-base, el punto de equivalencia se alcanza cuando $N_{ácido}V_{ácido} = N_{base}V_{base}$.' },
      ],
    }),
  ],
  commonMistakes: [
    'Usar el volumen de **disolvente** en lugar del volumen total de **disolución**.',
    'Olvidar pasar mL a L.',
    'Confundir molaridad ($M$, por litro de disolución) con molalidad ($m$, por kilogramo de disolvente).',
  ],
  related: ['molalidad', 'dilucion', 'porcentajes-concentracion'],
  keywords: ['concentracion', 'molar', 'mol por litro', 'disolucion', 'normalidad', 'equivalentes'],
}

const molalidad: Formula = {
  id: 'molalidad',
  name: 'Molalidad',
  category: 'disoluciones',
  latex: L`m=\frac{\text{moles de soluto}}{\text{kilogramos de disolvente}}`,
  summary: 'Moles de soluto por cada kilogramo de disolvente; no cambia con la temperatura.',
  goal: 'Expresar la concentración con base en masas, para que no dependa de que el líquido se dilate o se contraiga con la temperatura.',
  variables: [
    { symbol: 'm', meaning: 'Molalidad', unit: 'mol/kg' },
    { symbol: 'n', meaning: 'Moles de soluto', unit: 'mol' },
    { symbol: L`\text{kg}_{\text{disolvente}}`, meaning: 'Masa del **disolvente** solo (no de la disolución)', unit: 'kg' },
  ],
  whenToUse: [
    'Propiedades coligativas: elevación del punto de ebullición y descenso del punto de congelación ($\\Delta T = K\\,m$).',
    'Cuando la temperatura cambia durante el experimento.',
  ],
  intuition: [
    'El volumen de un líquido cambia un poco con la temperatura, así que la molaridad también. Las masas no cambian, por eso la molalidad es más “estable”.',
    'En disoluciones acuosas diluidas, 1 kg de agua ocupa casi 1 L, así que molalidad y molaridad dan valores muy parecidos.',
  ],
  calculators: [
    calc<{ n: number; kg: number; m: number }>({
      id: 'm',
      label: 'Calcular m',
      example: '18 g de glucosa (180.16 g/mol) disueltos en 500 g de agua.',
      inputs: [
        { kind: 'number', id: 'ms', label: 'Masa de soluto', symbol: L`m_s`, default: 18, unit: 'g' },
        { kind: 'number', id: 'MM', label: 'Masa molar', symbol: L`\text{MM}`, default: 180.16, unit: 'g/mol' },
        { kind: 'number', id: 'md', label: 'Masa de disolvente', symbol: L`m_d`, default: 500, unit: 'g' },
      ],
      compute: (v) => {
        positive(num(v, 'ms'), 'm_s'); positive(num(v, 'MM'), '\\text{MM}'); positive(num(v, 'md'), 'm_d')
        const n = num(v, 'ms') / num(v, 'MM'), kg = num(v, 'md') / 1000
        return { n, kg, m: n / kg }
      },
      steps: (v, r) => [
        { label: 'Moles de soluto', latex: L`n=\frac{${fmt(num(v, 'ms'))}}{${fmt(num(v, 'MM'))}}=${fmt(r.n)}${u('mol')}` },
        { label: 'Disolvente en kilogramos', latex: L`\frac{${fmt(num(v, 'md'))}${u('g')}}{1000}=${fmt(r.kg)}${u('kg')}` },
        { label: 'Dividimos', latex: L`m=\frac{${fmt(r.n)}}{${fmt(r.kg)}}=${fmt(r.m)}${u('mol/kg')}` },
      ],
      answer: (_v, r) => L`m=${fmt(r.m)}${u('mol/kg')}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `Hay $${fmt(r.m)}$ moles de soluto por cada kilogramo de disolvente: la disolución es $${fmt(r.m, 3)}$ molal.` },
        { tone: 'info', text: `En agua, eso eleva el punto de ebullición unos $${fmt(0.512 * r.m, 3)}\\ ^\\circ\\mathrm{C}$ y baja el de congelación unos $${fmt(1.86 * r.m, 3)}\\ ^\\circ\\mathrm{C}$ (para un soluto que no se disocia).` },
      ],
    }),
  ],
  commonMistakes: [
    'Dividir entre la masa de la **disolución** (soluto + disolvente) en lugar de la del disolvente.',
    'Dejar la masa del disolvente en gramos.',
  ],
  related: ['molaridad', 'porcentajes-concentracion'],
  keywords: ['molal', 'propiedades coligativas', 'concentracion', 'disolvente'],
}

const porcentajes: Formula = {
  id: 'porcentajes-concentracion',
  name: 'Porcentajes de concentración y ppm',
  category: 'disoluciones',
  latex: L`\%\,m/m=\frac{\text{masa de soluto}}{\text{masa de disolución}}\times100`,
  forms: [
    { label: 'Volumen en volumen', latex: L`\%\,v/v=\frac{V_{\text{soluto}}}{V_{\text{disolución}}}\times100` },
    { label: 'Masa en volumen', latex: L`\%\,m/v=\frac{\text{g de soluto}}{\text{mL de disolución}}\times100` },
    { label: 'Partes por millón', latex: L`\text{ppm}=\frac{\text{g de soluto}}{\text{g de disolución}}\times10^6` },
  ],
  summary: 'Qué fracción de una disolución corresponde al soluto, expresada en partes por cien o por millón.',
  goal: 'Expresar concentraciones de forma sencilla, como en etiquetas de productos (alcohol 70%, suero 0.9%) o contaminantes en agua (ppm).',
  variables: [
    { symbol: L`\%\,m/m`, meaning: 'Gramos de soluto por cada 100 g de disolución' },
    { symbol: L`\%\,v/v`, meaning: 'mL de soluto por cada 100 mL de disolución' },
    { symbol: L`\%\,m/v`, meaning: 'Gramos de soluto por cada 100 mL de disolución' },
    { symbol: L`\text{ppm}`, meaning: 'Partes por millón: gramos de soluto por cada millón de gramos (equivale a mg/kg, y en agua ≈ mg/L)' },
  ],
  whenToUse: [
    'Etiquetas comerciales, farmacia y alimentos.',
    'ppm para cantidades muy pequeñas: contaminantes, minerales en agua potable.',
  ],
  intuition: [
    'Un porcentaje es “cuántas partes de cada 100”. Una ppm es lo mismo, pero de cada millón: sirve cuando el soluto es tan poco que el porcentaje tendría muchos ceros.',
    'La disolución es soluto **más** disolvente: 10 g de sal en 90 g de agua dan 100 g de disolución al 10% m/m (no 10 en 90).',
  ],
  calculators: [
    calc<{ total: number; pct: number }>({
      id: 'mm',
      label: '% m/m',
      example: '10 g de azúcar disueltos en 90 g de agua.',
      inputs: [
        { kind: 'number', id: 'ms', label: 'Masa de soluto', symbol: L`m_s`, default: 10, unit: 'g' },
        { kind: 'number', id: 'md', label: 'Masa de disolvente', symbol: L`m_d`, default: 90, unit: 'g' },
      ],
      compute: (v) => {
        positive(num(v, 'ms'), 'm_s')
        if (num(v, 'md') < 0) fail('La masa de disolvente no puede ser negativa.')
        const total = num(v, 'ms') + num(v, 'md')
        return { total, pct: (num(v, 'ms') / total) * 100 }
      },
      steps: (v, r) => [
        { label: 'Masa de la disolución = soluto + disolvente', latex: L`${fmt(num(v, 'ms'))}+${fmt(num(v, 'md'))}=${fmt(r.total)}${u('g')}` },
        { label: 'Porcentaje', latex: L`\%\,m/m=\frac{${fmt(num(v, 'ms'))}}{${fmt(r.total)}}\times100=${fmt(r.pct)}\%` },
      ],
      answer: (_v, r) => L`${fmt(r.pct)}\%\ m/m`,
      interpret: (_v, r) => [{ tone: 'good', text: `De cada 100 g de disolución, $${fmt(r.pct)}$ g son soluto.` }],
    }),
    calc<{ pct: number }>({
      id: 'vv',
      label: '% v/v',
      example: '35 mL de alcohol en 50 mL de disolución total.',
      inputs: [
        { kind: 'number', id: 'vs', label: 'Volumen de soluto', symbol: L`V_s`, default: 35, unit: 'mL' },
        { kind: 'number', id: 'vt', label: 'Volumen de disolución', symbol: L`V`, default: 50, unit: 'mL' },
      ],
      compute: (v) => {
        positive(num(v, 'vt'), 'V')
        if (num(v, 'vs') < 0 || num(v, 'vs') > num(v, 'vt')) fail('El volumen de soluto debe estar entre 0 y el volumen total.')
        return { pct: (num(v, 'vs') / num(v, 'vt')) * 100 }
      },
      steps: (v, r) => [{ label: 'Porcentaje', latex: L`\%\,v/v=\frac{${fmt(num(v, 'vs'))}}{${fmt(num(v, 'vt'))}}\times100=${fmt(r.pct)}\%` }],
      answer: (_v, r) => L`${fmt(r.pct)}\%\ v/v`,
      interpret: (_v, r) => [
        { tone: 'good', text: `De cada 100 mL de disolución, $${fmt(r.pct)}$ mL son soluto.` },
        { tone: 'info', text: 'Los volúmenes no siempre se suman exactamente (al mezclar agua y alcohol el total es un poco menor), por eso se usa el volumen **final** de la disolución.' },
      ],
    }),
    calc<{ pct: number }>({
      id: 'mv',
      label: '% m/v',
      example: 'suero fisiológico: 4.5 g de NaCl en 500 mL de disolución.',
      inputs: [
        { kind: 'number', id: 'ms', label: 'Masa de soluto', symbol: L`m_s`, default: 4.5, unit: 'g' },
        { kind: 'number', id: 'vt', label: 'Volumen de disolución', symbol: L`V`, default: 500, unit: 'mL' },
      ],
      compute: (v) => {
        positive(num(v, 'vt'), 'V'); positive(num(v, 'ms'), 'm_s')
        return { pct: (num(v, 'ms') / num(v, 'vt')) * 100 }
      },
      steps: (v, r) => [{ label: 'Porcentaje', latex: L`\%\,m/v=\frac{${fmt(num(v, 'ms'))}${u('g')}}{${fmt(num(v, 'vt'))}${u('mL')}}\times100=${fmt(r.pct)}\%` }],
      answer: (_v, r) => L`${fmt(r.pct)}\%\ m/v`,
      interpret: (_v, r) => [{ tone: 'good', text: `Hay $${fmt(r.pct)}$ g de soluto por cada 100 mL de disolución.` }],
    }),
    calc<{ ppm: number }>({
      id: 'ppm',
      label: 'ppm',
      example: '0.002 g de plomo en 1 kg (1000 g) de agua.',
      inputs: [
        { kind: 'number', id: 'ms', label: 'Masa de soluto', symbol: L`m_s`, default: 0.002, unit: 'g' },
        { kind: 'number', id: 'mt', label: 'Masa de disolución', symbol: L`m`, default: 1000, unit: 'g' },
      ],
      compute: (v) => {
        positive(num(v, 'mt'), 'm')
        if (num(v, 'ms') < 0) fail('La masa de soluto no puede ser negativa.')
        return { ppm: (num(v, 'ms') / num(v, 'mt')) * 1e6 }
      },
      steps: (v, r) => [{ label: 'Partes por millón', latex: L`\text{ppm}=\frac{${fmt(num(v, 'ms'))}}{${fmt(num(v, 'mt'))}}\times10^6=${fmt(r.ppm)}` }],
      answer: (_v, r) => L`${fmt(r.ppm)}\ \text{ppm}`,
      interpret: (_v, r) => [
        { tone: 'good', text: `Hay $${fmt(r.ppm)}$ g de soluto por cada millón de gramos, es decir, $${fmt(r.ppm)}$ mg por kilogramo (en agua, $\\approx ${fmt(r.ppm)}$ mg/L).` },
        { tone: 'info', text: `Como porcentaje sería apenas $${fmt(r.ppm / 1e4)}\\%$: por eso para cantidades tan pequeñas se prefieren las ppm.` },
      ],
    }),
  ],
  commonMistakes: [
    'Dividir entre la masa del disolvente en lugar de la masa total de la disolución.',
    'Mezclar unidades: en % m/v la masa va en gramos y el volumen en mililitros.',
  ],
  related: ['molaridad', 'molalidad', 'dilucion'],
  keywords: ['porcentaje', 'ppm', 'partes por millon', 'masa masa', 'volumen volumen', 'concentracion'],
}

const dilucion: Formula = {
  id: 'dilucion',
  name: 'Dilución',
  category: 'disoluciones',
  latex: L`V_1C_1=V_2C_2`,
  summary: 'Al agregar disolvente cambia la concentración, pero la cantidad de soluto se conserva.',
  goal: 'Saber cuánto de una disolución concentrada (“stock”) tomar para preparar una más diluida.',
  variables: [
    { symbol: 'C_1,\\ V_1', meaning: 'Concentración y volumen de la disolución **concentrada** que tomas' },
    { symbol: 'C_2,\\ V_2', meaning: 'Concentración y volumen **finales** de la disolución diluida' },
  ],
  whenToUse: [
    'Preparar disoluciones a partir de un reactivo concentrado.',
    'Funciona con cualquier unidad de concentración **por volumen** (M, % m/v, % v/v, mg/L) usando la misma en ambos lados. Con % m/m o ppm habría que usar masas en vez de volúmenes (en disoluciones acuosas diluidas la diferencia es pequeña).',
  ],
  intuition: [
    'Agregar agua no crea ni destruye soluto: sólo lo reparte en más volumen. Lo que había al principio ($C_1V_1$) es lo mismo que hay al final ($C_2V_2$).',
    'Si el volumen se multiplica por 4, la concentración se divide entre 4.',
  ],
  derivation: {
    steps: [
      { label: 'Moles de soluto antes de diluir', latex: L`n=C_1V_1` },
      { label: 'Moles después (son los mismos)', latex: L`n=C_2V_2` },
      { label: 'Igualamos', latex: L`C_1V_1=C_2V_2` },
    ],
  },
  calculators: [
    calc<{ V1: number }>({
      id: 'V1',
      label: '¿Cuánto concentrado tomo?',
      example: 'preparar 250 mL de HCl 0.5 M a partir de HCl 2 M.',
      inputs: [
        { kind: 'number', id: 'C1', label: 'Concentración inicial', symbol: 'C_1', default: 2, unit: 'M' },
        { kind: 'number', id: 'C2', label: 'Concentración final', symbol: 'C_2', default: 0.5, unit: 'M' },
        { kind: 'number', id: 'V2', label: 'Volumen final', symbol: 'V_2', default: 250, unit: 'mL' },
      ],
      compute: (v) => {
        positive(num(v, 'C1'), 'C_1'); positive(num(v, 'C2'), 'C_2'); positive(num(v, 'V2'), 'V_2')
        if (num(v, 'C2') > num(v, 'C1')) fail('Diluir sólo baja la concentración: $C_2$ no puede ser mayor que $C_1$.')
        return { V1: (num(v, 'C2') * num(v, 'V2')) / num(v, 'C1') }
      },
      steps: (v, r) => [
        { label: 'Despejamos', latex: L`V_1=\frac{C_2V_2}{C_1}` },
        { label: 'Sustituimos', latex: L`V_1=\frac{(${fmt(num(v, 'C2'))})(${fmt(num(v, 'V2'))})}{${fmt(num(v, 'C1'))}}=${fmt(r.V1)}${u('mL')}` },
      ],
      answer: (_v, r) => L`V_1=${fmt(r.V1)}${u('mL')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `Toma $${fmt(r.V1)}\\ \\mathrm{mL}$ de la disolución concentrada y completa con disolvente hasta $${fmt(num(v, 'V2'))}\\ \\mathrm{mL}$.` },
        { tone: 'info', text: `La concentración bajó $${fmt(num(v, 'C1') / num(v, 'C2'), 2)}$ veces, justo lo que creció el volumen.` },
        { tone: 'warn', text: 'Con ácidos concentrados, agrega siempre el **ácido al agua** y no al revés: la mezcla libera calor.' },
      ],
    }),
    calc<{ C2: number }>({
      id: 'C2',
      label: 'Concentración final',
      example: 'diluir 50 mL de una disolución 1.2 M hasta 300 mL.',
      inputs: [
        { kind: 'number', id: 'C1', label: 'Concentración inicial', symbol: 'C_1', default: 1.2, unit: 'M' },
        { kind: 'number', id: 'V1', label: 'Volumen inicial', symbol: 'V_1', default: 50, unit: 'mL' },
        { kind: 'number', id: 'V2', label: 'Volumen final', symbol: 'V_2', default: 300, unit: 'mL' },
      ],
      compute: (v) => {
        positive(num(v, 'C1'), 'C_1'); positive(num(v, 'V1'), 'V_1'); positive(num(v, 'V2'), 'V_2')
        if (num(v, 'V2') < num(v, 'V1')) fail('Al diluir el volumen final debe ser mayor o igual que el inicial.')
        return { C2: (num(v, 'C1') * num(v, 'V1')) / num(v, 'V2') }
      },
      steps: (v, r) => [
        { label: 'Despejamos', latex: L`C_2=\frac{C_1V_1}{V_2}` },
        { label: 'Sustituimos', latex: L`C_2=\frac{(${fmt(num(v, 'C1'))})(${fmt(num(v, 'V1'))})}{${fmt(num(v, 'V2'))}}=${fmt(r.C2)}${u('M')}` },
      ],
      answer: (_v, r) => L`C_2=${fmt(r.C2)}${u('M')}`,
      interpret: (v, r) => [{ tone: 'good', text: `Al pasar de $${fmt(num(v, 'V1'))}$ a $${fmt(num(v, 'V2'))}\\ \\mathrm{mL}$, la concentración baja de $${fmt(num(v, 'C1'))}$ a $${fmt(r.C2)}\\ \\mathrm{M}$.` }],
    }),
  ],
  commonMistakes: [
    'Creer que $V_1$ es el agua que hay que agregar: el agua es $V_2 - V_1$ (aproximadamente).',
    'Usar unidades distintas de concentración o de volumen en cada lado.',
  ],
  related: ['molaridad', 'porcentajes-concentracion'],
  keywords: ['diluir', 'stock', 'v1c1', 'concentracion final', 'aforar'],
}

// ═══ Estructura atómica ══════════════════════════════════════════════════════

const foton: Formula = {
  id: 'energia-foton',
  name: 'Energía de un fotón',
  category: 'atomica',
  latex: L`E=hf=\frac{hc}{\lambda}`,
  summary: 'La luz llega en paquetes (fotones) cuya energía depende sólo de su frecuencia.',
  goal: 'Calcular cuánta energía transporta cada “paquete” de luz de cierto color o longitud de onda.',
  variables: [
    { symbol: 'E', meaning: 'Energía de un fotón', unit: 'J' },
    { symbol: 'h', meaning: 'Constante de Planck, $6.626\\times10^{-34}$', unit: 'J·s' },
    { symbol: 'f', meaning: 'Frecuencia (en el formulario también $\\nu$)', unit: 'Hz' },
    { symbol: L`\lambda`, meaning: 'Longitud de onda', unit: 'm' },
    { symbol: 'c', meaning: 'Velocidad de la luz, $3\\times10^8$', unit: 'm/s' },
  ],
  whenToUse: ['Espectroscopía, efecto fotoeléctrico, fotosíntesis, por qué la luz UV daña la piel y la visible no.'],
  intuition: [
    'Planck propuso que la energía de la luz no es continua: viene en paquetes de tamaño $hf$. Más frecuencia significa paquetes más energéticos.',
    'Como $f = c/\\lambda$, a **menor** longitud de onda, **mayor** energía. Un fotón violeta tiene casi el doble de energía que uno rojo, y uno UV tiene suficiente para romper enlaces químicos.',
  ],
  calculators: [
    calc<{ lm: number; f: number; E: number }>({
      id: 'E',
      label: 'Desde la longitud de onda',
      example: 'luz verde de 500 nm.',
      inputs: [{ kind: 'number', id: 'nm', label: 'Longitud de onda', symbol: L`\lambda`, default: 500, unit: 'nm' }],
      compute: (v) => {
        positive(num(v, 'nm'), '\\lambda')
        const lm = num(v, 'nm') * 1e-9, f = c / lm
        return { lm, f, E: h * f }
      },
      steps: (v, r) => [
        { label: 'Longitud de onda en metros', latex: L`\lambda=${fmt(num(v, 'nm'))}\times10^{-9}${u('m')}=${fmt(r.lm)}${u('m')}` },
        { label: 'Frecuencia', latex: L`f=\frac{c}{\lambda}=\frac{3\times10^{8}}{${fmt(r.lm)}}=${fmt(r.f)}${u('Hz')}` },
        { label: 'Energía', latex: L`E=hf=(6.626\times10^{-34})(${fmt(r.f)})=${fmt(r.E)}${u('J')}` },
        { label: 'En electronvolts', latex: L`E=\frac{${fmt(r.E)}}{1.602\times10^{-19}}=${fmt(r.E / eV)}${u('eV')}` },
      ],
      answer: (_v, r) => L`E=${fmt(r.E)}${u('J')}=${fmt(r.E / eV)}${u('eV')}`,
      extras: (_v, r) => [
        { label: 'Frecuencia', latex: L`${fmt(r.f)}${u('Hz')}` },
        { label: 'Por mol de fotones', latex: L`${fmt((r.E * NA) / 1000)}${u('kJ/mol')}` },
      ],
      interpret: (v, r) => [
        { tone: 'good', text: `Es ${spectrumRegion(num(v, 'nm'))}. Cada fotón lleva $${fmt(r.E / eV)}\\ \\mathrm{eV}$.` },
        { tone: 'info', text: `Un mol de estos fotones transporta $${fmt((r.E * NA) / 1000, 1)}\\ \\mathrm{kJ}$.` + bondWords((r.E * NA) / 1000) },
      ],
      visual: (v) => ({ type: 'spectrum', nm: num(v, 'nm') }),
    }),
  ],
  commonMistakes: [
    'Olvidar convertir nanómetros a metros ($1\\ \\mathrm{nm} = 10^{-9}\\ \\mathrm{m}$).',
    'Pensar que más intensidad (más brillo) significa fotones más energéticos: más intensidad es **más fotones**, no fotones más fuertes.',
  ],
  related: ['efecto-fotoelectrico', 'series-espectrales', 'ondas'],
  keywords: ['planck', 'foton', 'cuanto', 'luz', 'electronvolt', 'frecuencia'],
}

const fotoelectrico: Formula = {
  id: 'efecto-fotoelectrico',
  name: 'Efecto fotoeléctrico',
  category: 'atomica',
  latex: L`E_F=W_0+E_c`,
  forms: [
    { label: 'Desarrollado', latex: L`hf=hf_0+\tfrac12mv^2` },
    { label: 'Función trabajo', latex: L`W_0=hf_0` },
  ],
  summary: 'La luz arranca electrones de un metal sólo si cada fotón supera una energía mínima; el sobrante se vuelve energía cinética.',
  goal: 'Predecir si una luz logra arrancar electrones de un metal y con qué velocidad salen.',
  variables: [
    { symbol: 'E_F', meaning: 'Energía del fotón, $hf$', unit: 'J' },
    { symbol: 'W_0', meaning: 'Función trabajo: energía mínima para arrancar un electrón (depende del metal)', unit: 'eV' },
    { symbol: 'f_0', meaning: 'Frecuencia umbral, $W_0/h$', unit: 'Hz' },
    { symbol: 'E_c', meaning: 'Energía cinética máxima del electrón que sale', unit: 'J' },
  ],
  whenToUse: ['Celdas solares, sensores de luz, fotomultiplicadores. Fue la prueba de que la luz se comporta como partículas (Einstein, Nobel 1921).'],
  intuition: [
    'Un fotón le entrega toda su energía a **un** electrón. Si no alcanza la función trabajo $W_0$, el electrón no sale, **sin importar cuánta luz** haya: muchos fotones débiles no suman entre sí.',
    'Si la supera, lo que sobra ($E_F - W_0$) se lo lleva el electrón como energía cinética.',
    'Más intensidad (más fotones) arranca **más** electrones, pero no más rápidos. Más frecuencia los saca más rápidos.',
  ],
  calculators: [
    calc<{ Ef: number; Ec: number; v: number | null; l0: number }>({
      id: 'Ec',
      label: 'Energía y velocidad del electrón',
      example: 'luz UV de 250 nm sobre zinc ($W_0 \\approx 4.3$ eV).',
      inputs: [
        { kind: 'number', id: 'nm', label: 'Longitud de onda', symbol: L`\lambda`, default: 250, unit: 'nm' },
        { kind: 'number', id: 'W0', label: 'Función trabajo', symbol: 'W_0', default: 4.3, unit: 'eV' },
      ],
      compute: (v) => {
        positive(num(v, 'nm'), '\\lambda'); positive(num(v, 'W0'), 'W_0')
        const Ef = (h * c) / (num(v, 'nm') * 1e-9) / eV
        const Ec = Ef - num(v, 'W0')
        return { Ef, Ec, v: Ec > 0 ? Math.sqrt((2 * Ec * eV) / me) : null, l0: (h * c) / (num(v, 'W0') * eV) * 1e9 }
      },
      steps: (v, r) => {
        const s = [
          { label: 'Energía del fotón', latex: L`E_F=\frac{hc}{\lambda}=\frac{(6.626\times10^{-34})(3\times10^8)}{${fmt(num(v, 'nm'))}\times10^{-9}}=${fmt(r.Ef)}${u('eV')}` },
          { label: 'Restamos la función trabajo', latex: L`E_c=E_F-W_0=${fmt(r.Ef)}-${fmt(num(v, 'W0'))}=${fmt(r.Ec)}${u('eV')}` },
        ]
        if (r.v !== null) s.push({ label: 'Velocidad del electrón', latex: L`v=\sqrt{\frac{2E_c}{m_e}}=\sqrt{\frac{2(${fmt(r.Ec * eV)})}{9.109\times10^{-31}}}=${fmt(r.v)}${u('m/s')}` })
        s.push({ label: 'Longitud de onda umbral (la máxima que todavía arranca electrones)', latex: L`\lambda_0=\frac{hc}{W_0}=${fmt(r.l0)}${u('nm')}` })
        return s
      },
      answer: (_v, r) => r.Ec > 0 ? L`E_c=${fmt(r.Ec)}${u('eV')}` : L`\text{No se emiten electrones}`,
      extras: (_v, r) => [
        { label: 'Fotón', latex: L`${fmt(r.Ef)}${u('eV')}` },
        { label: 'Umbral', latex: L`\lambda_0=${fmt(r.l0)}${u('nm')}` },
        ...(r.v !== null ? [{ label: 'Velocidad', latex: L`${fmt(r.v)}${u('m/s')}` }] : []),
      ],
      interpret: (v, r) => r.Ec > 0
        ? [
            { tone: 'good', text: `Cada fotón trae $${fmt(r.Ef)}\\ \\mathrm{eV}$; se gastan $${fmt(num(v, 'W0'))}$ en arrancar el electrón y los $${fmt(r.Ec)}$ restantes son su energía cinética.` },
            { tone: 'info', text: `Funciona con cualquier luz de menos de $${fmt(r.l0, 0)}\\ \\mathrm{nm}$. Más brillo sólo arrancaría más electrones, no más rápidos.` },
          ]
        : [
            { tone: 'warn', text: `El fotón ($${fmt(r.Ef)}\\ \\mathrm{eV}$) no alcanza la función trabajo ($${fmt(num(v, 'W0'))}\\ \\mathrm{eV}$): **no sale ningún electrón**, por intensa que sea la luz.` },
            { tone: 'info', text: `Necesitas luz de menos de $${fmt(r.l0, 0)}\\ \\mathrm{nm}$.` },
          ],
      visual: (v) => ({ type: 'spectrum', nm: num(v, 'nm') }),
    }),
  ],
  commonMistakes: [
    'Mezclar joules y electronvolts: $1\\ \\mathrm{eV} = 1.602\\times10^{-19}\\ \\mathrm{J}$.',
    'Creer que aumentar la intensidad compensa una frecuencia demasiado baja.',
  ],
  related: ['energia-foton', 'energia-cinetica'],
  keywords: ['einstein', 'funcion trabajo', 'umbral', 'fotones', 'electrones', 'celda solar'],
}

interface RydbergResult { inv: number; nm: number; dE: number; series: string }
const SERIES = ['', 'Lyman', 'Balmer', 'Paschen', 'Brackett', 'Pfund', 'Humphreys']

const seriesEspectrales: Formula = {
  id: 'series-espectrales',
  name: 'Series espectrales del hidrógeno (Rydberg)',
  category: 'atomica',
  latex: L`\frac{1}{\lambda}=R_H\left(\frac{1}{n_f^2}-\frac{1}{n_i^2}\right)`,
  forms: [
    { label: 'Constante de Rydberg', latex: L`R_H=109\,677\ \mathrm{cm^{-1}}` },
    { label: 'Cambio de energía del átomo', latex: L`\Delta E=2.179\times10^{-18}\left(\frac{1}{n_i^2}-\frac{1}{n_f^2}\right)\ \mathrm{J}` },
  ],
  summary: 'La longitud de onda de la luz que emite un átomo de hidrógeno cuando su electrón baja de un nivel de energía a otro.',
  goal: 'Explicar por qué el hidrógeno emite sólo ciertos colores (líneas espectrales) y calcular cuáles.',
  variables: [
    { symbol: L`\lambda`, meaning: 'Longitud de onda de la luz emitida o absorbida' },
    { symbol: 'R_H', meaning: 'Constante de Rydberg del hidrógeno' },
    { symbol: 'n_i', meaning: 'Nivel inicial del electrón (1, 2, 3…)' },
    { symbol: 'n_f', meaning: 'Nivel final del electrón' },
  ],
  whenToUse: [
    'Átomo de hidrógeno (y otros átomos con un solo electrón, ajustando la constante).',
    'Identificar líneas en un espectro: las primeras líneas de la serie de Balmer ($n_f = 2$) caen en el visible.',
  ],
  intuition: [
    'En el modelo de Bohr, el electrón sólo puede estar en ciertos niveles de energía, como los peldaños de una escalera. No hay posiciones intermedias.',
    'Al **bajar** de un peldaño a otro, el electrón suelta exactamente la diferencia de energía como un fotón. Como sólo hay ciertos peldaños, sólo salen ciertos colores.',
    'Los niveles se juntan cada vez más arriba ($1/n^2$), por eso las líneas de cada serie se amontonan hacia una longitud de onda límite.',
  ],
  calculators: [
    calc<RydbergResult>({
      id: 'lambda',
      label: 'Calcular λ',
      example: 'el electrón baja del nivel 3 al 2: la línea roja H-α del hidrógeno.',
      inputs: [
        { kind: 'number', id: 'ni', label: 'Nivel inicial', symbol: 'n_i', default: 3, step: 1 },
        { kind: 'number', id: 'nf', label: 'Nivel final', symbol: 'n_f', default: 2, step: 1 },
      ],
      compute: (v) => {
        const ni = num(v, 'ni'), nf = num(v, 'nf')
        requireInt(ni, 'n_i', 1); requireInt(nf, 'n_f', 1)
        if (ni === nf) fail('Los niveles deben ser distintos: si no hay salto, no hay fotón.')
        const inv = RH_CM * Math.abs(1 / nf ** 2 - 1 / ni ** 2) // cm⁻¹
        const low = Math.min(ni, nf)
        return { inv, nm: 1e7 / inv, dE: 2.179e-18 * (1 / ni ** 2 - 1 / nf ** 2), series: SERIES[low] ?? `n = ${low}` }
      },
      steps: (v, r) => {
        const ni = num(v, 'ni'), nf = num(v, 'nf')
        return [
          { label: 'Sustituimos los niveles', latex: L`\frac1\lambda=109\,677\left(\frac{1}{${nf}^2}-\frac{1}{${ni}^2}\right)=109\,677\,(${fmt(1 / nf ** 2 - 1 / ni ** 2)})=${fmt(r.inv * Math.sign(1 / nf ** 2 - 1 / ni ** 2))}${u('cm^{-1}')}` },
          { label: 'Invertimos (en valor absoluto) y pasamos a nm', latex: L`\lambda=\frac{1}{${fmt(r.inv)}}${u('cm')}=${fmt(1 / r.inv)}${u('cm')}=${fmt(r.nm, 1)}${u('nm')}` },
          { label: 'Cambio de energía del átomo (negativo: pierde energía y emite)', latex: L`\Delta E=2.179\times10^{-18}\,(${fmt(1 / ni ** 2 - 1 / nf ** 2)})=${fmt(r.dE)}${u('J')}=${fmt(r.dE / eV)}${u('eV')}` },
        ]
      },
      answer: (_v, r) => L`\lambda=${fmt(r.nm, 1)}${u('nm')}`,
      extras: (_v, r) => [
        { label: 'Serie', latex: L`\text{${r.series}}` },
        { label: 'Energía', latex: L`|\Delta E|=${fmt(Math.abs(r.dE / eV))}${u('eV')}` },
      ],
      interpret: (v, r) => {
        const ni = num(v, 'ni'), nf = num(v, 'nf')
        const out: Interpretation[] = [
          ni > nf
            ? { tone: 'good', text: `El electrón **baja** del nivel ${ni} al ${nf} y **emite** un fotón de $${fmt(r.nm, 1)}\\ \\mathrm{nm}$: ${spectrumRegion(r.nm)}.` }
            : { tone: 'good', text: `El electrón **sube** del nivel ${ni} al ${nf}: para eso **absorbe** un fotón de exactamente $${fmt(r.nm, 1)}\\ \\mathrm{nm}$ (${spectrumRegion(r.nm)}).` },
          { tone: 'info', text: `Pertenece a la serie de **${r.series}** (transiciones que terminan o empiezan en $n = ${Math.min(ni, nf)}$).` + (Math.min(ni, nf) === 2 ? (r.nm >= 380 && r.nm <= 750 ? ' Es la única serie del hidrógeno con líneas visibles.' : ' Sus primeras líneas son visibles, pero ésta ya cae en el ultravioleta.') : '') },
        ]
        return out
      },
      visual: (v, r) => ({ type: 'levels', ni: num(v, 'ni'), nf: num(v, 'nf'), nm: r.nm }),
    }),
  ],
  commonMistakes: [
    'Confundir el signo: $\\Delta E < 0$ significa que el átomo pierde energía y **emite** luz; $\\Delta E > 0$, que la **absorbe**. La longitud de onda es la misma en ambos casos.',
    'Olvidar que $R_H$ está en $\\mathrm{cm^{-1}}$: el resultado de $1/\\lambda$ queda en $\\mathrm{cm^{-1}}$.',
    'Aplicarla a átomos con varios electrones: sólo es exacta para el hidrógeno.',
  ],
  related: ['energia-foton'],
  keywords: ['bohr', 'rydberg', 'balmer', 'lyman', 'paschen', 'espectro', 'niveles de energia', 'linea espectral'],
}

const deBroglie: Formula = {
  id: 'de-broglie',
  name: 'Longitud de onda de De Broglie',
  category: 'atomica',
  latex: L`\lambda=\frac{h}{mv}`,
  summary: 'Toda partícula en movimiento tiene asociada una onda; su longitud depende de su cantidad de movimiento.',
  goal: 'Saber cuándo una partícula se comporta como onda: cuando su longitud de onda es comparable con el tamaño de lo que la rodea.',
  variables: [
    { symbol: L`\lambda`, meaning: 'Longitud de onda asociada', unit: 'm' },
    { symbol: 'h', meaning: 'Constante de Planck', unit: 'J·s' },
    { symbol: 'm', meaning: 'Masa de la partícula', unit: 'kg' },
    { symbol: 'v', meaning: 'Velocidad', unit: 'm/s' },
  ],
  whenToUse: ['Electrones en átomos, microscopios electrónicos, difracción de partículas.'],
  intuition: [
    'Si la luz (una onda) puede comportarse como partícula, De Broglie propuso lo inverso: las partículas también pueden comportarse como ondas.',
    'Como $h$ es diminuta, sólo las partículas muy ligeras (electrones) tienen ondas apreciables. Una pelota tiene una longitud de onda absurdamente pequeña, por eso nunca vemos su lado ondulatorio.',
  ],
  calculators: [
    calc<{ p: number; l: number }>({
      id: 'lambda',
      label: 'Calcular λ',
      example: 'un electrón a $10^6$ m/s.',
      inputs: [
        { kind: 'number', id: 'm', label: 'Masa', symbol: 'm', default: 9.109e-31, unit: 'kg' },
        { kind: 'number', id: 'v', label: 'Velocidad', symbol: 'v', default: 1e6, unit: 'm/s' },
      ],
      compute: (v) => {
        positive(num(v, 'm'), 'm'); positive(num(v, 'v'), 'v')
        const p = num(v, 'm') * num(v, 'v')
        return { p, l: h / p }
      },
      steps: (v, r) => [
        { label: 'Cantidad de movimiento', latex: L`p=mv=(${fmt(num(v, 'm'))})(${fmt(num(v, 'v'))})=${fmt(r.p)}${u(L`kg\cdot m/s`)}` },
        { label: 'Longitud de onda', latex: L`\lambda=\frac{6.626\times10^{-34}}{${fmt(r.p)}}=${fmt(r.l)}${u('m')}` },
      ],
      answer: (_v, r) => L`\lambda=${fmt(r.l)}${u('m')}`,
      extras: (_v, r) => [{ label: 'En nm', latex: L`${fmt(r.l * 1e9)}${u('nm')}` }],
      interpret: (_v, r) => [
        r.l > 1e-11
          ? { tone: 'good', text: `$\\lambda = ${fmt(r.l * 1e9)}\\ \\mathrm{nm}$ es comparable con el tamaño de un átomo (≈ 0.1 nm): esta partícula se comporta claramente como **onda**. Por eso los electrones forman orbitales y no órbitas.` }
          : { tone: 'good', text: `$\\lambda = ${fmt(r.l)}\\ \\mathrm{m}$ es muchísimo más pequeña que un átomo: su comportamiento ondulatorio es imperceptible y la física clásica basta.` },
        { tone: 'info', text: `Como comparación, una pelota de béisbol (0.145 kg) a 40 m/s tiene $\\lambda \\approx ${fmt(h / (0.145 * 40))}\\ \\mathrm{m}$.` },
      ],
    }),
  ],
  commonMistakes: ['Usar la masa en gramos.', 'Usarla con velocidades cercanas a la de la luz sin corrección relativista.'],
  related: ['incertidumbre-heisenberg', 'energia-foton', 'impulso-momento'],
  keywords: ['dualidad onda particula', 'electron', 'onda de materia', 'de broglie'],
}

const heisenberg: Formula = {
  id: 'incertidumbre-heisenberg',
  name: 'Principio de incertidumbre de Heisenberg',
  category: 'atomica',
  latex: L`\Delta x\cdot\Delta p\ge\frac{h}{4\pi}`,
  summary: 'No se puede conocer con precisión total, al mismo tiempo, dónde está una partícula y qué tan rápido se mueve.',
  goal: 'Calcular la incertidumbre mínima en la velocidad de una partícula cuando la confinamos en cierto espacio.',
  variables: [
    { symbol: L`\Delta x`, meaning: 'Incertidumbre en la posición', unit: 'm' },
    { symbol: L`\Delta p`, meaning: 'Incertidumbre en la cantidad de movimiento ($m\\Delta v$)', unit: 'kg·m/s' },
    { symbol: 'h', meaning: 'Constante de Planck' },
  ],
  whenToUse: ['Entender por qué el modelo de órbitas fijas no funciona y se usan orbitales (nubes de probabilidad).'],
  intuition: [
    'No es un problema de instrumentos: es una propiedad de la naturaleza. Cuanto más precisa es la posición, más “borrosa” queda la velocidad, y viceversa.',
    'Para objetos cotidianos la incertidumbre es despreciable. Para un electrón dentro de un átomo es enorme, por eso no tiene una trayectoria definida.',
  ],
  calculators: [
    calc<{ dp: number; dv: number }>({
      id: 'dv',
      label: 'Incertidumbre mínima en la velocidad',
      example: 'un electrón confinado en un átomo ($\\Delta x \\approx 10^{-10}$ m).',
      inputs: [
        { kind: 'number', id: 'dx', label: 'Incertidumbre en posición', symbol: L`\Delta x`, default: 1e-10, unit: 'm' },
        { kind: 'number', id: 'm', label: 'Masa', symbol: 'm', default: 9.109e-31, unit: 'kg' },
      ],
      compute: (v) => {
        positive(num(v, 'dx'), '\\Delta x'); positive(num(v, 'm'), 'm')
        const dp = h / (4 * Math.PI * num(v, 'dx'))
        return { dp, dv: dp / num(v, 'm') }
      },
      steps: (v, r) => [
        { label: 'Despejamos Δp (valor mínimo)', latex: L`\Delta p\ge\frac{h}{4\pi\,\Delta x}=\frac{6.626\times10^{-34}}{4\pi(${fmt(num(v, 'dx'))})}=${fmt(r.dp)}${u(L`kg\cdot m/s`)}` },
        { label: 'Dividimos entre la masa', latex: L`\Delta v\ge\frac{\Delta p}{m}=\frac{${fmt(r.dp)}}{${fmt(num(v, 'm'))}}=${fmt(r.dv)}${u('m/s')}` },
      ],
      answer: (_v, r) => L`\Delta v\ge${fmt(r.dv)}${u('m/s')}`,
      interpret: (_v, r) => [
        r.dv > 1e3
          ? { tone: 'good', text: `La velocidad no se puede conocer con menos de $${fmt(r.dv)}\\ \\mathrm{m/s}$ de incertidumbre: enorme. No tiene sentido hablar de una trayectoria precisa; por eso describimos al electrón con orbitales.` }
          : { tone: 'good', text: `La incertidumbre mínima en la velocidad es $${fmt(r.dv)}\\ \\mathrm{m/s}$: despreciable para fines prácticos.` },
      ],
    }),
  ],
  commonMistakes: ['Pensar que se debe a instrumentos imprecisos: es un límite fundamental.', 'Olvidar dividir entre la masa para obtener la velocidad.'],
  related: ['de-broglie'],
  keywords: ['heisenberg', 'incertidumbre', 'cuantica', 'orbital'],
}

const momentoMagnetico: Formula = {
  id: 'momento-magnetico',
  name: 'Momento magnético (sólo espín)',
  category: 'atomica',
  latex: L`\mu=\sqrt{n(n+2)}`,
  summary: 'Estima el magnetismo de un átomo o ion a partir de sus electrones no apareados.',
  goal: 'Relacionar la configuración electrónica con lo que se mide en el laboratorio: qué tan atraída es una sustancia por un imán.',
  variables: [
    { symbol: L`\mu`, meaning: 'Momento magnético, en magnetones de Bohr (M.B.)' },
    { symbol: 'n', meaning: 'Número de electrones **no apareados**' },
  ],
  whenToUse: ['Complejos de metales de transición: deducir cuántos electrones desapareados tiene un ion a partir de su momento medido.'],
  intuition: [
    'Cada electrón se comporta como un pequeño imán (su espín). Cuando están en pareja, sus espines son opuestos y se cancelan.',
    'Sólo los electrones solitarios aportan magnetismo: con $n = 0$ la sustancia es **diamagnética** (el imán la repele débilmente) y con $n > 0$ es **paramagnética** (la atrae).',
  ],
  calculators: [
    calc<{ mu: number }>({
      id: 'mu',
      label: 'Calcular μ',
      example: 'ion $\\mathrm{Mn^{2+}}$ o $\\mathrm{Fe^{3+}}$ de alto espín, con 5 electrones desapareados.',
      inputs: [{ kind: 'number', id: 'n', label: 'Electrones no apareados', symbol: 'n', default: 5, step: 1 }],
      compute: (v) => {
        requireInt(num(v, 'n'), 'n', 0)
        return { mu: Math.sqrt(num(v, 'n') * (num(v, 'n') + 2)) }
      },
      steps: (v, r) => [{ label: 'Sustituimos', latex: L`\mu=\sqrt{${num(v, 'n')}(${num(v, 'n')}+2)}=\sqrt{${num(v, 'n') * (num(v, 'n') + 2)}}=${fmt(r.mu, 2)}\ \text{M.B.}` }],
      answer: (_v, r) => L`\mu=${fmt(r.mu, 2)}\ \text{M.B.}`,
      interpret: (v, r) => [
        num(v, 'n') === 0
          ? { tone: 'good', text: 'Todos los electrones están apareados: la sustancia es **diamagnética** (un imán la repele débilmente).' }
          : { tone: 'good', text: `Con ${num(v, 'n')} electrón(es) desapareado(s) la sustancia es **paramagnética**: un imán la atrae, con un momento de unos $${fmt(r.mu, 2)}$ M.B.` },
        { tone: 'info', text: 'Es la aproximación de “sólo espín”: ignora la contribución orbital, así que el valor medido puede diferir un poco.' },
      ],
    }),
  ],
  commonMistakes: ['Contar todos los electrones de valencia en lugar de sólo los no apareados.'],
  related: ['series-espectrales'],
  keywords: ['magnetismo', 'paramagnetico', 'diamagnetico', 'espin', 'magneton de bohr'],
}

// ═══ Electroquímica ══════════════════════════════════════════════════════════

const faraday: Formula = {
  id: 'leyes-faraday',
  name: 'Leyes de Faraday (electrólisis)',
  category: 'electroquimica',
  latex: L`m=\frac{MIt}{zF}`,
  summary: 'Cuánta masa se deposita o se libera en un electrodo al hacer pasar cierta corriente durante cierto tiempo.',
  goal: 'Calcular la masa de metal que se deposita en un recubrimiento (galvanoplastia) o que se produce en una electrólisis.',
  variables: [
    { symbol: 'm', meaning: 'Masa depositada', unit: 'g' },
    { symbol: 'M', meaning: 'Masa molar de la sustancia', unit: 'g/mol' },
    { symbol: 'I', meaning: 'Corriente', unit: 'A' },
    { symbol: 't', meaning: 'Tiempo', unit: 's' },
    { symbol: 'z', meaning: 'Electrones transferidos por ion (carga del ion)' },
    { symbol: 'F', meaning: 'Constante de Faraday: carga de un mol de electrones, $96\\,485$', unit: 'C/mol' },
  ],
  whenToUse: ['Galvanoplastia (cromado, dorado), refinación de cobre, producción de aluminio, cloro e hidrógeno.'],
  intuition: [
    'La corriente es un flujo de electrones. Contando cuántos electrones pasaron ($Q = It$) sabemos cuántos iones se pudieron reducir.',
    'Si cada ion necesita $z$ electrones (el $\\mathrm{Cu^{2+}}$ necesita 2), con el mismo flujo se depositan menos átomos que si necesitara uno solo.',
  ],
  derivation: {
    steps: [
      { label: 'Carga que circula', latex: L`Q=It` },
      { label: 'Moles de electrones', latex: L`n_{e^-}=\frac{Q}{F}=\frac{It}{F}` },
      { label: 'Cada ion necesita z electrones', latex: L`n_{\text{metal}}=\frac{It}{zF}` },
      { label: 'Pasamos a gramos', latex: L`m=n_{\text{metal}}\cdot M=\frac{MIt}{zF}` },
    ],
  },
  calculators: [
    calc<{ ts: number; Q: number; ne: number; m: number }>({
      id: 'm',
      label: 'Masa depositada',
      example: 'depositar cobre ($\\mathrm{Cu^{2+}}$, 63.55 g/mol) con 2 A durante 30 minutos.',
      inputs: [
        { kind: 'number', id: 'I', label: 'Corriente', symbol: 'I', default: 2, unit: 'A' },
        { kind: 'number', id: 'tmin', label: 'Tiempo', symbol: 't', default: 30, unit: 'min' },
        { kind: 'number', id: 'M', label: 'Masa molar', symbol: 'M', default: 63.55, unit: 'g/mol' },
        { kind: 'number', id: 'z', label: 'Electrones por ion', symbol: 'z', default: 2, step: 1 },
      ],
      compute: (v) => {
        positive(num(v, 'I'), 'I'); positive(num(v, 'tmin'), 't'); positive(num(v, 'M'), 'M')
        requireInt(num(v, 'z'), 'z', 1)
        const ts = num(v, 'tmin') * 60, Q = num(v, 'I') * ts, ne = Q / F
        return { ts, Q, ne, m: (ne / num(v, 'z')) * num(v, 'M') }
      },
      steps: (v, r) => [
        { label: 'Tiempo en segundos', latex: L`t=${fmt(num(v, 'tmin'))}\times60=${fmt(r.ts)}${u('s')}` },
        { label: 'Carga', latex: L`Q=It=(${fmt(num(v, 'I'))})(${fmt(r.ts)})=${fmt(r.Q)}${u('C')}` },
        { label: 'Moles de electrones', latex: L`n_{e^-}=\frac{${fmt(r.Q)}}{96\,485}=${fmt(r.ne)}${u('mol')}` },
        { label: 'Masa', latex: L`m=\frac{${fmt(r.ne)}}{${num(v, 'z')}}\times${fmt(num(v, 'M'))}=${fmt(r.m)}${u('g')}` },
      ],
      answer: (_v, r) => L`m=${fmt(r.m)}${u('g')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `En $${fmt(num(v, 'tmin'))}$ minutos se depositan $${fmt(r.m)}\\ \\mathrm{g}$ en el cátodo (suponiendo que toda la corriente se usa en esta reacción).` },
        { tone: 'info', text: `Para depositar el doble necesitarías el doble de tiempo o el doble de corriente: la masa es proporcional a la carga $Q = It$.` },
      ],
    }),
  ],
  commonMistakes: ['Dejar el tiempo en minutos u horas.', 'Usar $z = 1$ para iones como $\\mathrm{Cu^{2+}}$ o $\\mathrm{Al^{3+}}$.'],
  related: ['potencial-celda', 'ley-de-ohm'],
  keywords: ['electrolisis', 'galvanoplastia', 'faraday', 'deposito', 'electroquimica'],
}

const potencialCelda: Formula = {
  id: 'potencial-celda',
  name: 'Potencial de celda y energía libre',
  category: 'electroquimica',
  latex: L`E^\circ_{\text{celda}}=E^\circ_{\text{cátodo}}-E^\circ_{\text{ánodo}}`,
  forms: [
    { label: 'Energía libre', latex: L`\Delta G^\circ=-nFE^\circ_{\text{celda}}` },
    { label: 'Constante de equilibrio (25 °C)', latex: L`\log K=\frac{nE^\circ_{\text{celda}}}{0.0592}` },
  ],
  summary: 'El voltaje de una pila se obtiene de los potenciales estándar de reducción, y su signo dice si la reacción es espontánea.',
  goal: 'Predecir el voltaje de una pila y si la reacción ocurrirá sola, usando la tabla de potenciales estándar.',
  variables: [
    { symbol: L`E^\circ`, meaning: 'Potencial estándar de reducción (tabla §3.3 del formulario)', unit: 'V' },
    { symbol: L`\text{cátodo}`, meaning: 'Electrodo donde ocurre la **reducción** (gana electrones)' },
    { symbol: L`\text{ánodo}`, meaning: 'Electrodo donde ocurre la **oxidación** (pierde electrones)' },
    { symbol: 'n', meaning: 'Electrones transferidos en la reacción balanceada' },
    { symbol: L`\Delta G^\circ`, meaning: 'Energía libre estándar: negativa significa espontánea', unit: 'J/mol' },
  ],
  whenToUse: ['Pilas y baterías, corrosión, predecir si un metal desplaza a otro de una disolución.'],
  intuition: [
    'Cada semirreacción tiene una “tendencia a reducirse” ($E^\\circ$). En una pila compiten: la de mayor $E^\\circ$ se reduce (cátodo) y obliga a la otra a oxidarse (ánodo).',
    'La diferencia entre las dos tendencias es el voltaje. Si es positivo, los electrones fluyen solos y la reacción es espontánea: $\\Delta G^\\circ < 0$.',
    'El potencial es una propiedad **intensiva**: no se multiplica por los coeficientes de la reacción, aunque la semirreacción se multiplique para balancear electrones.',
  ],
  calculators: [
    calc<{ E: number; dG: number; logK: number }>({
      id: 'E',
      label: 'Voltaje, ΔG° y K',
      example: 'pila de Daniell: cobre ($E^\\circ = 0.34$ V) como cátodo y zinc ($E^\\circ = -0.76$ V) como ánodo.',
      inputs: [
        { kind: 'number', id: 'Ec', label: 'E° del cátodo', symbol: L`E^\circ_{cát}`, default: 0.34, unit: 'V' },
        { kind: 'number', id: 'Ea', label: 'E° del ánodo', symbol: L`E^\circ_{án}`, default: -0.76, unit: 'V' },
        { kind: 'number', id: 'n', label: 'Electrones transferidos', symbol: 'n', default: 2, step: 1 },
      ],
      compute: (v) => {
        requireInt(num(v, 'n'), 'n', 1)
        const E = num(v, 'Ec') - num(v, 'Ea')
        return { E, dG: -num(v, 'n') * F * E, logK: (num(v, 'n') * E) / 0.0592 }
      },
      steps: (v, r) => [
        { label: 'Potencial de la celda', latex: L`E^\circ=${fmt(num(v, 'Ec'))}-${fp(num(v, 'Ea'))}=${fmt(r.E)}${u('V')}` },
        { label: 'Energía libre', latex: L`\Delta G^\circ=-(${num(v, 'n')})(96\,485)(${fmt(r.E)})=${fmt(r.dG)}${u('J/mol')}=${fmt(r.dG / 1000)}${u('kJ/mol')}` },
        { label: 'Constante de equilibrio', latex: L`\log K=\frac{(${num(v, 'n')})(${fmt(r.E)})}{0.0592}=${fmt(r.logK)}\;\Rightarrow\;K=10^{${fmt(r.logK, 2)}}` },
      ],
      answer: (_v, r) => L`E^\circ_{\text{celda}}=${fmt(r.E)}${u('V')}`,
      extras: (_v, r) => [
        { label: 'ΔG°', latex: L`${fmt(r.dG / 1000)}${u('kJ/mol')}` },
        { label: 'K', latex: L`10^{${fmt(r.logK, 2)}}` },
      ],
      interpret: (_v, r) => [
        r.E > 0
          ? { tone: 'good', text: `$E^\\circ > 0$ y $\\Delta G^\\circ < 0$: la reacción es **espontánea**. La pila entrega $${fmt(r.E)}\\ \\mathrm{V}$ en condiciones estándar.` }
          : r.E < 0
            ? { tone: 'warn', text: `$E^\\circ < 0$: la reacción **no es espontánea** en ese sentido. Ocurre la inversa, o necesitas aplicar al menos $${fmt(-r.E)}\\ \\mathrm{V}$ (electrólisis).` }
            : { tone: 'info', text: 'Con $E^\\circ = 0$ el sistema está en equilibrio en condiciones estándar.' },
        { tone: 'info', text: `$K = 10^{${fmt(r.logK, 1)}}$: ` + (r.logK > 3 ? 'en el equilibrio casi todo son productos.' : r.logK < -3 ? 'en el equilibrio casi todo son reactivos.' : 'en el equilibrio hay cantidades apreciables de reactivos y productos.') },
      ],
    }),
  ],
  commonMistakes: [
    'Multiplicar $E^\\circ$ por los coeficientes estequiométricos.',
    'Restar al revés: es cátodo **menos** ánodo, usando ambos como potenciales de **reducción** de la tabla.',
  ],
  related: ['ecuacion-nernst', 'leyes-faraday'],
  keywords: ['pila', 'bateria', 'potencial estandar', 'redox', 'espontaneidad', 'energia libre', 'daniell'],
}

const nernst: Formula = {
  id: 'ecuacion-nernst',
  name: 'Ecuación de Nernst',
  category: 'electroquimica',
  latex: L`E=E^\circ-\frac{0.0592}{n}\log Q`,
  forms: [{ label: 'A cualquier temperatura', latex: L`E=E^\circ-\frac{2.303\,RT}{nF}\log Q` }],
  summary: 'El voltaje de una pila cuando las concentraciones no son las estándar (1 M).',
  goal: 'Calcular el voltaje real de una pila según qué tan concentrados estén sus reactivos y productos, y entender por qué una pila se “descarga”.',
  variables: [
    { symbol: 'E', meaning: 'Potencial de la celda en las condiciones reales', unit: 'V' },
    { symbol: L`E^\circ`, meaning: 'Potencial estándar de la celda', unit: 'V' },
    { symbol: 'n', meaning: 'Electrones transferidos' },
    { symbol: 'Q', meaning: 'Cociente de reacción: $\\frac{[\\text{productos}]}{[\\text{reactivos}]}$ con sus coeficientes como exponentes (el formulario lo escribe como $k$)' },
    { symbol: '0.0592', meaning: 'Valor de $2.303RT/F$ a 25 °C', unit: 'V' },
  ],
  whenToUse: ['Pilas con concentraciones distintas de 1 M, pilas de concentración, sensores de pH.'],
  intuition: [
    'Mientras la pila funciona, los reactivos se gastan y los productos se acumulan: $Q$ crece, y $E$ baja poco a poco.',
    'Cuando $E$ llega a 0 la pila está “muerta”: alcanzó el equilibrio y en ese momento $Q = K$.',
    'Cada factor de 10 en $Q$ cambia el voltaje sólo $0.0592/n$ V: el efecto de las concentraciones es pequeño pero medible.',
  ],
  calculators: [
    calc<{ E: number; corr: number }>({
      id: 'E',
      label: 'Calcular E',
      example: 'pila de Daniell con $[\\mathrm{Zn^{2+}}] = 0.01$ M y $[\\mathrm{Cu^{2+}}] = 1$ M, así que $Q = 0.01$.',
      inputs: [
        { kind: 'number', id: 'E0', label: 'Potencial estándar', symbol: L`E^\circ`, default: 1.1, unit: 'V' },
        { kind: 'number', id: 'n', label: 'Electrones transferidos', symbol: 'n', default: 2, step: 1 },
        { kind: 'number', id: 'Q', label: 'Cociente de reacción', symbol: 'Q', default: 0.01 },
      ],
      compute: (v) => {
        requireInt(num(v, 'n'), 'n', 1); positive(num(v, 'Q'), 'Q')
        const corr = (0.0592 / num(v, 'n')) * Math.log10(num(v, 'Q'))
        return { corr, E: num(v, 'E0') - corr }
      },
      steps: (v, r) => [
        { label: 'Logaritmo de Q', latex: L`\log(${fmt(num(v, 'Q'))})=${fmt(Math.log10(num(v, 'Q')))}` },
        { label: 'Corrección', latex: L`\frac{0.0592}{${num(v, 'n')}}\cdot(${fmt(Math.log10(num(v, 'Q')))})=${fmt(r.corr)}${u('V')}` },
        { label: 'Potencial', latex: L`E=${fmt(num(v, 'E0'))}-${fp(r.corr)}=${fmt(r.E)}${u('V')}` },
      ],
      answer: (_v, r) => L`E=${fmt(r.E)}${u('V')}`,
      interpret: (v, r) => [
        num(v, 'Q') < 1
          ? { tone: 'good', text: `Con $Q < 1$ (pocos productos) el voltaje es **mayor** que el estándar: $${fmt(r.E)}$ contra $${fmt(num(v, 'E0'))}\\ \\mathrm{V}$.` }
          : num(v, 'Q') > 1
            ? { tone: 'good', text: `Con $Q > 1$ (productos acumulados) el voltaje **baja**: $${fmt(r.E)}$ contra $${fmt(num(v, 'E0'))}\\ \\mathrm{V}$. Así se “descarga” una pila.` }
            : { tone: 'good', text: 'Con $Q = 1$ (todo 1 M) el potencial es exactamente el estándar.' },
        r.E <= 0
          ? { tone: 'warn', text: 'Con $E \\le 0$ la reacción ya no avanza en ese sentido: la pila está agotada o la reacción se invierte.' }
          : { tone: 'info', text: `La pila se agotaría al llegar a $Q = K = 10^{${fmt((num(v, 'n') * num(v, 'E0')) / 0.0592, 1)}}$, cuando $E = 0$.` },
      ],
    }),
  ],
  commonMistakes: [
    'Usar $\\ln$ con $0.0592$: esa constante ya incluye el cambio a logaritmo base 10.',
    'Incluir sólidos o líquidos puros en $Q$: sólo entran especies disueltas (y gases como presión).',
    'Usar 0.0592 a temperaturas distintas de 25 °C.',
  ],
  related: ['potencial-celda', 'ph'],
  keywords: ['nernst', 'concentracion', 'pila', 'cociente de reaccion', 'potencial'],
}

// ═══ Termoquímica y ácido-base ═══════════════════════════════════════════════

const hess: Formula = {
  id: 'ley-de-hess',
  name: 'Ley de Hess (entalpía de reacción)',
  category: 'termoquimica',
  latex: L`\Delta H^\circ_r=\sum n\,\Delta H^\circ_f(\text{productos})-\sum n\,\Delta H^\circ_f(\text{reactivos})`,
  summary: 'El calor de una reacción se calcula con las entalpías de formación de sus productos y reactivos.',
  goal: 'Saber cuánto calor libera o absorbe una reacción sin tener que medirla, usando valores de tablas.',
  variables: [
    { symbol: L`\Delta H^\circ_r`, meaning: 'Entalpía de reacción: calor a presión constante', unit: 'kJ' },
    { symbol: L`\Delta H^\circ_f`, meaning: 'Entalpía estándar de formación de cada sustancia (tabla §3.4)', unit: 'kJ/mol' },
    { symbol: 'n', meaning: 'Coeficiente estequiométrico de la ecuación balanceada' },
  ],
  whenToUse: ['Calores de combustión, poder calorífico de combustibles, balances de energía en procesos químicos.'],
  intuition: [
    'La entalpía es una **función de estado**: sólo importa dónde empiezas y dónde terminas, no el camino.',
    'Así que podemos imaginar un camino cómodo: descomponer los reactivos en sus elementos (lo contrario de formarlos) y luego formar los productos a partir de esos elementos.',
    'Los elementos en su forma más estable (O₂, N₂, C grafito…) tienen $\\Delta H^\\circ_f = 0$ por definición.',
  ],
  calculators: [
    calc<{ Hp: number; Hr: number; dH: number }>({
      id: 'dH',
      label: 'Calcular ΔH°',
      example: 'combustión del metano: $\\mathrm{CH_4 + 2O_2 \\to CO_2 + 2H_2O(l)}$, con $\\Delta H^\\circ_f$: CO₂ −393.5, H₂O(l) −285.8, CH₄ −74.8, O₂ 0 kJ/mol.',
      inputs: [
        { kind: 'pairs', id: 'prod', label: 'Productos', symbol: L`\text{prod.}`, xLabel: 'n', yLabel: L`\Delta H^\circ_f`, default: [[1, -393.5], [2, -285.8]] },
        { kind: 'pairs', id: 'reac', label: 'Reactivos', symbol: L`\text{reac.}`, xLabel: 'n', yLabel: L`\Delta H^\circ_f`, default: [[1, -74.8], [2, 0]] },
      ],
      compute: (v) => {
        if (pairs(v, 'prod').length === 0 || pairs(v, 'reac').length === 0) fail('Agrega al menos un producto y un reactivo.')
        const Hp = sum(pairs(v, 'prod').map(([n, H]) => n * H))
        const Hr = sum(pairs(v, 'reac').map(([n, H]) => n * H))
        return { Hp, Hr, dH: Hp - Hr }
      },
      steps: (v, r) => [
        { label: 'Productos: coeficiente × entalpía de formación', latex: L`\sum n\Delta H^\circ_f=` + pairs(v, 'prod').map(([n, H]) => L`(${fmt(n)})(${fmt(H)})`).join('+') + L`=${fmt(r.Hp)}${u('kJ')}` },
        { label: 'Reactivos', latex: L`\sum n\Delta H^\circ_f=` + pairs(v, 'reac').map(([n, H]) => L`(${fmt(n)})(${fmt(H)})`).join('+') + L`=${fmt(r.Hr)}${u('kJ')}` },
        { label: 'Productos menos reactivos', latex: L`\Delta H^\circ_r=${fmt(r.Hp)}-${fp(r.Hr)}=${fmt(r.dH)}${u('kJ')}` },
      ],
      answer: (_v, r) => L`\Delta H^\circ_r=${fmt(r.dH)}${u('kJ')}`,
      interpret: (_v, r) => [
        r.dH < 0
          ? { tone: 'good', text: `$\\Delta H < 0$: la reacción es **exotérmica**, libera $${fmt(-r.dH)}\\ \\mathrm{kJ}$ por cada vez que ocurre tal como está escrita.` }
          : r.dH > 0
            ? { tone: 'good', text: `$\\Delta H > 0$: la reacción es **endotérmica**, absorbe $${fmt(r.dH)}\\ \\mathrm{kJ}$ del entorno.` }
            : { tone: 'info', text: 'No hay intercambio neto de calor.' },
        { tone: 'info', text: 'El valor corresponde a las cantidades de la ecuación balanceada: si duplicas la ecuación, se duplica $\\Delta H$; si la inviertes, cambia de signo.' },
      ],
    }),
  ],
  commonMistakes: [
    'Olvidar multiplicar por los coeficientes estequiométricos.',
    'Restar al revés (reactivos menos productos).',
    'Usar el $\\Delta H^\\circ_f$ del agua gaseosa cuando la reacción produce agua líquida (o al revés).',
  ],
  related: ['calor-sensible', 'clausius-clapeyron'],
  keywords: ['entalpia', 'hess', 'calor de reaccion', 'combustion', 'exotermica', 'endotermica', 'termoquimica'],
}

const clausius: Formula = {
  id: 'clausius-clapeyron',
  name: 'Ecuación de Clausius-Clapeyron',
  category: 'termoquimica',
  latex: L`\ln\frac{P_2}{P_1}=\frac{\Delta H_{vap}}{R}\left(\frac{1}{T_1}-\frac{1}{T_2}\right)`,
  summary: 'Cómo cambia la presión de vapor de un líquido con la temperatura.',
  goal: 'Predecir la presión de vapor a otra temperatura, o a qué temperatura hierve un líquido bajo cierta presión (por ejemplo, en una montaña).',
  variables: [
    { symbol: 'P_1,\\ P_2', meaning: 'Presiones de vapor (misma unidad en ambas)' },
    { symbol: 'T_1,\\ T_2', meaning: 'Temperaturas **absolutas**', unit: 'K' },
    { symbol: L`\Delta H_{vap}`, meaning: 'Entalpía de vaporización', unit: 'J/mol' },
    { symbol: 'R', meaning: 'Constante de los gases, $8.314$', unit: 'J/(mol·K)' },
  ],
  whenToUse: ['Punto de ebullición a otra altitud, ollas de presión, destilación.'],
  intuition: [
    'Un líquido hierve cuando su presión de vapor iguala a la presión externa. En una montaña la presión del aire es menor, así que el agua hierve antes de llegar a 100 °C.',
    'La presión de vapor crece **exponencialmente** con la temperatura: un pequeño aumento de $T$ produce un gran aumento de $P$. Por eso la fórmula usa un logaritmo.',
  ],
  calculators: [
    calc<{ T1: number; T2: number; lnr: number; P2: number }>({
      id: 'P2',
      label: 'Presión de vapor a otra temperatura',
      example: 'el agua hierve a 100 °C con 1 atm ($\\Delta H_{vap} = 40.7$ kJ/mol). ¿Cuál es su presión de vapor a 80 °C?',
      inputs: [
        { kind: 'number', id: 'P1', label: 'Presión conocida', symbol: 'P_1', default: 1, unit: 'atm' },
        { kind: 'number', id: 'T1c', label: 'Temperatura conocida', symbol: 'T_1', default: 100, unit: '°C' },
        { kind: 'number', id: 'T2c', label: 'Nueva temperatura', symbol: 'T_2', default: 80, unit: '°C' },
        { kind: 'number', id: 'dH', label: 'Entalpía de vaporización', symbol: L`\Delta H_{vap}`, default: 40.7, unit: 'kJ/mol' },
      ],
      compute: (v) => {
        const T1 = num(v, 'T1c') + 273.15, T2 = num(v, 'T2c') + 273.15
        if (T1 <= 0 || T2 <= 0) fail('Las temperaturas deben estar por encima del cero absoluto.')
        positive(num(v, 'P1'), 'P_1'); positive(num(v, 'dH'), '\\Delta H_{vap}')
        const lnr = ((num(v, 'dH') * 1000) / R) * (1 / T1 - 1 / T2)
        return { T1, T2, lnr, P2: num(v, 'P1') * Math.exp(lnr) }
      },
      steps: (v, r) => [
        { label: 'Temperaturas en kelvin y ΔH en J/mol', latex: L`T_1=${fmt(r.T1)}${u('K')},\quad T_2=${fmt(r.T2)}${u('K')},\quad \Delta H=${fmt(num(v, 'dH') * 1000)}${u('J/mol')}` },
        { label: 'Lado derecho', latex: L`\frac{${fmt(num(v, 'dH') * 1000)}}{8.314}\left(\frac{1}{${fmt(r.T1)}}-\frac{1}{${fmt(r.T2)}}\right)=${fmt(r.lnr)}` },
        { label: 'Despejamos P₂', latex: L`P_2=P_1\,e^{${fmt(r.lnr)}}=(${fmt(num(v, 'P1'))})(${fmt(Math.exp(r.lnr))})=${fmt(r.P2)}${u('atm')}` },
      ],
      answer: (_v, r) => L`P_2=${fmt(r.P2)}${u('atm')}`,
      interpret: (v, r) => [
        { tone: 'good', text: `A $${fmt(num(v, 'T2c'))}\\ ^\\circ\\mathrm{C}$ la presión de vapor es $${fmt(r.P2, 3)}\\ \\mathrm{atm}$. Con esa presión externa, el líquido herviría a esa temperatura.` },
        { tone: 'info', text: 'Es una aproximación: supone que $\\Delta H_{vap}$ no cambia con la temperatura y que el vapor se comporta como gas ideal.' },
      ],
    }),
  ],
  commonMistakes: ['Usar °C en lugar de kelvin.', 'Dejar $\\Delta H$ en kJ/mol con $R = 8.314$ J/(mol·K).', 'Intercambiar $T_1$ y $T_2$ sin intercambiar $P_1$ y $P_2$.'],
  related: ['gases-ideales', 'ley-de-hess'],
  keywords: ['presion de vapor', 'punto de ebullicion', 'vaporizacion', 'clapeyron', 'altitud'],
}

const ph: Formula = {
  id: 'ph',
  name: 'pH y pOH',
  category: 'termoquimica',
  latex: L`\text{pH}=-\log[\mathrm{H^+}]`,
  forms: [
    { label: 'pOH', latex: L`\text{pOH}=-\log[\mathrm{OH^-}]` },
    { label: 'A 25 °C', latex: L`\text{pH}+\text{pOH}=14` },
  ],
  summary: 'Mide qué tan ácida o básica es una disolución con una escala logarítmica que normalmente va de 0 a 14. No viene en el formulario, pero es básico en química.',
  goal: 'Convertir concentraciones diminutas de $\\mathrm{H^+}$ (como $0.0000001$ M) en un número cómodo.',
  variables: [
    { symbol: L`[\mathrm{H^+}]`, meaning: 'Concentración molar de iones hidrógeno (los corchetes significan “concentración de”)', unit: 'mol/L' },
    { symbol: L`\text{pH}`, meaning: 'Menor que 7: ácido; 7: neutro; mayor que 7: básico (a 25 °C)' },
  ],
  whenToUse: ['Ácidos y bases fuertes, agua, alimentos, sangre (pH ≈ 7.4), suelos.'],
  intuition: [
    'La “p” significa “menos logaritmo de”. Convierte potencias de diez en números sencillos: $[\\mathrm{H^+}] = 10^{-3}$ da pH 3.',
    'La escala es **logarítmica**: bajar un punto de pH significa **10 veces** más ácido. Un pH de 3 es mil veces más ácido que uno de 6.',
    'En agua pura a 25 °C, $[\\mathrm{H^+}] = [\\mathrm{OH^-}] = 10^{-7}$, por eso el neutro es 7.',
  ],
  calculators: [
    calc<{ pH: number; OH: number }>({
      id: 'pH',
      label: 'Desde [H⁺]',
      example: 'un ácido fuerte como HCl 0.001 M, que libera todo su $\\mathrm{H^+}$.',
      inputs: [{ kind: 'number', id: 'H', label: 'Concentración de H⁺', symbol: L`[\mathrm{H^+}]`, default: 0.001, unit: 'mol/L' }],
      compute: (v) => {
        positive(num(v, 'H'), '[\\mathrm{H^+}]')
        const pH = -Math.log10(num(v, 'H'))
        return { pH, OH: 1e-14 / num(v, 'H') }
      },
      steps: (v, r) => [
        { label: 'Logaritmo', latex: L`\text{pH}=-\log(${fmt(num(v, 'H'))})=${fmt(r.pH, 2)}` },
        { label: 'pOH (25 °C)', latex: L`\text{pOH}=14-${fmt(r.pH, 2)}=${fmt(14 - r.pH, 2)}` },
        { label: 'Concentración de OH⁻', latex: L`[\mathrm{OH^-}]=\frac{10^{-14}}{${fmt(num(v, 'H'))}}=${fmt(r.OH)}${u('mol/L')}` },
      ],
      answer: (_v, r) => L`\text{pH}=${fmt(r.pH, 2)}`,
      extras: (_v, r) => [{ label: 'pOH', latex: L`${fmt(14 - r.pH, 2)}` }, { label: '[OH⁻]', latex: L`${fmt(r.OH)}${u('M')}` }],
      interpret: (_v, r) => phWords(r.pH),
      visual: (_v, r) => ({ type: 'ph', ph: r.pH }),
    }),
    calc<{ H: number }>({
      id: 'H',
      label: 'Desde el pH',
      example: 'jugo de limón, pH ≈ 2.',
      inputs: [{ kind: 'number', id: 'pH', label: 'pH', symbol: L`\text{pH}`, default: 2 }],
      compute: (v) => ({ H: 10 ** -num(v, 'pH') }),
      steps: (v, r) => [{ label: 'Invertimos el logaritmo', latex: L`[\mathrm{H^+}]=10^{-\text{pH}}=10^{-${fmt(num(v, 'pH'))}}=${fmt(r.H)}${u('mol/L')}` }],
      answer: (_v, r) => L`[\mathrm{H^+}]=${fmt(r.H)}${u('mol/L')}`,
      interpret: (v) => phWords(num(v, 'pH')),
      visual: (v) => ({ type: 'ph', ph: num(v, 'pH') }),
    }),
  ],
  commonMistakes: [
    'Olvidar el signo negativo: con $[\\mathrm{H^+}] < 1$ M el pH sale positivo (con ácidos muy concentrados puede ser negativo).',
    'Creer que la escala es lineal: pH 4 no es “el doble de ácido” que pH 8, es $10^4$ veces más.',
    'Usar $\\text{pH} + \\text{pOH} = 14$ a temperaturas distintas de 25 °C.',
  ],
  related: ['ecuacion-nernst', 'molaridad'],
  keywords: ['acido', 'base', 'acidez', 'potencial de hidrogeno', 'neutro', 'alcalino'],
}

function phWords(p: number): Interpretation[] {
  const kind = p < 6.95 ? 'ácida' : p > 7.05 ? 'básica (alcalina)' : 'neutra'
  return [
    { tone: 'good', text: `Con pH $${fmt(p, 2)}$ la disolución es **${kind}** (a 25 °C).` },
    Math.abs(p - 7) > 0.05
      ? { tone: 'info', text: `Es $${fmt(10 ** Math.abs(7 - p), 3)}$ veces más ${p < 7 ? 'ácida' : 'básica'} que el agua pura: cada unidad de pH es un factor de 10.` }
      : { tone: 'info', text: 'Tiene la misma cantidad de $\\mathrm{H^+}$ que de $\\mathrm{OH^-}$, como el agua pura.' },
  ]
}

export const QUIMICA: Formula[] = [
  molaridad, molalidad, porcentajes, dilucion,
  foton, fotoelectrico, seriesEspectrales, deBroglie, heisenberg, momentoMagnetico,
  faraday, potencialCelda, nernst,
  hess, clausius, ph,
]
