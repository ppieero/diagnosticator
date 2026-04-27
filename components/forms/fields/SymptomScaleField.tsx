"use client"
import { cn } from "@/lib/utils"

interface SymptomScaleFieldProps {
  label: string
  value?: string
  onChange: (v: string) => void
  disabled?: boolean
}

const OPTS = [
  { v: "ausente",  l: "Ausente",  active: "bg-gray-500 text-white border-gray-500" },
  { v: "leve",     l: "Leve",     active: "bg-green-500 text-white border-green-500" },
  { v: "moderado", l: "Moderado", active: "bg-amber-400 text-white border-amber-400" },
  { v: "severo",   l: "Severo",   active: "bg-red-500 text-white border-red-500" },
]

export function SymptomScaleField({ label: _label, value, onChange, disabled }: SymptomScaleFieldProps) {
  return (
    <div className="flex gap-2">
      {OPTS.map(opt => (
        <button
          key={opt.v}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.v)}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all min-h-[44px]",
            value === opt.v
              ? opt.active
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          )}
        >
          {opt.l}
        </button>
      ))}
    </div>
  )
}
