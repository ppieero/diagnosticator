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
    const { patient, anamnesis, profile, evaluation, specialty, custom_prompt } = await req.json()

    let context: string

    if (custom_prompt && custom_prompt.trim()) {
      const vars: Record<string, string> = {
        sexo: patient?.biological_sex === "male" ? "Masculino" : "Femenino",
        edad: calcAge(patient?.birth_date),
        motivo_consulta: evaluation?.main_complaint ?? evaluation?.motivo ?? anamnesis?.main_complaint ?? "No especificado",
        dolor_eva: String(evaluation?.pain_scale ?? "No especificado"),
        tipo_dolor: Array.isArray(evaluation?.pain_type)
          ? (evaluation.pain_type as string[]).join(", ")
          : String(evaluation?.pain_type ?? "No especificado"),
        postural: JSON.stringify({
          anterior: evaluation?.postural_view_anterior,
          lateral: evaluation?.postural_view_lateral,
        }),
        palpacion: JSON.stringify(evaluation?.palpation ?? {}),
        articular: JSON.stringify(evaluation?.range_of_motion ?? {}),
        muscular: JSON.stringify(evaluation?.muscle_strength ?? {}),
        tests: JSON.stringify({
          realizados: evaluation?.tests_performed,
          resultados: evaluation?.tests_results,
        }),
        historial_clinico: JSON.stringify(anamnesis ?? {}),
        anamnesis: JSON.stringify(anamnesis ?? {}),
      }
      context = resolvePrompt(custom_prompt, vars)
    } else {
      context = `
PACIENTE:
- Sexo: ${patient?.biological_sex === "male" ? "Masculino" : patient?.biological_sex === "female" ? "Femenino" : "No especificado"}
- Fecha nacimiento: ${patient?.birth_date ?? "No especificada"}

ANAMNESIS (último registro):
- Motivo: ${anamnesis?.main_complaint ?? "No especificado"}
- Embarazo: ${anamnesis?.pregnancy_status ?? "No aplica"}
- Actividad: ${anamnesis?.activity_level ?? "No especificado"}
- Estrés: ${anamnesis?.stress_level !== undefined ? `${anamnesis.stress_level}/10` : "No especificado"}
- Energía: ${anamnesis?.energy_level !== undefined ? `${anamnesis.energy_level}/10` : "No especificado"}
- Sueño: ${anamnesis?.sleep_quality ?? "No especificado"} · ${anamnesis?.sleep_hours ?? "?"} horas
- Ánimo: ${anamnesis?.today_mood ?? "No especificado"}
- Antecedentes: ${Array.isArray(anamnesis?.personal_history_snapshot) ? (anamnesis.personal_history_snapshot as string[]).join(", ") : "Ninguno"}

EVALUACIÓN FISIOTERAPÉUTICA:
- Motivo consulta: ${evaluation?.main_complaint ?? evaluation?.motivo ?? "No especificado"}
- Dolor EVA: ${evaluation?.pain_scale ?? "No especificado"}
- Tipo dolor: ${Array.isArray(evaluation?.pain_type) ? (evaluation.pain_type as string[]).join(", ") : evaluation?.pain_type ?? "No especificado"}
- Patrón dolor: ${evaluation?.pain_pattern ?? "No especificado"}
- Factores agravan: ${evaluation?.pain_aggravating ?? "No especificado"}
- Factores alivian: ${evaluation?.pain_relieving ?? "No especificado"}
- Postura ant.: ${Array.isArray(evaluation?.postural_view_anterior) ? (evaluation.postural_view_anterior as string[]).join(", ") : "No especificado"}
- Postura lat.: ${Array.isArray(evaluation?.postural_view_lateral) ? (evaluation.postural_view_lateral as string[]).join(", ") : "No especificado"}
- Tests realizados: ${Array.isArray(evaluation?.tests_performed) ? (evaluation.tests_performed as string[]).join(", ") : "No especificado"}
- Resultados tests: ${evaluation?.tests_results ?? "No especificado"}
- Impresión clínica: ${evaluation?.clinical_impression ?? "No especificada"}
- Diagnóstico funcional: ${evaluation?.functional_diagnosis ?? "No especificado"}
- Pronóstico: ${evaluation?.prognosis ?? "No especificado"}

ESPECIALIDAD: ${specialty ?? "fisioterapia"}`.trim()
    }

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Eres un fisioterapeuta clínico experto. Basándote en la siguiente evaluación completa, genera un pre-diagnóstico y plan de tratamiento.

${context}

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta, sin texto adicional:
{
  "functional_diagnosis": "Diagnóstico funcional fisioterapéutico específico y preciso",
  "treatment_plan": ["Técnica o intervención 1", "Técnica 2", "Técnica 3"],
  "sessions_recommended": 10,
  "frequency": "2x semana",
  "alerts": ["alerta clínica si aplica, sino array vacío"]
}

Reglas:
- functional_diagnosis: diagnóstico funcional fisioterapéutico, no médico. Específico con la región y tipo de disfunción
- treatment_plan: 4-6 intervenciones ordenadas por importancia
- sessions_recommended: número entero realista (6-20)
- frequency: formato corto (ej: "2x semana", "3x semana", "1x semana")
- alerts: solo si hay señales de alarma reales
- Responder en español`
      }]
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const clean = text.replace(/```json|```/g, "").trim()
    return NextResponse.json(JSON.parse(clean))
  } catch (e) {
    console.error("AI prediag error:", e)
    return NextResponse.json({ error: "Error generando pre-diagnóstico" }, { status: 500 })
  }
}
