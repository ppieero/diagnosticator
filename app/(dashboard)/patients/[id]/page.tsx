import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { formatDate, calculateAge } from "@/lib/utils"
import Link from "next/link"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("patients").select("full_name").eq("id", id).single()
  return { title: data?.full_name ?? "Paciente" }
}

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: patient, error } = await supabase.from("patients").select("*").eq("id", id).single()
  if (error || !patient) notFound()
  const age = calculateAge(patient.birth_date)
  const SEX_LABELS: Record<string, string> = { male: "Masculino", female: "Femenino", other: "Otro" }
  const DOC_LABELS: Record<string, string> = { dni: "DNI", passport: "Pasaporte", nie: "NIE", other: "Otro" }
  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/patients" className="tap-target flex items-center justify-center rounded-xl border border-gray-200 w-10 h-10 text-gray-500 hover:bg-gray-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">{patient.full_name}</h2>
          <p className="text-sm text-gray-500">{age} años · {DOC_LABELS[patient.document_type]} {patient.document_number}</p>
        </div>
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos personales</p>
        <Row label="Nombre completo" value={patient.full_name} />
        <Row label="Fecha de nacimiento" value={formatDate(patient.birth_date) + " (" + age + " años)"} />
        <Row label="Sexo biológico" value={SEX_LABELS[patient.biological_sex]} />
        <Row label="Documento" value={DOC_LABELS[patient.document_type] + " " + patient.document_number} />
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contacto</p>
        <Row label="Teléfono" value={patient.phone || "—"} />
        <Row label="Email" value={patient.email || "—"} />
        <Row label="Dirección" value={patient.address || "—"} />
      </div>
      <div className="flex flex-col gap-2">
        <Link href={"/patients/" + id + "/evaluations"} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 text-sm">Evaluaciones</p>
            <p className="text-xs text-gray-500">Ver y registrar evaluaciones clínicas</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
        <Link href={"/patients/" + id + "/diagnoses"} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 text-sm">Diagnósticos</p>
            <p className="text-xs text-gray-500">Diagnósticos derivados de evaluaciones</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  )
}