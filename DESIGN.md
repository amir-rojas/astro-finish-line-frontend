# Design

Sistema visual de la superficie pública (`surfaces/public`) de Finish Line,
extraído de la referencia final `design-reference/Finish Line Landing Final.dc.html`
(landing "La Paz 10K — La ciudad que corre"). Esta referencia es la **fuente de
verdad visual**: se traduce fielmente, no se reinterpreta.

El panel admin tiene su propio lenguaje y **no** comparte estos tokens.

## Theme

Dark editorial atlético. Lienzo **navy profundo** con secciones que alternan a
**crema/papel**, y un **naranja de meta** como único acento. Estética filosa:
**sin border-radius**, tipografía pesada en mayúsculas, números grandes. La
energía viene del contraste navy/crema/naranja y del motivo a cuadros de
bandera de meta — no de sombras, glows ni glass.

Estrategia de color: **committed** (un navy domina el lienzo, la crema estructura
el descanso, el naranja marca acción y marca). Sin modo claro/oscuro alternable:
el orden de secciones (navy → naranja → crema → navy …) ES el ritmo.

## Color

Valores tal cual la referencia (hex; equivalentes OKLCH al migrar a tokens).

| Rol | Token | Hex | Uso |
| --- | --- | --- | --- |
| Fondo marca (navy) | `--fl-navy` | `#0e1c30` | Lienzo principal, header, hero, precio, footer |
| Tinta sobre crema | `--fl-ink` | `#14233a` | Texto/títulos sobre fondos claros |
| Acento (meta) | `--fl-orange` | `#ee5314` | CTAs, números clave, motivo a cuadros, mark |
| Papel | `--fl-cream` | `#f6f0e4` | Texto sobre navy; fondo de secciones claras |
| Papel cálido | `--fl-cream-2` | `#efe7d6` | Fondo sección Recorrido / Organiza |
| Papel cálido 3 | `--fl-cream-3` | `#e1d6bd` | Placeholder del mapa de recorrido |
| Superficie card | `--fl-surface` | `#ffffff` | Cards sobre crema |

Variantes del naranja (según de qué lado del contraste esté):
- `--fl-orange` `#ee5314` — el acento puro: mark, motivos, foco. NO como texto sobre crema (3.15:1, no llega a AA).
- `--fl-orange-strong` `#cf3f0d` — texto **blanco ENCIMA** del naranja (relleno de CTA): 4.8:1.
- `--fl-orange-ink` `#b83609` — naranja **como TEXTO** sobre claro (links en crema): 5.18:1 AA. Es el que va en links; `-strong` reprueba (4.23:1) porque no fue hecho para eso.

Neutrales de texto (derivados, contraste ya verificado para AA):
- Sobre navy: `#aebbcb`, `#b9c6d6` (cuerpo), `#cdd7e2` (chips), `#8295aa` / `#5d6f86` (meta tenue).
- Sobre crema: `#5a5346` = `--fl-on-cream-muted` (cuerpo) · `#6b6456` = `--fl-on-cream-faint` (labels/meta).

> **`#9a8f78` está PROHIBIDO como color de texto.** Estuvo listado acá como
> "verificado" y no lo estaba: da **2.81:1** sobre crema, **2.60:1** sobre crema-2 y
> **3.19:1** sobre blanco — reprueba AA en los tres. Se comía los labels
> `SIN POLERA` / `CON POLERA` del detalle, o sea el dato que separa 105 Bs de 230.
> `--fl-on-cream-faint` pasó a `#6b6456` (5.16 / 4.77 / 5.86:1), que es el gris más
> claro que pasa AA sobre los tres fondos reales: sigue siendo "tenue" sin mentir.

### Alfa por rol — divisorias, bordes y hovers

