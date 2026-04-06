"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getPatientEvaluations } from "@/lib/services/evaluations"
import type { Patient, Evaluation } from "@/types/domain"
import { formatDate, calculateAge } from "@/lib/utils"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_progress: { label: "En progreso", color: "bg-blue-100 text-blue-700" },
  completed:   { label: "Completada",  color: "bg-green-100 text-green-700" },
  cancelled:   { label: "Cancelada",   color: "bg-gray-100 text-gray-500" },
}

const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  initial:   { label: "Evaluación inicial", icon: "📋" },
  session:   { label: "Sesión de seguimiento", icon: "🔄" },
  followup:  { label: "Control", icon: "📌" },
}

export default function PatientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: p } = await supabase
        .from("patients").select("*").eq("id", id).single()
      setPatient(p as Patient)
      const evals = await getPatientEvaluations(id)
      setEvaluations(evals)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  if (!patient) return (
    <div className="px-4 py-8 text-center text-gray-500">Paciente no encontrado</div>
  )

  const age = calculateAge(patient.birth_date)

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-blue-700">
              {patient.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{patient.full_name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {age} años · {patient.biological_sex === "male" ? "Masculino" : patient.biological_sex === "female" ? "Femenino" : "Otro"}
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              {patient.phone && (
                <a href={`tel:${patient.phone}`} className="text-xs text-blue-600 font-medium">
                  📞 {patient.phone}
                </a>
              )}
              {patient.email && (
                <a href={`mailto:${patient.email}`} className="text-xs text-blue-600 font-medium truncate">
                  ✉ {patient.email}
                </a>
              )}
            </div>
          </div>
        </div>
        {patient.notes && (
          <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-3">{patient.notes}</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/patients/${id}/evaluations/new`)}
          className="tap-target flex-1 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Nueva consulta
        </button>
        <button
          onClick={() => router.push(`/patients/${id}/evaluations`)}
          className="tap-target px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ver todas
        </button>
      </div>
      <button
        onClick={() => router.push(`/patients/${id}/paquetes`)}
        className="tap-target w-full rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
      >
        Paquetes y sesiones
      </button>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-700">
          Consultas recientes ({evaluations.length})
        </h3>
        {evaluations.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm text-gray-400">Sin consultas registradas</p>
            <p className="text-xs text-gray-300 mt-1">Crea la primera consulta con el botón de arriba</p>
          </div>
        )}
        {evaluations.slice(0, 5).map(ev => {
          const status = STATUS_CONFIG[ev.status] ?? { label: ev.status, color: "bg-gray-100 text-gray-500" }
          const type = TYPE_CONFIG[ev.encounter_type] ?? { label: ev.encounter_type, icon: "📄" }
          return (
            <button
              key={ev.id}
              onClick={() => router.push(`/patients/${id}/evaluations/${ev.id}`)}
              className="card p-4 text-left hover:shadow-md transition-shadow w-full"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{type.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{type.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(ev.started_at)}
                    </p>
                  </div>
                </div>
                <span className={cn("text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0", status.color)}>
                  {status.label}
                </span>
              </div>
              {ev.notes && (
                <p className="text-xs text-gray-500 mt-2 truncate">{ev.notes}</p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
