import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Tag, X, Save, Image as ImageIcon, Search, Upload, Check, Globe, Lock, Sparkles } from 'lucide-react';
import { generateBoothImage } from '../services/geminiService';

interface Prompt {
  id: string;
  name: string;
  description: string;
  category: string;
  promptText: string;
  previewImage: string;
  referenceImage: string | null;
  tags: string[];
  isActive: boolean;
  usageCount: number;
  tenantId?: string | null;
}

interface PromptLibraryProps {
  tenantId: string;
  onClose: () => void;
  eventId?: string | null;
  selectedPrompts?: Prompt[];
  onPromptsSelected?: (prompts: Prompt[]) => void;
  onAddToEvent?: (prompt: Prompt) => void;
}

const PromptLibrary: React.FC<PromptLibraryProps> = ({ tenantId, onClose, eventId, selectedPrompts = [], onPromptsSelected, onAddToEvent }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [filteredPrompts, setFilteredPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [eventModePrompts, setEventModePrompts] = useState<Prompt[]>(selectedPrompts);
  const [isPublic, setIsPublic] = useState(false);
  const [testingPrompt, setTestingPrompt] = useState<Prompt | null>(null);
  const [testSourceImage, setTestSourceImage] = useState<string>('');
  const [testReferenceImage, setTestReferenceImage] = useState<string>('');
  const [testGeneratedImage, setTestGeneratedImage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState(10);

  useEffect(() => {
    loadPrompts();
  }, [tenantId]);

  useEffect(() => {
    filterPrompts();
    setDisplayLimit(10);
  }, [prompts, selectedTags, selectedCategory, searchQuery]);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order('usage_count', { ascending: false });

      if (error) throw error;

      const mappedPrompts = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        category: p.category || 'Custom',
        promptText: p.prompt_text || '',
        previewImage: p.preview_image_url || '',
        referenceImage: p.reference_image_url,
        tags: p.tags || [],
        isActive: p.is_active,
        usageCount: p.usage_count || 0,
        tenantId: p.tenant_id,
      }));

      setPrompts(mappedPrompts);
      extractAllTags(mappedPrompts);
      extractAllCategories(mappedPrompts);
    } catch (error) {
      console.error('Error loading prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractAllTags = (promptList: Prompt[]) => {
    const tagSet = new Set<string>();
    promptList.forEach(prompt => {
      prompt.tags.forEach(tag => tagSet.add(tag));
    });
    setAllTags(Array.from(tagSet).sort());
  };

  const extractAllCategories = (promptList: Prompt[]) => {
    const categorySet = new Set<string>();
    promptList.forEach(prompt => {
      if (prompt.category) categorySet.add(prompt.category);
    });
    setAllCategories(Array.from(categorySet).sort());
  };

  const filterPrompts = () => {
    let filtered = prompts;

    if (selectedCategory) {
      filtered = filtered.filter(prompt => prompt.category === selectedCategory);
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(prompt =>
        selectedTags.some(tag => prompt.tags.includes(tag))
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(prompt =>
        prompt.name.toLowerCase().includes(query) ||
        prompt.description.toLowerCase().includes(query) ||
        prompt.category.toLowerCase().includes(query)
      );
    }

    setFilteredPrompts(filtered);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCreateNew = () => {
    setEditingPrompt({
      id: '',
      name: '',
      description: '',
      category: 'Custom',
      promptText: '',
      previewImage: '',
      referenceImage: null,
      tags: [],
      isActive: true,
      usageCount: 0,
    });
    setIsCreating(true);
    setIsPublic(false);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt({ ...prompt });
    setIsCreating(false);
    setIsPublic(prompt.tenantId === null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'previewImage' | 'referenceImage') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingPrompt(prev => prev ? { ...prev, [field]: reader.result as string } : null);
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePromptForEvent = (prompt: Prompt) => {
    if (!eventId) return;
    const exists = eventModePrompts.find(p => p.id === prompt.id);
    if (exists) {
      setEventModePrompts(eventModePrompts.filter(p => p.id !== prompt.id));
    } else {
      setEventModePrompts([...eventModePrompts, prompt]);
    }
  };

  const handleSave = async () => {
    if (!editingPrompt) return;

    try {
      if (isCreating) {
        const { error } = await supabase.from('prompts').insert({
          tenant_id: isPublic ? null : tenantId,
          name: editingPrompt.name,
          description: editingPrompt.description,
          category: editingPrompt.category,
          prompt_text: editingPrompt.promptText,
          preview_image_url: editingPrompt.previewImage || null,
          reference_image_url: editingPrompt.referenceImage || null,
          tags: editingPrompt.tags,
          is_active: editingPrompt.isActive,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('prompts')
          .update({
            tenant_id: isPublic ? null : tenantId,
            name: editingPrompt.name,
            description: editingPrompt.description,
            category: editingPrompt.category,
            prompt_text: editingPrompt.promptText,
            preview_image_url: editingPrompt.previewImage || null,
            reference_image_url: editingPrompt.referenceImage || null,
            tags: editingPrompt.tags,
            is_active: editingPrompt.isActive,
          })
          .eq('id', editingPrompt.id);

        if (error) throw error;
      }

      setEditingPrompt(null);
      setIsCreating(false);
      loadPrompts();
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('Failed to save prompt');
    }
  };

  const handleDelete = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt? This cannot be undone.')) return;

    try {
      const { error } = await supabase.from('prompts').delete().eq('id', promptId);

      if (error) throw error;

      loadPrompts();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      alert('Failed to delete prompt');
    }
  };

  const addTagToPrompt = (tag: string) => {
    if (!editingPrompt) return;
    if (!editingPrompt.tags.includes(tag)) {
      setEditingPrompt({
        ...editingPrompt,
        tags: [...editingPrompt.tags, tag],
      });
    }
  };

  const removeTagFromPrompt = (tag: string) => {
    if (!editingPrompt) return;
    setEditingPrompt({
      ...editingPrompt,
      tags: editingPrompt.tags.filter(t => t !== tag),
    });
  };

  const handleTestPrompt = (prompt: Prompt) => {
    setTestingPrompt(prompt);
    setTestSourceImage('');
    setTestReferenceImage('');
    setTestGeneratedImage('');
    setGenerationError('');
  };

  const handleTestImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'source' | 'reference') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (field === 'source') {
          setTestSourceImage(reader.result as string);
        } else {
          setTestReferenceImage(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRunTest = async () => {
    if (!testingPrompt || !testSourceImage) return;

    setIsGenerating(true);
    setGenerationError('');
    setTestGeneratedImage('');

    try {
      const { data: settings } = await supabase
        .from('global_settings')
        .select('gemini_api_key, gemini_model_name, gemini_resolution')
        .maybeSingle();

      if (!settings?.gemini_api_key) {
        throw new Error('Gemini API key not configured. Please add it in Settings.');
      }

      const referenceImage = testReferenceImage || testingPrompt.referenceImage || undefined;

      const generatedImage = await generateBoothImage(
        testSourceImage,
        testingPrompt.promptText,
        settings.gemini_api_key,
        referenceImage,
        'square',
        settings.gemini_model_name || 'gemini-3-pro-image-preview',
        settings.gemini_resolution || '1K'
      );

      setTestGeneratedImage(generatedImage);
    } catch (error: any) {
      console.error('Test generation error:', error);
      setGenerationError(error.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const closeTestModal = () => {
    setTestingPrompt(null);
    setTestSourceImage('');
    setTestReferenceImage('');
    setTestGeneratedImage('');
    setGenerationError('');
  };

  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + 10);
  };

  const displayedPrompts = filteredPrompts.slice(0, displayLimit);
  const hasMorePrompts = filteredPrompts.length > displayLimit;

  if (editingPrompt) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="p-4 md:p-6 border-b-2 border-slate-300 flex justify-between items-center sticky top-0 bg-white z-10">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">
              {isCreating ? 'Create New Prompt' : 'Edit Prompt'}
            </h2>
            <button
              onClick={() => { setEditingPrompt(null); setIsCreating(false); }}
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
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="Candy Cane Christmas"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Category *</label>
                <input
                  type="text"
                  value={editingPrompt.category}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="Holiday"
                />
                <p className="text-xs text-slate-500 mt-1">Create custom categories or use existing ones</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Description (Optional)</label>
              <input
                type="text"
                value={editingPrompt.description}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                placeholder="Candycane portrait Studio"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">AI Prompt Text</label>
              <textarea
                value={editingPrompt.promptText}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, promptText: e.target.value })}
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
                      onChange={(e) => handleImageUpload(e, 'previewImage')}
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
                      className="w-full aspect-video object-cover rounded-lg border-2 border-slate-300"
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
                      onChange={(e) => handleImageUpload(e, 'referenceImage')}
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
                    <button
                      onClick={() => removeTagFromPrompt(tag)}
                      className="hover:text-green-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                onKeyPress={(e) => {
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
                <label className="flex items-center gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:border-green-700 flex-1"
                  style={{ borderColor: !isPublic ? '#15803d' : '#cbd5e1' }}>
                  <input
                    type="radio"
                    name="visibility"
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
                <label className="flex items-center gap-3 cursor-pointer p-4 border-2 rounded-lg transition-all hover:border-green-700 flex-1"
                  style={{ borderColor: isPublic ? '#15803d' : '#cbd5e1' }}>
                  <input
                    type="radio"
                    name="visibility"
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

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={!editingPrompt.name || !editingPrompt.promptText || !editingPrompt.previewImage}
                className="flex-1 py-3 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {isCreating ? 'Create Prompt' : 'Update Prompt'}
              </button>
              <button
                onClick={() => { setEditingPrompt(null); setIsCreating(false); }}
                className="sm:px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="p-4 md:p-6 border-b-2 border-slate-300 flex justify-between items-start gap-4 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
              {eventId ? 'Browse Prompt Library' : 'Prompt Library'}
            </h2>
            <p className="text-sm md:text-base text-slate-600 mt-1">
              {eventId ? 'Select prompts to add to your event' : 'Manage AI prompts for your events'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 text-2xl flex-shrink-0"
          >
            ×
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4 flex-shrink-0 border-b-2 border-slate-300">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts..."
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 sm:flex-none px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700 bg-white text-slate-900 font-medium"
              >
                <option value="">All Categories</option>
                {allCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button
                onClick={handleCreateNew}
                className="px-4 sm:px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold flex items-center gap-2 whitespace-nowrap"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">New Prompt</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>

          {allTags.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Filter by Tags:</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-green-700 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    <Tag size={12} className="inline mr-1" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600">Loading prompts...</p>
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="mx-auto mb-4 text-slate-400" size={48} />
              <p className="text-slate-600 text-lg">No prompts found</p>
              <p className="text-slate-500 text-sm mt-2">
                {searchQuery || selectedTags.length > 0 || selectedCategory
                  ? 'Try adjusting your filters'
                  : 'Create your first prompt to get started'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {displayedPrompts.map(prompt => (
                <div
                  key={prompt.id}
                  className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="relative aspect-video bg-slate-200">
                    <img
                      src={prompt.previewImage}
                      alt={prompt.name}
                      className="w-full h-full object-cover"
                    />
                    {!prompt.isActive && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                          Inactive
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 mb-1">{prompt.name}</h3>
                    <p className="text-sm text-slate-600 mb-2">{prompt.description}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {prompt.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      Used {prompt.usageCount} times
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {eventId && onAddToEvent ? (
                        (() => {
                          const isAdded = selectedPrompts.some(p => p.id === prompt.id);
                          return (
                            <button
                              onClick={() => {
                                onAddToEvent(prompt);
                              }}
                              className={`flex-1 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1 ${
                                isAdded
                                  ? 'bg-slate-300 text-slate-700 cursor-default'
                                  : 'bg-green-700 hover:bg-green-800 text-white'
                              }`}
                              disabled={isAdded}
                            >
                              {isAdded ? (
                                <>
                                  <Check size={14} />
                                  Added to Event
                                </>
                              ) : (
                                <>
                                  <Plus size={14} />
                                  Add to Event
                                </>
                              )}
                            </button>
                          );
                        })()
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(prompt)}
                            className="flex-1 min-w-[100px] py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium text-sm flex items-center justify-center gap-1"
                          >
                            <Edit2 size={14} />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            onClick={() => handleTestPrompt(prompt)}
                            className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg font-medium text-sm"
                            title="Test this prompt"
                          >
                            <Sparkles size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(prompt.id)}
                            className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-medium text-sm"
                            title="Delete prompt"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                ))}
              </div>

              {hasMorePrompts && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
                  >
                    Load More
                    <span className="text-sm font-normal">({filteredPrompts.length - displayLimit} remaining)</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Test Prompt Modal */}
      {testingPrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b-2 border-slate-300 flex justify-between items-start gap-4 sticky top-0 bg-white z-10">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="text-green-700 flex-shrink-0" size={20} />
                  <span className="truncate">Test: {testingPrompt.name}</span>
                </h2>
                <p className="text-sm md:text-base text-slate-600 mt-1">Upload images to test this AI prompt</p>
              </div>
              <button
                onClick={closeTestModal}
                className="text-slate-600 hover:text-slate-900 text-2xl flex-shrink-0"
              >
                ×
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg border-2 border-slate-300">
                <h3 className="font-bold text-slate-900 mb-2">AI Prompt Text:</h3>
                <p className="text-sm text-slate-700 font-mono whitespace-pre-wrap">{testingPrompt.promptText}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Upload size={16} />
                    Source Photo *
                  </label>
                  {testSourceImage ? (
                    <div className="relative">
                      <img
                        src={testSourceImage}
                        alt="Source"
                        className="w-full aspect-square object-cover rounded-lg border-2 border-slate-300"
                      />
                      <button
                        onClick={() => setTestSourceImage('')}
                        className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                        title="Remove image"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div className="w-full aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                        <Upload size={48} className="text-slate-400 mb-2" />
                        <span className="text-sm text-slate-600">Upload a person photo</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTestImageUpload(e, 'source')}
                        className="hidden"
                      />
                    </label>
                  )}
                  <p className="text-xs text-slate-500 mt-2">This is the person photo to transform</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <ImageIcon size={16} />
                    Reference Image (Optional)
                  </label>
                  {testReferenceImage || testingPrompt.referenceImage ? (
                    <div className="relative">
                      <img
                        src={testReferenceImage || testingPrompt.referenceImage || ''}
                        alt="Reference"
                        className="w-full aspect-square object-cover rounded-lg border-2 border-slate-300"
                      />
                      {testReferenceImage && (
                        <button
                          onClick={() => setTestReferenceImage('')}
                          className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                          title="Remove image"
                        >
                          <X size={16} />
                        </button>
                      )}
                      {!testReferenceImage && testingPrompt.referenceImage && (
                        <div className="absolute bottom-2 left-2 bg-slate-900/75 text-white text-xs px-2 py-1 rounded">
                          Prompt's default reference
                        </div>
                      )}
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div className="w-full aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center hover:border-green-700 hover:bg-green-50 transition-colors">
                        <Upload size={48} className="text-slate-400 mb-2" />
                        <span className="text-sm text-slate-600">Upload style reference</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTestImageUpload(e, 'reference')}
                        className="hidden"
                      />
                    </label>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    {testingPrompt.referenceImage && !testReferenceImage
                      ? 'Using prompt\'s default reference or upload a new one'
                      : 'Optional: Upload a style reference image'}
                  </p>
                </div>
              </div>

              {testGeneratedImage && (
                <div className="border-2 border-green-700 rounded-lg p-4 bg-green-50">
                  <h3 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <Check size={18} />
                    Generated Result
                  </h3>
                  <img
                    src={testGeneratedImage}
                    alt="Generated"
                    className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                  />
                </div>
              )}

              {generationError && (
                <div className="border-2 border-red-600 rounded-lg p-4 bg-red-50">
                  <h3 className="font-bold text-red-900 mb-2">Error</h3>
                  <p className="text-sm text-red-800">{generationError}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-300">
                <button
                  onClick={handleRunTest}
                  disabled={!testSourceImage || isGenerating}
                  className="flex-1 py-3 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate Test Image
                    </>
                  )}
                </button>
                <button
                  onClick={closeTestModal}
                  className="sm:px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptLibrary;
