import React, { useEffect, useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { confirmationMatchesEvent } from '../lib/eventAnalytics';

interface ClearEventStatsButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const ClearEventStatsButton: React.FC<ClearEventStatsButtonProps> = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    data-testid="clear-event-stats"
    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-700 bg-white border-2 border-red-600 rounded-lg hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
  >
    <RotateCcw size={16} />
    Clear statistics
  </button>
);

interface ClearEventStatsDialogProps {
  eventName: string;
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const ClearEventStatsDialog: React.FC<ClearEventStatsDialogProps> = ({
  eventName,
  open,
  busy,
  error,
  onClose,
  onConfirm,
}) => {
  const [typedName, setTypedName] = useState('');
  const titleId = useId();
  const inputId = useId();
  const matches = confirmationMatchesEvent(typedName, eventName);

  useEffect(() => {
    if (open) setTypedName('');
  }, [open, eventName]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="clear-event-stats-dialog"
        className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-lg overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 border-b-2 border-slate-200">
          <h3 id={titleId} className="text-xl font-bold text-slate-900">
            Clear statistics for {eventName}?
          </h3>
          <p className="text-sm text-slate-600 mt-2">
            This resets documented statistics for this event only. It cannot be undone.
          </p>
        </div>

        <div className="p-6 space-y-4 text-sm text-slate-700">
          <div>
            <p className="font-semibold text-slate-900 mb-1">Removed from this report</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Photo totals, AI theme popularity, and the 30-day activity chart return to zero.</li>
              <li>Phone numbers from generations before this reset are hidden on this report.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Left unchanged</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Guest photos, gallery files, and live slideshow images stay in place.</li>
              <li>Prompts, event settings, and per-device photo limits stay as they are.</li>
              <li>Billing credits, usage records, other events, and account-wide stats stay as they are.</li>
            </ul>
          </div>

          <div>
            <label htmlFor={inputId} className="block font-semibold text-slate-900 mb-2">
              Type <span className="font-mono text-red-700">{eventName}</span> to confirm
            </label>
            <input
              id={inputId}
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              autoFocus
              autoComplete="off"
              disabled={busy}
              className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-red-600"
              placeholder={eventName}
            />
          </div>

          {error && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t-2 border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-slate-700 border-2 border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="clear-event-stats-confirm"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Clearing...' : 'Clear statistics'}
          </button>
        </div>
      </div>
    </div>
  );
};
