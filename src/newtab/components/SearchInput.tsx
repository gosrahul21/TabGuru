interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

export default function SearchInput({ value, onChange, onSubmit }: Props) {
  return (
    <div className="relative">
      {/* Search icon */}
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </span>
      <input
        id="destination-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        placeholder="google.com, 'kafka tutorial', youtube.com/watch…"
        className="
          w-full pl-9 pr-4 py-3 rounded-xl text-sm font-inter
          bg-white/5 border border-white/10 text-slate-200 placeholder-slate-600
          outline-none transition-all duration-200
          hover:border-white/20
          focus:border-violet-500/60 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.35)] focus:bg-white/8
        "
      />
    </div>
  );
}
