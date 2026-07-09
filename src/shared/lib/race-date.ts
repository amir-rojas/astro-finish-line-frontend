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

/** Una carrera es "pasada" solo cuando su día quedó atrás en Bolivia. */
export function isPastRace(date: Date, now: Date = new Date()): boolean {
  return raceDayKey(date) < todayInRaceTimezone(now);
}

/** Filtra las carreras que todavía no pasaron, preservando el orden recibido
 *  (`getEvents()` ya devuelve `fecha:asc`). */
export function upcomingRaces<T extends { date: Date }>(races: T[], now: Date = new Date()): T[] {
  const today = todayInRaceTimezone(now);
  return races.filter((race) => raceDayKey(race.date) >= today);
}
