import { NewPatientForm } from "@/components/patients/NewPatientForm"

export const metadata = { title: "Nuevo paciente" }

export default function NewPatientPage() {
  return (
    <div className="px-4 py-5">
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Nuevo paciente</h2>
      <NewPatientForm />
    </div>
  )
}
