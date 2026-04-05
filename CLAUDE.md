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