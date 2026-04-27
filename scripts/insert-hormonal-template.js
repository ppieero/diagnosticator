// Insert medicina hormonal evaluation template into specialty_form_templates
// Run with: node -r dotenv/config scripts/insert-hormonal-template.js
// Or:       node scripts/insert-hormonal-template.js (if env vars already exported)
const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// sections stored in `fields` column (DB maps data.fields -> template.sections)
const SECTIONS = [
  {
    id: "s_vasomotores", order: 1,
    title: "Síntomas vasomotores", required: true,
    fields: [
      { key: "hot_flashes_freq", label: "Sofocos — frecuencia diaria", type: "radio", options: ["0","1–3","4–6","7–10","+10"], required: true },
      { key: "hot_flashes_intensity", label: "Intensidad de sofocos", type: "scale_0_10" },
      { key: "night_sweats", label: "Sudoración nocturna", type: "radio", options: ["No","Leve","Moderada","Severa"] },
      { key: "palpitations", label: "Palpitaciones", type: "switch" },
      { key: "vasomotor_notes", label: "Notas vasomotoras", type: "textarea" },
    ]
  },
  {
    id: "s_tiroides", order: 2,
    title: "Tiroides", required: true,
    fields: [
      { key: "thyroid_symptoms", label: "Síntomas tiroideos actuales", type: "multiselect", options: ["Fatiga crónica","Intolerancia al frío","Aumento de peso","Caída de cabello","Piel seca","Estreñimiento","Bradicardia","Intolerancia al calor","Pérdida de peso","Nerviosismo","Taquicardia","Diarrea","Bocio"], required: true },
      { key: "thyroid_history", label: "Antecedente diagnóstico tiroideo", type: "radio", options: ["Ninguno","Hipotiroidismo","Hipertiroidismo","Tiroiditis Hashimoto","Tiroiditis Graves","Nódulo tiroideo","Tiroidectomía"] },
      { key: "thyroid_treatment", label: "¿Está bajo tratamiento tiroideo?", type: "switch" },
      { key: "thyroid_medication", label: "Medicación tiroidea actual", type: "text", show_if: { field: "thyroid_treatment", value: true } },
      { key: "last_tsh", label: "Último valor de TSH (mU/L)", type: "decimal" },
      { key: "last_tsh_date", label: "Fecha último TSH", type: "date" },
    ]
  },
  {
    id: "s_suprarrenales", order: 3,
    title: "Eje suprarrenal y estrés crónico", required: false,
    fields: [
      { key: "chronic_fatigue", label: "Fatiga crónica persistente", type: "radio", options: ["No","Leve","Moderada","Severa"] },
      { key: "energy_morning", label: "Energía al despertar", type: "scale_0_10" },
      { key: "energy_afternoon", label: "Energía en la tarde", type: "scale_0_10" },
      { key: "salt_cravings", label: "Antojos de sal", type: "switch" },
      { key: "dizziness_standing", label: "Mareo al ponerse de pie", type: "switch" },
      { key: "stress_chronic_months", label: "Estrés crónico sostenido (meses)", type: "number" },
      { key: "adrenal_notes", label: "Notas eje suprarrenal", type: "textarea" },
    ]
  },
  {
    id: "s_sexual", order: 4,
    title: "Bienestar sexual y ginecológico", required: false,
    fields: [
      { key: "libido_level", label: "Nivel de libido", type: "scale_0_10", required: true },
      { key: "vaginal_dryness_severity", label: "Sequedad vaginal", type: "radio", options: ["No","Leve","Moderada","Severa"] },
      { key: "dyspareunia", label: "Dolor en relaciones sexuales (dispareunia)", type: "switch" },
      { key: "orgasm_difficulty", label: "Dificultad para alcanzar el orgasmo", type: "switch" },
      { key: "pelvic_pain", label: "Dolor pélvico crónico", type: "switch" },
      { key: "urinary_symptoms", label: "Síntomas urinarios", type: "multiselect", options: ["Incontinencia de urgencia","Incontinencia de esfuerzo","Infecciones urinarias recurrentes","Nicturia","Ninguno"] },
      { key: "sexual_notes", label: "Notas bienestar sexual", type: "textarea" },
    ]
  },
  {
    id: "s_metabolico", order: 5,
    title: "Estado metabólico", required: false,
    fields: [
      { key: "waist_cm", label: "Perímetro de cintura (cm)", type: "number" },
      { key: "hip_cm", label: "Perímetro de cadera (cm)", type: "number" },
      { key: "blood_pressure_systolic", label: "Presión sistólica (mmHg)", type: "number" },
      { key: "blood_pressure_diastolic", label: "Presión diastólica (mmHg)", type: "number" },
      { key: "insulin_resistance_signs", label: "Signos de resistencia a la insulina", type: "multiselect", options: ["Acantosis nigricans","Antojos de azúcar constantes","Cansancio post-comida","Dificultad para bajar de peso","Hambre 2h después de comer","Ninguno"] },
      { key: "last_glucose", label: "Última glucosa en ayunas (mg/dL)", type: "number" },
      { key: "last_hba1c", label: "Última HbA1c (%)", type: "decimal" },
      { key: "metabolic_notes", label: "Notas metabólicas", type: "textarea" },
    ]
  },
  {
    id: "s_piel_cabello", order: 6,
    title: "Piel, cabello y uñas", required: false,
    fields: [
      { key: "skin_quality", label: "Calidad de piel", type: "multiselect", options: ["Normal","Seca","Grasa","Mixta","Sensible","Acneica","Con manchas","Con estrías recientes"] },
      { key: "acne_pattern", label: "Patrón de acné hormonal", type: "radio", options: ["No aplica","Mentón y mandíbula","Frente","Espalda","Generalizado"] },
      { key: "hair_loss_severity", label: "Caída de cabello", type: "radio", options: ["Ninguna","Leve","Moderada","Severa","Alopecia androgénica"] },
      { key: "hirsutism", label: "Hirsutismo (vello excesivo)", type: "switch" },
      { key: "hirsutism_location", label: "Localización del hirsutismo", type: "multiselect", options: ["Labio superior","Mentón","Pecho","Abdomen","Espalda","Muslos"], show_if: { field: "hirsutism", value: true } },
      { key: "nail_quality", label: "Calidad de uñas", type: "radio", options: ["Normal","Frágiles","Quebradizas","Con líneas horizontales"] },
    ]
  },
  {
    id: "s_humor_cognitivo", order: 7,
    title: "Estado emocional y cognitivo", required: false,
    fields: [
      { key: "mood_stability", label: "Estabilidad de ánimo", type: "scale_0_10", required: true },
      { key: "anxiety_level", label: "Nivel de ansiedad", type: "scale_0_10" },
      { key: "depressive_symptoms", label: "Síntomas depresivos actuales", type: "radio", options: ["No","Leves","Moderados","Severos"] },
      { key: "brain_fog", label: "Niebla mental (dificultad de concentración)", type: "radio", options: ["No","Leve","Moderada","Severa"] },
      { key: "memory_issues", label: "Problemas de memoria", type: "switch" },
      { key: "irritability_level", label: "Irritabilidad", type: "scale_0_10" },
      { key: "mood_notes", label: "Notas estado emocional", type: "textarea" },
    ]
  },
  {
    id: "s_sueno_habitos", order: 8,
    title: "Sueño y hábitos", required: false,
    fields: [
      { key: "sleep_quality", label: "Calidad del sueño", type: "radio", options: ["Muy bueno","Bueno","Regular","Malo","Muy malo"], required: true },
      { key: "sleep_hours", label: "Horas de sueño por noche", type: "number" },
      { key: "sleep_problems", label: "Problemas de sueño", type: "multiselect", options: ["Insomnio de conciliación","Insomnio de mantenimiento","Despertar temprano","Sueño no reparador","Apnea diagnosticada","Ninguno"] },
      { key: "activity_level", label: "Actividad física", type: "radio", options: ["Sedentaria","Moderada (1–3d/sem)","Activa (4–5d/sem)","Muy activa (6–7d/sem)"] },
      { key: "diet_quality", label: "Calidad alimentaria", type: "radio", options: ["Excelente","Buena","Regular","Mala","Muy mala"] },
      { key: "alcohol_consumption", label: "Consumo de alcohol", type: "radio", options: ["No consume","Ocasional","Semanal","Diario"] },
      { key: "smoking", label: "Tabaquismo", type: "radio", options: ["No fumadora","Ex-fumadora","Fumadora activa"] },
      { key: "supplements_current", label: "Suplementos actuales", type: "textarea" },
    ]
  },
  {
    id: "s_laboratorios", order: 9,
    title: "Laboratorios previos", required: false,
    fields: [
      { key: "labs_upload", label: "Subir resultados de laboratorio (PDF)", type: "lab_upload" },
      { key: "fsh_value", label: "FSH (mU/mL)", type: "decimal" },
      { key: "lh_value", label: "LH (mU/mL)", type: "decimal" },
      { key: "estradiol_value", label: "Estradiol (pg/mL)", type: "decimal" },
      { key: "progesterone_value", label: "Progesterona (ng/mL)", type: "decimal" },
      { key: "testosterone_total", label: "Testosterona total (ng/dL)", type: "decimal" },
      { key: "dhea_s", label: "DHEA-S (μg/dL)", type: "decimal" },
      { key: "prolactin_value", label: "Prolactina (ng/mL)", type: "decimal" },
      { key: "cortisol_am", label: "Cortisol matutino (μg/dL)", type: "decimal" },
      { key: "labs_date", label: "Fecha de los laboratorios", type: "date" },
      { key: "labs_notes", label: "Notas sobre laboratorios", type: "textarea" },
    ]
  },
  {
    id: "s_terapia_hormonal", order: 10,
    title: "Terapia hormonal actual / previa", required: false,
    fields: [
      { key: "current_hrt", label: "¿Está en terapia hormonal actualmente?", type: "switch" },
      { key: "hrt_type", label: "Tipo de terapia hormonal", type: "multiselect", options: ["Estrógenos orales","Estrógenos transdérmicos","Progesterona oral","Progestágenos","Testosterona","DHEA","Tiroxina (T4)","Combinada"], show_if: { field: "current_hrt", value: true } },
      { key: "hrt_duration_months", label: "Duración de terapia (meses)", type: "number", show_if: { field: "current_hrt", value: true } },
      { key: "hrt_response", label: "Respuesta a la terapia actual", type: "radio", options: ["Muy buena","Buena","Regular","Mala","Sin cambios"], show_if: { field: "current_hrt", value: true } },
      { key: "previous_hrt", label: "¿Ha recibido terapia hormonal previa?", type: "switch" },
      { key: "previous_hrt_details", label: "Detalles terapia previa", type: "textarea", show_if: { field: "previous_hrt", value: true } },
      { key: "hrt_contraindications", label: "Contraindicaciones conocidas para TH", type: "multiselect", options: ["Cáncer de mama previo","Cáncer de endometrio previo","Trombosis venosa profunda","Enfermedad hepática activa","Migraña con aura","Ninguna conocida"] },
    ]
  },
  {
    id: "s_antecedentes_familiares", order: 11,
    title: "Antecedentes familiares relevantes", required: false,
    fields: [
      { key: "family_breast_cancer", label: "Cáncer de mama familiar", type: "radio", options: ["No","Madre","Hermana","Abuela materna","Abuela paterna","Múltiples"] },
      { key: "family_ovarian_cancer", label: "Cáncer de ovario familiar", type: "radio", options: ["No","Madre","Hermana","Abuela materna","Abuela paterna"] },
      { key: "family_thyroid", label: "Enfermedad tiroidea familiar", type: "switch" },
      { key: "family_diabetes", label: "Diabetes tipo 2 familiar", type: "switch" },
      { key: "family_osteoporosis", label: "Osteoporosis familiar", type: "switch" },
      { key: "family_cardiovascular", label: "Enfermedad cardiovascular prematura familiar", type: "switch" },
      { key: "family_notes", label: "Notas antecedentes familiares", type: "textarea" },
    ]
  },
  {
    id: "s_ia_sugerencia", order: 12,
    title: "Análisis IA — Perfil hormonal", required: false,
    fields: [
      { key: "ia_notes", label: "Observaciones antes del análisis IA (opcional)", type: "textarea" },
    ]
  },
  {
    id: "s_plan_terapeutico", order: 13,
    title: "Impresión clínica y plan terapéutico", required: true,
    fields: [
      { key: "clinical_impression", label: "Impresión clínica del profesional", type: "textarea", required: true },
      { key: "proposed_labs", label: "Laboratorios solicitados", type: "textarea" },
      { key: "treatment_plan_summary", label: "Plan terapéutico inicial", type: "textarea", required: true },
      { key: "follow_up_weeks", label: "Seguimiento en (semanas)", type: "number" },
      { key: "urgency", label: "Prioridad clínica", type: "radio", options: ["Rutina","Preferente","Urgente"] },
    ]
  },
]

