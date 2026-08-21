import React, { useState, useEffect } from 'react';
import { X, Globe, Save, Sparkles, Check } from 'lucide-react';
import { Event, Prompt, PromptTranslation } from '../types';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../lib/i18n';
import { getPromptTranslationsBatch, savePromptTranslationsBatch, autoTranslatePrompts } from '../services/backendService';

interface LanguageModalProps {
  event: Partial<Event>;
  prompts: Prompt[];
  onClose: () => void;
  onSave: (kioskLanguage: string) => void;
}

const LanguageModal: React.FC<LanguageModalProps> = ({ event, prompts, onClose, onSave }) => {
  const [kioskLanguage, setKioskLanguage] = useState<LanguageCode>(
    (event.kioskLanguage as LanguageCode) || 'en-US'
  );
  const [translations, setTranslations] = useState<Record<string, Record<string, { name: string; description: string }>>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingTranslations, setLoadingTranslations] = useState(false);

  useEffect(() => {
    loadTranslations();
  }, []);

  const loadTranslations = async () => {
    if (prompts.length === 0) return;
    setLoadingTranslations(true);
    try {
      const promptIds = prompts.map(p => p.id).filter(Boolean);
      if (promptIds.length === 0) return;

      const batch = await getPromptTranslationsBatch(promptIds);
      const map: Record<string, Record<string, { name: string; description: string }>> = {};
      for (const [pid, trans] of Object.entries(batch)) {
        map[pid] = {};
        for (const t of trans) {
          map[pid][t.languageCode] = { name: t.name, description: t.description || '' };
        }
      }
      setTranslations(map);
    } catch (error) {
      console.error('Failed to load translations:', error);
    } finally {
      setLoadingTranslations(false);
    }
  };

  const handleAutoTranslateAll = async () => {
    if (prompts.length === 0 || kioskLanguage === 'en-US') return;
    setIsTranslating(true);
    try {
      const promptsToTranslate = prompts.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
      }));
      const results = await autoTranslatePrompts(promptsToTranslate, kioskLanguage);
      const newTranslations = { ...translations };
      for (const result of results) {
        if (!newTranslations[result.id]) newTranslations[result.id] = {};
        newTranslations[result.id][kioskLanguage] = {
          name: result.name,
          description: result.description,
        };
      }
      setTranslations(newTranslations);
    } catch (error) {
      console.error('Auto-translate failed:', error);
      alert(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslationChange = (promptId: string, lang: LanguageCode, field: 'name' | 'description', value: string) => {
    setTranslations(prev => {
      const next = { ...prev };
      if (!next[promptId]) next[promptId] = {};
      if (!next[promptId][lang]) next[promptId][lang] = { name: '', description: '' };
      next[promptId][lang] = { ...next[promptId][lang], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const allTranslations: PromptTranslation[] = [];
      for (const [promptId, langs] of Object.entries(translations)) {
        for (const [langCode, data] of Object.entries(langs)) {
          if (data.name.trim()) {
            allTranslations.push({
              promptId,
              languageCode: langCode,
              name: data.name,
              description: data.description || '',
            });
          }
        }
      }

      if (allTranslations.length > 0) {
        await savePromptTranslationsBatch(allTranslations);
      }

      onSave(kioskLanguage);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (error) {
      console.error('Failed to save language settings:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const translationLanguages = SUPPORTED_LANGUAGES.filter(l => l.code !== 'en-US');

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 md:p-6 border-b-2 border-slate-300 flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <Globe className="text-green-700" size={24} />
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">Language Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-900 text-2xl flex-shrink-0">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Kiosk Language Picker */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Kiosk Language</label>
            <p className="text-sm text-slate-600 mb-3">
              Choose the language guests will see on the kiosk screen for this event.
            </p>
            <select
              value={kioskLanguage}
              onChange={(e) => setKioskLanguage(e.target.value as LanguageCode)}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700 bg-white text-slate-900"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeLabel} ({lang.label})
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Translations */}
          {prompts.length > 0 && kioskLanguage !== 'en-US' && (
            <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b-2 border-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Prompt Translations</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Translate prompt names and descriptions for guests. Click auto-translate to generate, then edit as needed.
                    </p>
                  </div>
                  <button
                    onClick={handleAutoTranslateAll}
                    disabled={isTranslating}
                    className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                  >
                    {isTranslating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Translating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Auto-Translate All
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                {loadingTranslations ? (
                  <div className="p-6 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-green-700 rounded-full animate-spin mx-auto mb-2" />
                    Loading translations...
                  </div>
                ) : (
                  prompts.map((prompt) => (
                    <div key={prompt.id} className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        {prompt.previewImage && (
                          <img
                            src={prompt.previewImage}
                            alt={prompt.name}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm">{prompt.name}</p>
                          <p className="text-xs text-slate-500 truncate">{prompt.description || '(no description)'}</p>
                        </div>
                      </div>

                      {translationLanguages.map((lang) => {
                        const trans = translations[prompt.id]?.[lang.code];
                        return (
                          <div key={lang.code} className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                            <div>
                              <label className="text-xs text-slate-500 font-medium">
                                {lang.nativeLabel} Name
                              </label>
                              <input
                                type="text"
                                value={trans?.name || ''}
                                onChange={(e) => handleTranslationChange(prompt.id, lang.code, 'name', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-700 text-sm"
                                placeholder={prompt.name}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 font-medium">
                                {lang.nativeLabel} Description
                              </label>
                              <input
                                type="text"
                                value={trans?.description || ''}
                                onChange={(e) => handleTranslationChange(prompt.id, lang.code, 'description', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-700 text-sm"
                                placeholder={prompt.description || ''}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {prompts.length > 0 && kioskLanguage === 'en-US' && (
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Kiosk language is set to English. Select a different language above to enable prompt translations.
              </p>
            </div>
          )}

          {prompts.length === 0 && (
            <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-lg">
              <p className="text-sm text-slate-600">
                No prompts are assigned to this event yet. Add prompts to the event first, then return here to translate them.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t-2 border-slate-300 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-700 animate-fade-in">
              <Check size={18} />
              <span className="text-sm font-medium">Saved successfully</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageModal;
