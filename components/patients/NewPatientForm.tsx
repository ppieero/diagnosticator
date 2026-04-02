"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { patientSchema, type PatientFormData } from "@/lib/validations/schemas"
import { createPatient } from "@/lib/services/patients"

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

export function NewPatientForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState("")
  const [section, setSection] = useState(0)

  const { register, handleSubmit, trigger, formState: { errors, isSubmitting } } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
  })

  async function nextSection() {
    const fields: (keyof PatientFormData)[][] = [
      ["full_name", "birth_date", "document_type", "document_number", "biological_sex"],
      ["phone", "email", "address"],
    ]
    const valid = await trigger(fields[section])
    if (valid) setSection((s) => s + 1)
  }

  async function onSubmit(data: PatientFormData) {
    try {
      setServerError("")
      await createPatient(data)
      router.push("/patients")
    } catch (e) {
      setServerError("Error al guardar el paciente. Intentá de nuevo.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

      {/* Sección 0 — Datos personales */}
      {section === 0 && (
        <div className="card p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Datos personales</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Nombre completo *</label>
            <input {...register("full_name")} className="input-base" placeholder="Ej: María García López" />
            {errors.full_name && <p className="text-xs text-red-600">{errors.full_name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Fecha de nacimiento *</label>
            <input {...register("birth_date")} type="date" className="input-base" />
            {errors.birth_date && <p className="text-xs text-red-600">{errors.birth_date.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Tipo de documento *</label>
            <select {...register("document_type")} className="input-base">
              <option value="">Seleccionar...</option>
              {DOCUMENT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.document_type && <p className="text-xs text-red-600">{errors.document_type.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Número de documento *</label>
            <input {...register("document_number")} className="input-base" placeholder="Ej: 12345678A" />
            {errors.document_number && <p className="text-xs text-red-600">{errors.document_number.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Sexo biológico *</label>
            <select {...register("biological_sex")} className="input-base">
              <option value="">Seleccionar...</option>
              {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.biological_sex && <p className="text-xs text-red-600">{errors.biological_sex.message}</p>}
          </div>

          <button type="button" onClick={nextSection}
            className="tap-target w-full rounded-xl bg-blue-600 text-white font-medium text-base hover:bg-blue-700 transition-colors mt-2">
            Siguiente
          </button>
        </div>
      )}

      {/* Sección 1 — Contacto */}
      {section === 1 && (
        <div className="card p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contacto</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Teléfono</label>
            <input {...register("phone")} type="tel" className="input-base" placeholder="+34 600 000 000" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input {...register("email")} type="email" className="input-base" placeholder="paciente@email.com" />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Dirección</label>
            <input {...register("address")} className="input-base" placeholder="Calle, número, ciudad" />
          </div>

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => setSection(0)}
              className="tap-target flex-1 rounded-xl border border-gray-300 text-gray-700 font-medium text-base hover:bg-gray-50 transition-colors">
              Atrás
            </button>
            <button type="button" onClick={nextSection}
              className="tap-target flex-1 rounded-xl bg-blue-600 text-white font-medium text-base hover:bg-blue-700 transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Sección 2 — Notas */}
      {section === 2 && (
        <div className="card p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Notas</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <textarea {...register("notes")} rows={4}
              className="input-base resize-none" placeholder="Información adicional relevante..." />
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => setSection(1)}
              className="tap-target flex-1 rounded-xl border border-gray-300 text-gray-700 font-medium text-base hover:bg-gray-50 transition-colors">
              Atrás
            </button>
            <button type="submit" disabled={isSubmitting}
              className="tap-target flex-1 rounded-xl bg-blue-600 text-white font-medium text-base hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {isSubmitting ? "Guardando..." : "Guardar paciente"}
            </button>
          </div>
        </div>
      )}

      {/* Indicador de progreso */}
      <div className="flex justify-center gap-2">
        {[0,1,2].map((i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === section ? "w-6 bg-blue-600" : "w-1.5 bg-gray-300"}`} />
        ))}
      </div>
    </form>
  )
}
