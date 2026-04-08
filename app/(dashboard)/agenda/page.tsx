"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getAppointmentsByDateRange, updateAppointmentStatus } from "@/lib/services/appointments"
import type { AppointmentWithRelations } from "@/lib/services/appointments"
import { initConsulta } from "@/lib/services/consulta"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  scheduled:   { label: "Agendada",   bg: "bg-blue-50",   text: "text-blue-700",  border: "border-blue-300" },
  confirmed:   { label: "Confirmada", bg: "bg-green-50",  text: "text-green-700", border: "border-green-300" },
  in_progress: { label: "En curso",   bg: "bg-amber-50",  text: "text-amber-700", border: "border-amber-300" },
  completed:   { label: "Completada", bg: "bg-gray-50",   text: "text-gray-500",  border: "border-gray-200" },
  cancelled:   { label: "Cancelada",  bg: "bg-red-50",    text: "text-red-400",   border: "border-red-200" },
  no_show:     { label: "No asistio", bg: "bg-orange-50", text: "text-orange-600",border: "border-orange-200" },
}

const SPECIALTY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  fisioterapia:     { bg: "bg-teal-100",  text: "text-teal-800",  border: "border-teal-300" },
  psicologia:       { bg: "bg-purple-100",text: "text-purple-800",border: "border-purple-300" },
  nutricion:        { bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  "medicina-hormonal": { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-300" },
}

const DAYS_ES = ["Dom","Lun","Mar","Mie","Jue","Vie","Sab"]
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7)

function getWeekDates(base: Date): Date[] {
  const week: Date[] = []
  const day = base.getDay()
  const mon = new Date(base)
  mon.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i); week.push(d)
  }
  return week
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

interface Professional { id: string; user_id: string; specialty?: { name: string; slug: string; color: string }; profile?: { full_name: string } }

