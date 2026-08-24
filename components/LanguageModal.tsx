import React, { useState, useEffect } from 'react';
import { X, Globe, Save, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Event, Prompt, PromptTranslation, KioskTextOverride } from '../types';
import { SUPPORTED_LANGUAGES, LanguageCode, translateText } from '../lib/i18n';
import { getPromptTranslationsBatch, savePromptTranslationsBatch, autoTranslatePrompts, getKioskTextOverrides, saveKioskTextOverrides, autoTranslateKioskText } from '../services/backendService';

interface LanguageModalProps {
  event: Partial<Event>;
  prompts: Prompt[];
  onClose: () => void;
  onSave: (kioskLanguages: string[]) => void;
}

interface KioskTextGroup {
  label: string;
  keys: string[];
}

const KIOSK_TEXT_GROUPS: KioskTextGroup[] = [
  {
    label: 'Attract Screen',
    keys: ['kiosk.tapToStart', 'kiosk.aiPhotoExperience', 'kiosk.checkingCredits', 'kiosk.photosRemaining', 'kiosk.photoRemaining', 'kiosk.exitKiosk'],
  },
  {
    label: 'No Credits Screen',
    keys: ['kiosk.outOfCredits', 'kiosk.outOfCreditsDesc', 'kiosk.upgradeSubscription', 'kiosk.purchaseCredits', 'kiosk.needHelp', 'kiosk.contactOrganizer'],
  },
  {
    label: 'Device Limit Screen',
    keys: ['kiosk.photoLimitReached', 'kiosk.deviceLimitDesc', 'kiosk.limit', 'kiosk.photoPerDevice', 'kiosk.photosPerDevice', 'kiosk.askOrganizer'],
  },
  {
    label: 'Prompt Selection',
    keys: ['kiosk.chooseYourStyle', 'kiosk.cancel', 'kiosk.back'],
  },
  {
    label: 'Camera',
    keys: ['kiosk.switchCamera', 'kiosk.switchToFront'],
  },
  {
    label: 'Processing',
    keys: ['kiosk.creatingMagic', 'kiosk.applyingStyle', 'kiosk.uploadingImage'],
  },
  {
    label: 'Review',
    keys: ['kiosk.lookGood', 'kiosk.retake', 'kiosk.generateAI'],
  },
  {
    label: 'Result / Delivery',
    keys: ['kiosk.getYourPhoto', 'kiosk.downloadNowOrSent', 'kiosk.downloadNow', 'kiosk.getItSent', 'kiosk.downloadNowBtn', 'kiosk.downloadPhoto', 'kiosk.orGetItSent', 'kiosk.sms', 'kiosk.sendSms', 'kiosk.sendViaWhatsApp', 'kiosk.whatsappConsent', 'kiosk.email', 'kiosk.sendViaEmail', 'kiosk.preparingLink', 'kiosk.sending', 'kiosk.scanForInstantAccess', 'kiosk.noPhoneRequired', 'kiosk.viewEventGallery', 'kiosk.skipStartOver', 'kiosk.startOverNow', 'kiosk.sent', 'kiosk.checkYourPhone', 'kiosk.sendToAnother', 'kiosk.startingOverIn', 'kiosk.wantToCreate', 'kiosk.getYourOwnAccount', 'kiosk.longPressToSave', 'kiosk.tapToReturnFullscreen', 'kiosk.returnToFullscreen', 'kiosk.fullscreenPrompt', 'kiosk.loading'],
  },
  {
    label: 'Event Time States',
    keys: ['kiosk.eventNotStarted', 'kiosk.eventNotStartedDesc', 'kiosk.eventStarts', 'kiosk.eventHasEnded', 'kiosk.eventConcluded', 'kiosk.eventEnded', 'kiosk.thankYou', 'kiosk.upgradePrompt'],
  },
];

