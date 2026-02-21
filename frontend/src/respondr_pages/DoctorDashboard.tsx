import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { Shield, Users, MessageSquare, AlertTriangle, Radio, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import VideoCallWidget from '../components/VideoCallWidget'
import VideoCallInterface from '../components/VideoCallInterface'

interface Profile {
  id: string
  full_name: string
  role: string
  license_number?: string
  certification?: string
  is_verified?: boolean
}

interface PatientRequest {
  id: number
  patient_id: string
  doctor_id: string
  status: string
  created_at: string
  patient?: {
    full_name: string
    phone?: string
  }
}

const DoctorDashboard = () => {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalPatients, setTotalPatients] = useState(0)
  const [messagesCount, setMessagesCount] = useState(0)
  const [pendingRequestsList, setPendingRequestsList] = useState<PatientRequest[]>([])
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [conversationIds, setConversationIds] = useState<number[]>([])
  const [activeCall, setActiveCall] = useState<any>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (conversationIds.length === 0 || !currentUserId) return

    const subscriptions = conversationIds.map(convId =>
      supabase
        .channel(`video-calls-dashboard-${convId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'video_calls',
            filter: `conversation_id=eq.${convId}`
          },
          (payload) => {
            const call = payload.new
            if (call.started_by !== currentUserId && call.status === 'ringing') {
              console.log('[DASHBOARD] Incoming call from:', call.started_by)
              setActiveCall(call)
            }
          }
        )
        .subscribe()
    )

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe())
    }
  }, [conversationIds, currentUserId])

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)

      const { count: patientsCount } = await supabase
        .from('patient_doctor_links')
        .select('*', { count: 'exact' })
        .eq('doctor_id', user.id)
        .eq('status', 'active')

      setTotalPatients(patientsCount || 0)

      const { data: pendingData } = await supabase
        .from('patient_doctor_links')
        .select(`
          *,
          patient:profiles!patient_id(full_name, phone)
        `)
        .eq('doctor_id', user.id)
        .eq('status', 'requested')
        .order('created_at', { ascending: false })

      setPendingRequestsList(pendingData || [])

      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('id')
        .eq('doctor_id', user.id)

      const convIds = conversationsData?.map(c => c.id) || []
      setConversationIds(convIds)

      if (convIds.length > 0) {
        const { count: messagesCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact' })
          .in('conversation_id', convIds)

        setMessagesCount(messagesCount || 0)
      } else {
        setMessagesCount(0)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: number) => {
    setActionLoading(requestId)
    try {
      const request = pendingRequestsList.find(req => req.id === requestId)
      if (!request) return

      const { error } = await supabase
        .from('patient_doctor_links')
        .update({ status: 'active' })
        .eq('id', requestId)
        .select()

      if (error) {
        console.error('Error approving request:', error)
        return
      }

      await supabase
        .from('conversations')
        .insert([{
          patient_id: request.patient_id,
          doctor_id: request.doctor_id,
          created_at: new Date().toISOString()
        }])
        .select()

      setPendingRequestsList(pendingRequestsList.filter(req => req.id !== requestId))
      setTotalPatients(totalPatients + 1)
    } catch (error) {
      console.error('Error approving request:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectRequest = async (requestId: number) => {
    setActionLoading(requestId)
    try {
      const { error } = await supabase
        .from('patient_doctor_links')
        .delete()
        .eq('id', requestId)

      if (error) {
        console.error('Error rejecting request:', error)
        return
      }

      setPendingRequestsList(pendingRequestsList.filter(req => req.id !== requestId))
    } catch (error) {
      console.error('Error rejecting request:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCallEnded = () => {
    setActiveCall(null)
  }

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
      <Navbar role="doctor" />

      {conversationIds.map(convId => (
        <VideoCallWidget
          key={`call-widget-${convId}`}
          conversationId={convId}
          currentUserId={currentUserId}
          onCallAccepted={(callData) => setActiveCall(callData)}
          onCallRejected={() => {}}
        />
      ))}

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
      </div>

      <main className="max-w-7xl mx-auto pt-32 px-6 pb-12 relative z-10">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <>
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-xl bg-blue-500/10 text-blue-400 border-blue-500/20">
                Doctor Network Active
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight">
              Welcome back, <br />
              <span className="text-blue-500">Dr. {profile?.full_name?.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 text-right min-w-[250px]">
            <p className="text-slate-500 font-black mb-2 uppercase tracking-[0.2em] text-[10px]">Status</p>
            <div className="flex items-center gap-3 justify-end">
              <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
              <span className="text-emerald-500 font-black text-lg uppercase tracking-tighter italic">Available</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 hover:border-blue-500/30 transition-all group">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <span className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Assigned</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">{totalPatients}</span>
              <span className="text-slate-500 font-black text-sm uppercase tracking-widest">Patients</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 hover:border-blue-500/30 transition-all group">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6 text-green-500" />
              </div>
              <span className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Messages</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">{messagesCount}</span>
              <span className="text-slate-500 font-black text-sm uppercase tracking-widest">Total</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 hover:border-blue-500/30 transition-all group">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <span className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Requests</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">{pendingRequestsList.length}</span>
              <span className="text-slate-500 font-black text-sm uppercase tracking-widest">Pending</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 hover:border-blue-500/30 transition-all group">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-slate-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-slate-400" />
              </div>
              <span className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Credentials</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-white tracking-tighter mb-0.5">{profile?.license_number || 'Not Set'}</span>
              <span className={`font-black uppercase tracking-widest text-[8px] ${profile?.is_verified ? 'text-emerald-500' : 'text-slate-500'}`}>
                {profile?.is_verified ? 'Verified' : 'Pending Verification'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900/30 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black tracking-tight leading-none">Patient Overview</h3>
              <button className="text-blue-500 font-black uppercase tracking-widest text-[10px] hover:underline">Full Access</button>
            </div>
            <div className="space-y-6">
              {totalPatients > 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="font-medium">You have {totalPatients} connected patient{totalPatients !== 1 ? 's' : ''}</p>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="font-medium">No patients connected yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900/30 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
                <h3 className="text-2xl font-black tracking-tight">Pending Requests</h3>
              </div>
              
              {pendingRequestsList.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <p className="font-medium">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {pendingRequestsList.map((request) => (
                    <div
                      key={request.id}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-black text-white">{request.patient?.full_name}</h4>
                          {request.patient?.phone && (
                            <p className="text-xs text-slate-400 mt-1">{request.patient.phone}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-2">
                            Requested {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleApproveRequest(request.id)}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800/50 text-white font-black px-4 py-2 rounded-xl transition-all text-xs uppercase tracking-widest"
                          >
                            {actionLoading === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white font-black px-4 py-2 rounded-xl transition-all text-xs uppercase tracking-widest"
                          >
                            {actionLoading === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Quick Stats</h3>
                <button className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                  <p className="font-black text-lg text-white mb-1">Active Conversations</p>
                  <p className="text-blue-400 font-bold text-xs uppercase tracking-widest">{messagesCount > 0 ? 'Active' : 'No messages yet'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </main>
    </div>
  )
}

export default DoctorDashboard
