"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Patient, Evaluation, Specialty } from "@/types/domain"
import { formatDate, calculateAge } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface DashboardStats {
  totalPatients: number
  todayEvaluations: number
  pendingEvaluations: number
  completedThisMonth: number
}

interface RecentEvaluation extends Evaluation {
  patient?: Patient
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todayEvaluations: 0,
    pendingEvaluations: 0,
    completedThisMonth: 0,
  })
  const [recentEvaluations, setRecentEvaluations] = useState<RecentEvaluation[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, patientsRes, evalsRes, specialtiesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
        supabase.from("patients").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("evaluations").select("*, patient:patients(id, full_name, birth_date, biological_sex)")
          .order("started_at", { ascending: false }).limit(20),
        supabase.from("specialties").select("*").eq("is_active", true),
      ])

      setProfile(profileRes.data as { full_name: string; role: string })
      setSpecialties((specialtiesRes.data ?? []) as Specialty[])

      const allEvals = (evalsRes.data ?? []) as RecentEvaluation[]
      const today = new Date().toISOString().split("T")[0]
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      setStats({
        totalPatients: patientsRes.count ?? 0,
        todayEvaluations: allEvals.filter(e => e.started_at?.startsWith(today)).length,
        pendingEvaluations: allEvals.filter(e => e.status === "in_progress").length,
        completedThisMonth: allEvals.filter(e =>
          e.status === "completed" && e.started_at >= monthStart
        ).length,
      })

      setRecentEvaluations(allEvals.slice(0, 6))
      setLoading(false)
    }
    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches"

  const STAT_CARDS = [
    { label: "Pacientes activos", value: stats.totalPatients, icon: "👥", color: "bg-blue-50 text-blue-700", border: "border-blue-200" },
    { label: "Consultas hoy", value: stats.todayEvaluations, icon: "📋", color: "bg-green-50 text-green-700", border: "border-green-200" },
    { label: "En progreso", value: stats.pendingEvaluations, icon: "⏳", color: "bg-amber-50 text-amber-700", border: "border-amber-200" },
    { label: "Completadas este mes", value: stats.completedThisMonth, icon: "✅", color: "bg-purple-50 text-purple-700", border: "border-purple-200" },
  ]

  const TYPE_LABELS: Record<string, string> = {
    initial: "Evaluación inicial",
    session: "Sesión",
    followup: "Control",
  }

  const STATUS_COLORS: Record<string, string> = {
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-5">

      {/* Header */}
      <div>
        <p className="text-sm text-gray-400">{greeting}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
          {profile?.full_name?.split(" ")[0] ?? "Profesional"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className={cn("border rounded-2xl p-4", card.border)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{card.icon}</span>
              <span className={cn("text-2xl font-bold", card.color.split(" ")[1])}>{card.value}</span>
            </div>
            <p className="text-xs text-gray-500 font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-700">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/patients/new")}
            className="card p-4 text-left hover:shadow-md transition-shadow"
          >
            <span className="text-2xl mb-2 block">➕</span>
            <p className="text-sm font-semibold text-gray-800">Nuevo paciente</p>
            <p className="text-xs text-gray-400 mt-0.5">Registrar nuevo paciente</p>
          </button>
          <button
            onClick={() => router.push("/patients")}
            className="card p-4 text-left hover:shadow-md transition-shadow"
          >
            <span className="text-2xl mb-2 block">🔍</span>
            <p className="text-sm font-semibold text-gray-800">Buscar paciente</p>
            <p className="text-xs text-gray-400 mt-0.5">Ver todos los pacientes</p>
          </button>
        </div>
      </div>

      {/* Especialidades */}
      {specialties.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Especialidades activas</h2>
          <div className="flex gap-2 flex-wrap">
            {specialties.map(sp => (
              <div
                key={sp.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium"
                style={{ borderColor: sp.color + "60", background: sp.color + "15", color: sp.color }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: sp.color }} />
                {sp.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consultas recientes */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Consultas recientes</h2>
          <button
            onClick={() => router.push("/patients")}
            className="text-xs text-blue-600 font-medium"
          >
            Ver pacientes →
          </button>
        </div>

        {recentEvaluations.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-3xl mb-3">🏥</p>
            <p className="text-sm font-medium text-gray-600">Sin consultas registradas</p>
            <p className="text-xs text-gray-400 mt-1">Las consultas aparecerán aquí</p>
          </div>
        )}

        {recentEvaluations.map(ev => {
          const patient = ev.patient as Patient | undefined
          const statusColor = STATUS_COLORS[ev.status] ?? "bg-gray-100 text-gray-500"
          const typeLabel = TYPE_LABELS[ev.encounter_type] ?? ev.encounter_type

          return (
            <button
              key={ev.id}
              onClick={() => patient && router.push(`/patients/${patient.id}/evaluations/${ev.id}`)}
              className="card p-4 text-left hover:shadow-md transition-shadow w-full"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gray-600">
                      {patient?.full_name?.charAt(0).toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {patient?.full_name ?? "Paciente"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {typeLabel} · {formatDate(ev.started_at)}
                    </p>
                  </div>
                </div>
                <span className={cn("text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0", statusColor)}>
                  {ev.status === "in_progress" ? "En progreso" :
                   ev.status === "completed" ? "Completada" : "Cancelada"}
                </span>
              </div>
            </button>
          )
        })}
      </div>

    </div>
  )
}