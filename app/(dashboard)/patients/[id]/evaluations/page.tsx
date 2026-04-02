import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export const metadata = { title: "Evaluaciones" }

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
}

export default async function EvaluationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: patient } = await supabase.from("patients").select("full_name").eq("id", id).single()
  if (!patient) notFound()

  const { data: evaluations } = await supabase
    .from("evaluations")
    .select("*")
    .eq("patient_id", id)
    .order("started_at", { ascending: false })

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href={"/patients/" + id} className="tap-target flex items-center justify-center rounded-xl border border-gray-200 w-10 h-10 text-gray-500 hover:bg-gray-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">Evaluaciones</h2>
          <p className="text-sm text-gray-500">{patient.full_name}</p>
        </div>
        <Link href={"/patients/" + id + "/evaluations/new"}
          className="tap-target flex items-center gap-1 rounded-xl bg-blue-600 text-white text-sm font-medium px-3 hover:bg-blue-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva
        </Link>
      </div>

      {(!evaluations || evaluations.length === 0) ? (
        <div className="card p-4 text-center text-sm text-gray-400 py-12">
          <p>Sin evaluaciones aún</p>
          <p className="mt-1 text-xs">Creá la primera evaluación para este paciente</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {evaluations.map((e) => (
            <div key={e.id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900 text-sm">{e.evaluation_type_id}</p>
                <span className={"text-xs font-medium px-2 py-0.5 rounded-full " + (STATUS_COLORS[e.status] ?? "bg-gray-100 text-gray-600")}>
                  {STATUS_LABELS[e.status] ?? e.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">{formatDate(e.started_at)}</p>
              {e.notes && <p className="text-xs text-gray-600 line-clamp-2">{e.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}