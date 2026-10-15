/**
 * Échelle de temps.
 *
 * Le prototype tournait en « secondes prototype ». Le vrai jeu les convertit :
 * 1 seconde prototype = 6 minutes réelles (TIME_SCALE = 360).
 * Toutes les durées des règles sont exprimées en secondes RÉELLES, et tous les débits PAR HEURE réelle.
 * Pour le développement, le serveur peut appliquer un facteur d'accélération (DEV_SPEED) sans toucher aux règles.
 */
export const TIME_SCALE = 360;

/** Convertit une durée prototype (s) en secondes réelles. */
export const protoSeconds = (s: number): number => s * TIME_SCALE;

/** Convertit un débit prototype (par seconde) en débit par heure réelle. */
export const protoRatePerHour = (perProtoSecond: number): number => (perProtoSecond * 3600) / TIME_SCALE;

export const HOUR = 3600;
export const DAY = 24 * HOUR;
