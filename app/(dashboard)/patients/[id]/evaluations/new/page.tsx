"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const EVALUATION_TYPES = [
  { value: "anamnesis_general", label: "Anamnesis general" },
  { value: "evaluacion_cognitiva", label: "Evaluación cognitiva" },
  { value: "evaluacion_funcional", label: "Evaluación funcional" },
  { value: "evaluacion_psicologica", label: "Evaluación psicológica" },
  { value: "evaluacion_nutricional", label: "Evaluación nutricional" },
]

export default function NewEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)
  const router = useRouter()
  const [type, setType] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type) { setError("Seleccioná un tipo de evaluación"); return }
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("No autenticado"); setLoading(false); return }

    const { error: err } = await supabase.from("evaluations").insert({
      patient_id: patientId,
      evaluation_type_id: type,
      status: "in_progress",
      performed_by: user.id,
      notes: notes || null,
    })

    if (err) { setError("Error al crear la evaluación: " + err.message); setLoading(false); return }
    router.push("/patients/" + patientId + "/evaluations")
  }

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="tap-target flex items-center justify-center rounded-xl border border-gray-200 w-10 h-10 text-gray-500 hover:bg-gray-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="text-xl font-semibold text-gray-900">Nueva evaluación</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="card p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Tipo de evaluación *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input-base">
              <option value="">Seleccionar...</option>
              {EVALUATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Notas iniciales</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={4} className="input-base resize-none"
              placeholder="Motivo de consulta, observaciones previas..." />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading}
            className="tap-target w-full rounded-xl bg-blue-600 text-white font-medium text-base hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? "Creando..." : "Crear evaluación"}
          </button>
        </div>
      </form>
    </div>
  )
}