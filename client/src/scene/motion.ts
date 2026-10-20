/** The device asks for less motion ("reduce motion" in its settings): the island's life stands still (owner, meeting 4). */
export const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
