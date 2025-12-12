import React, { useState, useEffect } from 'react';
import { getTenant, getEvents, getPrompts, saveEvent, savePrompt, updatePrompt, deletePrompt, updateTenantSettings, deleteEvent } from '../services/backendService';
import { Tenant, Event, Prompt } from '../types';
import { LayoutDashboard, Calendar, Settings as SettingsIcon, LogOut, Zap, Camera, MessageSquare, Plus, Save, X, Image as ImageIcon, Upload, Check, Link2, ExternalLink, BarChart3, Trash2, Pencil, CreditCard } from 'lucide-react';
import Settings from './Settings';
import EventAnalytics from './EventAnalytics';
import SubscriptionManager from './SubscriptionManager';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AdminProps {
  onLogout: () => void;
  onLaunchKiosk: (event: Event) => void;
  user: User | null;
}

type Tab = 'dashboard' | 'events' | 'create_event' | 'edit_event' | 'analytics' | 'settings';

const AdminDashboard: React.FC<AdminProps> = ({ onLogout, onLaunchKiosk, user }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Event Editor State
  const [editingEvent, setEditingEvent] = useState<Partial<Event>>({});
  const [availablePrompts, setAvailablePrompts] = useState<Prompt[]>([]);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Analytics State
  const [analyticsEvent, setAnalyticsEvent] = useState<Event | null>(null);

  // Prompt Builder State
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState<Partial<Prompt>>({
    name: '',
    category: 'Custom',
    promptText: '',
    description: 'Custom generated style',
    previewImage: '',
    referenceImage: ''
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  useEffect(() => {
    loadData();
    loadUserProfile();
  }, [user]);

  const loadData = () => {
    getTenant().then(setTenant);
    getEvents().then(setEvents);
    getPrompts().then(setAvailablePrompts);
  };

  const loadUserProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    setUserProfile(data);
  };

  const copyKioskLink = (event: Event) => {
    const url = `${window.location.origin}/?kiosk=${event.passcode}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Kiosk link copied!\n\nShare this URL with guests:\n${url}`);
    }).catch(() => {
      alert(`Kiosk URL:\n${url}\n\n(Copy this link to share with guests)`);
    });
  };

  const handleSaveSettings = async (updates: Partial<Tenant>) => {
    await updateTenantSettings(updates);
    await loadData();
  };

  const handleCreateEvent = () => {
    setEditingEvent({
      id: `evt_${Date.now()}`,
      name: '',
      city: '',
      date: new Date().toISOString().split('T')[0],
      passcode: '',
      isActive: true,
      prompts: [],
      tenantId: tenant?.id || '',
      aspectRatio: 'square'
    });
    setActiveTab('create_event');
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent({ ...event });
    setActiveTab('edit_event');
  };

  const handleViewAnalytics = (event: Event) => {
    setAnalyticsEvent(event);
    setActiveTab('analytics');
  };

  const handleSaveEvent = async () => {
    if (!editingEvent.name || !editingEvent.passcode) {
      alert("Please fill in the required fields (Name, Passcode)");
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

  // --- IMAGE UPLOAD HELPERS ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'previewImage' | 'referenceImage') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPrompt(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPromptId(prompt.id);
    setNewPrompt({
      name: prompt.name,
      category: prompt.category,
      promptText: prompt.promptText,
      description: prompt.description,
      previewImage: prompt.previewImage,
      referenceImage: prompt.referenceImage
    });
    setIsPromptModalOpen(true);
  };

  const handleDeletePrompt = async (promptId: string, promptName: string) => {
    if (!confirm(`Are you sure you want to delete "${promptName}"? This will remove it from all events.`)) {
      return;
    }

    try {
      await deletePrompt(promptId);
      await loadData();

      setEditingEvent(prev => ({
        ...prev,
        prompts: (prev.prompts || []).filter(p => p.id !== promptId)
      }));
    } catch (error: any) {
      alert(`Failed to delete prompt: ${error.message}`);
      console.error('Delete prompt error:', error);
    }
  };

  const handleSaveNewPrompt = async () => {
    if (!newPrompt.name || !newPrompt.promptText || !newPrompt.previewImage) {
      alert("Name, Prompt Text, and Preview Image are required.");
      return;
    }

    try {
      if (editingPromptId) {
        const updatedPrompt = await updatePrompt(editingPromptId, newPrompt);
        await loadData();

        setEditingEvent(prev => ({
          ...prev,
          prompts: (prev.prompts || []).map(p =>
            p.id === editingPromptId ? updatedPrompt : p
          )
        }));
      } else {
        const promptToSave: Prompt = {
          id: `p_${Date.now()}`,
          name: newPrompt.name!,
          description: newPrompt.description || '',
          category: newPrompt.category || 'Custom',
          promptText: newPrompt.promptText!,
          previewImage: newPrompt.previewImage!,
          referenceImage: newPrompt.referenceImage
        };

        const savedPrompt = await savePrompt(promptToSave);
        await loadData();

        setEditingEvent(prev => ({
          ...prev,
          prompts: [...(prev.prompts || []), savedPrompt]
        }));
      }

      setIsPromptModalOpen(false);
      setEditingPromptId(null);
      setNewPrompt({ name: '', category: 'Custom', promptText: '', description: '', previewImage: '', referenceImage: '' });
    } catch (error: any) {
      alert(`Failed to save prompt: ${error.message}`);
      console.error('Save prompt error:', error);
    }
  };

  if (!tenant) return <div className="flex h-screen items-center justify-center text-white bg-slate-950">Loading Dashboard...</div>;

  const usagePercent = (tenant.usage.imagesUsed / tenant.usage.imagesLimit) * 100;

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tighter text-blue-500 flex items-center gap-2">
            <Camera size={24} />
            Fun Frame AI
          </h1>
          {userProfile && (
            <div className="mt-3 text-xs">
              <p className="text-slate-400 truncate">{userProfile.email}</p>
              <p className="text-slate-500 mt-1 uppercase tracking-widest">
                {userProfile.subscription_tier || tenant.tier} PLAN
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-900 text-slate-400'}`}
          >
            <LayoutDashboard size={20} />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'events' || activeTab.includes('event') ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-900 text-slate-400'}`}
          >
            <Calendar size={20} />
            Events
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-900 text-slate-400'}`}
          >
            <SettingsIcon size={20} />
            Settings
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-4">
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Credits</span>
              <span>{tenant.usage.imagesUsed} / {tenant.usage.imagesLimit}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${usagePercent}%` }}></div>
            </div>
          </div>
          <button
            onClick={() => setShowSubscriptionModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all"
          >
            <CreditCard size={16} />
            Manage Plan
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8 relative">
        
        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Dashboard</h2>
              <button 
                onClick={handleCreateEvent}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2"
              >
                <Plus size={16} /> New Event
              </button>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-sm">Total Images</p>
                    <h3 className="text-3xl font-bold mt-1">{tenant.usage.imagesUsed}</h3>
                  </div>
                  <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg"><Camera size={20}/></div>
                </div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-sm">SMS Delivered</p>
                    <h3 className="text-3xl font-bold mt-1">{tenant.usage.smsUsed}</h3>
                  </div>
                  <div className="p-2 bg-green-500/20 text-green-400 rounded-lg"><MessageSquare size={20}/></div>
                </div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-sm">Est. Revenue</p>
                    <h3 className="text-3xl font-bold mt-1">$1,240</h3>
                  </div>
                  <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg"><Zap size={20}/></div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-80">
              <h3 className="text-lg font-semibold mb-4">Generation Activity</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Bar dataKey="images" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* EVENTS LIST VIEW */}
        {activeTab === 'events' && (
          <div className="space-y-6">
             <header className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Your Events</h2>
              <button 
                onClick={handleCreateEvent}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2"
              >
                <Plus size={16} /> Create Event
              </button>
            </header>

            <div className="grid gap-4">
              {events.map(event => (
                <div key={event.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex justify-between items-center group hover:border-blue-500/50 transition-colors">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {event.name}
                      {event.isActive && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Active</span>}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{event.city} • {event.date}</p>
                    <p className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                      <ExternalLink size={12} />
                      <span className="font-mono">/?kiosk={event.passcode}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleViewAnalytics(event)}
                      className="px-4 py-2 rounded-md border border-purple-600 text-purple-400 hover:bg-purple-600/10 text-sm font-medium flex items-center gap-2"
                      title="View event analytics"
                    >
                      <BarChart3 size={16} /> Analytics
                    </button>
                    <button
                      onClick={() => handleEditEvent(event)}
                      className="px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-700 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => copyKioskLink(event)}
                      className="px-4 py-2 rounded-md border border-blue-600 text-blue-400 hover:bg-blue-600/10 text-sm font-medium flex items-center gap-2"
                      title="Copy shareable kiosk link"
                    >
                      <Link2 size={16} /> Copy Link
                    </button>
                    <button
                      onClick={() => onLaunchKiosk(event)}
                      className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-sm font-medium shadow-lg shadow-blue-900/20"
                    >
                      Launch Kiosk
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event)}
                      className="px-4 py-2 rounded-md border border-red-600 text-red-400 hover:bg-red-600/10 text-sm font-medium flex items-center gap-2"
                      title="Delete event"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CREATE / EDIT EVENT VIEW */}
        {(activeTab === 'create_event' || activeTab === 'edit_event') && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <header className="flex justify-between items-center mb-4">
              <button onClick={() => setActiveTab('events')} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm">
                &larr; Back to Events
              </button>
              <h2 className="text-2xl font-bold">{activeTab === 'create_event' ? 'Create New Event' : 'Edit Event'}</h2>
            </header>

            <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 space-y-6">
              {/* Event Details Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Event Name</label>
                  <input
                    type="text"
                    value={editingEvent.name}
                    onChange={(e) => setEditingEvent({...editingEvent, name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. Summer Gala 2024"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">City / Venue</label>
                  <input
                    type="text"
                    value={editingEvent.city}
                    onChange={(e) => setEditingEvent({...editingEvent, city: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. New York, NY"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Event Date</label>
                  <input
                    type="date"
                    value={editingEvent.date}
                    onChange={(e) => setEditingEvent({...editingEvent, date: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Kiosk Passcode</label>
                  <input
                    type="text"
                    value={editingEvent.passcode}
                    onChange={(e) => setEditingEvent({...editingEvent, passcode: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="e.g. 1234"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Start Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={editingEvent.startDatetime ? new Date(editingEvent.startDatetime).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingEvent({...editingEvent, startDatetime: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-slate-500">Kiosk will be locked before this time</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">End Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={editingEvent.endDatetime ? new Date(editingEvent.endDatetime).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingEvent({...editingEvent, endDatetime: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-slate-500">Kiosk will be locked after this time</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Photo Aspect Ratio</label>
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
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-2xl mb-2">{ratio.icon}</div>
                      <div className="text-xs font-medium">{ratio.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Branding Customization Section */}
              <div className="pt-8 border-t border-slate-700">
                <h3 className="text-lg font-bold mb-4">Kiosk Branding</h3>
                <p className="text-sm text-slate-400 mb-6">Customize the appearance of the kiosk for this event</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Background Image URL</label>
                    <input
                      type="text"
                      value={editingEvent.backgroundImageUrl || ''}
                      onChange={(e) => setEditingEvent({...editingEvent, backgroundImageUrl: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="https://example.com/background.jpg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Logo URL</label>
                    <input
                      type="text"
                      value={editingEvent.logoUrl || ''}
                      onChange={(e) => setEditingEvent({...editingEvent, logoUrl: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Primary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingEvent.primaryColor || '#6366f1'}
                        onChange={(e) => setEditingEvent({...editingEvent, primaryColor: e.target.value})}
                        className="w-16 h-10 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingEvent.primaryColor || ''}
                        onChange={(e) => setEditingEvent({...editingEvent, primaryColor: e.target.value})}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Secondary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingEvent.secondaryColor || '#8b5cf6'}
                        onChange={(e) => setEditingEvent({...editingEvent, secondaryColor: e.target.value})}
                        className="w-16 h-10 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingEvent.secondaryColor || ''}
                        onChange={(e) => setEditingEvent({...editingEvent, secondaryColor: e.target.value})}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                        placeholder="#8b5cf6"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Accent Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingEvent.accentColor || '#ec4899'}
                        onChange={(e) => setEditingEvent({...editingEvent, accentColor: e.target.value})}
                        className="w-16 h-10 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingEvent.accentColor || ''}
                        onChange={(e) => setEditingEvent({...editingEvent, accentColor: e.target.value})}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                        placeholder="#ec4899"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 space-y-4">
                  <p className="text-sm font-medium text-slate-400">Visibility Options</p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingEvent.hideLogo || false}
                        onChange={(e) => setEditingEvent({...editingEvent, hideLogo: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-white">Hide Logo on Attract Screen</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingEvent.hideEventName || false}
                        onChange={(e) => setEditingEvent({...editingEvent, hideEventName: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-white">Hide Event Name on Attract Screen</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Prompt Selection Section */}
              <div className="pt-8 border-t border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold">AI Experience Prompts</h3>
                    <p className="text-sm text-slate-400">
                      Select which styles are available for this event
                      {editingEvent.prompts && editingEvent.prompts.length > 0 && (
                        <span className="ml-2 text-blue-400 font-medium">
                          ({editingEvent.prompts.length} selected)
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingPromptId(null);
                      setNewPrompt({ name: '', category: 'Custom', promptText: '', description: '', previewImage: '', referenceImage: '' });
                      setIsPromptModalOpen(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                  >
                    <Zap size={16} /> Build Custom Prompt
                  </button>
                </div>

                {/* Selected Prompts with Edit/Delete */}
                {editingEvent.prompts && editingEvent.prompts.length > 0 && (
                  <div className="mb-6 space-y-3">
                    <h4 className="text-sm font-medium text-slate-400">Selected Prompts for This Event</h4>
                    <div className="grid gap-3">
                      {editingEvent.prompts.map(prompt => (
                        <div
                          key={prompt.id}
                          className="flex items-center gap-4 p-3 bg-slate-900/50 border border-blue-500/30 rounded-lg"
                        >
                          <img src={prompt.previewImage} alt={prompt.name} className="h-16 w-16 object-cover rounded" />
                          <div className="flex-1">
                            <h4 className="font-bold text-sm">{prompt.name}</h4>
                            <p className="text-xs text-slate-500">{prompt.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditPrompt(prompt)}
                              className="px-3 py-2 rounded-md border border-slate-600 hover:bg-slate-700 text-sm flex items-center gap-2"
                              title="Edit prompt"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeletePrompt(prompt.id, prompt.name)}
                              className="px-3 py-2 rounded-md border border-red-600 text-red-400 hover:bg-red-600/10 text-sm flex items-center gap-2"
                              title="Delete prompt"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              onClick={() => togglePromptSelection(prompt)}
                              className="px-3 py-2 rounded-md border border-slate-600 hover:bg-slate-700 text-sm"
                              title="Remove from event"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-slate-400">Available Prompts</h4>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Filter:</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs text-slate-300"
                    >
                      <option value="All">All Categories</option>
                      {Array.from(new Set(availablePrompts.map(p => p.category))).sort().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {availablePrompts
                    .filter(prompt => categoryFilter === 'All' || prompt.category === categoryFilter)
                    .map(prompt => {
                      const isSelected = editingEvent.prompts?.some(p => p.id === prompt.id);
                      return (
                        <div
                          key={prompt.id}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all group ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700 hover:border-slate-500'}`}
                        >
                          <div
                            onClick={() => togglePromptSelection(prompt)}
                            className="cursor-pointer"
                          >
                            <img src={prompt.previewImage} alt={prompt.name} className="h-32 w-full object-cover" />
                            <div className="p-3 bg-slate-900">
                              <h4 className="font-bold text-sm truncate">{prompt.name}</h4>
                              <p className="text-xs text-slate-500 truncate">{prompt.category}</p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                              <Check size={12} />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPrompt(prompt);
                              }}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white"
                              title="Edit prompt"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePrompt(prompt.id, prompt.name);
                              }}
                              className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white"
                              title="Delete prompt"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-6 border-t border-slate-700">
                 <button 
                  onClick={handleSaveEvent}
                  className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2"
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
                <button onClick={() => setActiveTab('events')} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm mb-4">
                  &larr; Back to Events
                </button>
                <h2 className="text-3xl font-bold">{analyticsEvent.name} Analytics</h2>
                <p className="text-slate-400 mt-2">{analyticsEvent.city} • {analyticsEvent.date}</p>
              </div>
            </header>

            <EventAnalytics eventId={analyticsEvent.id} eventName={analyticsEvent.name} />
          </div>
        )}

        {/* SETTINGS VIEW */}
        {tenant && (
          <div className={`space-y-6 ${activeTab === 'settings' ? '' : 'hidden'}`}>
            <header className="mb-8">
              <h2 className="text-3xl font-bold">Integration Settings</h2>
              <p className="text-slate-400 mt-2">Connect your accounts to unlock powerful features</p>
            </header>

            <Settings tenant={tenant} onSave={handleSaveSettings} />
          </div>
        )}

        {/* PROMPT BUILDER MODAL */}
        {isPromptModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <header className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {editingPromptId ? (
                    <>
                      <Pencil size={20} className="text-blue-500" />
                      Edit Prompt
                    </>
                  ) : (
                    <>
                      <Zap size={20} className="text-purple-500" />
                      Custom Prompt Builder
                    </>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setIsPromptModalOpen(false);
                    setEditingPromptId(null);
                    setNewPrompt({ name: '', category: 'Custom', promptText: '', description: '', previewImage: '', referenceImage: '' });
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </header>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Prompt Name *</label>
                    <input
                      type="text"
                      value={newPrompt.name}
                      onChange={(e) => setNewPrompt({...newPrompt, name: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      placeholder="e.g. Neon Noir"
                    />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-400">Category *</label>
                     <input
                      type="text"
                      value={newPrompt.category}
                      onChange={(e) => setNewPrompt({...newPrompt, category: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      placeholder="e.g. Artistic, Professional, Vintage"
                    />
                    <p className="text-[10px] text-slate-500">Create custom categories or use existing ones</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Description (Optional)</label>
                  <input
                    type="text"
                    value={newPrompt.description}
                    onChange={(e) => setNewPrompt({...newPrompt, description: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="e.g. Cyberpunk-inspired neon lighting"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">AI Prompt Text *</label>
                  <textarea
                    value={newPrompt.promptText}
                    onChange={(e) => setNewPrompt({...newPrompt, promptText: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 h-24 resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="Describe the style, lighting, and environment..."
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Preview Image Upload */}
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                       <ImageIcon size={16} /> Kiosk Thumbnail *
                     </label>
                     <div className="relative group border-2 border-dashed border-slate-800 rounded-xl h-40 flex flex-col items-center justify-center bg-slate-950 overflow-hidden hover:border-blue-500 transition-colors cursor-pointer">
                        {newPrompt.previewImage ? (
                          <>
                            <img src={newPrompt.previewImage} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="text-center">
                                <Upload className="mx-auto mb-2 text-white" size={24} />
                                <span className="text-xs text-white font-medium">Click to Replace Image</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-4">
                            <Upload className="mx-auto mb-2 text-slate-600" size={24} />
                            <span className="text-xs text-slate-500">Click to Upload Thumbnail</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'previewImage')}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                     </div>
                     <p className="text-[10px] text-slate-500">This image appears in the kiosk style selector</p>
                  </div>

                  {/* Reference Image Upload */}
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                       <ImageIcon size={16} /> AI Style Reference (Optional)
                     </label>
                     <div className="relative group border-2 border-dashed border-slate-800 rounded-xl h-40 flex flex-col items-center justify-center bg-slate-950 overflow-hidden hover:border-purple-500 transition-colors cursor-pointer">
                        {newPrompt.referenceImage ? (
                          <>
                            <img src={newPrompt.referenceImage} alt="Reference" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="text-center">
                                <Upload className="mx-auto mb-2 text-white" size={24} />
                                <span className="text-xs text-white font-medium">Click to Replace Image</span>
                                {newPrompt.referenceImage && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNewPrompt({...newPrompt, referenceImage: ''});
                                    }}
                                    className="mt-2 px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-4">
                            <Upload className="mx-auto mb-2 text-slate-600" size={24} />
                            <span className="text-xs text-slate-500">Click to Upload Style Ref</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'referenceImage')}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                     </div>
                     <p className="text-[10px] text-slate-500">Upload a sample photo that defines the visual style for the AI to mimic</p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsPromptModalOpen(false);
                    setEditingPromptId(null);
                    setNewPrompt({ name: '', category: 'Custom', promptText: '', description: '', previewImage: '', referenceImage: '' });
                  }}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewPrompt}
                  className={`${editingPromptId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'} text-white px-6 py-2 rounded-lg font-bold`}
                >
                  {editingPromptId ? 'Update Prompt' : 'Create Prompt'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Subscription Manager Modal */}
      {showSubscriptionModal && (
        <SubscriptionManager onClose={() => setShowSubscriptionModal(false)} />
      )}
    </div>
  );
};

export default AdminDashboard;