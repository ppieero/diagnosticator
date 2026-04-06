"use client"
import { useEffect, useState } from "react"
import { getSlotsForProfessional, getGeneralAvailability } from "@/lib/services/availability-slots"
import type { TimeSlot } from "@/lib/services/availability-slots"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface ProfOption {
  id: string
  full_name: string
  specialty: string
  color: string
}

interface Props {
  professionalId?: string
  onSelect: (date: string, time: string, professionalId: string) => void
  selectedDate?: string
  selectedTime?: string
  selectedProfessionalId?: string
}

export default function AvailabilityPicker({
  professionalId: externalProfId,
  onSelect,
  selectedDate: extDate,
  selectedTime: extTime,
  selectedProfessionalId: extProf,
}: Props) {
  const [profOptions, setProfOptions] = useState<ProfOption[]>([])
  const [filterProfId, setFilterProfId] = useState<string>(externalProfId ?? "all")
  const [date, setDate] = useState(extDate ?? "")
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTime, setSelectedTime] = useState(extTime ?? "")
  const [selectedProfId, setSelectedProfId] = useState(extProf ?? externalProfId ?? "")
  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    const supabase = createClient()
    supabase.from("professionals")
      .select("id, profile:profiles(full_name), specialty:specialties(name, color)")
      .eq("is_active", true)
      .then(({ data }) => {
        const opts = (data ?? []).map((p: {
          id: string
          profile: { full_name: string }
          specialty: { name: string; color: string }
        }) => ({
          id: p.id,
          full_name: p.profile?.full_name ?? "",
          specialty: p.specialty?.name ?? "",
          color: p.specialty?.color ?? "#888",
        }))
        setProfOptions(opts)
        if (externalProfId) setFilterProfId(externalProfId)
      })
  }, [externalProfId])

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setSelectedTime("")
    setSelectedProfId(filterProfId !== "all" ? filterProfId : "")
    if (filterProfId !== "all") {
      getSlotsForProfessional(filterProfId, date).then(times => {
        setSlots(times.map(t => ({ time: t, available: true })))
        setLoading(false)
      })
    } else {
      getGeneralAvailability(date).then(data => {
        setSlots(data)
        setLoading(false)
      })
    }
  }, [date, filterProfId])

  function handleSelectSlot(slot: TimeSlot) {
    if (!slot.available) return
    setSelectedTime(slot.time)
    if (filterProfId !== "all") {
      setSelectedProfId(filterProfId)
      onSelect(date, slot.time, filterProfId)
    } else {
      setSelectedProfId("")
    }
  }

  function handleSelectProf(profId: string) {
    setSelectedProfId(profId)
    onSelect(date, selectedTime, profId)
  }

  const profsForSlot = filterProfId !== "all"
    ? []
    : slots.find(s => s.time === selectedTime)?.professionals ?? []

  const selectedProfName = profOptions.find(p => p.id === selectedProfId)?.full_name
    ?? profsForSlot.find(p => p.id === selectedProfId)?.full_name ?? ""

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-2">Especialista</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setFilterProfId("all"); setDate(""); setSelectedTime(""); setSelectedProfId("") }}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all",
              filterProfId === "all" ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-400")}>
            Todos
          </button>
          {profOptions.map(prof => (
            <button key={prof.id} type="button"
              onClick={() => { setFilterProfId(prof.id); setDate(""); setSelectedTime(""); setSelectedProfId("") }}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all",
                filterProfId === prof.id ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:border-gray-400"
              )}
              style={filterProfId === prof.id ? { background: prof.color, borderColor: prof.color } : {}}>
              <div className="w-2 h-2 rounded-full" style={{ background: filterProfId === prof.id ? "rgba(255,255,255,0.7)" : prof.color }} />
              {prof.full_name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">
          {filterProfId === "all" ? "Seleccionar fecha" : `Disponibilidad de ${profOptions.find(p => p.id === filterProfId)?.full_name ?? ""}`}
        </label>
        <input type="date" value={date} min={today}
          onChange={e => setDate(e.target.value)} className="input-base" />
      </div>

      {date && loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      )}

      {date && !loading && slots.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-800 font-medium">Sin disponibilidad para esta fecha</p>
          <p className="text-xs text-amber-600 mt-0.5">
            {filterProfId !== "all"
              ? "El profesional no tiene horario en este dia o todas las citas estan ocupadas."
              : "No hay profesionales disponibles en esta fecha."}
          </p>
        </div>
      )}

      {date && !loading && slots.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">
            {filterProfId !== "all" ? "Horarios disponibles" : "Horarios con disponibilidad"}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {slots.map(slot => {
              const isSelected = selectedTime === slot.time
              const profCount = slot.professionals?.length ?? 0
              return (
                <button key={slot.time} type="button"
                  onClick={() => handleSelectSlot(slot)}
                  disabled={!slot.available}
                  className={cn(
                    "flex flex-col items-center py-2 px-1 rounded-xl border-2 text-xs font-medium transition-all",
                    !slot.available && "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed line-through",
                    slot.available && !isSelected && "border-green-300 bg-green-50 text-green-800 hover:border-green-500",
                    isSelected && "border-blue-600 bg-blue-600 text-white"
                  )}>
                  <span className="font-semibold">{slot.time}</span>
                  {filterProfId === "all" && slot.available && (
                    <span className={cn("text-[10px] mt-0.5", isSelected ? "text-blue-100" : "text-green-600")}>
                      {profCount} libre{profCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {filterProfId === "all" && selectedTime && profsForSlot.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">
            Profesionales disponibles a las {selectedTime}
          </label>
          <div className="flex flex-col gap-2">
            {profsForSlot.map(prof => {
              const profOpt = profOptions.find(p => p.id === prof.id)
              return (
                <button key={prof.id} type="button" onClick={() => handleSelectProf(prof.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                    selectedProfId === prof.id ? "border-purple-600 bg-purple-50" : "border-gray-200 hover:border-gray-300"
                  )}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: profOpt?.color ? profOpt.color + "22" : "#f3f4f6" }}>
                    <span className="text-xs font-bold" style={{ color: profOpt?.color ?? "#888" }}>
                      {prof.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className={cn("text-sm font-medium",
                      selectedProfId === prof.id ? "text-purple-900" : "text-gray-800")}>
                      {prof.full_name}
                    </p>
                    <p className="text-xs text-gray-400">{prof.specialty}</p>
                  </div>
                  {selectedProfId === prof.id && (
                    <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedTime && selectedProfId && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-xs text-green-800 font-medium">
            Sesion: {new Date(date + "T12:00:00").toLocaleDateString("es-ES", {
              weekday: "long", day: "2-digit", month: "long"
            })} a las {selectedTime}
          </p>
          <p className="text-xs text-green-700 mt-0.5">
            Profesional: {selectedProfName}
          </p>
        </div>
      )}
    </div>
  )
}