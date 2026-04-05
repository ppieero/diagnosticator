"use client"
import { FormEngine } from "@/components/forms/FormEngine"
import type { FormTemplateConfig } from "@/types/domain"

const TEST_TEMPLATE: FormTemplateConfig = {
  id: "test-fisio",
  name: "Prueba — Evaluación Fisioterapia",
  specialty: "fisioterapia",
  form_type: "initial",
  version: 1,
  sections: [
    {
      id: "s_dolor",
      title: "Evaluación del dolor",
      description: "Escala de dolor y localización",
      collapsible: true,
      required: true,
      order: 1,
      scoring: { enabled: true, weight: 1 },
      fields: [
        {
          key: "pain_scale",
          label: "Nivel de dolor actual",
          type: "scale_0_10",
          required: true,
          audit_required: true,
          help_text: "0 = sin dolor · 10 = insoportable",
          clinical_alert: {
            condition: "value >= 8",
            message: "Dolor severo — considerar derivación urgente",
            severity: "warning"
          }
        },
        {
          key: "body_map",
          label: "Localización del dolor",
          type: "body_map",
          required: true,
          audit_required: true
        },
        {
          key: "pain_type",
          label: "Tipo de dolor",
          type: "multiselect",
          options: [
            { value: "sharp", label: "Agudo" },
            { value: "dull", label: "Sordo" },
            { value: "burning", label: "Ardor" },
            { value: "radiating", label: "Irradiado" }
          ]
        },
        {
          key: "pain_pattern",
          label: "Patrón",
          type: "radio",
          options: [
            { value: "constant", label: "Constante" },
            { value: "intermittent", label: "Intermitente" },
            { value: "movement", label: "Con movimiento" }
          ]
        }
      ]
    },
    {
      id: "s_articular",
      title: "Evaluación articular",
      description: "Rango de movilidad por articulación",
      collapsible: true,
      required: false,
      order: 2,
      fields: [
        {
          key: "joint_assessment",
          label: "Articulaciones evaluadas",
          type: "repeating_group",
          min_items: 0,
          max_items: 8,
          item_label: "Articulación",
          add_label: "Añadir articulación",
          fields: [
            {
              key: "joint",
              label: "Articulación",
              type: "select",
              required: true,
              options: [
                { value: "cervical", label: "Cervical" },
                { value: "lumbar", label: "Lumbar" },
                { value: "shoulder_r", label: "Hombro derecho" },
                { value: "shoulder_l", label: "Hombro izquierdo" },
                { value: "knee_r", label: "Rodilla derecha" },
                { value: "knee_l", label: "Rodilla izquierda" }
              ]
            },
            { key: "flexion", label: "Flexión", type: "range_of_motion", unit: "°" },
            { key: "extension", label: "Extensión", type: "range_of_motion", unit: "°" },
            {
              key: "limitation",
              label: "Limitación",
              type: "select",
              options: [
                { value: "none", label: "Sin limitación" },
                { value: "mild", label: "Leve" },
                { value: "moderate", label: "Moderada" },
                { value: "severe", label: "Severa" }
              ]
            },
            { key: "notes", label: "Observaciones", type: "text" }
          ]
        }
      ]
    },
    {
      id: "s_phq9",
      title: "PHQ-9 — Test de depresión",
      description: "Cuestionario validado internacionalmente",
      collapsible: true,
      required: false,
      order: 3,
      fields: [
        {
          key: "phq9_answers",
          label: "PHQ-9",
          type: "scored_test",
          test_key: "phq9"
        }
      ]
    },
    {
      id: "s_conclusion",
      title: "Impresión clínica",
      collapsible: true,
      required: true,
      order: 4,
      fields: [
        {
          key: "clinical_impression",
          label: "Impresión clínica",
          type: "textarea",
          required: true,
          rows: 4,
          placeholder: "Síntesis de hallazgos y orientación diagnóstica..."
        },
        {
          key: "prognosis",
          label: "Pronóstico",
          type: "select",
          options: [
            { value: "very_good", label: "Muy bueno" },
            { value: "good", label: "Bueno" },
            { value: "moderate", label: "Moderado" },
            { value: "reserved", label: "Reservado" }
          ]
        }
      ]
    }
  ]
}

export default function FormTestPage() {
  async function handleSave(answers: Record<string, unknown>, scores: Record<string, number>) {
    console.log("SAVE:", { answers, scores })
    await new Promise(r => setTimeout(r, 500))
  }

  async function handleComplete(answers: Record<string, unknown>, scores: Record<string, number>) {
    console.log("COMPLETE:", { answers, scores })
    alert("Formulario completado. Ver consola para datos.")
  }

  return (
    <div className="px-4 py-5 fade-up">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gray-900">Motor de formularios — Prueba</h2>
        <p className="text-sm text-gray-500 mt-1">Verificación de todos los tipos de campo</p>
      </div>
      <FormEngine
        template={TEST_TEMPLATE}
        onSave={handleSave}
        onComplete={handleComplete}
      />
    </div>
  )
}