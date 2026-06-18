interface Props {
  items: string[];
  onSelect: (v: string) => void;
}

export default function SuggestionChips({ items, onSelect }: Props) {
  return (
    <div>
      <p className="text-xs text-slate-500 font-inter mb-2 uppercase tracking-widest">
        Recent
      </p>
      <div className="flex gap-2 flex-wrap">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            title={item}
            className="
              max-w-[180px] truncate px-3 py-1.5 rounded-lg text-xs font-inter font-medium
              bg-white/5 border border-white/10 text-slate-400
              hover:bg-violet-500/15 hover:border-violet-500/40 hover:text-slate-200
              transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500
            "
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
