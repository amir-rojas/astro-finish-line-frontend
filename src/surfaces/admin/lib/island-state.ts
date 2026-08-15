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

export interface IslandStateView {
  loading(): void;
  ready(): void;
  empty(message: string, action?: IslandStateAction): void;
  error(message: string, retry: () => void): void;
  unauthorized(): void;
}

export function createStateView(root: ParentNode): IslandStateView | null {
  const stateEl = root.querySelector<HTMLElement>('[data-state]');
  const textEl = root.querySelector<HTMLElement>('[data-state-text]');
  const retryBtn = root.querySelector<HTMLButtonElement>('[data-state-retry]');
  if (!stateEl || !textEl || !retryBtn) return null;

  let retryAction: (() => void) | null = null;
  retryBtn.addEventListener('click', () => retryAction?.());

  const show = (message: string, action?: IslandStateAction) => {
    stateEl.hidden = false;
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
    loading: () => show('Cargando…'),
    ready: () => {
      stateEl.hidden = true;
      retryAction = null;
      retryBtn.hidden = true;
    },
    empty: (message, action) => show(message, action),
    error: (message, retry) => show(message, { label: 'Reintentar', run: retry }),
    // Spec "401 has no auto-retry": the only action is a full page reload
    // (goes back through `middleware.ts`), never a retry of the same fetch.
    unauthorized: () => show('Tu sesión expiró.', { label: 'Recargar', run: () => window.location.reload() }),
  };
}
