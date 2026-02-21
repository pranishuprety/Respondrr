import React, { useEffect, useState } from 'react'
import Navbar from './Navbar'
import { supabase } from '../lib/supabase'
import { User, Phone, MapPin, Globe, CreditCard, Award, Save, Loader2 } from 'lucide-react'

const AccountPage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<'patient' | 'doctor'>('patient')
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    address: '',
    country: '',
    license_number: '',
    certification: '',
    role: ''
  })

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (data) {
          setProfile(data)
          setRole(data.role === 'patient' ? 'patient' : 'doctor')
        }
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address,
          country: profile.country,
          license_number: profile.license_number,
          certification: profile.certification
        })
        .eq('id', user.id)
      
      if (error) alert(error.message)
      else alert('Profile updated successfully!')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar role={role} />
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
      </div>

      <main className="max-w-3xl mx-auto pt-32 px-6 pb-12 relative z-10">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <h1 className="text-2xl font-black tracking-tight">Account Settings</h1>
            <p className="text-blue-100 mt-1 font-medium text-xs">Manage your personal information and credentials.</p>
          </div>

          <form onSubmit={handleUpdate} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-black flex items-center gap-2 text-blue-400 uppercase tracking-widest">
                  <User className="w-4 h-4" /> Basic Profile
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
                    <input
                      type="text"
                      value={profile.full_name || ''}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={profile.phone || ''}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-sm font-black flex items-center gap-2 text-blue-400 uppercase tracking-widest">
                  <MapPin className="w-4 h-4" /> Location Details
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Address</label>
                    <input
                      type="text"
                      value={profile.address || ''}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Country</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={profile.country || ''}
                        onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Info (only for doctors) */}
            {role === 'doctor' && (
              <div className="pt-6 border-t border-white/5 space-y-4">
                <h3 className="text-sm font-black flex items-center gap-2 text-blue-400 uppercase tracking-widest">
                  <Award className="w-4 h-4" /> Professional Credentials
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Medical License Number</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={profile.license_number || ''}
                        onChange={(e) => setProfile({ ...profile, license_number: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Certification</label>
                    <input
                      type="text"
                      value={profile.certification || ''}
                      onChange={(e) => setProfile({ ...profile, certification: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-6 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 text-white font-black px-8 py-3 rounded-xl transition-all shadow-xl shadow-blue-900/20 active:scale-95 text-xs uppercase tracking-widest"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        )}
      </main>
    </div>
  )
}

export default AccountPage
