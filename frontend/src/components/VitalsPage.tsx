import React, { useEffect, useState } from 'react'
import Navbar from './Navbar'
import LoadingPage from './LoadingPage'
import { supabase } from '../lib/supabase'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts'
import { 
  Heart, Wind, Droplets, Brain, Activity, 
  TrendingUp, Calendar, Clock, ChevronRight, Sun
} from 'lucide-react'

const VitalsPage = () => {
  const [loading, setLoading] = useState(true)
  const [vitals, setVitals] = useState<any>(null)
  const [selectedMetric, setSelectedMetric] = useState('heart_rate')
  const [trendData, setTrendData] = useState<any[]>([])
  const [timeRange, setTimeRange] = useState(7)

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const vitalsRes = await fetch(`${API_BASE_URL}/api/dashboard/vitals`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (vitalsRes.ok) setVitals(await vitalsRes.json())

      const trendsRes = await fetch(`${API_BASE_URL}/api/dashboard/trends?metric=${selectedMetric}&days=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (trendsRes.ok) {
        const data = await trendsRes.json()
        setTrendData(data.map((d: any) => ({
          time: timeRange === 1 
            ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date(d.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          value: d.value
        })))
      }
    } catch (e) {
      console.error('Failed to fetch vitals data', e)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }
    init()
  }, [selectedMetric, timeRange])

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar role="patient" />
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px]" />
      </div>

      <main className="max-w-7xl mx-auto pt-32 px-6 pb-12 relative z-10">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
              Clinical Telemetry
            </span>
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-4">
            Biometric <span className="text-blue-500">Analysis</span>
          </h1>
          <p className="text-slate-400 max-w-2xl font-medium leading-relaxed">
            Detailed breakdown of your physiological markers. Data is synchronized from your wearable devices and analyzed for clinical significant patterns.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Metrics Selector & Details */}
          <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            <MetricSelector 
              label="Heart Rate" 
              value={vitals?.heart_rate?.value} 
              unit="BPM" 
              icon={<Heart className="w-5 h-5" />} 
              isActive={selectedMetric === 'heart_rate'}
              onClick={() => setSelectedMetric('heart_rate')}
              color="red"
            />
            <MetricSelector 
              label="SpO2 Level" 
              value={vitals?.blood_oxygen_saturation?.value} 
              unit="%" 
              icon={<Droplets className="w-5 h-5" />} 
              isActive={selectedMetric === 'blood_oxygen_saturation'}
              onClick={() => setSelectedMetric('blood_oxygen_saturation')}
              color="emerald"
            />
            <MetricSelector 
              label="HR Variability" 
              value={vitals?.heart_rate_variability?.value} 
              unit="ms" 
              icon={<Brain className="w-5 h-5" />} 
              isActive={selectedMetric === 'heart_rate_variability'}
              onClick={() => setSelectedMetric('heart_rate_variability')}
              color="purple"
            />
            <MetricSelector 
              label="Respiratory" 
              value={vitals?.respiratory_rate?.value} 
              unit="/min" 
              icon={<Wind className="w-5 h-5" />} 
              isActive={selectedMetric === 'respiratory_rate'}
              onClick={() => setSelectedMetric('respiratory_rate')}
              color="blue"
            />
            <MetricSelector 
              label="Step Count" 
              value={vitals?.step_count?.value} 
              unit="steps" 
              icon={<Activity className="w-5 h-5" />} 
              isActive={selectedMetric === 'step_count'}
              onClick={() => setSelectedMetric('step_count')}
              color="orange"
            />
            <MetricSelector 
              label="Active Energy" 
              value={vitals?.active_energy?.value} 
              unit="kcal" 
              icon={<Activity className="w-5 h-5" />} 
              isActive={selectedMetric === 'active_energy'}
              onClick={() => setSelectedMetric('active_energy')}
              color="amber"
            />
            <MetricSelector 
              label="Exercise Time" 
              value={vitals?.apple_exercise_time?.value} 
              unit="min" 
              icon={<TrendingUp className="w-5 h-5" />} 
              isActive={selectedMetric === 'apple_exercise_time'}
              onClick={() => setSelectedMetric('apple_exercise_time')}
              color="indigo"
            />
          </div>

          {/* Right: Detailed Chart */}
          <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8 flex flex-col">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h3 className="text-2xl font-black tracking-tight mb-1 capitalize">
                  {selectedMetric.replace(/_/g, ' ')} <span className="text-blue-500">History</span>
                </h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Trend Analysis</p>
              </div>
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                <button 
                  onClick={() => setTimeRange(1)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  24H
                </button>
                <button 
                  onClick={() => setTimeRange(7)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === 7 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  7D
                </button>
                <button 
                  onClick={() => setTimeRange(30)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === 30 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  30D
                </button>
              </div>
            </div>

            <div className="flex-grow min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#475569" 
                    fontSize={10} 
                    fontWeight="bold" 
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10} 
                    fontWeight="bold" 
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
           <SecondaryVital 
            label="Resting Heart Rate" 
            value={vitals?.resting_heart_rate?.value} 
            unit="BPM" 
            icon={<Heart className="w-4 h-4 text-red-500" />}
           />
           <SecondaryVital 
            label="Wrist Temperature" 
            value={vitals?.apple_sleeping_wrist_temperature?.value} 
            unit="°C" 
            icon={<Thermometer className="w-4 h-4 text-blue-400" />}
           />
           <SecondaryVital 
            label="Basal Energy" 
            value={vitals?.basal_energy_burned?.value} 
            unit="kcal" 
            icon={<Activity className="w-4 h-4 text-amber-500" />}
           />
           <SecondaryVital 
            label="Daylight Exposure" 
            value={vitals?.time_in_daylight?.value} 
            unit="min" 
            icon={<Sun className="w-4 h-4 text-yellow-500" />}
           />
           <SecondaryVital 
            label="Stand Time" 
            value={vitals?.apple_stand_time?.value} 
            unit="min" 
            icon={<Activity className="w-4 h-4 text-emerald-500" />}
           />
           <SecondaryVital 
            label="Audio Exposure" 
            value={vitals?.headphone_audio_exposure?.value} 
            unit="dB" 
            icon={<Wind className="w-4 h-4 text-purple-500" />}
           />
        </div>
      </main>
    </div>
  )
}

const MetricSelector = ({ label, value, unit, icon, isActive, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className={`w-full p-6 rounded-[2rem] border transition-all flex items-center justify-between group ${
      isActive 
      ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-600/20' 
      : 'bg-slate-900/50 backdrop-blur-xl border-white/5 hover:border-white/10'
    }`}
  >
    <div className="flex items-center gap-4">
      <div className={`p-4 rounded-2xl ${isActive ? 'bg-white/20' : `bg-${color}-500/10 text-${color}-500`}`}>
        {icon}
      </div>
      <div className="text-left">
        <span className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black tabular-nums">
            {value !== undefined && value !== null 
              ? (value < 1 && value > 0 ? value.toFixed(2) : Math.round(value)) 
              : '--'}
          </span>
          <span className={`text-[10px] font-black ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>{unit}</span>
        </div>
      </div>
    </div>
    <ChevronRight className={`w-5 h-5 transition-transform ${isActive ? 'text-white translate-x-1' : 'text-slate-700'}`} />
  </button>
)

const SecondaryVital = ({ label, value, unit, icon }: any) => (
  <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
    <div className="flex items-center gap-3 text-slate-500 mb-6">
      <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-black text-white">
        {value !== undefined && value !== null ? (typeof value === 'number' ? value.toFixed(1) : value) : '--'}
      </span>
      <span className="text-xs font-black text-slate-500 uppercase">{unit}</span>
    </div>
  </div>
)

const Thermometer = ({ className }: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
  </svg>
)

export default VitalsPage
