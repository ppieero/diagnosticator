"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { patientSchema, type PatientFormData } from "@/lib/validations/schemas"
import { getPatient, updatePatient } from "@/lib/services/patients"

const DOCUMENT_TYPES = [
  { value: "dni", label: "DNI" },
  { value: "passport", label: "Pasaporte" },
  { value: "nie", label: "NIE" },
  { value: "other", label: "Otro" },
]

const SEX_OPTIONS = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Femenino" },
  { value: "other", label: "Otro" },
]

export default function EditPatientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [serverError, setServerError] = useState("")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
  })

  useEffect(() => {
    getPatient(id).then(p => {
      if (!p) { router.push("/patients"); return }
      reset({
        full_name: p.full_name,
        birth_date: p.birth_date,
        document_type: p.document_type as PatientFormData["document_type"],
        document_number: p.document_number,
        biological_sex: p.biological_sex as PatientFormData["biological_sex"],
        phone: p.phone ?? "",
        email: p.email ?? "",
        address: p.address ?? "",
        notes: p.notes ?? "",
      })
      setLoading(false)
    })
  }, [id, reset, router])

  async function onSubmit(data: PatientFormData) {
    try {
      setServerError("")
      await updatePatient(id, data)
      router.push(`/patients/${id}`)
    } catch {
      setServerError("Error al guardar. Intentá de nuevo.")
    }
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
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
        <h2 className="text-xl font-bold text-gray-900">Editar paciente</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="card p-4 flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos personales</p>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nombre completo *</label>
            <input {...register("full_name")} className="input-base" />
            {errors.full_name && <p className="text-xs text-red-600 mt-1">{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Fecha de nacimiento *</label>
            <input {...register("birth_date")} type="date" className="input-base" />
            {errors.birth_date && <p className="text-xs text-red-600 mt-1">{errors.birth_date.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Tipo de doc.</label>
              <select {...register("document_type")} className="input-base">
                {DOCUMENT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Número</label>
              <input {...register("document_number")} className="input-base" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Sexo biológico *</label>
            <select {...register("biological_sex")} className="input-base">
              {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-4 flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contacto</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Teléfono</label>
              <input {...register("phone")} type="tel" className="input-base" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Email</label>
              <input {...register("email")} type="email" className="input-base" />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Dirección</label>
            <input {...register("address")} className="input-base" />
          </div>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas</p>
          <textarea {...register("notes")} rows={3} className="input-base resize-none" />
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}

        <button type="submit" disabled={isSubmitting}
          className="tap-target w-full rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
          {isSubmitting ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  )
}
