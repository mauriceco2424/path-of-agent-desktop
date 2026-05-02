/**
 * AccountNameInput Component
 *
 * Reusable input component for PoE account names with autocomplete
 * dropdown showing previously used account names from history.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { useAccountHistory } from '../../hooks/useAccountHistory';

interface AccountNameInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function AccountNameInput({
  value,
  onChange,
  onKeyDown,
  disabled = false,
  autoFocus = false,
  className = '',
}: AccountNameInputProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { history, removeFromHistory } = useAccountHistory();

  // Filter history based on current input
  const filteredHistory = history.filter(
    (name) =>
      !value.trim() || name.toLowerCase().includes(value.toLowerCase())
  );

  const showDropdown = isDropdownOpen && filteredHistory.length > 0 && !disabled;

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered history changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredHistory.length]);

  // Handle keyboard navigation
  const handleKeyDownInternal = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showDropdown) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightedIndex((prev) =>
              prev < filteredHistory.length - 1 ? prev + 1 : 0
            );
            return;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : filteredHistory.length - 1
            );
            return;
          case 'Enter':
            if (highlightedIndex >= 0 && highlightedIndex < filteredHistory.length) {
              e.preventDefault();
              onChange(filteredHistory[highlightedIndex]);
              setIsDropdownOpen(false);
              setHighlightedIndex(-1);
              return;
            }
            break;
          case 'Escape':
            setIsDropdownOpen(false);
            setHighlightedIndex(-1);
            return;
        }
      }
      // Call parent onKeyDown for other keys (Ctrl+Enter handling)
      onKeyDown?.(e);
    },
    [showDropdown, highlightedIndex, filteredHistory, onChange, onKeyDown]
  );

  const handleSelect = (name: string) => {
    onChange(name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleRemove = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    removeFromHistory(name);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsDropdownOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setIsDropdownOpen(true)}
        onKeyDown={handleKeyDownInternal}
        placeholder="e.g., MyAccount#1234"
        disabled={disabled}
        autoFocus={autoFocus}
        className={`w-full px-4 py-3 rounded-sm border border-amber-900/40 bg-slate-950/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${className}`}
      />

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-slate-600/50 bg-slate-800 shadow-lg overflow-hidden">
          <div className="py-1">
            {filteredHistory.map((name, index) => (
              <div
                key={name}
                onClick={() => handleSelect(name)}
                className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${
                  index === highlightedIndex
                    ? 'bg-amber-500/20 text-slate-100'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-sm">{name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, name)}
                  className="p-1 rounded hover:bg-slate-600/50 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Remove from history"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
