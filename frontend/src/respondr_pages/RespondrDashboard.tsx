import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { Activity, Shield, Users, Clock, ArrowRight, AlertTriangle, Radio } from 'lucide-react'

const RespondrDashboard = () => {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(data)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  if (loading) return null

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar role="respondr" />
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
      </div>

      <main className="max-w-7xl mx-auto pt-32 px-6 pb-12 relative z-10">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-xl ${
                profile?.role === 'doctor' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {profile?.role || 'Respondr'} Network Active
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight">
              Welcome back, <br />
              <span className="text-blue-500">{profile?.role === 'doctor' ? 'Dr.' : ''} {profile?.full_name?.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 text-right min-w-[250px]">
            <p className="text-slate-500 font-black mb-2 uppercase tracking-[0.2em] text-[10px]">Network Status</p>
            <div className="flex items-center gap-3 justify-end">
              <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
              <span className="text-emerald-500 font-black text-lg uppercase tracking-tighter italic">Ready For Dispatch</span>
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
              <span className="text-4xl font-black text-white tabular-nums">12</span>
              <span className="text-slate-500 font-black text-sm uppercase tracking-widest">Patients</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 hover:border-blue-500/30 transition-all group">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <span className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Response</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">4</span>
              <span className="text-slate-500 font-black text-sm uppercase tracking-widest">Mins</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 hover:border-blue-500/30 transition-all group">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-emerald-500" />
              </div>
              <span className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Active</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">3</span>
              <span className="text-slate-500 font-black text-sm uppercase tracking-widest">Cases</span>
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
              <span className="text-lg font-black text-white tracking-tighter mb-0.5">{profile?.license_number || profile?.certification}</span>
              <span className="text-emerald-500 font-black uppercase tracking-widest text-[8px]">Active & Verified</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900/30 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black tracking-tight leading-none">Active Patient Monitoring</h3>
              <button className="text-blue-500 font-black uppercase tracking-widest text-[10px] hover:underline">Full Access</button>
            </div>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-6 p-6 rounded-3xl bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group">
                  <div className="h-16 w-16 bg-slate-800 rounded-2xl flex items-center justify-center font-black text-white text-xl group-hover:bg-blue-600 transition-all">
                    {['JD', 'MS', 'AB'][i-1]}
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-black text-white text-xl tracking-tight mb-1">{['John Doe', 'Maria Santos', 'Alice Baker'][i-1]}</h4>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Last Check-in • {i * 2} mins ago</p>
                  </div>
                  <div className="flex gap-6 items-center">
                    <div className="text-right">
                      <span className="block font-black text-red-500 text-3xl tracking-tighter tabular-nums">{110 + i * 5} <span className="text-[10px] uppercase align-middle ml-1 text-slate-500">BPM</span></span>
                    </div>
                    <button className="p-4 bg-slate-800 rounded-2xl text-white hover:bg-blue-600 transition-all active:scale-95 shadow-xl">
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-125 transition-transform">
                <AlertTriangle className="w-20 h-20 rotate-12" />
              </div>
              <div className="relative">
                <h3 className="text-3xl font-black mb-4 tracking-tight leading-none">New Dispatch</h3>
                <p className="text-blue-100 text-sm font-medium leading-relaxed mb-8">Level 2 Emergency detected in Zone A. Immediate response required.</p>
                <button className="w-full py-5 bg-white text-blue-900 rounded-2xl font-black text-xl hover:scale-105 transition-all active:scale-95 shadow-xl shadow-black/20">
                  RESPOND NOW
                </button>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Scheduled</h3>
                <button className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <Clock className="w-4 h-4 text-blue-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                  <p className="font-black text-lg text-white mb-1">Team Briefing</p>
                  <p className="text-blue-400 font-bold text-xs uppercase tracking-widest">14:00 • Surgical Wing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default RespondrDashboard
