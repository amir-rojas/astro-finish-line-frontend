// render/timeline-chart.ts — the swappable render seam for
// `RegistrationsTimelineWidget` (PR3 of `sdd/admin-reportes`, design
// "Decision: Timeline renderer behind a mount-style seam" + spec "Timeline
// Data/Render Separation"). Pure w.r.t. app state: no fetch, no module-level
// state, no business logic — accepts already-fetched, already-shaped data
// and produces markup. Fully replaces `el`'s content on every call, so it is
// safe to call repeatedly (e.g. after a race-selector change).
import type { TimelinePoint } from '../types';

export interface TimelineChartInput {
  points: readonly TimelinePoint[];
  labelFor: (iso: string) => string;
}

export type TimelineRenderer = (el: HTMLElement, input: TimelineChartInput) => void;

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 180;
const PADDING_X = 8;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;
const BAR_GAP = 4;

export const renderTimelineChart: TimelineRenderer = (el, { points, labelFor }) => {
  // Replaces `el`'s content unconditionally — no diffing, no leftover state
  // from a previous render (design "must fully replace `el`'s content and be
  // safe to call repeatedly").
  el.innerHTML = '';

  const plotWidth = VIEW_WIDTH - PADDING_X * 2;
  const plotHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const max = Math.max(1, ...points.map((point) => point.count));
  const barWidth = points.length > 0 ? plotWidth / points.length - BAR_GAP : 0;

  const total = points.reduce((sum, point) => sum + point.count, 0);
  const summary =
    points.length === 0
      ? 'Sin datos de inscripciones.'
      : `Inscripciones por día, últimos ${points.length} días: ${total} en total. ` +
        points.map((point) => `${labelFor(point.date)}: ${point.count}`).join(', ') +
        '.';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', summary);
  svg.classList.add('timeline-chart');

  points.forEach((point, index) => {
    const x = PADDING_X + index * (barWidth + BAR_GAP);
    const barHeight = point.count === 0 ? 0 : Math.max(2, (point.count / max) * plotHeight);
    const y = PADDING_TOP + (plotHeight - barHeight);

    const bar = document.createElementNS(SVG_NS, 'rect');
    bar.setAttribute('x', String(x));
    bar.setAttribute('y', String(y));
    bar.setAttribute('width', String(Math.max(0, barWidth)));
    bar.setAttribute('height', String(barHeight));
    bar.setAttribute('rx', '2');
    bar.classList.add('timeline-chart__bar');
    svg.appendChild(bar);

    const tick = document.createElementNS(SVG_NS, 'text');
    tick.setAttribute('x', String(x + barWidth / 2));
    tick.setAttribute('y', String(VIEW_HEIGHT - PADDING_BOTTOM + 16));
    tick.setAttribute('text-anchor', 'middle');
    tick.classList.add('timeline-chart__tick');
    tick.textContent = labelFor(point.date);
    svg.appendChild(tick);
  });

  el.appendChild(svg);
};
