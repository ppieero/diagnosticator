"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getPackage } from "@/lib/services/packages"
import type { Package } from "@/lib/services/packages"
import PackageForm from "../PackageForm"
import { useCurrency } from "@/hooks/useCurrency"

export default function PaqueteDetailPage() {
  const { pkid } = useParams<{ pkid: string }>()
  const router = useRouter()
  const { symbol } = useCurrency()
  const [pkg, setPkg] = useState<Package | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPackage(pkid).then(data => {
      if (!data) router.push("/paquetes")
      setPkg(data)
      setLoading(false)
    })
  }, [pkid, router])

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
    </div>
  )
  if (!pkg) return null

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{pkg.name}</p>
            <p className="text-xs text-purple-600 font-medium">{symbol}{Number(pkg.price).toFixed(0)}</p>
          </div>
        </div>
      </div>
      <PackageForm pkg={pkg} />
    </div>
  )
}