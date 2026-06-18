interface Props {
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
}

export default function PurposeInput({ value, onChange, hasError }: Props) {
  return (
    <textarea
      id="purpose-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder='e.g. "Research Spring Boot Security", "Buy flight tickets"…'
      autoFocus
      className={`
        w-full resize-none rounded-xl px-4 py-3 text-sm font-inter
        bg-white/5 border text-slate-100 placeholder-slate-600
        outline-none transition-all duration-200
        focus:bg-white/8 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.5)]
        ${hasError
          ? 'border-red-500/60 shadow-[0_0_0_2px_rgba(239,68,68,0.25)]'
          : 'border-white/10 hover:border-white/20 focus:border-violet-500/60'
        }
      `}
    />
  );
}
