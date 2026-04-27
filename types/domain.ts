// ============================================================
// DIAGNOSTICATOR v2 — Tipos de dominio clínico completos
// ============================================================

export type UUID = string
export type ISOTimestamp = string

// ── Roles ────────────────────────────────────────────────────
export type UserRole = 'admin' | 'receptionist' | 'professional'

// ── Especialidades ────────────────────────────────────────────
export interface Specialty {
  id: UUID
  name: string
  slug: string
  description?: string
  color: string
  icon?: string
  is_active: boolean
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ── Profesionales ─────────────────────────────────────────────
export interface Professional {
  id: UUID
  user_id: UUID
  specialty_id: UUID
  license_number?: string
  bio?: string
  is_active: boolean
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
  specialty?: Specialty
}

// ── Paciente ─────────────────────────────────────────────────
export type DocumentType = 'dni' | 'passport' | 'nie' | 'other'
export type BiologicalSex = 'male' | 'female' | 'other'

export interface Patient {
  id: UUID
  full_name: string
  birth_date: string
  document_type: DocumentType
  document_number: string
  biological_sex: BiologicalSex
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active: boolean
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
  created_by: UUID
  updated_by: UUID
}

// ── Anamnesis ─────────────────────────────────────────────────
export type PregnancyStatus = 'not_applicable' | 'no' | 'yes' | 'unknown'
export type SmokingStatus   = 'never' | 'former' | 'current' | 'unknown'
export type AlcoholStatus   = 'none' | 'occasional' | 'moderate' | 'heavy' | 'unknown'

export interface Medication {
  name: string; dose?: string; frequency?: string; since?: string; notes?: string
}
export interface Allergy {
  substance: string; reaction?: string; severity: 'mild' | 'moderate' | 'severe' | 'unknown'
}
export interface ClinicalHistory {
  condition: string; diagnosed_year?: number; status: 'active' | 'resolved' | 'chronic'; notes?: string
}
export interface FamilyHistory {
  condition: string; relationship: string; notes?: string
}

export interface Anamnesis {
  id: UUID
  patient_id: UUID
  height_cm?: number
  weight_kg?: number
  pregnancy_status: PregnancyStatus
  smoking_status: SmokingStatus
  alcohol_status: AlcoholStatus
  main_complaint?: string
  current_symptoms: string[]
  active_medications: Medication[]
  known_allergies: Allergy[]
  personal_history: ClinicalHistory[]
  family_history: FamilyHistory[]
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
  created_by: UUID
  updated_by: UUID
}

// ── Servicios y paquetes ──────────────────────────────────────
export interface Service {
  id: UUID
  specialty_id: UUID
  name: string
  description?: string
  duration_minutes: number
  price: number
  session_count?: number
  is_active: boolean
}

export type PaymentMode = 'package' | 'per_session'
export type PackageStatus = 'active' | 'completed' | 'expired' | 'cancelled'

export interface PatientServicePackage {
  id: UUID
  patient_id: UUID
  service_id: UUID
  professional_id?: UUID
  total_sessions: number
  sessions_used: number
  sessions_remaining?: number
  payment_mode: PaymentMode
  status: PackageStatus
  expires_at?: string
  notes?: string
  purchased_at: ISOTimestamp
  created_by: UUID
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'pos' | 'yape' | 'other'
export type PaymentStatus = 'paid' | 'pending' | 'refunded' | 'cancelled'

export interface Payment {
  id: UUID
  package_id?: UUID
  patient_id: UUID
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  status: PaymentStatus
  reference_number?: string
  session_id?: UUID
  notes?: string
  confirmed_by?: UUID
  confirmed_at?: ISOTimestamp
  created_by: UUID
  created_at: ISOTimestamp
}

// ── Agenda ────────────────────────────────────────────────────
export type AppointmentStatus =
  | 'scheduled' | 'confirmed' | 'in_progress'
  | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: UUID
  patient_id: UUID
  professional_id: UUID
  specialty_id: UUID
  service_id: UUID
  package_id?: UUID
  scheduled_at: ISOTimestamp
  duration_minutes: number
  status: AppointmentStatus
  chief_complaint?: string
  notes?: string
  cancellation_reason?: string
  created_by: UUID
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
  patient?: Patient
  professional?: Professional
  service?: Service
}

// ── Evaluación / Encounter ────────────────────────────────────
export type EncounterType   = 'initial' | 'session' | 'followup'
export type EncounterStatus = 'in_progress' | 'completed' | 'cancelled'

export interface Evaluation {
  id: UUID
  patient_id: UUID
  professional_id?: UUID
  specialty_id?: UUID
  appointment_id?: UUID
  package_id?: UUID
  session_number?: number
  encounter_type: EncounterType
  evaluation_type_id: string
  status: EncounterStatus | string
  soap_notes?: string
  started_at: ISOTimestamp
  ended_at?: ISOTimestamp
  notes?: string
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ── Motor de formularios ──────────────────────────────────────
export type FieldType =
  | 'text' | 'textarea' | 'number' | 'decimal' | 'date' | 'time' | 'phone'
  | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'switch' | 'button_group'
  | 'scale_0_10' | 'vas_pain' | 'body_map' | 'measurement' | 'range_of_motion'
  | 'table_grid' | 'scored_test' | 'repeating_group' | 'lab_upload'
  | 'calculated' | 'score_display' | 'section_header' | 'info_text' | 'divider'
  | 'from_anamnesis' | 'from_previous'

export interface FieldOption {
  value: string
  label: string
  score?: number
}

export interface VisibilityCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'includes' | 'not_empty' | 'empty'
  value: string | number | boolean | string[]
  logic?: 'and' | 'or'
}

export interface ClinicalAlert {
  condition: string
  message: string
  severity: 'info' | 'warning' | 'danger'
}

export interface FormFieldConfig {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help_text?: string
  options?: FieldOption[]
  min?: number
  max?: number
  unit?: string
  rows?: number
  min_items?: number
  max_items?: number
  item_label?: string
  add_label?: string
  fields?: FormFieldConfig[]
  default_value?: unknown
  visibility_conditions?: VisibilityCondition[]
  audit_required?: boolean
  clinical_alert?: ClinicalAlert
  prefill?: string
  scoring?: { weight?: number; section?: string }
  config?: Record<string, unknown>
  test_key?: string
}

export interface FormSectionConfig {
  id: string
  title: string
  description?: string
  collapsible?: boolean
  required?: boolean
  order: number
  scoring?: { enabled?: boolean; weight?: number }
  fields: FormFieldConfig[]
}

export interface ScoringConfig {
  enabled: boolean
  type: 'section_sum' | 'weighted' | 'custom'
  sections?: string[]
}

export interface FormTemplateConfig {
  id: string
  name: string
  specialty: string
  form_type: 'initial' | 'session' | 'followup' | 'evaluation'
  version: number
  description?: string
  estimated_minutes?: number
  scoring?: ScoringConfig
  sections: FormSectionConfig[]
}

// ── Body map ──────────────────────────────────────────────────
export type BodyMapMarkerType = 'primary' | 'superficial' | 'deep' | 'irradiated' | 'paresthesia' | 'numbness'

export interface BodyMapMarker {
  zone: string
  type: BodyMapMarkerType
  intensity: number
  x: number
  y: number
  view: 'front' | 'back' | 'lateral_right' | 'lateral_left'
}

// ── Scored test ───────────────────────────────────────────────
export interface ScoredTestQuestion {
  id: string
  text: string
  scale: 'likert_0_3' | 'likert_0_4' | 'yes_no' | 'numeric'
  alert?: boolean
  alert_message?: string
}

export interface ScoredTestRange {
  min: number
  max: number
  label: string
  color: 'green' | 'yellow' | 'orange' | 'red' | 'critical'
  action: string
}

export interface ScoredTest {
  id: UUID
  test_key: string
  name: string
  description?: string
  questions: ScoredTestQuestion[]
  score_ranges: ScoredTestRange[]
  max_score: number
  alert_threshold?: number
  reference?: string
}

// ── Form response ─────────────────────────────────────────────
export interface FormResponse {
  id: UUID
  template_id: UUID
  template_version: number
  encounter_id?: UUID
  session_form_id?: UUID
  patient_id: UUID
  professional_id: UUID
  answers: Record<string, unknown>
  computed_scores: Record<string, number>
  body_map_data: BodyMapMarker[]
  ai_analysis: Record<string, unknown>
  ai_approved_by?: UUID
  ai_approved_at?: ISOTimestamp
  status: 'draft' | 'in_progress' | 'completed'
  started_at: ISOTimestamp
  completed_at?: ISOTimestamp
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ── Lab upload ────────────────────────────────────────────────
export interface LabExtractedValue {
  name: string
  value: string | number
  unit: string
  reference_range?: string
  status: 'normal' | 'high' | 'low' | 'critical' | 'unknown'
}

export interface LabAlert {
  analyte: string
  message: string
  severity: 'info' | 'warning' | 'danger'
}

export interface LabUpload {
  id: UUID
  form_response_id: UUID
  patient_id: UUID
  professional_id: UUID
  file_url: string
  file_name: string
  file_size_bytes?: number
  file_type: 'pdf' | 'image' | 'other'
  lab_date?: string
  lab_name?: string
  ai_model_used?: string
  ai_extracted_values: LabExtractedValue[]
  ai_clinical_notes?: string
  ai_alerts: LabAlert[]
  ai_processed_at?: ISOTimestamp
  ai_processing_error?: string
  approved_by?: UUID
  approved_at?: ISOTimestamp
  created_at: ISOTimestamp
}

// ── Diagnóstico ───────────────────────────────────────────────
export type DiagnosisStatus   = 'presumptive' | 'confirmed' | 'ruled_out' | 'under_review'
export type DiagnosisSeverity = 'mild' | 'moderate' | 'severe' | 'critical'

export interface Diagnosis {
  id: UUID
  evaluation_id: UUID
  patient_id: UUID
  diagnosis_code?: string
  diagnosis_name: string
  status: DiagnosisStatus
  severity?: DiagnosisSeverity
  rationale: string
  prognosis?: string
  treatment_notes?: string
  follow_up_date?: string
  diagnosed_at: ISOTimestamp
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ── Tratamiento ───────────────────────────────────────────────
export type TreatmentPlanType   = 'exercise' | 'medication' | 'therapy' | 'diet' | 'combined' | 'other'
export type TreatmentPlanStatus = 'active' | 'on_hold' | 'completed' | 'stopped'

export interface TreatmentPlan {
  id: UUID
  diagnosis_id: UUID
  encounter_id: UUID
  patient_id: UUID
  professional_id: UUID
  plan_type: TreatmentPlanType
  goals: string
  instructions?: string
  total_sessions?: number
  frequency?: string
  duration_weeks?: number
  status: TreatmentPlanStatus
  started_at?: string
  ends_at?: string
  stopped_reason?: string
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ── Audit log ─────────────────────────────────────────────────
export interface AuditLog {
  id: UUID
  entity_type: string
  entity_id: UUID
  field_name: string
  old_value: string | null
  new_value: string | null
  changed_by: UUID
  changed_at: ISOTimestamp
  source_module: string
  reason?: string
}