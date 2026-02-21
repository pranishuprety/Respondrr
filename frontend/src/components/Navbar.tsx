import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from './Logo'
import { LogOut, User, Activity, Users, LayoutDashboard, Bell, MessageSquare } from 'lucide-react'

interface NavbarProps {
  role: 'patient' | 'respondr' | 'doctor'
}

const Navbar: React.FC<NavbarProps> = ({ role }) => {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const patientLinks = [
    { name: 'Dashboard', path: '/patient-dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Vitals', path: '/vitals', icon: <Activity className="w-5 h-5 text-red-500" /> },
    { name: 'Doctor', path: '/doctor', icon: <Users className="w-5 h-5" /> },
    { name: 'Account', path: '/account', icon: <User className="w-5 h-5 text-blue-400" /> },
  ]

  const doctorLinks = [
    { name: 'Dashboard', path: '/doctor-dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Recent Alerts', path: '/alerts', icon: <Bell className="w-5 h-5 text-orange-500" /> },
    { name: 'Messages', path: '/doctor-messages', icon: <MessageSquare className="w-5 h-5 text-green-500" /> },
    { name: 'Account', path: '/account', icon: <User className="w-5 h-5 text-blue-400" /> },
  ]

  const links = role === 'patient' ? patientLinks : doctorLinks

  return (
    <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-white/5 px-6 py-1 shadow-2xl fixed top-0 left-0 right-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left Side: Logo */}
        <div className="flex items-center -ml-8">
          <Link to={role === 'patient' ? '/patient-dashboard' : '/doctor-dashboard'}>
            <Logo size={100} className="scale-75 origin-left" />
          </Link>
        </div>

        {/* Right Side: Links & User Action */}
        <div className="flex items-center space-x-8">
          <div className="hidden lg:flex items-center space-x-6">
            {links.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-all text-[11px] uppercase tracking-widest hover:scale-105 active:scale-95"
              >
                {link.icon}
                {link.name}
              </Link>
            ))}
          </div>

          <div className="h-6 w-px bg-white/10 hidden lg:block"></div>

          <div className="flex items-center space-x-4">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-blue-500 shadow-xl shadow-blue-900/20 active:scale-95"
            >
              <LogOut className="w-3 h-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
