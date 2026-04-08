"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useCurrency } from "@/hooks/useCurrency"
import { getServices } from "@/lib/services/services"
import type { Service } from "@/lib/services/services"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export default function ServiciosPage() {
  const router = useRouter()
  const { price } = useCurrency()
  const [services, setServices] = useState<Service[]>([])
  const [specialties, setSpecialties] = useState<{ id: string; name: string; color: string }[]>([])
  const [filterSpecialty, setFilterSpecialty] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("specialties").select("id, name, color").eq("is_active", true)
      setSpecialties(data ?? [])
      const svs = await getServices()
      setServices(svs)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = (filterSpecialty
    ? services.filter(s => s.specialty_id === filterSpecialty)
    : services).filter(s => s.is_active)

  const grouped = filtered.reduce<Record<string, Service[]>>((acc, s) => {
    const key = (s.specialty as { name: string })?.name ?? "Sin especialidad"
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Servicios</h2>
          <p className="text-xs text-gray-400 mt-0.5">{services.length} configurados</p>
        </div>
        <button onClick={() => router.push("/servicios/nuevo")}
          className="tap-target px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
          + Nuevo
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterSpecialty("")}
          className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
            !filterSpecialty ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-300")}>
          Todas
        </button>
        {specialties.map(sp => (
          <button key={sp.id} onClick={() => setFilterSpecialty(filterSpecialty === sp.id ? "" : sp.id)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border-2 flex-shrink-0 transition-all",
              filterSpecialty === sp.id ? "text-white border-transparent" : "border-gray-200 text-gray-500 hover:border-gray-300"
            )}
            style={filterSpecialty === sp.id ? { background: sp.color, borderColor: sp.color } : {}}>
            {sp.name}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">🏥</span>
          <p className="text-sm font-medium text-gray-600">No hay servicios configurados</p>
          <button onClick={() => router.push("/servicios/nuevo")} className="text-sm text-blue-600 font-medium">
            Crear primer servicio →
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([specialtyName, svs]) => {
        const spColor = svs[0]?.specialty?.color ?? "#888"
        return (
          <div key={specialtyName} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: spColor }} />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{specialtyName}</p>
              <span className="text-xs text-gray-400">({svs.length})</span>
            </div>
            {svs.map(sv => (
              <button key={sv.id} onClick={() => router.push(`/servicios/${sv.id}`)}
                className="card p-4 text-left hover:shadow-md transition-shadow w-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ background: (sv.color ?? spColor) + "20" }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: sv.color ?? spColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{sv.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{sv.duration_minutes} min</span>
                        {sv.buffer_minutes > 0 && (
                          <span className="text-xs text-gray-400">+ {sv.buffer_minutes} buffer</span>
                        )}
                        {sv.session_count > 1 && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md font-medium">
                            {sv.session_count} sesiones
                          </span>
                        )}
                        {sv.requires_intake && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-medium">
                            Anamnesis
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{price(sv.price)}</p>
                    {sv.session_count > 1 && sv.package_price && (
                      <p className="text-xs text-purple-600 font-medium">{price(sv.package_price)} pack</p>
                    )}
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-lg mt-1 inline-block",
                      sv.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400")}>
                      {sv.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}