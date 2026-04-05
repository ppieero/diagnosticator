"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createAppointment, getServices, getOrCreateProfessional } from "@/lib/services/appointments"
import { getAvailableSlots } from "@/lib/services/availability"
import type { Patient, Specialty } from "@/types/domain"
import { cn } from "@/lib/utils"

interface Service {
  id: string; name: string; duration_minutes: number; price: number
  specialty_id: string; specialty?: { id: string; name: string; color: string }
}

export default function NuevaCitaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [patients, setPatients] = useState<Patient[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [userId, setUserId] = useState("")
  const [professionalId, setProfessionalId] = useState("")
  const [selectedPatient, setSelectedPatient] = useState(searchParams.get("patient_id") ?? "")
  const [selectedSpecialty, setSelectedSpecialty] = useState("")
  const [selectedService, setSelectedService] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [selectedTime, setSelectedTime] = useState("")
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [patientSearch, setPatientSearch] = useState("")
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean; reason?: string }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [noSchedule, setNoSchedule] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
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

  useEffect(() => {
    if (!professionalId || !selectedDate) return
    setLoadingSlots(true)
    setSelectedTime("")
    setNoSchedule(false)
    getAvailableSlots(professionalId, selectedDate).then(slots => {
      setAvailableSlots(slots)
      setNoSchedule(slots.length === 0)
      setLoadingSlots(false)
    })
  }, [professionalId, selectedDate])

  async function goToStep3() {
    if (!selectedSpecialty || !selectedService) return
    const supabase = createClient()
    const { data: specs } = await supabase.from("specialties").select("id").eq("id", selectedSpecialty).single()
    const profId = await getOrCreateProfessional(userId, specs?.id ?? selectedSpecialty)
    setProfessionalId(profId)
    setStep(3)
  }

  async function handleSubmit() {
    if (!selectedPatient || !selectedSpecialty || !selectedService || !selectedDate || !selectedTime) {
      setError("Completa todos los campos requeridos")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
      const selectedServiceObj = services.find(s => s.id === selectedService)
      await createAppointment({
        patient_id: selectedPatient,
        professional_id: professionalId,
        specialty_id: selectedSpecialty,
        service_id: selectedService,
        scheduled_at: scheduledAt,
        duration_minutes: selectedServiceObj?.duration_minutes ?? 60,
        chief_complaint: chiefComplaint || undefined,
        created_by: userId,
      })
      router.push("/agenda")
    } catch {
      setError("Error al crear la cita. Intente nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(patientSearch.toLowerCase())
  )
  const selectedPatientObj = patients.find(p => p.id === selectedPatient)
  const selectedServiceObj = services.find(s => s.id === selectedService)
  const selectedSpecialtyObj = specialties.find(s => s.id === selectedSpecialty)

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-900">Nueva cita</h2>
      </div>

      <div className="flex gap-2">
        {[1,2,3].map(s => (
          <div key={s} className={cn("flex-1 h-1.5 rounded-full transition-colors", step >= s ? "bg-blue-600" : "bg-gray-200")} />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-700">Seleccionar paciente</p>
          <input type="text" placeholder="Buscar..." value={patientSearch}
            onChange={e => setPatientSearch(e.target.value)} className="input-base" />
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {filteredPatients.map(p => (
              <button key={p.id} type="button" onClick={() => setSelectedPatient(p.id)}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                  selectedPatient === p.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-gray-600">{p.full_name.charAt(0)}</span>
                </div>
                <div>
                  <p className={cn("text-sm font-medium", selectedPatient === p.id ? "text-blue-900" : "text-gray-800")}>{p.full_name}</p>
                  {p.phone && <p className="text-xs text-gray-400">{p.phone}</p>}
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => selectedPatient && setStep(2)} disabled={!selectedPatient}
            className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
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
          <p className="text-sm font-semibold text-gray-700">Especialidad</p>
          <div className="flex flex-col gap-2">
            {specialties.map(sp => (
              <button key={sp.id} type="button" onClick={() => setSelectedSpecialty(sp.id)}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                  selectedSpecialty === sp.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                <div className="w-3 h-3 rounded-full" style={{ background: sp.color }} />
                <span className={cn("text-sm font-medium", selectedSpecialty === sp.id ? "text-blue-900" : "text-gray-700")}>{sp.name}</span>
              </button>
            ))}
          </div>
          {services.length > 0 && (
            <>
              <p className="text-sm font-semibold text-gray-700">Servicio</p>
              <div className="flex flex-col gap-2">
                {services.map(sv => (
                  <button key={sv.id} type="button" onClick={() => setSelectedService(sv.id)}
                    className={cn("flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all",
                      selectedService === sv.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                    <div>
                      <p className={cn("text-sm font-medium", selectedService === sv.id ? "text-blue-900" : "text-gray-800")}>{sv.name}</p>
                      <p className="text-xs text-gray-400">{sv.duration_minutes} min</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">€{sv.price}</p>
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={goToStep3} disabled={!selectedSpecialty || !selectedService}
            className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
            Siguiente →
          </button>
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
            <input type="date" value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => setSelectedDate(e.target.value)}
              className="input-base" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Hora disponible</label>
            {loadingSlots && (
              <div className="flex items-center gap-2 py-4">
                <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                <p className="text-sm text-gray-400">Cargando disponibilidad...</p>
              </div>
            )}
            {!loadingSlots && noSchedule && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">Sin horario configurado</p>
                <p className="text-xs text-amber-700 mt-1">
                  El profesional no tiene horario para este día.{" "}
                  <button onClick={() => router.push("/ajustes")} className="underline font-medium">
                    Configurar horario →
                  </button>
                </p>
              </div>
            )}
            {!loadingSlots && availableSlots.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {availableSlots.map(slot => (
                  <button key={slot.time} type="button"
                    disabled={!slot.available}
                    onClick={() => slot.available && setSelectedTime(slot.time)}
                    className={cn(
                      "py-2.5 rounded-xl text-sm font-medium border-2 transition-all",
                      !slot.available ? "bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed line-through" :
                      selectedTime === slot.time ? "bg-blue-600 text-white border-blue-600" :
                      "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Motivo (opcional)</label>
            <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
              placeholder="Motivo de la consulta..." rows={2} className="input-base resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading || !selectedTime || noSchedule}
            className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50">
            {loading ? "Guardando..." : "Confirmar cita"}
          </button>
        </div>
      )}
    </div>
  )
}