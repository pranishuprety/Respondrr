import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../lib/supabase'
import { BarChart3, Download, Loader2, Calendar, Sparkles } from 'lucide-react'

interface PatientInfo {
  id: string
  full_name: string
  email: string
}

interface MetricsData {
  realtime: string[]
  aggregated: string[]
}

interface HealthDataPoint {
  metric_name: string
  timestamp: string
  value: number | string
  source?: string
  units?: string
}

interface MetricSummary {
  count: number
  average?: number
  min?: number
  max?: number
  total?: number
}

interface ReportData {
  patient: PatientInfo
  start_date: string
  end_date: string
  realtime_data: Record<string, HealthDataPoint[]>
  aggregated_data: Record<string, HealthDataPoint[]>
}

interface SummaryData {
  patient: PatientInfo
  period: string
  metrics_summary: Record<string, MetricSummary>
}

const DoctorReportsPage = () => {
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<PatientInfo[]>([])
  const [metrics, setMetrics] = useState<MetricsData>({ realtime: [], aggregated: [] })
  const [reportLoading, setReportLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  
  const [selectedPatient, setSelectedPatient] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)

  useEffect(() => {
    fetchInitialData()
    setDefaultDates()
  }, [])

  const setDefaultDates = () => {
    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    setEndDate(today.toISOString().split('T')[0])
    setStartDate(sevenDaysAgo.toISOString().split('T')[0])
  }

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      const [patientsRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reports/patients`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch(`${API_BASE_URL}/api/reports/metrics`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ])

      if (patientsRes.ok) {
        const data = await patientsRes.json()
        console.log('[REPORTS] Patients data:', data)
        setPatients(data.patients || [])
        if (data.patients && data.patients.length > 0) {
          setSelectedPatient(data.patients[0].id)
        }
      } else {
        const error = await patientsRes.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[REPORTS] Failed to fetch patients:', patientsRes.status, error)
      }

      if (metricsRes.ok) {
        const data = await metricsRes.json()
        console.log('[REPORTS] Metrics data:', data)
        setMetrics(data)
        setSelectedMetrics([...data.realtime, ...data.aggregated])
      } else {
        const error = await metricsRes.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[REPORTS] Failed to fetch metrics:', metricsRes.status, error)
      }
    } catch (e) {
      console.error('[REPORTS] Failed to fetch initial data', e)
    } finally {
      setLoading(false)
    }
  }

  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    )
  }

  const handleSelectAllMetrics = () => {
    const allMetrics = [...metrics.realtime, ...metrics.aggregated]
    setSelectedMetrics(allMetrics)
  }

  const handleClearMetrics = () => {
    setSelectedMetrics([])
  }

  const fetchReportData = async () => {
    if (!selectedPatient || !startDate || !endDate) {
      alert('Please select patient and date range')
      return
    }

    try {
      setReportLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      const metricsQuery = selectedMetrics.map(m => `metrics=${encodeURIComponent(m)}`).join('&')
      
      const [dataRes, summaryRes] = await Promise.all([
        fetch(
          `${API_BASE_URL}/api/reports/data?patient_id=${selectedPatient}&start_date=${startDate}&end_date=${endDate}&${metricsQuery}`,
          { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        ),
        fetch(
          `${API_BASE_URL}/api/reports/summary?patient_id=${selectedPatient}&start_date=${startDate}&end_date=${endDate}`,
          { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        )
      ])

      if (dataRes.ok) {
        const data = await dataRes.json()
        setReportData(data)
      } else {
        console.error('Failed to fetch report data')
      }

      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setSummaryData(data)
      }
    } catch (e) {
      console.error('Failed to fetch report data', e)
    } finally {
      setReportLoading(false)
    }
  }

  const fetchAIAnalysis = async () => {
    if (!selectedPatient || !startDate || !endDate) {
      alert('Please generate a report first')
      return
    }

    try {
      setAiLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      const response = await fetch(
        `${API_BASE_URL}/api/reports/ai-analysis?patient_id=${selectedPatient}&start_date=${startDate}&end_date=${endDate}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )

      if (response.ok) {
        const data = await response.json()
        setAiAnalysis(data.analysis)
      } else {
        console.error('Failed to fetch AI analysis')
        alert('Failed to generate AI analysis')
      }
    } catch (e) {
      console.error('Failed to fetch AI analysis', e)
      alert('Error generating AI analysis')
    } finally {
      setAiLoading(false)
    }
  }

  const downloadCSV = () => {
    if (!summaryData || !reportData) {
      alert('No report data to download')
      return
    }

    let csvContent = 'data:text/csv;charset=utf-8,'

    csvContent += `Patient Name,${summaryData.patient.full_name}\n`
    csvContent += `Report Period,${summaryData.period}\n\n`

    csvContent += 'METRICS SUMMARY\n'
    csvContent += 'Metric Name,Count,Average,Min,Max,Total\n'
    
    Object.entries(summaryData.metrics_summary).forEach(([metricName, summary]) => {
      const row = [
        metricName,
        summary.count || '',
        summary.average?.toFixed(2) || '',
        summary.min?.toFixed(2) || '',
        summary.max?.toFixed(2) || '',
        summary.total?.toFixed(2) || ''
      ]
      csvContent += row.join(',') + '\n'
    })

    csvContent += '\n\nDETAILED REALTIME DATA\n'
    Object.entries(reportData.realtime_data).forEach(([metricName, data]) => {
      csvContent += `\n${metricName}\n`
      csvContent += 'Timestamp,Value,Source\n'
      data.forEach((row: HealthDataPoint) => {
        const timestamp = new Date(row.timestamp).toLocaleString()
        csvContent += `"${timestamp}",${row.value},"${row.source || 'N/A'}"\n`
      })
    })

    csvContent += '\n\nDETAILED AGGREGATED DATA\n'
    Object.entries(reportData.aggregated_data).forEach(([metricName, data]) => {
      csvContent += `\n${metricName}\n`
      csvContent += 'Timestamp,Value,Units\n'
      data.forEach((row: HealthDataPoint) => {
        const timestamp = new Date(row.timestamp).toLocaleString()
        csvContent += `"${timestamp}",${row.value},"${row.units || 'N/A'}"\n`
      })
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `health_report_${summaryData.patient.full_name}_${summaryData.period.replace(/\s/g, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

      <main className="max-w-6xl mx-auto pt-32 px-6 pb-12 relative z-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <h1 className="text-3xl font-black tracking-tight">Health Reports</h1>
          </div>
          <p className="text-slate-400 font-medium">Generate comprehensive health reports for your patients</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6">
            <label className="block text-sm font-bold text-slate-300 mb-2">Select Patient</label>
            {patients.length === 0 ? (
              <div className="bg-slate-700/30 border border-orange-500/30 rounded-lg px-4 py-3 text-orange-300 text-sm">
                No patients connected. Visit the dashboard to add patient connections.
              </div>
            ) : (
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Choose a patient...</option>
                {patients.map(patient => (
                  <option key={patient.id} value={patient.id}>
                    {patient.full_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6">
            <label className="block text-sm font-bold text-slate-300 mb-2">Start Date</label>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6">
            <label className="block text-sm font-bold text-slate-300 mb-2">End Date</label>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={fetchReportData}
            disabled={reportLoading || !selectedPatient}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 text-white font-black px-6 py-2 rounded-xl transition-all shadow-xl shadow-blue-900/20 active:scale-95 h-fit flex items-center justify-center gap-2"
          >
            {reportLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Generate Report</>
            )}
          </button>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6 mb-8">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white">Select Metrics</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAllMetrics}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg transition-all"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearMetrics}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg transition-all"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-blue-400 mb-3">Realtime Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {metrics.realtime.map(metric => (
                  <label key={metric} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric)}
                      onChange={() => handleMetricToggle(metric)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-slate-300 capitalize">{metric.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-purple-400 mb-3">Aggregated Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {metrics.aggregated.map(metric => (
                  <label key={metric} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric)}
                      onChange={() => handleMetricToggle(metric)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-slate-300 capitalize">{metric.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {summaryData && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-white mb-1">{summaryData.patient.full_name}</h2>
                  <p className="text-slate-400 text-sm">Report for {summaryData.period}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={downloadCSV}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black px-6 py-3 rounded-xl transition-all shadow-xl shadow-green-900/20 active:scale-95 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV
                  </button>
                  <button
                    onClick={fetchAIAnalysis}
                    disabled={aiLoading}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 text-white font-black px-6 py-3 rounded-xl transition-all shadow-xl shadow-purple-900/20 active:scale-95 text-sm"
                  >
                    {aiLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    AI Analysis
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(summaryData.metrics_summary).map(([metricName, summary]: [string, MetricSummary]) => (
                  <div key={metricName} className="bg-slate-700/30 rounded-xl p-4 border border-slate-600">
                    <h4 className="text-sm font-bold text-slate-300 capitalize mb-3">
                      {metricName.replace(/_/g, ' ')}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Count:</span>
                        <span className="text-white font-semibold">{summary.count || 0}</span>
                      </div>
                      {summary.average !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Average:</span>
                          <span className="text-white font-semibold">{summary.average?.toFixed(2) || 'N/A'}</span>
                        </div>
                      )}
                      {summary.min !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Min:</span>
                          <span className="text-white font-semibold">{summary.min?.toFixed(2) || 'N/A'}</span>
                        </div>
                      )}
                      {summary.max !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Max:</span>
                          <span className="text-white font-semibold">{summary.max?.toFixed(2) || 'N/A'}</span>
                        </div>
                      )}
                      {summary.total !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Total:</span>
                          <span className="text-white font-semibold">{summary.total?.toFixed(2) || 'N/A'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {reportData && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-6">
                <h3 className="text-xl font-black text-white mb-4">Detailed Data</h3>
                
                {Object.keys(reportData.realtime_data).length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-lg font-bold text-blue-400 mb-4">Realtime Metrics</h4>
                    <div className="space-y-4">
                      {Object.entries(reportData.realtime_data).map(([metricName, data]: [string, HealthDataPoint[]]) => (
                        <div key={metricName} className="border border-slate-600 rounded-lg p-4">
                          <h5 className="font-bold text-white mb-3 capitalize">{metricName.replace(/_/g, ' ')}</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-600">
                                  <th className="text-left px-4 py-2 text-slate-400">Timestamp</th>
                                  <th className="text-left px-4 py-2 text-slate-400">Value</th>
                                  <th className="text-left px-4 py-2 text-slate-400">Source</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.slice(0, 10).map((row: HealthDataPoint, idx: number) => (
                                  <tr key={idx} className="border-b border-slate-700">
                                    <td className="px-4 py-2 text-slate-300">
                                      {new Date(row.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-white font-semibold">{row.value}</td>
                                    <td className="px-4 py-2 text-slate-400">{row.source || 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {data.length > 10 && (
                            <p className="text-slate-400 text-xs mt-2">Showing 10 of {data.length} records</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(reportData.aggregated_data).length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-purple-400 mb-4">Aggregated Metrics</h4>
                    <div className="space-y-4">
                      {Object.entries(reportData.aggregated_data).map(([metricName, data]: [string, HealthDataPoint[]]) => (
                        <div key={metricName} className="border border-slate-600 rounded-lg p-4">
                          <h5 className="font-bold text-white mb-3 capitalize">{metricName.replace(/_/g, ' ')}</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-600">
                                  <th className="text-left px-4 py-2 text-slate-400">Timestamp</th>
                                  <th className="text-left px-4 py-2 text-slate-400">Value</th>
                                  <th className="text-left px-4 py-2 text-slate-400">Units</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.slice(0, 10).map((row: HealthDataPoint, idx: number) => (
                                  <tr key={idx} className="border-b border-slate-700">
                                    <td className="px-4 py-2 text-slate-300">
                                      {new Date(row.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-white font-semibold">{row.value}</td>
                                    <td className="px-4 py-2 text-slate-400">{row.units || 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {data.length > 10 && (
                            <p className="text-slate-400 text-xs mt-2">Showing 10 of {data.length} records</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {aiAnalysis && (
              <div className="bg-gradient-to-br from-purple-900/30 to-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-purple-500/20 overflow-hidden shadow-2xl shadow-purple-900/20 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-purple-500/20">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">AI-Powered Health Analysis</h3>
                    <p className="text-xs text-purple-300 mt-1">Medical insights generated by OpenAI</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {aiAnalysis.split('\n\n').map((paragraph, idx) => {
                    const lines = paragraph.split('\n').filter(line => line.trim())
                    
                    return (
                      <div key={idx} className="space-y-2">
                        {lines.map((line, lineIdx) => {
                          const isBold = line.match(/^\d+\.|^[A-Z].*:$|^(Summary|Pattern|Recommendation|Concern|Note|Important)/)
                          
                          return (
                            <div 
                              key={lineIdx}
                              className={`${
                                isBold 
                                  ? 'font-bold text-purple-200 text-base' 
                                  : 'text-slate-300 text-sm'
                              } leading-relaxed`}
                            >
                              {line.trim()}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-purple-500/20">
                  <p className="text-xs text-slate-400">
                    💡 This analysis is AI-generated and should be reviewed by healthcare professionals before clinical decisions.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!summaryData && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl p-12 text-center">
            <BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-black text-white mb-2">No Report Generated Yet</h3>
            <p className="text-slate-400 font-medium">Select a patient and click "Generate Report" to view health data</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default DoctorReportsPage
