import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { user_id, profile, professional } = body
  const supabase = createAdminClient()

  if (profile && user_id) {
    const { error } = await supabase
      .from("profiles")
      .update({ ...profile, updated_at: new Date().toISOString() })
      .eq("id", user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (professional) {
    const { error } = await supabase
      .from("professionals")
      .update({ ...professional, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
