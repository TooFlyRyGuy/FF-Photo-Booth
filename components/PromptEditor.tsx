import React, { useState, useEffect } from 'react';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import type { PromptCustomField } from '../types';
import PromptVariableBuilder from './PromptVariableBuilder';

interface PromptEditorProps {
  promptText: string;
  onPromptTextChange: (text: string) => void;
  customFields?: PromptCustomField[];
  onCustomFieldsChange: (fields: PromptCustomField[]) => void;
  labelClassName?: string;
  textareaClassName?: string;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  promptText,
  onPromptTextChange,
  customFields = [],
  onCustomFieldsChange,
  labelClassName = 'block text-sm font-bold text-slate-900 mb-2',
  textareaClassName = 'w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700 min-h-[120px] font-mono text-sm',
}) => {
  const [customizeEnabled, setCustomizeEnabled] = useState(customFields.length > 0);

  useEffect(() => {
    setCustomizeEnabled(customFields.length > 0);
  }, [customFields.length]);

  const handleToggle = (enabled: boolean) => {
    setCustomizeEnabled(enabled);
    if (!enabled && customFields.length > 0) {
      onCustomFieldsChange([]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-slate-50 border-2 border-slate-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-slate-600" />
          <span className="text-sm font-semibold text-slate-700">Allow Guests to Customize this prompt</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={customizeEnabled}
          onClick={() => handleToggle(!customizeEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
            customizeEnabled ? 'bg-green-700' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              customizeEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {customizeEnabled ? (
        <PromptVariableBuilder
          fields={customFields}
          onChange={onCustomFieldsChange}
          promptText={promptText}
          onPromptTextChange={onPromptTextChange}
        />
      ) : (
        <div>
          <label className={labelClassName}>AI Prompt Text</label>
          <textarea
            value={promptText}
            onChange={(e) => onPromptTextChange(e.target.value)}
            className={textareaClassName}
            placeholder="Detailed AI generation prompt"
          />
        </div>
      )}
    </div>
  );
};

export default PromptEditor;
