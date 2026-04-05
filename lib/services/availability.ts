import { createClient } from "@/lib/supabase/client"

export interface AvailabilitySlot {
  time: string
  available: boolean
  reason?: string
}

export interface ProfessionalSchedule {
  id?: string
  professional_id: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_minutes: number
  is_active: boolean
}

export async function getProfessionalSchedule(professionalId: string): Promise<ProfessionalSchedule[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("professional_availability")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("is_active", true)
    .order("day_of_week")
  return (data ?? []) as ProfessionalSchedule[]
}

export async function saveScheduleDay(schedule: ProfessionalSchedule): Promise<void> {
  const supabase = createClient()
  if (schedule.id) {
    await supabase
      .from("professional_availability")
      .update({
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        slot_duration_minutes: schedule.slot_duration_minutes,
        is_active: schedule.is_active,
      })
      .eq("id", schedule.id)
  } else {
    await supabase
      .from("professional_availability")
      .insert({
        professional_id: schedule.professional_id,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        slot_duration_minutes: schedule.slot_duration_minutes,
        is_active: schedule.is_active,
      })
  }
}

export async function getAvailableSlots(
  professionalId: string,
  date: string
): Promise<AvailabilitySlot[]> {
  const supabase = createClient()
  const dateObj = new Date(date + "T00:00:00")
  const dayOfWeek = dateObj.getDay()

  const { data: schedule } = await supabase
    .from("professional_availability")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single()

  if (!schedule) return []

  const slots: AvailabilitySlot[] = []
  const [startH, startM] = schedule.start_time.split(":").map(Number)
  const [endH, endM] = schedule.end_time.split(":").map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  const duration = schedule.slot_duration_minutes

  for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push({
      time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      available: true,
    })
  }

  const dateFrom = `${date}T00:00:00`
  const dateTo = `${date}T23:59:59`

  const { data: existingApps } = await supabase
    .from("appointments")
    .select("scheduled_at, duration_minutes, status")
    .eq("professional_id", professionalId)
    .gte("scheduled_at", dateFrom)
    .lte("scheduled_at", dateTo)
    .not("status", "in", '("cancelled","no_show")')

  const { data: blockedSlots } = await supabase
    .from("blocked_slots")
    .select("starts_at, ends_at")
    .eq("professional_id", professionalId)
    .lte("starts_at", dateTo)
    .gte("ends_at", dateFrom)

  return slots.map(slot => {
    const slotStart = new Date(`${date}T${slot.time}:00`).getTime()
    const slotEnd = slotStart + duration * 60000

    const bookedApp = existingApps?.find(app => {
      const appStart = new Date(app.scheduled_at).getTime()
      const appEnd = appStart + app.duration_minutes * 60000
      return slotStart < appEnd && slotEnd > appStart
    })
    if (bookedApp) return { ...slot, available: false, reason: "ocupado" }

    const blocked = blockedSlots?.find(b => {
      const bStart = new Date(b.starts_at).getTime()
      const bEnd = new Date(b.ends_at).getTime()
      return slotStart < bEnd && slotEnd > bStart
    })
    if (blocked) return { ...slot, available: false, reason: "bloqueado" }

    return slot
  })
}