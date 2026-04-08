# Diagnosticator — Contexto del proyecto v2

## Stack
- Next.js 16 App Router + TypeScript estricto (sin `any`)
- Tailwind CSS v4 + clsx + tailwind-merge
- Supabase (PostgreSQL + Auth + RLS + Storage)
- Zod + React Hook Form + @hookform/resolvers
- Estructura: app/ en raíz (sin src/)
- Fuentes: app/, components/, lib/, types/

## Flujo clínico — NUNCA romper
Paciente → Anamnesis → Consulta (encounter) → Evaluación → Diagnóstico → Tratamiento → Seguimiento
- Los diagnósticos SIEMPRE derivan de una consulta (evaluations)
- Los tratamientos SIEMPRE derivan de un diagnóstico
- La anamnesis es ÚNICA por paciente y compartida con todos los especialistas

## Schema de base de datos — 22 tablas

### Capa 1 — Identidad
- patients: datos del paciente
- anamnesis: historia clínica general (1:1 con patient, compartida)
- profiles: usuarios del sistema (extiende auth.users)
- specialties: catálogo de especialidades (fisioterapia, hormonal, nutrición, psicología)
- professionals: profesionales vinculados a especialidades (user_id → profiles)

### Capa 2 — Comercial
- services: servicios por especialidad (precio, duración, session_count)
- patient_service_packages: paquetes comprados (sessions_used, payment_mode: package|per_session)
- payments: transacciones (cash, card, transfer, pos, yape)
- Vista: packages_with_remaining (sessions_remaining calculado)

### Capa 3 — Agenda
- appointments: citas agendadas (patient + professional + service + package)
- professional_availability: disponibilidad semanal por profesional
- blocked_slots: bloqueos de agenda

### Capa 4 — Consulta clínica
- evaluations: la consulta clínica (tabla v1, extendida con encounter_type, soap_notes, specialty_id, professional_id, package_id)
- encounter_forms: formulario de evaluación inicial (template_id + answers JSONB)
- session_forms: formulario único de seguimiento por sesión (1:1 con evaluations)
- specialty_form_templates: plantillas configurables por especialidad (fields JSONB)
- form_responses: respuestas con scores, body_map_data, ai_analysis

### Capa 5 — Resultados clínicos
- diagnoses: vinculados a evaluations (evaluation_id obligatorio)
- treatment_plans: plan de tratamiento vinculado a diagnosis
- lab_uploads: PDFs de laboratorio + extracción IA (Claude Sonnet)

### Capa 6 — Motor de formularios
- specialty_form_templates: definición JSON de campos por especialidad
- scored_tests: tests validados PHQ-9, GAD-7 con scores automáticos
- form_template_versions: historial de versiones sin romper respuestas viejas

### Capa 7 — Auditoría
- audit_logs: historial de todos los cambios clínicos

## Tipos de campo del motor de formularios
text, textarea, number, decimal, date, select, multiselect, radio,
checkbox, switch, scale_0_10, vas_pain, body_map, measurement,
range_of_motion, table_grid, scored_test, repeating_group,
lab_upload, calculated, score_display, from_anamnesis, from_previous

## Roles del sistema
- admin: acceso total + configuración
- receptionist: agenda + pacientes + pagos
- professional: su agenda + sus consultas + formularios + diagnósticos

## Trigger automático
Al completar session_form.completed_at:
1. sessions_used +1 en patient_service_packages
2. Si payment_mode = per_session → crear payment pendiente
3. Marcar evaluations.status = completed
4. Registrar en audit_logs

## Flujo de análisis IA (laboratorios hormonales)
1. Profesional sube PDF → Supabase Storage
2. API Route Next.js → Claude Sonnet (Vision)
3. Extrae valores estructurados → lab_uploads.ai_extracted_values
4. Genera pre-análisis clínico → lab_uploads.ai_clinical_notes
5. Profesional revisa, edita y aprueba → approved_by/at
6. Todo queda en audit_logs

## Estructura de carpetas
app/(auth)/login/
app/(dashboard)/patients/
app/(dashboard)/patients/[id]/
app/(dashboard)/patients/[id]/evaluations/
app/(dashboard)/patients/[id]/diagnoses/
components/ui/          — Button, Input, Select, Card, Badge
components/forms/       — FormEngine, SectionRenderer, FieldRenderer
components/forms/fields/ — BodyMapField, ScoredTestField, LabUploadField, RepeatingGroupField
components/patients/    — NewPatientForm, PatientCard
lib/supabase/client.ts  — cliente browser
lib/supabase/server.ts  — cliente server
lib/validations/schemas.ts — esquemas Zod
lib/services/patients.ts   — CRUD pacientes
lib/services/evaluations.ts — CRUD consultas
lib/utils/index.ts      — cn(), formatDate(), calculateAge()
types/domain.ts         — todos los tipos clínicos
supabase/migrations/    — SQL de migraciones

