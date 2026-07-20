import { useState, useEffect, useCallback, useRef } from 'react';
import type { HistoricalPurpose } from '../types';

// ─── Types mirroring indexedDb.ts ────────────────────────────────────────────

interface DailyStats {
  date: string;
  totalPurposes: number;
  completedPurposes: number;
  abandonedPurposes: number;
  completionRate: number;
  totalFocusMs: number;
  driftCount: number;
  driftGoBackCount: number;
  topCategory: string;
  starRating?: number;
}

interface WeeklyDay {
  date: string;
  label: string;
  focusMs: number;
  driftCount: number;
  completionRate: number;
}

interface DriftHotspot {
  domain: string;
  count: number;
}

type HistoryEntry = HistoricalPurpose & { id: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr() {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtMs(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  'Programming / Dev':    { bg: 'rgba(99,102,241,0.2)',  text: '#818cf8' },
  'Learning / Research':  { bg: 'rgba(6,182,212,0.2)',   text: '#22d3ee' },
  'Leisure / Entertainment': { bg: 'rgba(244,63,94,0.2)', text: '#fb7185' },
  'Admin / Shopping':     { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  'Communication':        { bg: 'rgba(16,185,129,0.2)',  text: '#34d399' },
  'Other':                { bg: 'rgba(100,116,139,0.2)', text: '#94a3b8' },
};

function catBadge(category: string) {
  const c = CAT_COLORS[category] ?? CAT_COLORS['Other'];
  return (
    <span className="cat-badge" style={{ background: c.bg, color: c.text }}>
      {category}
    </span>
  );
}

async function send(type: string, payload?: any) {
  return chrome.runtime.sendMessage({ type, payload } as any);
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function Confetti() {
  const COLORS = ['#7c3aed', '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a78bfa'];
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${6 + Math.random() * 8}px`,
    rotate: `${Math.random() * 360}deg`,
  }));

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998 }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: p.left,
            top: '-20px',
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotate})`,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

// ─── Weekly SVG Bar Chart ─────────────────────────────────────────────────────

function WeeklyChart({ days }: { days: WeeklyDay[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const maxFocus = Math.max(...days.map((d) => d.focusMs), 1);
  const maxDrift = Math.max(...days.map((d) => d.driftCount), 1);

  const W = 520, H = 160, PAD_LEFT = 0, BAR_GAP = 8;
  const barWidth = Math.floor((W - PAD_LEFT - BAR_GAP * (days.length - 1)) / (days.length * 2 + days.length));
  const groupWidth = (W - PAD_LEFT) / days.length;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H + 28}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <line
            key={i}
            x1={0} y1={H - H * frac}
            x2={W} y2={H - H * frac}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}

        {days.map((day, i) => {
          const gx = PAD_LEFT + i * groupWidth;
          const cx = gx + groupWidth / 2;
          const focusH = Math.max(4, (day.focusMs / maxFocus) * (H - 12));
          const driftH = Math.max(day.driftCount > 0 ? 4 : 0, (day.driftCount / maxDrift) * (H - 12));
          const b1x = cx - barWidth - 2;
          const b2x = cx + 2;
          const isToday = day.date === todayStr();

          return (
            <g key={day.date}>
              {/* Focus bar */}
              <rect
                className="chart-bar"
                x={b1x}
                y={H - focusH}
                width={barWidth}
                height={focusH}
                rx={4}
                fill="url(#focusGrad)"
                onMouseEnter={(e) =>
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    content: `${day.label}: ${fmtMs(day.focusMs)} focus`,
                  })
                }
              />
              {/* Drift bar */}
              {day.driftCount > 0 && (
                <rect
                  className="chart-bar"
                  x={b2x}
                  y={H - driftH}
                  width={barWidth}
                  height={driftH}
                  rx={4}
                  fill="url(#driftGrad)"
                  onMouseEnter={(e) =>
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      content: `${day.label}: ${day.driftCount} drift${day.driftCount !== 1 ? 's' : ''}`,
                    })
                  }
                />
              )}
              {/* Label */}
              <text
                x={cx}
                y={H + 18}
                textAnchor="middle"
                fontSize="11"
                fontFamily="Inter, sans-serif"
                fill={isToday ? '#a78bfa' : '#475569'}
                fontWeight={isToday ? '700' : '400'}
              >
                {day.label}
              </text>
              {isToday && (
                <circle cx={cx} cy={H + 26} r={2} fill="#a78bfa" />
              )}
            </g>
          );
        })}

        <defs>
          <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="driftGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#7c3aed' }} />
          <span style={{ fontSize: 11, color: '#64748b' }}>Focus time</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f43f5e' }} />
          <span style={{ fontSize: 11, color: '#64748b' }}>Drift events</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y - 32,
            background: '#0d111e',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            color: '#e2e8f0',
            pointerEvents: 'none',
            zIndex: 100,
            whiteSpace: 'nowrap',
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

// ─── Completion Donut ─────────────────────────────────────────────────────────

function CompletionDonut({ rate }: { rate: number }) {
  const R = 54, CX = 70, CY = 70, strokeW = 10;
  const circ = 2 * Math.PI * R;
  const dash = rate >= 100 ? circ : (rate / 100) * circ;

  const color = rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <svg viewBox="0 0 140 140" style={{ width: 140, height: 140 }}>
      <g transform={`rotate(-90 ${CX} ${CY})`}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap={rate >= 100 ? "butt" : "round"}
          style={{
            filter: `drop-shadow(0 0 8px ${color}80)`,
            transition: 'stroke-dasharray 1s ease',
          }}
        />
      </g>
      <text x={CX} y={CY - 6} textAnchor="middle" fontSize="22" fontWeight="800" fontFamily="Outfit, sans-serif" fill={color}>
        {rate}%
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" fontSize="10" fontFamily="Inter, sans-serif" fill="#64748b">
        complete
      </text>
    </svg>
  );
}

// ─── Daily Reflection Modal ───────────────────────────────────────────────────

function DailyReflectionModal({
  stats,
  date,
  onClose,
}: {
  stats: DailyStats;
  date: string;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(stats.starRating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [saved, setSaved] = useState(false);
  const showConfetti = stats.completionRate > 80;

  const handleSave = async () => {
    await chrome.storage.local.set({ [`reflection_rating_${date}`]: rating });
    setSaved(true);
    setTimeout(onClose, 800);
  };

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-card" style={{ textAlign: 'center' }}>
          {/* Header */}
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 36 }}>{showConfetti ? '🎉' : '🧙'}</span>
          </div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>
            Daily Reflection
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 28 }}>
            {fmtDate(date)}
          </p>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
            <StatTile
              label="Purposes Completed"
              value={`${stats.completedPurposes} / ${stats.totalPurposes}`}
              sub={`${stats.completionRate}%`}
              color="#7c3aed"
            />
            <StatTile
              label="Drift Events"
              value={String(stats.driftCount)}
              sub={stats.driftCount === 0 ? 'Clean session!' : `${stats.driftGoBackCount} went back`}
              color={stats.driftCount === 0 ? '#10b981' : '#f43f5e'}
            />
            <StatTile
              label="Deep Focus Time"
              value={fmtMs(stats.totalFocusMs)}
              sub="total active time"
              color="#06b6d4"
            />
            <StatTile
              label="Top Goal Category"
              value={stats.topCategory.split(' / ')[0]}
              sub="most common"
              color="#f59e0b"
            />
          </div>

          {/* Star rating */}
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
            How focused did you feel today?
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 28 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={`star-btn ${star <= rating ? 'active' : ''}`}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star)}
                style={{ opacity: star <= (hovered || rating) ? 1 : 0.3 }}
              >
                ⭐
              </button>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saved}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 14,
              border: 'none',
              background: saved
                ? 'rgba(16,185,129,0.3)'
                : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: saved ? '#34d399' : 'white',
              fontFamily: 'Outfit, sans-serif',
              fontSize: 15,
              fontWeight: 700,
              cursor: saved ? 'default' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: saved ? 'none' : '0 4px 24px rgba(124,58,237,0.4)',
            }}
          >
            {saved ? '✓ Saved!' : 'Done'}
          </button>
        </div>
      </div>
    </>
  );
}

function StatTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '14px 12px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{sub}</p>
    </div>
  );
}

// ─── History Table ────────────────────────────────────────────────────────────

function HistoryLog({ history }: { history: HistoryEntry[] }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'abandoned'>('all');
  const [filterCat, setFilterCat] = useState('all');

  const categories = ['all', ...Array.from(new Set(history.map((h) => h.category)))];

  const filtered = history.filter((h) => {
    const matchSearch = h.purpose.toLowerCase().includes(search.toLowerCase()) ||
      (h.domain ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || h.status === filterStatus;
    const matchCat = filterCat === 'all' || h.category === filterCat;
    return matchSearch && matchStatus && matchCat;
  });

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search purposes or domains…"
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            color: '#e2e8f0',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          style={{
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            color: '#94a3b8',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="abandoned">Abandoned</option>
        </select>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            color: '#94a3b8',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>🗂️</p>
          <p style={{ fontSize: 13 }}>No history yet — complete some sessions to see them here.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Date</th>
                <th>Category</th>
                <th>Focus Time</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id}>
                  <td className="purpose-cell">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{h.purpose}</span>
                      {h.domain && (
                        <span style={{ fontSize: 10, color: '#475569' }}>
                          {h.domain}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(h.date)}</td>
                  <td>{catBadge(h.category)}</td>
                  <td style={{ fontFamily: 'Outfit, sans-serif', color: '#a78bfa' }}>
                    {fmtMs(h.timeSpentMs)}
                  </td>
                  <td>{h.durationMinutesAllocated}m</td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: h.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                      color: h.status === 'completed' ? '#34d399' : '#fb7185',
                    }}>
                      {h.status === 'completed' ? '✓ Done' : '× Abandoned'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Drift Hotspots ───────────────────────────────────────────────────────────

function DriftHotspots({ hotspots }: { hotspots: DriftHotspot[] }) {
  const max = Math.max(...hotspots.map((h) => h.count), 1);

  if (hotspots.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>
        <p style={{ fontSize: 28, marginBottom: 8 }}>🎯</p>
        <p style={{ fontSize: 13 }}>No drift events recorded yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {hotspots.map(({ domain, count }, i) => (
        <div key={domain} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#475569', width: 16, textAlign: 'right' }}>
            {i + 1}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{domain}</span>
              <span style={{ fontSize: 12, color: '#f43f5e', fontWeight: 700 }}>{count}×</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(count / max) * 100}%`,
                  background: `linear-gradient(90deg, #f43f5e, #7c3aed)`,
                  borderRadius: 2,
                  transition: 'width 0.8s ease',
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Mini Stat Cards (top row) ────────────────────────────────────────────────

function MiniCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="glass-card card-enter" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <p className="stat-number" style={{ fontSize: 30, color }}>
        {value}
      </p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [weeklyDays, setWeeklyDays] = useState<WeeklyDay[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hotspots, setHotspots] = useState<DriftHotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionDate, setReflectionDate] = useState(todayStr());
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const hasCheckedReflection = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, weekRes, histRes, hotRes] = await Promise.all([
        send('GET_DAILY_STATS', { date: todayStr() }),
        send('GET_WEEKLY_STATS'),
        send('GET_HISTORY', { limit: 200 }),
        send('GET_DRIFT_HOTSPOTS'),
      ]);

      if (statsRes?.success) setTodayStats(statsRes.data as DailyStats);
      if (weekRes?.success) setWeeklyDays(weekRes.data as WeeklyDay[]);
      if (histRes?.success) setHistory(histRes.data as HistoryEntry[]);
      if (hotRes?.success) setHotspots(hotRes.data as DriftHotspot[]);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if yesterday's reflection needs to be shown
  useEffect(() => {
    if (hasCheckedReflection.current || loading) return;
    hasCheckedReflection.current = true;

    const yesterday = yesterdayStr();
    chrome.storage.local.get([`reflection_shown_${yesterday}`, `reflection_rating_${yesterday}`])
      .then((result) => {
        const shown = result[`reflection_shown_${yesterday}`];
        const rated = result[`reflection_rating_${yesterday}`];
        if (!shown && !rated) {
          // Mark as shown so we don't prompt again this browser session
          chrome.storage.local.set({ [`reflection_shown_${yesterday}`]: true });
          setReflectionDate(yesterday);
          // Only show reflection if there's actually data for yesterday
          send('GET_DAILY_STATS', { date: yesterday }).then((res) => {
            if (res?.success && (res.data as DailyStats).totalPurposes > 0) {
              setShowReflection(true);
            }
          });
        }
      })
      .catch(() => {});
  }, [loading]);

  const today = todayStr();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Background orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-120px', left: '-120px', width: 500, height: 500,
          borderRadius: '50%', background: 'rgba(124,58,237,0.08)', filter: 'blur(120px)',
          animation: 'orb-float 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-100px', right: '-100px', width: 400, height: 400,
          borderRadius: '50%', background: 'rgba(6,182,212,0.06)', filter: 'blur(100px)',
          animation: 'orb-float 10s ease-in-out infinite reverse',
        }} />
      </div>

      {/* Daily Reflection Modal */}
      {showReflection && todayStats && (
        <DailyReflectionModal
          stats={todayStats}
          date={reflectionDate}
          onClose={() => setShowReflection(false)}
        />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src={chrome.runtime.getURL('icons/icon128.png')}
              alt="TabGuru"
              style={{ width: 44, height: 44, borderRadius: 12, boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}
            />
            <div>
              <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 28, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>
                Tab<span style={{ background: 'linear-gradient(135deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Guru</span>
              </h1>
              <p style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Productivity Dashboard</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => { setReflectionDate(today); setShowReflection(true); }}
              style={{
                padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(124,58,237,0.3)',
                background: 'rgba(124,58,237,0.1)', color: '#a78bfa', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              🧙 Today's Reflection
            </button>
            <button
              onClick={loadData}
              style={{
                padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)', color: '#64748b', fontSize: 13,
                cursor: 'pointer',
              }}
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 16 }}>
            <div style={{
              width: 40, height: 40, border: '3px solid rgba(124,58,237,0.2)',
              borderTop: '3px solid #7c3aed', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#475569', fontSize: 13 }}>Loading your analytics…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
              {(['overview', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: activeTab === tab ? 'rgba(124,58,237,0.3)' : 'transparent',
                    color: activeTab === tab ? '#a78bfa' : '#64748b',
                    fontSize: 13,
                    fontWeight: activeTab === tab ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'Inter, sans-serif',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab === 'overview' ? '📊 Overview' : '🗂️ History'}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <>
                {/* Top stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                  <MiniCard
                    icon="✅"
                    label="Completed Today"
                    value={todayStats ? `${todayStats.completedPurposes} / ${todayStats.totalPurposes}` : '—'}
                    color="#a78bfa"
                  />
                  <MiniCard
                    icon="⏱️"
                    label="Focus Time Today"
                    value={todayStats ? fmtMs(todayStats.totalFocusMs) : '—'}
                    color="#22d3ee"
                  />
                  <MiniCard
                    icon="🌊"
                    label="Drift Events Today"
                    value={todayStats ? String(todayStats.driftCount) : '—'}
                    color={todayStats?.driftCount === 0 ? '#34d399' : '#fb7185'}
                  />
                  <MiniCard
                    icon="🏷️"
                    label="Top Category"
                    value={todayStats?.topCategory.split(' / ')[0] ?? '—'}
                    color="#fbbf24"
                  />
                </div>

                {/* Main grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 16, marginBottom: 16 }}>

                  {/* Card 1: Weekly Chart */}
                  <div className="glass-card card-enter" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <div>
                        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 700, color: '#e2e8f0' }}>
                          Weekly Progress
                        </h2>
                        <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Last 7 days</p>
                      </div>
                    </div>
                    {weeklyDays.length > 0 ? (
                      <WeeklyChart days={weeklyDays} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: 13 }}>
                        No data yet — complete a few sessions!
                      </div>
                    )}
                  </div>

                  {/* Card 2: Completion Rate */}
                  <div className="glass-card card-enter" style={{ padding: 24 }}>
                    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
                      Goal Completion Rate
                    </h2>
                    <p style={{ fontSize: 11, color: '#475569', marginBottom: 20 }}>Today's session</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <CompletionDonut rate={todayStats?.completionRate ?? 0} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                        <RateStat label="Completed" value={todayStats?.completedPurposes ?? 0} color="#10b981" />
                        <RateStat label="Abandoned" value={todayStats?.abandonedPurposes ?? 0} color="#f43f5e" />
                        <RateStat label="Total sessions" value={todayStats?.totalPurposes ?? 0} color="#64748b" />
                      </div>
                    </div>
                    {(todayStats?.completionRate ?? 0) >= 80 && (
                      <div style={{
                        marginTop: 16, padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span>🎉</span>
                        <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                          Outstanding! Keep it up!
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Drift Hotspots */}
                  <div className="glass-card card-enter" style={{ padding: 24 }}>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 700, color: '#e2e8f0' }}>
                        Drift Hotspots
                      </h2>
                      <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Domains that trigger the most alerts (last 7 days)</p>
                    </div>
                    <DriftHotspots hotspots={hotspots} />
                  </div>

                  {/* Card 4: Recent History (preview) */}
                  <div className="glass-card card-enter" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <div>
                        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 700, color: '#e2e8f0' }}>
                          Recent Sessions
                        </h2>
                        <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Latest completed purposes</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('history')}
                        style={{
                          fontSize: 11, color: '#7c3aed', background: 'none', border: 'none',
                          cursor: 'pointer', fontWeight: 600, padding: 0,
                        }}
                      >
                        View all →
                      </button>
                    </div>
                    {history.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569', fontSize: 13 }}>
                        No sessions recorded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {history.slice(0, 5).map((h) => (
                          <div key={h.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}>
                            <span style={{ fontSize: 14 }}>
                              {h.status === 'completed' ? '✅' : '❌'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {h.purpose}
                              </p>
                              <p style={{ fontSize: 10, color: '#475569' }}>
                                {fmtMs(h.timeSpentMs)} · {fmtDate(h.date)}
                              </p>
                            </div>
                            {catBadge(h.category)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'history' && (
              <div className="glass-card card-enter" style={{ padding: 28 }}>
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>
                    Session History
                  </h2>
                  <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                    {history.length} sessions recorded
                  </p>
                </div>
                <HistoryLog history={history} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RateStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 16, fontFamily: 'Outfit, sans-serif', fontWeight: 700, color }}>
        {value}
      </span>
    </div>
  );
}
