export const ACTIVITY_LABELS: Record<string,string> = {
  sedentary:"Sedentario",moderate:"Moderado (1–3 días/sem)",
  active:"Activo (4–5 días/sem)",very_active:"Muy activo (6–7 días/sem)",
}
export const DIET_TYPE_LABELS: Record<string,string> = {
  omnivore:"Omnívora",vegetarian:"Vegetariana",vegan:"Vegana",
  keto_lowcarb:"Keto / Low-carb",gluten_free:"Sin gluten",
  high_protein:"Alta proteína",fasting:"Ayuno intermitente",other:"Otro",
}
export const DIET_QUALITY_LABELS: Record<string,string> = {
  excellent:"Excelente",good:"Buena",fair:"Regular",bad:"Mala",very_bad:"Muy mala",
}
export const WATER_LABELS: Record<string,string> = {
  lt_0_5:"Menos de 0.5 L/día","0_5_1":"0.5 – 1 L/día","1_1_5":"1 – 1.5 L/día",
  "1_5_2":"1.5 – 2 L/día","2_3":"2 – 3 L/día",gt_3:"Más de 3 L/día",
}
export const BOWEL_HABIT_LABELS: Record<string,string> = {
  normal:"Normal",constipation:"Estreñimiento",diarrhea:"Diarrea",variable:"Variable",
}
export const YES_NO_LABELS: Record<string,string> = {
  yes:"Sí",no:"No",sometimes:"A veces",
}
export const SLEEP_QUALITY_LABELS: Record<string,string> = {
  very_good:"Muy bueno",good:"Bueno",fair:"Regular",bad:"Malo",very_bad:"Muy malo",
}
export const MOOD_LABELS: Record<string,string> = {
  calm:"Tranquilo",happy:"Contento",motivated:"Motivado",tired:"Cansado",
  anxious:"Ansioso",stressed:"Estresado",sad:"Triste",
  irritable:"Irritable",pain_discomfort:"Con dolor / Malestar",
}
export const DOMINANCE_LABELS: Record<string,string> = {
  right:"Derecha",left:"Izquierda",ambidextrous:"Ambidextro",
}
export const SPORT_PERF_LABELS: Record<string,string> = {
  low:"Bajo",fair:"Regular",good:"Bueno",very_good:"Muy bueno",competitive:"Competitivo",
}
export const SPORT_LABELS: Record<string,string> = {
  walking:"Caminata",running:"Correr",gym_weights:"Gimnasio / Pesas",
  crossfit:"CrossFit",cycling:"Ciclismo",swimming:"Natación",soccer:"Fútbol",
  yoga:"Yoga",pilates:"Pilates",dance:"Baile",tennis_padel:"Tenis / Pádel",other:"Otro",
}
export const STRESS_COPE_LABELS: Record<string,string> = {
  exercise:"Ejercicio",breathing_meditation:"Respiración / Meditación",
  sleep:"Dormir",eating_cravings:"Comer",talking:"Hablar con alguien",
  music_leisure:"Música / Ocio",therapy:"Terapia",
  caffeine_stimulants:"Café / Estimulantes",alcohol:"Alcohol",
  tobacco:"Tabaco",dont_know:"No lo maneja bien",
}
export const PERSONAL_HISTORY_LABELS: Record<string,string> = {
  none:"Ninguno",diabetes:"Diabetes",hypertension:"Hipertensión",asthma:"Asma",
  allergies:"Alergias conocidas",thyroid:"Problemas de tiroides",
  high_cholesterol:"Colesterol alto",gastritis_reflux:"Gastritis / Reflujo",
  anxiety_depression:"Ansiedad / Depresión",migraines:"Migrañas",
  major_injuries:"Lesiones previas",surgeries:"Cirugías previas",
  current_meds:"Medicación actual",other:"Otros",
}
export const FOOD_LABELS: Record<string,string> = {
  no_breakfast:"No desayuna",coffee_tea:"Café / Infusión",bread_toast:"Pan / Tostadas",
  oats_cereal:"Avena / Cereal",fruit:"Fruta",yogurt_dairy:"Yogurt / Lácteos",eggs:"Huevos",
  home_cooked:"Menú casero",fast_food:"Comida rápida",salad:"Ensalada",
  rice_pasta:"Arroz / Pasta",chicken_meat:"Pollo / Carne",fish:"Pescado",legumes:"Legumbres",
  similar_lunch:"Similar al almuerzo",light_meal:"Comida ligera",
  snacking:"Picoteo",no_dinner:"No cena",
}
export const PREGNANCY_LABELS: Record<string,string> = {
  yes:"Sí",no:"No",not_applicable:"No aplica",unknown:"Desconocido",
}
export function tr(map: Record<string,string>, val?: string|null): string {
  if (!val) return "—"
  return map[val] ?? val
}
export function trArr(map: Record<string,string>, arr?: string[]|null): string {
  if (!arr || arr.length === 0) return "—"
  return arr.map(v => map[v] ?? v).join(", ")
}
