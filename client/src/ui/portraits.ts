import type { CaptainId } from "@brinelight/shared";

/** The sizes each captain's portrait is served at: 96 for lists, 512 for the captain's sheet. */
export const PORTRAIT_SIZES = [96, 512] as const;
export type PortraitSize = (typeof PORTRAIT_SIZES)[number];

/**
 * The address of a captain's painted portrait (client/public/captains, made from assets/captains by
 * make-portraits.py). The prototype's old portraits stay in the prototype.
 */
export const captainPortrait = (id: CaptainId, size: PortraitSize): string => `${import.meta.env.BASE_URL}captains/${id}-${size}.webp`;
