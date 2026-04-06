"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createPayment } from "@/lib/services/payments"
import { useCurrency } from "@/hooks/useCurrency"
import { cn } from "@/lib/utils"

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia",
  bizum: "Bizum", mbway: "MB Way", insurance: "Seguro medico",
}

export default function NuevoPagoPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { price, settings } = useCurrency()
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [patientId, setPatientId] = useState(params.get("patient_id") ?? "")
  const [patientSearch, setPatientSearch] = useState("")
  const [amount, setAmount] = useState(params.get("amount") ?? "")
  const [concept, setConcept] = useState(params.get("concept") ?? "")
  const [method, setMethod] = useState("cash")
  const [status, setStatus] = useState<"paid" | "pending">("paid")
  const [notes, setNotes] = useState("")

  const paymentMethods = settings?.billing.payment_methods ?? ["cash","card","transfer"]

  useEffect(() => {
    const supabase = createClient()
    supabase.from("patients").select("id, full_name").order("full_name")
      .then(({ data }) => setPatients(data ?? []))
  }, [])

  const filteredPatients = patientSearch
    ? patients.filter(p => p.full_name.toLowerCase().includes(patientSearch.toLowerCase()))
    : patients

  const taxRate = settings?.billing.tax_enabled ? settings.billing.tax_rate : 0
  const amountNum = parseFloat(amount) || 0
  const taxAmount = Math.round(amountNum * taxRate / 100 * 100) / 100
  const total = amountNum + taxAmount
  const symbol = settings?.general.currency_symbol ?? "€"

  async function handleSave() {
    if (!patientId) { setError("Selecciona un paciente"); return }
    if (!amount || amountNum <= 0) { setError("El importe debe ser mayor a 0"); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const pay = await createPayment({
        patient_id: patientId,
        amount: amountNum,
        payment_method: method,
        status,
        concept: concept || undefined,
        notes: notes || undefined,
        created_by: user?.id ?? "",
      })
      router.push(`/pagos/${pay.id}/recibo`)
    } catch (err) {
      console.error(err)
      setError("Error al registrar el pago")
    } finally {
      setSaving(false)
    }
  }

  const selectedPatient = patients.find(p => p.id === patientId)

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-900">Registrar pago</h2>
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Paciente</p>
        {selectedPatient ? (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-blue-400 bg-blue-50">
            <div>
              <p className="text-sm font-semibold text-blue-900">{selectedPatient.full_name}</p>
              <button onClick={() => { setPatientId(""); setPatientSearch("") }}
                className="text-xs text-blue-600 font-medium mt-0.5">Cambiar</button>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
              placeholder="Buscar paciente..." className="input-base" />
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {filteredPatients.slice(0, 8).map(p => (
                <button key={p.id} type="button" onClick={() => { setPatientId(p.id); setPatientSearch("") }}
                  className="text-left px-4 py-2.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm text-gray-800">
                  {p.full_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalle del cobro</p>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Concepto</label>
          <input value={concept} onChange={e => setConcept(e.target.value)}
            placeholder="Ej: Sesion fisioterapia, Paquete 10 sesiones..." className="input-base" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Importe ({symbol})</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" step="0.01" className="input-base text-lg font-semibold" />
          {taxRate > 0 && amountNum > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Base imponible</span><span>{symbol}{amountNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{settings?.billing.tax_name ?? "IVA"} ({taxRate}%)</span>
                <span>{symbol}{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 mt-2 pt-2 border-t border-gray-200">
                <span>Total</span><span>{symbol}{total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Metodo de pago</p>
        <div className="grid grid-cols-2 gap-2">
          {paymentMethods.map(m => (
            <button key={m} type="button" onClick={() => setMethod(m)}
              className={cn("py-2.5 rounded-xl text-xs font-medium border-2 transition-all",
                method === m ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300")}>
              {METHOD_LABELS[m] ?? m}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado del pago</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setStatus("paid")}
            className={cn("flex-1 py-2.5 rounded-xl text-xs font-medium border-2 transition-all",
              status === "paid" ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600")}>
            Cobrado ahora
          </button>
          <button type="button" onClick={() => setStatus("pending")}
            className={cn("flex-1 py-2.5 rounded-xl text-xs font-medium border-2 transition-all",
              status === "pending" ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-600")}>
            Pendiente de cobro
          </button>
        </div>
      </div>

      <div className="card p-4">
        <label className="text-xs text-gray-500 font-medium block mb-1">Notas (opcional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={2} placeholder="Observaciones del pago..." className="input-base resize-none" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !patientId || !amount}
        className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
        {saving ? "Registrando..." : `Registrar ${status === "paid" ? "cobro" : "pago pendiente"} →`}
      </button>
    </div>
  )
}