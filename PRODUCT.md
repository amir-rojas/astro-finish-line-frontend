# Product

## Register

brand

## Users

Atletas y corredores (foco de esta primera entrega). Personas que buscan
descubrir e inscribirse al **próximo evento deportivo** de Finish Line
(running y disciplinas afines). Su contexto de uso es mayormente **móvil**:
llegan desde el celular, muchas veces con poco tiempo y conexión variable,
buscando una respuesta rápida —cuándo es el evento y cómo anotarse.

Audiencias futuras (fuera de alcance hoy, pero a no contradecir): organizadores
de eventos y público/espectadores que consultan resultados.

## Product Purpose

Finish Line **organiza** carreras: una serie propia (el Run Tour) más carreras
sueltas a lo largo del año, algunas co-organizadas. La superficie pública
(`surfaces/public`) es el sitio del organizador, no la landing de un evento: la
home presenta la próxima carrera y la identidad de la serie, `/calendario` lista
lo que viene, y cada carrera tiene su página de detalle. El éxito se mide por
atletas que llegan a inscribirse en la carrera que buscaban.

La inscripción **todavía no es nativa**: cada carrera enlaza a **Eventrid**
(plataforma externa de registro) desde su página de detalle. Es el flujo normal,
y la meta de producto es **traerlo adentro** — un módulo de pagos propio, sin
links externos. Hasta entonces, Eventrid.

El CTA de inscripción vive **en el detalle de cada carrera**, nunca en el header
ni en la home: con muchas carreras en agenda no existe "la" inscripción, existe
la de Renacer, la de San Silvestre, la del Desafío.

> Nota histórica: "La Paz, la ciudad que corre" (jul 2026) salió gratis porque la
> alcaldía cubrió los costos, y se inscribió por RunSignup. Fue un caso puntual,
> no un cambio de modelo.

## Brand Personality

**Atlética · urgente · precisa.** La marca respira deporte: adrenalina de
largada, cronómetro corriendo, "cada segundo cuenta". Voz directa y con punch,
editorial pero nunca fría; transmite que el evento es real e inminente y que
hay que decidirse ahora. Energía competitiva sin agresividad de gimnasio.

## Anti-references

- **AI-slop genérico:** sin badges de "estado activo", puntos parpadeantes,
  footers de versión, eyebrows mayúsculas trackeadas en cada sección, ni
  gradient text. (Rechazo explícito y recurrente del owner.)
- **Template de gimnasio/fitness:** evitar stock de gente sudando, neones,
  "no pain no gain", rojo agresivo y estética de cadena de gym.
- **SaaS corporativo frío:** evitar el molde startup genérico (héroe centrado,
  tres cards idénticas, ilustraciones planas, azul-púrpura).
- **Recargado / festivalero:** evitar saturación de colores, stickers y collage
  desordenado tipo flyer de evento masivo.

## Design Principles

1. **Cada segundo cuenta.** La urgencia y la precisión son el corazón de la
   marca. Nada decorativo que distraiga de la carrera que el atleta vino a
   encontrar; cada elemento acorta el camino hacia su inscripción.
2. **Mostrar, no afirmar.** El evento real (fecha, recorrido, atmósfera, lugar)
   vende más que los adjetivos. Imágenes y datos concretos antes que copy vacío.
3. **Honestidad sin teatro.** Sin estados falsos ni adornos de relleno; cada
   componente se gana su lugar. La sofisticación viene de la ejecución, no del
   decorado.
4. **Móvil es la línea de largada.** La mayoría llega desde el celular:
   rendimiento, legibilidad y jerarquía móvil son requisito, no ajuste posterior.
5. **Un solo siguiente paso, en el lugar correcto.** En cada página hay UNA
   acción evidente, y es la que corresponde a esa página: en la home, conocer la
   próxima carrera; en el calendario, elegir una; en el detalle, inscribirse. El
   header no lleva CTA — no hay una inscripción genérica que ofrecer. Las
   acciones secundarias se ven secundarias.

## Accessibility & Inclusion

Objetivo **WCAG 2.2 AA con énfasis móvil**:

- Contraste de texto de cuerpo ≥ 4.5:1; texto grande ≥ 3:1.
- Navegación completa por teclado con foco visible.
- `prefers-reduced-motion`: toda animación tiene alternativa (crossfade o
  transición instantánea); el movimiento nunca bloquea contenido.
- Targets táctiles cómodos y tipografía legible en pantallas chicas.
- Performance tratada como accesibilidad: carga rápida en conexiones móviles
  variables (coherente con Astro-first / ship-less-JS).
