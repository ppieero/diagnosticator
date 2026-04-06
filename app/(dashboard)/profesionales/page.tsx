"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getProfessionals } from "@/lib/services/professionals"
import type { ProfessionalFull } from "@/lib/services/professionals"
import { cn } from "@/lib/utils"

const DAYS_SHORT = ["D","L","M","X","J","V","S"]

export default function ProfesionalesPage() {
  const router = useRouter()
  const [professionals, setProfessionals] = useState<ProfessionalFull[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfessionals().then(data => { setProfessionals(data); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Profesionales</h2>
          <p className="text-xs text-gray-400 mt-0.5">{professionals.length} registrados</p>
        </div>
        <button
          onClick={() => router.push("/profesionales/nuevo")}
          className="tap-target px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Nuevo
        </button>
      </div>

      {professionals.length === 0 && (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">👤</span>
          <p className="text-sm font-medium text-gray-600">No hay profesionales registrados</p>
          <button
            onClick={() => router.push("/profesionales/nuevo")}
            className="text-sm text-blue-600 font-medium"
          >
            Crear primer profesional →
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {professionals.map(prof => {
          const profile = prof.profile as { full_name: string; email?: string; phone?: string }
          return (
            <button
              key={prof.id}
              onClick={() => router.push(`/profesionales/${prof.id}`)}
              className="card p-4 text-left hover:shadow-md transition-shadow w-full"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-lg font-bold"
                  style={{ background: prof.color }}
                >
                  {profile?.full_name?.charAt(0).toUpperCase() ?? "P"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{profile?.full_name}</p>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 inline-block"
                        style={{ background: (prof.specialty as { color: string })?.color + "20", color: (prof.specialty as { color: string })?.color }}
                      >
                        {(prof.specialty as { name: string })?.name}
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0",
                      prof.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {prof.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  {profile?.email && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{profile.email}</p>
                  )}
                  {prof.license_number && (
                    <p className="text-xs text-gray-400">N° {prof.license_number}</p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}