async function main() {
  console.log("Checking specialty 'medicina-hormonal'...")
  const { data: specialty, error: spErr } = await supabase
    .from("specialties")
    .select("id, name, slug")
    .or("slug.eq.medicina-hormonal,slug.eq.medicina_hormonal,name.ilike.%hormonal%")
    .maybeSingle()

  if (spErr) { console.error("Specialty error:", spErr); process.exit(1) }
  if (!specialty) { console.error("Specialty 'medicina-hormonal' not found. Create it first."); process.exit(1) }
  console.log("Found specialty:", specialty.id, specialty.name)

  // Deactivate any existing active template for this specialty + form_type
  const { error: deactErr } = await supabase
    .from("specialty_form_templates")
    .update({ is_active: false })
    .eq("specialty_id", specialty.id)
    .eq("form_type", "initial")
    .eq("is_active", true)

  if (deactErr) console.warn("Deactivate warning:", deactErr.message)

  // Get first admin/professional user for created_by
  const { data: adminUser } = await supabase.from("profiles").select("id").limit(1).single()
  const userId = adminUser?.id ?? null

  // Insert: `fields` column stores the sections array (see getTemplateBySpecialtyAndType)
  const { data: inserted, error: insErr } = await supabase
    .from("specialty_form_templates")
    .insert({
      name: "Evaluación inicial — Medicina Hormonal",
      form_type: "initial",
      version: 1,
      is_active: true,
      specialty_id: specialty.id,
      description: "Evaluación clínica completa para medicina hormonal femenina: vasomotores, tiroides, suprarrenales, bienestar sexual, estado metabólico y plan terapéutico.",
      estimated_minutes: 30,
      fields: SECTIONS,
      scoring_config: {},
      created_by: userId,
    })
    .select("id, name")
    .single()

  if (insErr) { console.error("Insert error:", insErr); process.exit(1) }
  console.log("Template inserted:", inserted.id, inserted.name)

  // Link to service named like "Evaluación hormonal inicial" if it exists
  const { data: service } = await supabase
    .from("services")
    .select("id, name")
    .eq("specialty_id", specialty.id)
    .ilike("name", "%hormonal%")
    .maybeSingle()

  if (service) {
    const { error: linkErr } = await supabase
      .from("specialty_form_templates")
      .update({ service_id: service.id })
      .eq("id", inserted.id)
    if (linkErr) console.warn("Link service warning:", linkErr.message)
    else console.log("Linked to service:", service.id, service.name)
  } else {
    console.log("No matching service found — template linked by specialty only")
  }

  // Verify retrieval
  const { data: verify, error: verErr } = await supabase
    .from("specialty_form_templates")
    .select("id, name, specialty_id, form_type, version, is_active, fields")
    .eq("id", inserted.id)
    .single()

  if (verErr) { console.error("Verify error:", verErr); process.exit(1) }
  const sections = Array.isArray(verify.fields) ? verify.fields : []
  const totalFields = sections.reduce((acc, s) => acc + (s.fields?.length ?? 0), 0)
  console.log(`\nVerification OK — ${sections.length} sections, ${totalFields} fields`)
  console.log("Template ready:", verify.name)
}

main().catch(e => { console.error(e); process.exit(1) })
