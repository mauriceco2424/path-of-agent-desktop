export type SkillGroupColor = {
  bg: string;
  bgRaw: string;
  text: string;
  border: string;
  borderRaw: string;
  glow: string;
  glowRaw: string;
};

const SKILL_GROUP_COLORS: SkillGroupColor[] = [
  // bgRaw uses 20% opacity to match Equipment panel styling
  { bg: 'bg-cyan-500/20', bgRaw: 'rgba(34, 211, 238, 0.2)', text: 'text-cyan-300', border: 'border-cyan-500/40', borderRaw: '#22d3ee', glow: 'shadow-[0_0_18px_rgba(34,211,238,0.35)]', glowRaw: '0 0 18px rgba(34, 211, 238, 0.35)' },
  { bg: 'bg-emerald-500/20', bgRaw: 'rgba(16, 185, 129, 0.2)', text: 'text-emerald-300', border: 'border-emerald-500/40', borderRaw: '#10b981', glow: 'shadow-[0_0_18px_rgba(16,185,129,0.35)]', glowRaw: '0 0 18px rgba(16, 185, 129, 0.35)' },
  { bg: 'bg-amber-500/20', bgRaw: 'rgba(245, 158, 11, 0.2)', text: 'text-amber-300', border: 'border-amber-500/40', borderRaw: '#f59e0b', glow: 'shadow-[0_0_18px_rgba(245,158,11,0.35)]', glowRaw: '0 0 18px rgba(245, 158, 11, 0.35)' },
  { bg: 'bg-fuchsia-500/20', bgRaw: 'rgba(217, 70, 239, 0.2)', text: 'text-fuchsia-300', border: 'border-fuchsia-500/40', borderRaw: '#d946ef', glow: 'shadow-[0_0_18px_rgba(217,70,239,0.35)]', glowRaw: '0 0 18px rgba(217, 70, 239, 0.35)' },
  { bg: 'bg-sky-500/20', bgRaw: 'rgba(56, 189, 248, 0.2)', text: 'text-sky-300', border: 'border-sky-500/40', borderRaw: '#38bdf8', glow: 'shadow-[0_0_18px_rgba(56,189,248,0.35)]', glowRaw: '0 0 18px rgba(56, 189, 248, 0.35)' },
  { bg: 'bg-lime-500/20', bgRaw: 'rgba(132, 204, 22, 0.2)', text: 'text-lime-300', border: 'border-lime-500/40', borderRaw: '#84cc16', glow: 'shadow-[0_0_18px_rgba(132,204,22,0.35)]', glowRaw: '0 0 18px rgba(132, 204, 22, 0.35)' },
  { bg: 'bg-rose-500/20', bgRaw: 'rgba(244, 63, 94, 0.2)', text: 'text-rose-300', border: 'border-rose-500/40', borderRaw: '#f43f5e', glow: 'shadow-[0_0_18px_rgba(244,63,94,0.35)]', glowRaw: '0 0 18px rgba(244, 63, 94, 0.35)' },
];

export function getSkillGroupColor(groupIndex?: number | null): SkillGroupColor {
  if (!groupIndex || groupIndex <= 0) {
    return {
      bg: 'bg-slate-700/20',
      bgRaw: 'rgba(51, 65, 85, 0.2)',
      text: 'text-slate-300',
      border: 'border-slate-600/40',
      borderRaw: '#475569',
      glow: 'shadow-[0_0_16px_rgba(148,163,184,0.2)]',
      glowRaw: '0 0 16px rgba(148, 163, 184, 0.2)',
    };
  }

  const colorIndex = (groupIndex - 1) % SKILL_GROUP_COLORS.length;
  return SKILL_GROUP_COLORS[colorIndex];
}
