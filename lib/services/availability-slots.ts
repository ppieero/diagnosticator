import { createClient } from "@/lib/supabase/client"

export interface TimeSlot {
  time: string
  available: boolean
  professionals?: { id: string; full_name: string; specialty: string }[]
}

export interface DayAvailability {
  date: string
  slots: TimeSlot[]
}

function generateSlots(startTime: string, endTime: string, slotDuration: number): string[] {
  const slots: string[] = []
  const [startH, startM] = startTime.split(":").map(Number)
  const [endH, endM] = endTime.split(":").map(Number)
  let current = startH * 60 + startM
  const end = endH * 60 + endM
  while (current + slotDuration <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, "0")
    const m = (current % 60).toString().padStart(2, "0")
    slots.push(`${h}:${m}`)
    current += slotDuration
  }
  return slots
}

const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]

export async function getSlotsForProfessional(
  professionalId: string,
  date: string
): Promise<string[]> {
  const supabase = createClient()
  const dayName = DAY_NAMES[new Date(date + "T12:00:00").getDay()]

  const { data: avail } = await supabase
    .from("professional_availability")
    .select("start_time, end_time, slot_duration")
    .eq("professional_id", professionalId)
    .eq("day_of_week", dayName)
    .eq("is_available", true)
    .single()

  if (!avail) return []

  const allSlots = generateSlots(avail.start_time, avail.end_time, avail.slot_duration ?? 60)

  const { data: appts } = await supabase
    .from("appointments")
    .select("scheduled_at, duration_minutes")
    .eq("professional_id", professionalId)
    .gte("scheduled_at", `${date}T00:00:00`)
    .lte("scheduled_at", `${date}T23:59:59`)
    .not("status", "in", '("cancelled","no_show")')

  const bookedTimes = new Set(
    (appts ?? []).map(a => new Date(a.scheduled_at).toTimeString().slice(0, 5))
  )

  return allSlots.filter(slot => !bookedTimes.has(slot))
}

export async function getGeneralAvailability(date: string): Promise<TimeSlot[]> {
  const supabase = createClient()
  const dayName = DAY_NAMES[new Date(date + "T12:00:00").getDay()]

  const { data: profs } = await supabase
    .from("professionals")
    .select("id, slot_duration, profile:profiles(full_name), specialty:specialties(name)")
    .eq("is_active", true)

  if (!profs || profs.length === 0) return []

  const { data: availabilities } = await supabase
    .from("professional_availability")
    .select("professional_id, start_time, end_time, slot_duration")
    .eq("day_of_week", dayName)
    .eq("is_available", true)
    .in("professional_id", profs.map(p => p.id))

  if (!availabilities || availabilities.length === 0) return []

  const { data: appts } = await supabase
    .from("appointments")
    .select("professional_id, scheduled_at")
    .gte("scheduled_at", `${date}T00:00:00`)
    .lte("scheduled_at", `${date}T23:59:59`)
    .not("status", "in", '("cancelled","no_show")')

  const bookedByProf = new Map<string, Set<string>>()
  for (const a of appts ?? []) {
    if (!bookedByProf.has(a.professional_id)) bookedByProf.set(a.professional_id, new Set())
    bookedByProf.get(a.professional_id)!.add(new Date(a.scheduled_at).toTimeString().slice(0, 5))
  }

  const slotMap = new Map<string, { id: string; full_name: string; specialty: string }[]>()

  for (const av of availabilities) {
    const prof = profs.find(p => p.id === av.professional_id)
    if (!prof) continue
    const profInfo = {
      id: prof.id,
      full_name: (prof.profile as { full_name: string })?.full_name ?? "",
      specialty: (prof.specialty as { name: string })?.name ?? "",
    }
    const slots = generateSlots(av.start_time, av.end_time, av.slot_duration ?? 60)
    const booked = bookedByProf.get(av.professional_id) ?? new Set()
    for (const slot of slots) {
      if (!booked.has(slot)) {
        if (!slotMap.has(slot)) slotMap.set(slot, [])
        slotMap.get(slot)!.push(profInfo)
      }
    }
  }

  return Array.from(slotMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, professionals]) => ({ time, available: professionals.length > 0, professionals }))
}