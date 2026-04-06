"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getPackages } from "@/lib/services/packages"
import type { Package } from "@/lib/services/packages"
import { cn } from "@/lib/utils"

export default function PaquetesPage() {
  const router = useRouter()
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPackages().then(data => { setPackages(data); setLoading(false) })
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
          <h2 className="text-xl font-bold text-gray-900">Paquetes</h2>
          <p className="text-xs text-gray-400 mt-0.5">{packages.length} configurados</p>
        </div>
        <button onClick={() => router.push("/paquetes/nuevo")}
          className="tap-target px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
          + Nuevo
        </button>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3">
        <p className="text-xs text-purple-800 font-medium">
          Un paquete agrupa uno o varios servicios con un precio especial.
          Se asigna al paciente y lleva control de sesiones usadas vs. disponibles.
        </p>
      </div>

      {packages.length === 0 && (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">📦</span>
          <p className="text-sm font-medium text-gray-600">No hay paquetes configurados</p>
          <button onClick={() => router.push("/paquetes/nuevo")} className="text-sm text-blue-600 font-medium">
            Crear primer paquete →
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {packages.map(pkg => (
          <button key={pkg.id} onClick={() => router.push(`/paquetes/${pkg.id}`)}
            className="card p-4 text-left hover:shadow-md transition-shadow w-full">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{pkg.name}</p>
                  {pkg.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{pkg.description}</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-purple-700">€{Number(pkg.price).toFixed(0)}</p>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-lg mt-1 inline-block",
                  pkg.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400")}>
                  {pkg.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}