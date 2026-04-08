import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { created_by, ...rest } = body
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("patients")
    .insert({ ...rest, is_active: true, created_by, updated_by: created_by })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
