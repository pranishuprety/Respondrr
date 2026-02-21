import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Loader2, CheckCircle, Plus } from 'lucide-react'

interface Doctor {
  id: string
  full_name: string
  phone?: string
  certification?: string
  license_number?: string
  is_verified?: boolean
}

interface CurrentUser {
  id: string
}

interface DoctorSearchComponentProps {
  onDoctorConnected?: () => void
}

const DoctorSearchComponent: React.FC<DoctorSearchComponentProps> = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [pendingRequests, setPendingRequests] = useState<string[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: allDoctors } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'doctor')

      const { data: connections } = await supabase
        .from('patient_doctor_links')
        .select('doctor_id, status')
        .eq('patient_id', user?.id)

      const connectedDoctorIds = connections
        ?.filter(c => c.status === 'active')
        .map(c => c.doctor_id) || []

      const pendingDoctorIds = connections
        ?.filter(c => c.status === 'requested')
        .map(c => c.doctor_id) || []

      const availableDoctors = allDoctors?.filter(
        doc => !connectedDoctorIds.includes(doc.id) && doc.id !== user?.id
      ) || []

      setDoctors(availableDoctors)
      setFilteredDoctors(availableDoctors)
      setPendingRequests(pendingDoctorIds)
    } catch (error) {
      console.error('Error fetching doctors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    const filtered = doctors.filter(doctor =>
      doctor.full_name?.toLowerCase().includes(query.toLowerCase()) ||
      doctor.certification?.toLowerCase().includes(query.toLowerCase())
    )
    setFilteredDoctors(filtered)
  }

  const handleConnect = async (doctorId: string) => {
    if (!currentUser) return

    setConnecting(doctors.findIndex(d => d.id === doctorId))
    try {
      await supabase
        .from('patient_doctor_links')
        .insert([{
          patient_id: currentUser.id,
          doctor_id: doctorId,
          status: 'requested'
        }])

      setPendingRequests([...pendingRequests, doctorId])
    } catch (error) {
      console.error('Error sending connection request:', error)
    } finally {
      setConnecting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search doctors by name or certification..."
            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDoctors.length === 0 ? (
          <div className="col-span-full bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 p-8 text-center">
            <p className="text-slate-400 font-medium">
              {searchQuery ? 'No doctors match your search.' : 'No available doctors found.'}
            </p>
          </div>
        ) : (
          filteredDoctors.map((doctor) => (
            <div
              key={doctor.id}
              className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">{doctor.full_name}</h3>
                  {doctor.certification && (
                    <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mt-1">
                      {doctor.certification}
                    </p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  doctor.is_verified
                    ? 'bg-green-500/20 border border-green-500/50'
                    : 'bg-slate-700/50 border border-white/5'
                }`}>
                  {doctor.is_verified && (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  )}
                </div>
              </div>

              {doctor.phone && (
                <p className="text-sm text-slate-300 mb-2">
                  <span className="text-slate-400 font-semibold">Phone:</span> {doctor.phone}
                </p>
              )}

              {doctor.license_number && (
                <p className="text-sm text-slate-300 mb-4">
                  <span className="text-slate-400 font-semibold">License:</span> {doctor.license_number}
                </p>
              )}

              <button
                onClick={() => handleConnect(doctor.id)}
                disabled={pendingRequests.includes(doctor.id) || connecting !== null}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-black text-xs uppercase tracking-widest ${
                  pendingRequests.includes(doctor.id)
                    ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                }`}
              >
                {pendingRequests.includes(doctor.id) ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Request Pending
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Connect
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default DoctorSearchComponent
