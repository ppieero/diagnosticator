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
const CAL_DAYS_HEADER = ["Lun","Mar","Mie","Jue","Vie","Sab","Dom"]

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

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getCalendarDays(month: Date): (Date | null)[] {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const lastDay = new Date(year, m + 1, 0)
  const days: (Date | null)[] = []
  const pad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  for (let i = 0; i < pad; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, m, d))
  }
  return days
}

function generateTimeSlots(start: number, end: number): string[] {
  const slots: string[] = []
  for (let h = start; h < end; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`)
    slots.push(`${String(h).padStart(2, "0")}:30`)
  }
  return slots
}

function isSlotBusy(
  slotTime: string,
  date: string,
  duration: number,
  busy: { start: string; duration: number }[]
): boolean {
  const slotStart = new Date(`${date}T${slotTime}:00`)
  const slotEnd = new Date(slotStart.getTime() + duration * 60000)
  return busy.some(b => {
    const busyStart = new Date(b.start)
    const busyEnd = new Date(busyStart.getTime() + b.duration * 60000)
    return slotStart < busyEnd && slotEnd > busyStart
  })
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

  // Reagendar state
  const [reagendarMode, setReagendarMode] = useState<"fecha" | "horario" | "confirmar" | "exito" | null>(null)
  const [newDate, setNewDate] = useState<string | null>(null)
  const [newTime, setNewTime] = useState<string | null>(null)
  const [notifyPatient, setNotifyPatient] = useState(false)
  const [busySlots, setBusySlots] = useState<{ start: string; duration: number }[]>([])
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [profSchedule, setProfSchedule] = useState<{ dayOfWeek: number; start: number; end: number }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)

  const weekDates = getWeekDates(currentDate)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Ambas vistas cargan solo el día seleccionado
    // Usar fecha local (no UTC) para evitar desfase de zona horaria
    const pad = (n: number) => String(n).padStart(2, "0")
    const localDate = `${selectedDay.getFullYear()}-${pad(selectedDay.getMonth()+1)}-${pad(selectedDay.getDate())}`
    const from = localDate + "T00:00:00"
    const toDate = localDate + "T23:59:59"

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
    const pad = (n: number) => String(n).padStart(2,"0")
    const ds = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
    return appointments.filter(a => a.scheduled_at.startsWith(ds))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  }

  function getAppsForProfHour(profId: string, hour: number) {
    const pad = (n: number) => String(n).padStart(2,"0")
    const ds = `${selectedDay.getFullYear()}-${pad(selectedDay.getMonth()+1)}-${pad(selectedDay.getDate())}`
    return appointments.filter(a => {
      const appHour = new Date(a.scheduled_at).getHours()
      return a.professional_id === profId && a.scheduled_at.startsWith(ds) && appHour === hour
    })
  }

  function handleIniciarConsulta(appointmentId: string) {
    const appt = appointments.find(a => a.id === appointmentId)
    if (!appt) return
    const patientId = appt.patient_id
    const specialtyId = appt.specialty_id ?? ""
    const serviceId = appt.service_id ?? ""
    const params = new URLSearchParams({
      appointment_id: appointmentId,
      specialty_id: specialtyId,
      service_id: serviceId,
    })
    router.push(`/patients/${patientId}/evaluations/new?${params.toString()}`)
  }

  async function handleStatusChange(id: string, status: "confirmed" | "cancelled" | "no_show" | "completed") {
    await updateAppointmentStatus(id, status)
    await loadData()
    setSelectedAppointment(null)
  }

  // ── Reagendar helpers ────────────────────────────────────────────────────────

  async function loadProfSchedule() {
    if (!selectedAppointment) return
    const supabase = createClient()
    const { data: avail } = await supabase
      .from("professional_availability")
      .select("day_of_week, start_time, end_time")
      .eq("professional_id", selectedAppointment.professional_id)
      .eq("is_active", true)
    if (avail && avail.length > 0) {
      setProfSchedule(avail.map((a: { day_of_week: number; start_time: string; end_time: string }) => ({
        dayOfWeek: a.day_of_week,
        start: parseInt(a.start_time.split(":")[0]),
        end: parseInt(a.end_time.split(":")[0]),
      })))
    } else {
      // Default Mon–Fri 08:00–18:00
      setProfSchedule([1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, start: 8, end: 18 })))
    }
  }

  async function loadBusySlots(date: string) {
    if (!selectedAppointment) return
    setLoadingSlots(true)
    const supabase = createClient()
    const { data: busy } = await supabase
      .from("appointments")
      .select("scheduled_at, duration_minutes")
      .eq("professional_id", selectedAppointment.professional_id)
      .gte("scheduled_at", `${date}T00:00:00`)
      .lte("scheduled_at", `${date}T23:59:59`)
      .neq("status", "cancelled")
      .neq("id", selectedAppointment.id)
    setBusySlots((busy ?? []).map((b: { scheduled_at: string; duration_minutes: number }) => ({
      start: b.scheduled_at,
      duration: b.duration_minutes,
    })))
    setLoadingSlots(false)
  }

  async function openReagendar() {
    setNewDate(null)
    setNewTime(null)
    setNotifyPatient(false)
    setBusySlots([])
    setCalendarMonth(new Date())
    await loadProfSchedule()
    setReagendarMode("fecha")
  }

  async function handleSelectDate(date: string) {
    setNewDate(date)
    setNewTime(null)
    await loadBusySlots(date)
    setReagendarMode("horario")
  }

  async function handleReschedule() {
    if (!selectedAppointment || !newDate || !newTime) return
    setRescheduling(true)
    const supabase = createClient()
    const newDateTime = `${newDate}T${newTime}:00`
    await supabase
      .from("appointments")
      .update({ scheduled_at: newDateTime, status: "scheduled" })
      .eq("id", selectedAppointment.id)
    setRescheduling(false)
    setReagendarMode("exito")
    await loadData()
  }

  function prevCalMonth() {
    const now = new Date()
    if (
      calendarMonth.getFullYear() === now.getFullYear() &&
      calendarMonth.getMonth() === now.getMonth()
    ) return
    const m = new Date(calendarMonth)
    m.setMonth(m.getMonth() - 1)
    setCalendarMonth(m)
  }

  function nextCalMonth() {
    const m = new Date(calendarMonth)
    m.setMonth(m.getMonth() + 1)
    setCalendarMonth(m)
  }

  function isDayAvailable(date: Date): boolean {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    if (date < todayStart) return false
    const dow = date.getDay()
    if (profSchedule.length === 0) return dow >= 1 && dow <= 5
    return profSchedule.some(s => s.dayOfWeek === dow)
  }

  function isPastDay(date: Date): boolean {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    return date < todayStart
  }

  function getSlotRange(): { start: number; end: number } {
    if (!newDate) return { start: 8, end: 18 }
    const dow = new Date(newDate + "T12:00:00").getDay()
    const sched = profSchedule.find(s => s.dayOfWeek === dow)
    return { start: sched?.start ?? 8, end: sched?.end ?? 18 }
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString()
  const isSelected = (d: Date) => d.toDateString() === selectedDay.toDateString()
  const totalToday = getAppsForDay(new Date()).length

  const periodLabel = view === "list"
    ? `${MONTHS_ES[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`
    : `${DAYS_ES[selectedDay.getDay()]}, ${selectedDay.getDate()} de ${MONTHS_ES[selectedDay.getMonth()]}`

  const calendarDays = getCalendarDays(calendarMonth)
  const calMonthLabel = `${MONTHS_ES[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`
  const isAtCurrentMonth = (() => {
    const now = new Date()
    return calendarMonth.getFullYear() === now.getFullYear() && calendarMonth.getMonth() === now.getMonth()
  })()

  const { start: slotStartHour, end: slotEndHour } = getSlotRange()
  const timeSlots = generateTimeSlots(slotStartHour, slotEndHour)
  const apptDuration = selectedAppointment?.duration_minutes ?? 60

  const oldDateDisplay = selectedAppointment
    ? `${formatDateLong(selectedAppointment.scheduled_at.split("T")[0])}, ${formatTime(selectedAppointment.scheduled_at)}`
    : ""
  const newDateDisplay = newDate && newTime ? `${formatDateLong(newDate)}, ${newTime}` : ""

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
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            </div>
          )}
          {!loading && appointments.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3">
              <span className="text-4xl">📅</span>
              <p className="text-sm font-medium text-gray-500">Sin citas en este período</p>
              <button onClick={() => router.push("/agenda/nueva")} className="text-sm text-blue-600 font-medium">
                Agendar cita
              </button>
            </div>
          )}
          {!loading && (() => {
            const today = new Date().toISOString().split("T")[0]
            const groups: Record<string, AppointmentWithRelations[]> = {}
            appointments.forEach(a => {
              const d = a.scheduled_at.split("T")[0]
              if (!groups[d]) groups[d] = []
              groups[d].push(a)
            })
            const sortedDates = Object.keys(groups).sort()
            const pastDates = sortedDates.filter(d => d < today).reverse()
            const todayAndFuture = sortedDates.filter(d => d >= today)

            function renderGroup(dates: string[], isPast: boolean) {
              return dates.map(dateStr => {
                const apps = groups[dateStr].sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at))
                const d = new Date(dateStr + "T12:00:00")
                const isTodayDate = dateStr === today
                return (
                  <div key={dateStr} className="mb-4">
                    <div className={cn("flex items-center gap-2 mb-2 sticky top-0 py-1 z-10",
                      isPast ? "opacity-60" : "")}>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                        isTodayDate ? "bg-blue-600 text-white" :
                        isPast ? "bg-gray-100 text-gray-500" :
                        "bg-gray-100 text-gray-700")}>
                        {isTodayDate ? "Hoy" : `${DAYS_ES[d.getDay()]}, ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`}
                      </span>
                      <span className="text-xs text-gray-400">{apps.length} cita{apps.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className={cn("flex flex-col gap-2", isPast ? "opacity-70" : "")}>
                      {apps.map(app => {
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
                )
              })
            }

            return (
              <div>
                {pastDates.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Historial — últimos 90 días</p>
                    {renderGroup(pastDates, true)}
                  </div>
                )}
                {todayAndFuture.length > 0 && (
                  <div>
                    {pastDates.length > 0 && <div className="border-t border-gray-100 my-3"/>}
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Próximas citas</p>
                    {renderGroup(todayAndFuture, false)}
                  </div>
                )}
              </div>
            )
          })()}
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

      {/* ── Drawer detalle cita ─────────────────────────────────────────────── */}
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
                <button
                  onClick={openReagendar}
                  className="tap-target w-full rounded-xl border border-gray-300 text-gray-700 text-sm font-medium flex items-center justify-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <polyline points="17 14 12 14 12 19"/>
                  </svg>
                  Reagendar cita
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

      {/* ── Drawer reagendar (sobre el drawer de cita) ──────────────────────── */}
      {selectedAppointment && reagendarMode && (
        <div
          className="fixed inset-0 z-[60] flex items-end"
          onClick={() => {
            if (reagendarMode === "exito") {
              setReagendarMode(null)
              setSelectedAppointment(null)
            } else {
              setReagendarMode(null)
            }
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

            {/* ── PASO: fecha ─────────────────────────────────────────────── */}
            {reagendarMode === "fecha" && (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-gray-100">
                  <button
                    onClick={() => setReagendarMode(null)}
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <p className="text-base font-bold text-gray-900">Reagendar cita</p>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Banner cita actual */}
                  <div className="mx-4 mt-4 mb-3 flex items-center gap-3 bg-blue-50 rounded-xl p-3 border-l-4 border-blue-500">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-600 font-medium">{selectedAppointment.patient?.full_name}</p>
                      <p className="text-xs text-blue-500 truncate">
                        {(selectedAppointment.specialty as { name?: string })?.name ?? ""} · {formatTime(selectedAppointment.scheduled_at)}, {formatDateLong(selectedAppointment.scheduled_at.split("T")[0])}
                      </p>
                    </div>
                  </div>

                  {/* Mes y navegación */}
                  <div className="flex items-center justify-between px-4 mb-2">
                    <button
                      onClick={prevCalMonth}
                      disabled={isAtCurrentMonth}
                      className={cn("w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500",
                        isAtCurrentMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-50")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <p className="text-sm font-semibold text-gray-800 capitalize">{calMonthLabel}</p>
                    <button
                      onClick={nextCalMonth}
                      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>

                  {/* Cabecera días */}
                  <div className="grid grid-cols-7 px-4 mb-1">
                    {CAL_DAYS_HEADER.map(d => (
                      <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                    ))}
                  </div>

                  {/* Días del mes */}
                  <div className="grid grid-cols-7 gap-y-1 px-4 pb-4">
                    {calendarDays.map((date, i) => {
                      if (!date) return <div key={`pad-${i}`} />
                      const ds = toDateStr(date)
                      const past = isPastDay(date)
                      const avail = isDayAvailable(date)
                      const sel = newDate === ds
                      const todayDate = date.toDateString() === new Date().toDateString()
                      return (
                        <button
                          key={ds}
                          disabled={past || !avail}
                          onClick={() => setNewDate(ds)}
                          className={cn(
                            "flex flex-col items-center py-1.5 rounded-xl transition-all",
                            past || !avail ? "opacity-25 cursor-not-allowed" : "cursor-pointer",
                            sel ? "bg-blue-600" : todayDate ? "ring-1 ring-blue-400 hover:bg-blue-50" : (!past && avail ? "hover:bg-gray-50" : "")
                          )}
                        >
                          <span className={cn("text-sm font-medium",
                            sel ? "text-white" : past ? "text-gray-300" : "text-gray-800")}>
                            {date.getDate()}
                          </span>
                          {avail && !past && (
                            <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5",
                              sel ? "bg-blue-200" : "bg-green-500")} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-gray-100">
                  <button
                    disabled={!newDate}
                    onClick={() => newDate && handleSelectDate(newDate)}
                    className={cn(
                      "tap-target w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
                      newDate ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    )}>
                    Seleccionar horario
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </>
            )}

            {/* ── PASO: horario ────────────────────────────────────────────── */}
            {reagendarMode === "horario" && (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-gray-100">
                  <button
                    onClick={() => setReagendarMode("fecha")}
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <div>
                    <p className="text-base font-bold text-gray-900">Seleccionar hora</p>
                    {newDate && (
                      <p className="text-xs text-gray-400">{formatDateLong(newDate)}</p>
                    )}
                  </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {/* Banner cita actual */}
                  <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3 border-l-4 border-blue-500 mb-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-600 font-medium">{selectedAppointment.patient?.full_name}</p>
                      <p className="text-xs text-blue-500 truncate">
                        Duración: {apptDuration} min · {(selectedAppointment.specialty as { name?: string })?.name ?? ""}
                      </p>
                    </div>
                  </div>

                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {timeSlots.map(slot => {
                        const busy = newDate ? isSlotBusy(slot, newDate, apptDuration, busySlots) : false
                        const sel = newTime === slot
                        return (
                          <button
                            key={slot}
                            disabled={busy}
                            onClick={() => !busy && setNewTime(slot)}
                            className={cn(
                              "h-11 rounded-xl border text-sm font-medium transition-all",
                              busy
                                ? "border-gray-100 text-gray-300 line-through opacity-40 cursor-not-allowed"
                                : sel
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                            )}
                          >
                            {slot}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-gray-100">
                  <button
                    disabled={!newTime}
                    onClick={() => newTime && setReagendarMode("confirmar")}
                    className={cn(
                      "tap-target w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
                      newTime ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    )}>
                    Continuar
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </>
            )}

            {/* ── PASO: confirmar ──────────────────────────────────────────── */}
            {reagendarMode === "confirmar" && (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-gray-100">
                  <button
                    onClick={() => setReagendarMode("horario")}
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <p className="text-base font-bold text-gray-900">Confirmar reagendado</p>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
                  {/* Paciente */}
                  <div>
                    <p className="text-base font-bold text-gray-900">{selectedAppointment.patient?.full_name}</p>
                    <p className="text-sm text-gray-500">{selectedAppointment.service?.name}</p>
                  </div>

                  {/* Cambio de fecha */}
                  <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Fecha anterior</p>
                        <p className="text-sm text-gray-400 line-through">{oldDateDisplay}</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 mx-1" />
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Nueva fecha</p>
                        <p className="text-sm font-semibold text-gray-900">{newDateDisplay}</p>
                      </div>
                    </div>
                  </div>

                  {/* Toggle notificación */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Notificar al paciente</p>
                      <p className="text-xs text-gray-400 mt-0.5">Enviar aviso del cambio</p>
                    </div>
                    <button
                      onClick={() => setNotifyPatient(!notifyPatient)}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition-colors flex-shrink-0",
                        notifyPatient ? "bg-blue-600" : "bg-gray-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                        notifyPatient ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-gray-100">
                  <button
                    disabled={rescheduling}
                    onClick={handleReschedule}
                    className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                    {rescheduling ? (
                      <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Guardando...</>
                    ) : (
                      "Confirmar reagendado"
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ── PASO: exito ──────────────────────────────────────────────── */}
            {reagendarMode === "exito" && (
              <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 gap-4 min-h-[320px]">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">Cita reagendada</p>
                  <p className="text-sm text-gray-500 mt-1">{newDateDisplay}</p>
                  <p className="text-xs text-gray-400 mt-1">{selectedAppointment.patient?.full_name}</p>
                </div>
                <button
                  onClick={() => { setReagendarMode(null); setSelectedAppointment(null) }}
                  className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold mt-2">
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