No son colores nuevos: son los de marca a baja opacidad. **Un token por rol, no
por valor.** Nunca escribir el `rgba()` a mano en una sección: si aparece un rol
que no está acá, se agrega el token, no un literal. (Las pantallas de
calendario/detalle/home se calcaron de un mockup con otra paleta; por eso quedan
`rgba()` navy sueltos que se están migrando a estos tokens.)

| Token | Valor | Rol |
| --- | --- | --- |
| `--fl-hairline` | crema @ .12 | Reglas y divisorias entre bloques, **sobre navy** |
| `--fl-hairline-ink` | tinta (`--fl-ink`) @ .10 | Reglas y divisorias entre bloques, **sobre crema** |
| `--fl-edge` | crema @ .18 | Borde de chips, tarjetas y botones ghost, sobre navy |
| `--fl-wash` | crema @ .06 | Fondo de hover neutro sobre navy |
| `--fl-wash-orange` | naranja @ .10 | Fondo de hover naranja sobre navy |

Pendiente (mismo origen): el lado crema aún no tiene contraparte de `--fl-edge`
ni de `--fl-wash` — los bordes de card y hovers sobre crema siguen con `rgba()`
literal. Migrar cuando una pantalla los toque.

### Estado de inscripción — extensión funcional, fuera del ramp de marca

| Token | Hex | Uso |
| --- | --- | --- |
| `--fl-status-open` | `#1f7a4d` | "Abiertas". Relleno con texto blanco (5.32:1) o tinta sobre superficie clara |
| `--fl-status-warning` | `#a15c00` | "Últimos cupos". Ídem (5.19:1) |
| `--fl-status-closed` | `#52525b` | "Agotado". Ídem (7.73:1) |
| `--fl-status-open-ink` | `#8ee0ac` | Tinta/borde de "abiertas" sobre navy (10.92:1) |

Estos cuatro son la **única** excepción a "un solo acento". El semáforo verde /
ámbar / gris es una convención universal que el usuario ya trae aprendida, y la
paleta de marca no tiene un tercer acento para codificar urgencia: el naranja
significa *inscribirse*, y si empieza a significar también *disponible* deja de
significar nada.

Reglas:
- **Solo para estado.** Nunca para branding, decoración ni jerarquía.
- **Nunca color-only.** El label textual ("Agotado") siempre acompaña al color.
- **Agotado es gris, no rojo.** No es un error del usuario, es indisponibilidad.
- Los tres primeros pasan AA con texto blanco encima *y* como tinta sobre crema
  o `--fl-surface`: el mismo token sirve para el relleno del listado y para el
  texto del detalle.

Reglas:
- El naranja es el **único** acento. No introducir segundos acentos.
- Texto de cuerpo ≥ 4.5:1; verificar los grises tenues sobre navy/crema (no bajar
  de los valores listados, que ya cumplen).
- Gris sobre fondo de color → usar un tono del propio hue, no gris neutro lavado.

## Typography

Tres familias, cada una con un trabajo (Google Fonts, cargadas **solo** en el
surface público):

- **Archivo Black** — display: H1/H2, números (countdown, precio, "10K"),
  wordmark. Siempre `text-transform: uppercase`. Tracking apretado en display
  (de `-1px` a `-6px` en los números gigantes); `line-height` muy bajo (`.8`–`.96`).
- **Archivo** (400–900) — cuerpo y UI general.
- **Space Mono** (400/700) — labels, eyebrows (`// Datos de la carrera`), nav,
  texto de CTA, chips y metadatos. Uppercase, `letter-spacing` 1–3px.

Escala display (clamp, fiel a la referencia):
- H1 hero: `clamp(42px, 6.6vw, 94px)`, `line-height:.92`, `letter-spacing:-1.5px`
- Número precio: `clamp(130px, 25vw, 310px)`, `line-height:.8`
- Countdown: `clamp(40px, 6.5vw, 68px)`
- H2 sección: `clamp(32px, 4.4vw, 56px)`
- Cuerpo: 15–16px, `line-height` 1.5–1.55, ancho máx ~360–440px

