import type { AreaId, Category, CategoryId, Formula } from '../types'
import { ESTADISTICA } from './estadistica'
import { PROBABILIDAD } from './probabilidad'
import { VECTORES } from './vectores'
import { FISICA } from './fisica'
import { QUIMICA } from './quimica'
import { ALGEBRA } from './algebra'
import { TRIGONOMETRIA } from './trigonometria'
import { DERIVADAS } from './derivadas'
import { INTEGRALES } from './integrales'

export const AREAS: { id: AreaId; label: string }[] = [
  { id: 'matematicas', label: 'Matemáticas' },
  { id: 'calculo', label: 'Cálculo' },
  { id: 'estadistica', label: 'Probabilidad y estadística' },
  { id: 'fisica', label: 'Física' },
  { id: 'quimica', label: 'Química' },
]

export const CATEGORIES: Category[] = [
  { id: 'algebra', area: 'matematicas', label: 'Álgebra', description: 'Productos notables, exponentes, logaritmos y fracciones' },
  { id: 'trigonometria', area: 'matematicas', label: 'Trigonometría', description: 'Razones e identidades trigonométricas' },
  { id: 'vectores', area: 'matematicas', label: 'Vectores', description: 'Producto punto, producto cruz, distancias' },
  { id: 'geometria', area: 'matematicas', label: 'Geometría y trigonometría', description: 'Triángulos y ángulos' },
  { id: 'derivadas', area: 'calculo', label: 'Derivadas', description: 'Reglas de derivación y derivadas de funciones' },
  { id: 'integrales', area: 'calculo', label: 'Integrales', description: 'Formulario de integración' },
  { id: 'aplicaciones-integral', area: 'calculo', label: 'Aplicaciones de la integral', description: 'Áreas, longitudes y volúmenes' },
  { id: 'probabilidad', area: 'estadistica', label: 'Probabilidad', description: 'Conteo y distribuciones discretas' },
  { id: 'estadistica', area: 'estadistica', label: 'Estadística', description: 'Descriptiva, inferencia y regresión' },
  { id: 'mecanica', area: 'fisica', label: 'Cinemática y dinámica', description: 'Movimiento y fuerzas' },
  { id: 'energia', area: 'fisica', label: 'Trabajo y energía', description: 'Trabajo, energía cinética y potencial' },
  { id: 'electricidad', area: 'fisica', label: 'Electricidad', description: 'Cargas, corriente y potencia' },
  { id: 'termodinamica', area: 'fisica', label: 'Termodinámica', description: 'Calor, gases y máquinas térmicas' },
  { id: 'ondas', area: 'fisica', label: 'Ondas y óptica', description: 'Refracción y longitud de onda' },
  { id: 'fluidos', area: 'fisica', label: 'Mecánica de fluidos', description: 'Presión y flujo' },
  { id: 'disoluciones', area: 'quimica', label: 'Disoluciones', description: 'Concentración y dilución' },
  { id: 'atomica', area: 'quimica', label: 'Estructura atómica', description: 'Fotones, espectros y cuántica' },
  { id: 'electroquimica', area: 'quimica', label: 'Electroquímica', description: 'Pilas, potenciales y electrólisis' },
  { id: 'termoquimica', area: 'quimica', label: 'Termoquímica y ácido-base', description: 'Entalpía, presión de vapor y pH' },
]

export const FORMULAS: Formula[] = [
  ...ALGEBRA, ...TRIGONOMETRIA, ...VECTORES, ...DERIVADAS, ...INTEGRALES,
  ...PROBABILIDAD, ...ESTADISTICA, ...FISICA, ...QUIMICA,
]

const byId = new Map(FORMULAS.map(f => [f.id, f]))

export function getFormula(id: string | undefined): Formula | undefined {
  return id ? byId.get(id) : undefined
}

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find(c => c.id === id)!
}

/** Quita acentos y pasa a minúsculas para búsquedas tolerantes */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function searchFormulas(query: string): Formula[] {
  const q = normalize(query.trim())
  if (!q) return FORMULAS
  const terms = q.split(/\s+/)
  return FORMULAS.filter(f => {
    const hay = normalize([f.name, f.summary, getCategory(f.category).label, ...(f.keywords ?? [])].join(' '))
    return terms.every(t => hay.includes(t))
  })
}
