import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { formatDate, calculateAge } from "@/lib/utils"

export const metadata = { title: "Pacientes" }

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: patients, error } = await supabase
    .from("patients")
    .select("*")
    .eq("is_active", true)
    .order("full_name")

  return (
    <div className="px-4 py-5 fade-up">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">Pacientes</h2>
        <Link
          href="/patients/new"
          className="tap-target flex items-center gap-2 rounded-xl bg-blue-600 text-white text-sm font-medium px-4 hover:bg-blue-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo
        </Link>
      </div>

      {error && (
        <div className="card p-4 text-sm text-red-600">
          Error al cargar pacientes: {error.message}
        </div>
      )}

      {!error && (!patients || patients.length === 0) && (
        <div className="card p-4 text-center text-sm text-gray-400 py-12">
          <p>Sin pacientes aún</p>
          <p className="mt-1 text-xs">Creá el primer paciente con el botón Nuevo</p>
        </div>
      )}

      {patients && patients.length > 0 && (
        <div className="flex flex-col gap-2">
          {patients.map((p) => (
            <Link key={p.id} href={`/patients/${p.id}`}
              className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow active:scale-[0.99]">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                {p.full_name.split(" ").slice(0,2).map((n: string) => n[0]).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{p.full_name}</p>
                <p className="text-xs text-gray-500">
                  {calculateAge(p.birth_date)} años · {p.document_number}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
