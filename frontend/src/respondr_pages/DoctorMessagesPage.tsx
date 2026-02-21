import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { Send, Loader2, Search, MessageSquare, Paperclip, Download, X, Phone } from 'lucide-react'
import { useRef } from 'react'
import VideoCallWidget from '../components/VideoCallWidget'
import VideoCallInterface from '../components/VideoCallInterface'

interface Conversation {
  id: number
  patient_id: string
  doctor_id: string
  created_at: string
  last_message_at?: string
  patient?: {
    full_name: string
    id: string
  }
}

interface Message {
  id: number
  conversation_id: number
  sender_id: string
  body: string
  message_type: string
  created_at: string
  sender?: {
    full_name: string
  }
}

interface User {
  id: string
  email?: string
}

const DoctorMessagesPage = () => {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [initiatingCall, setInitiatingCall] = useState(false)
  const [activeCall, setActiveCall] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const initFetch = async () => {
      await fetchConversations()
    }
    initFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedConversation) return

    const subscription = supabase
      .channel(`messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
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
      fetchMessages(selectedConversation.id)
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearInterval(pollInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUser(user)

      const { data } = await supabase
        .from('conversations')
        .select(`
          *,
          patient:profiles!patient_id(full_name, id)
        `)
        .eq('doctor_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      setConversations(data || [])
      if (data && data.length > 0) {
        setSelectedConversation(data[0])
        fetchMessages(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (conversationId: number) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(full_name),
          attachments:message_attachments(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return
    if (!selectedConversation || !currentUser) return

    setSending(true)
    try {
      const messageType = selectedFile ? 'mixed' : 'text'

      const { data: messageData } = await supabase
        .from('messages')
        .insert([{
          conversation_id: selectedConversation.id,
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
        const filePath = `conversations/${selectedConversation.id}/${fileName}`

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
        .eq('id', selectedConversation.id)
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
    if (!selectedConversation || !currentUser?.id) return

    setInitiatingCall(true)
    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${backendUrl}/api/video/initiate-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
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
      if (data.success) {
        setActiveCall({
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

  const handleCallEnded = () => {
    setActiveCall(null)
  }

  const filteredConversations = conversations.filter(conv =>
    conv.patient?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

      {selectedConversation && (
        <VideoCallWidget
          conversationId={selectedConversation.id}
          currentUserId={currentUser?.id || ''}
          onCallAccepted={(callData) => setActiveCall(callData)}
          onCallRejected={() => {}}
        />
      )}

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
      </div>

      <main className="max-w-7xl mx-auto pt-32 px-6 pb-12 relative z-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="w-6 h-6 text-blue-400" />
            <h1 className="text-3xl font-black tracking-tight">Messages</h1>
          </div>
          <p className="text-slate-400 font-medium">View and manage conversations with your patients</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
          <div className="lg:col-span-1 bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patients..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-center p-4">
                  <p>No conversations yet</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConversation(conv)
                      fetchMessages(conv.id)
                    }}
                    className={`w-full p-4 border-b border-white/5 text-left hover:bg-white/5 transition-all ${
                      selectedConversation?.id === conv.id ? 'bg-blue-600/20 border-blue-500/30' : ''
                    }`}
                  >
                    <p className="font-black text-white truncate">{conv.patient?.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {conv.last_message_at
                        ? new Date(conv.last_message_at).toLocaleDateString()
                        : 'No messages'}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-3 bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            {selectedConversation ? (
              <>
                <div className="border-b border-white/5 p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white">
                      {selectedConversation.patient?.full_name}
                    </h3>
                    <p className="text-slate-400 text-sm font-medium">Patient conversation</p>
                  </div>
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
                      <p>No messages yet. Start the conversation!</p>
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
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <p>Select a conversation to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default DoctorMessagesPage
