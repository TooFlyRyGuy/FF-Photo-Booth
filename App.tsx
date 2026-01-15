import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Event } from './types';
import { Check, ArrowRight, Camera, Smartphone } from 'lucide-react';
import { getEventByPasscode, clearUserCache } from './services/backendService';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import TidioWidget from './components/TidioWidget';

const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const KioskMode = lazy(() => import('./components/KioskMode'));
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const MarketingPage = lazy(() => import('./components/MarketingPage'));

type ViewState = 'landing' | 'login' | 'signup' | 'admin' | 'kiosk' | 'marketing' | 'loading';

const LoadingSpinner: React.FC = () => (
  <div className="h-screen w-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-16 h-16 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-slate-900 text-xl">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('loading');
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [eventCode, setEventCode] = useState('');

  const launchKiosk = (event: Event) => {
    setActiveEvent(event);
    setView('kiosk');
  };

  const exitKiosk = () => {
    window.location.href = '/';
  };

  const handleEventCodeLaunch = async () => {
    if (!eventCode.trim()) {
      setError('Please enter an event code');
      return;
    }

    setError('');
    try {
      const event = await getEventByPasscode(eventCode.trim());
      if (event) {
        launchKiosk(event);
      } else {
        setError('Invalid event code. Please try again.');
      }
    } catch (err) {
      console.error('Error loading event:', err);
      setError('Failed to load event. Please try again.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearUserCache();
    setUser(null);
    setView('landing');
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const kioskPasscode = urlParams.get('kiosk');
    const marketingView = urlParams.get('marketing');
    const isKioskMode = !!kioskPasscode;

    console.log('[App] Init - kiosk passcode:', kioskPasscode, 'isKioskMode:', isKioskMode, 'marketingView:', marketingView);

    const initializeAuth = async () => {
      console.log('[App] Starting initializeAuth');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[App] Session state:', session?.user ? 'logged in' : 'logged out');

      if (marketingView) {
        console.log('[App] Marketing view detected');
        if (session?.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

          if (profile?.role === 'admin') {
            setUser(session.user);
            setView('marketing');
          } else {
            setView('landing');
          }
        } else {
          setView('landing');
        }
        return;
      }

      if (kioskPasscode) {
        console.log('[App] Kiosk mode detected - loading event');
        try {
          const event = await getEventByPasscode(kioskPasscode);
          console.log('[App] Event loaded:', event?.name || 'null');
          if (event) {
            setActiveEvent(event);
            setView('kiosk');
            console.log('[App] View set to kiosk');
          } else {
            console.log('[App] No event found');
            setError('Invalid event code');
            setView(session?.user ? 'admin' : 'landing');
          }
        } catch (err) {
          console.error('[App] Error loading event:', err);
          setError('Failed to load event');
          setView(session?.user ? 'admin' : 'landing');
        }
        if (session?.user) {
          setUser(session.user);
        }
      } else {
        console.log('[App] No kiosk mode - normal flow');
        if (session?.user) {
          setUser(session.user);
          setView('admin');
        } else {
          setView('landing');
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[App] onAuthStateChange fired - event:', event, 'session:', session?.user ? 'logged in' : 'logged out', 'isKioskMode:', isKioskMode);

      if (isKioskMode) {
        console.log('[App] In kiosk mode - ignoring auth change');
        if (session?.user) {
          setUser(session.user);
        }
        return;
      }

      console.log('[App] Not in kiosk mode - processing auth change');
      if (session?.user) {
        setUser(session.user);
        setView('admin');
        console.log('[App] View set to admin');
      } else {
        setUser(null);
        setView('landing');
        console.log('[App] View set to landing');
      }
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
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <KioskMode event={activeEvent} onExit={exitKiosk} />
      </Suspense>
    );
  }

  // 2. ADMIN MODE
  if (view === 'admin') {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <AdminDashboard onLogout={handleLogout} onLaunchKiosk={launchKiosk} user={user} />
      </Suspense>
    );
  }

  // 3. LOGIN MODE
  if (view === 'login') {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Login
          onSuccess={() => setView('admin')}
          onSwitchToSignup={() => setView('signup')}
          onBackToLanding={() => setView('landing')}
        />
      </Suspense>
    );
  }

  // 4. SIGNUP MODE
  if (view === 'signup') {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Signup
          onSuccess={() => setView('admin')}
          onSwitchToLogin={() => setView('login')}
          onBackToLanding={() => setView('landing')}
        />
      </Suspense>
    );
  }

  // 5. MARKETING PAGE (Admin Only)
  if (view === 'marketing') {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <MarketingPage />
      </Suspense>
    );
  }

  // 6. LANDING PAGE
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-slate-900 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-700/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-800/5 rounded-full blur-3xl"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex justify-between items-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto">
        <div className="flex items-center">
          <img src="/smaller700x200_logo.png" alt="Fun Frame Photo" className="h-10 sm:h-12 lg:h-16" />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setView('login')}
            className="text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-medium transition-all"
          >
            Sign In
          </button>
          <button
            onClick={() => setView('signup')}
            className="bg-green-700 hover:bg-green-800 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all hover:scale-105"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-24">
        {/* Event Code Launcher */}
        <div className="mb-8 sm:mb-12 max-w-2xl mx-auto">
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 sm:p-6 shadow-lg">
            <div className="text-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Launch Kiosk Mode</h3>
              <p className="text-xs sm:text-sm text-slate-600">Enter your event code to start the photo booth experience</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-lg text-red-800 text-center text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleEventCodeLaunch()}
                placeholder="ENTER EVENT CODE"
                className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-xl text-center text-base sm:text-lg font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-green-700 uppercase"
                maxLength={20}
              />
              <button
                onClick={handleEventCodeLaunch}
                disabled={!eventCode.trim()}
                className="w-full sm:w-auto px-8 py-3 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                Launch
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-green-700/10 border border-green-700/30 text-green-800 text-xs sm:text-sm font-medium">
              <span className="w-2 h-2 bg-green-700 rounded-full animate-pulse"></span>
              AI-Powered Photo Experience
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight text-black">
              Transform Your Events with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-700 via-green-800 to-emerald-800">
                AI Magic
              </span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-700 max-w-xl leading-relaxed">
              Create unforgettable moments at your events with our cutting-edge AI photo booth technology.
              Instant transformations, creative themes, and seamless sharing.
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 sm:pt-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-700/10 flex items-center justify-center">
                  <Check size={14} className="sm:w-4 sm:h-4 text-green-800" />
                </div>
                <div>
                  <div className="font-semibold text-sm sm:text-base text-black">Real-Time AI</div>
                  <div className="text-xs sm:text-sm text-slate-600">Instant creative transformations</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-700/10 flex items-center justify-center">
                  <Check size={14} className="sm:w-4 sm:h-4 text-green-800" />
                </div>
                <div>
                  <div className="font-semibold text-sm sm:text-base text-black">Custom Branding</div>
                  <div className="text-xs sm:text-sm text-slate-600">Personalized for your event</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-700/10 flex items-center justify-center">
                  <Check size={14} className="sm:w-4 sm:h-4 text-green-800" />
                </div>
                <div>
                  <div className="font-semibold text-sm sm:text-base text-black">Instant Sharing</div>
                  <div className="text-xs sm:text-sm text-slate-600">SMS, QR codes, and downloads</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-700/10 flex items-center justify-center">
                  <Check size={14} className="sm:w-4 sm:h-4 text-green-800" />
                </div>
                <div>
                  <div className="font-semibold text-sm sm:text-base text-black">Pro Analytics</div>
                  <div className="text-xs sm:text-sm text-slate-600">Track engagement & performance</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
              <button
                onClick={() => setView('signup')}
                className="group px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-green-700/25 transition-all hover:scale-105 hover:shadow-green-700/40 flex items-center justify-center gap-2"
              >
                Get Started Free
                <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px] group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setView('login')}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-900 rounded-xl font-bold text-sm sm:text-base transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Right Visual */}
          <div className="relative lg:order-last mt-8 lg:mt-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-green-700/10 to-emerald-700/10 blur-3xl rounded-full"></div>
            <div className="relative space-y-4 sm:space-y-6">
              {/* Main Image */}
              <div className="relative bg-white border-2 border-slate-300 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-2xl transform hover:scale-[1.02] transition-transform duration-300">
                <img
                  src="https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&cs=tinysrgb&w=800"
                  className="rounded-lg sm:rounded-xl w-full aspect-[4/3] object-cover"
                  alt="Event Photography"
                />
                <div className="absolute -bottom-3 sm:-bottom-4 -right-3 sm:-right-4 bg-white px-3 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl border-2 border-green-700/40 shadow-xl backdrop-blur-sm">
                  <div className="text-[10px] sm:text-xs text-green-800 font-semibold mb-0.5">AI Enhanced</div>
                  <div className="font-bold text-xs sm:text-base text-black">Instant Results</div>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white/80 border border-slate-300 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                  <Camera className="text-green-800 mb-1 sm:mb-2" size={20} />
                  <div className="font-semibold text-xs sm:text-sm text-black">Photo Booth</div>
                  <div className="text-[10px] sm:text-xs text-slate-600">Professional setup</div>
                </div>
                <div className="bg-white/80 border border-slate-300 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                  <Smartphone className="text-green-800 mb-1 sm:mb-2" size={20} />
                  <div className="font-semibold text-xs sm:text-sm text-black">Mobile Ready</div>
                  <div className="text-[10px] sm:text-xs text-slate-600">Share instantly</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="relative z-10 border-t border-slate-300 mt-12 sm:mt-16 lg:mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center text-slate-500 text-xs sm:text-sm">
            <p>© 2025 Fun Frame Photo.</p>
          </div>
        </div>
      </div>

      <TidioWidget />
    </div>
  );
};

export default App;
