import { useState } from 'react';
import type { Shortcut } from '../../types';
import { useTheme } from '../ThemeContext';

interface Props {
  shortcuts: Shortcut[];
  onSelect: (shortcut: Shortcut) => void;
  onRemove: (shortcutId: string) => void;
}

export default function ShortcutsList({ shortcuts, onSelect, onRemove }: Props) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  if (shortcuts.length === 0) return null;

  const maxVisible = 3;
  const visibleShortcuts = isExpanded ? shortcuts : shortcuts.slice(0, maxVisible);
  const hiddenCount = shortcuts.length - maxVisible;

  return (
    <div className="mb-6">
      <p className={`text-[11px] font-inter mb-2 uppercase tracking-widest font-semibold ${theme.secLabel}`}>
        Shortcuts
      </p>
      <div className="flex gap-2 flex-wrap">
        {visibleShortcuts.map((shortcut) => (
          <div key={shortcut.id} className="group relative flex items-stretch max-w-[220px]">
            <button
              onClick={() => onSelect(shortcut)}
              title={shortcut.destinationUrl ? `${shortcut.purpose} → ${shortcut.destinationUrl}` : shortcut.purpose}
              className={`
                flex-1 flex flex-col items-start px-3 py-2 rounded-l-xl text-left
                border border-r-0 transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-violet-500
                ${theme.scMain}
              `}
            >
              <div className="flex items-center gap-1.5 w-full">
                <span className={`text-[10px] uppercase tracking-wider font-semibold shrink-0 ${theme.scLabel}`}>
                  ⚡ {shortcut.name}
                </span>
              </div>
              {shortcut.destinationUrl && (
                <span className={`text-[9px] font-inter truncate w-full mt-0.5 ${theme.scUrl}`}>
                  {new URL(shortcut.destinationUrl.startsWith('http') ? shortcut.destinationUrl : `https://${shortcut.destinationUrl}`).hostname.replace(/^www\./, '')}
                </span>
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(shortcut.id); }}
              title={`Remove ${shortcut.name}`}
              className={`
                px-2 rounded-r-xl border border-l-0
                transition-colors focus:outline-none
                ${theme.scRemove}
              `}
            >
              <span className="text-[10px]">✕</span>
            </button>
          </div>
        ))}

        {!isExpanded && hiddenCount > 0 && (
          <button
            onClick={() => setIsExpanded(true)}
            className={`
              flex items-center px-3 py-2 rounded-xl text-xs font-semibold border
              transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500
              ${theme.scMore}
            `}
          >
            More...
          </button>
        )}
      </div>
    </div>
  );
}
