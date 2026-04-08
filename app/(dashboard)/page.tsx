"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useCurrency } from "@/hooks/useCurrency"
import { cn } from "@/lib/utils"

interface DayStats {
  totalCitas: number
  completadas: number
  canceladas: number
  pendientes: number
  enCurso: number
  pacientesAtendidos: number
  pacientesNuevos: number
  pacientesActivos: number
  pacientesConPaquete: number
}

interface ProfStats {
  id: string
  full_name: string
  specialty: string
  color: string
  citas: number
  completadas: number
}

interface UpcomingAppt {
  id: string
  scheduled_at: string
  patient_name: string
  service_name: string
  status: string
  specialty_color: string
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#378ADD", confirmed: "#639922", in_progress: "#BA7517",
  completed: "#888780", cancelled: "#E24B4A", no_show: "#D85A30",
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

export default function DashboardPage() {
  const router = useRouter()
  const { price } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DayStats | null>(null)
  const [profStats, setProfStats] = useState<ProfStats[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingAppt[]>([])
  const [clinicName, setClinicName] = useState("Diagnosticator")
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const hour = today.getHours()
  const greeting = hour < 12 ? "Buenos dias" : hour < 18 ? "Buenas tardes" : "Buenas noches"

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [settingsRes, apptRes, patRes, packRes, profRes] = await Promise.all([
        supabase.from("clinic_settings").select("value").eq("key", "general").single(),
        supabase.from("appointments")
          .select("id, status, patient_id, professional_id, scheduled_at, service:services(name), specialty:specialties(name, color), professional:professionals(id, profile:profiles(full_name), specialty:specialties(name, color))")
          .gte("scheduled_at", `${todayStr}T00:00:00`)
          .lte("scheduled_at", `${todayStr}T23:59:59`),
        supabase.from("patients").select("id, created_at"),
        supabase.from("patient_service_packages").select("patient_id, status").eq("status", "active"),
        supabase.from("professionals").select("id, profile:profiles(full_name), specialty:specialties(name, color)").eq("is_active", true),
      ])

      if (settingsRes.data) setClinicName(settingsRes.data.value?.clinic_name ?? "Diagnosticator")

      const appts = apptRes.data ?? []
      const patients = patRes.data ?? []
      const activePacks = packRes.data ?? []

      const todayPatients = new Set(appts.map(a => a.patient_id))
      const newToday = patients.filter(p => p.created_at.startsWith(todayStr)).length
      const withPack = new Set(activePacks.map(p => p.patient_id)).size

      setStats({
        totalCitas: appts.length,
        completadas: appts.filter(a => a.status === "completed").length,
        canceladas: appts.filter(a => ["cancelled","no_show"].includes(a.status)).length,
        pendientes: appts.filter(a => ["scheduled","confirmed"].includes(a.status)).length,
        enCurso: appts.filter(a => a.status === "in_progress").length,
        pacientesAtendidos: todayPatients.size,
        pacientesNuevos: newToday,
        pacientesActivos: patients.length,
        pacientesConPaquete: withPack,
      })

      const profMap = new Map<string, ProfStats>()
      for (const a of appts) {
        const prof = a.professional as unknown as { id: string; profile: { full_name: string }; specialty: { name: string; color: string } } | null
        if (!prof) continue
        if (!profMap.has(prof.id)) {
          profMap.set(prof.id, {
            id: prof.id,
            full_name: prof.profile?.full_name ?? "",
            specialty: prof.specialty?.name ?? "",
            color: prof.specialty?.color ?? "#888",
            citas: 0,
            completadas: 0,
          })
        }
        const ps = profMap.get(prof.id)!
        ps.citas++
        if (a.status === "completed") ps.completadas++
      }
      setProfStats(Array.from(profMap.values()).sort((a, b) => b.citas - a.citas))

      const now = new Date().toISOString()
      const next = appts
        .filter(a => ["scheduled","confirmed","in_progress"].includes(a.status) && a.scheduled_at >= now)
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
        .slice(0, 5)
        .map(a => ({
          id: a.id,
          scheduled_at: a.scheduled_at,
          patient_name: (a as { patient?: { full_name: string } }).patient?.full_name ?? "Paciente",
          service_name: (a.service as unknown as { name: string } | null)?.name ?? "",
          status: a.status,
          specialty_color: (a.specialty as unknown as { color: string } | null)?.color ?? "#888",
        }))
      setUpcoming(next)
      setLoading(false)
    }
    load()
  }, [todayStr])

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  const todayFormatted = today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-5">
      <div>
        <p className="text-xs text-gray-400 capitalize">{todayFormatted}</p>
        <h2 className="text-xl font-bold text-gray-900 mt-0.5">{greeting} 👋</h2>
        <p className="text-sm text-gray-500">{clinicName}</p>
      </div>

      {/* Citas hoy */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Citas de hoy</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-4 col-span-2 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">{stats?.totalCitas ?? 0}</p>
              <p className="text-xs text-gray-400 mt-0.5">citas agendadas</p>
            </div>
            <div className="flex flex-col gap-1.5 text-right">
              {stats?.enCurso ? (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-lg font-medium">
                  {stats.enCurso} en curso
                </span>
              ) : null}
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-lg font-medium">
                {stats?.completadas ?? 0} completadas
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-lg font-medium">
                {stats?.pendientes ?? 0} pendientes
              </span>
              {(stats?.canceladas ?? 0) > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg font-medium">
                  {stats?.canceladas} canceladas
                </span>
              )}
            </div>
          </div>

          {stats && stats.totalCitas > 0 && (
            <div className="card p-3 col-span-2">
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {stats.completadas > 0 && (
                  <div className="bg-green-400 rounded-full transition-all"
                    style={{ width: `${(stats.completadas/stats.totalCitas)*100}%` }} />
                )}
                {stats.enCurso > 0 && (
                  <div className="bg-amber-400 rounded-full transition-all"
                    style={{ width: `${(stats.enCurso/stats.totalCitas)*100}%` }} />
                )}
                {stats.pendientes > 0 && (
                  <div className="bg-blue-300 rounded-full transition-all"
                    style={{ width: `${(stats.pendientes/stats.totalCitas)*100}%` }} />
                )}
                {stats.canceladas > 0 && (
                  <div className="bg-red-300 rounded-full transition-all"
                    style={{ width: `${(stats.canceladas/stats.totalCitas)*100}%` }} />
                )}
              </div>
              <div className="flex gap-3 mt-2 flex-wrap">
                {[
                  { label: "Completadas", color: "bg-green-400", val: stats.completadas },
                  { label: "En curso", color: "bg-amber-400", val: stats.enCurso },
                  { label: "Pendientes", color: "bg-blue-300", val: stats.pendientes },
                  { label: "Canceladas", color: "bg-red-300", val: stats.canceladas },
                ].filter(i => i.val > 0).map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", item.color)} />
                    <span className="text-xs text-gray-500">{item.label} ({item.val})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Proximas citas */}
      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Proximas citas</p>
            <button onClick={() => router.push("/agenda")} className="text-xs text-blue-600 font-medium">
              Ver agenda →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {upcoming.map(appt => (
              <div key={appt.id} className="card p-3 flex items-center gap-3">
                <div className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ background: appt.specialty_color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{appt.patient_name}</p>
                  <p className="text-xs text-gray-400 truncate">{appt.service_name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-800">{formatTime(appt.scheduled_at)}</p>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                    style={{ background: STATUS_COLORS[appt.status] + "22", color: STATUS_COLORS[appt.status] }}>
                    {appt.status === "confirmed" ? "Confirmada" : appt.status === "in_progress" ? "En curso" : "Agendada"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pacientes */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pacientes</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Atendidos hoy", value: stats?.pacientesAtendidos ?? 0, color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Nuevos hoy", value: stats?.pacientesNuevos ?? 0, color: "text-green-700", bg: "bg-green-50" },
            { label: "Total activos", value: stats?.pacientesActivos ?? 0, color: "text-gray-800", bg: "bg-gray-50" },
            { label: "Con paquete activo", value: stats?.pacientesConPaquete ?? 0, color: "text-purple-700", bg: "bg-purple-50" },
          ].map(s => (
            <div key={s.label} className={cn("card p-4 text-center", s.bg)}>
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => router.push("/patients")}
          className="mt-2 w-full text-xs text-blue-600 font-medium text-center py-2">
          Ver todos los pacientes →
        </button>
      </div>

      {/* Por profesional */}
      {profStats.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Citas por profesional hoy
          </p>
          <div className="flex flex-col gap-2">
            {profStats.map(prof => (
              <div key={prof.id} className="card p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: prof.color + "22" }}>
                  <span className="text-xs font-bold" style={{ color: prof.color }}>
                    {prof.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{prof.full_name}</p>
                  <p className="text-xs text-gray-400">{prof.specialty}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800">{prof.citas} citas</p>
                  {prof.completadas > 0 && (
                    <p className="text-xs text-green-600">{prof.completadas} completadas</p>
                  )}
                </div>
              </div>
            ))}
            {profStats.length === 0 && (
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-400">Sin citas asignadas hoy</p>
              </div>
            )}
          </div>
        </div>
      )}

      {stats?.totalCitas === 0 && (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">📅</span>
          <p className="text-sm font-medium text-gray-600">Sin citas para hoy</p>
          <button onClick={() => router.push("/agenda/nueva")}
            className="text-sm text-blue-600 font-medium">
            Agendar primera cita →
          </button>
        </div>
      )}
    </div>
  )
}