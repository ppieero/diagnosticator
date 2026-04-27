"use client"
import { cn } from "@/lib/utils"

interface VasomotorValue {
  tiene: boolean
  frecuencia?: string
  severidad?: number
}

interface VasomotorFieldProps {
  label: string
  value?: VasomotorValue
  onChange: (v: VasomotorValue) => void
  disabled?: boolean
}

const FREQ_OPTS = [
  { v: "nunca", l: "Nunca" },
  { v: "ocasional", l: "Ocasional" },
  { v: "frecuente", l: "Frecuente" },
  { v: "muy_frecuente", l: "Muy frecuente" },
]

export function VasomotorField({ label, value, onChange, disabled }: VasomotorFieldProps) {
  const tiene = value?.tiene ?? false

  return (
    <div className={cn(
      "rounded-xl border-2 overflow-hidden transition-colors",
      tiene ? "border-blue-400" : "border-gray-200"
    )}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ tiene: !tiene, frecuencia: value?.frecuencia, severidad: value?.severidad })}
        className="w-full flex items-center justify-between px-4 py-3 bg-white"
      >
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <div className={cn(
          "relative inline-flex h-6 w-10 items-center rounded-full transition-colors flex-shrink-0",
          tiene ? "bg-blue-600" : "bg-gray-200"
        )}>
          <span className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            tiene ? "translate-x-5" : "translate-x-1"
          )} />
        </div>
      </button>

      {tiene && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 flex flex-col gap-3 bg-blue-50/30">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Frecuencia</p>
            <div className="grid grid-cols-2 gap-2">
              {FREQ_OPTS.map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ tiene: true, frecuencia: opt.v, severidad: value?.severidad })}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all min-h-[44px]",
                    value?.frecuencia === opt.v
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">Severidad</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {value?.severidad ?? 0} / 10
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={value?.severidad ?? 0}
              disabled={disabled}
              onChange={e => onChange({ tiene: true, frecuencia: value?.frecuencia, severidad: parseInt(e.target.value) })}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>Sin síntoma</span>
              <span>Muy severo</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
