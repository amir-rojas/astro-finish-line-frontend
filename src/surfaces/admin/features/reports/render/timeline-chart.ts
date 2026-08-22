// render/timeline-chart.ts — the swappable render seam for
// `RegistrationsTimelineWidget` (originally PR3 of `sdd/admin-reportes`;
// migrated to ApexCharts per Amir's decision to standardize the admin
// surface's hand-rolled charts on one library). Same contract as before:
// pure w.r.t. app state (no fetch, no business logic), fully replaces `el`'s
// content on every call, safe to call repeatedly (e.g. after a race-selector
// change) — an internal WeakMap tracks the live ApexCharts instance per `el`
// so a repeat call destroys the old chart before mounting a new one, instead
// of leaking chart instances.
//
// Tree-shaken import (`apexcharts/core` + `apexcharts/area` only, per the
// library's own tree-shaking convention) — this is a single-series area
// chart, no other chart type needed here.
import ApexCharts from 'apexcharts/core';
import 'apexcharts/area';
import type { ApexOptions } from 'apexcharts';
import type { TimelinePoint } from '../types';
import { readChartTokens } from '@admin/lib/chart-tokens';
import { apexBaseOptions } from '@admin/lib/apex-defaults';

export interface TimelineChartInput {
  points: readonly TimelinePoint[];
  labelFor: (iso: string) => string;
}

export type TimelineRenderer = (el: HTMLElement, input: TimelineChartInput) => void;

const instances = new WeakMap<HTMLElement, ApexCharts>();

export const renderTimelineChart: TimelineRenderer = (el, { points, labelFor }) => {
  instances.get(el)?.destroy();
  el.innerHTML = '';

  const tokens = readChartTokens(el);
  const mount = document.createElement('div');
  el.appendChild(mount);

  // ApexCharts renders real SVG (not canvas), but doesn't produce a
  // guaranteed plain-language equivalent on its own — keep the same visually
  // hidden text summary the old hand-rolled SVG exposed via `aria-label`, as
  // real DOM text instead (dataviz skill: "every chart has a table-view
  // twin... every value reachable without hovering").
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const summary = document.createElement('p');
  summary.className = 'timeline-chart__sr-only';
  summary.textContent =
    points.length === 0
      ? 'Sin datos de inscripciones.'
      : `Inscripciones por día, últimos ${points.length} días: ${total} en total. ` +
        points.map((point) => `${labelFor(point.date)}: ${point.count}`).join(', ') +
        '.';
  el.appendChild(summary);

  const categories = points.map((point) => labelFor(point.date));
  const lastIndex = points.length - 1;
  const base = apexBaseOptions(tokens);

  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: 'area', height: 180 },
    series: [{ name: 'Inscripciones', data: points.map((point) => point.count) }],
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: '10px', colors: tokens.muted } },
    },
    yaxis: {
      labels: { formatter: (value) => String(Math.round(value)), style: { fontSize: '10px', colors: tokens.muted } },
    },
    grid: { ...base.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    stroke: { curve: 'smooth', width: 2, lineCap: 'round' },
    // dataviz "Area fill: series hue at ~10% opacity (a wash)" — flat solid
    // opacity, not a gradient, so it reads as one consistent wash.
    fill: { type: 'solid', opacity: 0.1 },
    markers: { size: 0, hover: { size: 6 } },
    dataLabels: {
      // "Lines → value at the end" — label only the last point, never every
      // point (anti-pattern: "a number on every data point").
      enabled: true,
      formatter: (val, opts) => (opts?.dataPointIndex === lastIndex ? String(val) : ''),
      style: { colors: [tokens.ink], fontSize: '11px', fontWeight: 700 },
      offsetY: -8,
    },
    tooltip: { ...base.tooltip, x: { show: true } },
  };

  const chart = new ApexCharts(mount, options);
  instances.set(el, chart);
  void chart.render();
};
