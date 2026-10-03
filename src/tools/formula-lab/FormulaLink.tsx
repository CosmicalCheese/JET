import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

/** Botón “¿Cómo funciona esta fórmula?” para enlazar una herramienta con su explicación en Formula Lab */
export function FormulaLink({ id, label = '¿Cómo funciona esta fórmula?' }: { id: string; label?: string }) {
  return (
    <Link
      to={`/formula-lab/${id}`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 hover:bg-violet-100 transition-colors"
    >
      <BookOpen size={12} /> {label}
    </Link>
  )
}
