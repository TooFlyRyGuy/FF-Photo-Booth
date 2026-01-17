import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-4 border-green-700 rounded-lg overflow-hidden shadow-lg">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 transition-all"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="text-green-200" size={24} />
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="text-white" size={24} />
        ) : (
          <ChevronDown className="text-white animate-bounce" size={24} />
        )}
      </button>
      {isOpen && (
        <div className="p-6 bg-white space-y-6 border-t-4 border-green-600">
          {children}
        </div>
      )}
    </div>
  );
}
