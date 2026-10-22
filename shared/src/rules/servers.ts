/**
 * The game servers and their calendars (week 8, task 5). A city belongs to one server, set when the city is made; its
 * Mists, its Leviathan's hunts and the reset of its daily tasks follow that server's hours, read on the city's clock.
 * The calendar is in the rules, not in a setting, because the client reads the same one to draw its countdowns.
 *
 * Hours are in UTC, with no summer time. Today there is one server, `s1`. A change of a server's hours is deployed
 * outside its Mists and hunts: one going on would end early (docs/deploy.md, "Update the game").
 */

/** A server's calendar: the hours (UTC) its Mists and its hunts start, and the hour its day of daily tasks begins. */
export type ServerCalendar = { mistHours: readonly number[]; huntHours: readonly number[]; resetHour: number };

/**
 * The servers. `s1`: the hours of week 7, unchanged: the Mist at 04:00, 12:00 and 20:00, the Leviathan at 13:00 and
 * 19:00, the day's reset at 00:00.
 */
export const SERVERS = {
  s1: { mistHours: [4, 12, 20], huntHours: [13, 19], resetHour: 0 },
} as const satisfies Record<string, ServerCalendar>;

export type ServerId = keyof typeof SERVERS;

/** The server a new city goes to. */
export const DEFAULT_SERVER: ServerId = "s1";

export const isServerId = (v: unknown): v is ServerId => typeof v === "string" && Object.hasOwn(SERVERS, v);

/** A server's calendar. */
export const calendarOf = (server: ServerId): ServerCalendar => SERVERS[server];
