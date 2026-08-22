// lib/apex-defaults.ts — shared ApexCharts option fragment for the admin
// surface's single-series charts (timeline, tallas, canal — see
// `features/reports/render/*.ts`). Encodes the house rules from the
// `dataviz` skill (hairline recessive grid, no toolbar chrome, thin
// rounded-cap bars, single accent hue) in one place instead of tripling them
// across three chart files.
import type { ApexOptions } from 'apexcharts';
import type { ChartTokens } from './chart-tokens';

// Every chart here is a single series ("one series → one color", dataviz
// anti-patterns) — a legend box would just restate the card's own <h2>
// title, so it stays off everywhere (marks-and-anatomy "a single series
// needs no legend box").
export function apexBaseOptions(tokens: ChartTokens): ApexOptions {
  return {
    chart: {
      fontFamily: "'Barlow', sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { speed: 260 },
      foreColor: tokens.muted,
    },
    colors: [tokens.accent],
    legend: { show: false },
    grid: {
      borderColor: tokens.border,
      strokeDashArray: 0, // dataviz: gridlines are solid hairlines, never dashed
      padding: { left: 8, right: 8 },
    },
    tooltip: {
      theme: 'light',
      style: { fontFamily: "'Barlow', sans-serif" },
    },
    dataLabels: { enabled: false },
  };
}