const LanguageModal: React.FC<LanguageModalProps> = ({ event, prompts, onClose, onSave }) => {
  const [selectedLanguages, setSelectedLanguages] = useState<Set<LanguageCode>>(
    new Set(
      (event.kioskLanguages || (event.kioskLanguage ? [event.kioskLanguage] : ['en-US']))
        .filter((l): l is LanguageCode => SUPPORTED_LANGUAGES.some(s => s.code === l))
    )
  );
  const [translations, setTranslations] = useState<Record<string, Record<string, { name: string; description: string }>>>({});
  const [isTranslating, setIsTranslating] = useState<LanguageCode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingTranslations, setLoadingTranslations] = useState(false);

  const [kioskTextOverrides, setKioskTextOverrides] = useState<Record<string, Record<string, string>>>({});
  const [loadingKioskText, setLoadingKioskText] = useState(false);
  const [isTranslatingKiosk, setIsTranslatingKiosk] = useState<LanguageCode | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTranslations();
    loadKioskTextOverrides();
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

  const loadKioskTextOverrides = async () => {
    if (!event.id) return;
    setLoadingKioskText(true);
    try {
      const overrides = await getKioskTextOverrides(event.id);
      const map: Record<string, Record<string, string>> = {};
      for (const o of overrides) {
        if (!map[o.languageCode]) map[o.languageCode] = {};
        map[o.languageCode][o.textKey] = o.textValue;
      }
      setKioskTextOverrides(map);
    } catch (error) {
      console.error('Failed to load kiosk text overrides:', error);
    } finally {
      setLoadingKioskText(false);
    }
  };

  const toggleLanguage = (code: LanguageCode) => {
    setSelectedLanguages(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const handleAutoTranslate = async (lang: LanguageCode) => {
    if (prompts.length === 0 || lang === 'en-US') return;
    setIsTranslating(lang);
    try {
      const promptsToTranslate = prompts.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
      }));
      const results = await autoTranslatePrompts(promptsToTranslate, lang);
      const newTranslations = { ...translations };
      for (const result of results) {
        if (!newTranslations[result.id]) newTranslations[result.id] = {};
        newTranslations[result.id][lang] = {
          name: result.name,
          description: result.description,
        };
      }
      setTranslations(newTranslations);
    } catch (error) {
      console.error('Auto-translate failed:', error);
      alert(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTranslating(null);
    }
  };

  const handleAutoTranslateAll = async () => {
    const nonEnglishLangs = Array.from(selectedLanguages).filter(l => l !== 'en-US');
    for (const lang of nonEnglishLangs) {
      await handleAutoTranslate(lang);
    }
  };

  const handleAutoTranslateKioskText = async (lang: LanguageCode) => {
    if (lang === 'en-US') return;
    setIsTranslatingKiosk(lang);
    try {
      const texts = KIOSK_TEXT_GROUPS.flatMap(g => g.keys).map(key => ({
        key,
        value: translateText(key, 'en-US'),
      }));
      const results = await autoTranslateKioskText(texts, lang);
      setKioskTextOverrides(prev => {
        const next = { ...prev };
        if (!next[lang]) next[lang] = {};
        for (const result of results) {
          next[lang][result.key] = result.value;
        }
        return next;
      });
    } catch (error) {
      console.error('Kiosk text auto-translate failed:', error);
      alert(`Kiosk text translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTranslatingKiosk(null);
    }
  };

  const handleAutoTranslateAllKioskText = async () => {
    const nonEnglishLangs = Array.from(selectedLanguages).filter(l => l !== 'en-US');
    for (const lang of nonEnglishLangs) {
      await handleAutoTranslateKioskText(lang);
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

  const handleKioskTextChange = (lang: LanguageCode, textKey: string, value: string) => {
    setKioskTextOverrides(prev => {
      const next = { ...prev };
      if (!next[lang]) next[lang] = {};
      next[lang][textKey] = value;
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

      if (event.id) {
        const allKioskOverrides: KioskTextOverride[] = [];
        for (const [langCode, keyMap] of Object.entries(kioskTextOverrides)) {
          for (const [textKey, textValue] of Object.entries(keyMap)) {
            if (textValue.trim()) {
              allKioskOverrides.push({
                eventId: event.id,
                languageCode: langCode,
                textKey,
                textValue,
              });
            }
          }
        }

        if (allKioskOverrides.length > 0) {
          await saveKioskTextOverrides(allKioskOverrides);
        }
      }

      onSave(Array.from(selectedLanguages));
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

  const translationLanguages = SUPPORTED_LANGUAGES.filter(l => selectedLanguages.has(l.code) && l.code !== 'en-US');
  const hasNonEnglishSelected = translationLanguages.length > 0;

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
          {/* Kiosk Language Multi-Select */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Kiosk Languages</label>
            <p className="text-sm text-slate-600 mb-3">
              Select one or more languages guests will see on the kiosk screen for this event. English is always included.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguages.has(lang.code);
                const isEnglish = lang.code === 'en-US';
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => !isEnglish && toggleLanguage(lang.code)}
                    disabled={isEnglish}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-green-700 bg-green-50'
                        : 'border-slate-300 bg-white hover:border-slate-400'
                    } ${isEnglish ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-green-700 bg-green-700' : 'border-slate-300'
                    }`}>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{lang.nativeLabel}</p>
                      <p className="text-xs text-slate-500 truncate">{lang.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kiosk Screen Text Overrides */}
          {hasNonEnglishSelected && (
            <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b-2 border-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Kiosk Screen Text</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Customize the text guests see on the kiosk screen for each language. Edit any text below, or click auto-translate to generate translations from the English defaults.
                    </p>
                  </div>
                  <button
                    onClick={handleAutoTranslateAllKioskText}
                    disabled={isTranslatingKiosk !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                  >
                    {isTranslatingKiosk !== null ? (
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

              {loadingKioskText ? (
                <div className="p-6 text-center text-slate-500">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-green-700 rounded-full animate-spin mx-auto mb-2" />
                  Loading kiosk text...
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {translationLanguages.map((lang) => (
                    <div key={lang.code} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900">{lang.nativeLabel} ({lang.label})</h4>
                        <button
                          type="button"
                          onClick={() => handleAutoTranslateKioskText(lang.code)}
                          disabled={isTranslatingKiosk !== null}
                          className="text-xs text-blue-600 hover:text-blue-700 disabled:text-slate-400 flex items-center gap-1 transition-colors"
                        >
                          {isTranslatingKiosk === lang.code ? (
                            <>
                              <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                              Translating...
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              Translate
                            </>
                          )}
                        </button>
                      </div>

                      {KIOSK_TEXT_GROUPS.map((group) => {
                        const isExpanded = expandedGroups.has(`${lang.code}:${group.label}`);
                        return (
                          <div key={`${lang.code}:${group.label}`} className="border border-slate-200 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleGroup(`${lang.code}:${group.label}`)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{group.label}</span>
                              {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                            </button>
                            {isExpanded && (
                              <div className="p-3 space-y-2">
                                {group.keys.map((key) => {
                                  const englishDefault = translateText(key, 'en-US');
                                  const currentValue = kioskTextOverrides[lang.code]?.[key] ?? englishDefault;
                                  const isModified = kioskTextOverrides[lang.code]?.[key] !== undefined && kioskTextOverrides[lang.code][key] !== englishDefault;
                                  return (
                                    <div key={key} className="space-y-1">
                                      <label className="text-xs text-slate-500 font-mono">{key}</label>
                                      <input
                                        type="text"
                                        value={currentValue}
                                        onChange={(e) => handleKioskTextChange(lang.code, key, e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm ${
                                          isModified ? 'border-blue-300 bg-blue-50' : 'border-slate-300'
                                        }`}
                                        placeholder={englishDefault}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Prompt Translations */}
          {prompts.length > 0 && hasNonEnglishSelected && (
            <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b-2 border-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Prompt Translations</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Translate prompt names and descriptions for guests in the selected languages. Click auto-translate to generate, then edit as needed.
                    </p>
                  </div>
                  <button
                    onClick={handleAutoTranslateAll}
                    disabled={isTranslating !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                  >
                    {isTranslating !== null ? (
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
                          <div key={lang.code} className="space-y-2 pl-2 border-l-2 border-slate-100 ml-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-600 font-bold uppercase tracking-wide">
                                {lang.nativeLabel} ({lang.label})
                              </label>
                              <button
                                type="button"
                                onClick={() => handleAutoTranslate(lang.code)}
                                disabled={isTranslating !== null}
                                className="text-xs text-green-700 hover:text-green-800 disabled:text-slate-400 flex items-center gap-1 transition-colors"
                              >
                                {isTranslating === lang.code ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-slate-300 border-t-green-700 rounded-full animate-spin" />
                                    Translating...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={12} />
                                    Translate
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={trans?.name || ''}
                                onChange={(e) => handleTranslationChange(prompt.id, lang.code, 'name', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-700 text-sm"
                                placeholder={`${lang.nativeLabel} name...`}
                              />
                              <input
                                type="text"
                                value={trans?.description || ''}
                                onChange={(e) => handleTranslationChange(prompt.id, lang.code, 'description', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-700 text-sm"
                                placeholder={`${lang.nativeLabel} description...`}
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

          {prompts.length > 0 && !hasNonEnglishSelected && (
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Only English is selected. Select additional languages above to enable prompt translations and kiosk screen text customization.
              </p>
            </div>
          )}

          {prompts.length === 0 && !hasNonEnglishSelected && (
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
