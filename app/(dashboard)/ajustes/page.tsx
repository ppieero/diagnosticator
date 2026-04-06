"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { clearSettingsCache } from "@/lib/services/settings"
import { cn } from "@/lib/utils"

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
]

const TIMEZONES = [
  { value: "Europe/Lisbon", label: "Lisboa (UTC+0/+1)" },
  { value: "Europe/Madrid", label: "Madrid (UTC+1/+2)" },
  { value: "America/Lima", label: "Lima (UTC-5)" },
  { value: "America/Bogota", label: "Bogotá (UTC-5)" },
  { value: "America/Mexico_City", label: "Ciudad de México (UTC-6)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (UTC-3)" },
  { value: "America/Santiago", label: "Santiago (UTC-4/-3)" },
]

const CURRENCIES = [
  { value: "EUR", symbol: "€", label: "Euro (€)" },
  { value: "USD", symbol: "$", label: "Dólar USD ($)" },
  { value: "PEN", symbol: "S/", label: "Sol peruano (S/)" },
  { value: "COP", symbol: "$", label: "Peso colombiano ($)" },
  { value: "MXN", symbol: "$", label: "Peso mexicano ($)" },
  { value: "ARS", symbol: "$", label: "Peso argentino ($)" },
  { value: "CLP", symbol: "$", label: "Peso chileno ($)" },
  { value: "BRL", symbol: "R$", label: "Real brasileño (R$)" },
  { value: "GBP", symbol: "£", label: "Libra esterlina (£)" },
]

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "31/12/2025" },
  { value: "MM/DD/YYYY", label: "12/31/2025" },
  { value: "YYYY-MM-DD", label: "2025-12-31" },
]

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  bizum: "Bizum",
  mbway: "MB Way",
  insurance: "Seguro médico",
}

const ALL_PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS)

const TABS = ["General", "Facturación", "Citas"]