export default function AgendaPage() {
  const router = useRouter()
  const [view, setView] = useState<"list" | "grid">("list")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null)
  const [startingConsulta, setStartingConsulta] = useState(false)
  const [schedules, setSchedules] = useState<Record<string, { start: number; end: number }>>({})

  const weekDates = getWeekDates(currentDate)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const from = view === "grid"
      ? new Date(selectedDay.toISOString().split("T")[0] + "T00:00:00").toISOString()
      : weekDates[0].toISOString()
    const toDate = view === "grid"
      ? new Date(selectedDay.toISOString().split("T")[0] + "T23:59:59").toISOString()
      : (() => { const t = new Date(weekDates[6]); t.setHours(23,59,59); return t.toISOString() })()

    const [appsData, profsData] = await Promise.all([
      getAppointmentsByDateRange(from, toDate),
      supabase.from("professionals")
        .select("id, user_id, specialty:specialties(name, slug, color), profile:profiles(full_name)")
        .eq("is_active", true),
    ])

    setAppointments(appsData)
    setProfessionals((profsData.data ?? []) as unknown as Professional[])

    if (view === "grid") {
      const dayOfWeek = selectedDay.getDay()
      const { data: avail } = await supabase
        .from("professional_availability")
        .select("professional_id, start_time, end_time")
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true)

      const schedMap: Record<string, { start: number; end: number }> = {}
      ;(avail ?? []).forEach((a: { professional_id: string; start_time: string; end_time: string }) => {
        schedMap[a.professional_id] = {
          start: parseInt(a.start_time.split(":")[0]),
          end: parseInt(a.end_time.split(":")[0]),
        }
      })
      setSchedules(schedMap)
    }

    setLoading(false)
  }, [currentDate, selectedDay, view])

  useEffect(() => { loadData() }, [loadData])

  function prevPeriod() {
    if (view === "list") {
      const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d)
    } else {
      const d = new Date(selectedDay); d.setDate(d.getDate() - 1); setSelectedDay(d)
    }
  }

  function nextPeriod() {
    if (view === "list") {
      const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d)
    } else {
      const d = new Date(selectedDay); d.setDate(d.getDate() + 1); setSelectedDay(d)
    }
  }

  function goToday() { setCurrentDate(new Date()); setSelectedDay(new Date()) }

  function getAppsForDay(date: Date) {
    const ds = date.toISOString().split("T")[0]
    return appointments.filter(a => a.scheduled_at.startsWith(ds))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  }

  function getAppsForProfHour(profId: string, hour: number) {
    const ds = selectedDay.toISOString().split("T")[0]
    return appointments.filter(a => {
      const appHour = new Date(a.scheduled_at).getHours()
      return a.professional_id === profId && a.scheduled_at.startsWith(ds) && appHour === hour
    })
  }

  async function handleIniciarConsulta(appointmentId: string) {
    setStartingConsulta(true)
    try {
      const { encounterId, patientId } = await initConsulta(appointmentId)
      router.push(`/patients/${patientId}/evaluations/${encounterId}`)
    } catch (err) {
      console.error("Error iniciando consulta:", err)
      setStartingConsulta(false)
    }
  }

  async function handleStatusChange(id: string, status: "confirmed" | "cancelled" | "no_show" | "completed") {
    await updateAppointmentStatus(id, status)
    await loadData()
    setSelectedAppointment(null)
  }

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString()
  const isSelected = (d: Date) => d.toDateString() === selectedDay.toDateString()
  const totalToday = getAppsForDay(new Date()).length

  const periodLabel = view === "list"
    ? `${MONTHS_ES[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`
    : `${DAYS_ES[selectedDay.getDay()]}, ${selectedDay.getDate()} de ${MONTHS_ES[selectedDay.getMonth()]}`

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Agenda</h2>
            <p className="text-xs text-gray-400 mt-0.5">{totalToday} citas hoy</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setView("list")}
                className={cn("px-3 py-2 text-xs font-medium transition-colors",
                  view === "list" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50")}>
                Lista
              </button>
              <button onClick={() => setView("grid")}
                className={cn("px-3 py-2 text-xs font-medium transition-colors",
                  view === "grid" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50")}>
                Grilla
              </button>
            </div>
            <button onClick={() => router.push("/agenda/nueva")}
              className="tap-target px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
              + Cita
            </button>
          </div>
        </div>

        {/* Navegación */}
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={goToday} className="flex-1 text-center text-sm font-medium text-gray-700 hover:text-blue-600">
            {periodLabel}
          </button>
          <button onClick={nextPeriod} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Selector de día — solo en vista lista */}
        {view === "list" && (
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date, i) => {
              const apps = getAppsForDay(date)
              return (
                <button key={i} onClick={() => setSelectedDay(date)}
                  className={cn("flex flex-col items-center py-2 rounded-xl transition-all",
                    isSelected(date) ? "bg-blue-600" : isToday(date) ? "bg-blue-50" : "hover:bg-gray-50")}>
                  <span className={cn("text-xs font-medium", isSelected(date) ? "text-blue-200" : "text-gray-400")}>
                    {DAYS_ES[date.getDay()]}
                  </span>
                  <span className={cn("text-sm font-bold mt-0.5",
                    isSelected(date) ? "text-white" : isToday(date) ? "text-blue-600" : "text-gray-800")}>
                    {date.getDate()}
                  </span>
                  {apps.length > 0 && (
                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1",
                      isSelected(date) ? "bg-blue-200" : "bg-blue-500")} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* VISTA LISTA */}
      {view === "list" && (
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">
              {DAYS_ES[selectedDay.getDay()]}, {selectedDay.getDate()} de {MONTHS_ES[selectedDay.getMonth()]}
            </p>
            <span className="text-xs text-gray-400">
              {getAppsForDay(selectedDay).length} cita{getAppsForDay(selectedDay).length !== 1 ? "s" : ""}
            </span>
          </div>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            </div>
          )}
          {!loading && getAppsForDay(selectedDay).length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3">
              <span className="text-4xl">📅</span>
              <p className="text-sm font-medium text-gray-500">Sin citas para este dia</p>
              <button onClick={() => router.push("/agenda/nueva")} className="text-sm text-blue-600 font-medium">
                Agendar cita
              </button>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {getAppsForDay(selectedDay).map(app => {
              const st = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.scheduled
              const endTime = new Date(new Date(app.scheduled_at).getTime() + app.duration_minutes * 60000)
              const slug = (app.specialty as { slug?: string })?.slug ?? ""
              const sc = SPECIALTY_COLORS[slug] ?? { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" }
              return (
                <button key={app.id} onClick={() => setSelectedAppointment(app)}
                  className={cn("w-full text-left border rounded-2xl p-4 transition-all hover:shadow-md", st.bg, st.border)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center text-xs text-gray-500 flex-shrink-0 min-w-[48px]">
                        <span className="font-semibold text-gray-800">{formatTime(app.scheduled_at)}</span>
                        <span className="text-gray-400">{formatTime(endTime.toISOString())}</span>
                      </div>
                      <div className="w-px bg-gray-200 self-stretch" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{app.patient?.full_name ?? "Paciente"}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{app.service?.name}</p>
                        {app.chief_complaint && (
                          <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px]">{app.chief_complaint}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={cn("text-xs font-medium px-2 py-1 rounded-lg", st.bg, st.text)}>{st.label}</span>
                      {app.specialty && (
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", sc.bg, sc.text)}>
                          {(app.specialty as { name: string }).name}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* VISTA GRILLA */}
      {view === "grid" && (
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            </div>
          ) : professionals.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 px-4">
              <span className="text-4xl">👥</span>
              <p className="text-sm font-medium text-gray-500">No hay profesionales configurados</p>
            </div>
          ) : (
            <div className="min-w-max">
              {/* Header profesionales */}
              <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
                <div className="w-14 flex-shrink-0 border-r border-gray-200 bg-gray-50" />
                {professionals.map(prof => {
                  const slug = prof.specialty?.slug ?? ""
                  const sc = SPECIALTY_COLORS[slug] ?? { bg: "bg-blue-100", text: "text-blue-800", border: "" }
                  return (
                    <div key={prof.id} className="w-36 flex-shrink-0 border-r border-gray-200 px-2 py-2 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {prof.profile?.full_name ?? "Profesional"}
                      </p>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", sc.bg, sc.text)}>
                        {prof.specialty?.name ?? ""}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Filas por hora */}
              {HOURS.map(hour => (
                <div key={hour} className="flex border-b border-gray-100">
                  <div className="w-14 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-start justify-end pr-2 pt-1">
                    <span className="text-xs text-gray-400">{String(hour).padStart(2,"0")}:00</span>
                  </div>
                  {professionals.map(prof => {
                    const sched = schedules[prof.id]
                    const inSchedule = sched ? hour >= sched.start && hour < sched.end : false
                    const apps = getAppsForProfHour(prof.id, hour)
                    return (
                      <div key={prof.id}
                        onClick={() => inSchedule && router.push("/agenda/nueva")}
                        className={cn(
                          "w-36 flex-shrink-0 border-r border-gray-100 h-16 relative",
                          inSchedule ? "bg-white cursor-pointer hover:bg-blue-50" : "bg-amber-50"
                        )}>
                        {!inSchedule && (
                          <div className="absolute inset-0 opacity-20"
                            style={{ backgroundImage: "repeating-linear-gradient(45deg, #F59E0B 0, #F59E0B 1px, transparent 0, transparent 50%)", backgroundSize: "6px 6px" }} />
                        )}
                        {apps.map((app, ai) => {
                          const slug = (app.specialty as { slug?: string })?.slug ?? ""
                          const sc = SPECIALTY_COLORS[slug] ?? { bg: "bg-blue-100", text: "text-blue-800", border: "" }
                          return (
                            <div key={ai} onClick={e => { e.stopPropagation(); setSelectedAppointment(app) }}
                              className={cn("absolute left-1 right-1 top-1 rounded-lg px-2 py-1 cursor-pointer z-10", sc.bg)}
                              style={{ height: `${Math.max(app.duration_minutes / 60 * 64 - 4, 28)}px` }}>
                              <p className={cn("text-xs font-semibold truncate", sc.text)}>
                                {app.patient?.full_name ?? "Paciente"}
                              </p>
                              <p className={cn("text-xs truncate opacity-80", sc.text)}>
                                {formatTime(app.scheduled_at)}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Leyenda */}
              <div className="flex gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200" />
                  Fuera de horario
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-4 h-4 rounded bg-white border border-gray-200" />
                  Disponible
                </div>
                {Object.entries(SPECIALTY_COLORS).map(([slug, colors]) => (
                  <div key={slug} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className={cn("w-4 h-4 rounded", colors.bg)} />
                    {slug === "medicina-hormonal" ? "Hormonal" : slug.charAt(0).toUpperCase() + slug.slice(1)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer detalle cita */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelectedAppointment(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full bg-white rounded-t-3xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900">{selectedAppointment.patient?.full_name}</p>
                <p className="text-sm text-gray-500">{selectedAppointment.service?.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatTime(selectedAppointment.scheduled_at)} - {selectedAppointment.duration_minutes} min
                </p>
              </div>
              {selectedAppointment.specialty && (
                <span className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: (selectedAppointment.specialty as {color:string}).color + "20", color: (selectedAppointment.specialty as {color:string}).color }}>
                  {(selectedAppointment.specialty as {name:string}).name}
                </span>
              )}
            </div>
            {selectedAppointment.chief_complaint && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium mb-1">Motivo</p>
                <p className="text-sm text-gray-700">{selectedAppointment.chief_complaint}</p>
              </div>
            )}
            {selectedAppointment.patient?.phone && (
              <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                <span>Telefono: {selectedAppointment.patient.phone}</span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</p>
              {selectedAppointment.status === "scheduled" && (
                <button onClick={() => handleStatusChange(selectedAppointment.id, "confirmed")}
                  className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold">
                  Confirmar cita
                </button>
              )}
              {["scheduled","confirmed","in_progress"].includes(selectedAppointment.status) && (
                <button
                  onClick={() => handleIniciarConsulta(selectedAppointment.id)}
                  disabled={startingConsulta}
                  className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {startingConsulta ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Iniciando...</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>Iniciar consulta</>
                  )}
                </button>
              )}
              {["scheduled","confirmed"].includes(selectedAppointment.status) && (
                <button onClick={() => handleStatusChange(selectedAppointment.id, "no_show")}
                  className="tap-target w-full rounded-xl border border-orange-300 text-orange-600 text-sm font-medium">
                  No asistio
                </button>
              )}
              {["scheduled","confirmed"].includes(selectedAppointment.status) && (
                <button onClick={() => handleStatusChange(selectedAppointment.id, "cancelled")}
                  className="tap-target w-full rounded-xl border border-red-300 text-red-500 text-sm font-medium">
                  Cancelar cita
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
