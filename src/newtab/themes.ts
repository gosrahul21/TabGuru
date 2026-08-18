import type { CSSProperties } from 'react';

export type ThemeMode = 'default' | 'white' | 'dark';

export interface ThemeTokens {
  /** Inline style for page root background */
  pageBg: CSSProperties;
  /** 4 orb Tailwind color+blur class strings */
  orb: [string, string, string, string];
  /** Glass card className */
  card: string;
  /** Glass card inline shadow */
  cardShadow: CSSProperties;

  // ── Text Hierarchy ──────────────────────────────────────────────
  logoTab: string;       // "Tab" span in heading
  tagline: string;       // subtitle
  label: string;         // field labels
  labelOpt: string;      // "(optional)" text
  secLabel: string;      // uppercase section labels
  hint: string;          // small helper text
  hintSpan: string;      // mono span inside hints
  dimText: string;       // very muted (empty states, footer)
  error: string;         // error messages

  // ── Shared Inputs ───────────────────────────────────────────────
  inputBase: string;          // bg + text + placeholder + focus glow
  inputBorderNormal: string;  // normal + hover + focus border
  inputBorderError: string;   // error border + shadow
  inputIcon: string;          // search icon color

  // ── Dropdown ────────────────────────────────────────────────────
  dropdown: string;
  dropdownItem: string;
  dropdownItemSelected: string;

  // ── Duration Chips ───────────────────────────────────────────────
  chipActive: string;
  chipInactive: string;

  // ── Suggestion Chips ────────────────────────────────────────────
  sugChip: string;
  sugUrl: string;

  // ── Shortcut Chips ───────────────────────────────────────────────
  scMain: string;
  scRemove: string;
  scMore: string;
  scLabel: string;
  scUrl: string;

  // ── Matching Shortcuts ───────────────────────────────────────────
  matchChip: string;
  matchUrl: string;

  // ── Redirect / Parent Badges ─────────────────────────────────────
  indigoBadge: string;
  indigoLabel: string;
  indigoText: string;
  violetBadge: string;
  violetLabel: string;
  violetText: string;
  closeBtn: string;

  // ── Parent Link Toggle ───────────────────────────────────────────
  parentActive: string;
  parentInactive: string;
  parentActiveLabel: string;
  parentInactiveLabel: string;
  parentActiveText: string;
  parentInactiveText: string;

  // ── Action Buttons ───────────────────────────────────────────────
  continueBtn: string;
  saveBtn: string;
  statsBtn: string;
  settingsBtn: string;
  divider: string;

  // ── ExcludedDomains ──────────────────────────────────────────────
  exSubtext: string;
  exAddBtn: string;
  exToggleOn: string;
  exToggleOff: string;
  exDomainRow: string;
  exDomainText: string;
  exEditActive: string;
  exEditWithLabel: string;
  exEditNoLabel: string;
  exRemove: string;
  exInlineDivider: string;
  exSaveBtn: string;
  exCancelBtn: string;
  exClearBtn: string;

  // ── Theme Switcher ───────────────────────────────────────────────
  switcherPill: string;
  switcherActive: string;
  switcherInactive: string;
}

