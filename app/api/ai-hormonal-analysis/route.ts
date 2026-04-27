import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { patient, anamnesis, evaluation_data } = await req.json()

    const context = `
PACIENTE:
- Sexo biológico: Femenino
- Fecha nacimiento: ${patient?.birth_date ?? "No especificada"}

ANAMNESIS HORMONAL:
- Motivo de consulta: ${anamnesis?.main_complaint ?? "No especificado"}
- Peso: ${anamnesis?.weight_kg ?? "?"} kg | Talla: ${anamnesis?.height_cm ?? "?"} cm
- Ciclo menstrual — regularidad: ${anamnesis?.cycle_regularity ?? "No especificada"} | duración: ${anamnesis?.cycle_duration ?? "No especificada"} | flujo: ${anamnesis?.menstrual_flow ?? "No especificado"}
- Última menstruación: ${anamnesis?.last_menstruation ?? "No especificada"}
- Estado menopáusico: ${anamnesis?.menopause_status ?? "No especificado"}${anamnesis?.menopause_age ? ` (edad: ${anamnesis.menopause_age})` : ""}
- Embarazo: ${anamnesis?.pregnancy_status ?? "No aplica"}
- Gestaciones: ${anamnesis?.gestations ?? 0} | Partos: ${anamnesis?.births ?? 0} | Cesáreas: ${anamnesis?.cesareans ?? 0} | Abortos: ${anamnesis?.abortions ?? 0}
- Anticonceptivos: ${Array.isArray(anamnesis?.contraceptives) ? (anamnesis.contraceptives as string[]).join(", ") : "No especificado"}

DATOS DE EVALUACIÓN:
${evaluation_data ? JSON.stringify(evaluation_data, null, 2) : "Sin datos de evaluación"}
`.trim()

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Eres una IA clínica especializada en medicina hormonal femenina (ginecología endocrina, menopausia, SOP, tiroides, suprarrenales). Analiza el siguiente contexto clínico completo de una paciente y genera un análisis hormonal estructurado.

${context}

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta, sin texto adicional ni markdown:
{
  "clinical_impression": "Párrafo con impresión clínica general del estado hormonal de la paciente",
  "suspected_patterns": [
    {"pattern": "Nombre del patrón/síndrome", "confidence": "alta|media|baja", "rationale": "Justificación clínica breve"}
  ],
  "priority_labs": [
    {"name": "Nombre del laboratorio", "reason": "Por qué pedirlo", "priority": "high|medium|low", "timing": "Cuándo tomarlo (ej: día 3 del ciclo)"}
  ],
  "treatment_approach": ["Línea de tratamiento o intervención 1", "Línea 2"],
  "lifestyle_recommendations": ["Recomendación de estilo de vida 1", "Recomendación 2"],
  "alerts": ["Alerta clínica si aplica — solo si hay señales reales"],
  "follow_up": "Sugerencia de seguimiento y control"
}

Reglas:
- suspected_patterns: máximo 4 patrones, ordenados por relevancia
- priority_labs: máximo 8 laboratorios, ordenados de mayor a menor prioridad
- treatment_approach: máximo 5 líneas cortas
- lifestyle_recommendations: máximo 4 recomendaciones
- alerts: solo incluir si hay señales reales de alarma
- Responder siempre en español
- Ser específico y clínicamente preciso, no genérico`
      }]
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json(parsed)
  } catch (e) {
    console.error("AI hormonal analysis error:", e)
    return NextResponse.json({ error: "Error generando análisis hormonal" }, { status: 500 })
  }
}
