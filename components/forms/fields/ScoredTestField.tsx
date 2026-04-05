"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ScoredTest, ScoredTestRange } from "@/types/domain"
import { cn } from "@/lib/utils"

interface ScoredTestFieldProps {
  testKey: string
  value?: Record<string, number>
  onChange: (val: Record<string, number>) => void
  disabled?: boolean
}

const LIKERT_OPTIONS = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Varios días" },
  { value: 2, label: "Más de la mitad" },
  { value: 3, label: "Casi todos los días" },
]

const RANGE_COLORS: Record<string, string> = {
  green:    "bg-green-100 text-green-800 border-green-300",
  yellow:   "bg-yellow-100 text-yellow-800 border-yellow-300",
  orange:   "bg-orange-100 text-orange-800 border-orange-300",
  red:      "bg-red-100 text-red-800 border-red-300",
  critical: "bg-red-200 text-red-900 border-red-400",
}

function getRange(test: ScoredTest, score: number): ScoredTestRange | null {
  return test.score_ranges.find(r => score >= r.min && score <= r.max) ?? null
}

export function ScoredTestField({ testKey, value = {}, onChange, disabled }: ScoredTestFieldProps) {
  const [test, setTest] = useState<ScoredTest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from("scored_tests").select("*").eq("test_key", testKey).single()
      .then(({ data }) => { setTest(data as ScoredTest); setLoading(false) })
  }, [testKey])

  if (loading) return <div className="text-sm text-gray-400 py-4">Cargando test...</div>
  if (!test) return <div className="text-sm text-red-500">Test no encontrado: {testKey}</div>

  const score = Object.values(value).reduce((a, b) => a + b, 0)
  const answered = Object.keys(value).length
  const total = test.questions.length
  const complete = answered === total
  const range = complete ? getRange(test, score) : null
  const alertQ = test.questions.find(q => q.alert && value[q.id] !== undefined && value[q.id] > 0)

  function setAnswer(qId: string, val: number) {
    onChange({ ...value, [qId]: val })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">{test.name}</p>
          {test.description && <p className="text-xs text-gray-500 mt-0.5">{test.description}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{answered}/{total} respondidas</p>
          {complete && (
            <p className="text-lg font-bold text-gray-900">
              {score}<span className="text-sm font-normal text-gray-400">/{test.max_score}</span>
            </p>
          )}
        </div>
      </div>

      {alertQ && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-red-800">⚠ {alertQ.alert_message}</p>
        </div>
      )}

      {complete && range && (
        <div className={cn("border rounded-xl px-4 py-3", RANGE_COLORS[range.color])}>
          <p className="text-sm font-semibold">{range.label} — Score: {score}</p>
          <p className="text-xs mt-0.5">{range.action}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {test.questions.map((q, idx) => (
          <div key={q.id} className={cn(
            "border rounded-xl p-4",
            q.alert && value[q.id] > 0 ? "border-red-300 bg-red-50" : "border-gray-200"
          )}>
            <p className="text-sm text-gray-800 mb-3">
              <span className="font-medium text-gray-500 mr-2">{idx + 1}.</span>
              {q.text}
            </p>
            <div className="flex gap-2 flex-wrap">
              {LIKERT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setAnswer(q.id, opt.value)}
                  className={cn(
                    "flex-1 min-w-[80px] py-2 px-3 rounded-lg text-xs font-medium border-2 transition-all",
                    value[q.id] === opt.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  )}
                >
                  <span className="block text-center font-bold">{opt.value}</span>
                  <span className="block text-center">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {test.reference && (
        <p className="text-xs text-gray-400">Ref: {test.reference}</p>
      )}
    </div>
  )
}