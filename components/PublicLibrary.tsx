import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, X, Tag, ChevronDown, ChevronUp, Check, ListFilter as Filter, Loader, Pencil, ShieldCheck, Globe, Lock, Plus } from 'lucide-react';
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
  onSave: (updated: Prompt) => Promise<void>;
  onClose: () => void;
}

const EditPromptModal: React.FC<EditPromptModalProps> = ({ prompt, allCategories, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: prompt.name,
    description: prompt.description,
    category: prompt.category,
    promptText: prompt.promptText || '',
    previewImage: prompt.previewImage || '',
    referenceImage: prompt.referenceImage || '',
    isPublic: prompt.isPublic,
    tags: (prompt.tags || []).join(', '),
  });
  const [loadingText, setLoadingText] = useState(!prompt.promptText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!prompt.promptText) {
      supabase
        .from('prompts')
        .select('prompt_text')
        .eq('id', prompt.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.prompt_text) setForm(f => ({ ...f, promptText: data.prompt_text }));
          setLoadingText(false);
        });
    }
  }, [prompt.id, prompt.promptText]);

  const set = (field: string, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.category.trim()) { setError('Category is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const tags = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const updated: Prompt = {
        ...prompt,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        promptText: form.promptText,
        previewImage: form.previewImage.trim(),
        referenceImage: form.referenceImage.trim() || undefined,
        isPublic: form.isPublic,
        tags,
      };
      await onSave(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save.');
      setSaving(false);
    }
  };

  const inputCls = 'w-full border-2 border-slate-300 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-green-700 transition-colors text-sm';
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-200 shrink-0">
          <h2 className="text-base font-bold text-slate-900">Edit Prompt</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className={labelCls}>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category *</label>
            <input
              type="text"
              list="edit-category-suggestions"
              value={form.category}
              onChange={e => set('category', e.target.value)}
              placeholder="Enter or select a category"
              className={inputCls}
            />
            <datalist id="edit-category-suggestions">
              {allCategories.map(c => <option key={c} value={c} />)}
            </datalist>
            {allCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set('category', cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.category === cat
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-green-600 hover:text-green-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags <span className="font-normal text-slate-400">(comma separated)</span></label>
            <input
              type="text"
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
              placeholder="e.g. dark, retro, space"
              className={inputCls}
            />
          </div>

          {/* Prompt Text */}
          <div>
            <label className={labelCls}>Prompt Text</label>
            {loadingText ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                <Loader size={14} className="animate-spin" /> Loading…
              </div>
            ) : (
              <textarea
                value={form.promptText}
                onChange={e => set('promptText', e.target.value)}
                rows={5}
                className={inputCls + ' resize-y font-mono text-xs'}
                placeholder="Enter the AI prompt text…"
              />
            )}
          </div>

          {/* Preview Image URL */}
          <div>
            <label className={labelCls}>Preview Image URL</label>
            <input
              type="url"
              value={form.previewImage}
              onChange={e => set('previewImage', e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
            {form.previewImage && (
              <img
                src={form.previewImage}
                alt="preview"
                className="mt-2 h-24 rounded-lg object-cover border border-slate-200"
              />
            )}
          </div>

          {/* Reference Image URL */}
          <div>
            <label className={labelCls}>Reference Image URL <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              type="url"
              value={form.referenceImage}
              onChange={e => set('referenceImage', e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className={labelCls}>Visibility</label>
            <div className="flex gap-3">
              <label
                className="flex items-center gap-3 cursor-pointer p-3 border-2 rounded-lg flex-1 transition-colors"
                style={{ borderColor: !form.isPublic ? '#15803d' : '#cbd5e1' }}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={!form.isPublic}
                  onChange={() => set('isPublic', false)}
                  className="w-4 h-4 text-green-700"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                    <Lock size={14} /> Private
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Only visible to owner and admins</p>
                </div>
              </label>
              <label
                className="flex items-center gap-3 cursor-pointer p-3 border-2 rounded-lg flex-1 transition-colors"
                style={{ borderColor: form.isPublic ? '#15803d' : '#cbd5e1' }}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={form.isPublic}
                  onChange={() => set('isPublic', true)}
                  className="w-4 h-4 text-green-700"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                    <Globe size={14} /> Public
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Visible in the public library</p>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t-2 border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border-2 border-slate-300 rounded-xl text-slate-700 font-semibold hover:border-slate-400 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PublicLibraryProps {
  isAdmin?: boolean;
}

const PublicLibrary: React.FC<PublicLibraryProps> = ({ isAdmin = false }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [filtered, setFiltered] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('prompts')
        .select('id, name, description, category, tags, preview_image_url, reference_image_url, is_public, is_active, user_id')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('category')
        .order('name');

      if (fetchError) throw fetchError;

      const mapped: Prompt[] = (data || []).map(p => ({
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

      const cats = [...new Set(mapped.map(p => p.category).filter(Boolean))].sort();
      const tagSet = new Set<string>();
      mapped.forEach(p => (p.tags || []).forEach((t: string) => tagSet.add(t)));
      setAllCategories(cats);
      setAllTags([...tagSet].sort());
    } catch (err: any) {
      setError(err.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPrompts(); }, []);

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
        selectedTags.every(t => (p.tags || []).includes(t))
      );
    }

    setFiltered(result);
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

  const toggleCart = (prompt: Prompt) => {
    setCart(prev => {
      const exists = prev.find(i => i.prompt.id === prompt.id);
      return exists ? prev.filter(i => i.prompt.id !== prompt.id) : [...prev, { prompt }];
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
          <span className="text-sm font-semibold text-amber-800">Admin Mode — click the pencil icon on any theme to edit it</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-green-700 rounded-lg flex items-center justify-center">
              <Filter size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Fun Frame Photo Prompt Library</h1>
              <p className="text-xs text-slate-500 hidden sm:block">Browse and select themes for your event</p>
            </div>
          </div>

          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, category, or tag..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border-2 border-transparent rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shrink-0"
          >
            <ShoppingCart size={16} />
            <span className="hidden sm:inline">Cart</span>
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 space-y-4">
          <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b-2 border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Category</h3>
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
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Tags</h3>
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
          {/* Mobile filters */}
          <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="shrink-0 bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-green-700"
            >
              <option value="">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <Tag size={10} />
                {tag}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
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
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 text-center text-red-700">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border-2 border-slate-200 rounded-xl p-12 text-center">
              <Search size={40} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600 font-medium">No themes found</p>
              <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-4 text-sm text-green-700 font-semibold hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {selectedCategory ? (
                Object.entries(byCategory).map(([category, categoryPrompts]) => (
                  <section key={category}>
                    <h2 className="text-base font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <span className="w-1 h-5 bg-green-700 rounded-full inline-block" />
                      {category}
                      <span className="text-slate-400 font-normal text-sm normal-case">({categoryPrompts.length})</span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                      {categoryPrompts.map(prompt => (
                        <PromptCard
                          key={prompt.id}
                          prompt={prompt}
                          inCart={inCart(prompt.id)}
                          onToggle={() => toggleCart(prompt)}
                          isAdmin={isAdmin}
                          onEdit={() => setEditingPrompt(prompt)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map(prompt => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      inCart={inCart(prompt.id)}
                      onToggle={() => toggleCart(prompt)}
                      isAdmin={isAdmin}
                      onEdit={() => setEditingPrompt(prompt)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart size={20} className="text-green-700" />
                Your Selections ({cart.length})
              </h2>
              <button onClick={() => setCartOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No themes selected yet</p>
                  <p className="text-sm mt-1">Click the + button on any theme to add it</p>
                </div>
              ) : (
                cart.map(({ prompt }) => (
                  <div key={prompt.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border-2 border-slate-200">
                    {prompt.previewImage && (
                      <img
                        src={prompt.previewImage}
                        alt={prompt.name}
                        className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-200"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{prompt.name}</p>
                      <p className="text-xs text-slate-500">{prompt.category}</p>
                    </div>
                    <button
                      onClick={() => toggleCart(prompt)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t-2 border-slate-200">
                <button
                  onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                  className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl font-semibold transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Complete Your Request</h2>
              {!submitSuccess && (
                <button onClick={() => setCheckoutOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X size={20} className="text-slate-500" />
                </button>
              )}
            </div>

            {submitSuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Request Submitted!</h3>
                <p className="text-slate-600 mb-6">
                  Your theme selections have been sent. We'll be in touch soon.
                </p>
                <button
                  onClick={() => { setCheckoutOpen(false); setSubmitSuccess(false); }}
                  className="px-6 py-2.5 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 transition-colors"
                >
                  Browse More Themes
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Selected Themes ({cart.length})</p>
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
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-green-700 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Event Date *</label>
                  <input
                    type="date"
                    value={checkoutForm.eventDate}
                    onChange={e => setCheckoutForm(f => ({ ...f, eventDate: e.target.value }))}
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-green-700 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Booking ID # *</label>
                  <input
                    type="text"
                    value={checkoutForm.bookingId}
                    onChange={e => setCheckoutForm(f => ({ ...f, bookingId: e.target.value }))}
                    placeholder="BK-12345"
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-green-700 transition-colors"
                  />
                </div>

                {submitError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setCheckoutOpen(false)}
                    className="flex-1 py-3 border-2 border-slate-300 rounded-xl text-slate-700 font-semibold hover:border-slate-400 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
    </div>
  );
};

interface PromptCardProps {
  prompt: Prompt;
  inCart: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
}

const PromptCard: React.FC<PromptCardProps> = ({ prompt, inCart, onToggle, isAdmin = false, onEdit }) => (
  <div className={`group relative bg-white rounded-xl border-2 transition-all duration-200 overflow-hidden ${inCart ? 'border-green-600 shadow-md shadow-green-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
    <div className="aspect-square bg-slate-100 overflow-hidden">
      {prompt.previewImage ? (
        <img
          src={prompt.previewImage}
          alt={prompt.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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

    {isAdmin && (
      <button
        onClick={e => { e.stopPropagation(); onEdit?.(); }}
        title="Edit prompt"
        className="absolute top-2 right-2 bg-white/90 hover:bg-amber-50 border border-amber-200 text-amber-700 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      >
        <Pencil size={12} />
      </button>
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
      className={`w-full py-2.5 text-sm font-semibold transition-colors border-t-2 ${
        inCart
          ? 'bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
      }`}
    >
      {inCart ? 'Remove' : '+ Add to Selection'}
    </button>
  </div>
);

export default PublicLibrary;
