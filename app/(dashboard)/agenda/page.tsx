"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getAppointmentsByDateRange, updateAppointmentStatus } from "@/lib/services/appointments"
import type { AppointmentWithRelations } from "@/lib/services/appointments"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  scheduled:   { label: "Agendada",    bg: "bg-blue-50",   text: "text-blue-700",  border: "border-blue-300" },
  confirmed:   { label: "Confirmada",  bg: "bg-green-50",  text: "text-green-700", border: "border-green-300" },
  in_progress: { label: "En curso",    bg: "bg-amber-50",  text: "text-amber-700", border: "border-amber-300" },
  completed:   { label: "Completada",  bg: "bg-gray-50",   text: "text-gray-500",  border: "border-gray-200" },
  cancelled:   { label: "Cancelada",   bg: "bg-red-50",    text: "text-red-400",   border: "border-red-200" },
  no_show:     { label: "No asistio",  bg: "bg-orange-50", text: "text-orange-600",border: "border-orange-200" },
}

const DAYS_ES = ["Dom","Lun","Mar","Mie","Jue","Vie","Sab"]
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]

function getWeekDates(baseDate: Date): Date[] {
  const week: Date[] = []
  const day = baseDate.getDay()
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1))
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    week.push(d)
  }
  return week
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

export default function AgendaPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null)

  const weekDates = getWeekDates(currentDate)

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    const from = weekDates[0].toISOString()
    const to = new Date(weekDates[6])
    to.setHours(23, 59, 59)
    const data = await getAppointmentsByDateRange(from, to.toISOString())
    setAppointments(data)
    setLoading(false)
  }, [currentDate])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  function prevWeek() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }

  function nextWeek() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }

  function goToday() {
    setCurrentDate(new Date())
    setSelectedDay(new Date())
  }

  function getAppsForDay(date: Date): AppointmentWithRelations[] {
    const dateStr = date.toISOString().split("T")[0]
    return appointments
      .filter(a => a.scheduled_at.startsWith(dateStr))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  }

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()
  const isSelected = (date: Date) => date.toDateString() === selectedDay.toDateString()

  async function handleStatusChange(
    id: string,
    status: "confirmed" | "cancelled" | "no_show" | "completed"
  ) {
    await updateAppointmentStatus(id, status)
    await loadAppointments()
    setSelectedAppointment(null)
  }

  const dayApps = getAppsForDay(selectedDay)
  const totalToday = getAppsForDay(new Date()).length

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Agenda</h2>
            <p className="text-xs text-gray-400 mt-0.5">{totalToday} citas hoy</p>
          </div>
          <button
            onClick={() => router.push("/agenda/nueva")}
            className="tap-target px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + Nueva cita
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button onClick={goToday} className="flex-1 text-center text-sm font-medium text-gray-700 hover:text-blue-600">
            {MONTHS_ES[weekDates[0].getMonth()]} {weekDates[0].getFullYear()}
          </button>
          <button onClick={nextWeek} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const apps = getAppsForDay(date)
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(date)}
                className={cn(
                  "flex flex-col items-center py-2 rounded-xl transition-all",
                  isSelected(date) ? "bg-blue-600" : isToday(date) ? "bg-blue-50" : "hover:bg-gray-50"
                )}
              >
                <span className={cn("text-xs font-medium", isSelected(date) ? "text-blue-200" : "text-gray-400")}>
                  {DAYS_ES[date.getDay()]}
                </span>
                <span className={cn("text-sm font-bold mt-0.5", isSelected(date) ? "text-white" : isToday(date) ? "text-blue-600" : "text-gray-800")}>
                  {date.getDate()}
                </span>
                {apps.length > 0 && (
                  <div className={cn("w-1.5 h-1.5 rounded-full mt-1", isSelected(date) ? "bg-blue-200" : "bg-blue-500")} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">
            {DAYS_ES[selectedDay.getDay()]}, {selectedDay.getDate()} de {MONTHS_ES[selectedDay.getMonth()]}
          </p>
          <span className="text-xs text-gray-400">{dayApps.length} cita{dayApps.length !== 1 ? "s" : ""}</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && dayApps.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <span className="text-4xl">📅</span>
            <p className="text-sm font-medium text-gray-500">Sin citas para este dia</p>
            <button
              onClick={() => router.push("/agenda/nueva")}
              className="text-sm text-blue-600 font-medium"
            >
              Agendar cita
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {dayApps.map(app => {
            const st = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.scheduled
            const endTime = new Date(new Date(app.scheduled_at).getTime() + app.duration_minutes * 60000)
            return (
              <button
                key={app.id}
                onClick={() => setSelectedAppointment(app)}
                className={cn("w-full text-left border rounded-2xl p-4 transition-all hover:shadow-md", st.bg, st.border)}
              >
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
                    <span className={cn("text-xs font-medium px-2 py-1 rounded-lg", st.bg, st.text)}>
                      {st.label}
                    </span>
                    {app.specialty && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: app.specialty.color + "20", color: app.specialty.color }}
                      >
                        {app.specialty.name}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelectedAppointment(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full bg-white rounded-t-3xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
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
                <span
                  className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: selectedAppointment.specialty.color + "20", color: selectedAppointment.specialty.color }}
                >
                  {selectedAppointment.specialty.name}
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
                <span>Telefono:</span>
                <span>{selectedAppointment.patient.phone}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</p>
              {selectedAppointment.status === "scheduled" && (
                <button
                  onClick={() => handleStatusChange(selectedAppointment.id, "confirmed")}
                  className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold"
                >
                  Confirmar cita
                </button>
              )}
              {["scheduled","confirmed"].includes(selectedAppointment.status) && (
                <button
                  onClick={() => router.push("/patients/" + selectedAppointment.patient_id + "/evaluations/new")}
                  className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold"
                >
                  Iniciar consulta
                </button>
              )}
              {["scheduled","confirmed"].includes(selectedAppointment.status) && (
                <button
                  onClick={() => handleStatusChange(selectedAppointment.id, "no_show")}
                  className="tap-target w-full rounded-xl border border-orange-300 text-orange-600 text-sm font-medium"
                >
                  No asistio
                </button>
              )}
              {["scheduled","confirmed"].includes(selectedAppointment.status) && (
                <button
                  onClick={() => handleStatusChange(selectedAppointment.id, "cancelled")}
                  className="tap-target w-full rounded-xl border border-red-300 text-red-500 text-sm font-medium"
                >
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