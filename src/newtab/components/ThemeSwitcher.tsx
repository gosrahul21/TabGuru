import { useTheme } from '../ThemeContext';
import type { ThemeMode } from '../themes';

const MODES: { id: ThemeMode; icon: string; label: string }[] = [
  { id: 'default', icon: '◐', label: 'Auto (follows system)' },
  { id: 'white',   icon: '☀',  label: 'Light glass' },
  { id: 'dark',    icon: '🌙', label: 'Dark glass' },
];

export default function ThemeSwitcher() {
  const { mode, theme, setMode } = useTheme();
  return (
    <div className={`flex items-center gap-0.5 p-1 rounded-full border ${theme.switcherPill}`}>
      {MODES.map(({ id, icon, label }) => (
        <button
          key={id}
          onClick={() => setMode(id)}
          title={label}
          className={`
            w-7 h-6 rounded-full text-sm flex items-center justify-center
            transition-all duration-200 cursor-pointer select-none
            ${mode === id ? theme.switcherActive : theme.switcherInactive}
          `}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
