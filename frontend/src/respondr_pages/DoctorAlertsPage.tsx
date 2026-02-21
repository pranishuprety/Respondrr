import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { Bell, Loader2, CheckCircle, XCircle, User } from 'lucide-react'

interface PatientRequest {
  id: number
  patient_id: string
  doctor_id: string
  status: string
  created_at: string
  patient?: {
    full_name: string
    phone?: string
    address?: string
  }
}

const DoctorAlertsPage = () => {
  const [loading, setLoading] = useState(true)
  const [pendingRequests, setPendingRequests] = useState<PatientRequest[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchPendingRequests()
  }, [])

  const fetchPendingRequests = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('patient_doctor_links')
        .select(`
          *,
          patient:profiles!patient_id(*)
        `)
        .eq('doctor_id', user.id)
        .eq('status', 'requested')
        .order('created_at', { ascending: false })

      setPendingRequests(data || [])
    } catch (error) {
      console.error('Error fetching pending requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: number) => {
    setActionLoading(`approve-${requestId}`)
    try {
      const request = pendingRequests.find(req => req.id === requestId)
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

      setPendingRequests(pendingRequests.filter(req => req.id !== requestId))
    } catch (error) {
      console.error('Error approving request:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectRequest = async (requestId: number) => {
    setActionLoading(`reject-${requestId}`)
    try {
      const { error } = await supabase
        .from('patient_doctor_links')
        .delete()
        .eq('id', requestId)

      if (error) {
        console.error('Error rejecting request:', error)
        return
      }

      setPendingRequests(pendingRequests.filter(req => req.id !== requestId))
    } catch (error) {
      console.error('Error rejecting request:', error)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white">
        <Navbar role="doctor" />
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar role="doctor" />

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
      </div>

      <main className="max-w-4xl mx-auto pt-32 px-6 pb-12 relative z-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-6 h-6 text-orange-400" />
            <h1 className="text-3xl font-black tracking-tight">Connection Requests</h1>
          </div>
          <p className="text-slate-400 font-medium">Review and manage patient connection requests</p>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-black text-white mb-2">All Caught Up!</h3>
            <p className="text-slate-400 font-medium">No pending connection requests at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30 flex-shrink-0">
                      <User className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-white mb-1">
                        {request.patient?.full_name}
                      </h3>
                      <p className="text-slate-400 text-sm font-medium mb-3">
                        Requested on {new Date(request.created_at).toLocaleDateString()}
                      </p>
                      <div className="space-y-2">
                        {request.patient?.phone && (
                          <p className="text-sm text-slate-300">
                            <span className="text-slate-400 font-semibold">Phone:</span> {request.patient.phone}
                          </p>
                        )}
                        {request.patient?.address && (
                          <p className="text-sm text-slate-300">
                            <span className="text-slate-400 font-semibold">Address:</span> {request.patient.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 flex-shrink-0 ml-4">
                    <button
                      onClick={() => handleApproveRequest(request.id)}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800/50 text-white font-black px-6 py-3 rounded-xl transition-all shadow-xl shadow-green-900/20 active:scale-95 text-xs uppercase tracking-widest"
                    >
                      {actionLoading === `approve-${request.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectRequest(request.id)}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white font-black px-6 py-3 rounded-xl transition-all shadow-xl shadow-red-900/20 active:scale-95 text-xs uppercase tracking-widest"
                    >
                      {actionLoading === `reject-${request.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default DoctorAlertsPage
