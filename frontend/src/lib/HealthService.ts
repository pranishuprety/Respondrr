import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const syncHealthData = async (metrics: any[]) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { success: false, message: 'No session' }

    const response = await fetch(`${API_BASE_URL}/api/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        data: {
          metrics: metrics
        }
      })
    })

    return await response.json()
  } catch (error: any) {
    console.error('Health sync failed:', error)
    return { success: false, message: error.message }
  }
}
