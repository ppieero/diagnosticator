"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createAppointment, getServices } from "@/lib/services/appointments"
import type { Patient, Specialty } from "@/types/domain"
import { cn } from "@/lib/utils"

interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
  specialty_id: string
  specialty?: { id: string; name: string; color: string }
}

export default function NuevaCitaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get("patient_id")

  const [patients, setPatients] = useState<Patient[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [userId, setUserId] = useState("")

  const [selectedPatient, setSelectedPatient] = useState<string>(preselectedPatientId ?? "")
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("")
  const [selectedService, setSelectedService] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [selectedTime, setSelectedTime] = useState<string>("09:00")
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [notes, setNotes] = useState("")
  const [patientSearch, setPatientSearch] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const [pRes, spRes] = await Promise.all([
        supabase.from("patients").select("*").eq("is_active", true).order("full_name"),
        supabase.from("specialties").select("*").eq("is_active", true),
      ])
      setPatients((pRes.data ?? []) as Patient[])
      setSpecialties((spRes.data ?? []) as Specialty[])
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedSpecialty) { setServices([]); return }
    getServices(selectedSpecialty).then(data => {
      setServices(data as Service[])
      setSelectedService("")
    })
  }, [selectedSpecialty])

  const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(patientSearch.toLowerCase())
  )

  const selectedPatientObj = patients.find(p => p.id === selectedPatient)
  const selectedServiceObj = services.find(s => s.id === selectedService)
  const selectedSpecialtyObj = specialties.find(s => s.id === selectedSpecialty)

  async function handleSubmit() {
    if (!selectedPatient || !selectedSpecialty || !selectedService || !selectedDate || !selectedTime) {
      setError("Completa todos los campos requeridos")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
      await createAppointment({
        patient_id: selectedPatient,
        professional_id: userId,
        specialty_id: selectedSpecialty,
        service_id: selectedService,
        scheduled_at: scheduledAt,
        duration_minutes: selectedServiceObj?.duration_minutes ?? 60,
        chief_complaint: chiefComplaint || undefined,
        notes: notes || undefined,
        created_by: userId,
      })
      router.push("/agenda")
    } catch (err) {
      console.error(err)
      setError("Error al crear la cita. Intente nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const TIME_SLOTS = Array.from({ length: 26 }, (_, i) => {
    const h = Math.floor(i / 2) + 8
    const m = i % 2 === 0 ? "00" : "30"
    return `${String(h).padStart(2, "0")}:${m}`
  })

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-900">Nueva cita</h2>
      </div>

      <div className="flex gap-2">
        {[1,2,3].map(s => (
          <div key={s} className={cn(
            "flex-1 h-1.5 rounded-full transition-colors",
            step >= s ? "bg-blue-600" : "bg-gray-200"
          )} />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Seleccionar paciente</p>
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              className="input-base mb-3"
            />
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {filteredPatients.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPatient(p.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                    selectedPatient === p.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gray-600">{p.full_name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className={cn("text-sm font-medium", selectedPatient === p.id ? "text-blue-900" : "text-gray-800")}>
                      {p.full_name}
                    </p>
                    {p.phone && <p className="text-xs text-gray-400">{p.phone}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => selectedPatient && setStep(2)}
            disabled={!selectedPatient}
            className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-bold text-blue-700">{selectedPatientObj?.full_name.charAt(0)}</span>
            </div>
            <p className="text-sm font-semibold text-gray-800">{selectedPatientObj?.full_name}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Especialidad</p>
            <div className="flex flex-col gap-2">
              {specialties.map(sp => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setSelectedSpecialty(sp.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                    selectedSpecialty === sp.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: sp.color }} />
                  <span className={cn("text-sm font-medium", selectedSpecialty === sp.id ? "text-blue-900" : "text-gray-700")}>
                    {sp.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {services.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Servicio</p>
              <div className="flex flex-col gap-2">
                {services.map(sv => (
                  <button
                    key={sv.id}
                    type="button"
                    onClick={() => setSelectedService(sv.id)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left",
                      selectedService === sv.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div>
                      <p className={cn("text-sm font-medium", selectedService === sv.id ? "text-blue-900" : "text-gray-800")}>
                        {sv.name}
                      </p>
                      <p className="text-xs text-gray-400">{sv.duration_minutes} min</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">€{sv.price}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="tap-target px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-600">
              ← Atrás
            </button>
            <button
              onClick={() => selectedSpecialty && selectedService && setStep(3)}
              disabled={!selectedSpecialty || !selectedService}
              className="tap-target flex-1 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="card p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{selectedPatientObj?.full_name}</p>
              <p className="text-xs text-gray-400">{selectedServiceObj?.name}</p>
            </div>
            {selectedSpecialtyObj && (
              <span className="text-xs font-medium px-2 py-1 rounded-full"
                style={{ background: selectedSpecialtyObj.color + "20", color: selectedSpecialtyObj.color }}>
                {selectedSpecialtyObj.name}
              </span>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Fecha</label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => setSelectedDate(e.target.value)}
              className="input-base"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Hora</label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTime(t)}
                  className={cn(
                    "py-2.5 rounded-xl text-sm font-medium border-2 transition-all",
                    selectedTime === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Motivo (opcional)</label>
            <textarea
              value={chiefComplaint}
              onChange={e => setChiefComplaint(e.target.value)}
              placeholder="Motivo de la consulta..."
              rows={2}
              className="input-base resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="tap-target px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-600">
              ← Atrás
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="tap-target flex-1 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Guardando..." : "✓ Confirmar cita"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}