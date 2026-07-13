// Regla única de "¿esta carrera ya pasó?", compartida por la agenda de la home
// y el listado /calendario. Vivía dentro de `home/format.ts`; al aparecer un
// segundo consumidor se extrae acá para que la regla no pueda divergir.
//
// La comparación es a granularidad de DÍA en `America/La_Paz`: una carrera que
// se corre hoy sigue siendo "próxima" hasta que termina el día boliviano, sin
// importar la hora del build ni el timezone de la máquina que buildea.

const RACE_TIMEZONE = 'America/La_Paz';

/** "2026-07-12" — hoy en Bolivia. Formato ISO para comparar como string. */
export function todayInRaceTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: RACE_TIMEZONE }).format(now);
}

/** "2026-07-12" — el día de la carrera. Getters UTC porque `date` viene de una
 *  fecha sin hora de Strapi: leerla en horario local correría el día. */
export function raceDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ¿Esta FECHA ya quedó atrás en Bolivia? Es una regla sobre una fecha suelta —el
 *  plazo de inscripción, por ejemplo—, NO sobre una carrera: para eso está
 *  `hasRaced()`, que además mira el estado editorial. */
export function isPastRace(date: Date, now: Date = new Date()): boolean {
  return raceDayKey(date) < todayInRaceTimezone(now);
}

/** Lo mínimo que la regla necesita saber de una carrera. Estructural a propósito:
 *  `race-date.ts` no puede importar `RaceEvent` porque `content/events.ts` importa
 *  de acá — sería un ciclo. */
export interface RaceTiming {
  date: Date;
  status?: 'proximo' | 'inscripciones_abiertas' | 'cerrado' | 'finalizado';
}

/**
 * ¿La carrera YA SE CORRIÓ? Regla ÚNICA del sitio. Dos señales, en este orden:
 *
 *  1. `status === 'finalizado'`: override editorial, y GANA sobre la fecha incluso
 *     el mismo día. Es la única señal confiable de "ya largó", porque el sitio es
 *     estático: el `now` de abajo es la hora del BUILD, no la del visitante, así
 *     que nada se voltea solo a las 08:00 de la mañana de la carrera. Marcar la
 *     carrera como finalizada en su JSON ES lo que dispara el deploy — por eso el
 *     estado editorial es el contrato, y la fecha es apenas la red de contención.
 *  2. Si no, el día ya quedó atrás en Bolivia. Best-effort: solo se actualiza
 *     cuando hay un build (ver `home-ssg-staleness`).
 *
 * NO contesta "¿me puedo inscribir?". Esa es otra pregunta y vive en las
 * modalidades (`calendar/format.ts`). Mezclarlas es lo que hizo que una carrera
 * ya corrida siguiera ofreciendo su botón de inscripción.
 */
export function hasRaced(race: RaceTiming, now: Date = new Date()): boolean {
  if (race.status === 'finalizado') return true;
  return isPastRace(race.date, now);
}

/** Carreras que todavía no se corrieron, preservando el orden recibido
 *  (`getEvents()` ya devuelve `fecha:asc`). */
export function upcomingRaces<T extends RaceTiming>(races: T[], now: Date = new Date()): T[] {
  return races.filter((race) => !hasRaced(race, now));
}

/** Carreras YA CORRIDAS, de la más reciente a la más vieja — el orden en que se
 *  cuenta lo que pasó ("Así se vivió"). Misma regla que `upcomingRaces`, del otro
 *  lado: una carrera está en exactamente una de las dos listas, nunca en ambas ni
 *  en ninguna. */
export function pastRaces<T extends RaceTiming>(races: T[], now: Date = new Date()): T[] {
  return races.filter((race) => hasRaced(race, now)).reverse();
}
