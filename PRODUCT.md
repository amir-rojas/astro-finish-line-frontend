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

Finish Line es una plataforma de **inscripción a eventos deportivos**. Esta
superficie pública (`surfaces/public`) es la landing que **promociona el
próximo evento** y empuja a la única acción que importa hoy: **inscribirse**.

En esta entrega la inscripción **no es nativa**: el CTA principal **redirige a
Eventrid** (plataforma externa de registro). El éxito de la landing se mide por
cuántos atletas hacen clic e inician la inscripción en Eventrid.

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
   marca. Nada decorativo que distraiga del próximo evento ni de su CTA; cada
   elemento empuja hacia la inscripción.
2. **Mostrar, no afirmar.** El evento real (fecha, recorrido, atmósfera, lugar)
   vende más que los adjetivos. Imágenes y datos concretos antes que copy vacío.
3. **Honestidad sin teatro.** Sin estados falsos ni adornos de relleno; cada
   componente se gana su lugar. La sofisticación viene de la ejecución, no del
   decorado.
4. **Móvil es la línea de largada.** La mayoría llega desde el celular:
   rendimiento, legibilidad y jerarquía móvil son requisito, no ajuste posterior.
5. **Un solo siguiente paso.** La conversión —inscribirse vía Eventrid— está
   siempre clara, única e inconfundible. Las acciones secundarias se ven
   secundarias.

## Accessibility & Inclusion

Objetivo **WCAG 2.2 AA con énfasis móvil**:

- Contraste de texto de cuerpo ≥ 4.5:1; texto grande ≥ 3:1.
- Navegación completa por teclado con foco visible.
- `prefers-reduced-motion`: toda animación tiene alternativa (crossfade o
  transición instantánea); el movimiento nunca bloquea contenido.
- Targets táctiles cómodos y tipografía legible en pantallas chicas.
- Performance tratada como accesibilidad: carga rápida en conexiones móviles
  variables (coherente con Astro-first / ship-less-JS).
