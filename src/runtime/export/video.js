/**
 * @module @arraypress/effects-astro/export/video
 *
 * Frames to a video file in the browser: each frame drawn onto a canvas
 * by the caller, encoded with WebCodecs and muxed by mediabunny (an
 * optional peer dependency, loaded only when a recording starts). MP4
 * (H.264) where the browser can encode it, else WebM (VP9, VP8 or AV1).
 * Frames are added one at a time with exact timestamps, so a slow frame
 * never stutters the result.
 */

/**
 * @typedef {object} VideoOptions
 * @property {number} width Pixels (made even: H.264 wants it).
 * @property {number} height Pixels (made even).
 * @property {number} [fps] Frames a second. Default 30.
 * @property {number} duration Seconds.
 * @property {(t: number, canvas: HTMLCanvasElement) => Promise<void> | void} draw Draws the frame at `t` seconds onto the canvas.
 * @property {(done: number) => void} [progress] Called after each frame with the share done, 0–1.
 * @property {AbortSignal} [signal] Stops the recording when it aborts.
 */

/** @typedef {{ blob: Blob, ext: 'mp4' | 'webm', type: string }} Video A finished video: the file, its extension and its media type. */

/**
 * Whether this browser can encode video at all (WebCodecs).
 *
 * @returns {boolean} Whether it can.
 */
export const canRecord = () => typeof window !== 'undefined' && 'VideoEncoder' in window;

/**
 * A size made even, as H.264 wants it (an odd side loses its last pixel).
 *
 * @param {number} width Pixels.
 * @param {number} height Pixels.
 * @returns {{ width: number, height: number }} The even size.
 */
export const evenSize = (width, height) => ({ width: width - (width % 2), height: height - (height % 2) });

/**
 * The first container and codec this browser can encode at a size: MP4
 * with H.264, else WebM with VP9, VP8 or AV1.
 *
 * @param {any} mb The mediabunny module (or anything with its `getFirstEncodableVideoCodec`, `Mp4OutputFormat` and `WebMOutputFormat`).
 * @param {{ width: number, height: number }} size The video's size.
 * @returns {Promise<{ codec: string, format: any }>} The codec and an output format for it.
 * @throws {Error} When the browser can encode none of them.
 */
export async function pickFormat(mb, size) {
	const avc = await mb.getFirstEncodableVideoCodec(['avc'], size);
	if (avc) return { codec: avc, format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) };
	const web = await mb.getFirstEncodableVideoCodec(['vp9', 'vp8', 'av1'], size);
	if (web) return { codec: web, format: new mb.WebMOutputFormat() };
	throw new Error('export: this browser cannot encode video');
}

/**
 * Steps through a recording's frames in order, one at a time, each at its
 * exact time; stops with an `AbortError` as soon as the signal aborts.
 *
 * @param {{ frames: number, fps: number, signal?: AbortSignal, progress?: (done: number) => void }} o How many frames, at what rate, a signal to stop at, and what to tell after each.
 * @param {(t: number, dt: number) => Promise<void>} frame Makes the frame at `t` seconds, `dt` long.
 * @returns {Promise<void>} Once every frame is made.
 */
export async function eachFrame({ frames, fps, signal, progress }, frame) {
	for (let i = 0; i < frames; i++) {
		if (signal?.aborted) throw new DOMException('Recording stopped', 'AbortError');
		await frame(i / fps, 1 / fps);
		progress?.((i + 1) / frames);
	}
}

/**
 * Records a video, frame by frame.
 *
 * @param {VideoOptions} o Its size, rate and length, and how to draw a frame.
 * @returns {Promise<Video>} The video.
 * @throws {Error} When the browser cannot encode video, or (an `AbortError`) when it was stopped.
 */
export async function record(o) {
	const mb = await import('mediabunny');
	const { Output, BufferTarget, CanvasSource, QUALITY_HIGH } = mb;
	const fps = o.fps ?? 30;
	const size = evenSize(o.width, o.height);
	const { codec, format } = await pickFormat(mb, size);
	const canvas = document.createElement('canvas');
	canvas.width = size.width;
	canvas.height = size.height;
	const target = new BufferTarget();
	const output = new Output({ format, target });
	const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
	output.addVideoTrack(source, { frameRate: fps });
	await output.start();
	try {
		await eachFrame({ frames: Math.round(o.duration * fps), fps, signal: o.signal, progress: o.progress }, async (t, dt) => {
			await o.draw(t, canvas);
			await source.add(t, dt);
		});
		await output.finalize();
	} catch (e) {
		await output.cancel().catch(() => {});
		throw e;
	}
	return { blob: new Blob([/** @type {ArrayBuffer} */ (target.buffer)], { type: format.mimeType }), ext: format.fileExtension.slice(1), type: format.mimeType };
}
