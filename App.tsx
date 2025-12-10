import React, { useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import KioskMode from './components/KioskMode';
import { Event } from './types';
import { Lock, User } from 'lucide-react';

type ViewState = 'landing' | 'login' | 'admin' | 'kiosk';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('landing');
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'admin123') {
      setView('admin');
      setError('');
    } else {
      setError('Invalid Passcode');
    }
  };

  const launchKiosk = (event: Event) => {
    setActiveEvent(event);
    setView('kiosk');
  };

  const exitKiosk = () => {
    const code = prompt("Enter Admin Passcode to Exit Kiosk:");
    if (code === 'admin123') {
      setView('admin');
    } else {
      alert("Access Denied");
    }
  };

  // 1. KIOSK MODE
  if (view === 'kiosk' && activeEvent) {
    return <KioskMode event={activeEvent} onExit={exitKiosk} />;
  }

  // 2. ADMIN MODE
  if (view === 'admin') {
    return <AdminDashboard onLogout={() => setView('landing')} onLaunchKiosk={launchKiosk} />;
  }

  // 3. LOGIN MODE
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600/20 rounded-full text-blue-500">
              <Lock size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">Admin Access</h2>
          <p className="text-slate-400 text-center mb-8">Enter your secure dashboard passcode</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="password" 
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Passcode"
                className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors">
              Unlock Dashboard
            </button>
          </form>
          <button onClick={() => setView('landing')} className="w-full mt-4 text-slate-500 hover:text-slate-300 text-sm">Cancel</button>
        </div>
      </div>
    );
  }

  // 4. LANDING PAGE
  return (
    <div className="min-h-screen bg-slate-900 text-white relative overflow-hidden">
      {/* Navbar */}
      <nav className="relative z-10 flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="font-bold text-2xl tracking-tighter flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"></div>
          Lumina
        </div>
        <button 
          onClick={() => setView('login')}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm font-medium transition-colors"
        >
          <User size={16} /> Login
        </button>
      </nav>

      {/* Hero */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-20 lg:py-32 grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="inline-block px-4 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
            New: Enterprise SaaS Features 🚀
          </div>
          <h1 className="text-5xl lg:text-7xl font-display font-bold leading-tight">
            The Next Gen <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">AI Photo Booth</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-lg">
            Transform events with real-time generative AI. White-labeled, scalable, and built for agencies.
          </p>
          <div className="flex gap-4">
            <button onClick={() => setView('login')} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all">
              Get Started
            </button>
            <button className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold transition-all">
              View Demo
            </button>
          </div>
        </div>
        
        {/* Visual */}
        <div className="relative">
           <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 blur-3xl rounded-full"></div>
           <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-2 shadow-2xl rotate-3 transform hover:rotate-0 transition-transform duration-500">
             <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop" className="rounded-xl w-full" alt="App Preview" />
             <div className="absolute -bottom-6 -right-6 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl">
                <div className="text-xs text-slate-400 mb-1">AI Generated</div>
                <div className="font-bold">Cyberpunk Style</div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
