import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { DocumentTypeInfo } from '../../types';

interface DocumentTypeComboboxProps {
  /** Candidate document types (already filtered by owning department upstream) */
  options: DocumentTypeInfo[];
  /** Currently selected document type id */
  value: string;
  onChange: (typeId: string) => void;
  /** Message rendered in the field when no options exist for the department */
  emptyMessage?: string;
  placeholder?: string;
}

const MAX_SUGGESTIONS = 8;

const optionLabel = (dt: DocumentTypeInfo) => `${dt.name} (${dt.retentionYears} Yrs Retention)`;

const matchesQuery = (dt: DocumentTypeInfo, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    dt.name.toLowerCase().includes(needle) ||
    (dt.code || '').toLowerCase().includes(needle) ||
    (dt.description || '').toLowerCase().includes(needle)
  );
};

// Case-insensitive highlight of the typed query inside a piece of text
const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-teal-50 dark:bg-teal-950/60 rounded-sm px-px text-teal-800 dark:text-teal-200">
        {text.slice(idx, idx + needle.length)}
      </span>
      {text.slice(idx + needle.length)}
    </>
  );
};

/**
 * Searchable type-ahead replacement for the Document Type <select>.
 * Behaves like a native dropdown when nothing is typed, and live-filters the
 * suggestions by name / code / description as the user types. Selection only
 * ever emits a valid document type id through onChange, so surrounding form
 * state and validation stay untouched.
 */
export const DocumentTypeCombobox: React.FC<DocumentTypeComboboxProps> = ({
  options,
  value,
  onChange,
  emptyMessage = 'No document types available',
  placeholder = 'Search by name, code or description...'
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(dt => dt.id === value) || null;

  const filtered = useMemo(
    () => options.filter(dt => matchesQuery(dt, query)).slice(0, MAX_SUGGESTIONS),
    [options, query]
  );

  // Close on outside click without changing the selection
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Keep the highlighted row visible while navigating with the keyboard
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openList = () => {
    if (options.length === 0) return;
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  };

  const selectOption = (dt: DocumentTypeInfo) => {
    onChange(dt.id);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setQuery('');
      }
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openList();
      }
      return; // Enter/Tab keep native behavior (form submit / focus move)
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[activeIndex]) selectOption(filtered[activeIndex]);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  // No types tied to the selected department — render an inert field
  if (options.length === 0) {
    return (
      <div className="input bg-zinc-100 dark:bg-zinc-800/80 font-medium text-zinc-400 dark:text-zinc-500 cursor-not-allowed truncate">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        value={open ? query : (selected ? optionLabel(selected) : '')}
        placeholder={placeholder}
        onFocus={openList}
        onClick={() => { if (!open) openList(); }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        className="input pr-8 font-semibold"
      />
      <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -tranzinc-y-1/2 pointer-events-none" />

      {open && (
        <div
          ref={listRef}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()} // keep input focus while picking a row
          className="absolute z-50 left-0 right-0 mt-1.5 card rounded-xl shadow-lg overflow-y-auto max-h-80 animate-in fade-in duration-100"
        >
          {filtered.length === 0 ? (
            <div className="px-3.5 py-4 text-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              No matching document types found.
            </div>
          ) : (
            filtered.map((dt, i) => {
              const isActive = i === activeIndex;
              const isSelected = dt.id === value;
              return (
                <div
                  key={dt.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectOption(dt)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`px-3.5 py-2.5 cursor-pointer space-y-0.5 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${
                    isActive
                      ? 'bg-teal-50 dark:bg-teal-950/60'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="chip flex-shrink-0 font-mono bg-zinc-100 dark:bg-zinc-800 text-teal-700 dark:text-teal-300 border border-zinc-200 dark:border-zinc-700">
                      <Highlight text={dt.code} query={query} />
                    </span>
                    <span className="flex-1 truncate font-semibold text-zinc-800 dark:text-zinc-200">
                      <Highlight text={dt.name} query={query} />
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />}
                    <span className="flex-shrink-0 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                      {dt.retentionYears} Yrs
                    </span>
                  </div>
                  {dt.description && (
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate pl-0.5">
                      <Highlight text={dt.description} query={query} />
                    </p>
                  )}
                </div>
              );
            })
          )}
          {filtered.length > 0 && (
            <div className="px-3.5 py-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/60 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-1.5">
              <Search className="w-3 h-3" />
              Showing {filtered.length} of {options.length} type(s) — arrow keys to navigate, Enter to select
            </div>
          )}
        </div>
      )}
    </div>
  );
};
