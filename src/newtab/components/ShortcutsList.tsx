import type { Shortcut } from '../../types';

interface Props {
  shortcuts: Shortcut[];
  onSelect: (shortcut: Shortcut) => void;
  onRemove: (shortcutId: string) => void;
}

export default function ShortcutsList({ shortcuts, onSelect, onRemove }: Props) {
  if (shortcuts.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-[11px] text-slate-500 font-inter mb-2 uppercase tracking-widest font-semibold">
        Shortcuts
      </p>
      <div className="flex gap-2 flex-wrap">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.id}
            className="group relative flex items-stretch max-w-[220px]"
          >
            <button
              onClick={() => onSelect(shortcut)}
              title={shortcut.destinationUrl ? `${shortcut.purpose} → ${shortcut.destinationUrl}` : shortcut.purpose}
              className="
                flex-1 flex flex-col items-start px-3 py-2 rounded-l-xl text-left
                bg-gradient-to-r from-violet-500/10 to-purple-500/10 
                border border-r-0 border-violet-500/20 text-slate-300
                hover:from-violet-500/20 hover:to-purple-500/20 hover:text-slate-100 hover:border-violet-500/30
                transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500
              "
            >
              <div className="flex items-center gap-1.5 w-full">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-violet-400 shrink-0">
                  ⚡ {shortcut.name}
                </span>
              </div>
              {/* <span className="text-xs font-inter font-medium truncate w-full mt-1">
                {shortcut.purpose}
              </span> */}
              {shortcut.destinationUrl && (
                <span className="text-[9px] font-inter text-slate-500 truncate w-full mt-0.5">
                  {new URL(shortcut.destinationUrl.startsWith('http') ? shortcut.destinationUrl : `https://${shortcut.destinationUrl}`).hostname.replace(/^www\./, '')}
                </span>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(shortcut.id);
              }}
              title={`Remove ${shortcut.name}`}
              className="
                px-2 rounded-r-xl border border-l-0 border-violet-500/20
                bg-purple-500/10 text-slate-500
                hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30
                transition-colors focus:outline-none
              "
            >
              <span className="text-[10px]">✕</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
