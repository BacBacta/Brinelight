/**
 * The land's worker: builds the land won on the sea and the shore's foam away from the display, so that a raft moored,
 * a plot flooded or mended never holds a frame (owner, on the S22: "Land built in 122.7 ms", about 7 frames).
 */
import { runJob, transfers, type Job } from "./job.js";

const post = self as unknown as { postMessage(message: unknown, transfer: Transferable[]): void };
self.onmessage = (e: MessageEvent<Job>) => {
  const done = runJob(e.data);
  post.postMessage(done, transfers(done));
};