> Nota de gusto (impeccable): la referencia usa eyebrows mono en mayúsculas y un
> patrón a rayas/cuadros — normalmente "tells" de AI. Aquí son un **sistema de
> marca deliberado** (Space Mono consistente + bandera de meta), no scaffolding
> por reflejo: se respetan como voz de marca, no se replican como adorno vacío.

## Layout & Spacing

- Contenedor: `max-width: 1180px`, centrado.
- Padding horizontal de sección: `clamp(20px, 5vw, 56px)`.
- Padding vertical de sección: `clamp(40px, 6–8vw, 76–104px)` según peso.
- Grids responsivos sin breakpoints: `repeat(auto-fit, minmax(Npx, 1fr))`
  (hero 340px, facts 210px, categorías 240px, recorrido 300px).
- Mobile: todo colapsa a 1 columna por el auto-fit; verificar que el H1 no
  desborde en el viewport más chico.

## Components

- **CTA primario:** fondo `--fl-orange`, texto blanco, Space Mono 700 uppercase,
  `letter-spacing:1.5px`, padding ~16–17px / 26–30px, **esquinas rectas**, sufijo
  `→`. Es la acción a Eventrid (enlace saliente, `target="_blank"` + `rel`).
- **CTA secundario:** transparente, borde 1px `rgba(cream,.35)`, texto crema.
- **Card:** fondo blanco sobre crema, borde 1px `rgba(20,35,58,.08)`, padding 30px,
  esquinas rectas. Numerada con índice mono naranja (`01/02/03`) cuando es secuencia
  real (categorías). Sin cards anidadas.
- **Chip/badge:** borde 1px, Space Mono uppercase, padding ~9px/16px.
- **Eyebrow:** Space Mono uppercase con prefijo `//` sobre fondos claros, o color
  naranja sobre navy.

## Motifs (segunda lectura)

- **Bandera de meta a cuadros** (`repeating-linear-gradient` naranja/navy): franjas
  delgadas que enmarcan la sección de precio y como acento bajo el hero. Es EL
  símbolo de marca (línea de meta), no decoración.
- **Isotipo** (`components/BrandIsotype.astro`): la corona — tres picos y el
  corredor con los brazos en alto — trazada plana desde el emblema real. Va junto
  al wordmark en el header. Cada capa se pinta con tokens (`--iso-peaks`,
  `--iso-runner`), así que sirve sobre navy y sobre crema. Reemplaza al cuadrado
  naranja que hacía de mark provisional.
- **Emblema completo** (con la cinta y las letras, `assets/images/logo.png`): solo
  en el footer, sobre placa crema, como firma del organizador. A tamaño de header
  la cinta se come el logo.
- **Hatch diagonal** muy sutil (naranja a baja opacidad) en el hero.
- **Números gigantes** Archivo Black como anclas visuales (precio, countdown, 10K).

## Motion

Sobrio, fiel a la filosofía emil + impeccable:
- Header sticky con `backdrop-filter: blur` (único uso de blur, en elemento fijo).
- Countdown: actualización por segundo (única pieza con JS; island con `<script>`).
- Hover de CTA/cards: transición corta (`transform`/`opacity`, ease-out fuerte,
  <200ms); `:active` con `scale(0.97)`.
- Revelados de sección opcionales y sutiles (stagger corto), siempre sobre
  contenido ya visible.
- `@media (prefers-reduced-motion: reduce)`: sin movimiento; el countdown sigue
  actualizando el texto (es información, no decoración).

## Imagery

- Hero: foto vertical (`aspect-ratio: 4/5`) de corredores en La Paz, enmarcada en
  navy con gradiente inferior y handle `@FINISHLINEBOLIVIA`. **Pendiente de asset
  real**; hasta entonces, slot con tratamiento de marca (no SVG sketchy).
- Recorrido: mapa esquemático del circuito como SVG `polyline` (partida/meta).
- Frames de imagen con proporción fija y esquinas rectas, consistentes.