export default function AjustesPage() {
  const [activeTab, setActiveTab] = useState("General")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // General
  const [clinicName, setClinicName] = useState("Diagnosticator")
  const [language, setLanguage] = useState("es")
  const [timezone, setTimezone] = useState("Europe/Lisbon")
  const [currency, setCurrency] = useState("EUR")
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY")
  const [timeFormat, setTimeFormat] = useState("24h")

  // Billing
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate, setTaxRate] = useState("0")
  const [taxName, setTaxName] = useState("IVA")
  const [invoicePrefix, setInvoicePrefix] = useState("INV")
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["cash", "card", "transfer"])

  // Appointments
  const [defaultDuration, setDefaultDuration] = useState(60)
  const [cancellationHours, setCancellationHours] = useState(24)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [slotPadding, setSlotPadding] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("clinic_settings").select("key, value")
      if (!data) { setLoading(false); return }
      for (const row of data) {
        if (row.key === "general") {
          const v = row.value
          setClinicName(v.clinic_name ?? "Diagnosticator")
          setLanguage(v.language ?? "es")
          setTimezone(v.timezone ?? "Europe/Lisbon")
          setCurrency(v.currency ?? "EUR")
          setDateFormat(v.date_format ?? "DD/MM/YYYY")
          setTimeFormat(v.time_format ?? "24h")
        }
        if (row.key === "billing") {
          const v = row.value
          setTaxEnabled(v.tax_enabled ?? false)
          setTaxRate(String(v.tax_rate ?? 0))
          setTaxName(v.tax_name ?? "IVA")
          setInvoicePrefix(v.invoice_prefix ?? "INV")
          setPaymentMethods(v.payment_methods ?? ["cash","card","transfer"])
        }
        if (row.key === "appointments") {
          const v = row.value
          setDefaultDuration(v.default_duration ?? 60)
          setCancellationHours(v.cancellation_hours ?? 24)
          setReminderEnabled(v.reminder_enabled ?? false)
          setSlotPadding(v.slot_padding ?? 0)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  function togglePaymentMethod(method: string) {
    setPaymentMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    )
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const currencyObj = CURRENCIES.find(c => c.value === currency)
    await Promise.all([
      supabase.from("clinic_settings").upsert({
        key: "general",
        value: {
          clinic_name: clinicName,
          language,
          timezone,
          currency,
          currency_symbol: currencyObj?.symbol ?? "€",
          date_format: dateFormat,
          time_format: timeFormat,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" }),
      supabase.from("clinic_settings").upsert({
        key: "billing",
        value: {
          tax_enabled: taxEnabled,
          tax_rate: parseFloat(taxRate) || 0,
          tax_name: taxName,
          invoice_prefix: invoicePrefix,
          payment_methods: paymentMethods,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" }),
      supabase.from("clinic_settings").upsert({
        key: "appointments",
        value: {
          default_duration: defaultDuration,
          cancellation_hours: cancellationHours,
          reminder_enabled: reminderEnabled,
          slot_padding: slotPadding,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" }),
    ])
    clearSettingsCache()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Ajustes</h2>
        <p className="text-xs text-gray-400 mt-0.5">Configuracion general de la clinica</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("flex-1 py-2 rounded-lg text-xs font-medium transition-all",
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "General" && (
        <div className="flex flex-col gap-4">
          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clinica</p>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nombre de la clinica</label>
              <input value={clinicName} onChange={e => setClinicName(e.target.value)}
                placeholder="Nombre..." className="input-base" />
            </div>
          </div>

          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Idioma y region</p>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-2">Idioma</label>
              <div className="flex flex-col gap-2">
                {LANGUAGES.map(lang => (
                  <button key={lang.value} type="button" onClick={() => setLanguage(lang.value)}
                    className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                      language === lang.value ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                    <span className={cn("text-sm font-medium", language === lang.value ? "text-blue-900" : "text-gray-700")}>
                      {lang.label}
                    </span>
                    {language === lang.value && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Zona horaria</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input-base">
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Moneda y formato</p>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-2">Moneda</label>
              <div className="flex flex-col gap-2">
                {CURRENCIES.map(cur => (
                  <button key={cur.value} type="button" onClick={() => setCurrency(cur.value)}
                    className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                      currency === cur.value ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                    <span className={cn("text-sm font-medium", currency === cur.value ? "text-blue-900" : "text-gray-700")}>
                      {cur.label}
                    </span>
                    {currency === cur.value && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-2">Formato de fecha</label>
              <div className="flex gap-2">
                {DATE_FORMATS.map(fmt => (
                  <button key={fmt.value} type="button" onClick={() => setDateFormat(fmt.value)}
                    className={cn("flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all",
                      dateFormat === fmt.value ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300")}>
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-2">Formato de hora</label>
              <div className="flex gap-2">
                {[{ value: "24h", label: "24h (14:30)" }, { value: "12h", label: "12h (2:30 PM)" }].map(fmt => (
                  <button key={fmt.value} type="button" onClick={() => setTimeFormat(fmt.value)}
                    className={cn("flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all",
                      timeFormat === fmt.value ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300")}>
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Facturación" && (
        <div className="flex flex-col gap-4">
          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Impuestos</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Aplicar impuesto por defecto</p>
                <p className="text-xs text-gray-400">Se aplicara al crear nuevos productos y servicios</p>
              </div>
              <button type="button" onClick={() => setTaxEnabled(!taxEnabled)}
                className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
                  taxEnabled ? "bg-blue-600" : "bg-gray-200")}>
                <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                  taxEnabled ? "translate-x-5" : "translate-x-1")} />
              </button>
            </div>
            {taxEnabled && (
              <>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nombre del impuesto</label>
                  <input value={taxName} onChange={e => setTaxName(e.target.value)}
                    placeholder="IVA, GST, VAT..." className="input-base" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Tasa (%)</label>
                  <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                    placeholder="0" min="0" max="100" step="0.5" className="input-base" />
                  <p className="text-xs text-gray-400 mt-1">
                    Ejemplo: un producto de {CURRENCIES.find(c => c.value === currency)?.symbol}100 
                    con {taxRate}% de {taxName} = {CURRENCIES.find(c => c.value === currency)?.symbol}{(100 * (1 + (parseFloat(taxRate)||0)/100)).toFixed(2)}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="card p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Facturas</p>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Prefijo de factura</label>
              <input value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)}
                placeholder="INV, FAC, REC..." className="input-base" />
              <p className="text-xs text-gray-400 mt-1">
                Ejemplo: {invoicePrefix}-2025-001
              </p>
            </div>
          </div>

          <div className="card p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Metodos de pago aceptados</p>
            <div className="flex flex-col gap-2">
              {ALL_PAYMENT_METHODS.map(method => {
                const selected = paymentMethods.includes(method)
                return (
                  <button key={method} type="button" onClick={() => togglePaymentMethod(method)}
                    className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left",
                      selected ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-gray-300")}>
                    <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                      selected ? "bg-green-600 border-green-600" : "border-gray-300")}>
                      {selected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    <span className={cn("text-sm font-medium", selected ? "text-green-900" : "text-gray-700")}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Citas" && (
        <div className="flex flex-col gap-4">
          <div className="card p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Configuracion de citas</p>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-2">Duracion por defecto</label>
              <div className="flex gap-2 flex-wrap">
                {[15,20,30,45,60,75,90,120].map(d => (
                  <button key={d} type="button" onClick={() => setDefaultDuration(d)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                      defaultDuration === d ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300")}>
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-2">Tiempo entre slots (padding)</label>
              <div className="flex gap-2 flex-wrap">
                {[0,5,10,15].map(p => (
                  <button key={p} type="button" onClick={() => setSlotPadding(p)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                      slotPadding === p ? "bg-gray-700 text-white border-gray-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                    {p === 0 ? "Sin padding" : `${p} min`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">
                Horas de antelacion para cancelar
              </label>
              <div className="flex gap-2 flex-wrap">
                {[1,2,6,12,24,48].map(h => (
                  <button key={h} type="button" onClick={() => setCancellationHours(h)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                      cancellationHours === h ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300")}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Recordatorios automaticos</p>
              <p className="text-xs text-gray-400">Notificar al paciente antes de su cita</p>
            </div>
            <button type="button" onClick={() => setReminderEnabled(!reminderEnabled)}
              className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
                reminderEnabled ? "bg-blue-600" : "bg-gray-200")}>
              <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                reminderEnabled ? "translate-x-5" : "translate-x-1")} />
            </button>
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className={cn("tap-target w-full rounded-xl text-sm font-semibold transition-all",
          saved ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700",
          saving && "opacity-50")}>
        {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar ajustes"}
      </button>
    </div>
  )
}