/** npm run night: Nights 1 to 5 played by the bots over 20 seeds, as a table to paste in the backlog. Changes nothing. */
import { campaignTable, summarize, toTable } from "./simulate.js";

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
console.log(toTable(summarize(SEEDS)));
console.log("\nA new city, Night after Night, its loot spent as the guide says:\n");
console.log(campaignTable(SEEDS));
