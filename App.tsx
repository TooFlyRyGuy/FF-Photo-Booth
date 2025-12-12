import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import KioskMode from './components/KioskMode';
import Login from './components/Login';
import Signup from './components/Signup';
import { Event } from './types';
import { Check, ArrowRight, Camera, Smartphone } from 'lucide-react';
import { getEventByPasscode, clearTenantCache } from './services/backendService';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

type ViewState = 'landing' | 'login' | 'signup' | 'admin' | 'kiosk' | 'loading';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('loading');
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');

  const launchKiosk = (event: Event) => {
    setActiveEvent(event);
    setView('kiosk');
  };

  const exitKiosk = () => {
    window.location.href = '/';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearTenantCache();
    setUser(null);
    setView('landing');
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);

        const urlParams = new URLSearchParams(window.location.search);
        const kioskPasscode = urlParams.get('kiosk');

        if (kioskPasscode) {
          try {
            const event = await getEventByPasscode(kioskPasscode);
            if (event) {
              setActiveEvent(event);
              setView('kiosk');
            } else {
              setError('Invalid event code');
              setView('admin');
            }
          } catch (err) {
            console.error('Failed to load event:', err);
            setError('Failed to load event');
            setView('admin');
          }
        } else {
          setView('admin');
        }
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const kioskPasscode = urlParams.get('kiosk');

        if (kioskPasscode) {
          setView('loading');
          getEventByPasscode(kioskPasscode)
            .then((event) => {
              if (event) {
                setActiveEvent(event);
                setView('kiosk');
              } else {
                setError('Invalid event code');
                setView('landing');
              }
            })
            .catch((err) => {
              console.error('Failed to load event:', err);
              setError('Failed to load event');
              setView('landing');
            });
        } else {
          setView('landing');
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const kioskPasscode = urlParams.get('kiosk');

        if (kioskPasscode) {
          return;
        }

        if (session?.user) {
          setUser(session.user);
          setView('admin');
        } else {
          setUser(null);
          setView('landing');
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // LOADING STATE
  if (view === 'loading') {
    return (
      <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-900 text-xl">Loading Event...</p>
        </div>
      </div>
    );
  }

  // 1. KIOSK MODE
  if (view === 'kiosk' && activeEvent) {
    return <KioskMode event={activeEvent} onExit={exitKiosk} />;
  }

  // 2. ADMIN MODE
  if (view === 'admin') {
    return <AdminDashboard onLogout={handleLogout} onLaunchKiosk={launchKiosk} user={user} />;
  }

  // 3. LOGIN MODE
  if (view === 'login') {
    return (
      <Login
        onSuccess={() => setView('admin')}
        onSwitchToSignup={() => setView('signup')}
        onBackToLanding={() => setView('landing')}
      />
    );
  }

  // 4. SIGNUP MODE
  if (view === 'signup') {
    return (
      <Signup
        onSuccess={() => setView('admin')}
        onSwitchToLogin={() => setView('login')}
        onBackToLanding={() => setView('landing')}
      />
    );
  }

  // 4. LANDING PAGE
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-slate-900 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-700/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-800/5 rounded-full blur-3xl"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex justify-between items-center px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center">
          <img src="/smaller700x200_logo.png" alt="Fun Frame Photo" className="h-12 lg:h-16" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('login')}
            className="text-slate-700 hover:text-slate-900 text-sm font-medium transition-all"
          >
            Sign In
          </button>
          <button
            onClick={() => setView('signup')}
            className="bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-700/10 border border-green-700/30 text-green-800 text-sm font-medium">
              <span className="w-2 h-2 bg-green-700 rounded-full animate-pulse"></span>
              AI-Powered Photo Experience
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight text-black">
              Transform Your Events with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-700 via-green-800 to-emerald-800">
                AI Magic
              </span>
            </h1>
            <p className="text-lg lg:text-xl text-slate-700 max-w-xl leading-relaxed">
              Create unforgettable moments at your events with our cutting-edge AI photo booth technology.
              Instant transformations, creative themes, and seamless sharing.
            </p>

            {/* Features */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-700/10 flex items-center justify-center">
                  <Check size={16} className="text-green-800" />
                </div>
                <div>
                  <div className="font-semibold text-black">Real-Time AI</div>
                  <div className="text-sm text-slate-600">Instant creative transformations</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-700/10 flex items-center justify-center">
                  <Check size={16} className="text-green-800" />
                </div>
                <div>
                  <div className="font-semibold text-black">Custom Branding</div>
                  <div className="text-sm text-slate-600">Personalized for your event</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-700/10 flex items-center justify-center">
                  <Check size={16} className="text-green-800" />
                </div>
                <div>
                  <div className="font-semibold text-black">Instant Sharing</div>
                  <div className="text-sm text-slate-600">SMS, QR codes, and downloads</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-700/10 flex items-center justify-center">
                  <Check size={16} className="text-green-800" />
                </div>
                <div>
                  <div className="font-semibold text-black">Pro Analytics</div>
                  <div className="text-sm text-slate-600">Track engagement & performance</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={() => setView('signup')}
                className="group px-8 py-4 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white rounded-xl font-bold shadow-lg shadow-green-700/25 transition-all hover:scale-105 hover:shadow-green-700/40 flex items-center justify-center gap-2"
              >
                Get Started Free
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setView('login')}
                className="px-8 py-4 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-900 rounded-xl font-bold transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Right Visual */}
          <div className="relative lg:order-last">
            <div className="absolute inset-0 bg-gradient-to-tr from-green-700/10 to-emerald-700/10 blur-3xl rounded-full"></div>
            <div className="relative space-y-6">
              {/* Main Image */}
              <div className="relative bg-white border-2 border-slate-300 rounded-2xl p-3 shadow-2xl transform hover:scale-[1.02] transition-transform duration-300">
                <img
                  src="https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&cs=tinysrgb&w=800"
                  className="rounded-xl w-full aspect-[4/3] object-cover"
                  alt="Event Photography"
                />
                <div className="absolute -bottom-4 -right-4 bg-white px-5 py-3 rounded-xl border-2 border-green-700/40 shadow-xl backdrop-blur-sm">
                  <div className="text-xs text-green-800 font-semibold mb-0.5">AI Enhanced</div>
                  <div className="font-bold text-black">Instant Results</div>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/80 border border-slate-300 rounded-xl p-4 backdrop-blur-sm">
                  <Camera className="text-green-800 mb-2" size={24} />
                  <div className="font-semibold text-sm text-black">Photo Booth</div>
                  <div className="text-xs text-slate-600">Professional setup</div>
                </div>
                <div className="bg-white/80 border border-slate-300 rounded-xl p-4 backdrop-blur-sm">
                  <Smartphone className="text-green-800 mb-2" size={24} />
                  <div className="font-semibold text-sm text-black">Mobile Ready</div>
                  <div className="text-xs text-slate-600">Share instantly</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="relative z-10 border-t border-slate-300 mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="text-center text-slate-500 text-sm">
            <p>© 2024 Fun Frame Photo. Photo Booths & Event Photography.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
