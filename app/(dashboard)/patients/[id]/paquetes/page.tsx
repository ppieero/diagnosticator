"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  getPatientPackages, assignPackage, useSession, updatePackageStatus
} from "@/lib/services/patient-packages"
import type { PatientPackage, PaymentMode } from "@/lib/services/patient-packages"
import { cn } from "@/lib/utils"

const STATUS_CONFIG = {
  active:    { label: "Activo",     bg: "bg-green-100",  text: "text-green-800" },
  completed: { label: "Completado", bg: "bg-gray-100",   text: "text-gray-600" },
  expired:   { label: "Vencido",    bg: "bg-red-100",    text: "text-red-700" },
  cancelled: { label: "Cancelado",  bg: "bg-orange-100", text: "text-orange-700" },
}

const PAYMENT_LABELS: Record<PaymentMode, string> = {
  full: "Pago completo",
  installments: "En cuotas",
  pending: "Pendiente de pago",
}

interface CatalogPackage {
  id: string
  name: string
  price: number
  description?: string
  total_sessions: number
}

export default function PatientPaquetesPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const router = useRouter()
  const [packages, setPackages] = useState<PatientPackage[]>([])
  const [catalog, setCatalog] = useState<CatalogPackage[]>([])
  const [professionals, setProfessionals] = useState<{ id: string; full_name: string; specialty: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [patientName, setPatientName] = useState("")

  const [assignType, setAssignType] = useState<"package" | "service">("package")
  const [availableServices, setAvailableServices] = useState<{ id: string; name: string; price: number; specialty?: { name: string } }[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [selectedPackageId, setSelectedPackageId] = useState("")
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("")
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("full")
  const [pricePaid, setPricePaid] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [notes, setNotes] = useState("")

  async function load() {
    setLoading(true)
    const supabase = createClient()

    const [pkgsData, patData, profData] = await Promise.all([
      getPatientPackages(patientId),
      supabase.from("patients").select("full_name").eq("id", patientId).single(),
      supabase.from("professionals")
        .select("id, profile:profiles(full_name), specialty:specialties(name)")
        .eq("is_active", true),
    ])

    setPackages(pkgsData)
    setPatientName(patData.data?.full_name ?? "")

    const profs = (profData.data ?? []).map((p: { id: string; profile: { full_name: string }; specialty: { name: string } }) => ({
      id: p.id,
      full_name: p.profile?.full_name ?? "",
      specialty: p.specialty?.name ?? "",
    }))
    setProfessionals(profs)

    const { data: svsData } = await supabase
      .from("services")
      .select("id, name, price, specialty:specialties(name)")
      .eq("is_active", true)
      .order("name")
    setAvailableServices((svsData ?? []) as unknown as typeof availableServices)

    const { data: pkgItems } = await supabase
      .from("packages")
      .select("id, name, price, description, items:package_items(quantity)")
      .eq("is_active", true)

    const catalogData: CatalogPackage[] = (pkgItems ?? []).map((p: {
      id: string; name: string; price: number; description?: string
      items?: { quantity: number }[]
    }) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      total_sessions: (p.items ?? []).reduce((s: number, i: { quantity: number }) => s + i.quantity, 0) || 1,
    }))
    setCatalog(catalogData)
    setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  function handleSelectPackage(pkg: CatalogPackage) {
    setSelectedPackageId(pkg.id)
    setSelectedServiceId("")
    setPricePaid(String(pkg.price))
  }

  function handleSelectService(sv: { id: string; name: string; price: number }) {
    setSelectedServiceId(sv.id)
    setSelectedPackageId("")
    setPricePaid(String(sv.price))
  }

  async function handleAssign() {
    if (!selectedPackageId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const pkg = catalog.find(p => p.id === selectedPackageId)
    const sv = availableServices.find(s => s.id === selectedServiceId)
    if (!pkg && !sv) return
    setSaving(true)
    try {
      await assignPackage({
        patient_id: patientId,
        package_id: pkg ? selectedPackageId : undefined,
        service_id: sv ? selectedServiceId : undefined,
        professional_id: selectedProfessionalId || undefined,
        total_sessions: pkg ? pkg.total_sessions : 1,
        payment_mode: paymentMode,
        price_paid: pricePaid ? parseFloat(pricePaid) : undefined,
        expires_at: expiresAt || undefined,
        notes: notes || undefined,
        created_by: user.id,
      })
      setShowForm(false)
      setSelectedPackageId("")
      setSelectedProfessionalId("")
      setPaymentMode("full")
      setPricePaid("")
      setExpiresAt("")
      setNotes("")
      await load()
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string; details?: string }
      console.error("Error asignando paquete:", e?.message ?? e?.code ?? JSON.stringify(err))
      alert("Error: " + (e?.message ?? e?.code ?? JSON.stringify(err)))
    } finally {
      setSaving(false)
    }
  }

  async function handleUseSession(pkgId: string) {
    setActionLoading(pkgId)
    try { await useSession(pkgId) } finally {
      await load()
      setActionLoading(null)
    }
  }

  async function handleCancel(pkgId: string) {
    setActionLoading(pkgId)
    try { await updatePackageStatus(pkgId, "cancelled") } finally {
      await load()
      setActionLoading(null)
    }
  }

  const active = packages.filter(p => p.status === "active")
  const historical = packages.filter(p => p.status !== "active")

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Paquetes del paciente</h2>
          <p className="text-xs text-gray-400 mt-0.5">{patientName}</p>
        </div>
      </div>

      <button onClick={() => setShowForm(!showForm)}
        className={cn("tap-target w-full rounded-xl text-sm font-semibold transition-colors",
          showForm ? "bg-gray-200 text-gray-700" : "bg-purple-600 text-white hover:bg-purple-700")}>
        {showForm ? "Cancelar" : "+ Asignar paquete"}
      </button>

      {showForm && (
        <div className="card p-4 flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de asignacion</p>

          <div className="flex gap-2">
            {(["package","service"] as const).map(t => (
              <button key={t} type="button" onClick={() => { setAssignType(t); setSelectedPackageId(""); setSelectedServiceId(""); setPricePaid("") }}
                className={cn("flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all",
                  assignType === t ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-500 hover:border-purple-300")}>
                {t === "package" ? "Paquete del catalogo" : "Servicio individual"}
              </button>
            ))}
          </div>

          {assignType === "service" && (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {availableServices.map(sv => (
                <button key={sv.id} type="button" onClick={() => handleSelectService(sv)}
                  className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                    selectedServiceId === sv.id ? "border-purple-600 bg-purple-50" : "border-gray-200 hover:border-gray-300")}>
                  <div>
                    <p className={cn("text-sm font-semibold", selectedServiceId === sv.id ? "text-purple-900" : "text-gray-800")}>{sv.name}</p>
                    <p className="text-xs text-gray-400">{(sv.specialty as { name: string })?.name} · 1 sesion</p>
                  </div>
                  <span className="text-sm font-bold text-purple-700 ml-2">€{Number(sv.price).toFixed(0)}</span>
                </button>
              ))}
            </div>
          )}

          {assignType === "package" && catalog.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-800">No hay paquetes en el catalogo. Crea uno en Paquetes primero.</p>
              <button onClick={() => router.push("/paquetes/nuevo")} className="text-xs text-amber-700 font-medium underline mt-1">
                Ir a crear paquete →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {catalog.map(pkg => (
                <button key={pkg.id} type="button" onClick={() => handleSelectPackage(pkg)}
                  className={cn("flex items-start justify-between px-4 py-3 rounded-xl border-2 transition-all text-left",
                    selectedPackageId === pkg.id ? "border-purple-600 bg-purple-50" : "border-gray-200 hover:border-gray-300")}>
                  <div>
                    <p className={cn("text-sm font-semibold", selectedPackageId === pkg.id ? "text-purple-900" : "text-gray-800")}>
                      {pkg.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{pkg.total_sessions} sesiones</p>
                    {pkg.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{pkg.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-purple-700 flex-shrink-0 ml-2">
                    €{Number(pkg.price).toFixed(0)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {(selectedPackageId || selectedServiceId) && (
            <>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-2">Profesional asignado (opcional)</label>
                <select value={selectedProfessionalId} onChange={e => setSelectedProfessionalId(e.target.value)}
                  className="input-base">
                  <option value="">Sin asignar</option>
                  {professionals.map(prof => (
                    <option key={prof.id} value={prof.id}>
                      {prof.full_name} — {prof.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Precio cobrado (€)</label>
                <input type="number" value={pricePaid} onChange={e => setPricePaid(e.target.value)}
                  placeholder="0.00" step="0.01" className="input-base" />
                <p className="text-xs text-gray-400 mt-1">Precio sugerido del paquete ya cargado</p>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium block mb-2">Modalidad de pago</label>
                <div className="flex flex-col gap-2">
                  {(["full","installments","pending"] as PaymentMode[]).map(mode => (
                    <button key={mode} type="button" onClick={() => setPaymentMode(mode)}
                      className={cn("px-4 py-2.5 rounded-xl border-2 text-left text-sm font-medium transition-all",
                        paymentMode === mode ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700 hover:border-gray-300")}>
                      {PAYMENT_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Vencimiento (opcional)</label>
                <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="input-base" />
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Notas (opcional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  rows={2} placeholder="Observaciones..." className="input-base resize-none" />
              </div>

              <button onClick={handleAssign} disabled={saving}
                className="tap-target w-full rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? "Guardando..." : "Confirmar asignacion →"}
              </button>
            </>
          )}
        </div>
      )}

      {active.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activos ({active.length})</p>
          {active.map(pkg => {
            const st = STATUS_CONFIG[pkg.status]
            const progress = pkg.total_sessions > 0 ? pkg.sessions_used / pkg.total_sessions : 0
            const remaining = pkg.total_sessions - pkg.sessions_used
            const pkgName = (pkg.package as { name: string } | undefined)?.name ?? "Paquete"
            return (
              <div key={pkg.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{pkgName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {PAYMENT_LABELS[pkg.payment_mode]}
                      {pkg.price_paid ? ` · €${Number(pkg.price_paid).toFixed(0)}` : ""}
                    </p>
                  </div>
                  <span className={cn("text-xs font-medium px-2 py-1 rounded-lg", st.bg, st.text)}>{st.label}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">{pkg.sessions_used} de {pkg.total_sessions} sesiones</span>
                    <span className="text-xs font-semibold text-purple-700">{remaining} restantes</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(progress * 100, 100)}%` }} />
                  </div>
                </div>
                {pkg.expires_at && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                    Vence: {new Date(pkg.expires_at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                )}
                {pkg.notes && <p className="text-xs text-gray-500 italic">{pkg.notes}</p>}
                <div className="flex gap-2">
                  <button onClick={() => handleUseSession(pkg.id)}
                    disabled={actionLoading === pkg.id || remaining === 0}
                    className="flex-1 tap-target rounded-xl bg-green-600 text-white text-xs font-semibold disabled:opacity-50">
                    {actionLoading === pkg.id ? "..." : `Usar sesion (${remaining} restantes)`}
                  </button>
                  <button onClick={() => handleCancel(pkg.id)}
                    disabled={actionLoading === pkg.id}
                    className="px-3 tap-target rounded-xl border border-red-300 text-red-500 text-xs font-medium disabled:opacity-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {packages.length === 0 && !showForm && (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">📦</span>
          <p className="text-sm font-medium text-gray-500">Sin paquetes asignados</p>
        </div>
      )}

      {historical.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Historial ({historical.length})</p>
          {historical.map(pkg => {
            const st = STATUS_CONFIG[pkg.status]
            const pkgName = (pkg.package as { name: string } | undefined)?.name ?? "Paquete"
            return (
              <div key={pkg.id} className="card p-3 opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{pkgName}</p>
                    <p className="text-xs text-gray-400">{pkg.sessions_used}/{pkg.total_sessions} sesiones</p>
                  </div>
                  <span className={cn("text-xs font-medium px-2 py-1 rounded-lg", st.bg, st.text)}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}