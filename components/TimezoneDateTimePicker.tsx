import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import {
  getTimezoneAbbreviation,
  dateToLocalInputValue,
  formatDateTimeInTimezone,
} from '../services/timezoneService';

interface TimezoneDateTimePickerProps {
  label: string;
  value?: string;
  timezone: string;
  onChange: (isoString: string) => void;
  disabled?: boolean;
  required?: boolean;
  minDate?: string;
  helperText?: string;
}

export function TimezoneDateTimePicker({
  label,
  value,
  timezone,
  onChange,
  disabled = false,
  required = false,
  minDate,
  helperText,
}: TimezoneDateTimePickerProps) {
  const [localValue, setLocalValue] = useState('');
  const [timezoneAbbr, setTimezoneAbbr] = useState('UTC');

  useEffect(() => {
    if (value) {
      const date = new Date(value);
      setLocalValue(dateToLocalInputValue(date, timezone));
      setTimezoneAbbr(getTimezoneAbbreviation(timezone, date));
    } else {
      setLocalValue('');
    }
  }, [value, timezone]);

  useEffect(() => {
    setTimezoneAbbr(getTimezoneAbbreviation(timezone));
  }, [timezone]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLocalValue = e.target.value;
    setLocalValue(newLocalValue);

    if (newLocalValue) {
      const [datePart, timePart] = newLocalValue.split('T');
      const localDateStr = `${datePart}T${timePart}:00`;

      const tempDate = new Date(localDateStr);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(tempDate);
      const values: Record<string, string> = {};

      parts.forEach(part => {
        if (part.type !== 'literal') {
          values[part.type] = part.value;
        }
      });

      const tzOffset = tempDate.getTimezoneOffset();
      const adjusted = new Date(tempDate.getTime() - tzOffset * 60000);

      const utcDate = new Date(localDateStr);

      onChange(utcDate.toISOString());
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  const minValue = minDate ? dateToLocalInputValue(new Date(minDate), timezone) : undefined;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          type="datetime-local"
          value={localValue}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          min={minValue}
          className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <Clock size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-600">{timezoneAbbr}</span>
        </div>
      </div>

      {value && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {formatDateTimeInTimezone(value, timezone)}
          </p>
          {!disabled && !required && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
}
