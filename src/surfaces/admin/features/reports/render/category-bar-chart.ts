// render/category-bar-chart.ts — shared ApexCharts render seam for
// `ShirtSizesWidget` and `ReferralSourcesWidget`: both are "one count per
// named category, server order is authoritative" (spec "Shirt-Size Empty
// Bucket Label" / "Ordering rule" — neither widget may resort what it
// receives), so they share one horizontal single-hue bar chart instead of
// two near-identical ApexCharts configs. dataviz skill: nominal categories +
// one series → one color for every bar, never a per-bar categorical ramp;
// "Part-to-whole... go horizontal for many/long-named categories"; a
// donut/pie was considered for the referral-source case and rejected per the
// skill's own anti-pattern ("a donut/pie for comparing close values — a bar,
// or the numbers").
import ApexCharts from 'apexcharts/core';
import 'apexcharts/bar';
import type { ApexOptions } from 'apexcharts';
import { readChartTokens } from '@admin/lib/chart-tokens';
import { apexBaseOptions } from '@admin/lib/apex-defaults';

export interface CategoryBarPoint {
  label: string;
  count: number;
}

const instances = new WeakMap<HTMLElement, ApexCharts>();

export function renderCategoryBarChart(el: HTMLElement, points: readonly CategoryBarPoint[]): void {
  instances.get(el)?.destroy();
  el.innerHTML = '';

  const tokens = readChartTokens(el);
  const mount = document.createElement('div');
  el.appendChild(mount);

  // Same "hidden text twin" as the timeline chart — every value stays
  // reachable without hovering the SVG.
  const total = points.reduce((sum, p) => sum + p.count, 0);
  const summary = document.createElement('p');
  summary.className = 'category-bar-chart__sr-only';
  summary.textContent =
    points.length === 0 ? 'Sin datos.' : points.map((p) => `${p.label}: ${p.count}`).join(', ') + `. ${total} en total.`;
  el.appendChild(summary);

  const base = apexBaseOptions(tokens);
  // ~40px band per category, bar filling ~58% of it → ≈23px thick,
  // matching the "bar ≤24px thick" mark spec regardless of category count.
  const height = Math.max(120, points.length * 40);

  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: 'bar', height },
    series: [{ name: 'Cantidad', data: points.map((p) => p.count) }],
    xaxis: {
      categories: points.map((p) => p.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: '10px', colors: tokens.muted } },
    },
    yaxis: { labels: { style: { fontSize: '12px', colors: tokens.ink, fontWeight: 700 } } },
    grid: { ...base.grid, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '58%',
        borderRadius: 4,
        borderRadiusApplication: 'end', // "4px rounded data-end, square at the baseline"
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => String(val),
      style: { colors: [tokens.ink], fontSize: '12px', fontWeight: 700 },
      offsetX: 6,
    },
    tooltip: base.tooltip,
  };

  const chart = new ApexCharts(mount, options);
  instances.set(el, chart);
  void chart.render();
}
