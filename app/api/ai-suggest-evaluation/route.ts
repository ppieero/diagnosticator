import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

function resolvePrompt(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `[${key}]`)
}

function calcAge(birthDate: string): string {
  if (!birthDate) return "desconocida"
  const diff = Date.now() - new Date(birthDate).getTime()
  return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)))
}

export async function POST(req: NextRequest) {
  try {
    const { patient, anamnesis, form_data, evaluation_type, specialty, custom_prompt } = await req.json()

    let context: string

    if (custom_prompt && custom_prompt.trim()) {
      const vars: Record<string, string> = {
        sexo: patient?.biological_sex === "male" ? "Masculino" : "Femenino",
        edad: calcAge(patient?.birth_date),
        motivo_consulta: form_data?.main_complaint ?? anamnesis?.main_complaint ?? "No especificado",
        dolor_eva: String(form_data?.pain_scale ?? "No especificado"),
        tipo_dolor: Array.isArray(form_data?.pain_type)
          ? (form_data.pain_type as string[]).join(", ")
          : String(form_data?.pain_type ?? "No especificado"),
        patron_dolor: String(form_data?.pain_pattern ?? "No especificado"),
        dolor_agrava: String(form_data?.pain_aggravating ?? "No especificado"),
        dolor_alivia: String(form_data?.pain_relieving ?? "No especificado"),
        historial_clinico: JSON.stringify(anamnesis ?? {}),
        anamnesis: JSON.stringify(anamnesis ?? {}),
      }
      context = resolvePrompt(custom_prompt, vars)
    } else {
      context = `
PACIENTE:
- Sexo biológico: ${patient?.biological_sex === "male" ? "Masculino" : patient?.biological_sex === "female" ? "Femenino" : "No especificado"}
- Fecha nacimiento: ${patient?.birth_date ?? "No especificada"}

ANAMNESIS (último registro):
- Motivo de consulta: ${anamnesis?.main_complaint ?? "No especificado"}
- Embarazo: ${anamnesis?.pregnancy_status ?? "No aplica"}
- Nivel de actividad: ${anamnesis?.activity_level ?? "No especificado"}
- Nivel de estrés: ${anamnesis?.stress_level !== undefined ? `${anamnesis.stress_level}/10` : "No especificado"}
- Nivel de energía: ${anamnesis?.energy_level !== undefined ? `${anamnesis.energy_level}/10` : "No especificado"}
- Calidad de sueño: ${anamnesis?.sleep_quality ?? "No especificado"} · ${anamnesis?.sleep_hours ?? "?"} horas
- Dieta: ${anamnesis?.diet_type ?? "No especificada"}
- Ánimo: ${anamnesis?.today_mood ?? "No especificado"}
- Otros antecedentes: ${anamnesis?.other_history ?? "Ninguno"}
- Antecedentes personales: ${Array.isArray(anamnesis?.personal_history_snapshot) ? (anamnesis.personal_history_snapshot as string[]).join(", ") : "Ninguno"}

TIPO DE EVALUACIÓN: ${evaluation_type ?? "inicial"}
ESPECIALIDAD: ${specialty ?? "fisioterapia"}`.trim()
    }

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Eres un asistente clínico especializado en fisioterapia. Basándote en el siguiente contexto clínico, sugiere qué evaluaciones y tests realizar.

${context}

Responde ÚNICAMENTE con JSON válido sin texto adicional:
{
  "impression": "Impresión clínica breve",
  "priority_tests": [{"name": "Test", "reason": "Razón", "priority": "high|medium|low"}],
  "treatment_focus": ["enfoque 1", "enfoque 2"],
  "alerts": ["alerta si aplica"]
}

Reglas:
- priority_tests: máximo 6 tests, ordenados de mayor a menor prioridad
- treatment_focus: máximo 6 chips cortos
- alerts: solo incluir si hay señales de alerta reales
- Responder en español`
      }]
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    return NextResponse.json(JSON.parse(text.replace(/```json|```/g, "").trim()))
  } catch (e) {
    console.error("AI suggest error:", e)
    return NextResponse.json({ error: "Error generando sugerencia" }, { status: 500 })
  }
}
