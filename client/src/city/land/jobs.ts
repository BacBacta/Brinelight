/**
 * Sends the land's jobs (job.ts) to its worker, or runs them here, at once, where there is no worker (the tests) or it
 * failed to start. Each answer resolves the promise of its job.
 */
import { runJob, type Done, type Job, type LandDone, type LandJob, type ShoreDone, type ShoreJob } from "./job.js";

type Ask<J extends Job> = J extends Job ? Omit<J, "id"> : never;

let worker: Worker | null | undefined;
let next = 0;
const waiting = new Map<number, { job: Job; resolve: (d: Done) => void }>();

function workerOf(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === "undefined") return worker;
  try {
    const w = new Worker(new URL("./land.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<Done>) => {
      const w = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      w?.resolve(e.data);
    };
    // A worker that cannot start: its jobs, and every one after, run here.
    w.onerror = () => {
      worker = null;
      w.terminate();
      const left = [...waiting.values()];
      waiting.clear();
      for (const { job, resolve } of left) resolve(runJob(job));
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

function ask(job: Ask<Job>): Promise<Done> {
  const full = { ...job, id: ++next } as Job;
  const w = workerOf();
  if (!w) return Promise.resolve(runJob(full));
  return new Promise((resolve) => {
    waiting.set(full.id, { job: full, resolve });
    w.postMessage(full);
  });
}

/** A land, built away from the display. */
export const landJob = (job: Ask<LandJob>): Promise<LandDone> => ask(job) as Promise<LandDone>;
/** A land, built here and now (before the city's first image: no frame to hold). */
export const landJobNow = (job: Ask<LandJob>): LandDone => runJob({ ...job, id: ++next } as LandJob) as LandDone;
/** The shore's distances, measured away from the display; `grid` when the land changed. */
export const shoreJob = (job: Ask<ShoreJob>): Promise<ShoreDone> => ask(job) as Promise<ShoreDone>;