// ─── WHITE (glassmorphic light) ──────────────────────────────────────────────
export const WHITE: ThemeTokens = {
  pageBg: { background: 'linear-gradient(135deg, #e8e4f8 0%, #f0eeff 30%, #e4ecff 60%, #ede8ff 100%)' },
  orb: [
    'bg-violet-300/40 blur-[128px]',
    'bg-indigo-300/30 blur-[140px]',
    'bg-purple-200/35 blur-[120px]',
    'bg-blue-200/20 blur-[100px]',
  ],
  card: 'rounded-2xl border border-white/60 bg-white/30 backdrop-blur-2xl',
  cardShadow: { boxShadow: '0 8px 60px rgba(139,92,246,0.12), 0 2px 40px rgba(255,255,255,0.7), inset 0 1px 0 rgba(255,255,255,0.9)' },

  logoTab: 'text-slate-800',
  tagline: 'text-slate-500',
  label: 'text-slate-700',
  labelOpt: 'text-slate-400',
  secLabel: 'text-slate-500',
  hint: 'text-slate-400',
  hintSpan: 'text-slate-500',
  dimText: 'text-slate-400',
  error: 'text-red-500',

  inputBase: 'bg-white/50 text-slate-700 placeholder-slate-400 backdrop-blur-sm focus:bg-white/70 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.25)]',
  inputBorderNormal: 'border-white/60 hover:border-violet-300/50 focus:border-violet-400/60',
  inputBorderError: 'border-red-400/60 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]',
  inputIcon: 'text-slate-400',

  dropdown: 'border-white/60 bg-white/80 backdrop-blur-2xl shadow-[0_8px_30px_rgba(139,92,246,0.15)]',
  dropdownItem: 'text-slate-600 hover:bg-white/60',
  dropdownItemSelected: 'bg-violet-100/80 text-violet-700',

  chipActive: 'bg-gradient-to-r from-violet-500 to-indigo-500 border-transparent text-white shadow-[0_2px_16px_rgba(139,92,246,0.4)] scale-105',
  chipInactive: 'bg-white/50 border-white/60 text-slate-500 hover:border-violet-300/60 hover:text-violet-600 hover:bg-white/70 hover:scale-105 backdrop-blur-sm',

  sugChip: 'bg-white/50 border-white/60 text-slate-600 hover:bg-violet-50/80 hover:border-violet-200/70 hover:text-violet-700 backdrop-blur-sm',
  sugUrl: 'text-slate-400',

  scMain: 'bg-gradient-to-r from-violet-50/80 to-indigo-50/80 border-violet-200/60 text-slate-600 hover:from-violet-100/80 hover:to-indigo-100/80 hover:text-slate-800 hover:border-violet-300/60 backdrop-blur-sm',
  scRemove: 'border-violet-200/60 bg-violet-50/60 text-slate-400 hover:bg-red-50/80 hover:text-red-500 hover:border-red-200/60 backdrop-blur-sm',
  scMore: 'bg-white/50 border-white/60 text-slate-500 hover:bg-white/70 hover:text-slate-700 hover:border-white/80 backdrop-blur-sm',
  scLabel: 'text-violet-500',
  scUrl: 'text-slate-400',

  matchChip: 'bg-violet-50/80 border-violet-200/60 text-violet-600 hover:bg-violet-100/80 hover:text-violet-700 hover:border-violet-300/60 backdrop-blur-sm',
  matchUrl: 'text-violet-400',

  indigoBadge: 'bg-indigo-50/80 border-indigo-200/70 backdrop-blur-sm',
  indigoLabel: 'text-indigo-500',
  indigoText: 'text-slate-600',
  violetBadge: 'bg-violet-50/80 border-violet-200/70 backdrop-blur-sm',
  violetLabel: 'text-violet-500',
  violetText: 'text-slate-600',
  closeBtn: 'text-slate-400 hover:text-slate-600 hover:bg-white/60',

  parentActive: 'bg-violet-50/80 border-violet-200/70',
  parentInactive: 'bg-white/30 border-white/50 hover:border-white/70',
  parentActiveLabel: 'text-violet-500',
  parentInactiveLabel: 'text-slate-400',
  parentActiveText: 'text-slate-700',
  parentInactiveText: 'text-slate-400 line-through',

  continueBtn: 'from-violet-500 via-indigo-500 to-blue-500 hover:from-violet-400 hover:via-indigo-400 hover:to-blue-400 shadow-[0_4px_24px_rgba(139,92,246,0.35)] hover:shadow-[0_4px_32px_rgba(139,92,246,0.5)] focus:ring-violet-400',
  saveBtn: 'bg-white/50 border border-white/70 text-slate-600 hover:bg-violet-50/80 hover:border-violet-200/70 hover:text-violet-600 backdrop-blur-sm focus:ring-violet-400',
  statsBtn: 'text-slate-500 hover:text-violet-600 hover:bg-white/50 border border-transparent hover:border-white/60 backdrop-blur-sm',
  settingsBtn: 'text-slate-400 hover:text-slate-600',
  divider: 'border-black/[0.06]',

  exSubtext: 'text-slate-400',
  exAddBtn: 'bg-violet-100/80 hover:bg-violet-200/80 text-violet-600 border-violet-200/60 backdrop-blur-sm',
  exToggleOn: 'bg-violet-100/80 border-violet-300/60 text-violet-600',
  exToggleOff: 'bg-white/50 border-white/60 text-slate-400 hover:text-slate-600 hover:border-white/80',
  exDomainRow: 'bg-white/40 border-white/60 backdrop-blur-sm',
  exDomainText: 'text-slate-600',
  exEditActive: 'bg-violet-100/80 text-violet-600',
  exEditWithLabel: 'text-violet-500 hover:text-violet-600 hover:bg-violet-50/80',
  exEditNoLabel: 'text-slate-400 hover:text-slate-600 hover:bg-white/60',
  exRemove: 'text-slate-400 hover:text-red-500 hover:bg-red-50/80',
  exInlineDivider: 'border-black/[0.05]',
  exSaveBtn: 'bg-violet-100/80 hover:bg-violet-200/80 text-violet-600 border-violet-200/60',
  exCancelBtn: 'bg-white/50 hover:bg-white/70 text-slate-500 border-white/60',
  exClearBtn: 'text-slate-400 hover:text-red-500',

  switcherPill: 'bg-white/30 border-white/50 backdrop-blur-sm',
  switcherActive: 'bg-white/80 text-violet-700 shadow-sm',
  switcherInactive: 'text-slate-500 hover:text-slate-700',
};

