import { useState, useEffect, useCallback } from 'react';
import type { TabPurpose } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function computeRemainingMs(p: TabPurpose): number {
  const totalMs = p.durationMinutes * 60_000;
  const liveMs = p.lastActivatedAt !== null ? Date.now() - p.lastActivatedAt : 0;
  return Math.max(0, totalMs - p.accumulatedMs - liveMs);
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return 'Time\'s up';
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (m > 59) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface DailyStats {
  totalPurposes: number;
  completedPurposes: number;
  completionRate: number;
  totalFocusMs: number;
  driftCount: number;
}

interface ActiveTab {
  purpose: TabPurpose;
  tabTitle?: string;
  favicon?: string;
}

// ─── Timer Display (live countdown per active tab) ─────────────────────────────

function LiveTimer({ purpose }: { purpose: TabPurpose }) {
  const [ms, setMs] = useState(() => computeRemainingMs(purpose));

  useEffect(() => {
    if (purpose.lastActivatedAt === null) {
      setMs(computeRemainingMs(purpose));
      return;
    }
    const id = setInterval(() => setMs(computeRemainingMs(purpose)), 1000);
    return () => clearInterval(id);
  }, [purpose.lastActivatedAt, purpose.accumulatedMs, purpose.durationMinutes]);

  const isExpired = ms === 0;
  const isUrgent = ms > 0 && ms < 2 * 60_000;
  const isPaused = purpose.lastActivatedAt === null;

  return (
    <span className={`timer-chip ${isExpired || isUrgent ? 'urgent' : ''} ${isPaused && !isExpired ? 'paused' : ''}`}>
      {isPaused && !isExpired ? '⏸ ' : ''}{fmtRemaining(ms)}
    </span>
  );
}

// ─── Active Tab Row ───────────────────────────────────────────────────────────

function TabRow({
  entry,
  onActivate,
  onComplete,
}: {
  entry: ActiveTab;
  onActivate: () => void;
  onComplete: (e: React.MouseEvent) => void;
}) {
  const { purpose, favicon } = entry;
  const isPaused = purpose.lastActivatedAt === null;
  const remainingMs = computeRemainingMs(purpose);
  const isExpired = remainingMs === 0;

  return (
    <div
      className={`tab-row ${isPaused ? 'paused' : ''}`}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onActivate()}
    >
      {/* Favicon or dot */}
      {favicon ? (
        <img
          src={favicon}
          alt=""
          style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <span
          className={`live-dot ${isPaused ? 'paused' : ''} ${isExpired ? 'expired' : ''}`}
        />
      )}

      {/* Purpose + domain */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#e2e8f0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>
          {purpose.purpose}
        </p>
        {purpose.destinationUrl && (
          <p style={{
            fontSize: 10,
            color: '#475569',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 1,
          }}>
            {(() => {
              try { return new URL(purpose.destinationUrl).hostname.replace(/^www\./, ''); }
              catch { return purpose.destinationUrl; }
            })()}
          </p>
        )}
      </div>

      {/* Timer */}
      <LiveTimer purpose={purpose} />

      {/* Done button */}
      <button
        className="complete-btn"
        onClick={onComplete}
        title="Mark as done"
      >
        Done
      </button>
    </div>
  );
}

// ─── Main Popup ───────────────────────────────────────────────────────────────

export default function Popup() {
  const [activeTabs, setActiveTabs] = useState<ActiveTab[]>([]);
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // ── Load all active purposes from storage ──
      const result = await chrome.storage.local.get('active_purposes');
      const all = (result['active_purposes'] ?? {}) as Record<string, TabPurpose>;

      // Cross-check with real tabs
      const tabs = await chrome.tabs.query({});
      const tabMap = new Map(tabs.map((t) => [t.id, t]));

      const entries: ActiveTab[] = [];
      for (const [, purpose] of Object.entries(all)) {
        if (purpose.status !== 'active') continue;
        const tab = tabMap.get(purpose.tabId);
        if (!tab) continue; // stale entry
        entries.push({
          purpose,
          tabTitle: tab.title ?? undefined,
          favicon: tab.favIconUrl ?? undefined,
        });
      }

      // Sort: active (non-paused) first, then by start time desc
      entries.sort((a, b) => {
        const aActive = a.purpose.lastActivatedAt !== null ? 1 : 0;
        const bActive = b.purpose.lastActivatedAt !== null ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return b.purpose.startTime - a.purpose.startTime;
      });

      setActiveTabs(entries);

      // ── Load today's stats from IndexedDB (via service worker) ──
      try {
        const statsRes = await chrome.runtime.sendMessage({
          type: 'GET_DAILY_STATS',
          payload: { date: todayStr() },
        });
        if (statsRes?.success && statsRes.data) {
          setTodayStats(statsRes.data as DailyStats);
        }
      } catch { /* IndexedDB may not have data yet */ }
    } catch (err) {
      console.error('Popup load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Refresh every 30s so stats stay reasonably fresh
    const id = setInterval(loadData, 30_000);
    return () => clearInterval(id);
  }, [loadData]);

  const handleActivateTab = async (tabId: number) => {
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
    window.close();
  };

  const handleComplete = async (e: React.MouseEvent, tabId: number) => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ type: 'MARK_COMPLETE', tabId });
    // Refresh after short delay to let the tab close
    setTimeout(loadData, 400);
  };

  const handleOpenDashboard = () => {
    const url = chrome.runtime.getURL('src/dashboard/index.html');
    chrome.tabs.create({ url });
    window.close();
  };

  const handleNewTab = () => {
    chrome.tabs.create({});
    window.close();
  };

  const activeCount = activeTabs.filter((t) => t.purpose.lastActivatedAt !== null).length;

  return (
    <div style={{ width: 360, minHeight: 400, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(79,70,229,0.3))',
            border: '1px solid rgba(124,58,237,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(124,58,237,0.2)',
          }}>
            <img
              src={chrome.runtime.getURL('icons/icon128.png')}
              alt="TabGuru"
              style={{ width: 22, height: 22, objectFit: 'contain' }}
            />
          </div>
          <div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>
              Tab<span style={{ background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Guru</span>
            </h1>
            <p style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>Browse with intention</p>
          </div>
        </div>

        <button
          onClick={handleOpenDashboard}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 11px', borderRadius: 8,
            background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
            color: '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
        >
          📊 Stats
        </button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexDirection: 'column' }}>
          <div style={{
            width: 24, height: 24,
            border: '2px solid rgba(124,58,237,0.2)',
            borderTop: '2px solid #7c3aed',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
          <p style={{ fontSize: 11, color: '#334155' }}>Loading…</p>
        </div>
      ) : (
        <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* ── Today's Stats ── */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="section-label" style={{ marginBottom: 8 }}>Today</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="stat-pill">
                <span className="value" style={{ color: '#a78bfa' }}>
                  {todayStats ? `${todayStats.completedPurposes}/${todayStats.totalPurposes}` : '—'}
                </span>
                <span className="label">Goals</span>
              </div>
              <div className="stat-pill">
                <span className="value" style={{ color: '#22d3ee' }}>
                  {todayStats ? fmtMs(todayStats.totalFocusMs) : '—'}
                </span>
                <span className="label">Focus</span>
              </div>
              <div className="stat-pill">
                <span className="value" style={{ color: todayStats?.driftCount === 0 ? '#34d399' : '#fb7185' }}>
                  {todayStats ? todayStats.driftCount : '—'}
                </span>
                <span className="label">Drifts</span>
              </div>
              <div className="stat-pill">
                <span className="value" style={{ color: '#fbbf24' }}>
                  {todayStats ? `${todayStats.completionRate}%` : '—'}
                </span>
                <span className="label">Rate</span>
              </div>
            </div>
          </div>

          {/* ── Active Tabs ── */}
          <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p className="section-label">
                Active Sessions
              </p>
              {activeTabs.length > 0 && (
                <span style={{ fontSize: 10, color: '#475569' }}>
                  {activeCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                      {activeCount} running
                    </span>
                  )}
                  {activeTabs.length - activeCount > 0 && activeCount > 0 && ' · '}
                  {activeTabs.length - activeCount > 0 && `${activeTabs.length - activeCount} paused`}
                </span>
              )}
            </div>

            {activeTabs.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '24px 0', color: '#334155',
              }}>
                <span style={{ fontSize: 28 }}>🌿</span>
                <p style={{ fontSize: 12, color: '#475569', textAlign: 'center' }}>
                  No active sessions.<br/>Open a new tab to start one.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                {activeTabs.map((entry) => (
                  <TabRow
                    key={entry.purpose.tabId}
                    entry={entry}
                    onActivate={() => handleActivateTab(entry.purpose.tabId)}
                    onComplete={(e) => handleComplete(e, entry.purpose.tabId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Quick Actions ── */}
          <div style={{
            padding: '12px 14px 16px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <button className="action-btn primary" onClick={handleNewTab}>
              <span style={{ fontSize: 14 }}>+</span>
              New Tab with Purpose
            </button>
            <button className="action-btn secondary" onClick={handleOpenDashboard}>
              <span>📊</span>
              Open Full Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
