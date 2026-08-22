// lib/island-state.ts — shared "loading | ready | empty | error | 401" block
// for the client islands in this change (participants in PR1; the three
// reports widgets in PR2/PR3). Extracts the `showState()` pattern that
// already lives inline in `RegistrationsBrowser.astro` (see that component)
// so it isn't copy-pasted four more times (design "Technical Approach":
// "share the UI state machine").
//
// Unlike `features/*/types.ts`, this module has zero server-only
// dependencies, so it is safe to import directly into a browser
// `<script type="module">` (matches the `@admin/*` tsconfig alias, already
// used from `.astro` frontmatter elsewhere in this surface).
//
// Expected markup inside `root`:
//   [data-state]       — state/message block (hidden once `ready()` runs)
//   [data-state-text]  — message text (also the `aria-live` announcer)
//   [data-state-retry] — action button (hidden unless error/401/empty-action)
// The "ready" content itself (table, chart, etc.) stays the caller's
// responsibility — this module only owns its own state block.
export interface IslandStateAction {
  label: string;
  run: () => void;
}

export interface IslandStateOptions {
  // Loading skeleton height in px, matching the caller's real "ready" content
  // height (e.g. the ApexCharts `height` option) — falls back to a generic
  // table-row-ish default for callers that don't know their content height
  // ahead of the fetch (impeccable critique P1: "loading state gives no
  // shape or motion during a documented 45s Go cold-start worst case").
  loadingHeight?: number;
}

export interface IslandStateView {
  loading(): void;
  ready(): void;
  empty(message: string, action?: IslandStateAction): void;
  error(message: string, retry: () => void): void;
  unauthorized(): void;
}

const STYLE_ID = 'island-state-styles';

// Injected once per document, not per instance — every `createStateView()`
// call across every island shares the same stylesheet. Guarded by element id
// (not just a module-scope flag) because `ClientRouter` navigations reuse
// the same `document`/`<head>`, so a flag alone would still be correct, but
// checking the DOM directly is the source of truth and survives any future
// refactor that re-evaluates this module.
function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.island-state__text--sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.island-state__skeleton {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: var(--island-skeleton-h, 160px);
}
.island-state__skeleton-bar {
  height: 14px;
  border-radius: 7px;
  background: var(--adm-border, #e2e5ea);
  animation: island-state-pulse 1.4s ease-in-out infinite;
}
.island-state__skeleton-bar:nth-child(1) { width: 70%; }
.island-state__skeleton-bar:nth-child(2) { width: 45%; animation-delay: 0.15s; }
.island-state__skeleton-bar:nth-child(3) { width: 85%; animation-delay: 0.3s; }
@keyframes island-state-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
.island-state__icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-right: 10px;
  vertical-align: middle;
}
@media (prefers-reduced-motion: reduce) {
  .island-state__skeleton-bar { animation: none; opacity: 0.7; }
}
`;
  document.head.appendChild(style);
}

export function createStateView(root: ParentNode, options: IslandStateOptions = {}): IslandStateView | null {
  const stateEl = root.querySelector<HTMLElement>('[data-state]');
  const textEl = root.querySelector<HTMLElement>('[data-state-text]');
  const retryBtn = root.querySelector<HTMLButtonElement>('[data-state-retry]');
  if (!stateEl || !textEl || !retryBtn) return null;

  ensureStyles();
  const loadingHeight = options.loadingHeight ?? 160;

  let retryAction: (() => void) | null = null;
  retryBtn.addEventListener('click', () => retryAction?.());

  let skeletonEl: HTMLElement | null = null;
  let iconEl: SVGSVGElement | null = null;

  const removeSkeleton = () => {
    skeletonEl?.remove();
    skeletonEl = null;
    textEl.classList.remove('island-state__text--sr-only');
  };

  const showSkeleton = () => {
    if (skeletonEl) return;
    const el = document.createElement('div');
    el.className = 'island-state__skeleton';
    el.setAttribute('aria-hidden', 'true'); // decorative; the live-region text carries the announcement
    el.style.setProperty('--island-skeleton-h', `${loadingHeight}px`);
    for (let i = 0; i < 3; i += 1) {
      const bar = document.createElement('div');
      bar.className = 'island-state__skeleton-bar';
      el.appendChild(bar);
    }
    stateEl.insertBefore(el, stateEl.firstChild);
    skeletonEl = el;
    // Visually hidden, not `hidden` — a clipped-but-present node still gets
    // announced inside the `aria-live="polite"` ancestor every widget's
    // markup already carries; `hidden`/`display:none` would not.
    textEl.classList.add('island-state__text--sr-only');
  };

  const removeIcon = () => {
    iconEl?.remove();
    iconEl = null;
  };

  // Same glyph as `BlockError.astro`'s error icon (dashboard) — this is the
  // visual-unification half of the fix: error/401 in these islands now reads
  // identically to a dashboard block failure, not as a plainer second
  // pattern (impeccable critique P1: "two different visual languages for
  // the same semantic state").
  const showIcon = () => {
    if (iconEl) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('island-state__icon');
    svg.innerHTML =
      '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="16.5" x2="12" y2="16.51"></line>';
    textEl.before(svg);
    iconEl = svg;
  };

  // `BlockError.astro`'s danger treatment is `background:var(--adm-danger-soft)`
  // + `color:var(--adm-danger)` on its own root, set directly in that
  // component's scoped CSS. `island-state.ts` renders into markup owned by
  // 4 different `.astro` files (each with its own scoped `--state`/
  // `--state-text` background/color rules), so matching that treatment here
  // via inline styles — not a 5th copy of the CSS rule — is the actual
  // shared source of truth: one place sets the danger colors, no scoped-CSS
  // specificity fight, and it clears cleanly back to each widget's own
  // neutral styling when `danger` is false.
  const setDanger = (danger: boolean) => {
    stateEl.style.background = danger ? 'var(--adm-danger-soft)' : '';
    stateEl.style.color = danger ? 'var(--adm-danger)' : '';
    textEl.style.color = danger ? 'var(--adm-danger)' : '';
    if (danger) showIcon();
    else removeIcon();
  };

  const show = (message: string, action: IslandStateAction | undefined, danger: boolean) => {
    removeSkeleton();
    stateEl.hidden = false;
    setDanger(danger);
    textEl.textContent = message;
    if (action) {
      retryAction = action.run;
      retryBtn.textContent = action.label;
      retryBtn.hidden = false;
    } else {
      retryAction = null;
      retryBtn.hidden = true;
    }
  };

  return {
    loading: () => {
      stateEl.hidden = false;
      setDanger(false);
      textEl.textContent = 'Cargando…';
      retryAction = null;
      retryBtn.hidden = true;
      showSkeleton();
    },
    ready: () => {
      removeSkeleton();
      setDanger(false);
      stateEl.hidden = true;
      retryAction = null;
      retryBtn.hidden = true;
    },
    empty: (message, action) => show(message, action, false),
    error: (message, retry) => show(message, { label: 'Reintentar', run: retry }, true),
    // Spec "401 has no auto-retry": the only action is a full page reload
    // (goes back through `middleware.ts`), never a retry of the same fetch.
    unauthorized: () => show('Tu sesión expiró.', { label: 'Recargar', run: () => window.location.reload() }, true),
  };
}
