import React, { useState } from 'react'
import { Shield, Mail, Lock, Heart, Activity, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Logo from './Logo'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRespondrPortal, setIsRespondrPortal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (profileError) throw profileError

        const userRole = profile.role.toLowerCase()
        
        if (isRespondrPortal) {
          if (userRole !== 'doctor') {
            await supabase.auth.signOut()
            throw new Error(`This account is registered as a ${userRole}. Please use the Patient portal.`)
          }
          navigate('/doctor-dashboard')
        } else {
          if (userRole !== 'patient') {
            await supabase.auth.signOut()
            throw new Error(`This account is registered as a ${userRole}. Please use the Doctor portal.`)
          }
          navigate('/patient-dashboard')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8 flex justify-center">
          <Logo size={200} />
        </div>

        <div className="bg-slate-900/50 backdrop-blur-2xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
          <div className="flex border-b border-white/10 p-1.5">
            <button
              type="button"
              onClick={() => setIsRespondrPortal(false)}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all ${
                !isRespondrPortal ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              Patient Console
            </button>
            <button
              type="button"
              onClick={() => setIsRespondrPortal(true)}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all ${
                isRespondrPortal ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              Doctor Portal
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2">{isRespondrPortal ? 'Doctor Email' : 'Patient Email'}</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm placeholder:text-slate-800"
                    placeholder={isRespondrPortal ? "doctor@example.com" : "patient@example.com"}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm placeholder:text-slate-800"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-4 h-4 border-2 border-slate-700 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all"></div>
                  <svg className="absolute top-0.5 left-0.5 w-3 h-3 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Maintain Session</span>
              </label>
              <button type="button" className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest">Reset Key</button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
                loading ? 'opacity-50 cursor-not-allowed bg-slate-800' :
                isRespondrPortal ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Initialize Session</span>
              )}
            </button>
          </form>

          <div className="p-8 text-center border-t border-white/10 bg-white/5 backdrop-blur-xl">
            <p className="text-slate-400 font-medium text-sm">
              {isRespondrPortal ? 'New doctor?' : 'New patient?'}{' '}
              <button 
                onClick={() => navigate('/register')}
                className="font-black text-blue-500 hover:text-blue-400 underline decoration-blue-500/30 underline-offset-8"
              >
                Create Account
              </button>
            </p>
          </div>
        </div>

        {/* Support info */}
        <div className="mt-8 flex items-center justify-center space-x-8 text-slate-600">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Encrypted</span>
          </div>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Real-time Pulse</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
