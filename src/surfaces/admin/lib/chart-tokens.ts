// lib/chart-tokens.ts — reads the `--adm-*` design tokens at runtime instead
// of hardcoding hex values inside chart config (ApexCharts options are plain
// JS, not CSS, so they can't reference `var(--adm-accent)` directly). Keeps
// chart colors bound to the single source of truth in `AdminLayout.astro`
// instead of a second hardcoded copy drifting out of sync with it.
export interface ChartTokens {
  accent: string;
  ink: string;
  muted: string;
  border: string;
  surface: string;
}

const FALLBACK: ChartTokens = {
  accent: '#fc4c02',
  ink: '#14213a',
  muted: '#6b7280',
  border: '#e2e5ea',
  surface: '#ffffff',
};

export function readChartTokens(el: Element): ChartTokens {
  const style = getComputedStyle(el);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    accent: read('--adm-accent', FALLBACK.accent),
    ink: read('--adm-ink', FALLBACK.ink),
    muted: read('--adm-muted', FALLBACK.muted),
    border: read('--adm-border', FALLBACK.border),
    surface: read('--adm-surface', FALLBACK.surface),
  };
}
