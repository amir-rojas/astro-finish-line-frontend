/**
 * date-format.ts — primitivas de formato de fecha, compartidas por los features
 * del surface público.
 *
 * Existe porque la MISMA fecha larga ("Domingo 16 / Ago / 2026") la muestran dos
 * features distintos: el hero de la home y la ficha del detalle (`calendar`).
 * Cuando el detalle la necesitó, importó `heroDate` desde `features/home/format`
 * — un feature colgándose de otro, que es justo lo que la división por features
 * evita. Y dejó al calendario con un `heroDate` propio, de otro formato
 * ("16 / AGO / 2026"), sin un solo consumidor: dos funciones con el mismo nombre,
 * y editar la equivocada no hacía nada.
 *
 * Lo que es de los dos, vive acá. Lo que es de uno, se queda en su feature
 * (`recapDate` es de la home; `longDate` es del calendario).
 *
 * Locale es-BO y SIEMPRE UTC: las fechas de carrera son fechas civiles, no
 * instantes. Leerlas en el horario local de quien hace el build corre el día.
 */
const LOCALE = 'es-BO';

/** Intl no capitaliza los nombres de mes/día en español ("domingo", "ago"). */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Una parte de la fecha (día, mes, día de semana) en es-BO y en UTC. */
export function datePart(date: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: 'UTC' }).format(date);
}

/**
 * Fecha ISO de la largada: "2026-08-16T08:00:00-04:00".
 *
 * Con hora conocida devuelve el INSTANTE (fecha + hora + huso), que es lo que
 * necesitan el countdown y el `startDate` del JSON-LD. Sin hora devuelve la fecha
 * pelada ("2026-08-16"): schema.org la acepta, y es más honesto que inventar una
 * largada a medianoche.
 */
export function startDateTimeISO(date: Date, startTime?: string, tz = '-04:00'): string {
  const ymd = date.toISOString().slice(0, 10);
  return startTime ? `${ymd}T${startTime}:00${tz}` : ymd;
}

/** "Domingo 16 / Ago / 2026" — la fecha completa de una carrera. El día de la
 *  semana va primero porque es el dato con el que el corredor decide si puede ir. */
export function weekdayDate(date: Date): string {
  const wd = capitalize(datePart(date, { weekday: 'long' }));
  const day = datePart(date, { day: 'numeric' });
  const mon = capitalize(datePart(date, { month: 'short' }).replace('.', ''));
  return `${wd} ${day} / ${mon} / ${date.getUTCFullYear()}`;
}
