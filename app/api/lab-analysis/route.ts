import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const HORMONAL_ANALYSIS_PROMPT = `Eres un asistente clínico especializado en medicina hormonal.
Se te proporciona una imagen o PDF de un laboratorio hormonal.

Tu tarea es:
1. EXTRAER todos los valores de laboratorio que encuentres
2. IDENTIFICAR cuáles están fuera del rango de referencia
3. GENERAR un pre-análisis clínico con los hallazgos más relevantes

Responde ÚNICAMENTE en JSON con esta estructura exacta:
{
  "extracted_values": [
    {
      "name": "nombre del analito",
      "value": valor_numerico_o_texto,
      "unit": "unidad",
      "reference_min": numero_o_null,
      "reference_max": numero_o_null,
      "status": "normal|high|low|critical|unknown"
    }
  ],
  "alerts": [
    {
      "analyte": "nombre",
      "message": "descripción del hallazgo relevante",
      "severity": "info|warning|danger"
    }
  ],
  "clinical_notes": "Pre-análisis clínico: hallazgos relevantes, patrones hormonales, correlaciones, preguntas sugeridas al especialista. Máximo 300 palabras. Aclarar siempre que es un pre-análisis IA sujeto a revisión clínica.",
  "lab_date": "YYYY-MM-DD o null",
  "lab_name": "nombre del laboratorio o null"
}`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const formResponseId = formData.get("form_response_id") as string
    const patientId = formData.get("patient_id") as string

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Archivo demasiado grande (máx 10MB)" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const isPdf = file.type === "application/pdf"
    const mediaType = isPdf
      ? "application/pdf"
      : (file.type as "image/jpeg" | "image/png" | "image/webp")

    // Subir a Supabase Storage — bucket privado
    // Ruta: lab-uploads/{user_id}/{timestamp}-{filename}
    const filePath = `lab-uploads/${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from("clinical-files")
      .upload(filePath, bytes, { contentType: file.type })

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 })
    }

    // URL firmada con expiración de 1 hora — nunca pública
    const { data: signedData, error: signedError } = await supabase.storage
      .from("clinical-files")
      .createSignedUrl(filePath, 3600)

    if (signedError || !signedData) {
      return NextResponse.json({ error: "Error generando URL segura" }, { status: 500 })
    }

    // Llamar a Claude Vision con el archivo en base64
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: isPdf ? "document" : "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            } as Parameters<typeof anthropic.messages.create>[0]["messages"][0]["content"][0],
            {
              type: "text",
              text: HORMONAL_ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    })

    const rawResponse = message.content[0].type === "text" ? message.content[0].text : ""

    let analysisResult = {
      extracted_values: [] as object[],
      alerts: [] as object[],
      clinical_notes: "",
      lab_date: null as string | null,
      lab_name: null as string | null,
    }

    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) analysisResult = JSON.parse(jsonMatch[0])
    } catch {
      analysisResult.clinical_notes = rawResponse
    }

    // Guardar en lab_uploads — file_url es el path, NO la URL firmada
    const { data: labUpload, error: dbError } = await supabase
      .from("lab_uploads")
      .insert({
        form_response_id: formResponseId === "temp" ? null : formResponseId,
        patient_id: patientId === "temp" ? null : patientId,
        professional_id: user.id,
        file_url: filePath,        // guardamos el PATH, no la URL pública
        file_name: file.name,
        file_size_bytes: file.size,
        file_type: isPdf ? "pdf" : "image",
        lab_date: analysisResult.lab_date,
        lab_name: analysisResult.lab_name,
        ai_model_used: "claude-sonnet-4-5",
        ai_raw_response: rawResponse,
        ai_extracted_values: analysisResult.extracted_values,
        ai_clinical_notes: analysisResult.clinical_notes,
        ai_alerts: analysisResult.alerts,
        ai_processed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error("DB error:", dbError)
      return NextResponse.json({ error: "Error al guardar análisis" }, { status: 500 })
    }

    // Devolver con URL firmada temporal para preview inmediato
    return NextResponse.json({
      success: true,
      lab_upload: {
        ...labUpload,
        file_url: signedData.signedUrl,  // URL temporal para el frontend
      },
      analysis: analysisResult,
    })

  } catch (error) {
    console.error("Lab analysis error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}