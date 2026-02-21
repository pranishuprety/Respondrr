import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Send, Loader2 } from 'lucide-react'

interface MessagingComponentProps {
  doctor: any
  currentUser: any
}

const MessagingComponent: React.FC<MessagingComponentProps> = ({ doctor, currentUser }) => {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchOrCreateConversation()
  }, [doctor, currentUser])

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
          sender:profiles!sender_id(full_name)
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
    if (!newMessage.trim() || !conversationId) return

    setSending(true)
    try {
      const { data } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_id: currentUser.id,
          body: newMessage,
          message_type: 'text',
          created_at: new Date().toISOString()
        }])
        .select(`
          *,
          sender:profiles!sender_id(full_name)
        `)

      if (data) {
        setMessages([...messages, data[0]])
        setNewMessage('')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[600px]">
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
                <p className="text-sm break-words">{msg.body}</p>
                <p className="text-xs opacity-50 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-white/5 p-4 flex gap-3">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 text-white font-black px-6 py-2.5 rounded-xl transition-all shadow-xl shadow-blue-900/20 active:scale-95 text-xs uppercase tracking-widest"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  )
}

export default MessagingComponent