// ─── DARK (glassmorphic dark) ────────────────────────────────────────────────
export const DARK: ThemeTokens = {
  pageBg: { background: '#0a0a12' },
  orb: [
    'bg-indigo-600/20 blur-[128px]',
    'bg-purple-700/15 blur-[140px]',
    'bg-violet-500/10 blur-[120px]',
    'bg-violet-400/5 blur-[100px]',
  ],
  card: 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl',
  cardShadow: { boxShadow: '0 8px 60px rgba(0,0,0,0.6)' },

  logoTab: 'text-slate-100',
  tagline: 'text-slate-400',
  label: 'text-slate-200',
  labelOpt: 'text-slate-500',
  secLabel: 'text-slate-400',
  hint: 'text-slate-600',
  hintSpan: 'text-slate-500',
  dimText: 'text-slate-600',
  error: 'text-red-400',

  inputBase: 'bg-white/5 text-slate-200 placeholder-slate-600 focus:bg-white/[0.08] focus:shadow-[0_0_0_2px_rgba(139,92,246,0.35)]',
  inputBorderNormal: 'border-white/10 hover:border-white/20 focus:border-violet-500/60',
  inputBorderError: 'border-red-500/60 shadow-[0_0_0_2px_rgba(239,68,68,0.25)]',
  inputIcon: 'text-slate-600',

  dropdown: 'border-white/10 bg-[#0f111a]/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]',
  dropdownItem: 'text-slate-300 hover:bg-white/5',
  dropdownItemSelected: 'bg-violet-500/20 text-violet-200',

  chipActive: 'bg-gradient-to-r from-indigo-500 to-violet-600 border-transparent text-white shadow-[0_0_16px_rgba(139,92,246,0.5)] scale-105',
  chipInactive: 'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/40 hover:text-slate-200 hover:scale-105',

  sugChip: 'bg-white/5 border-white/10 text-slate-400 hover:bg-violet-500/15 hover:border-violet-500/40 hover:text-slate-200',
  sugUrl: 'text-slate-500',

  scMain: 'bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20 text-slate-300 hover:from-violet-500/20 hover:to-purple-500/20 hover:text-slate-100 hover:border-violet-500/30',
  scRemove: 'border-violet-500/20 bg-purple-500/10 text-slate-500 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30',
  scMore: 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200 hover:border-white/20',
  scLabel: 'text-violet-400',
  scUrl: 'text-slate-500',

  matchChip: 'bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 hover:border-violet-500/40',
  matchUrl: 'text-violet-400/60',

  indigoBadge: 'bg-indigo-500/10 border-indigo-500/20',
  indigoLabel: 'text-indigo-400',
  indigoText: 'text-slate-300',
  violetBadge: 'bg-violet-500/10 border-violet-500/20',
  violetLabel: 'text-violet-400',
  violetText: 'text-slate-300',
  closeBtn: 'text-slate-500 hover:text-slate-300 hover:bg-white/10',

  parentActive: 'bg-violet-500/15 border-violet-500/30',
  parentInactive: 'bg-white/5 border-white/10 hover:border-white/20',
  parentActiveLabel: 'text-violet-400',
  parentInactiveLabel: 'text-slate-500',
  parentActiveText: 'text-slate-200',
  parentInactiveText: 'text-slate-500 line-through',

  continueBtn: 'from-indigo-500 via-violet-500 to-purple-600 hover:from-indigo-400 hover:via-violet-400 hover:to-purple-500 shadow-[0_4px_24px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_32px_rgba(139,92,246,0.6)] focus:ring-violet-500',
  saveBtn: 'bg-white/5 border border-white/10 text-slate-300 hover:bg-violet-500/15 hover:border-violet-500/30 hover:text-violet-300 focus:ring-violet-500',
  statsBtn: 'text-slate-500 hover:text-violet-300 hover:bg-violet-500/10 border border-transparent hover:border-violet-500/20',
  settingsBtn: 'text-slate-500 hover:text-slate-300',
  divider: 'border-white/[0.06]',

  exSubtext: 'text-slate-600',
  exAddBtn: 'bg-violet-600/25 hover:bg-violet-600/40 text-violet-300 border-violet-500/25',
  exToggleOn: 'bg-violet-500/20 border-violet-500/40 text-violet-300',
  exToggleOff: 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20',
  exDomainRow: 'bg-white/[0.04] border-white/[0.06]',
  exDomainText: 'text-slate-300',
  exEditActive: 'bg-violet-500/20 text-violet-300',
  exEditWithLabel: 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10',
  exEditNoLabel: 'text-slate-600 hover:text-slate-400 hover:bg-white/5',
  exRemove: 'text-slate-600 hover:text-red-400 hover:bg-red-500/10',
  exInlineDivider: 'border-white/[0.04]',
  exSaveBtn: 'bg-violet-600/30 hover:bg-violet-600/45 text-violet-300 border-violet-500/25',
  exCancelBtn: 'bg-white/5 hover:bg-white/10 text-slate-500 border-white/10',
  exClearBtn: 'text-slate-600 hover:text-red-400',

  switcherPill: 'bg-white/10 border-white/[0.12] backdrop-blur-sm',
  switcherActive: 'bg-white/20 text-violet-300',
  switcherInactive: 'text-slate-500 hover:text-slate-300',
};

/** Resolve theme tokens — 'default' now maps to white glassmorphic */
export function resolveTokens(mode: ThemeMode): ThemeTokens {
  if (mode === 'dark') return DARK;
  return WHITE;
}
