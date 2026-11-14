/** Starts something and returns how to stop it. */
export type Run = () => () => void;

/**
 * A budget of `cap` things running at once. `take(key, run)` runs `run` now if there is room, or when a turn comes up
 * (the longest-waiting first); the function it returns gives the turn back, stopping what ran or leaving the queue.
 */
export function budget(cap: number): (key: object, run: Run) => () => void;
