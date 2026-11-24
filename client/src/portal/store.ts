/**
 * The portal edition (Hold the Light, docs/design/hold-the-light.md) keeps everything on the device under its own key:
 * the Brinelight on Solana and the portal never read each other's city, sounds or news, even from the same address.
 */
/** The browser's store, or one in memory: what the game writes and the portal also removes. */
export type PortalStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const PORTAL_KEY = "brinelight-portal-v1";

/** The device's store, with every key put under `brinelight-portal-v1/`. None when there is no store. */
export function portalStore(store: PortalStore | null): PortalStore | null {
  if (!store) return null;
  const key = (k: string) => `${PORTAL_KEY}/${k}`;
  return {
    getItem: (k) => store.getItem(key(k)),
    setItem: (k, v) => store.setItem(key(k), v),
    removeItem: (k) => store.removeItem(key(k)),
  };
}
