import React, { useRef } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Variable } from 'lucide-react';
import type { PromptCustomField, CustomFieldType } from '../types';

interface PromptVariableBuilderProps {
  fields: PromptCustomField[];
  onChange: (fields: PromptCustomField[]) => void;
  promptText: string;
  onPromptTextChange: (text: string) => void;
}

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Multi-line Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'color', label: 'Color Picker' },
  { value: 'checkbox', label: 'Checkbox (Yes/No)' },
];

const genId = () => `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const slugify = (label: string) =>
  label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const PromptVariableBuilder: React.FC<PromptVariableBuilderProps> = ({
  fields,
  onChange,
  promptText,
  onPromptTextChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addField = () => {
    onChange([...fields, {
      id: genId(),
      label: '',
      placeholder: '',
      type: 'text',
      required: false,
      aiGenerated: false,
    }]);
  };

  const updateField = (id: string, patch: Partial<PromptCustomField>) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id));
  };

  const moveField = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next);
  };

  const insertVariable = (placeholder: string) => {
    if (!placeholder) return;
    const ta = textareaRef.current;
    const tag = `{${placeholder}}`;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = promptText.slice(0, start) + tag + promptText.slice(end);
      onPromptTextChange(newText);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + tag.length;
      });
    } else {
      onPromptTextChange(promptText + tag);
    }
  };

  const visibleFields = fields.filter(f => !f.aiGenerated);

  return (
    <div className="border-2 border-slate-200 rounded-xl bg-slate-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
          <Variable size={15} className="text-slate-500" />
          Guest Input Fields
        </h4>
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors"
        >
          <Plus size={13} />
          Add Field
        </button>
      </div>

      {fields.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          No guest input fields. Add one to collect information from guests (like a name or jersey number) before their photo is taken.
        </p>
      )}

      {fields.map((field, index) => (
        <div key={field.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Field {index + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
                <ChevronUp size={14} />
              </button>
              <button type="button" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
                <ChevronDown size={14} />
              </button>
              <button type="button" onClick={() => removeField(field.id)}
                className="p-1 text-red-400 hover:text-red-600 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Label (guest sees)</label>
              <input
                type="text"
                value={field.label}
                onChange={e => {
                  const label = e.target.value;
                  updateField(field.id, {
                    label,
                    placeholder: slugify(label),
                  });
                }}
                placeholder="e.g. Player Name"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-700"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Variable name</label>
              <input
                type="text"
                value={field.placeholder}
                onChange={e => updateField(field.id, { placeholder: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })}
                placeholder="e.g. name"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md font-mono text-xs focus:outline-none focus:border-green-700"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Field type</label>
            <select
              value={field.type}
              onChange={e => updateField(field.id, { type: e.target.value as CustomFieldType })}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-700"
            >
              {FIELD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {field.type === 'select' && (
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">Options (one per line)</label>
              <textarea
                value={(field.options || []).join('\n')}
                onChange={e => updateField(field.id, { options: e.target.value.split('\n') })}
                placeholder={'Forward\nDefense\nGoalie'}
                rows={3}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-700"
              />
            </div>
          )}

          {field.type === 'checkbox' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">"Yes" label</label>
                <input
                  type="text"
                  value={field.trueLabel || ''}
                  onChange={e => updateField(field.id, { trueLabel: e.target.value })}
                  placeholder="Yes, add logo"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-700"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">"No" label</label>
                <input
                  type="text"
                  value={field.falseLabel || ''}
                  onChange={e => updateField(field.id, { falseLabel: e.target.value })}
                  placeholder="No logo"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-700"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={field.required || false}
                onChange={e => updateField(field.id, { required: e.target.checked })}
                className="w-3.5 h-3.5 accent-green-700"
              />
              Required
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={field.aiGenerated || false}
                onChange={e => updateField(field.id, { aiGenerated: e.target.checked })}
                className="w-3.5 h-3.5 accent-green-700"
              />
              <Sparkles size={12} className="text-amber-500" />
              AI-generated
            </label>
          </div>

          {field.aiGenerated && (
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                AI instruction (uses other field values as context)
              </label>
              <textarea
                value={field.aiPrompt || ''}
                onChange={e => updateField(field.id, { aiPrompt: e.target.value })}
                placeholder={'e.g. Write a 2-sentence player bio for {name}, jersey number {jersey_number}'}
                rows={2}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-700"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Guests won't see this field. The AI generates it before the photo using their other answers.
              </p>
            </div>
          )}
        </div>
      ))}

      {visibleFields.length > 0 && (
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Insert variable into prompt</label>
          <div className="flex flex-wrap gap-1.5">
            {visibleFields.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => insertVariable(f.placeholder)}
                disabled={!f.placeholder}
                className="px-2 py-1 text-xs font-mono bg-green-100 text-green-800 rounded-md hover:bg-green-200 disabled:opacity-40 transition-colors"
              >
                {`{${f.placeholder || '?'}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-[11px] font-semibold text-slate-500 block mb-1">AI Prompt Text</label>
        <textarea
          ref={textareaRef}
          value={promptText}
          onChange={e => onPromptTextChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-700 font-mono text-xs"
          placeholder="Enter your prompt text here. Use {variable_name} placeholders where guest inputs should go."
        />
        {fields.length > 0 && (
          <div className="mt-1.5 p-2 bg-slate-100 rounded text-[11px] text-slate-500 leading-relaxed">
            <span className="font-semibold">Preview:</span> {promptText || 'Start typing your prompt...'}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptVariableBuilder;
