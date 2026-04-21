import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      patient,
      anamnesis,
      evaluation,
      formResponses,
      specialty,
    } = body

    const edad = patient?.birth_date
      ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000)
      : null

    const imc = anamnesis?.height_cm && anamnesis?.weight_kg
      ? (anamnesis.weight_kg / Math.pow(anamnesis.height_cm / 100, 2)).toFixed(1)
      : null

    const alergias = (anamnesis?.known_allergies ?? [])
      .map((a: { substance: string; severity: string; reaction?: string }) =>
        `${a.substance} (${a.severity}${a.reaction ? `, reacción: ${a.reaction}` : ""})`)
      .join(", ") || "Ninguna referida"

    const medicacion = (anamnesis?.active_medications ?? [])
      .map((m: { name: string; dose?: string; frequency?: string }) =>
        `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`)
      .join(", ") || "Ninguna"

    const antecedentes = (anamnesis?.personal_history ?? [])
      .map((h: { condition: string; status: string; diagnosed_year?: number }) =>
        `${h.condition} (${h.status}${h.diagnosed_year ? `, desde ${h.diagnosed_year}` : ""})`)
      .join(", ") || "Sin antecedentes relevantes"

    const antFamiliares = (anamnesis?.family_history ?? [])
      .map((f: { condition: string; relationship: string }) =>
        `${f.condition} (${f.relationship})`)
      .join(", ") || "Sin antecedentes familiares relevantes"

    const sintomasActuales = (anamnesis?.current_symptoms ?? []).join(", ") || "No referidos"

    const hallazgos = (formResponses ?? []).map((fr: {
      template_name?: string
      answers: Record<string, unknown>
      computed_scores?: Record<string, number>
    }) => {
      const scores = fr.computed_scores
        ? Object.entries(fr.computed_scores)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : ""
      const answersText = Object.entries(fr.answers ?? {})
        .filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
        .slice(0, 30)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}: ${v.join(", ")}`
          if (typeof v === "object") return `${k}: ${JSON.stringify(v)}`
          return `${k}: ${v}`
        })
        .join("\n")
      return `--- ${fr.template_name ?? "Formulario"} ---\n${answersText}${scores ? `\nScores: ${scores}` : ""}`
    }).join("\n\n")

    const prompt = `Eres un asistente clínico especializado en ${specialty ?? "medicina"}, con formación en medicina basada en evidencia. Tu función es analizar datos clínicos de un paciente y proporcionar un prediagnóstico diferencial fundamentado científicamente, con sugerencias clínicas útiles para el profesional de salud.

IMPORTANTE: Este análisis es un APOYO AL PROFESIONAL, no reemplaza el juicio clínico. Debe estar basado en evidencia científica actual.

═══════════════════════════════════════════
DATOS DEL PACIENTE
═══════════════════════════════════════════
Edad: ${edad ? `${edad} años` : "No especificada"}
Sexo biológico: ${patient?.biological_sex === "male" ? "Masculino" : patient?.biological_sex === "female" ? "Femenino" : "No especificado"}
${imc ? `Talla/Peso/IMC: ${anamnesis.height_cm}cm / ${anamnesis.weight_kg}kg / IMC ${imc}` : ""}
${anamnesis?.pregnancy_status && anamnesis.pregnancy_status !== "not_applicable" ? `Estado de embarazo: ${anamnesis.pregnancy_status}` : ""}

═══════════════════════════════════════════
ANAMNESIS
═══════════════════════════════════════════
Motivo de consulta: ${anamnesis?.main_complaint ?? evaluation?.notes ?? "No especificado"}
Síntomas actuales: ${sintomasActuales}
Tabaquismo: ${anamnesis?.smoking_status ?? "No especificado"}
Alcohol: ${anamnesis?.alcohol_status ?? "No especificado"}

Alergias: ${alergias}
Medicación actual: ${medicacion}
Antecedentes personales: ${antecedentes}
Antecedentes familiares: ${antFamiliares}

═══════════════════════════════════════════
HALLAZGOS DE LA EVALUACIÓN — ${specialty ?? ""}
═══════════════════════════════════════════
${hallazgos || "Sin datos de formularios disponibles"}

═══════════════════════════════════════════
INSTRUCCIONES
═══════════════════════════════════════════
Analiza todos los datos anteriores y proporciona:

1. DIAGNÓSTICO DIFERENCIAL (máximo 3 opciones, ordenadas por probabilidad)
   Para cada uno incluye:
   - Nombre completo y código CIE-10
   - Probabilidad estimada (Alta/Media/Baja)
   - Hallazgos que lo sustentan
   - Hallazgos que lo contraindican
   - Referencia bibliográfica o guía clínica que lo respalda

2. DIAGNÓSTICO MÁS PROBABLE
   - Nombre y código CIE-10
   - Nivel de severidad sugerido (leve/moderado/severo/crítico)
   - Justificación clínica basada en los hallazgos

3. ESTUDIOS COMPLEMENTARIOS SUGERIDOS
   - Lista de exámenes o pruebas que confirmarían o descartarían el diagnóstico
   - Prioridad de cada uno (urgente/electivo)

4. ALERTAS CLÍNICAS
   - Signos de alarma identificados que requieren atención inmediata
   - Interacciones farmacológicas relevantes con medicación actual
   - Contraindicaciones importantes para el tratamiento

5. SUGERENCIAS DE TRATAMIENTO
   - Enfoque terapéutico recomendado basado en guías clínicas
   - Técnicas específicas para ${specialty ?? "esta especialidad"}
   - Objetivos medibles a corto (2 semanas) y mediano plazo (6-8 semanas)

6. PRONÓSTICO
   - Expectativa de evolución con tratamiento adecuado
   - Factores pronósticos favorables y desfavorables identificados

Responde en español, de forma estructurada con los títulos numerados. Usa terminología clínica precisa pero también lenguaje comprensible. Basa cada afirmación en evidencia científica actual (menciona cuando aplique guías como GPC, Cochrane, UpToDate, etc.).`

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    })

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")

    return NextResponse.json({ prediagnostico: text })
  } catch (err) {
    console.error("ai-prediagnostico error:", err)
    return NextResponse.json({ error: "Error al generar el prediagnóstico" }, { status: 500 })
  }
}
