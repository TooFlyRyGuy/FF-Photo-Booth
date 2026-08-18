import React, { useState, useEffect } from 'react';
import { getUserProfile, getUserSettings, getUserCredits, updateUserSettings, updateGlobalSettings, getGlobalSettings, getEvents, getEventById, getPrompts, getPromptById, saveEvent, savePrompt, updatePrompt, deletePrompt, deleteEvent, duplicateEvent, grantEventAccess, revokeEventAccess, getEventAccessList, transferEventOwnership, getDashboardStats, getDashboardChartData, DashboardStats, ChartDataPoint, clearPromptsCache, clearGlobalSettingsCache, getAllUsers, getAllEvents, getAllPrompts, getAdminStats, getRevenueStats, getGenerationsByDateAndEvent, EventGenerationBreakdown, validateEventTimeRestrictions, syncSmugMugGallery, createSmugMugGalleryForEvent, getConcurrentEventLimit, hasActivatedEventPass, completeOnboarding, getEventDeviceUsage, resetDeviceUsage, DeviceUsageEntry, generateAccessCodes, getEventAccessCodes, deleteAccessCode, deleteAllAccessCodes } from '../services/backendService';
import { UserProfile, UserSettings, GlobalSettings, UserCredits, Event, Prompt, ConcurrentEventLimit, EventAccessCode } from '../types';
import { LayoutDashboard, Calendar, Settings as SettingsIcon, LogOut, Zap, Camera, MessageSquare, Plus, Save, X, Image as ImageIcon, Upload, Check, Link2, ExternalLink, ChartBar as BarChart3, Trash2, Pencil, CreditCard, Menu, ChevronLeft, BookImage, GripVertical, RefreshCw, Images, Users, DollarSign, Search, User as UserIcon, Package, Printer, CircleUser as UserCircle, Copy, Crown, Ticket, Circle as HelpCircle, Smartphone, RotateCcw, QrCode, Download } from 'lucide-react';
import Settings from './Settings';
import EventAnalytics from './EventAnalytics';
import SubscriptionManager from './SubscriptionManager';
import PromptLibrary from './PromptLibrary';
import UserManagement from './UserManagement';
import PlanManagement from './PlanManagement';
import CreditDisplay from './CreditDisplay';
import ProfileManagement from './ProfileManagement';
import { EventPassSelector } from './EventPassSelector';
import { SmugMugGallerySync } from './SmugMugGallerySync';
import { TimezoneDateTimePicker } from './TimezoneDateTimePicker';
import { CollapsibleSection } from './CollapsibleSection';
import { AddOnShowcase } from './AddOnShowcase';
import HelpCenter from './HelpCenter';
import OnboardingTutorial from './OnboardingTutorial';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeLib from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { COMMON_TIMEZONES, detectUserTimezone, getTimezoneAbbreviation } from '../services/timezoneService';

interface AdminProps {
  onLogout: () => void;
  onLaunchKiosk: (event: Event) => void;
  user: User | null;
}

type Tab = 'dashboard' | 'events' | 'create_event' | 'edit_event' | 'analytics' | 'settings' | 'prompts' | 'users' | 'plans' | 'reports' | 'profile' | 'help';

