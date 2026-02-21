import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import LoadingPage from '../components/LoadingPage'
import { supabase } from '../lib/supabase'
import { 
  Activity, Heart, Footprints, 
  Zap, Sun, Wind, Droplets, TrendingUp, AlertTriangle
} from 'lucide-react'

const PatientDashboard = () => {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const summaryRes = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (summaryRes.ok) setSummary(await summaryRes.json())
    } catch (e) {
      console.error('Failed to fetch dashboard data', e)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profileData)
      }
      await fetchData()
      setLoading(false)
    }
    init()
  }, [])

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar role="patient" />
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
      </div>

      <main className="max-w-7xl mx-auto pt-32 px-6 pb-12 relative z-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">
              Dashboard <span className="text-blue-500">Systems</span>
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-sm font-bold uppercase tracking-widest">
                Patient: {profile?.full_name || 'Loading...'}
              </span>
              <div className="h-1 w-1 bg-slate-700 rounded-full" />
              <span className="text-emerald-500 text-sm font-bold uppercase tracking-widest flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Live Bio-Feed
              </span>
            </div>
          </div>
        </header>

        <OverviewTab summary={summary} />
      </main>
    </div>
  )
}

const OverviewTab = ({ summary }: any) => {
  const latest = summary?.latest || {}
  const today = summary?.today || {}

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPITile 
          icon={<Heart className="w-5 h-5 text-red-500" />} 
          label="Heart Rate" 
          value={Math.round(latest.heart_rate?.value || 0)} 
          unit="BPM" 
          subtext={`Avg Today: ${Math.round(today.avg_hr || 0)}`}
          color="red"
        />
        <KPITile 
          icon={<Wind className="w-5 h-5 text-blue-400" />} 
          label="Respiration" 
          value={Math.round(latest.respiratory_rate?.value || 0)} 
          unit="/min" 
          subtext={`Avg Today: ${Math.round(today.avg_rr || 0)}`}
          color="blue"
        />
        <KPITile 
          icon={<Footprints className="w-5 h-5 text-emerald-400" />} 
          label="Daily Steps" 
          value={today.steps?.toLocaleString() || 0} 
          unit="Steps" 
          subtext="Total Today"
          color="emerald"
        />
        <KPITile 
          icon={<Zap className="w-5 h-5 text-amber-400" />} 
          label="Active Energy" 
          value={today.active_energy || 0} 
          unit="kcal" 
          subtext="Total Burned"
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8">
            <h3 className="text-xl font-black mb-8 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Today Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SummaryMetric icon={<Sun className="w-4 h-4" />} label="Daylight" value={today.daylight_min} unit="min" />
              <SummaryMetric icon={<TrendingUp className="w-4 h-4" />} label="Exercise" value={today.exercise_min} unit="min" />
              <SummaryMetric icon={<Droplets className="w-4 h-4" />} label="SpO2" value={latest.blood_oxygen_saturation?.value || '--'} unit="%" />
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black italic">System Synchronization</h3>
            </div>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Your wearable sensors are transmitting encrypted bio-telemetry. Last hardware handshake successful. 
              All encryption keys are rotated and secure.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-900 rounded-[2.5rem] p-8 shadow-2xl shadow-red-900/20 relative overflow-hidden flex flex-col justify-between min-h-[400px]">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <AlertTriangle className="w-32 h-32 rotate-12" />
          </div>
          <div>
            <h3 className="text-3xl font-black mb-4 tracking-tighter leading-none">EMERGENCY<br/>PROTOCOL</h3>
            <p className="text-red-100/70 text-sm font-bold uppercase tracking-widest leading-relaxed">
              Instant bypass to rapid response medical coordination.
            </p>
          </div>
          <button className="w-full py-6 bg-white text-red-600 rounded-2xl font-black text-xl hover:scale-105 transition-all active:scale-95 shadow-2xl shadow-black/40">
            ACTIVATE SOS
          </button>
        </div>
      </div>
    </div>
  )
}

const KPITile = ({ icon, label, value, unit, subtext, color }: any) => (
  <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 hover:border-white/20 transition-all group">
    <div className="flex items-center gap-4 mb-8">
      <div className={`p-4 bg-${color}-500/10 rounded-2xl group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <span className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">{label}</span>
    </div>
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{value}</span>
      <span className="text-slate-500 font-black text-sm uppercase">{unit}</span>
    </div>
    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{subtext}</p>
  </div>
)

const SummaryMetric = ({ icon, label, value, unit }: any) => (
  <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
    <div className="flex items-center gap-2 text-slate-500 mb-4">
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-black text-white">{value || 0}</span>
      <span className="text-[10px] font-black text-slate-500 uppercase">{unit}</span>
    </div>
  </div>
)

export default PatientDashboard
