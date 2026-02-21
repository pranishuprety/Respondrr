import React, { useState, useEffect } from 'react'
import { Phone, PhoneOff, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface VideoCallWidgetProps {
  onCallAccepted: (callData: any) => void
  onCallRejected: () => void
  currentUserId: string
  conversationId: number
}

const VideoCallWidget: React.FC<VideoCallWidgetProps> = ({
  onCallAccepted,
  onCallRejected,
  currentUserId,
  conversationId
}) => {
  const [incomingCall, setIncomingCall] = useState<any>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    const subscription = supabase
      .channel(`video-calls-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'video_calls',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const call = payload.new
          if (call.started_by !== currentUserId && call.status === 'ringing') {
            setIncomingCall(call)
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [conversationId, currentUserId])

  const handleAcceptCall = async () => {
    if (!incomingCall) return
    
    setAccepting(true)
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${backendUrl}/api/video/accept-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: incomingCall.id,
          accepted_by: currentUserId
        })
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = await response.json()
      if (data.success) {
        onCallAccepted({
          ...incomingCall,
          token: data.token,
          room_url: data.room_url
        })
        setIncomingCall(null)
      }
    } catch (error) {
      console.error('Error accepting call:', error)
    } finally {
      setAccepting(false)
    }
  }

  const handleRejectCall = async () => {
    if (!incomingCall) return

    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      await fetch(`${backendUrl}/api/video/reject-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: incomingCall.id })
      })
      setIncomingCall(null)
      onCallRejected()
    } catch (error) {
      console.error('Error rejecting call:', error)
    }
  }

  if (!incomingCall) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-2xl p-8 max-w-sm w-full mx-4 border border-white/10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-600/20 flex items-center justify-center">
            <Phone className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Incoming Call</h2>
          <p className="text-slate-400">Doctor is calling...</p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleRejectCall}
            disabled={accepting}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 disabled:bg-red-600/10 text-red-400 font-black py-3 rounded-xl transition-all"
          >
            <PhoneOff className="w-5 h-5" />
            Reject
          </button>

          <button
            onClick={handleAcceptCall}
            disabled={accepting}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600/30 disabled:bg-green-600/10 text-green-400 font-black py-3 rounded-xl transition-all"
          >
            {accepting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Phone className="w-5 h-5" />
            )}
            Answer
          </button>
        </div>
      </div>
    </div>
  )
}

export default VideoCallWidget
