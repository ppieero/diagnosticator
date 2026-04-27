import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { patient, anamnesis, evaluation, historialClinico } = await req.json()

    const context = `
PACIENTE:
- Sexo: ${patient?.biological_sex === "female" ? "Femenino" : "No especificado"}
- Fecha nacimiento: ${patient?.birth_date ?? "No especificada"}

ANAMNESIS DE CONSULTA:
- Peso: ${anamnesis?.weight_kg ?? "ND"} kg | Talla: ${anamnesis?.height_cm ?? "ND"} cm
- Circunferencia abdominal: ${anamnesis?.waist_cm ?? "ND"} cm
- Etapa menopáusica: ${anamnesis?.etapa_menopausica ?? "ND"}
- Última menstruación: ${anamnesis?.ultima_menstruacion ?? "ND"}
- Regularidad ciclo: ${anamnesis?.regularidad_ciclo ?? "ND"}
- Amenorrea: ${anamnesis?.amenorrea ?? "ND"}
- Gestaciones: ${anamnesis?.gestaciones ?? "ND"} | Partos: ${anamnesis?.partos ?? "ND"}
- Anticonceptivos: ${JSON.stringify(anamnesis?.anticonceptivos ?? [])}

HISTORIAL CLÍNICO:
- Alergias: ${JSON.stringify(historialClinico?.known_allergies ?? [])}
- Medicación habitual: ${JSON.stringify(historialClinico?.active_medications ?? [])}
- Antecedentes: ${JSON.stringify(historialClinico?.personal_history ?? [])}

EVALUACIÓN CLÍNICA:
- Síntomas vasomotores: ${JSON.stringify({
  bochornos: evaluation?.bochornos,
  sudores_nocturnos: evaluation?.sudores_nocturnos,
  palpitaciones: evaluation?.palpitaciones
})}
- Síntomas neurocognitivos: ${JSON.stringify({
  niebla_mental: evaluation?.niebla_mental,
  ansiedad: evaluation?.ansiedad,
  irritabilidad: evaluation?.irritabilidad,
  bajo_animo: evaluation?.bajo_animo,
  insomnio: evaluation?.insomnio
})}
- Síntomas metabólicos: ${JSON.stringify({
  grasa_abdominal: evaluation?.grasa_abdominal,
  dificultad_perder_peso: evaluation?.dificultad_perder_peso,
  caida_cabello: evaluation?.caida_cabello
})}
- Screening riesgos: cancer_mama=${evaluation?.riesgo_cancer_mama}, trombosis=${evaluation?.riesgo_trombosis}, cardiovascular=${evaluation?.riesgo_cardiovascular}, miomas=${evaluation?.riesgo_miomas}
- Laboratorios: estradiol=${evaluation?.estradiol_valor ?? "ND"}, progesterona=${evaluation?.progesterona_valor ?? "ND"}, tsh=${evaluation?.tsh_valor ?? "ND"}, vitamina_d=${evaluation?.vitamina_d_valor ?? "ND"}
- Estilo de vida: patron=${evaluation?.patron_alimentario}, ejercicio=${evaluation?.ejercicio_tipo}, estres=${evaluation?.nivel_estres}/10, sueno=${evaluation?.horas_sueno}h calidad=${evaluation?.calidad_sueno}/10
`.trim()

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Eres un médico especialista en medicina hormonal femenina y menopausia. Analiza la siguiente información clínica completa y genera un análisis estructurado.

${context}

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta, sin texto adicional, sin markdown:
{
  "impresion_clinica": "párrafo con impresión clínica detallada en español",
  "etapa_sugerida": "premenopausia|perimenopausia_temprana|perimenopausia_tardia|menopausia|postmenopausia",
  "sintomas_predominantes": ["síntoma1", "síntoma2"],
  "riesgos_identificados": ["riesgo1", "riesgo2"],
  "alertas_contraindicaciones": ["alerta si hay contraindicaciones detectadas — vacío si no hay"],
  "lineas_tratamiento": ["línea 1", "línea 2", "línea 3"],
  "examenes_sugeridos": ["examen si faltan laboratorios importantes — vacío si tiene todo"],
  "seguimiento_recomendado": "recomendación de seguimiento en texto corto"
}`
      }]
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e) {
    console.error("AI hormonal error:", e)
    return NextResponse.json({ error: "Error generando análisis" }, { status: 500 })
  }
}
