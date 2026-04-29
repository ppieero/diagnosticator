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
    const { patient, anamnesis, evaluation, evaluation_data, historialClinico, custom_prompt } = await req.json()

    const evalData = evaluation ?? evaluation_data ?? {}

    let context: string

    if (custom_prompt && custom_prompt.trim()) {
      const vars: Record<string, string> = {
        sexo: patient?.biological_sex === "female" ? "Femenino" : "No especificado",
        edad: calcAge(patient?.birth_date),
        etapa_menopausica: String(anamnesis?.etapa_menopausica ?? "ND"),
        ultima_menstruacion: String(anamnesis?.ultima_menstruacion ?? "ND"),
        regularidad_ciclo: String(anamnesis?.regularidad_ciclo ?? "ND"),
        historia_ginecologica: JSON.stringify({
          gestaciones: anamnesis?.gestaciones,
          partos: anamnesis?.partos,
          cesareas: anamnesis?.cesareas,
          anticonceptivos: anamnesis?.anticonceptivos,
        }),
        vasomotores: JSON.stringify({
          bochornos: evalData?.bochornos,
          sudores_nocturnos: evalData?.sudores_nocturnos,
          palpitaciones: evalData?.palpitaciones,
        }),
        neurocognitivos: JSON.stringify({
          niebla_mental: evalData?.niebla_mental,
          ansiedad: evalData?.ansiedad,
          irritabilidad: evalData?.irritabilidad,
          bajo_animo: evalData?.bajo_animo,
          insomnio: evalData?.insomnio,
        }),
        hormonales_sexualidad: JSON.stringify({
          libido: evalData?.libido,
          dispareunia: evalData?.dispareunia,
          sequedad_vaginal: evalData?.sequedad_vaginal,
        }),
        metabolicos: JSON.stringify({
          grasa_abdominal: evalData?.grasa_abdominal,
          dificultad_perder_peso: evalData?.dificultad_perder_peso,
          caida_cabello: evalData?.caida_cabello,
        }),
        genitourinario: JSON.stringify({
          incontinencia: evalData?.incontinencia,
          urgencia_miccional: evalData?.urgencia_miccional,
          infecciones_urinarias: evalData?.infecciones_urinarias,
        }),
        screening_riesgos: JSON.stringify({
          cancer_mama: evalData?.riesgo_cancer_mama,
          trombosis: evalData?.riesgo_trombosis,
          cardiovascular: evalData?.riesgo_cardiovascular,
          miomas: evalData?.riesgo_miomas,
        }),
        antecedentes_medicos: JSON.stringify(historialClinico?.personal_history ?? anamnesis?.personal_history ?? []),
        medicacion: JSON.stringify(historialClinico?.active_medications ?? anamnesis?.active_medications ?? []),
        estilo_vida: JSON.stringify({
          patron_alimentario: evalData?.patron_alimentario,
          ejercicio_tipo: evalData?.ejercicio_tipo,
          nivel_estres: evalData?.nivel_estres,
          horas_sueno: evalData?.horas_sueno,
          calidad_sueno: evalData?.calidad_sueno,
        }),
        laboratorios: JSON.stringify({
          estradiol: evalData?.estradiol_valor,
          progesterona: evalData?.progesterona_valor,
          tsh: evalData?.tsh_valor,
          vitamina_d: evalData?.vitamina_d_valor,
        }),
        historial_clinico: JSON.stringify(historialClinico ?? {}),
      }
      context = resolvePrompt(custom_prompt, vars)
    } else {
      context = `
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
  bochornos: evalData?.bochornos,
  sudores_nocturnos: evalData?.sudores_nocturnos,
  palpitaciones: evalData?.palpitaciones
})}
- Síntomas neurocognitivos: ${JSON.stringify({
  niebla_mental: evalData?.niebla_mental,
  ansiedad: evalData?.ansiedad,
  irritabilidad: evalData?.irritabilidad,
  bajo_animo: evalData?.bajo_animo,
  insomnio: evalData?.insomnio
})}
- Síntomas metabólicos: ${JSON.stringify({
  grasa_abdominal: evalData?.grasa_abdominal,
  dificultad_perder_peso: evalData?.dificultad_perder_peso,
  caida_cabello: evalData?.caida_cabello
})}
- Screening riesgos: cancer_mama=${evalData?.riesgo_cancer_mama}, trombosis=${evalData?.riesgo_trombosis}, cardiovascular=${evalData?.riesgo_cardiovascular}, miomas=${evalData?.riesgo_miomas}
- Laboratorios: estradiol=${evalData?.estradiol_valor ?? "ND"}, progesterona=${evalData?.progesterona_valor ?? "ND"}, tsh=${evalData?.tsh_valor ?? "ND"}, vitamina_d=${evalData?.vitamina_d_valor ?? "ND"}
- Estilo de vida: patron=${evalData?.patron_alimentario}, ejercicio=${evalData?.ejercicio_tipo}, estres=${evalData?.nivel_estres}/10, sueno=${evalData?.horas_sueno}h calidad=${evalData?.calidad_sueno}/10`.trim()
    }

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
    return NextResponse.json(JSON.parse(clean))
  } catch (e) {
    console.error("AI hormonal error:", e)
    return NextResponse.json({ error: "Error generando análisis" }, { status: 500 })
  }
}
