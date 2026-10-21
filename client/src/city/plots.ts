import type { BuildingId } from "@brinelight/shared";
import { ERA_PLOTS } from "./eraPlots.js";

export { ERA_PLOTS } from "./eraPlots.js";

/** The plot a building is shown on (eraPlots.ts): display only, the cities' data know no plot. */
export const plotOf = (id: BuildingId): readonly [q: number, r: number] => ERA_PLOTS[id];
