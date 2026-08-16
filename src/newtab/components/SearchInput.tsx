import { useState, useEffect, useRef } from 'react';
import { getRecentDestinations } from '../../storage/storage';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

const POPULAR_DOMAINS = [
  'gmail.com',
  'youtube.com',
  'github.com',
  'chatgpt.com',
  'x.com',
  'reddit.com',
  'calendar.google.com',
  'linear.app',
  'notion.so'
];

export default function SearchInput({ value, onChange, onSubmit }: Props) {
  const [recentDestinations, setRecentDestinations] = useState<string[]>([]);
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

  // Merge recent + popular, remove duplicates, filter by input
  const allSuggestions = Array.from(new Set([...recentDestinations, ...POPULAR_DOMAINS]));
  const filteredSuggestions = allSuggestions
    .filter((domain) => domain.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 6); // Keep it compact

  // Reset selected index when typing
  useEffect(() => {
    setSelectedIndex(-1);
  }, [value]);

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
      setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (domain: string) => {
    onChange(domain);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Search icon */}
      <span className="absolute left-3.5 top-3.5 text-slate-600 pointer-events-none z-10">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </span>
      <input
        id="destination-input"
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="google.com, 'kafka tutorial', youtube.com/watch…"
        className="
          w-full pl-9 pr-4 py-3 rounded-xl text-sm font-inter relative z-0
          bg-white/5 border border-white/10 text-slate-200 placeholder-slate-600
          outline-none transition-all duration-200
          hover:border-white/20
          focus:border-violet-500/60 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.35)] focus:bg-white/8
        "
        autoComplete="off"
      />
      
      {/* Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#0f111a]/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden z-20">
          <div className="max-h-60 overflow-y-auto p-1.5">
            {filteredSuggestions.map((domain, idx) => (
              <button
                key={domain}
                type="button"
                onClick={() => handleSelect(domain)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-inter transition-colors duration-150 flex items-center gap-2.5 ${
                  idx === selectedIndex
                    ? 'bg-violet-500/20 text-violet-200'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="text-slate-500 text-xs shrink-0">🌐</span>
                <span className="truncate">{domain}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
