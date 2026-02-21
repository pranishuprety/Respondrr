import React, { useEffect, useState } from 'react'
import { PhoneOff, Loader2 } from 'lucide-react'

interface VideoCallInterfaceProps {
  roomUrl: string
  onCallEnded: () => void
  callId: number
}

const VideoCallInterface: React.FC<VideoCallInterfaceProps> = ({
  roomUrl,
  onCallEnded,
  callId
}) => {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  const handleEndCall = async () => {
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      await fetch(`${backendUrl}/api/video/end-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId })
      })
      onCallEnded()
    } catch (error) {
      console.error('Error ending call:', error)
      onCallEnded()
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {loading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
            <p className="text-white font-semibold">Connecting to call...</p>
          </div>
        </div>
      )}

      <iframe
        key={roomUrl}
        allow="camera; microphone; fullscreen; speaker; display-capture"
        src={roomUrl}
        style={{
          height: '100%',
          width: '100%',
          border: 'none',
          borderRadius: 0
        }}
      />

      <button
        onClick={handleEndCall}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black px-6 py-3 rounded-full transition-all shadow-2xl active:scale-95 z-20"
      >
        <PhoneOff className="w-5 h-5" />
        End Call
      </button>
    </div>
  )
}

export default VideoCallInterface
