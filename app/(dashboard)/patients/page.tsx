import Link from "next/link"

export const metadata = { title: "Pacientes" }

export default function PatientsPage() {
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
      <div className="flex flex-col gap-1">
        <div className="card p-4 text-center text-sm text-gray-400 py-12">
          <p>Sin pacientes aún</p>
          <p className="mt-1 text-xs">Conectá Supabase en .env.local para comenzar</p>
        </div>
      </div>
    </div>
  )
}
