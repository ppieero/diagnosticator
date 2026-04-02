export type UUID = string
export type ISOTimestamp = string
export type UserRole = 'admin' | 'health_professional' | 'assistant'
export type DocumentType = 'dni' | 'passport' | 'nie' | 'other'
export type BiologicalSex = 'male' | 'female' | 'other'
export type PregnancyStatus = 'not_applicable' | 'no' | 'yes' | 'unknown'
export type SmokingStatus = 'never' | 'former' | 'current' | 'unknown'
export type AlcoholStatus = 'none' | 'occasional' | 'moderate' | 'heavy' | 'unknown'
export type EvaluationStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled'
export type DiagnosisStatus = 'presumptive' | 'confirmed' | 'ruled_out' | 'under_review'
export type DiagnosisSeverity = 'mild' | 'moderate' | 'severe' | 'critical'
export type AuditEntityType = 'patient' | 'anamnesis' | 'evaluation' | 'diagnosis'

export interface Patient {
  id: UUID; full_name: string; birth_date: string
  document_type: DocumentType; document_number: string
  biological_sex: BiologicalSex; phone?: string; email?: string
  address?: string; notes?: string; is_active: boolean
  created_at: ISOTimestamp; updated_at: ISOTimestamp
  created_by: UUID; updated_by: UUID
}
export interface Medication { name: string; dose?: string; frequency?: string; since?: string; notes?: string }
export interface Allergy { substance: string; reaction?: string; severity: 'mild'|'moderate'|'severe'|'unknown' }
export interface ClinicalHistory { condition: string; diagnosed_year?: number; status: 'active'|'resolved'|'chronic'; notes?: string }
export interface Anamnesis {
  id: UUID; patient_id: UUID; height_cm?: number; weight_kg?: number
  pregnancy_status: PregnancyStatus; smoking_status: SmokingStatus; alcohol_status: AlcoholStatus
  main_complaint?: string; current_symptoms: string[]
  active_medications: Medication[]; known_allergies: Allergy[]
  personal_history: ClinicalHistory[]; family_history: Array<{condition:string;relationship:string;notes?:string}>
  created_at: ISOTimestamp; updated_at: ISOTimestamp; created_by: UUID; updated_by: UUID
}
export interface Evaluation {
  id: UUID; patient_id: UUID; evaluation_type_id: string; status: EvaluationStatus
  started_at: ISOTimestamp; completed_at?: ISOTimestamp; performed_by: UUID
  notes?: string; created_at: ISOTimestamp; updated_at: ISOTimestamp
}
export interface Diagnosis {
  id: UUID; patient_id: UUID; evaluation_id: UUID
  diagnosis_code?: string; diagnosis_name: string; status: DiagnosisStatus
  severity?: DiagnosisSeverity; rationale: string; treatment_notes?: string
  follow_up_date?: string; diagnosed_by: UUID; diagnosed_at: ISOTimestamp
  created_at: ISOTimestamp; updated_at: ISOTimestamp
}
export interface AuditLog {
  id: UUID; entity_type: AuditEntityType; entity_id: UUID; field_name: string
  old_value: string|null; new_value: string|null; changed_by: UUID
  changed_at: ISOTimestamp; source_module: string; reason?: string
}
