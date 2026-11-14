export interface VideoOptions {
	/** Pixels (made even: H.264 wants it). */
	width: number;
	/** Pixels (made even). */
	height: number;
	/** Frames a second. Default 30. */
	fps?: number;
	/** Seconds. */
	duration: number;
	/** Draws the frame at `t` seconds onto the canvas. */
	draw: (t: number, canvas: HTMLCanvasElement) => Promise<void> | void;
	/** Called after each frame with the share done, 0–1. */
	progress?: (done: number) => void;
	/** Stops the recording when it aborts. */
	signal?: AbortSignal;
}

/** A finished video: the file, its extension and its media type. */
export interface Video {
	blob: Blob;
	ext: 'mp4' | 'webm';
	type: string;
}

/** The parts of mediabunny `pickFormat` uses. */
export interface VideoFormats {
	getFirstEncodableVideoCodec(codecs: string[], size: { width: number; height: number }): Promise<string | null>;
	Mp4OutputFormat: new (options: { fastStart: 'in-memory' }) => unknown;
	WebMOutputFormat: new () => unknown;
}

/** Whether this browser can encode video at all (WebCodecs). */
export function canRecord(): boolean;

/** A size made even, as H.264 wants it (an odd side loses its last pixel). */
export function evenSize(width: number, height: number): { width: number; height: number };

/** The first container and codec the browser can encode at `size`: MP4 with H.264, else WebM with VP9, VP8 or AV1. Rejects when it can encode none. */
export function pickFormat<M extends VideoFormats>(mediabunny: M, size: { width: number; height: number }): Promise<{ codec: string; format: InstanceType<M['Mp4OutputFormat']> | InstanceType<M['WebMOutputFormat']> }>;

/** Steps through `frames` frames in order at `fps`, calling `frame(t, dt)` for each and `progress` after it; rejects with an `AbortError` once `signal` aborts. */
export function eachFrame(o: { frames: number; fps: number; signal?: AbortSignal; progress?: (done: number) => void }, frame: (t: number, dt: number) => Promise<void>): Promise<void>;

/** Records a video frame by frame (WebCodecs, muxed by the optional peer mediabunny): MP4 (H.264) where the browser can, else WebM. */
export function record(o: VideoOptions): Promise<Video>;
