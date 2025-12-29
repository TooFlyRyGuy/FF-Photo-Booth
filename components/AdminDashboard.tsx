import React, { useState, useEffect } from 'react';
import { getUserProfile, getUserSettings, getUserCredits, updateUserSettings, updateGlobalSettings, getGlobalSettings, getEvents, getEventById, getPrompts, getPromptById, saveEvent, savePrompt, updatePrompt, deletePrompt, deleteEvent, getDashboardStats, getDashboardChartData, DashboardStats, ChartDataPoint, clearPromptsCache, clearGlobalSettingsCache, getAllUsers, getAllEvents, getAllPrompts, getAdminStats, getRevenueStats } from '../services/backendService';
import { UserProfile, UserSettings, GlobalSettings, UserCredits, Event, Prompt } from '../types';
import { LayoutDashboard, Calendar, Settings as SettingsIcon, LogOut, Zap, Camera, MessageSquare, Plus, Save, X, Image as ImageIcon, Upload, Check, Link2, ExternalLink, ChartBar as BarChart3, Trash2, Pencil, CreditCard, Menu, ChevronLeft, BookImage, GripVertical, RefreshCw, Images, Users, DollarSign, Search, User as UserIcon, Package } from 'lucide-react';
import Settings from './Settings';
import EventAnalytics from './EventAnalytics';
import SubscriptionManager from './SubscriptionManager';
import PromptLibrary from './PromptLibrary';
import UserManagement from './UserManagement';
import PlanManagement from './PlanManagement';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface AdminProps {
  onLogout: () => void;
  onLaunchKiosk: (event: Event) => void;
  user: User | null;
}

type Tab = 'dashboard' | 'events' | 'create_event' | 'edit_event' | 'analytics' | 'settings' | 'prompts' | 'users' | 'plans' | 'revenue';

