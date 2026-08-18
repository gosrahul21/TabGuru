import { useTheme } from '../ThemeContext';

const DURATIONS = [5, 15, 30, 60] as const;
const LABELS: Record<number, string> = { 5: '5 min', 15: '15 min', 30: '30 min', 60: '1 hr' };

interface Props {
  selected: number;
  onChange: (v: number) => void;
}

export default function DurationChips({ selected, onChange }: Props) {
  const { theme } = useTheme();
  return (
    <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Duration">
      {DURATIONS.map((d) => {
        const active = d === selected;
        return (
          <button
            key={d}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(d)}
            className={`
              px-4 py-2 rounded-full text-xs font-semibold font-inter border
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-transparent
              ${active ? theme.chipActive : theme.chipInactive}
            `}
          >
            {LABELS[d]}
          </button>
        );
      })}
    </div>
  );
}
