import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, X, Tag, ChevronDown, ChevronUp, Check, ListFilter as Filter, Loader, Pencil, ShieldCheck, Globe, Lock, Plus, Save, Image as ImageIcon, Upload, Info, CircleAlert as AlertCircle, SlidersHorizontal, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Prompt } from '../types';

interface CartItem {
  prompt: Prompt;
}

interface CheckoutForm {
  name: string;
  eventDate: string;
  bookingId: string;
}

interface EditPromptModalProps {
  prompt: Prompt;
  allCategories: string[];
  isCreating?: boolean;
  onSave: (updated: Prompt) => Promise<void>;
  onClose: () => void;
}

const EditPromptModal: React.FC<EditPromptModalProps> = ({ prompt, allCategories, isCreating = false, onSave, onClose }) => {
  const [editingPrompt, setEditingPrompt] = useState<Prompt>({ ...prompt, tags: prompt.tags || [] });
  const [isPublic, setIsPublic] = useState(prompt.isPublic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
    if (!prompt.promptText) {
      supabase
        .from('prompts')
        .select('prompt_text')
        .eq('id', prompt.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.prompt_text) setEditingPrompt(p => ({ ...p, promptText: data.prompt_text }));
        });
    }
  }, [prompt.id, prompt.promptText]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'previewImage' | 'referenceImage') => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    try {
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${field}_${timestamp}.${fileExtension}`;
      const filePath = `${userId}/${fileName}`;

      if (field === 'referenceImage') {
        const { error: uploadError } = await supabase.storage
          .from('prompt-images')
          .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('prompt-images').getPublicUrl(filePath);
        setEditingPrompt(prev => ({ ...prev, referenceImage: publicUrl }));
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const img = new Image();
            img.onload = async () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) throw new Error('Failed to get canvas context');
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('Failed to convert image');
                const { error: uploadError } = await supabase.storage
                  .from('prompt-images')
                  .upload(filePath, blob, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('prompt-images').getPublicUrl(filePath);
                setEditingPrompt(prev => ({ ...prev, [field]: publicUrl }));
              }, 'image/jpeg', 0.92);
            };
            img.onerror = () => { throw new Error('Failed to load image'); };
            img.src = event.target?.result as string;
          } catch (err) {
            console.error('Error processing image:', err);
            alert('Failed to process image. Please try again.');
          }
        };
        reader.onerror = () => { alert('Failed to read image file. Please try again.'); };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Failed to upload image. Please try again.');
    }
  };

  const addTagToPrompt = (tag: string) => {
    if (!editingPrompt.tags.includes(tag)) {
      setEditingPrompt(p => ({ ...p, tags: [...p.tags, tag] }));
    }
  };

  const removeTagFromPrompt = (tag: string) => {
    setEditingPrompt(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));
  };

  const handleSave = async () => {
    if (!editingPrompt.name.trim()) { setError('Name is required.'); return; }
    if (!editingPrompt.category.trim()) { setError('Category is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...editingPrompt, isPublic });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 md:p-6 border-b-2 border-slate-300 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">{isCreating ? 'Create New Prompt' : 'Edit Prompt'}</h2>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 text-2xl flex-shrink-0"
          >
            ×
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Prompt Name *</label>
              <input
                type="text"
                value={editingPrompt.name}
                onChange={e => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                placeholder="Candy Cane Christmas"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Category *</label>
              <input
                type="text"
                list="edit-category-suggestions"
                value={editingPrompt.category}
                onChange={e => setEditingPrompt({ ...editingPrompt, category: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                placeholder="Select or type a category (e.g., Holiday, Sports, Nature)"
              />
              <datalist id="edit-category-suggestions">
                {allCategories.map(cat => <option key={cat} value={cat} />)}
              </datalist>
              <p className="text-xs text-slate-500 mt-1">
                Select from existing categories or type a new one
                {allCategories.length > 0 && ` (${allCategories.length} existing)`}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Description (Optional)</label>
            <input
              type="text"
              value={editingPrompt.description}
              onChange={e => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
              placeholder="Candycane portrait Studio"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">AI Prompt Text</label>
            <textarea
              value={editingPrompt.promptText}
              onChange={e => setEditingPrompt({ ...editingPrompt, promptText: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700 min-h-[120px] font-mono text-sm"
              placeholder="Detailed AI generation prompt"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <ImageIcon size={16} />
                Kiosk Thumbnail *
              </label>
              {editingPrompt.previewImage ? (
                <div className="relative">
                  <img
                    src={editingPrompt.previewImage}
                    alt="Kiosk Thumbnail"
                    className="w-full aspect-video object-cover rounded-lg border-2 border-slate-300"
                  />
                  <button
                    onClick={() => setEditingPrompt({ ...editingPrompt, previewImage: '' })}
                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                    title="Remove image"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="w-full aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                    <Upload size={32} className="text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">Click to Upload</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'previewImage')}
                    className="hidden"
                  />
                </label>
              )}
              <p className="text-xs text-slate-500 mt-2">This image appears in the kiosk style selector</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <ImageIcon size={16} />
                AI Style Reference (Optional)
              </label>
              {editingPrompt.referenceImage ? (
                <div className="relative">
                  <img
                    src={editingPrompt.referenceImage}
                    alt="AI Style Reference"
                    className="w-full aspect-video object-contain rounded-lg border-2 border-slate-300 bg-slate-100"
                  />
                  <button
                    onClick={() => setEditingPrompt({ ...editingPrompt, referenceImage: null })}
                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                    title="Remove image"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="w-full aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                    <Upload size={32} className="text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">Click to Upload Style Ref</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, 'referenceImage')}
                    className="hidden"
                  />
                </label>
              )}
              <p className="text-xs text-slate-500 mt-2">Upload a sample photo that defines the visual style for the AI to mimic</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {editingPrompt.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-700/20 text-green-800 rounded-full text-sm"
                >
                  {tag}
                  <button onClick={() => removeTagFromPrompt(tag)} className="hover:text-green-900">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              onKeyPress={e => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  addTagToPrompt(e.currentTarget.value.trim().toLowerCase());
                  e.currentTarget.value = '';
                }
              }}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
              placeholder="Type tag and press Enter"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-900">Visibility</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <label
                className="flex items-center gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:border-green-700 flex-1"
                style={{ borderColor: !isPublic ? '#15803d' : '#cbd5e1' }}
              >
                <input
                  type="radio"
                  name="edit-visibility"
                  checked={!isPublic}
                  onChange={() => setIsPublic(false)}
                  className="w-5 h-5 text-green-700 flex-shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <Lock size={16} />
                    Private
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Only available to you</p>
                </div>
              </label>
              <label
                className="flex items-center gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:border-green-700 flex-1"
                style={{ borderColor: isPublic ? '#15803d' : '#cbd5e1' }}
              >
                <input
                  type="radio"
                  name="edit-visibility"
                  checked={isPublic}
                  onChange={() => setIsPublic(true)}
                  className="w-5 h-5 text-green-700 flex-shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <Globe size={16} />
                    Public
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Available to all users</p>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving || !editingPrompt.name || !editingPrompt.previewImage}
              className="flex-1 py-3 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {saving ? 'Saving…' : isCreating ? 'Create Prompt' : 'Update Prompt'}
            </button>
            <button
              onClick={onClose}
              className="sm:px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PublicLibraryProps {
  isAdmin?: boolean;
}

const CART_LIMIT = 10;

const PublicLibrary: React.FC<PublicLibraryProps> = ({ isAdmin = false }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [filtered, setFiltered] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHowTo, setShowHowTo] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({ name: '', eventDate: '', bookingId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<Prompt | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('prompts')
        .select('id, name, description, category, tags, preview_image_url, reference_image_url, is_public, is_active, user_id')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (!isAdmin) {
        query = query.eq('is_public', true);
      }

      const promptsRes = await query;
      if (promptsRes.error) throw promptsRes.error;

      const mapped: Prompt[] = (promptsRes.data || []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        previewImage: p.preview_image_url,
        referenceImage: p.reference_image_url,
        promptText: '',
        category: p.category,
        isPublic: p.is_public,
        userId: p.user_id,
        tags: p.tags || [],
      }));

      setPrompts(mapped);

      const allCats = [...new Set(mapped.map(p => p.category).filter(Boolean))].sort() as string[];
      const tagSet = new Set<string>();
      mapped.forEach(p => (p.tags || []).forEach((t: string) => tagSet.add(t)));
      setAllCategories(allCats);
      setAllTags([...tagSet].sort());
    } catch (err: any) {
      setError(err.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPrompts(); }, [isAdmin]);

  useEffect(() => {
    let result = prompts;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (selectedTags.length > 0) {
      result = result.filter(p =>
        selectedTags.some(t => (p.tags || []).includes(t))
      );
    }

    setFiltered(result);
    setVisibleCount(12);
  }, [prompts, searchQuery, selectedCategory, selectedTags]);

  const handleSavePrompt = async (updated: Prompt) => {
    const { error: updateError } = await supabase
      .from('prompts')
      .update({
        name: updated.name,
        description: updated.description,
        category: updated.category,
        prompt_text: updated.promptText,
        preview_image_url: updated.previewImage || null,
        reference_image_url: updated.referenceImage || null,
        is_public: updated.isPublic,
        tags: updated.tags || [],
      })
      .eq('id', updated.id);

    if (updateError) throw new Error(updateError.message);

    // If prompt was made private, remove it from the public library list
    if (!updated.isPublic) {
      setPrompts(prev => prev.filter(p => p.id !== updated.id));
    } else {
      setPrompts(prev => prev.map(p => p.id === updated.id ? updated : p));
    }

    // Refresh categories/tags
    setPrompts(prev => {
      const next = updated.isPublic
        ? prev.map(p => p.id === updated.id ? updated : p)
        : prev.filter(p => p.id !== updated.id);
      const cats = [...new Set(next.map(p => p.category).filter(Boolean))].sort();
      const tagSet = new Set<string>();
      next.forEach(p => (p.tags || []).forEach((t: string) => tagSet.add(t)));
      setAllCategories(cats);
      setAllTags([...tagSet].sort());
      return next;
    });

    if (selectedCategory) {
      const old = prompts.find(p => p.id === updated.id);
      if (old && old.category !== updated.category && selectedCategory === old.category) {
        setSelectedCategory('');
      }
    }
  };

  const blankPrompt: Prompt = {
    id: '',
    name: '',
    description: '',
    previewImage: '',
    referenceImage: null,
    promptText: '',
    category: '',
    isPublic: true,
    userId: '',
    tags: [],
  };

  const handleCreatePrompt = async (newPrompt: Prompt) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error: insertError } = await supabase
      .from('prompts')
      .insert({
        name: newPrompt.name,
        description: newPrompt.description,
        category: newPrompt.category,
        prompt_text: newPrompt.promptText,
        preview_image_url: newPrompt.previewImage || null,
        reference_image_url: newPrompt.referenceImage || null,
        is_public: newPrompt.isPublic,
        is_active: true,
        tags: newPrompt.tags || [],
        user_id: user.id,
      })
      .select('id')
      .single();

    if (insertError) throw new Error(insertError.message);

    await loadPrompts();
  };

  const handleDeletePrompt = async (prompt: Prompt) => {
    const { error: deleteError } = await supabase
      .from('prompts')
      .delete()
      .eq('id', prompt.id);

    if (deleteError) {
      setDeleteError(deleteError.message);
      return;
    }

    setPrompts(prev => {
      const next = prev.filter(p => p.id !== prompt.id);
      const cats = [...new Set(next.map(p => p.category).filter(Boolean))].sort();
      const tagSet = new Set<string>();
      next.forEach(p => (p.tags || []).forEach((t: string) => tagSet.add(t)));
      setAllCategories(cats);
      setAllTags([...tagSet].sort());
      return next;
    });

    setCart(prev => prev.filter(i => i.prompt.id !== prompt.id));
    setDeletingPrompt(null);
    setDeleteError('');
  };

  const toggleCart = (prompt: Prompt) => {
    setCart(prev => {
      const exists = prev.find(i => i.prompt.id === prompt.id);
      if (exists) return prev.filter(i => i.prompt.id !== prompt.id);
      if (prev.length >= CART_LIMIT) return prev;
      return [...prev, { prompt }];
    });
  };

  const inCart = (id: string) => cart.some(i => i.prompt.id === id);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedTags([]);
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedTags.length > 0;

  const handleSubmit = async () => {
    if (!checkoutForm.name.trim() || !checkoutForm.eventDate || !checkoutForm.bookingId.trim()) {
      setSubmitError('Please fill in all fields.');
      return;
    }
    if (cart.length === 0) {
      setSubmitError('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/library-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'Apikey': anonKey,
        },
        body: JSON.stringify({
          name: checkoutForm.name.trim(),
          eventDate: checkoutForm.eventDate,
          bookingId: checkoutForm.bookingId.trim(),
          prompts: cart.map(i => ({
            id: i.prompt.id,
            name: i.prompt.name,
            category: i.prompt.category,
            tags: i.prompt.tags || [],
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Submission failed. Please try again.');
      }

      setSubmitSuccess(true);
      setCart([]);
      setCheckoutForm({ name: '', eventDate: '', bookingId: '' });
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const byCategory = filtered.reduce<Record<string, Prompt[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Admin banner */}
      {isAdmin && (
        <div className="bg-amber-50 border-b-2 border-amber-200 px-4 py-2 flex items-center justify-center gap-2">
          <ShieldCheck size={15} className="text-amber-700" />
          <span className="text-sm font-semibold text-amber-800">Admin Mode — tap the pencil icon on any theme to edit it</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-30">
        {/* Row 1: logo + actions */}
        <div className="px-3 sm:px-6 lg:px-8 pt-2.5 pb-2 flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-700 rounded-lg flex items-center justify-center shrink-0">
            <Filter size={14} className="text-white" />
          </div>
          <h1 className="flex-1 text-sm sm:text-base font-bold text-slate-900 leading-tight truncate min-w-0">AI Prompt Library</h1>

          {isAdmin && (
            <button
              onClick={() => setCreatingPrompt(true)}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">New</span>
            </button>
          )}

          {/* Cart — header button, hidden on mobile when FAB is shown */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors shrink-0"
          >
            <ShoppingCart size={15} />
            <span>Cart</span>
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold leading-none text-[10px] sm:text-xs">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: search + filter button */}
        <div className="px-3 sm:px-6 lg:px-8 pb-2.5 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search themes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-2 bg-slate-100 border-2 border-transparent rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterSheetOpen(true)}
            className={`lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-colors shrink-0 ${
              hasActiveFilters
                ? 'bg-green-700 border-green-700 text-white'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <SlidersHorizontal size={13} />
            {hasActiveFilters ? `${(selectedCategory ? 1 : 0) + selectedTags.length}` : 'Filter'}
          </button>
        </div>
      </header>

      {/* How-to banner — collapsible, compact on mobile */}
      {showHowTo && !isAdmin && (
        <div className="bg-green-700 text-white">
          <div className="px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <Info size={18} className="shrink-0 mt-0.5 opacity-90" />
                <div className="min-w-0">
                  <p className="font-bold text-sm mb-1.5">How to use this library</p>
                  <ol className="space-y-1 text-xs text-green-100">
                    <li className="flex items-start gap-1.5">
                      <span className="bg-white/20 font-bold text-xs w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span><strong className="text-white">Browse or search</strong> — use the search bar above or tap <strong className="text-white">Filter</strong> to narrow by category or tags.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="bg-white/20 font-bold text-xs w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span><strong className="text-white">Select themes</strong> — tap <strong className="text-white">+ Add</strong> on any theme. You can submit up to <strong className="text-white">10 themes at a time</strong>.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="bg-white/20 font-bold text-xs w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span><strong className="text-white">Checkout</strong> — tap the <strong className="text-white">Cart</strong> button, review your picks, and submit your request.</span>
                    </li>
                  </ol>
                  <div className="mt-2 flex items-start gap-1.5 bg-white/10 rounded-lg px-2.5 py-2 border border-white/20">
                    <AlertCircle size={13} className="shrink-0 mt-0.5 text-yellow-300" />
                    <p className="text-xs text-green-100 leading-relaxed">
                      <strong className="text-white">Note:</strong> The 10-theme selector is for browsing only. Your actual theme allowance depends on your booked package — check your booking confirmation for details.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowHowTo(false)}
                className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors mt-0.5"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart limit warning bar */}
      {cart.length >= CART_LIMIT && (
        <div className="bg-amber-50 border-b-2 border-amber-200">
          <div className="px-4 sm:px-6 lg:px-8 py-2 flex items-start sm:items-center gap-2">
            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-xs sm:text-sm text-amber-800">
              <strong>Selector limit reached</strong> — remove a theme to swap it. Your package determines how many themes are included at your event.
            </span>
          </div>
        </div>
      )}

      {/* Mobile filter sheet overlay */}
      {filterSheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex flex-col justify-end">
          <div className="flex-1 bg-black/40" onClick={() => setFilterSheetOpen(false)} />
          <div className="bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-green-700" />
                Filter Themes
              </h2>
              <button onClick={() => setFilterSheetOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Category</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${!selectedCategory ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    All
                  </button>
                  {allCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${selectedCategory === cat ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {allTags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                          selectedTags.includes(tag)
                            ? 'bg-green-700 border-green-700 text-white'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <Tag size={11} />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t-2 border-slate-200 flex gap-3">
              {hasActiveFilters && (
                <button
                  onClick={() => { clearFilters(); setFilterSheetOpen(false); }}
                  className="flex-1 py-2.5 border-2 border-slate-300 rounded-xl text-slate-700 font-semibold text-sm hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={() => setFilterSheetOpen(false)}
                className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Show {filtered.length} Result{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 space-y-4">
          <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b-2 border-slate-200">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Category</h3>
            </div>
            <div className="p-2">
              <button
                onClick={() => setSelectedCategory('')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedCategory ? 'bg-green-50 text-green-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                All Categories
              </button>
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === cat ? 'bg-green-50 text-green-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
              <button
                className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-200 flex items-center justify-between"
                onClick={() => setTagsOpen(!tagsOpen)}
              >
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Tags</h3>
                {tagsOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>
              {tagsOpen && (
                <div className="p-3 flex flex-wrap gap-1.5">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                        selectedTags.includes(tag)
                          ? 'bg-green-700 text-white border-green-700'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-green-700 hover:text-green-700'
                      }`}
                    >
                      <Tag size={10} />
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg text-sm text-slate-600 hover:border-red-300 hover:text-red-600 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs sm:text-sm text-slate-500">
              {loading ? 'Loading...' : `${filtered.length} theme${filtered.length !== 1 ? 's' : ''}${hasActiveFilters ? ' matching filters' : ''}`}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-red-600 hover:underline">Clear filters</button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader size={32} className="text-green-700 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 text-center text-red-700 text-sm">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border-2 border-slate-200 rounded-xl p-10 text-center">
              <Search size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No themes found</p>
              <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-4 text-sm text-green-700 font-semibold hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {selectedCategory ? (
                (() => {
                  let shown = 0;
                  const sections: React.ReactNode[] = [];
                  for (const [category, categoryPrompts] of Object.entries(byCategory)) {
                    if (shown >= visibleCount) break;
                    const slice = categoryPrompts.slice(0, visibleCount - shown);
                    shown += slice.length;
                    sections.push(
                      <section key={category}>
                        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2.5 flex items-center gap-2">
                          <span className="w-1 h-4 bg-green-700 rounded-full inline-block" />
                          {category}
                          <span className="text-slate-400 font-normal text-xs normal-case">({categoryPrompts.length})</span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                          {slice.map(prompt => (
                            <PromptCard
                              key={prompt.id}
                              prompt={prompt}
                              inCart={inCart(prompt.id)}
                              cartFull={cart.length >= CART_LIMIT}
                              onToggle={() => toggleCart(prompt)}
                              isAdmin={isAdmin}
                              onEdit={() => setEditingPrompt(prompt)}
                              onDelete={() => { setDeleteError(''); setDeletingPrompt(prompt); }}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  }
                  return sections;
                })()
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                  {filtered.slice(0, visibleCount).map(prompt => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      inCart={inCart(prompt.id)}
                      cartFull={cart.length >= CART_LIMIT}
                      onToggle={() => toggleCart(prompt)}
                      isAdmin={isAdmin}
                      onEdit={() => setEditingPrompt(prompt)}
                      onDelete={() => { setDeleteError(''); setDeletingPrompt(prompt); }}
                    />
                  ))}
                </div>
              )}

              {filtered.length > visibleCount && (
                <div className="flex justify-center pt-2 pb-4">
                  <button
                    onClick={() => setVisibleCount(c => c + 12)}
                    className="px-6 py-2.5 bg-white border-2 border-slate-200 hover:border-green-600 hover:text-green-700 text-slate-700 font-semibold text-sm rounded-xl transition-colors shadow-sm"
                  >
                    Load More ({filtered.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile bottom padding so FAB doesn't cover last card */}
          <div className="h-20 sm:hidden" />
        </main>
      </div>

      {/* Mobile floating cart button (bottom-right) */}
      {cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 right-4 sm:hidden z-30 flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white pl-4 pr-5 py-3 rounded-full shadow-lg font-semibold text-sm transition-colors"
        >
          <ShoppingCart size={18} />
          <span>View Cart</span>
          <span className="bg-white text-green-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
            {cart.length}
          </span>
        </button>
      )}

      {/* Cart Drawer — bottom sheet on mobile, right panel on sm+ */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex sm:justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />

          {/* Mobile: bottom sheet */}
          <div className="sm:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] z-10">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart size={16} className="text-green-700" />
                Your Selections
                <span className={`text-xs font-semibold ml-1 ${cart.length >= CART_LIMIT ? 'text-amber-600' : 'text-slate-400'}`}>
                  {cart.length}/{CART_LIMIT}
                </span>
              </h2>
              <button onClick={() => setCartOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-sm">No themes selected yet</p>
                  <p className="text-xs mt-1">Tap <strong>+</strong> on any theme to add it</p>
                </div>
              ) : (
                cart.map(({ prompt }) => (
                  <div key={prompt.id} className="flex items-center gap-2.5 bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                    {prompt.previewImage && (
                      <img src={prompt.previewImage} alt={prompt.name} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-200" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{prompt.name}</p>
                      <p className="text-xs text-slate-400">{prompt.category}</p>
                    </div>
                    <button onClick={() => toggleCart(prompt)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-3 border-t border-slate-200 shrink-0">
                <button
                  onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                  className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl font-semibold transition-colors text-sm"
                >
                  Request These Themes ({cart.length})
                </button>
              </div>
            )}
          </div>

          {/* Desktop: right side panel */}
          <div className="hidden sm:flex relative w-full max-w-md bg-white shadow-2xl flex-col h-full z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart size={18} className="text-green-700" />
                  Your Selections
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-0.5">
                    {Array.from({ length: CART_LIMIT }).map((_, i) => (
                      <div key={i} className={`h-1.5 w-4 rounded-full transition-colors ${i < cart.length ? 'bg-green-600' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <span className={`text-xs font-semibold ${cart.length >= CART_LIMIT ? 'text-amber-600' : 'text-slate-500'}`}>
                    {cart.length}/{CART_LIMIT}
                  </span>
                </div>
              </div>
              <button onClick={() => setCartOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No themes selected yet</p>
                  <p className="text-sm mt-1">Click <strong>+ Add</strong> on any theme</p>
                </div>
              ) : (
                cart.map(({ prompt }) => (
                  <div key={prompt.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border-2 border-slate-200">
                    {prompt.previewImage && (
                      <img src={prompt.previewImage} alt={prompt.name} className="w-12 h-12 rounded-lg object-cover shrink-0 bg-slate-200" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{prompt.name}</p>
                      <p className="text-xs text-slate-500">{prompt.category}</p>
                    </div>
                    <button onClick={() => toggleCart(prompt)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <X size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t-2 border-slate-200">
                <button
                  onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                  className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl font-semibold transition-colors text-sm"
                >
                  Request These Themes ({cart.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-slate-200 shrink-0">
              <h2 className="text-base font-bold text-slate-900">Complete Your Request</h2>
              {!submitSuccess && (
                <button onClick={() => setCheckoutOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X size={20} className="text-slate-500" />
                </button>
              )}
            </div>

            {submitSuccess ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={28} className="text-green-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Request Submitted!</h3>
                <p className="text-slate-600 text-sm mb-6">
                  Your theme selections have been sent. We'll be in touch soon.
                </p>
                <button
                  onClick={() => { setCheckoutOpen(false); setSubmitSuccess(false); }}
                  className="px-6 py-2.5 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 transition-colors text-sm"
                >
                  Browse More Themes
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                <div className="bg-slate-50 rounded-xl p-3.5 border-2 border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Selected Themes ({cart.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cart.map(({ prompt }) => (
                      <span key={prompt.id} className="bg-white border border-slate-300 text-slate-700 text-xs px-2.5 py-1 rounded-full">
                        {prompt.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Name *</label>
                  <input
                    type="text"
                    value={checkoutForm.name}
                    onChange={e => setCheckoutForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-green-700 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Event Date *</label>
                  <input
                    type="date"
                    value={checkoutForm.eventDate}
                    onChange={e => setCheckoutForm(f => ({ ...f, eventDate: e.target.value }))}
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-green-700 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Booking ID # *</label>
                  <input
                    type="text"
                    value={checkoutForm.bookingId}
                    onChange={e => setCheckoutForm(f => ({ ...f, bookingId: e.target.value }))}
                    placeholder="BK-12345"
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-green-700 transition-colors text-sm"
                  />
                </div>

                {submitError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="flex gap-3 pt-1 pb-2">
                  <button
                    onClick={() => setCheckoutOpen(false)}
                    className="flex-1 py-3 border-2 border-slate-300 rounded-xl text-slate-700 font-semibold text-sm hover:border-slate-400 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Edit Modal (admin only) */}
      {editingPrompt && (
        <EditPromptModal
          prompt={editingPrompt}
          allCategories={allCategories}
          onSave={handleSavePrompt}
          onClose={() => setEditingPrompt(null)}
        />
      )}

      {/* Create Prompt Modal (admin only) */}
      {creatingPrompt && (
        <EditPromptModal
          prompt={blankPrompt}
          allCategories={allCategories}
          isCreating={true}
          onSave={handleCreatePrompt}
          onClose={() => setCreatingPrompt(false)}
        />
      )}

      {/* Delete Confirmation Modal (admin only) */}
      {deletingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Prompt</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to permanently delete:
            </p>
            <p className="text-sm font-semibold text-slate-900 mb-4 truncate">"{deletingPrompt.name}"</p>
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeletingPrompt(null); setDeleteError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePrompt(deletingPrompt)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PromptCardProps {
  prompt: Prompt;
  inCart: boolean;
  cartFull: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const PromptCard: React.FC<PromptCardProps> = ({ prompt, inCart, cartFull, onToggle, isAdmin = false, onEdit, onDelete }) => {
  const disabled = cartFull && !inCart;

  return (
    <>
      {/* Mobile: horizontal row layout */}
      <div className={`sm:hidden group relative bg-white rounded-xl border-2 transition-all duration-200 overflow-hidden flex items-stretch ${
        inCart ? 'border-green-500 shadow-sm shadow-green-100' :
        disabled ? 'border-slate-200 opacity-50' :
        'border-slate-200'
      }`}>
        {/* Thumbnail */}
        <div className="w-20 h-20 shrink-0 bg-slate-100 overflow-hidden relative">
          {prompt.previewImage ? (
            <img src={prompt.previewImage} alt={prompt.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Search size={20} />
            </div>
          )}
          {inCart && (
            <div className="absolute inset-0 bg-green-600/20 flex items-center justify-center">
              <div className="bg-green-600 rounded-full p-1">
                <Check size={10} className="text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-semibold text-slate-900 text-sm leading-tight line-clamp-1 min-w-0">{prompt.name}</p>
            {!prompt.isPublic && isAdmin && (
              <span className="shrink-0 bg-slate-700 text-white rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                <Lock size={8} />
                <span className="text-[9px] font-bold uppercase tracking-wide">Private</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{prompt.category}</p>
          {prompt.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{prompt.description}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col shrink-0 border-l-2 border-slate-100">
          {isAdmin && (
            <>
              <button
                onClick={e => { e.stopPropagation(); onEdit?.(); }}
                className="flex-1 px-3 flex items-center justify-center border-b border-slate-100 text-amber-600 hover:bg-amber-50 transition-colors"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete?.(); }}
                className="flex-1 px-3 flex items-center justify-center border-b border-slate-100 text-red-500 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          <button
            onClick={onToggle}
            disabled={disabled}
            className={`flex-1 px-3 flex items-center justify-center transition-colors font-bold text-xs ${
              inCart
                ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600'
                : disabled
                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                : 'text-green-700 hover:bg-green-50'
            }`}
          >
            {inCart ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>

      {/* Tablet/Desktop: card layout */}
      <div className={`hidden sm:block group relative bg-white rounded-xl border-2 transition-all duration-200 overflow-hidden ${
        inCart ? 'border-green-600 shadow-md shadow-green-100' :
        disabled ? 'border-slate-200 opacity-50' :
        !prompt.isPublic ? 'border-dashed border-slate-300 hover:border-slate-400 hover:shadow-sm' :
        'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}>
        <div className="aspect-square bg-slate-100 overflow-hidden">
          {prompt.previewImage ? (
            <img
              src={prompt.previewImage}
              alt={prompt.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Search size={32} />
            </div>
          )}
        </div>

        {inCart && (
          <div className="absolute top-2 left-2 bg-green-600 text-white rounded-full p-1">
            <Check size={12} />
          </div>
        )}

        {!prompt.isPublic && isAdmin && !inCart && (
          <div className="absolute top-2 left-2 bg-slate-700 text-white rounded-full px-1.5 py-0.5 flex items-center gap-1">
            <Lock size={9} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Private</span>
          </div>
        )}

        {isAdmin && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onEdit?.(); }}
              title="Edit prompt"
              className="bg-white/90 hover:bg-amber-50 border border-amber-200 text-amber-700 rounded-full p-1.5 shadow-sm"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete?.(); }}
              title="Delete prompt"
              className="bg-white/90 hover:bg-red-50 border border-red-200 text-red-600 rounded-full p-1.5 shadow-sm"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}

        <div className="p-3">
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{prompt.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{prompt.category}</p>
          {prompt.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{prompt.description}</p>
          )}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {prompt.tags.slice(0, 3).map(tag => (
                <span key={tag} className="bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          disabled={disabled}
          className={`w-full py-2 text-sm font-semibold transition-colors border-t-2 ${
            inCart
              ? 'bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
              : disabled
              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
          }`}
        >
          {inCart ? 'Remove' : '+ Add'}
        </button>
      </div>
    </>
  );
};

export default PublicLibrary;
