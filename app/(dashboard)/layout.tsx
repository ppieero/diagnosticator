import Link from "next/link"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">Diagnosticator</h1>
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200">
        <div className="flex items-center justify-around">
          <Link href="/patients" className="flex flex-col items-center gap-1 py-3 px-4 min-w-[64px] text-gray-500 hover:text-blue-600 transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span className="text-xs font-medium">Pacientes</span>
          </Link>
          <Link href="/evaluations" className="flex flex-col items-center gap-1 py-3 px-4 min-w-[64px] text-gray-500 hover:text-blue-600 transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span className="text-xs font-medium">Evaluaciones</span>
          </Link>
          <Link href="/diagnoses" className="flex flex-col items-center gap-1 py-3 px-4 min-w-[64px] text-gray-500 hover:text-blue-600 transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            <span className="text-xs font-medium">Diagnósticos</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
