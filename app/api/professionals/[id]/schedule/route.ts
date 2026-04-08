import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface ScheduleDay {
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_minutes: number
  is_active: boolean
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("professional_availability")
    .select("*")
    .eq("professional_id", id)
    .order("day_of_week")
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { schedule } = await req.json()
  const supabase = createAdminClient()

  const { error: delError } = await supabase
    .from("professional_availability")
    .delete()
    .eq("professional_id", id)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

  const active = (schedule as ScheduleDay[]).filter(d => d.is_active)
  if (active.length > 0) {
    const { error } = await supabase.from("professional_availability").insert(
      active.map(d => ({
        professional_id: id,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        slot_duration_minutes: d.slot_duration_minutes,
        is_active: true,
      }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
