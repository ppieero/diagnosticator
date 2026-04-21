import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface TemplateOption {
  id: string
  name: string
  form_type: string
  description?: string
}

interface AiSuggestRequest {
  motivo: string
  eva: number
  specialty_id: string
  specialty_name: string
  patient_id: string
  available_templates: TemplateOption[]
}

interface AiSuggestResponse {
  suggested_template_id: string
  reasoning: string
  confidence: number
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body: AiSuggestRequest = await request.json()
    const { motivo, eva, specialty_name, available_templates } = body

    if (!motivo?.trim() || available_templates.length === 0) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 })
    }

    const painLevel =
      eva <= 3 ? "leve" : eva <= 6 ? "moderado" : "severo/intenso"

    const templateList = available_templates
      .map(
        (t, i) =>
          `${i + 1}. ID: "${t.id}" | Nombre: "${t.name}" | Tipo: ${t.form_type}${t.description ? ` | Descripción: ${t.description}` : ""}`
      )
      .join("\n")

    const prompt = `Eres un asistente clínico experto en ${specialty_name}. Tu rol es ayudar al profesional a elegir el formulario de evaluación más apropiado para la consulta.

DATOS DE LA CONSULTA:
- Motivo de consulta: ${motivo}
- Escala EVA de dolor: ${eva}/10 (${painLevel})

FORMULARIOS DISPONIBLES:
${templateList}

INSTRUCCIONES:
Analiza el motivo de consulta y el nivel de dolor EVA. Selecciona el formulario más apropiado para evaluar correctamente a este paciente según su presentación clínica.

Responde ÚNICAMENTE en JSON con esta estructura exacta (sin texto adicional):
{
  "suggested_template_id": "id_del_formulario_seleccionado",
  "reasoning": "Explicación clínica de 2-3 oraciones sobre por qué este formulario es el más adecuado para el motivo y nivel de dolor indicado.",
  "confidence": 0.85
}

Si ningún formulario es específicamente adecuado, sugiere el más genérico disponible y explícalo.`

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    const rawResponse =
      message.content[0].type === "text" ? message.content[0].text : ""

    let result: AiSuggestResponse = {
      suggested_template_id: available_templates[0].id,
      reasoning: "Formulario seleccionado por defecto.",
      confidence: 0.5,
    }

    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AiSuggestResponse
        result = parsed
      }
    } catch {
      // Keep default on parse error
    }

    // Validate suggested_template_id is in available_templates
    const isValid = available_templates.some(
      (t) => t.id === result.suggested_template_id
    )
    if (!isValid) {
      result.suggested_template_id = available_templates[0].id
      result.reasoning =
        "No se pudo identificar un formulario específico. Se sugiere el primero disponible."
      result.confidence = 0.4
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("AI suggest evaluation error:", err)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
