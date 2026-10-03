/* ─── Glosario de símbolos ───
 * `match` detecta en qué fórmulas aparece el símbolo (se busca en la fórmula
 * principal, sus formas alternativas y la tabla de variables).
 */

import type { Formula } from './types'

export type GlossaryGroup = 'notacion' | 'vectores' | 'estadistica' | 'griegas' | 'unidades'

export interface GlossaryEntry {
  id: string
  group: GlossaryGroup
  symbol: string
  name: string
  /** Cómo se lee en voz alta */
  read?: string
  meaning: string
  example?: string
  match?: RegExp
}

export const GLOSSARY_GROUPS: { id: GlossaryGroup; label: string; description: string }[] = [
  { id: 'notacion', label: 'Notación y operaciones', description: 'Los signos que aparecen en casi todas las fórmulas' },
  { id: 'vectores', label: 'Vectores', description: 'Flechas, magnitudes y productos entre vectores' },
  { id: 'estadistica', label: 'Probabilidad y estadística', description: 'Medias, desviaciones y probabilidades' },
  { id: 'griegas', label: 'Letras griegas en física', description: 'Qué representa cada letra en las fórmulas de física' },
  { id: 'unidades', label: 'Unidades y prefijos', description: 'Qué significa cada unidad del Sistema Internacional' },
]

