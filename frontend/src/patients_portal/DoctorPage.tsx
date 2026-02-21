import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import MessagingComponent from './MessagingComponent'
import DoctorSearchComponent from './DoctorSearchComponent'
import VideoCallWidget from '../components/VideoCallWidget'
import VideoCallInterface from '../components/VideoCallInterface'
import { MessageSquare, Search } from 'lucide-react'

interface Doctor {
  id: string
  full_name: string
  phone?: string
  email?: string
  license_number?: string
  certification?: string
  is_verified?: boolean
}

interface User {
  id: string
  email?: string
}

const DoctorPage = () => {
  const [loading, setLoading] = useState(true)
  const [connectedDoctor, setConnectedDoctor] = useState<Doctor | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeCall, setActiveCall] = useState<any>(null)
  const [conversationId, setConversationId] = useState<number | null>(null)

  useEffect(() => {
    fetchConnectedDoctor()
  }, [])

  const fetchConnectedDoctor = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUser(user)

      const { data } = await supabase
        .from('patient_doctor_links')
        .select(`
          *,
          doctor:profiles!doctor_id(*)
        `)
        .eq('patient_id', user.id)
        .eq('status', 'active')
        .single()

      if (data) {
        setConnectedDoctor(data.doctor)
        
        const { data: convData } = await supabase
          .from('conversations')
          .select('id')
          .eq('patient_id', user.id)
          .eq('doctor_id', data.doctor.id)
          .single()
        
        if (convData) {
          setConversationId(convData.id)
        }
      }
    } catch {
      console.log('No connected doctor found')
    } finally {
      setLoading(false)
    }
  }

  const handleCallEnded = () => {
    setActiveCall(null)
  }

  if (loading) return null

  if (activeCall) {
    return (
      <VideoCallInterface
        roomUrl={activeCall.room_url}
        onCallEnded={handleCallEnded}
        callId={activeCall.id}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar role="patient" />

      {conversationId && (
        <VideoCallWidget
          conversationId={conversationId}
          currentUserId={currentUser?.id || ''}
          onCallAccepted={(callData) => setActiveCall(callData)}
          onCallRejected={() => {}}
        />
      )}

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
      </div>

      <main className="max-w-5xl mx-auto pt-32 px-6 pb-12 relative z-10">
        {connectedDoctor ? (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <MessageSquare className="w-6 h-6 text-blue-400" />
                <div>
                  <h1 className="text-2xl font-black tracking-tight">Connected Doctor</h1>
                  <p className="text-slate-400 text-sm font-medium">{connectedDoctor.full_name}</p>
                </div>
              </div>
            </div>

            <MessagingComponent 
              doctor={connectedDoctor} 
              currentUser={currentUser}
              onCallInitiated={(callData) => setActiveCall(callData)}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Search className="w-6 h-6 text-blue-400" />
                <h1 className="text-2xl font-black tracking-tight">Find a Doctor</h1>
              </div>
              <p className="text-slate-400 text-sm font-medium">Search and connect with available doctors</p>
            </div>

            <DoctorSearchComponent onDoctorConnected={fetchConnectedDoctor} />
          </div>
        )}
      </main>
    </div>
  )
}

export default DoctorPage
