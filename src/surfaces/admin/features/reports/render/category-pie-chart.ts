// render/category-pie-chart.ts — dedicated pie renderer for
// `ReferralSourcesWidget` ONLY. Amir explicitly asked for a pie here despite
// the dataviz skill's own anti-pattern ("a donut/pie for comparing close
// values — a bar, or the numbers") — `category-bar-chart.ts` stays the
// shirt-size renderer, this is not a shared abstraction.
//
// A pie is an "any slice can neighbor any slice" form (dataviz skill: same
// class as scatter/small-multiples), so it needs the ALL-PAIRS categorical
// gate, not the weaker adjacent-pairs gate bar/line charts use. Running
// `validate_palette.js --pairs all` on the skill's reference 8-hue order
// found the full set fails (worst normal-vision ΔE 7.1, worst CVD ΔE 3.2);
// slots {1 blue, 2 orange, 3 aqua, 7 violet} is the largest subset that
// clears every check in both directions (light: worst all-pairs CVD ΔE 9.2,
// worst normal-vision ΔE 16.3; contrast WARN on aqua is why every slice gets
// a direct label, not just a legend swatch). This repo's admin surface has
// no dark-mode tokens (`AdminLayout.astro` is light-only), so only the light
// steps are needed here.
//
// Consequence of capping at 4: sources beyond the top 4 by count fold into
// an "Otros" slice (neutral gray, no CVD identity to defend — it's a residual
// bucket, not a series). This means referral sources are now sorted by count
// descending and capped, which is a deliberate DEVIATION from this widget's
// prior "render Go's raw order, never resort" rule (still true for
// `ShirtSizesWidget`/`category-bar-chart.ts`) — a pie with more than a
// handful of untrimmed, unordered slices is illegible and was never going to
// clear the CVD gate anyway. Flagged for Amir to confirm; not silently done.
import ApexCharts from 'apexcharts/core';
import 'apexcharts/pie';
import type { ApexOptions } from 'apexcharts';
import { readChartTokens } from '@admin/lib/chart-tokens';

export interface CategoryPiePoint {
  label: string;
  count: number;
}

// Validated via `node scripts/validate_palette.js "<hexes>" --mode light --pairs all`
// (dataviz skill) — do not add a 5th hue without re-running that check.
const SLICE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7'] as const;
const OTHER_COLOR = '#c3c2b7'; // neutral — residual bucket, not a series identity
// White datalabel-on-`OTHER_COLOR` is ~1.79:1 (fails the 3:1 bold/large-text
// floor; the 4 hues above never had this problem, white clears >4.5:1 on all
// of them, per the ΔE validation above). `OTHER_COLOR` itself is intentional
// (see comment above — a 5th "real" hue would need its own all-pairs check),
// so the fix is per-slice datalabel color, not the fill (crítica
// `/impeccable`, hallazgo P2 "Otros slice fails text contrast").
// tokens.ink (`#14213a`) on `OTHER_COLOR`: ~8.96:1 — clears both the 3:1
// large-text floor and 4.5:1 body-text floor with margin to spare.
const MAX_SLICES = SLICE_COLORS.length;

const instances = new WeakMap<HTMLElement, ApexCharts>();

export function renderCategoryPieChart(el: HTMLElement, points: readonly CategoryPiePoint[]): void {
  instances.get(el)?.destroy();
  el.innerHTML = '';

  const tokens = readChartTokens(el);
  const mount = document.createElement('div');
  el.appendChild(mount);

  const sorted = [...points].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES);
  const otherTotal = rest.reduce((sum, p) => sum + p.count, 0);
  const slices = otherTotal > 0 ? [...top, { label: 'Otros', count: otherTotal }] : top;
  const colors = slices.map((_, i) => (i < top.length ? SLICE_COLORS[i] : OTHER_COLOR));

  // Same "hidden text twin" as the bar/timeline renderers — every value
  // stays reachable without hovering the SVG, and it carries the untrimmed
  // list (not just the capped slices) so "Otros" is auditable in text.
  const grandTotal = points.reduce((sum, p) => sum + p.count, 0);
  const summary = document.createElement('p');
  summary.className = 'category-pie-chart__sr-only';
  summary.textContent =
    points.length === 0
      ? 'Sin datos.'
      : points.map((p) => `${p.label}: ${p.count}`).join(', ') + `. ${grandTotal} en total.`;
  el.appendChild(summary);

  const options: ApexOptions = {
    chart: {
      type: 'pie',
      height: 320,
      fontFamily: "'Barlow', sans-serif",
      toolbar: { show: false },
      animations: { speed: 260 },
    },
    series: slices.map((s) => s.count),
    labels: slices.map((s) => s.label),
    colors,
    stroke: { show: true, width: 2, colors: [tokens.surface] }, // 2px surface-gap spacer between slices
    legend: {
      show: true,
      position: 'bottom',
      fontFamily: "'Barlow', sans-serif",
      fontSize: '12px',
      labels: { colors: tokens.ink },
      markers: { size: 6 },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${Math.round(val)}%`,
      // Per-slice, not a single flat color: the "Otros" slice (light gray)
      // needs the dark ink label, the 4 real hues keep the white one.
      style: {
        fontSize: '12px',
        fontWeight: 700,
        colors: slices.map((s) => (s.label === 'Otros' ? tokens.ink : tokens.surface)),
      },
      dropShadow: { enabled: false },
    },
    tooltip: {
      theme: 'light',
      style: { fontFamily: "'Barlow', sans-serif" },
      y: { formatter: (val: number) => `${val}` },
    },
  };

  const chart = new ApexCharts(mount, options);
  instances.set(el, chart);
  void chart.render();
}
