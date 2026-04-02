# Diagnosticator — Contexto del proyecto

## Stack
- Next.js 15 App Router + TypeScript estricto (sin `any`)
- Tailwind CSS + Radix UI
- Supabase (PostgreSQL + Auth + RLS)
- Zod + React Hook Form
- Estructura: app/ en raíz (sin src/)

## Flujo clínico — NUNCA romper
Paciente → Anamnesis → Evaluación → Resultados → Diagnóstico → Seguimiento
Los diagnósticos SIEMPRE derivan de una evaluación. Nunca son punto de partida.

## Estructura de carpetas
app/(auth)/login/          — login
app/(dashboard)/patients/  — módulo pacientes
app/(dashboard)/patients/[id]/evaluations/ — evaluaciones
app/(dashboard)/patients/[id]/diagnoses/   — diagnósticos
components/ui/             — Button, Input, Select, Card, Badge
components/forms/          — formularios clínicos reutilizables
lib/supabase/client.ts     — cliente browser
lib/supabase/server.ts     — cliente server
lib/validations/schemas.ts — esquemas Zod
lib/services/              — lógica de negocio
lib/utils/index.ts         — cn(), formatDate(), calculateAge()
types/domain.ts            — todos los tipos clínicos
supabase/migrations/       — migraciones SQL
middleware.ts              — auth guard

## Reglas obligatorias
- Mobile-first, targets táctiles mínimo 44px
- Formularios por secciones con acordeón
- Todo campo clínico variable → audit_logs
- Soft delete, nunca hard delete en entidades clínicas
- Migraciones SQL completas cuando hay cambios de schema
- Componentes reutilizables, sin duplicación

## Formato de respuesta siempre
1. Entendimiento
2. Archivos a modificar/crear
3. Implementación completa (no pseudocódigo)
4. Migraciones SQL si aplica
5. Validación y pruebas
6. Riesgos

## Variables de entorno requeridas
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
