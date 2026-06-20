import type { RecentPurpose } from '../../storage/storage';

interface Props {
  items: RecentPurpose[];
  onSelect: (item: RecentPurpose) => void;
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
            key={item.purpose}
            onClick={() => onSelect(item)}
            title={item.url ? `${item.purpose} → ${item.url}` : item.purpose}
            className="
              flex flex-col items-start max-w-[200px] px-3 py-2 rounded-xl text-left
              bg-white/5 border border-white/10 text-slate-400
              hover:bg-violet-500/15 hover:border-violet-500/40 hover:text-slate-200
              transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500
            "
          >
            <span className="text-xs font-inter font-medium truncate w-full">
              {item.purpose}
            </span>
            {item.url && (
              <span className="text-[9px] font-inter text-slate-500 truncate w-full mt-0.5">
                {new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`).hostname.replace(/^www\./, '')}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
