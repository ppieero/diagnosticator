"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createProfessional, getAvailableUsers } from "@/lib/services/professionals"
import { cn } from "@/lib/utils"

const COLORS = [
  "#185FA5","#0F6E56","#993C1D","#534AB7",
  "#3B6D11","#854F0B","#993556","#5F5E5A",
]

export default function NuevoProfesionalPage() {
  const router = useRouter()
  const [users, setUsers] = useState<{ id: string; full_name: string; email?: string }[]>([])
  const [specialties, setSpecialties] = useState<{ id: string; name: string; color: string }[]>([])
  const [selectedUser, setSelectedUser] = useState("")
  const [selectedSpecialty, setSelectedSpecialty] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [bio, setBio] = useState("")
  const [color, setColor] = useState("#185FA5")
  const [slotDuration, setSlotDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [usersData, specsData] = await Promise.all([
        getAvailableUsers(),
        supabase.from("specialties").select("id, name, color").eq("is_active", true),
      ])
      setUsers(usersData)
      setSpecialties((specsData.data ?? []) as { id: string; name: string; color: string }[])
      if (specsData.data?.[0]) setSelectedSpecialty(specsData.data[0].id)
    }
    load()
  }, [])

  async function handleCreate() {
    if (!selectedUser || !selectedSpecialty) {
      setError("Selecciona un usuario y una especialidad")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const id = await createProfessional({
        user_id: selectedUser,
        specialty_id: selectedSpecialty,
        license_number: licenseNumber || undefined,
        bio: bio || undefined,
        color,
        slot_duration: slotDuration,
      })
      router.push(`/profesionales/${id}`)
    } catch (err) {
      console.error(err)
      setError("Error al crear el profesional")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-5 fade-up flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-900">Nuevo profesional</h2>
      </div>

      <div className="card p-4 flex flex-col gap-4">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">Usuario del sistema</label>
          {users.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-800">Todos los usuarios ya son profesionales o no hay usuarios disponibles.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {users.map(u => (
                <button key={u.id} type="button" onClick={() => setSelectedUser(u.id)}
                  className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                    selectedUser === u.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gray-600">{u.full_name?.charAt(0)}</span>
                  </div>
                  <div>
                    <p className={cn("text-sm font-medium", selectedUser === u.id ? "text-blue-900" : "text-gray-800")}>{u.full_name}</p>
                    {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">Especialidad</label>
          <div className="flex flex-col gap-2">
            {specialties.map(sp => (
              <button key={sp.id} type="button" onClick={() => setSelectedSpecialty(sp.id)}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                  selectedSpecialty === sp.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300")}>
                <div className="w-3 h-3 rounded-full" style={{ background: sp.color }} />
                <span className={cn("text-sm font-medium", selectedSpecialty === sp.id ? "text-blue-900" : "text-gray-700")}>{sp.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">N° de licencia (opcional)</label>
          <input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)}
            placeholder="Ej: 12345" className="input-base" />
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Bio corta (opcional)</label>
          <input value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Especialista en..." className="input-base" />
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium block mb-2">Color identificador</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={cn("w-9 h-9 rounded-xl transition-all",
                  color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"
                )}
                style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button onClick={handleCreate} disabled={loading || !selectedUser || !selectedSpecialty}
        className="tap-target w-full rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? "Creando..." : "Crear profesional →"}
      </button>
    </div>
  )
}