## Reglas obligatorias
- Mobile-first, targets táctiles mínimo 44px
- Formularios por secciones con acordeón (una sección abierta a la vez)
- Todo campo clínico variable → audit_logs
- Soft delete en entidades clínicas, nunca hard delete
- Migraciones SQL completas cuando hay cambios de schema
- No usar `any` en TypeScript — tipos explícitos siempre
- Lógica clínica en lib/services, no en componentes
- Validación Zod en frontend Y backend
- Usar [System.IO.File]::WriteAllText() para crear archivos en PowerShell

## Formato de respuesta siempre
1. Entendimiento
2. Archivos a modificar/crear
3. Implementación completa (no pseudocódigo)
4. SQL si hay cambios de schema
5. Validación y pruebas
6. Riesgos

## Variables de entorno requeridas
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
## Módulos implementados (estado abril 2026)
✓ Auth + Login
✓ Dashboard — métricas del día
✓ Pacientes — CRUD completo
✓ Agenda — lista + grilla + iniciar consulta
✓ Flujo clínico — anamnesis (pantalla 1) + tipo sesión (pantalla 2) + formulario + completar
✓ Motor formularios dinámico — scale_0_10, body_map, range_of_motion, multiselect, radio
✓ Evaluaciones — lista templates + detalle
✓ Servicios + Paquetes + Productos
✓ Pagos — lista + nuevo + recibo PDF
✓ Ajustes — moneda dinámica, idioma, IVA

## Pendiente — Historia clínica rediseñada
- Ficha paciente: tabs Todo/Evaluaciones/Diagnósticos/Tratamientos/Paquetes
- Solo lectura en ficha — creación ocurre en /consulta/[eid]
- Evaluación → genera diagnóstico → genera tratamiento (flujo unidireccional)
- lib/services/diagnoses.ts — CRUD diagnoses + treatment_plans
- Diagnóstico: evaluation_id (FK), diagnosis_code CIE-10, severity, rationale
- Tratamiento: diagnosis_id (FK), encounter_id (FK), plan_type, goals, total_sessions

## Constraints BD críticos
- diagnoses.status: presumptive | confirmed | ruled_out | under_review
- diagnoses.severity: mild | moderate | severe | critical
- treatment_plans.plan_type: exercise | medication | therapy | diet | combined | other
- treatment_plans.status: active | on_hold | completed | stopped
- encounter_forms.form_type: initial | evaluation | followup
- evaluations requiere evaluation_type_id y performed_by (NOT NULL)

## Moneda dinámica
- hook: hooks/useCurrency.ts → { symbol, price(amount, decimals?) }
- settings cache: lib/services/settings.ts → clearSettingsCache() al guardar

## Notas VPS
- Runtime: Node.js + PM2
- Build: npm run build && pm2 restart diagnosticator


## Refactor v2 — abril 2026
### Sistema unificado (eliminar referencias v1)
- ELIMINADO: app/(dashboard)/consulta/ — ruta v1 rota
- ELIMINADO: lib/services/encounters.ts — usaba encounter_forms (no existe)
- ELIMINADO: components/form-engine/ — reemplazado por components/forms/
- ACTIVO: lib/services/evaluations.ts — sistema v2 nativo
- ACTIVO: components/forms/FormEngine.tsx — con SectionRenderer, FieldRenderer

### Flujo clínico correcto (post-refactor)
1. Agenda → tap cita → "Iniciar consulta"
2. handleIniciarConsulta() → initConsulta(appointmentId)
3. initConsulta() → createEvaluation() → update appointment_id + session_number
4. Navega a /patients/[patientId]/evaluations/[eid]
5. FormEngine v2 carga template por specialty_id + encounter_type
6. Guarda en form_responses (NO encounter_forms)
7. completeEvaluation() → status=completed

### Cadena de relaciones real (verificada en BD)
appointments.id
  └─→ evaluations.appointment_id (sin FK constraint, campo uuid)
        └─→ form_responses.encounter_id (FK → evaluations.id)
        └─→ diagnoses.evaluation_id (FK → evaluations.id)
              └─→ treatment_plans.diagnosis_id (FK → diagnoses.id)
              └─→ treatment_plans.encounter_id (FK → evaluations.id)

### Tabla form_responses (NO encounter_forms)
- template_id → specialty_form_templates
- encounter_id → evaluations
- answers: jsonb
- computed_scores: jsonb
- body_map_data: jsonb array
- status: draft | in_progress | completed

### Tabla anamnesis (singular, NO anamneses)
Campos: height_cm, weight_kg, pregnancy_status, smoking_status,
        alcohol_status, main_complaint, current_symptoms (array),
        active_medications (jsonb), known_allergies (jsonb),
        personal_history (jsonb), family_history (jsonb)

### Pendiente
- Módulo Expediente Clínico (/expediente)
  - /expediente → búsqueda pacientes con filtros
  - /expediente/[patient_id] → tabs: Resumen/Anamnesis/Timeline/Diagnósticos/Tratamientos
  - /expediente/[patient_id]/evaluacion/[eid] → detalle con FormEngine readonly
    + diagnóstico derivado + plan de tratamiento
- Diagnóstico y tratamiento se crean dentro del flujo de evaluación
  (/patients/[id]/evaluations/[eid] al completar)
