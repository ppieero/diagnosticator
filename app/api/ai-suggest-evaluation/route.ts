import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { patient, anamnesis, evaluation_type, specialty } = await req.json()

    const context = `
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
ESPECIALIDAD: ${specialty ?? "fisioterapia"}
`.trim()

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Eres un asistente clínico especializado en fisioterapia. Basándote en el siguiente contexto clínico, sugiere qué evaluaciones y tests se deben realizar en esta consulta.

${context}

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta, sin texto adicional:
{
  "impression": "Párrafo corto con impresión clínica y hipótesis diagnóstica basada en los datos",
  "priority_tests": [
    {"name": "Nombre del test", "reason": "Por qué realizarlo", "priority": "high|medium|low"}
  ],
  "treatment_focus": ["técnica o enfoque 1", "técnica 2"],
  "alerts": ["alerta clínica si aplica"]
}

Reglas:
- priority_tests: máximo 6 tests, ordenados de mayor a menor prioridad
- treatment_focus: máximo 6 chips cortos
- alerts: solo incluir si hay señales de alerta reales (dolor severo, contraindicaciones, derivación urgente)
- Si hay poco contexto clínico, basar sugerencias en la especialidad y tipo de evaluación
- Responder en español`
      }]
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json(parsed)
  } catch (e) {
    console.error("AI suggest error:", e)
    return NextResponse.json({ error: "Error generando sugerencia" }, { status: 500 })
  }
}