const getEventStatus = (event: Event): { status: 'upcoming' | 'active' | 'ended'; label: string; colorClass: string } => {
  const now = new Date();
  const startDate = event.startDatetime ? new Date(event.startDatetime) : null;
  const endDate = event.endDatetime ? new Date(event.endDatetime) : null;

  if (endDate && now > endDate) {
    return { status: 'ended', label: 'ENDED', colorClass: 'bg-red-100 text-red-800' };
  }

  if (startDate && now < startDate) {
    const formattedDate = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { status: 'upcoming', label: `Starts ${formattedDate}`, colorClass: 'bg-yellow-100 text-yellow-800' };
  }

  if (event.isActive) {
    return { status: 'active', label: 'ACTIVE', colorClass: 'bg-green-700/20 text-green-800' };
  }

  return { status: 'ended', label: 'INACTIVE', colorClass: 'bg-slate-200 text-slate-600' };
};

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
  const [accessModal, setAccessModal] = useState<{ eventId: string; eventName: string; eventOwnerId: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [eventAccessList, setEventAccessList] = useState<Array<{ userId: string; email: string; fullName: string | null; grantedAt: string }>>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [generationBreakdown, setGenerationBreakdown] = useState<EventGenerationBreakdown[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [showInactiveEvents, setShowInactiveEvents] = useState(false);
  const [concurrentEventLimit, setConcurrentEventLimit] = useState<ConcurrentEventLimit | null>(null);
  const [eventTimezone, setEventTimezone] = useState<string>('');
  const [isStartTimeLocked, setIsStartTimeLocked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [deviceUsageEntries, setDeviceUsageEntries] = useState<DeviceUsageEntry[]>([]);
  const [loadingDeviceUsage, setLoadingDeviceUsage] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [accessCodes, setAccessCodes] = useState<EventAccessCode[]>([]);
  const [qrGenerateCount, setQrGenerateCount] = useState(10);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalEvent, setQrModalEvent] = useState<Event | null>(null);

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

      const isAdmin = profileData.role?.toLowerCase() === 'admin';

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

      const userTz = profileData.timezone || detectUserTimezone();
      setEventTimezone(userTz);

      console.log('Loaded data successfully:', {
        userId: profileData?.id || 'unknown',
        role: profileData?.role || 'user',
        events: (eventsData || []).length,
        timezone: userTz
      });

      if (!profileData.onboardingCompleted && (eventsData || []).length === 0) {
        setTimeout(() => setShowOnboarding(true), 600);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLoadError(errorMessage);
      setIsLoading(false);
    }
  };

  const loadConcurrentEventLimit = async (eventId?: string) => {
    try {
      const limit = await getConcurrentEventLimit(eventId);
      setConcurrentEventLimit(limit);
    } catch (error) {
      console.error('Failed to load concurrent event limit:', error);
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

      await loadConcurrentEventLimit();
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
    if (userProfile?.role === 'admin' && (activeTab === 'users' || activeTab === 'reports')) {
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

  const handleBarClick = async (data: any) => {
    if (!data || !data.date) return;

    setSelectedDate(data.date);
    setShowGenerationModal(true);

    try {
      const breakdown = await getGenerationsByDateAndEvent(data.date);
      setGenerationBreakdown(breakdown);
    } catch (error) {
      console.error('Failed to load generation breakdown:', error);
      setGenerationBreakdown([]);
    }
  };

  const printQRCode = (event: Event) => {
    const url = `${window.location.origin}/?kiosk=${event.passcode}`;
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print QR Code - ${event.name}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 40px;
                background: white;
              }
              .container {
                text-align: center;
                max-width: 600px;
              }
              .logo {
                max-width: 300px;
                max-height: 150px;
                margin-bottom: 32px;
                object-fit: contain;
              }
              h2 {
                font-size: 36px;
                font-weight: 700;
                color: #059669;
                margin-bottom: 24px;
              }
              h1 {
                font-size: 48px;
                font-weight: 900;
                color: #1f2937;
                margin-bottom: 48px;
                letter-spacing: -0.5px;
              }
              .qr-container {
                display: inline-block;
                padding: 32px;
                background: white;
                border: 4px solid #1f2937;
                border-radius: 16px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
              }
              #qr-code canvas {
                display: block;
              }
              @media print {
                body {
                  padding: 0;
                }
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${event.logoUrl ? `<img src="${event.logoUrl}" alt="Event Logo" class="logo" />` : ''}
              ${!event.hideEventName ? `<h2>${event.name}</h2>` : ''}
              <h1>SCAN HERE TO USE OUR<br>AI PHOTO BOOTH!</h1>
              <div class="qr-container">
                <div id="qr-code"></div>
              </div>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
              window.addEventListener('load', function() {
                try {
                  new QRCode(document.getElementById('qr-code'), {
                    text: '${url}',
                    width: 400,
                    height: 400,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                  });
                  setTimeout(function() {
                    window.print();
                  }, 1000);
                } catch (error) {
                  console.error('QR Code generation error:', error);
                  document.getElementById('qr-code').innerHTML = '<p>Error generating QR code</p>';
                }
              });
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const openQrAccessModal = async (event: Event) => {
    setQrModalEvent(event);
    setShowQrModal(true);
    try {
      const codes = await getEventAccessCodes(event.id);
      setAccessCodes(codes);
    } catch (err) {
      console.error('Failed to load access codes:', err);
      setAccessCodes([]);
    }
  };

  const handleGenerateCodes = async () => {
    if (!qrModalEvent) return;
    setIsGeneratingCodes(true);
    try {
      await generateAccessCodes(qrModalEvent.id, qrGenerateCount);
      const codes = await getEventAccessCodes(qrModalEvent.id);
      setAccessCodes(codes);
    } catch (err) {
      alert(`Failed to generate codes: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm('Delete this access code? This cannot be undone.')) return;
    try {
      await deleteAccessCode(codeId);
      if (qrModalEvent) {
        const codes = await getEventAccessCodes(qrModalEvent.id);
        setAccessCodes(codes);
      }
    } catch (err) {
      alert(`Failed to delete code: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const [isDeletingAllCodes, setIsDeletingAllCodes] = useState(false);

  const handleDeleteAllCodes = async () => {
    if (!qrModalEvent) return;
    if (!confirm('ARE YOU SURE? This will remove all tokens')) return;
    setIsDeletingAllCodes(true);
    try {
      await deleteAllAccessCodes(qrModalEvent.id);
      const codes = await getEventAccessCodes(qrModalEvent.id);
      setAccessCodes(codes);
    } catch (err) {
      alert(`Failed to delete all codes: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsDeletingAllCodes(false);
    }
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrintQrCodes = async () => {
    if (!qrModalEvent || accessCodes.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const origin = window.location.origin;
      const pdf = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' });

      const MARGIN = 0.625;
      const LABEL_SIZE = 1;
      const GAP = 0.25;
      const COLS = 6;
      const ROWS = 8;
      const QR_SIZE = 0.875;
      const QR_OFFSET = (LABEL_SIZE - QR_SIZE) / 2;
      const PER_PAGE = COLS * ROWS;
      const pageCount = Math.ceil(accessCodes.length / PER_PAGE);

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        if (pageIndex > 0) pdf.addPage();

        const pageCodes = accessCodes.slice(pageIndex * PER_PAGE, (pageIndex + 1) * PER_PAGE);

        for (let slotIndex = 0; slotIndex < pageCodes.length; slotIndex++) {
          const code = pageCodes[slotIndex];
          const col = slotIndex % COLS;
          const row = Math.floor(slotIndex / COLS);
          const x = MARGIN + col * (LABEL_SIZE + GAP);
          const y = MARGIN + row * (LABEL_SIZE + GAP);

          const url = `${origin}/?access=${encodeURIComponent(code.token)}`;
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 300;
          await QRCodeLib.toCanvas(canvas, url, {
            width: 300,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M',
          });
          const dataUrl = canvas.toDataURL('image/png');
          pdf.addImage(dataUrl, 'PNG', x + QR_OFFSET, y + QR_OFFSET, QR_SIZE, QR_SIZE);
        }

        const labelY = MARGIN + ROWS * (LABEL_SIZE + GAP) - GAP + 0.15;
        pdf.setFontSize(7);
        pdf.setTextColor(150);
        pdf.text('Avery Presta 94103 - 1 inch square labels, 48 per sheet', MARGIN, labelY);
      }

      const safeName = qrModalEvent.name.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`QR-Codes-${safeName}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert(`Failed to generate PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const [isDownloadingCodes, setIsDownloadingCodes] = useState(false);

  const handleDownloadQrCodes = async () => {
    if (!qrModalEvent || accessCodes.length === 0) return;
    const unusedCodes = accessCodes.filter(c => !c.isUsed);
    if (unusedCodes.length === 0) {
      alert('No unused codes available to download.');
      return;
    }
    setIsDownloadingCodes(true);
    try {
      const origin = window.location.origin;
      const zip = new JSZip();
      const folder = zip.folder(`QR-Codes-${qrModalEvent.name.replace(/[^a-zA-Z0-9]/g, '_')}`)!;

      for (let i = 0; i < unusedCodes.length; i++) {
        const code = unusedCodes[i];
        const url = `${origin}/?access=${code.token}`;
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        await QRCodeLib.toCanvas(canvas, url, {
          width: 600,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
        });
        const passNum = accessCodes.indexOf(code) + 1;
        folder.file(`Pass-${passNum}.jpg`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `QR-Codes-${qrModalEvent.name.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
      alert(`Failed to download QR codes: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsDownloadingCodes(false);
    }
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

  const handleCreateEvent = async () => {
    await loadConcurrentEventLimit();
    setIsStartTimeLocked(false); // New events don't have locked start times
    setEditingEvent({
      id: '',
      name: '',
      city: '',
      date: new Date().toISOString().split('T')[0],
      passcode: generateUniquePasscode(),
      isActive: true,
      prompts: [],
      userId: user?.id || '',
      aspectRatio: 'square',
      limitPhotosPerDevice: false,
      maxPhotosPerDevice: 0,
      qrAccessEnabled: false,
      galleryEnabled: false
    });
    setActiveTab('create_event');
  };

  const handleEditEvent = async (event: Event) => {
    try {
      const eventWithPrompts = await getEventById(event.id);

      // Check if event has an activated pass (which locks start time)
      const hasActivatedPass = await hasActivatedEventPass(event.id);
      setIsStartTimeLocked(hasActivatedPass);

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
      const validation = await validateEventTimeRestrictions(
        editingEvent.startDatetime,
        editingEvent.endDatetime,
        (editingEvent as any).passId,
        editingEvent.id
      );

      if (!validation.isValid) {
        alert(validation.errorMessage || 'Event validation failed');
        return;
      }

      await saveEvent(editingEvent as Event);
      await loadData();
      await loadConcurrentEventLimit();
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

  const handleDuplicateEvent = async (event: Event) => {
    if (!confirm(`Duplicate "${event.name}"? This will create a new event with the same settings, prompts, and a new SmugMug gallery.`)) {
      return;
    }

    try {
      const newEvent = await duplicateEvent(event.id);
      await loadData();
      alert(`Event duplicated successfully! New kiosk code: ${newEvent.passcode}`);
    } catch (error: any) {
      alert(`Failed to duplicate event: ${error.message}`);
      console.error('Duplicate event error:', error);
    }
  };

  const openAccessModal = async (event: Event) => {
    setAccessModal({ eventId: event.id, eventName: event.name, eventOwnerId: event.userId || '' });
    setSelectedUserId('');
    setUserSearchQuery('');

    try {
      const [usersData, accessList] = await Promise.all([
        getAllUsers(),
        getEventAccessList(event.id)
      ]);

      console.log('Loaded users:', usersData);
      setAllUsers(usersData || []);
      setEventAccessList(accessList);
    } catch (error) {
      console.error('Failed to load access data:', error);
      alert('Failed to load users. Please try again.');
    }
  };

  const handleGrantAccess = async () => {
    if (!accessModal || !selectedUserId) {
      alert('Please select a user to grant access to.');
      return;
    }

    if (selectedUserId === accessModal.eventOwnerId) {
      alert('This user already owns this event.');
      return;
    }

    setGrantingAccess(true);
    try {
      await grantEventAccess(accessModal.eventId, selectedUserId);
      setSelectedUserId('');

      const accessList = await getEventAccessList(accessModal.eventId);
      setEventAccessList(accessList);

      await loadData();
    } catch (error: any) {
      alert(`Failed to grant access: ${error.message}`);
      console.error('Grant access error:', error);
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!accessModal) return;

    if (!confirm('Are you sure you want to revoke access for this user?')) {
      return;
    }

    try {
      await revokeEventAccess(accessModal.eventId, userId);

      const accessList = await getEventAccessList(accessModal.eventId);
      setEventAccessList(accessList);

      await loadData();
    } catch (error: any) {
      alert(`Failed to revoke access: ${error.message}`);
      console.error('Revoke access error:', error);
    }
  };

  const handleTransferOwnership = async (newOwnerId: string, newOwnerEmail: string) => {
    if (!accessModal) return;

    if (!confirm(`Are you sure you want to transfer ownership of "${accessModal.eventName}" to ${newOwnerEmail}? This will make the event count against their subscription limits and credits. This action cannot be undone.`)) {
      return;
    }

    try {
      await transferEventOwnership(accessModal.eventId, newOwnerId);

      setAccessModal(null);
      setSelectedUserId('');
      setEventAccessList([]);

      await loadData();

      alert('Ownership transferred successfully!');
    } catch (error: any) {
      alert(`Failed to transfer ownership: ${error.message}`);
      console.error('Transfer ownership error:', error);
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

  const isAdmin = userProfile.role?.toLowerCase() === 'admin';

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
        fixed inset-y-0 left-0 z-40 overflow-y-auto
        md:relative md:overflow-hidden ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'}
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

        <nav className={`flex-1 md:overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-4'} space-y-2`}>
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
            id="onboarding-events-nav"
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
            id="onboarding-prompts-nav"
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
            id="onboarding-settings-nav"
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
          <button
            onClick={() => {
              setActiveTab('profile');
              setMobileMenuOpen(false);
            }}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
            title={sidebarCollapsed ? 'Profile' : ''}
          >
            <UserCircle size={20} />
            {!sidebarCollapsed && 'Profile'}
          </button>
          <button
            onClick={() => {
              setActiveTab('help');
              setMobileMenuOpen(false);
            }}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'help' ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
            title={sidebarCollapsed ? 'Help Center' : ''}
          >
            <HelpCircle size={20} />
            {!sidebarCollapsed && 'Help Center'}
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
                title={sidebarCollapsed ? 'Products' : ''}
              >
                <Package size={20} />
                {!sidebarCollapsed && 'Products'}
              </button>
              <button
                onClick={() => {
                  setActiveTab('reports');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-4 py-3 rounded-lg transition-colors ${activeTab === 'reports' ? 'bg-green-700/10 text-green-800' : 'hover:bg-slate-100 text-slate-600'}`}
                title={sidebarCollapsed ? 'Reports' : ''}
              >
                <BarChart3 size={20} />
                {!sidebarCollapsed && 'Reports'}
              </button>
            </>
          )}
        </nav>

        <div className={`shrink-0 ${sidebarCollapsed ? 'p-2' : 'p-4'} border-t border-slate-300 space-y-4`}>
          {!sidebarCollapsed && user && (
            <CreditDisplay userId={user.id} sidebar={true} />
          )}
          {!sidebarCollapsed ? (
            <>
              <button
                id="onboarding-plan-btn"
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
                id="onboarding-new-event-btn"
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-black">Generation Activity (Last 7 Days)</h3>
                <p className="text-sm text-slate-500 italic">Click bars for event breakdown</p>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis
                    dataKey="date"
                    stroke="#475569"
                    tick={{ fontSize: 12 }}
                    height={50}
                    tickMargin={8}
                  />
                  <YAxis stroke="#475569" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
                    itemStyle={{ color: '#0f172a' }}
                  />
                  <Bar
                    dataKey="generations"
                    fill="#15803d"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => handleBarClick(data)}
                  />
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

            {(() => {
              const activeEvents = filteredEvents.filter(event => {
                const status = getEventStatus(event);
                return status.status === 'active' || status.status === 'upcoming';
              });
              const inactiveEvents = filteredEvents.filter(event => {
                const status = getEventStatus(event);
                return status.status === 'ended';
              });

              return (
                <>
                  <div className="grid gap-4 md:gap-6">
                    {activeEvents.map(event => (
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
                              {(() => {
                                const eventStatus = getEventStatus(event);
                                return (
                                  <span className={`text-xs ${eventStatus.colorClass} px-2 py-0.5 rounded-full font-medium`}>
                                    {eventStatus.label}
                                  </span>
                                );
                              })()}
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
                        onClick={() => event.qrAccessEnabled ? openQrAccessModal(event) : printQRCode(event)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-all flex items-center justify-center gap-2"
                        title="Print QR Code"
                      >
                        <Printer size={16} /> <span className="hidden sm:inline">Print QR</span>
                      </button>

                      <button
                        onClick={() => handleEditEvent(event)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Pencil size={16} /> <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        onClick={() => handleDuplicateEvent(event)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-medium transition-all flex items-center justify-center gap-2"
                        title="Duplicate event"
                      >
                        <Copy size={16} /> <span className="hidden sm:inline">Duplicate</span>
                      </button>

                      {userProfile?.role === 'admin' && (
                        <button
                          onClick={() => openAccessModal(event)}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-green-700 text-green-700 hover:bg-green-50 text-sm font-medium transition-all flex items-center justify-center gap-2"
                          title="Manage access"
                        >
                          <UserIcon size={16} /> <span className="hidden sm:inline">Access</span>
                        </button>
                      )}

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

                  {/* Inactive Events Collapsible Section */}
                  {inactiveEvents.length > 0 && (
                    <div className="mt-8">
                      <button
                        onClick={() => setShowInactiveEvents(!showInactiveEvents)}
                        className="w-full bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 rounded-lg px-6 py-4 flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-200 rounded-lg">
                            <Calendar size={20} className="text-slate-600" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-lg font-bold text-slate-900">Inactive Events</h3>
                            <p className="text-sm text-slate-600">{inactiveEvents.length} event{inactiveEvents.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <ChevronLeft
                          size={24}
                          className={`text-slate-600 transition-transform ${showInactiveEvents ? 'rotate-90' : '-rotate-90'}`}
                        />
                      </button>

                      {showInactiveEvents && (
                        <div className="grid gap-4 md:gap-6 mt-4">
                          {inactiveEvents.map(event => (
                            <div key={event.id} className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden opacity-75 hover:opacity-100 transition-all">
                              <div className="p-4 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-3 mb-2">
                                      <div className="flex-1 min-w-0">
                                        <h3 className="text-lg sm:text-xl font-bold text-black truncate">
                                          {event.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                          {(() => {
                                            const eventStatus = getEventStatus(event);
                                            return (
                                              <span className={`text-xs ${eventStatus.colorClass} px-2 py-0.5 rounded-full font-medium`}>
                                                {eventStatus.label}
                                              </span>
                                            );
                                          })()}
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
                                    onClick={() => event.qrAccessEnabled ? openQrAccessModal(event) : printQRCode(event)}
                                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                    title="Print QR Code"
                                  >
                                    <Printer size={16} /> <span className="hidden sm:inline">Print QR</span>
                                  </button>

                                  <button
                                    onClick={() => handleEditEvent(event)}
                                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                  >
                                    <Pencil size={16} /> <span className="hidden sm:inline">Edit</span>
                                  </button>

                                  <button
                                    onClick={() => handleDuplicateEvent(event)}
                                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                    title="Duplicate event"
                                  >
                                    <Copy size={16} /> <span className="hidden sm:inline">Duplicate</span>
                                  </button>

                                  {userProfile?.role === 'admin' && (
                                    <button
                                      onClick={() => openAccessModal(event)}
                                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border-2 border-green-700 text-green-700 hover:bg-green-50 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                      title="Manage access"
                                    >
                                      <UserIcon size={16} /> <span className="hidden sm:inline">Access</span>
                                    </button>
                                  )}

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
                      )}
                    </div>
                  )}
                </>
              );
            })()}
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

            {/* Event Creation Date Display */}
            {activeTab === 'create_event' && (
              <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Event Creation Date</span>
                  <span className="text-base font-bold text-slate-900">
                    {new Date().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            )}

            {concurrentEventLimit && !isAdmin && activeTab === 'create_event' && concurrentEventLimit.limitCount < 999999 && (
              <div className={`p-4 rounded-lg border-2 ${
                concurrentEventLimit.canCreate
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className={concurrentEventLimit.canCreate ? 'text-green-700' : 'text-red-700'} size={20} />
                    <div>
                      <p className={`text-sm font-semibold ${concurrentEventLimit.canCreate ? 'text-green-900' : 'text-red-900'}`}>
                        Concurrent Events: {concurrentEventLimit.currentCount} / {concurrentEventLimit.limitCount}
                      </p>
                      <p className={`text-xs ${concurrentEventLimit.canCreate ? 'text-green-700' : 'text-red-700'}`}>
                        {concurrentEventLimit.canCreate
                          ? `You can create ${concurrentEventLimit.limitCount - concurrentEventLimit.currentCount} more concurrent ${concurrentEventLimit.limitCount - concurrentEventLimit.currentCount === 1 ? 'event' : 'events'}.`
                          : concurrentEventLimit.errorMessage
                        }
                      </p>
                    </div>
                  </div>
                  {concurrentEventLimit.canCreate && (
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-green-200 rounded-full h-2">
                        <div
                          className="bg-green-700 h-2 rounded-full transition-all"
                          style={{ width: `${(concurrentEventLimit.currentCount / concurrentEventLimit.limitCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {!concurrentEventLimit.canCreate && (
                  <div className="mt-3 p-4 bg-white rounded-lg border border-red-200">
                    <p className="text-sm text-gray-900 font-semibold mb-3">You've reached your event limit. Here are your options:</p>

                    <div className="space-y-3">
                      {/* Deactivate existing event option */}
                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 font-semibold text-sm mt-0.5">
                          1
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 mb-2">
                            <span className="font-semibold">Deactivate an existing event</span> to free up a slot
                          </p>
                          <button
                            onClick={() => setActiveTab('events')}
                            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <Calendar size={16} />
                            Manage Events
                          </button>
                        </div>
                      </div>

                      {/* Upgrade subscription option */}
                      <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold text-sm mt-0.5">
                          2
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 mb-2">
                            <span className="font-semibold text-green-800">Upgrade your subscription</span> for more concurrent events and unlimited features
                          </p>
                          <button
                            onClick={() => setShowSubscriptionModal(true)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                          >
                            <Crown size={16} />
                            View Plans & Upgrade
                          </button>
                        </div>
                      </div>

                      {/* Event pass option */}
                      <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm mt-0.5">
                          3
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 mb-2">
                            <span className="font-semibold text-blue-800">Purchase an event pass</span> for time-limited events without affecting your subscription limits
                          </p>
                          <button
                            onClick={() => setShowSubscriptionModal(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                          >
                            <Ticket size={16} />
                            Buy Event Pass
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-6">
              {/* Event Details Collapsible Section */}
              <CollapsibleSection title="Event Details" defaultOpen={true}>
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
                    <label className="text-sm font-medium text-slate-700">Time Zone</label>
                    <select
                      value={eventTimezone}
                      onChange={(e) => setEventTimezone(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
                    >
                      {COMMON_TIMEZONES.reduce((acc, tz) => {
                        if (!acc.find(group => group.label === tz.group)) {
                          acc.push({ label: tz.group, options: [] });
                        }
                        const group = acc.find(g => g.label === tz.group);
                        if (group) {
                          group.options.push(tz);
                        }
                        return acc;
                      }, [] as Array<{ label: string; options: typeof COMMON_TIMEZONES }>).map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map(tz => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label} ({getTimezoneAbbreviation(tz.value)})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">All event times will be displayed in this timezone</p>
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
                </div>

                {/* Event Time Restrictions */}
                {isStartTimeLocked && (
                  <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="text-yellow-600 mt-0.5">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-yellow-800 mb-1">Start Time Locked</h4>
                        <p className="text-sm text-yellow-700">
                          The start time for this event cannot be changed because an event pass has been activated.
                          The pass duration countdown began when you selected the start time, and modifying it would affect the pass expiration.
                          The end time is automatically set based on the pass duration.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  <TimezoneDateTimePicker
                    label="Start Date & Time (Optional)"
                    value={editingEvent.startDatetime}
                    timezone={eventTimezone}
                    onChange={(isoString) => setEditingEvent({...editingEvent, startDatetime: isoString || undefined})}
                    disabled={isStartTimeLocked}
                    helperText={isStartTimeLocked ? "Locked: Event pass activated" : "Kiosk will be locked before this time"}
                  />
                  <TimezoneDateTimePicker
                    label="End Date & Time (Optional)"
                    value={editingEvent.endDatetime}
                    timezone={eventTimezone}
                    onChange={(isoString) => setEditingEvent({...editingEvent, endDatetime: isoString || undefined})}
                    minDate={editingEvent.startDatetime}
                    helperText="Kiosk will be locked after this time"
                  />
                </div>

                {/* Event Pass Selector */}
                <div className="pt-6">
                  <EventPassSelector
                    timezone={eventTimezone}
                    selectedPassId={(editingEvent as any).passId}
                    startDatetime={editingEvent.startDatetime}
                    userRole={userProfile?.role}
                    onSelectPass={(passId, expiresAt) => {
                      setEditingEvent({
                        ...editingEvent,
                        passId: passId as any,
                        passExpiresAt: expiresAt as any,
                        endDatetime: expiresAt,
                      });
                    }}
                  />
                </div>
              </CollapsibleSection>

              {/* Branding Collapsible Section */}
              <CollapsibleSection title="Branding" defaultOpen={false}>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <ImageIcon size={16} />
                      Kiosk Background Image
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
                      Kiosk Logo Image
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
                      Photo Overlay Image (Transparent PNG)
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
                      disabled={globalSettings?.smugmugConnectionStatus !== 'connected'}
                    />
                    <span className="text-black">Upload Original Photos to Gallery</span>
                  </label>
                  {globalSettings?.smugmugConnectionStatus !== 'connected' && (
                    <p className="text-xs text-slate-500 ml-8">
                      Requires SmugMug to be connected in Settings
                    </p>
                  )}
                  {globalSettings?.smugmugConnectionStatus === 'connected' && (
                    <p className="text-xs text-slate-500 ml-8">
                      Original photos will be uploaded to SmugMug gallery after AI generation
                    </p>
                  )}
                </div>
              </CollapsibleSection>

              {/* Kiosk Security */}
              <CollapsibleSection title="Kiosk Security" defaultOpen={false}>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingEvent.limitPhotosPerDevice || false}
                      onChange={(e) => setEditingEvent({...editingEvent, limitPhotosPerDevice: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-300 bg-slate-50 text-green-700 focus:ring-2 focus:ring-green-700"
                    />
                    <span className="text-black">Limit photos per device</span>
                  </label>
                  <p className="text-xs text-slate-500 ml-8">
                    When enabled, each device (identified by a browser token and IP address) can only take a set number of photos at this event. Only successfully generated photos count toward the limit.
                  </p>

                  {editingEvent.limitPhotosPerDevice && (
                    <>
                      <div className="space-y-2 ml-8 pt-2">
                        <label className="text-sm font-medium text-slate-700">Maximum photos per device</label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={editingEvent.maxPhotosPerDevice || 0}
                          onChange={(e) => setEditingEvent({...editingEvent, maxPhotosPerDevice: parseInt(e.target.value) || 0})}
                          className="w-32 bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none text-sm"
                          placeholder="e.g. 5"
                        />
                        <p className="text-xs text-slate-500">
                          The number of photos each device can generate at this event.
                        </p>
                      </div>

                      {editingEvent.id && (
                        <div className="ml-8 pt-4 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!editingEvent.id) return;
                              setShowDeviceModal(true);
                              setLoadingDeviceUsage(true);
                              try {
                                const entries = await getEventDeviceUsage(editingEvent.id);
                                setDeviceUsageEntries(entries);
                              } catch (err) {
                                console.error('Failed to load device usage:', err);
                              } finally {
                                setLoadingDeviceUsage(false);
                              }
                            }}
                            className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-2"
                          >
                            <Smartphone size={16} />
                            View Tracked Devices
                          </button>
                          <p className="text-xs text-slate-400 mt-2">
                            Opens a separate window showing each device's photo count with the ability to reset individual devices.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-4 border-t border-slate-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingEvent.qrAccessEnabled || false}
                        onChange={(e) => setEditingEvent({...editingEvent, qrAccessEnabled: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 bg-slate-50 text-green-700 focus:ring-2 focus:ring-green-700"
                      />
                      <span className="text-black">Enable one-time QR access codes</span>
                    </label>
                    <p className="text-xs text-slate-500 ml-8">
                      When enabled, the Print QR button opens a module to generate unique one-time-use QR codes. Each code grants kiosk entry to exactly one guest. Guests scan a code to enter — once used, it cannot be reused.
                    </p>

                    {editingEvent.qrAccessEnabled && editingEvent.id && (
                      <div className="ml-8 pt-3">
                        <button
                          type="button"
                          onClick={() => openQrAccessModal(editingEvent as Event)}
                          className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-2"
                        >
                          <QrCode size={16} />
                          Manage QR Access Codes
                        </button>
                      </div>
                    )}
                  </div>

                  {editingEvent.smugmugGalleryUrl && (
                    <div className="pt-4 border-t border-slate-200">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingEvent.galleryEnabled || false}
                          onChange={(e) => setEditingEvent({...editingEvent, galleryEnabled: e.target.checked})}
                          className="w-5 h-5 rounded border-slate-300 bg-slate-50 text-green-700 focus:ring-2 focus:ring-green-700"
                        />
                        <span className="text-black">Show gallery at sharing station</span>
                      </label>
                      <p className="text-xs text-slate-500 ml-8">
                        When enabled, guests see a "View Event Gallery" button on the sharing screen that opens your connected SmugMug gallery in a new tab so they can browse all photos from the event.
                      </p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Add-Ons Showcase - Hidden for now */}
              {/* <AddOnShowcase /> */}

              {/* SMS Message Customization */}
              <div className="bg-white p-8 rounded-xl border-2 border-slate-300">
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

              {/* SmugMug Gallery Management - Admin Only */}
              {editingEvent.id && (
                <div className="pt-8 border-t border-slate-300">
                  <SmugMugGallerySync
                    eventId={editingEvent.id}
                    eventName={editingEvent.name}
                    currentGalleryKey={editingEvent.smugmugGalleryKey}
                    currentGalleryUrl={editingEvent.smugmugGalleryUrl}
                    isAdmin={userProfile?.role === 'admin'}
                    onSync={async (galleryKey, galleryUrl) => {
                      await syncSmugMugGallery(editingEvent.id, galleryKey, galleryUrl);
                      const updatedEvent = await getEventById(editingEvent.id);
                      setEditingEvent(updatedEvent);
                    }}
                    onCreateNew={async () => {
                      const result = await createSmugMugGalleryForEvent(
                        editingEvent.id,
                        editingEvent.name,
                        editingEvent.city || ''
                      );
                      const updatedEvent = await getEventById(editingEvent.id);
                      setEditingEvent(updatedEvent);
                      return result;
                    }}
                  />
                </div>
              )}

              {/* Prompt Selection Section */}
              <div className="bg-white p-8 rounded-xl border-2 border-slate-300">
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
                        setPromptLibraryEventContext(editingEvent.id || 'new-event');
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
                          setPromptLibraryEventContext(editingEvent.id || 'new-event');
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
              <div className="flex justify-end">
                 <button
                  onClick={handleSaveEvent}
                  className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg"
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

            <EventAnalytics eventId={analyticsEvent.id} eventName={analyticsEvent.name} limitPhotosPerDevice={analyticsEvent.limitPhotosPerDevice} maxPhotosPerDevice={analyticsEvent.maxPhotosPerDevice} />
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

        {/* REPORTS VIEW */}
        {activeTab === 'reports' && isAdmin && (
          <div className="space-y-6">
            <header className="mb-8">
              <h2 className="text-3xl font-bold text-black">System Reports</h2>
              <p className="text-slate-600 mt-2">View financial metrics and system statistics</p>
            </header>

            {/* Revenue Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border-2 border-slate-300">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-600 text-sm">Total Revenue</p>
                    <h3 className="text-3xl font-bold mt-1 text-black">
                      ${revenueStats?.totalRevenue ? revenueStats.totalRevenue.toFixed(2) : '0.00'}
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
                      ${revenueStats?.monthlyRevenue ? revenueStats.monthlyRevenue.toFixed(2) : '0.00'}
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
                      {revenueStats?.orderCount || 0}
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
                      {adminStats?.totalUsers || 0}
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
                      {adminStats?.activeUsers || 0}
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
                      {adminStats?.totalEvents || 0}
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
                      {adminStats?.totalImages || 0}
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
                      {adminStats?.recentImages || 0}
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

        {activeTab === 'profile' && userProfile && (
          <ProfileManagement
            userProfile={userProfile}
            onProfileUpdate={loadData}
          />
        )}

        {activeTab === 'help' && (
          <HelpCenter />
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

      {/* Tracked Devices Modal */}
      {showDeviceModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeviceModal(false)}
          onKeyDown={() => {}}
        >
          <div
            className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Smartphone className="text-amber-700" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Tracked Devices</h3>
                  <p className="text-sm text-slate-500">{editingEvent.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!editingEvent.id) return;
                    setLoadingDeviceUsage(true);
                    try {
                      const entries = await getEventDeviceUsage(editingEvent.id);
                      setDeviceUsageEntries(entries);
                    } catch (err) {
                      console.error('Failed to load device usage:', err);
                    } finally {
                      setLoadingDeviceUsage(false);
                    }
                  }}
                  className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
                >
                  <RotateCcw size={14} /> Refresh
                </button>
                <button
                  onClick={() => setShowDeviceModal(false)}
                  className="text-slate-600 hover:text-slate-900 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingDeviceUsage ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
                </div>
              ) : deviceUsageEntries.length === 0 ? (
                <div className="text-center py-12">
                  <Smartphone className="mx-auto mb-4 text-slate-300" size={48} />
                  <p className="text-slate-500">No devices tracked yet.</p>
                  <p className="text-sm text-slate-400 mt-1">Device usage will appear here once guests start using the kiosk.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-slate-600">
                      <strong>{deviceUsageEntries.length}</strong> {deviceUsageEntries.length === 1 ? 'device' : 'devices'} tracked
                    </p>
                    <p className="text-xs text-slate-400">
                      Limit: {editingEvent.maxPhotosPerDevice} {editingEvent.maxPhotosPerDevice === 1 ? 'photo' : 'photos'} per device
                    </p>
                  </div>
                  <div className="space-y-2">
                    {deviceUsageEntries.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 font-mono truncate">
                            {entry.deviceToken.substring(0, 18)}...
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {entry.photoCount} {entry.photoCount === 1 ? 'photo' : 'photos'} | {entry.ipAddress || 'IP unknown'} | Last used: {new Date(entry.lastInteractionAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await resetDeviceUsage(entry.id);
                              setDeviceUsageEntries(prev => prev.filter(e => e.id !== entry.id));
                            } catch (err) {
                              console.error('Failed to reset device:', err);
                              alert('Failed to reset device. Please try again.');
                            }
                          }}
                          className="ml-3 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Reset this device's count"
                        >
                          <RotateCcw size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4">
                    Click the reset icon to clear a device's count, allowing that device to take photos again.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Access Codes Modal */}
      {showQrModal && qrModalEvent && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setShowQrModal(false); setQrModalEvent(null); setAccessCodes([]); }}
        >
          <div
            className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <QrCode className="text-green-700" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">QR Access Codes</h3>
                  <p className="text-sm text-slate-500">{qrModalEvent.name}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowQrModal(false); setQrModalEvent(null); setAccessCodes([]); }}
                className="text-slate-600 hover:text-slate-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{accessCodes.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Total Codes</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{accessCodes.filter(c => !c.isUsed).length}</p>
                  <p className="text-xs text-slate-500 mt-1">Unused</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{accessCodes.filter(c => c.isUsed).length}</p>
                  <p className="text-xs text-slate-500 mt-1">Used</p>
                </div>
              </div>

              {/* Generate */}
              <div className="border-2 border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Generate New Codes</h4>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600">How many?</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={qrGenerateCount}
                    onChange={(e) => setQrGenerateCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                    className="w-24 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-2 text-sm text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
                  />
                  <button
                    onClick={handleGenerateCodes}
                    disabled={isGeneratingCodes}
                    className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingCodes ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating...</>
                    ) : (
                      <><Plus size={16} /> Generate</>
                    )}
                  </button>
                </div>
              </div>

              {/* Print / Download */}
              {accessCodes.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={handlePrintQrCodes}
                    disabled={isGeneratingPdf}
                    className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingPdf ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating PDF...</>
                    ) : (
                      <><Printer size={18} /> Print QR Codes (PDF)</>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadQrCodes}
                    disabled={isDownloadingCodes}
                    className="flex-1 bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isDownloadingCodes ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Zipping...</>
                    ) : (
                      <><Download size={18} /> Download QR Codes</>
                    )}
                  </button>
                </div>
              )}

              {/* Code List */}
              {accessCodes.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="mx-auto mb-4 text-slate-300" size={48} />
                  <p className="text-slate-500">No codes generated yet.</p>
                  <p className="text-sm text-slate-400 mt-1">Generate codes above, then print or download them for distribution.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-700">All Codes</h4>
                    <button
                      onClick={handleDeleteAllCodes}
                      disabled={isDeletingAllCodes}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeletingAllCodes ? (
                        <>
                          <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          Delete All
                        </>
                      )}
                    </button>
                  </div>
                  {accessCodes.map((code, i) => (
                    <div key={code.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">Pass {i + 1}</span>
                          {code.isUsed ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Used</span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Available</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                          {window.location.origin}/?access={code.token}
                        </p>
                        {code.redeemedAt && (
                          <p className="text-xs text-slate-400 mt-1">
                            Redeemed: {new Date(code.redeemedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {!code.isUsed && (
                        <button
                          onClick={() => handleDeleteCode(code.id)}
                          className="ml-3 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Delete this code"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Access Management Modal */}
      {accessModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-slate-900">Manage Event Access</h3>
              <button
                onClick={() => {
                  setAccessModal(null);
                  setSelectedUserId('');
                  setEventAccessList([]);
                }}
                className="text-slate-600 hover:text-slate-900 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Event: {accessModal.eventName}</h4>
                <p className="text-sm text-slate-600">
                  Grant access to users so this event appears in their account. The owner retains full control.
                </p>
              </div>

              <div className="border-t-2 border-slate-300 pt-6">
                <h4 className="text-md font-bold text-slate-900 mb-4">Grant Access to User</h4>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto border-2 border-slate-300 rounded-lg">
                    {allUsers
                      .filter(user => {
                        if (user.id === accessModal.eventOwnerId) return false;
                        if (eventAccessList.some(access => access.userId === user.id)) return false;

                        if (!userSearchQuery.trim()) return true;

                        const query = userSearchQuery.toLowerCase();
                        const email = user.email?.toLowerCase() || '';
                        const name = user.full_name?.toLowerCase() || '';

                        return email.includes(query) || name.includes(query);
                      })
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUserId(user.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-200 last:border-b-0 transition-colors ${
                            selectedUserId === user.id ? 'bg-green-50 border-l-4 border-l-green-700' : ''
                          }`}
                        >
                          <div className="font-medium text-slate-900">
                            {user.full_name || user.email}
                          </div>
                          <div className="text-sm text-slate-600">{user.email}</div>
                          {user.role === 'admin' && (
                            <div className="text-xs text-green-700 font-semibold mt-1">ADMIN</div>
                          )}
                        </button>
                      ))}
                    {allUsers.filter(user => {
                      if (user.id === accessModal.eventOwnerId) return false;
                      if (eventAccessList.some(access => access.userId === user.id)) return false;

                      if (!userSearchQuery.trim()) return true;

                      const query = userSearchQuery.toLowerCase();
                      const email = user.email?.toLowerCase() || '';
                      const name = user.full_name?.toLowerCase() || '';

                      return email.includes(query) || name.includes(query);
                    }).length === 0 && (
                      <div className="px-4 py-8 text-center text-slate-600">
                        {userSearchQuery ? 'No users found matching your search' : 'No available users to grant access'}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleGrantAccess}
                      disabled={!selectedUserId || grantingAccess}
                      className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {grantingAccess ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Granting...
                        </>
                      ) : (
                        <>
                          <Plus size={18} />
                          Grant Access
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (selectedUserId) {
                          const selectedUser = allUsers.find(u => u.id === selectedUserId);
                          if (selectedUser) {
                            handleTransferOwnership(selectedUserId, selectedUser.email);
                          }
                        }
                      }}
                      disabled={!selectedUserId || grantingAccess}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserIcon size={18} />
                      Transfer Ownership
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-slate-300 pt-6">
                <h4 className="text-md font-bold text-slate-900 mb-4">Users with Access</h4>
                {eventAccessList.length === 0 ? (
                  <p className="text-sm text-slate-600 italic">No users have been granted access yet.</p>
                ) : (
                  <div className="space-y-2">
                    {eventAccessList.map((access) => (
                      <div key={access.userId} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div>
                          <div className="font-medium text-slate-900">
                            {access.fullName || access.email}
                          </div>
                          <div className="text-xs text-slate-600">{access.email}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            Granted {new Date(access.grantedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeAccess(access.userId)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t-2 border-slate-300">
                <button
                  onClick={() => {
                    setAccessModal(null);
                    setSelectedUserId('');
                    setEventAccessList([]);
                  }}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generation Breakdown Modal */}
      {showGenerationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border-2 border-slate-300 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Generation Breakdown</h2>
                  {selectedDate && (
                    <p className="text-slate-600 mt-1">
                      {new Date(selectedDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowGenerationModal(false);
                    setGenerationBreakdown(null);
                    setSelectedDate(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={24} className="text-slate-600" />
                </button>
              </div>

              {generationBreakdown === null ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <RefreshCw className="animate-spin mx-auto mb-4 text-green-700" size={32} />
                    <p className="text-slate-600">Loading breakdown...</p>
                  </div>
                </div>
              ) : generationBreakdown.length === 0 ? (
                <div className="text-center py-12">
                  <ImageIcon size={48} className="mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600">No generations found for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {generationBreakdown.map((item, index) => (
                    <div
                      key={item.eventId}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border-2 border-slate-200 hover:border-green-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-green-700 text-white rounded-full font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{item.eventName}</p>
                          <p className="text-sm text-slate-600">Event ID: {item.eventId.slice(0, 8)}...</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-700">{item.count}</p>
                          <p className="text-xs text-slate-600">generations</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end mt-6 pt-4 border-t-2 border-slate-300">
                <button
                  onClick={() => {
                    setShowGenerationModal(false);
                    setGenerationBreakdown(null);
                    setSelectedDate(null);
                  }}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Tutorial */}
      {showOnboarding && (
        <OnboardingTutorial
          onOpenSidebar={() => setMobileMenuOpen(true)}
          onComplete={async () => {
            setShowOnboarding(false);
            try {
              await completeOnboarding();
              if (userProfile) {
                setUserProfile({ ...userProfile, onboardingCompleted: true });
              }
            } catch (e) {
              console.error('Failed to save onboarding state:', e);
            }
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;