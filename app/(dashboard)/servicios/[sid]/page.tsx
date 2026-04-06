"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getService } from "@/lib/services/services"
import type { Service } from "@/lib/services/services"
import ServiceForm from "../ServiceForm"

export default function ServicioDetailPage() {
  const { sid } = useParams<{ sid: string }>()
  const router = useRouter()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getService(sid).then(data => {
      if (!data) router.push("/servicios")
      setService(data)
      setLoading(false)
    })
  }, [sid, router])

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!service) return null

  const spColor = service.specialty?.color
  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: (service.color ?? spColor ?? "#888") + "20" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: service.color ?? spColor ?? "#888" }} />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{service.name}</p>
            <p className="text-xs text-gray-400">{service.specialty?.name}</p>
          </div>
        </div>
      </div>
      <ServiceForm service={service} />
    </div>
  )
}