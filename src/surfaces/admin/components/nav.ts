// nav.ts — fuente única de la navegación del panel admin (ver
// `sdd/admin-dashboard`, design D6). `AdminSidebar.astro` la renderiza y las
// rutas placeholder que quedan (`pages/admin/{carreras,pagos,reportes}.astro`)
// la reusan para su propio título — así "ningún link muerto" es un invariante
// por construcción, no una lista que hay que mantener sincronizada a mano.
//
// `status: 'soon'` es visual (badge "Próximamente" atenuado, spec "Placeholder
// item is visually marked") — el link sigue siendo real, nunca `aria-disabled`
// ni un `#` muerto (design: "Los ítems 'Próximamente' son links reales").
export interface AdminNavItem {
  href: string;
  label: string;
  status: 'ready' | 'soon';
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', status: 'ready' },
  { href: '/admin/carreras', label: 'Carreras', status: 'soon' },
  // Pantalla real desde PR 2 (`sdd/admin-dashboard/tasks`) —
  // `pages/admin/inscripciones.astro`. Antes de este PR estaba en `'soon'`
  // (ver comentario histórico en `apply-progress`) porque el link habría
  // quedado muerto fuera del AdminShell en PR 1 solo.
  { href: '/admin/inscripciones', label: 'Inscripciones', status: 'ready' },
  // Pantalla real desde PR1 (`sdd/admin-reportes/tasks`) —
  // `features/participants/components/ParticipantsBrowser.astro`.
  { href: '/admin/participantes', label: 'Participantes', status: 'ready' },
  { href: '/admin/pagos', label: 'Pagos', status: 'soon' },
  { href: '/admin/reportes', label: 'Reportes', status: 'soon' },
  { href: '/admin/configuracion', label: 'Configuración', status: 'ready' },
];
