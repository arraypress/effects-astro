import type { Reading } from './audio-meter.js';

/** What an effect reads each frame while sound plays. */
export interface AudioReading extends Reading {
	/** How much to follow the sound, 0–1: eases in as playback starts and out after it stops. */
	on: number;
	/** How far through the track, 0–1, or -1 when its length is unknown (a stream). */
	progress: number;
}

/** The sound an effect follows. */
export interface AudioSignal {
	/** The sound this frame, or null when nothing it follows has played lately (the effect runs as without sound, at no cost). */
	read(now: number, dt: number): AudioReading | null;
	/** Stops listening. */
	stop(): void;
}

/** Where an effect's sound comes from: `'page'` for whatever plays, or a CSS selector for an `<audio>`/`<video>` or a player's container (a WaveformPlayer). */
export type AudioSource = 'page' | (string & {});

/** Whether audio from `src` can be read by Web Audio: same origin, a blob or data URL, or fetched with CORS (`crossOrigin` set). */
export function readable(src: string, crossOrigin: string | null, origin: string): boolean;

/** Starts listening to the sound an effect follows. Read it each frame; stop it with the effect. */
export function audioSignal(source: AudioSource): AudioSignal;
