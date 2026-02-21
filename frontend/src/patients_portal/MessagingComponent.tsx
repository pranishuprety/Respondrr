import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Send, Loader2, Paperclip, Download, X, Phone } from 'lucide-react'
import { useRef } from 'react'

interface MessagingComponentProps {
  doctor: any
  currentUser: any
  onCallInitiated?: (callData: any) => void
}

const MessagingComponent: React.FC<MessagingComponentProps> = ({ doctor, currentUser, onCallInitiated }) => {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [initiatingCall, setInitiatingCall] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchOrCreateConversation()
  }, [doctor, currentUser])

  useEffect(() => {
    if (!conversationId) return

    const subscription = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('Real-time message received:', payload)
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new as any])
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    const pollInterval = setInterval(() => {
      fetchMessages(conversationId)
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearInterval(pollInterval)
    }
  }, [conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchOrCreateConversation = async () => {
    try {
      setLoading(true)
      
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('patient_id', currentUser.id)
        .eq('doctor_id', doctor.id)
        .single()

      let conversationId: number

      if (existingConversation) {
        conversationId = existingConversation.id
      } else {
        const { data: newConversation } = await supabase
          .from('conversations')
          .insert([{
            patient_id: currentUser.id,
            doctor_id: doctor.id,
            created_at: new Date().toISOString()
          }])
          .select()
          .single()

        conversationId = newConversation?.id || 0
      }

      setConversationId(conversationId)
      await fetchMessages(conversationId)
    } catch (error) {
      console.error('Error fetching/creating conversation:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (convId: number) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(full_name),
          attachments:message_attachments(*)
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })

      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return
    if (!conversationId) return

    setSending(true)
    try {
      const messageType = selectedFile ? 'mixed' : 'text'
      
      const { data: messageData } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_id: currentUser.id,
          body: newMessage || null,
          message_type: messageType,
          created_at: new Date().toISOString()
        }])
        .select(`
          *,
          sender:profiles!sender_id(full_name),
          attachments:message_attachments(*)
        `)
        .single()

      if (messageData && selectedFile) {
        const fileName = `${Date.now()}_${selectedFile.name}`
        const filePath = `conversations/${conversationId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('message-files')
          .upload(filePath, selectedFile)

        if (!uploadError) {
          await supabase
            .from('message_attachments')
            .insert([{
              message_id: messageData.id,
              bucket: 'message-files',
              object_path: filePath,
              file_name: selectedFile.name,
              mime_type: selectedFile.type,
              file_size: selectedFile.size
            }])
        }
      }

      if (messageData) {
        setMessages([...messages, messageData])
        setNewMessage('')
        setSelectedFile(null)
      }

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleDownloadFile = async (attachment: any) => {
    try {
      const { data } = await supabase.storage
        .from('message-files')
        .download(attachment.object_path)

      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.file_name
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }

  const handleInitiateCall = async () => {
    if (!conversationId || !currentUser?.id) return

    setInitiatingCall(true)
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${backendUrl}/api/video/initiate-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          initiated_by: currentUser.id
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend error:', errorText)
        alert('Failed to start call: ' + (errorText || response.statusText))
        return
      }

      const data = await response.json()
      if (data.success && onCallInitiated) {
        onCallInitiated({
          id: data.call_id,
          room_url: data.room_url,
          room_name: data.room_name,
          token: data.token
        })
      } else {
        alert('Failed to initiate call: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error initiating call:', error)
      alert('Error starting call: ' + error)
    } finally {
      setInitiatingCall(false)
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[600px]">
      <div className="border-b border-white/5 p-4 flex items-center justify-between">
        <h3 className="font-black text-white">Doctor Chat</h3>
        <button
          onClick={handleInitiateCall}
          disabled={initiatingCall}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800/50 text-white font-black px-4 py-2 rounded-lg transition-all text-xs uppercase tracking-widest"
        >
          {initiatingCall ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Phone className="w-4 h-4" />
          )}
          Call
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-xl ${
                  msg.sender_id === currentUser.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-100'
                }`}
              >
                <p className="text-xs font-semibold opacity-75 mb-1">
                  {msg.sender?.full_name || 'Unknown'}
                </p>
                {msg.body && <p className="text-sm break-words">{msg.body}</p>}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.attachments.map((att: any) => (
                      <button
                        key={att.id}
                        onClick={() => handleDownloadFile(att)}
                        className="flex items-center gap-2 p-2 bg-black/20 rounded hover:bg-black/30 transition w-full text-left"
                      >
                        <Download className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs truncate">{att.file_name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs opacity-50 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-white/5 p-4 space-y-2">
        {selectedFile && (
          <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
            <Paperclip className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-300 flex-1 truncate">{selectedFile.name}</span>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="p-1 hover:bg-white/10 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={sending || (!newMessage.trim() && !selectedFile)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 text-white font-black px-6 py-2.5 rounded-xl transition-all shadow-xl shadow-blue-900/20 active:scale-95 text-xs uppercase tracking-widest"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default MessagingComponent
