import { z } from "zod"

export const patientSchema = z.object({
  full_name: z.string().min(2, "Mínimo 2 caracteres").max(120),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: AAAA-MM-DD"),
  document_type: z.enum(["dni", "passport", "nie", "other"]),
  document_number: z.string().min(3).max(30),
  biological_sex: z.enum(["male", "female", "other"]),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
})
export type PatientFormData = z.infer<typeof patientSchema>

export const diagnosisSchema = z.object({
  evaluation_id: z.string().uuid("Debe vincularse a una evaluación"),
  diagnosis_code: z.string().max(20).optional().or(z.literal("")),
  diagnosis_name: z.string().min(2).max(200),
  status: z.enum(["presumptive", "confirmed", "ruled_out", "under_review"]),
  severity: z.enum(["mild", "moderate", "severe", "critical"]).optional(),
  rationale: z.string().min(10, "Fundamentación clínica obligatoria").max(2000),
  treatment_notes: z.string().max(1000).optional().or(z.literal("")),
  follow_up_date: z.string().optional().or(z.literal("")),
})
export type DiagnosisFormData = z.infer<typeof diagnosisSchema>
