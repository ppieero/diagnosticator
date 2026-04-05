"use client"
import { cn } from "@/lib/utils"

interface Scale0To10Props {
  value?: number
  onChange: (val: number) => void
  disabled?: boolean
}

const COLORS = [
  "bg-green-500","bg-green-400","bg-lime-400","bg-yellow-300","bg-yellow-400",
  "bg-amber-400","bg-orange-400","bg-orange-500","bg-red-500","bg-red-600","bg-red-700"
]

export function Scale0To10({ value, onChange, disabled }: Scale0To10Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(i)}
            className={cn(
              "w-10 h-10 rounded-lg text-sm font-semibold transition-all border-2",
              value === i
                ? `${COLORS[i]} text-white border-transparent scale-110 shadow-md`
                : "bg-gray-100 text-gray-600 border-transparent hover:border-gray-400"
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 px-1">
        <span>Sin dolor</span>
        <span>Dolor insoportable</span>
      </div>
    </div>
  )
}