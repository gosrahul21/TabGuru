import { useState, useEffect, useRef } from 'react';
import { getRecentDestinations, removeRecentDestination } from '../../storage/storage';
import { useTheme } from '../ThemeContext';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

const POPULAR_DOMAINS = [
  'gmail.com', 'chatgpt.com', 'youtube.com', 'x.com',
  'reddit.com', 'calendar.google.com', 'linear.app', 'notion.so',
];

export default function SearchInput({ value, onChange, onSubmit }: Props) {
  const { theme } = useTheme();
  const [recentDestinations, setRecentDestinations] = useState<string[]>([]);
  const [hiddenDomains, setHiddenDomains] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRecentDestinations().then(setRecentDestinations);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSuggestions = Array.from(new Set([...recentDestinations, ...POPULAR_DOMAINS]))
    .filter((domain) => !hiddenDomains.has(domain));

  const filteredSuggestions = value.trim() === ''
    ? []
    : allSuggestions.filter((d) => d.toLowerCase().includes(value.toLowerCase())).slice(0, 6);

  useEffect(() => { setSelectedIndex(-1); }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && filteredSuggestions.length > 0 && e.key === 'ArrowDown') {
      setIsOpen(true);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
        onChange(filteredSuggestions[selectedIndex]);
        setIsOpen(false);
      } else {
        onSubmit();
        setIsOpen(false);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((p) => (p < filteredSuggestions.length - 1 ? p + 1 : p));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((p) => (p > 0 ? p - 1 : p));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (domain: string) => { onChange(domain); setIsOpen(false); };

  const handleRemove = (e: React.MouseEvent, domain: string) => {
    e.stopPropagation();
    removeRecentDestination(domain);
    setHiddenDomains((prev) => { const next = new Set(prev); next.add(domain); return next; });
    setSelectedIndex(-1);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Search icon */}
      <span className={`absolute left-3.5 top-3.5 pointer-events-none z-10 ${theme.inputIcon}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </span>

      <input
        id="destination-input"
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="google.com, 'kafka tutorial', youtube.com/watch…"
        className={`
          w-full pl-9 pr-4 py-3 rounded-xl text-sm font-inter
          border outline-none transition-all duration-200 relative z-0
          ${theme.inputBase} ${theme.inputBorderNormal}
        `}
        autoComplete="off"
      />

      {/* Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border overflow-hidden z-20 ${theme.dropdown}`}>
          <div className="max-h-60 overflow-y-auto p-1.5">
            {filteredSuggestions.map((domain, idx) => (
              <div
                key={domain}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`
                  w-full px-3 py-2.5 rounded-lg text-sm font-inter
                  transition-colors duration-150 flex items-center justify-between group
                  ${idx === selectedIndex ? theme.dropdownItemSelected : theme.dropdownItem}
                `}
              >
                <div
                  onClick={() => handleSelect(domain)}
                  className="flex items-center gap-2.5 flex-1 cursor-pointer overflow-hidden"
                >
                  <span className={`text-xs shrink-0 ${theme.inputIcon}`}>🌐</span>
                  <span className="truncate">{domain}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, domain)}
                  className={`opacity-0 group-hover:opacity-100 p-1 -mr-1 transition-opacity ${theme.inputIcon}`}
                  title="Remove from suggestions"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
