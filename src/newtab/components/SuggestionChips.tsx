import type { RecentPurpose } from '../../storage/storage';
import { useTheme } from '../ThemeContext';

interface Props {
  items: RecentPurpose[];
  onSelect: (item: RecentPurpose) => void;
}

export default function SuggestionChips({ items, onSelect }: Props) {
  const { theme } = useTheme();
  return (
    <div>
      <p className={`text-xs font-inter mb-2 uppercase tracking-widest font-semibold ${theme.secLabel}`}>
        Recent
      </p>
      <div className="flex gap-2 flex-wrap">
        {items.map((item) => (
          <button
            key={item.purpose}
            onClick={() => onSelect(item)}
            title={item.url ? `${item.purpose} → ${item.url}` : item.purpose}
            className={`
              flex flex-col items-start max-w-[200px] px-3 py-2 rounded-xl text-left
              border transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-violet-500
              ${theme.sugChip}
            `}
          >
            <span className="text-xs font-inter font-medium truncate w-full">
              {item.purpose}
            </span>
            {item.url && (
              <span className={`text-[9px] font-inter truncate w-full mt-0.5 ${theme.sugUrl}`}>
                {new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`).hostname.replace(/^www\./, '')}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