const AdminDashboard: React.FC<AdminProps> = ({ onLogout, onLaunchKiosk, user }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [userCredits, setUserCredits] = useState<UserCredits | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ totalImages: 0, totalSms: 0, totalEvents: 0, activeEvents: 0 });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Event Editor State
  const [editingEvent, setEditingEvent] = useState<Partial<Event>>({});

  // Analytics State
  const [analyticsEvent, setAnalyticsEvent] = useState<Event | null>(null);

  // Prompt Library State
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [promptLibraryEventContext, setPromptLibraryEventContext] = useState<string | null>(null);

  // Drag and Drop State
  const [draggedPromptIndex, setDraggedPromptIndex] = useState<number | null>(null);

  // Inline Prompt Editing State
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPromptData, setEditingPromptData] = useState<Partial<Prompt> | null>(null);

  // Admin State
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [revenueStats, setRevenueStats] = useState<any>(null);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (user) {
      clearPromptsCache();
      clearGlobalSettingsCache();
      loadData();
      loadDashboardData();
    } else {
      setIsLoading(false);
      setLoadError('No user session found');
    }
  }, [user?.id]);

  useEffect(() => {
    filterEvents();
  }, [events, eventSearchQuery]);

  const filterEvents = () => {
    if (!eventSearchQuery.trim()) {
      setFilteredEvents(events);
      return;
    }

    const query = eventSearchQuery.toLowerCase();
    const filtered = events.filter(event => {
      const eventDate = new Date(event.date).toLocaleDateString().toLowerCase();
      const createdByEmail = event.createdByEmail?.toLowerCase() || '';
      const userName = event.userName?.toLowerCase() || '';

      return (
        event.name.toLowerCase().includes(query) ||
        event.city?.toLowerCase().includes(query) ||
        eventDate.includes(query) ||
        createdByEmail.includes(query) ||
        userName.includes(query)
      );
    });
    setFilteredEvents(filtered);
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const profileData = await getUserProfile();

      if (!profileData) {
        throw new Error('Unable to load user profile');
      }

      const isAdmin = profileData.role === 'admin';

      const [settingsData, globalData, creditsData, eventsData] = await Promise.all([
        getUserSettings(),
        getGlobalSettings(),
        getUserCredits(),
        isAdmin ? getAllEvents() : getEvents()
      ]);

      setUserProfile(profileData);
      setUserSettings(settingsData);
      setGlobalSettings(globalData);
      setUserCredits(creditsData);
      setEvents(eventsData || []);

      console.log('Loaded data successfully:', {
        userId: profileData?.id || 'unknown',
        role: profileData?.role || 'user',
        events: (eventsData || []).length
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLoadError(errorMessage);
      setIsLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [stats, chart] = await Promise.all([
        getDashboardStats(),
        getDashboardChartData()
      ]);
      setDashboardStats(stats);
      setChartData(chart);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const loadAdminData = async () => {
    if (userProfile?.role !== 'admin') return;

    try {
      const [users, stats, revenue] = await Promise.all([
        getAllUsers(),
        getAdminStats(),
        getRevenueStats()
      ]);
      setAllUsers(users || []);
      setAdminStats(stats);
      setRevenueStats(revenue);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  useEffect(() => {
    if (userProfile?.role === 'admin' && (activeTab === 'users' || activeTab === 'revenue')) {
      loadAdminData();
    }
  }, [activeTab, userProfile?.role]);

  const handleLaunchKiosk = async (event: Event) => {
    try {
      const fullEvent = await getEventById(event.id);
      onLaunchKiosk(fullEvent);
    } catch (error) {
      console.error('Failed to load event for kiosk:', error);
      alert('Failed to launch kiosk mode. Please try again.');
    }
  };

  const copyKioskLink = (event: Event) => {
    const url = `${window.location.origin}/?kiosk=${event.passcode}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Kiosk link copied!\n\nShare this URL with guests:\n${url}`);
    }).catch(() => {
      alert(`Kiosk URL:\n${url}\n\n(Copy this link to share with guests)`);
    });
  };

  const handleSaveUserSettings = async (updates: Partial<UserSettings>) => {
    await updateUserSettings(updates);
    await loadData();
  };

  const handleSaveGlobalSettings = async (updates: Partial<GlobalSettings>) => {
    await updateGlobalSettings(updates);
    await loadData();
  };

  const generateUniquePasscode = (): string => {
    const existingPasscodes = events.map(e => e.passcode);
    let passcode: string;
    do {
      passcode = Math.floor(1000 + Math.random() * 9000).toString();
    } while (existingPasscodes.includes(passcode));
    return passcode;
  };

  const handleCreateEvent = () => {
    setEditingEvent({
      id: `evt_${Date.now()}`,
      name: '',
      city: '',
      date: new Date().toISOString().split('T')[0],
      passcode: generateUniquePasscode(),
      isActive: true,
      prompts: [],
      userId: user?.id || '',
      aspectRatio: 'square'
    });
    setActiveTab('create_event');
  };

  const handleEditEvent = async (event: Event) => {
    try {
      const eventWithPrompts = await getEventById(event.id);
      setEditingEvent({ ...eventWithPrompts });
      setActiveTab('edit_event');
    } catch (error) {
      console.error('Failed to load event details:', error);
      alert('Failed to load event details. Please try again.');
    }
  };

  const handleViewAnalytics = (event: Event) => {
    setAnalyticsEvent(event);
    setActiveTab('analytics');
  };

  const handleEventImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'backgroundImageUrl' | 'logoUrl' | 'overlayImageUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingEvent({ ...editingEvent, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePromptImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'previewImage' | 'referenceImage') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingPromptData({ ...editingPromptData, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEvent = async () => {
    if (!editingEvent.name || !editingEvent.passcode) {
      alert("Please fill in the required fields (Name, Passcode)");
      return;
    }

    const duplicatePasscode = events.find(
      e => e.passcode === editingEvent.passcode && e.id !== editingEvent.id
    );
    if (duplicatePasscode) {
      alert(`Passcode ${editingEvent.passcode} is already used by event "${duplicatePasscode.name}". Please use a different passcode.`);
      return;
    }

    try {
      await saveEvent(editingEvent as Event);
      await loadData();
      setActiveTab('events');
    } catch (error: any) {
      alert(`Failed to save event: ${error.message}`);
      console.error('Save event error:', error);
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    if (!confirm(`Are you sure you want to delete "${event.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteEvent(event.id);
      await loadData();
    } catch (error: any) {
      alert(`Failed to delete event: ${error.message}`);
      console.error('Delete event error:', error);
    }
  };

  const togglePromptSelection = (prompt: Prompt) => {
    const currentPrompts = editingEvent.prompts || [];
    const exists = currentPrompts.find(p => p.id === prompt.id);

    let newPrompts;
    if (exists) {
      newPrompts = currentPrompts.filter(p => p.id !== prompt.id);
    } else {
      newPrompts = [...currentPrompts, prompt];
    }

    setEditingEvent({ ...editingEvent, prompts: newPrompts });
  };

  const handleDragStart = (index: number) => {
    setDraggedPromptIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedPromptIndex === null || draggedPromptIndex === index) return;

    const prompts = [...(editingEvent.prompts || [])];
    const draggedItem = prompts[draggedPromptIndex];
    prompts.splice(draggedPromptIndex, 1);
    prompts.splice(index, 0, draggedItem);

    setEditingEvent({ ...editingEvent, prompts });
    setDraggedPromptIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedPromptIndex(null);
  };

  const handleStartEditingPrompt = (prompt: Prompt) => {
    setEditingPromptId(prompt.id);
    setEditingPromptData({ ...prompt });
  };

  const handleSavePromptEdit = async () => {
    if (!editingPromptData || !editingPromptId) return;

    try {
      await updatePrompt(editingPromptId, editingPromptData);

      const updatedPrompts = (editingEvent.prompts || []).map(p =>
        p.id === editingPromptId ? { ...p, ...editingPromptData } : p
      );

      setEditingEvent({ ...editingEvent, prompts: updatedPrompts });
      setEditingPromptId(null);
      setEditingPromptData(null);
    } catch (error) {
      alert('Failed to save prompt changes');
      console.error('Error saving prompt:', error);
    }
  };

  const handleCancelPromptEdit = () => {
    setEditingPromptId(null);
    setEditingPromptData(null);
  };

  const handleAddNewPrompt = async () => {
    const newPrompt: Partial<Prompt> = {
      id: `prompt_${Date.now()}`,
      name: 'New Prompt',
      description: 'Add a description',
      promptText: 'Add your AI prompt text here',
      category: 'Custom',
      previewImage: 'https://via.placeholder.com/400x300?text=Add+Preview+Image',
    };

    try {
      const savedPrompt = await savePrompt(newPrompt as Prompt);
      const currentPrompts = editingEvent.prompts || [];
      setEditingEvent({ ...editingEvent, prompts: [...currentPrompts, savedPrompt] });
      setEditingPromptId(savedPrompt.id);
      setEditingPromptData(savedPrompt);
    } catch (error) {
      alert('Failed to create new prompt');
      console.error('Error creating prompt:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-900 bg-slate-100">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading Dashboard...</div>
          {loadError && (
            <div className="mt-4 text-red-600">
              <div className="font-semibold mb-2">Error:</div>
              <div className="text-sm">{loadError}</div>
              <button
                onClick={() => {
                  setLoadError(null);
                  loadData();
                }}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!userProfile || !userCredits) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-900 bg-slate-100">
        <div className="text-center">
          <div className="text-xl font-semibold text-red-600 mb-2">Unable to load dashboard</div>
          <div className="text-sm text-slate-600 mb-4">{loadError || 'Unknown error'}</div>
          <button
            onClick={() => {
              setLoadError(null);
              loadData();
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 mr-2"
          >
            Retry
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  const usagePercent = (userCredits.images_used / userCredits.images_limit) * 100;
  const isAdmin = userProfile.role === 'admin';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white border-2 border-slate-300 rounded-lg flex items-center justify-center text-slate-600 hover:text-green-700 hover:border-green-700 transition-colors shadow-lg"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-white border-r border-slate-300 flex flex-col transition-all duration-300 ease-in-out
        fixed inset-y-0 left-0 z-40
        md:relative ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'}
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Toggle Button - Desktop Only */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex absolute -right-3 top-6 z-10 w-6 h-6 bg-white border-2 border-slate-300 rounded-full items-center justify-center text-slate-600 hover:text-green-700 hover:border-green-700 transition-colors shadow-sm"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <Menu size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Close Button - Mobile Only */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden absolute right-4 top-4 z-10 w-8 h-8 flex items-center justify-center text-slate-600 hover:text-green-700 transition-colors"
        >
          <X size={20} />
        </button>

        <div className={`p-6 ${sidebarCollapsed ? 'px-2' : ''}`}>
          <h1 className={`text-2xl font-bold tracking-tighter text-green-700 flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <Camera size={24} />
            {!sidebarCollapsed && 'Fun Frame AI'}
          </h1>
          {userProfile && !sidebarCollapsed && (
            <div className="mt-3 text-xs">
              <div className="flex items-center gap-2">
                <p className="text-slate-600 truncate flex-1">{user?.email}</p>
                {isAdmin && (
                  <span className="bg-green-700 text-white px-2 py-0.5 rounded text-xs font-bold">
                    ADMIN
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-4'} space-y-2`}>
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
            title={sidebarCollapsed ? 'Overview' : ''}
          >
            <LayoutDashboard size={20} />
            {!sidebarCollapsed && 'Overview'}
          </button>
          <button
            onClick={() => {
              setActiveTab('events');
              setMobileMenuOpen(false);
            }}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'events' || activeTab.includes('event') ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
            title={sidebarCollapsed ? 'Events' : ''}
          >
            <Calendar size={20} />
            {!sidebarCollapsed && 'Events'}
          </button>
          <button
            onClick={() => {
              setShowPromptLibrary(true);
              setMobileMenuOpen(false);
            }}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors hover:bg-slate-100 text-slate-600`}
            title={sidebarCollapsed ? 'Prompt Library' : ''}
          >
            <BookImage size={20} />
            {!sidebarCollapsed && 'Prompt Library'}
          </button>
          <button
            onClick={() => {
              setActiveTab('settings');
              setMobileMenuOpen(false);
            }}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
            title={sidebarCollapsed ? 'Settings' : ''}
          >
            <SettingsIcon size={20} />
            {!sidebarCollapsed && 'Settings'}
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setActiveTab('users');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
                title={sidebarCollapsed ? 'User Management' : ''}
              >
                <Users size={20} />
                {!sidebarCollapsed && 'User Management'}
              </button>
              <button
                onClick={() => {
                  setActiveTab('plans');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'plans' ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
                title={sidebarCollapsed ? 'Plans' : ''}
              >
                <Package size={20} />
                {!sidebarCollapsed && 'Plans'}
              </button>
              <button
                onClick={() => {
                  setActiveTab('revenue');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'revenue' ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
                title={sidebarCollapsed ? 'Revenue' : ''}
              >
                <DollarSign size={20} />
                {!sidebarCollapsed && 'Revenue'}
              </button>
            </>
          )}
        </nav>

        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-t border-slate-300 space-y-4`}>
          {!sidebarCollapsed && (
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Credits</span>
                <span>{userCredits.images_used} / {userCredits.images_limit}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-700" style={{ width: `${usagePercent}%` }}></div>
              </div>
            </div>
          )}
          {!sidebarCollapsed ? (
            <>
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white rounded-lg text-sm font-medium transition-all"
              >
                <CreditCard size={16} />
                Manage Plan
              </button>
              <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700">
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="w-full flex items-center justify-center p-3 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white rounded-lg transition-all"
                title="Manage Plan"
              >
                <CreditCard size={16} />
              </button>
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 pt-16 md:p-8 md:pt-8 relative">
        
        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h2 className="text-3xl font-bold text-black">Dashboard</h2>
              <button
                onClick={handleCreateEvent}
                className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 whitespace-nowrap"
              >
                <Plus size={16} /> New Event
              </button>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Total Images</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">{dashboardStats.totalImages}</h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg"><Camera size={20}/></div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">SMS Delivered</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">{dashboardStats.totalSms}</h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg"><MessageSquare size={20}/></div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Total Events</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">{dashboardStats.totalEvents}</h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg"><Calendar size={20}/></div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Active Events</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">{dashboardStats.activeEvents}</h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg"><Zap size={20}/></div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-xl border-2 border-slate-300 h-80">
              <h3 className="text-lg font-semibold mb-4 text-black">Generation Activity (Last 30 Days)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="date" stroke="#475569" />
                  <YAxis stroke="#475569" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
                    itemStyle={{ color: '#0f172a' }}
                  />
                  <Bar dataKey="generations" fill="#15803d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* EVENTS LIST VIEW */}
        {activeTab === 'events' && (
          <div className="space-y-6">
             <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-black">
                  {isAdmin ? 'All Events' : 'Your Events'}
                </h2>
                {isAdmin && (
                  <p className="text-sm text-green-700 font-medium mt-1 flex items-center gap-1">
                    <Users size={14} /> Admin view - Showing all users' events
                  </p>
                )}
              </div>
              <button
                onClick={handleCreateEvent}
                className="bg-green-700 hover:bg-green-800 text-white px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 whitespace-nowrap shadow-lg shadow-green-900/20 transition-all"
              >
                <Plus size={18} /> Create Event
              </button>
            </header>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                placeholder="Search by event name, date, city, or user..."
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
              />
            </div>

            <div className="grid gap-4 md:gap-6">
              {filteredEvents.map(event => (
                <div key={event.id} className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden group hover:border-green-700/50 hover:shadow-lg transition-all">
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-black truncate">
                              {event.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {event.isActive && (
                                <span className="text-xs bg-green-700/20 text-green-800 px-2 py-0.5 rounded-full font-medium">
                                  Active
                                </span>
                              )}
                              <span className="text-slate-600 text-sm">{event.city}</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600 text-sm">{event.date}</span>
                            </div>
                            {isAdmin && event.userEmail && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                <UserIcon size={12} />
                                <span className="font-medium">{event.userName}</span>
                                <span className="text-slate-400">({event.userEmail})</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs mt-3 bg-slate-50 px-3 py-2 rounded-lg">
                          <ExternalLink size={14} className="flex-shrink-0" />
                          <span className="font-mono truncate">/?kiosk={event.passcode}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t-2 border-slate-200 bg-slate-50 p-3 sm:p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleLaunchKiosk(event)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-semibold shadow-md shadow-green-900/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Camera size={16} /> Launch Kiosk
                      </button>

                      {event.smugmugGalleryUrl && (
                        <a
                          href={event.smugmugGalleryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium transition-all flex items-center justify-center gap-2"
                        >
                          <Images size={16} /> View Gallery
                        </a>
                      )}

                      <button
                        onClick={() => handleViewAnalytics(event)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-green-700 text-green-800 hover:bg-green-700/10 text-sm font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <BarChart3 size={16} /> Analytics
                      </button>

                      <button
                        onClick={() => copyKioskLink(event)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Link2 size={16} /> <span className="hidden sm:inline">Copy Link</span>
                      </button>

                      <button
                        onClick={() => handleEditEvent(event)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Pencil size={16} /> <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        onClick={() => handleDeleteEvent(event)}
                        className="px-4 py-2.5 rounded-lg border-2 border-red-600 text-red-600 hover:bg-red-50 text-sm font-medium transition-all flex items-center justify-center gap-2"
                        title="Delete event"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CREATE / EDIT EVENT VIEW */}
        {(activeTab === 'create_event' || activeTab === 'edit_event') && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <button onClick={() => setActiveTab('events')} className="text-slate-600 hover:text-black flex items-center gap-2 text-sm whitespace-nowrap">
                &larr; Back to Events
              </button>
              <h2 className="text-2xl font-bold text-black">{activeTab === 'create_event' ? 'Create New Event' : 'Edit Event'}</h2>
            </header>

            <div className="bg-white p-8 rounded-xl border-2 border-slate-300 space-y-6">
              {/* Event Details Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Event Name</label>
                  <input
                    type="text"
                    value={editingEvent.name}
                    onChange={(e) => setEditingEvent({...editingEvent, name: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
                    placeholder="e.g. Summer Gala 2024"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">City / Venue</label>
                  <input
                    type="text"
                    value={editingEvent.city}
                    onChange={(e) => setEditingEvent({...editingEvent, city: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
                    placeholder="e.g. New York, NY"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Event Date</label>
                  <input
                    type="date"
                    value={editingEvent.date}
                    onChange={(e) => setEditingEvent({...editingEvent, date: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Kiosk Passcode</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingEvent.passcode}
                      onChange={(e) => setEditingEvent({...editingEvent, passcode: e.target.value})}
                      className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none font-mono"
                      placeholder="e.g. 1234"
                      maxLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingEvent({...editingEvent, passcode: generateUniquePasscode()})}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors flex items-center gap-2"
                      title="Generate new passcode"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">4-digit code for kiosk access. Must be unique.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Start Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={editingEvent.startDatetime ? new Date(editingEvent.startDatetime).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingEvent({...editingEvent, startDatetime: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
                  />
                  <p className="text-xs text-slate-500">Kiosk will be locked before this time</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">End Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={editingEvent.endDatetime ? new Date(editingEvent.endDatetime).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingEvent({...editingEvent, endDatetime: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
                  />
                  <p className="text-xs text-slate-500">Kiosk will be locked after this time</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Photo Aspect Ratio</label>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { value: 'square', label: 'Square (1:1)', icon: '⬜' },
                    { value: '3:4', label: 'Portrait (3:4)', icon: '📱' },
                    { value: '4:3', label: 'Landscape (4:3)', icon: '🖼️' },
                    { value: '9:16', label: 'Vertical (9:16)', icon: '📲' },
                    { value: '16:9', label: 'Wide (16:9)', icon: '🎬' }
                  ].map((ratio) => (
                    <button
                      key={ratio.value}
                      type="button"
                      onClick={() => setEditingEvent({...editingEvent, aspectRatio: ratio.value as any})}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        editingEvent.aspectRatio === ratio.value
                          ? 'border-green-700 bg-green-700/10 text-green-800'
                          : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-2xl mb-2">{ratio.icon}</div>
                      <div className="text-xs font-medium">{ratio.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Branding Customization Section */}
              <div className="pt-8 border-t border-slate-300">
                <h3 className="text-lg font-bold mb-4 text-black">Kiosk Branding</h3>
                <p className="text-sm text-slate-600 mb-6">Customize the appearance of the kiosk for this event</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <ImageIcon size={16} />
                      Background Image
                    </label>
                    {editingEvent.backgroundImageUrl && (editingEvent.backgroundImageUrl.startsWith('data:') || editingEvent.backgroundImageUrl.startsWith('http')) ? (
                      <div className="relative">
                        <img
                          src={editingEvent.backgroundImageUrl}
                          alt="Background"
                          className="w-full h-32 object-cover rounded-lg border-2 border-slate-300"
                        />
                        <button
                          onClick={() => setEditingEvent({...editingEvent, backgroundImageUrl: ''})}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                          title="Remove image"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                          <Upload size={32} className="text-slate-400 mb-2" />
                          <span className="text-sm text-slate-600">Click to Upload</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleEventImageUpload(e, 'backgroundImageUrl')}
                          className="hidden"
                        />
                      </label>
                    )}
                    <input
                      type="text"
                      value={!editingEvent.backgroundImageUrl?.startsWith('data:') ? (editingEvent.backgroundImageUrl || '') : ''}
                      onChange={(e) => setEditingEvent({...editingEvent, backgroundImageUrl: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none text-sm"
                      placeholder="Or enter URL: https://example.com/background.jpg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <ImageIcon size={16} />
                      Logo Image
                    </label>
                    {editingEvent.logoUrl && (editingEvent.logoUrl.startsWith('data:') || editingEvent.logoUrl.startsWith('http')) ? (
                      <div className="relative">
                        <img
                          src={editingEvent.logoUrl}
                          alt="Logo"
                          className="w-full h-32 object-contain rounded-lg border-2 border-slate-300 bg-slate-50"
                        />
                        <button
                          onClick={() => setEditingEvent({...editingEvent, logoUrl: ''})}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                          title="Remove image"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                          <Upload size={32} className="text-slate-400 mb-2" />
                          <span className="text-sm text-slate-600">Click to Upload</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleEventImageUpload(e, 'logoUrl')}
                          className="hidden"
                        />
                      </label>
                    )}
                    <input
                      type="text"
                      value={!editingEvent.logoUrl?.startsWith('data:') ? (editingEvent.logoUrl || '') : ''}
                      onChange={(e) => setEditingEvent({...editingEvent, logoUrl: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none text-sm"
                      placeholder="Or enter URL: https://example.com/logo.png"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <ImageIcon size={16} />
                      Overlay Image (Transparent PNG)
                    </label>
                    {editingEvent.overlayImageUrl && (editingEvent.overlayImageUrl.startsWith('data:') || editingEvent.overlayImageUrl.startsWith('http')) ? (
                      <div className="relative">
                        <img
                          src={editingEvent.overlayImageUrl}
                          alt="Overlay"
                          className="w-full h-32 object-contain rounded-lg border-2 border-slate-300 bg-slate-50"
                        />
                        <button
                          onClick={() => setEditingEvent({...editingEvent, overlayImageUrl: ''})}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                          title="Remove image"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                          <Upload size={32} className="text-slate-400 mb-2" />
                          <span className="text-sm text-slate-600">Click to Upload</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleEventImageUpload(e, 'overlayImageUrl')}
                          className="hidden"
                        />
                      </label>
                    )}
                    <input
                      type="text"
                      value={!editingEvent.overlayImageUrl?.startsWith('data:') ? (editingEvent.overlayImageUrl || '') : ''}
                      onChange={(e) => setEditingEvent({...editingEvent, overlayImageUrl: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none text-sm"
                      placeholder="Or enter URL: https://example.com/overlay.png"
                    />
                    <p className="text-xs text-slate-500">
                      Applied on top of generated images. Should match the event's aspect ratio ({editingEvent.aspectRatio || 'square'})
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Primary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingEvent.primaryColor || '#6366f1'}
                        onChange={(e) => setEditingEvent({...editingEvent, primaryColor: e.target.value})}
                        className="w-16 h-10 bg-slate-50 border-2 border-slate-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingEvent.primaryColor || ''}
                        onChange={(e) => setEditingEvent({...editingEvent, primaryColor: e.target.value})}
                        className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none font-mono"
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Secondary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingEvent.secondaryColor || '#8b5cf6'}
                        onChange={(e) => setEditingEvent({...editingEvent, secondaryColor: e.target.value})}
                        className="w-16 h-10 bg-slate-50 border-2 border-slate-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingEvent.secondaryColor || ''}
                        onChange={(e) => setEditingEvent({...editingEvent, secondaryColor: e.target.value})}
                        className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none font-mono"
                        placeholder="#8b5cf6"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Accent Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingEvent.accentColor || '#ec4899'}
                        onChange={(e) => setEditingEvent({...editingEvent, accentColor: e.target.value})}
                        className="w-16 h-10 bg-slate-50 border-2 border-slate-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingEvent.accentColor || ''}
                        onChange={(e) => setEditingEvent({...editingEvent, accentColor: e.target.value})}
                        className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none font-mono"
                        placeholder="#ec4899"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 space-y-4">
                  <p className="text-sm font-medium text-slate-700">Visibility Options</p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingEvent.hideLogo || false}
                        onChange={(e) => setEditingEvent({...editingEvent, hideLogo: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 bg-slate-50 text-green-700 focus:ring-2 focus:ring-green-700"
                      />
                      <span className="text-black">Hide Logo on Attract Screen</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingEvent.hideEventName || false}
                        onChange={(e) => setEditingEvent({...editingEvent, hideEventName: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 bg-slate-50 text-green-700 focus:ring-2 focus:ring-green-700"
                      />
                      <span className="text-black">Hide Event Name on Attract Screen</span>
                    </label>
                  </div>
                </div>

                <div className="pt-6 space-y-4">
                  <p className="text-sm font-medium text-slate-700">Gallery Upload Options</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingEvent.uploadOriginalsToGallery || false}
                      onChange={(e) => setEditingEvent({...editingEvent, uploadOriginalsToGallery: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-300 bg-slate-50 text-green-700 focus:ring-2 focus:ring-green-700"
                      disabled={!editingEvent.smugmugGalleryKey}
                    />
                    <span className="text-black">Upload Original Photos to Gallery</span>
                  </label>
                  {!editingEvent.smugmugGalleryKey && (
                    <p className="text-xs text-slate-500 ml-8">
                      Requires a SmugMug gallery to be configured in Settings
                    </p>
                  )}
                  {editingEvent.smugmugGalleryKey && (
                    <p className="text-xs text-slate-500 ml-8">
                      Original photos will be uploaded to SmugMug gallery after AI generation
                    </p>
                  )}
                </div>
              </div>

              {/* SMS Message Customization */}
              <div className="pt-8 border-t border-slate-300">
                <h3 className="text-lg font-bold text-black mb-2">SMS Message Settings</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Customize the text message sent when photos are delivered via SMS
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">SMS Message Template</label>
                  <textarea
                    value={editingEvent.smsMessage || "Here's your AI-generated photo from {event_name}! {image_url}"}
                    onChange={(e) => setEditingEvent({...editingEvent, smsMessage: e.target.value})}
                    rows={3}
                    placeholder="Here's your AI-generated photo from {event_name}! {image_url}"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none resize-none"
                  />
                  <p className="text-xs text-slate-500">
                    Available placeholders: <code className="bg-slate-200 px-1 py-0.5 rounded">{'{event_name}'}</code> and <code className="bg-slate-200 px-1 py-0.5 rounded">{'{image_url}'}</code>
                  </p>
                </div>
              </div>

              {/* Prompt Selection Section */}
              <div className="pt-8 border-t border-slate-300">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-black">AI Experience Prompts</h3>
                    <p className="text-sm text-slate-600">
                      Drag to reorder, click to edit
                      {editingEvent.prompts && editingEvent.prompts.length > 0 && (
                        <span className="ml-2 text-green-800 font-medium">
                          ({editingEvent.prompts.length} selected)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddNewPrompt}
                      className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                    >
                      <Plus size={16} /> New Prompt
                    </button>
                    <button
                      onClick={() => {
                        setPromptLibraryEventContext(editingEvent.id || null);
                        setShowPromptLibrary(true);
                      }}
                      className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                    >
                      <BookImage size={16} /> Library
                    </button>
                  </div>
                </div>

                {/* Selected Prompts with Drag and Drop */}
                {editingEvent.prompts && editingEvent.prompts.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid gap-3">
                      {editingEvent.prompts.map((prompt, index) => (
                        editingPromptId === prompt.id ? (
                          <div
                            key={prompt.id}
                            className="p-4 bg-white border-2 border-green-700 rounded-lg space-y-4"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-md font-bold text-black">Edit Prompt</h4>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSavePromptEdit}
                                  className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-md text-sm font-medium flex items-center gap-1"
                                >
                                  <Save size={14} /> Save
                                </button>
                                <button
                                  onClick={handleCancelPromptEdit}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-md text-sm font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                                <input
                                  type="text"
                                  value={editingPromptData?.name || ''}
                                  onChange={(e) => setEditingPromptData({ ...editingPromptData, name: e.target.value })}
                                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-green-700 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                                <input
                                  type="text"
                                  value={editingPromptData?.category || ''}
                                  onChange={(e) => setEditingPromptData({ ...editingPromptData, category: e.target.value })}
                                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-green-700 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                              <input
                                type="text"
                                value={editingPromptData?.description || ''}
                                onChange={(e) => setEditingPromptData({ ...editingPromptData, description: e.target.value })}
                                className="w-full px-3 py-2 border-2 border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-green-700 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">AI Prompt Text</label>
                              <textarea
                                value={editingPromptData?.promptText || ''}
                                onChange={(e) => setEditingPromptData({ ...editingPromptData, promptText: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border-2 border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-green-700 focus:outline-none font-mono"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-2 flex items-center gap-1">
                                  <ImageIcon size={14} />
                                  Kiosk Thumbnail
                                </label>
                                {editingPromptData?.previewImage && (editingPromptData.previewImage.startsWith('data:') || editingPromptData.previewImage.startsWith('http')) ? (
                                  <div className="relative">
                                    <img
                                      src={editingPromptData.previewImage}
                                      alt="Preview"
                                      className="w-full h-24 object-cover rounded border-2 border-slate-300"
                                    />
                                    <button
                                      onClick={() => setEditingPromptData({ ...editingPromptData, previewImage: '' })}
                                      className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-lg"
                                      title="Remove image"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer block">
                                    <div className="w-full h-24 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                                      <Upload size={20} className="text-slate-400 mb-1" />
                                      <span className="text-xs text-slate-600">Upload</span>
                                    </div>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handlePromptImageUpload(e, 'previewImage')}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                                <input
                                  type="text"
                                  value={!editingPromptData?.previewImage?.startsWith('data:') ? (editingPromptData?.previewImage || '') : ''}
                                  onChange={(e) => setEditingPromptData({ ...editingPromptData, previewImage: e.target.value })}
                                  className="w-full mt-2 px-2 py-1.5 border-2 border-slate-300 rounded text-xs focus:ring-2 focus:ring-green-700 focus:outline-none"
                                  placeholder="Or enter URL"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-2 flex items-center gap-1">
                                  <ImageIcon size={14} />
                                  AI Style Reference
                                </label>
                                {editingPromptData?.referenceImage && (editingPromptData.referenceImage.startsWith('data:') || editingPromptData.referenceImage.startsWith('http')) ? (
                                  <div className="relative">
                                    <img
                                      src={editingPromptData.referenceImage}
                                      alt="Reference"
                                      className="w-full h-24 object-cover rounded border-2 border-slate-300"
                                    />
                                    <button
                                      onClick={() => setEditingPromptData({ ...editingPromptData, referenceImage: '' })}
                                      className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-lg"
                                      title="Remove image"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer block">
                                    <div className="w-full h-24 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                                      <Upload size={20} className="text-slate-400 mb-1" />
                                      <span className="text-xs text-slate-600">Upload</span>
                                    </div>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handlePromptImageUpload(e, 'referenceImage')}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                                <input
                                  type="text"
                                  value={!editingPromptData?.referenceImage?.startsWith('data:') ? (editingPromptData?.referenceImage || '') : ''}
                                  onChange={(e) => setEditingPromptData({ ...editingPromptData, referenceImage: e.target.value })}
                                  className="w-full mt-2 px-2 py-1.5 border-2 border-slate-300 rounded text-xs focus:ring-2 focus:ring-green-700 focus:outline-none"
                                  placeholder="Or enter URL"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={prompt.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-4 p-3 bg-slate-50 border-2 border-slate-300 rounded-lg cursor-move hover:border-green-700/50 transition-all ${
                              draggedPromptIndex === index ? 'opacity-50' : ''
                            }`}
                          >
                            <div
                              className="p-2 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
                              title="Drag to reorder"
                            >
                              <GripVertical size={20} />
                            </div>
                            <img src={prompt.previewImage} alt={prompt.name} className="h-16 w-16 object-cover rounded" />
                            <div className="flex-1">
                              <h4 className="font-bold text-sm text-black">{prompt.name}</h4>
                              <p className="text-xs text-slate-500">{prompt.description || prompt.category}</p>
                            </div>
                            <button
                              onClick={() => handleStartEditingPrompt(prompt)}
                              className="px-3 py-2 rounded-md border-2 border-slate-300 text-slate-700 hover:bg-slate-100 text-sm flex items-center gap-1"
                              title="Edit prompt"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              onClick={() => togglePromptSelection(prompt)}
                              className="px-3 py-2 rounded-md border-2 border-red-300 text-red-700 hover:bg-red-50 text-sm"
                              title="Remove from event"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-slate-300">
                    <ImageIcon size={48} className="mx-auto text-slate-400 mb-3" />
                    <p className="text-slate-600 mb-4">No prompts added to this event</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleAddNewPrompt}
                        className="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2"
                      >
                        <Plus size={16} /> Create New Prompt
                      </button>
                      <button
                        onClick={() => {
                          setPromptLibraryEventContext(editingEvent.id || null);
                          setShowPromptLibrary(true);
                        }}
                        className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2"
                      >
                        <BookImage size={16} /> Browse Library
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-6 border-t border-slate-300">
                 <button
                  onClick={handleSaveEvent}
                  className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2"
                 >
                   <Save size={20} /> Save Event
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS VIEW */}
        {activeTab === 'analytics' && analyticsEvent && (
          <div className="space-y-6">
            <header className="flex items-center justify-between mb-8">
              <div>
                <button onClick={() => setActiveTab('events')} className="text-slate-600 hover:text-black flex items-center gap-2 text-sm mb-4">
                  &larr; Back to Events
                </button>
                <h2 className="text-3xl font-bold text-black">{analyticsEvent.name} Analytics</h2>
                <p className="text-slate-600 mt-2">{analyticsEvent.city} • {analyticsEvent.date}</p>
              </div>
            </header>

            <EventAnalytics eventId={analyticsEvent.id} eventName={analyticsEvent.name} />
          </div>
        )}

        {/* USER MANAGEMENT VIEW */}
        {activeTab === 'users' && isAdmin && (
          <UserManagement />
        )}

        {/* PLANS MANAGEMENT VIEW */}
        {activeTab === 'plans' && isAdmin && (
          <PlanManagement />
        )}

        {/* REVENUE VIEW */}
        {activeTab === 'revenue' && isAdmin && (
          <div className="space-y-6">
            <header className="mb-8">
              <h2 className="text-3xl font-bold text-black">Revenue Reports</h2>
              <p className="text-slate-600 mt-2">View financial metrics and system statistics</p>
            </header>

            {/* Revenue Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Total Revenue</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      ${revenueStats?.total_revenue ? (revenueStats.total_revenue / 100).toFixed(2) : '0.00'}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg">
                    <DollarSign size={20} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Monthly Revenue</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      ${revenueStats?.monthly_revenue ? (revenueStats.monthly_revenue / 100).toFixed(2) : '0.00'}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg">
                    <DollarSign size={20} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Total Orders</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      {revenueStats?.total_orders || 0}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg">
                    <CreditCard size={20} />
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Total Users</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      {adminStats?.total_users || 0}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg">
                    <Users size={20} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Active Users</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      {adminStats?.active_users || 0}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg">
                    <Users size={20} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Total Events</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      {adminStats?.total_events || 0}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg">
                    <Calendar size={20} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Total Images</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      {adminStats?.total_images || 0}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg">
                    <Camera size={20} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Recent Images</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      {adminStats?.recent_images || 0}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
                  </div>
                  <div className="p-2 bg-green-700/10 text-green-800 rounded-lg">
                    <Camera size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS VIEW */}
        {userProfile && userSettings && globalSettings && (
          <div className={`space-y-6 ${activeTab === 'settings' ? '' : 'hidden'}`}>
            <header className="mb-8">
              <h2 className="text-3xl font-bold text-black">Integration Settings</h2>
              <p className="text-slate-600 mt-2">Connect your accounts to unlock powerful features</p>
            </header>

            <Settings
              userSettings={userSettings}
              globalSettings={globalSettings}
              userProfile={userProfile}
              onSaveUserSettings={handleSaveUserSettings}
              onSaveGlobalSettings={handleSaveGlobalSettings}
            />
          </div>
        )}

      </main>

      {/* Subscription Manager Modal */}
      {showSubscriptionModal && (
        <SubscriptionManager onClose={() => setShowSubscriptionModal(false)} />
      )}

      {/* Prompt Library Modal */}
      {showPromptLibrary && user && (
        <PromptLibrary
          userId={user.id}
          eventId={promptLibraryEventContext}
          selectedPrompts={editingEvent.prompts || []}
          onClose={() => {
            setShowPromptLibrary(false);
            setPromptLibraryEventContext(null);
          }}
          onAddToEvent={(prompt) => {
            if (promptLibraryEventContext) {
              const currentPrompts = editingEvent.prompts || [];
              const exists = currentPrompts.find(p => p.id === prompt.id);
              if (!exists) {
                setEditingEvent({ ...editingEvent, prompts: [...currentPrompts, prompt] });
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;