import { useState, useEffect, useCallback } from 'react';
import type { ExcludedDomain } from '../../types';
import { useTheme } from '../ThemeContext';

/**
 * ExcludedDomains — settings panel for managing domains that
 * bypass TabGuru interception (e.g. localhost, staging.company.com).
 * Each domain can optionally store a saved intention label that is
 * used instead of the auto-generated "Browsing {hostname}" fallback.
 */
export default function ExcludedDomains() {
  const { theme } = useTheme();
  const [domains, setDomains] = useState<ExcludedDomain[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [intentionInput, setIntentionInput] = useState('');
  const [showIntentionInput, setShowIntentionInput] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [editIntentionValue, setEditIntentionValue] = useState('');

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'GET_EXCLUDED_DOMAINS' })
      .then((res) => {
        if (res?.success && Array.isArray(res.excludedDomains)) {
          setDomains(res.excludedDomains as ExcludedDomain[]);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // ── Persist changes ────────────────────────────────────────────────────────
  const persist = useCallback(async (updated: ExcludedDomain[]) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'SET_EXCLUDED_DOMAINS',
        payload: { domains: updated } as any,
      });
      setDomains(updated);
    } catch {
      setError('Failed to save. Please try again.');
    }
  }, []);

  // ── Validate & add ─────────────────────────────────────────────────────────
  const handleAdd = useCallback(() => {
    const raw = domainInput.trim().toLowerCase();
    if (!raw) return;
    let normalized = raw;
    try {
      if (/^https?:\/\//.test(raw)) normalized = new URL(raw).hostname;
    } catch { /* keep as-is */ }
    if (!normalized) { setError('Invalid domain.'); return; }
    if (domains.some((d) => d.domain === normalized)) {
      setError(`"${normalized}" is already excluded.`);
      return;
    }
    const intention = intentionInput.trim() || undefined;
    setError('');
    setDomainInput('');
    setIntentionInput('');
    setShowIntentionInput(false);
    persist([...domains, { domain: normalized, intention }]);
  }, [domainInput, intentionInput, domains, persist]);

  const handleRemove = useCallback(
    (domain: string) => persist(domains.filter((d) => d.domain !== domain)),
    [domains, persist]
  );

  // ── Inline intention editing ───────────────────────────────────────────────
  const handleStartEdit = (d: ExcludedDomain) => {
    setEditingDomain(d.domain);
    setEditIntentionValue(d.intention ?? '');
  };

  const handleSaveIntention = useCallback((domain: string) => {
    const trimmed = editIntentionValue.trim();
    const updated = domains.map((d) =>
      d.domain === domain ? { ...d, intention: trimmed || undefined } : d
    );
    setEditingDomain(null);
    persist(updated);
  }, [editIntentionValue, domains, persist]);

  const handleCancelEdit = () => { setEditingDomain(null); setEditIntentionValue(''); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') { setShowIntentionInput(false); setIntentionInput(''); }
  };

  // Shared input classes
  const inputCn = `outline-none transition-all duration-150 border ${theme.inputBase} ${theme.inputBorderNormal}`;

  return (
    <div className="space-y-3">
      {/* Label */}
      <div>
        <p className={`text-[11px] font-bold uppercase tracking-widest ${theme.secLabel}`}>
          Excluded Domains
        </p>
        <p className={`mt-0.5 text-[10px] leading-relaxed ${theme.exSubtext}`}>
          TabGuru won't show the intent modal on these domains — but still tracks them silently.
          Add an optional intention to customise the auto-label.
        </p>
      </div>

      {/* Add form */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={domainInput}
            onChange={(e) => { setDomainInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. localhost, staging.company.com"
            className={`flex-1 min-w-0 text-xs rounded-lg px-3 py-2 ${inputCn}`}
          />
          <button
            type="button"
            onClick={() => setShowIntentionInput((v) => !v)}
            title="Add intention (optional)"
            className={`
              shrink-0 px-2 py-2 rounded-lg text-xs border transition-all duration-150 cursor-pointer
              ${showIntentionInput ? theme.exToggleOn : theme.exToggleOff}
            `}
          >
            💬
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className={`
              shrink-0 px-3 py-2 rounded-lg text-xs font-semibold
              border transition-all duration-150 cursor-pointer
              ${theme.exAddBtn}
            `}
          >
            Add
          </button>
        </div>

        {showIntentionInput && (
          <input
            type="text"
            value={intentionInput}
            onChange={(e) => setIntentionInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            autoFocus
            placeholder="Intention (optional) — e.g. Local dev, Admin panel…"
            className={`w-full text-xs rounded-lg px-3 py-2 ${inputCn}`}
          />
        )}
      </div>

      {error && <p className={`text-[10px] ${theme.error}`}>{error}</p>}

      {/* Domain list */}
      {isLoading ? (
        <p className={`text-[10px] ${theme.dimText}`}>Loading…</p>
      ) : domains.length === 0 ? (
        <p className={`text-[10px] italic ${theme.dimText}`}>No excluded domains yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {domains.map((item) => (
            <div
              key={item.domain}
              className={`rounded-lg border overflow-hidden ${theme.exDomainRow}`}
            >
              {/* Domain row */}
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className={`flex-1 text-[11px] font-mono truncate ${theme.exDomainText}`}>
                  {item.domain}
                </span>

                {/* Edit intention button */}
                <button
                  type="button"
                  onClick={() => editingDomain === item.domain ? handleCancelEdit() : handleStartEdit(item)}
                  title={item.intention ? 'Edit intention' : 'Add intention'}
                  className={`
                    shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium
                    transition-colors cursor-pointer
                    ${editingDomain === item.domain
                      ? theme.exEditActive
                      : item.intention
                        ? theme.exEditWithLabel
                        : theme.exEditNoLabel
                    }
                  `}
                >
                  💬
                  {item.intention && editingDomain !== item.domain && (
                    <span className="max-w-[80px] truncate">{item.intention}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleRemove(item.domain)}
                  title={`Remove ${item.domain}`}
                  className={`
                    shrink-0 w-5 h-5 flex items-center justify-center rounded
                    transition-colors cursor-pointer text-[10px] leading-none
                    ${theme.exRemove}
                  `}
                >
                  ✕
                </button>
              </div>

              {/* Inline intention editor */}
              {editingDomain === item.domain && (
                <div className={`px-3 pb-2 pt-0 border-t ${theme.exInlineDivider}`}>
                  <input
                    type="text"
                    value={editIntentionValue}
                    onChange={(e) => setEditIntentionValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveIntention(item.domain);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    autoFocus
                    placeholder="e.g. Local dev, Staging tests, Admin panel…"
                    className={`w-full text-xs rounded-md px-2.5 py-1.5 mt-2 ${inputCn}`}
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleSaveIntention(item.domain)}
                      className={`
                        px-2.5 py-1 rounded-md text-[10px] font-semibold
                        border transition-colors cursor-pointer
                        ${theme.exSaveBtn}
                      `}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className={`
                        px-2.5 py-1 rounded-md text-[10px] font-semibold
                        border transition-colors cursor-pointer
                        ${theme.exCancelBtn}
                      `}
                    >
                      Cancel
                    </button>
                    {item.intention && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = domains.map((d) =>
                            d.domain === item.domain ? { ...d, intention: undefined } : d
                          );
                          setEditingDomain(null);
                          persist(updated);
                        }}
                        className={`
                          ml-auto px-2 py-1 rounded-md text-[10px]
                          transition-colors cursor-pointer
                          ${theme.exClearBtn}
                        `}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