export const GLOSSARY: GlossaryEntry[] = [
  // ─── Notación ──────────────────────────────────────────────────────────────
  { id: 'sumatoria', group: 'notacion', symbol: '\\sum', name: 'Sumatoria', read: '“suma de”', meaning: 'Indica que hay que **sumar** todos los valores de la expresión que le sigue. $\\sum x$ es la suma de todos los datos $x$.', example: '\\sum_{i=1}^{3}x_i=x_1+x_2+x_3', match: /\\sum/ },
  { id: 'raiz', group: 'notacion', symbol: '\\sqrt{x}', name: 'Raíz cuadrada', read: '“raíz de x”', meaning: 'El número que, multiplicado por sí mismo, da $x$. Deshace un cuadrado: $\\sqrt{x^2} = |x|$.', example: '\\sqrt{25}=5', match: /\\sqrt/ },
  { id: 'exponente', group: 'notacion', symbol: 'x^2', name: 'Exponente (potencia)', read: '“x al cuadrado”', meaning: 'Multiplicar $x$ por sí mismo tantas veces como indica el exponente. Un exponente negativo es un recíproco: $x^{-1} = 1/x$.', example: '2^3=2\\cdot2\\cdot2=8', match: /\^/ },
  { id: 'subindice', group: 'notacion', symbol: 'x_1,\\ v_0', name: 'Subíndice', read: '“x sub uno”', meaning: 'Una etiqueta, **no** una operación. Distingue datos ($x_1$ es el primer dato, $x_i$ cualquiera de ellos) o momentos ($v_0$ es la velocidad inicial).', match: /[a-zA-Z]_[{0-9a-zA-Z]/ },
  { id: 'factorial', group: 'notacion', symbol: 'n!', name: 'Factorial', read: '“n factorial”', meaning: 'El producto de todos los enteros de $n$ hasta 1. Cuenta de cuántas formas se pueden ordenar $n$ objetos. Por definición $0! = 1$.', example: '4!=4\\cdot3\\cdot2\\cdot1=24', match: /[a-z0-9)]!/ },
  { id: 'valor-absoluto', group: 'notacion', symbol: '|x|', name: 'Valor absoluto', read: '“valor absoluto de x”', meaning: 'La distancia de un número al cero, sin importar el signo: siempre es positiva o cero.', example: '|-3|=3', match: /\|(?=[\w-])[^|]+\|/ },
  { id: 'delta', group: 'notacion', symbol: '\\Delta', name: 'Delta (cambio)', read: '“delta”', meaning: 'Un **cambio** o incremento: valor final menos valor inicial.', example: '\\Delta T=T_f-T_i', match: /\\Delta/ },
  { id: 'fraccion', group: 'notacion', symbol: '\\frac{a}{b}', name: 'Fracción', read: '“a entre b”', meaning: 'División: el numerador $a$ se divide entre el denominador $b$. El denominador nunca puede ser 0.', match: /\\frac/ },
  { id: 'mas-menos', group: 'notacion', symbol: '\\pm', name: 'Más o menos', read: '“más menos”', meaning: 'Representa dos valores a la vez: uno sumando y otro restando. Se usa en márgenes de error.', example: '52\\pm2.5', match: /\\pm/ },
  { id: 'desigualdades', group: 'notacion', symbol: '<,\\ \\le,\\ >,\\ \\ge', name: 'Desigualdades', read: '“menor que”, “menor o igual que”…', meaning: 'Comparan dos cantidades. La abertura apunta hacia el número mayor.', example: 'P(X\\le 4)', match: /\\le(?![a-z])|\\ge(?![a-z])|</ },
  { id: 'aprox', group: 'notacion', symbol: '\\approx', name: 'Aproximadamente igual', meaning: 'Los valores son casi iguales; normalmente porque se redondeó.', example: '\\pi\\approx3.1416', match: /\\approx/ },
  { id: 'implica', group: 'notacion', symbol: '\\Rightarrow', name: 'Implica', read: '“entonces”', meaning: 'Lo de la izquierda lleva a lo de la derecha. Se usa al despejar o deducir.', match: /\\Rightarrow/ },
  { id: 'tiende', group: 'notacion', symbol: 'n\\to\\infty', name: 'Tiende a (límite)', read: '“n tiende a infinito”', meaning: 'Describe qué pasa cuando una cantidad se hace cada vez más grande (o se acerca a un valor), sin llegar nunca a él.', match: /\\to|\\infty/ },
  { id: 'pi', group: 'notacion', symbol: '\\pi', name: 'Pi', meaning: 'La razón entre el perímetro y el diámetro de cualquier círculo: $\\pi \\approx 3.14159$.', match: /\\pi/ },
  { id: 'euler', group: 'notacion', symbol: 'e', name: 'Número de Euler', meaning: 'Constante $e \\approx 2.71828$, base del crecimiento y decaimiento exponencial. Aparece al pasar de muchos intentos pequeños a un proceso continuo.', example: 'e^{-3}\\approx0.0498', match: /e\^/ },
  { id: 'trig', group: 'notacion', symbol: '\\sin,\\ \\cos,\\ \\tan', name: 'Funciones trigonométricas', read: '“seno, coseno, tangente”', meaning: 'Relacionan un ángulo con las proporciones de un triángulo rectángulo. En el formulario el seno se escribe **sen**. Revisa si tu calculadora está en grados o radianes.', example: '\\cos60^\\circ=0.5', match: /\\sin|\\cos|\\tan/ },
  { id: 'trig-inversa', group: 'notacion', symbol: '\\cos^{-1}', name: 'Función trigonométrica inversa', read: '“arco coseno”', meaning: 'Hace el camino contrario: dado un valor, devuelve **el ángulo**. $\\cos^{-1}(0.5) = 60^\\circ$. El $-1$ **no** es un exponente.', match: /\^\{-1\}/ },
  { id: 'parcial', group: 'notacion', symbol: '\\frac{\\partial S}{\\partial b}', name: 'Derivada parcial', meaning: 'Cuánto cambia $S$ cuando sólo cambia $b$ y todo lo demás queda fijo. Igualarla a 0 sirve para encontrar mínimos o máximos.', match: /\\partial/ },

  // ─── Vectores ──────────────────────────────────────────────────────────────
  { id: 'vector', group: 'vectores', symbol: '\\vec a', name: 'Vector', read: '“vector a”', meaning: 'Una cantidad con **magnitud y dirección** (una flecha), como una fuerza o una velocidad. Sin flecha, $a$ es sólo un número.', match: /\\vec/ },
  { id: 'componentes', group: 'vectores', symbol: '\\langle a_1,a_2,a_3\\rangle', name: 'Componentes de un vector', meaning: 'Cuánto avanza el vector en cada eje: $a_1$ en $x$, $a_2$ en $y$, $a_3$ en $z$.', example: '\\langle 4,1\\rangle', match: /\\langle/ },
  { id: 'magnitud', group: 'vectores', symbol: '|\\vec a|', name: 'Magnitud (norma)', read: '“magnitud de a”', meaning: 'La **longitud** de la flecha. Se calcula con Pitágoras: $\\sqrt{a_1^2+a_2^2+a_3^2}$.', match: /\|\\vec/ },
  { id: 'unitarios', group: 'vectores', symbol: '\\hat i,\\ \\hat j,\\ \\hat k', name: 'Vectores unitarios', read: '“i gorro, j gorro, k gorro”', meaning: 'Flechas de longitud 1 sobre los ejes $x$, $y$, $z$. $3\\hat i + 2\\hat j$ es lo mismo que $\\langle 3,2\\rangle$.', match: /\\hat [ijk]/ },
  { id: 'punto', group: 'vectores', symbol: '\\vec a\\cdot\\vec b', name: 'Producto punto', read: '“a punto b”', meaning: 'Multiplica dos vectores y da un **número**: qué tanto apunta uno en la dirección del otro.', match: /\\vec\s?\w\s*\\cdot\s*\\vec/ },
  { id: 'cruz', group: 'vectores', symbol: '\\vec a\\times\\vec b', name: 'Producto cruz', read: '“a cruz b”', meaning: 'Multiplica dos vectores en 3D y da **otro vector**, perpendicular a ambos.', match: /\\vec\s?\w\s*\\times\s*\\vec/ },
  { id: 'segmento', group: 'vectores', symbol: '\\overrightarrow{PQ}', name: 'Vector de P a Q', meaning: 'La flecha que sale del punto $P$ y llega al punto $Q$. Sus componentes son $Q - P$.', match: /\\overrightarrow/ },

  // ─── Estadística ───────────────────────────────────────────────────────────
  { id: 'media-muestral', group: 'estadistica', symbol: '\\bar x', name: 'Media muestral', read: '“x barra”', meaning: 'El promedio de los datos de una **muestra**.', match: /\\bar x/ },
  { id: 'mu', group: 'estadistica', symbol: '\\mu', name: 'Media poblacional', read: '“mu”', meaning: 'El promedio de **toda la población**, o el valor esperado de una distribución. Ojo: en unidades, $\\mu$ es el prefijo micro ($10^{-6}$), como en $\\mu\\mathrm{C}$.', match: /\\mu/ },
  { id: 'sigma', group: 'estadistica', symbol: '\\sigma', name: 'Desviación estándar poblacional', read: '“sigma”', meaning: 'Qué tan dispersos están los datos de toda la población alrededor de $\\mu$. $\\sigma^2$ es la **varianza**.', match: /\\sigma/ },
  { id: 's', group: 'estadistica', symbol: 's', name: 'Desviación estándar muestral', meaning: 'La dispersión calculada con los datos de una **muestra** (dividiendo entre $n-1$).' },
  { id: 'n', group: 'estadistica', symbol: 'n,\\ N', name: 'Tamaño de muestra y de población', meaning: '$n$ es cuántos datos tiene la muestra; $N$, cuántos elementos tiene la población completa.' },
  { id: 'y-gorro', group: 'estadistica', symbol: '\\hat y', name: 'Valor estimado', read: '“y gorro”', meaning: 'El valor de $y$ que **predice** un modelo (como la recta de regresión), a diferencia del valor real observado $y$.', match: /\\hat y/ },
  { id: 'probabilidad', group: 'estadistica', symbol: 'P(A)', name: 'Probabilidad', read: '“probabilidad de A”', meaning: 'Un número entre 0 (imposible) y 1 (seguro). $P(X = 3)$ es la probabilidad de que la variable valga exactamente 3; $P(X \\le 3)$, de que valga 3 o menos.', match: /P\(/ },
  { id: 'esperanza', group: 'estadistica', symbol: 'E(x)', name: 'Valor esperado', meaning: 'El promedio a largo plazo de una variable aleatoria.', match: /E\(x\)/ },
  { id: 'combinaciones', group: 'estadistica', symbol: '{}_nC_r', name: 'Combinaciones', read: '“combinaciones de n en r”', meaning: 'Cuántos grupos de $r$ elementos se pueden formar con $n$, **sin importar el orden**. También se escribe $\\binom{n}{r}$.', match: /\{\}_\w*C/ },
  { id: 'permutaciones', group: 'estadistica', symbol: '{}_nP_r', name: 'Permutaciones', read: '“permutaciones de n en r”', meaning: 'Cuántas formas hay de elegir y **ordenar** $r$ elementos de $n$.', match: /\{\}_\w*P/ },
  { id: 'pq', group: 'estadistica', symbol: 'p,\\ q', name: 'Probabilidad de éxito y de fracaso', meaning: 'En la binomial, $p$ es la probabilidad de éxito en cada intento y $q = 1 - p$ la de fracaso.' },
  { id: 'r', group: 'estadistica', symbol: 'r', name: 'Coeficiente de correlación', meaning: 'Número entre $-1$ y $1$ que mide qué tan alineados están unos datos $(x, y)$ sobre una recta.' },
  { id: 'z', group: 'estadistica', symbol: 'z', name: 'Puntuación Z', meaning: 'Cuántas desviaciones estándar está un valor por encima (positiva) o por debajo (negativa) de la media.', match: /z=/ },
  { id: 'alfa', group: 'estadistica', symbol: '\\alpha,\\ z_{\\alpha/2}', name: 'Nivel de significancia y valor crítico', read: '“alfa”', meaning: '$\\alpha = 1 -$ confianza (por ejemplo, $0.05$ para 95%). $z_{\\alpha/2}$ es el valor de $z$ que deja $\\alpha/2$ en cada cola. En física, $\\alpha$ también es el coeficiente de dilatación.', match: /\\alpha\/2/ },
  { id: 'gl', group: 'estadistica', symbol: 'gl', name: 'Grados de libertad', meaning: 'Cuántos datos pueden variar libremente después de estimar algo con ellos. En la t de Student de una muestra, $gl = n - 1$.', match: /gl/ },

  // ─── Griegas en física ─────────────────────────────────────────────────────
  { id: 'theta', group: 'griegas', symbol: '\\theta', name: 'Theta: ángulo', read: '“teta”', meaning: 'Casi siempre representa un **ángulo**: entre dos vectores, de incidencia de la luz, de inclinación.', match: /\\theta/ },
  { id: 'lambda', group: 'griegas', symbol: '\\lambda', name: 'Lambda: longitud de onda', read: '“lambda”', meaning: 'Distancia entre dos crestas de una onda. En Poisson, $\\lambda$ también se usa como tasa promedio de eventos.', match: /\\lambda/ },
  { id: 'rho', group: 'griegas', symbol: '\\rho', name: 'Rho: densidad', read: '“ro”', meaning: 'Masa por unidad de volumen ($\\mathrm{kg/m^3}$); el agua tiene $\\rho = 1000$. En electricidad, $\\rho$ es la resistividad.', match: /\\rho/ },
  { id: 'eta', group: 'griegas', symbol: '\\eta', name: 'Eta: eficiencia', read: '“eta”', meaning: 'Qué fracción de la energía que entra se aprovecha. Va de 0 a 1 (o de 0% a 100%).', match: /\\eta/ },
  { id: 'omega', group: 'griegas', symbol: '\\Omega', name: 'Omega mayúscula: ohm', read: '“ohm”', meaning: 'La unidad de resistencia eléctrica. $1\\ \\Omega = 1\\ \\mathrm{V/A}$.', match: /\\Omega|Ω/ },
  { id: 'epsilon', group: 'griegas', symbol: '\\epsilon_0', name: 'Épsilon cero: permitividad del vacío', read: '“épsilon cero”', meaning: 'Constante eléctrica, $\\epsilon_0 = 8.85\\times10^{-12}\\ \\mathrm{C^2/(N\\cdot m^2)}$. Se relaciona con la de Coulomb: $k = \\frac{1}{4\\pi\\epsilon_0}$.' },

  // ─── Unidades ──────────────────────────────────────────────────────────────
  { id: 'newton', group: 'unidades', symbol: '\\mathrm{N}', name: 'Newton (fuerza)', meaning: 'La fuerza que acelera 1 kg a 1 m/s². $1\\ \\mathrm{N} = 1\\ \\mathrm{kg\\cdot m/s^2}$.' },
  { id: 'joule', group: 'unidades', symbol: '\\mathrm{J}', name: 'Joule (energía, trabajo, calor)', meaning: 'El trabajo de una fuerza de 1 N a lo largo de 1 m. $1\\ \\mathrm{J} = 1\\ \\mathrm{N\\cdot m}$; $1\\ \\mathrm{kcal} = 4186.8\\ \\mathrm{J}$.' },
  { id: 'watt', group: 'unidades', symbol: '\\mathrm{W}', name: 'Watt (potencia)', meaning: 'Energía por segundo: $1\\ \\mathrm{W} = 1\\ \\mathrm{J/s}$. Un $\\mathrm{kWh}$ es la energía de 1000 W durante una hora: $3.6\\times10^6\\ \\mathrm{J}$.' },
  { id: 'pascal', group: 'unidades', symbol: '\\mathrm{Pa}', name: 'Pascal (presión)', meaning: 'Fuerza por área: $1\\ \\mathrm{Pa} = 1\\ \\mathrm{N/m^2}$. La presión atmosférica es $1\\ \\mathrm{atm} \\approx 101\\,325\\ \\mathrm{Pa}$.' },
  { id: 'kelvin', group: 'unidades', symbol: '\\mathrm{K}', name: 'Kelvin (temperatura absoluta)', meaning: 'Escala que empieza en el cero absoluto: $K = {}^\\circ C + 273.15$. Los **cambios** de 1 K y de 1 °C son iguales.' },
  { id: 'hertz', group: 'unidades', symbol: '\\mathrm{Hz}', name: 'Hertz (frecuencia)', meaning: 'Oscilaciones por segundo: $1\\ \\mathrm{Hz} = 1\\ \\mathrm{s^{-1}}$.' },
  { id: 'coulomb', group: 'unidades', symbol: '\\mathrm{C}', name: 'Coulomb (carga eléctrica)', meaning: 'Unidad de carga. Un electrón tiene $-1.6\\times10^{-19}\\ \\mathrm{C}$.' },
  { id: 'volt-ampere', group: 'unidades', symbol: '\\mathrm{V},\\ \\mathrm{A}', name: 'Volt y ampere', meaning: 'El volt mide energía por carga ($1\\ \\mathrm{V} = 1\\ \\mathrm{J/C}$); el ampere, carga por segundo ($1\\ \\mathrm{A} = 1\\ \\mathrm{C/s}$).' },
  { id: 'mol', group: 'unidades', symbol: '\\mathrm{mol}', name: 'Mol (cantidad de sustancia)', meaning: 'Un “paquete” de $6.022\\times10^{23}$ partículas (número de Avogadro).' },
  { id: 'prefijos', group: 'unidades', symbol: '\\mathrm{k},\\ \\mathrm{M},\\ \\mathrm{m},\\ \\mu,\\ \\mathrm{n}', name: 'Prefijos', meaning: 'kilo $=10^3$, mega $=10^6$, mili $=10^{-3}$, micro $=10^{-6}$, nano $=10^{-9}$. Por ejemplo, $5\\ \\mu\\mathrm{C} = 5\\times10^{-6}\\ \\mathrm{C}$.' },
]

function formulaText(f: Formula): string {
  return [f.latex, ...(f.forms ?? []).map(x => x.latex), ...f.variables.map(v => v.symbol)].join(' ')
}

/** Entradas del glosario que aparecen en una fórmula */
export function glossaryFor(f: Formula): GlossaryEntry[] {
  const text = formulaText(f)
  return GLOSSARY.filter(g => g.match?.test(text))
}

/** Fórmulas donde aparece una entrada del glosario */
export function formulasUsing(entry: GlossaryEntry, formulas: Formula[]): Formula[] {
  if (!entry.match) return []
  return formulas.filter(f => entry.match!.test(formulaText(f)))
}
