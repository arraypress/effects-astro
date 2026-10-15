/**
 * @module @arraypress/effects-astro/audio
 *
 * The sound playing on the page, as a live signal effects can draw with:
 * its level, bass, mid and treble, a kick on each beat, a spectrum and a
 * waveform (./audio-meter.js does the arithmetic). An effect asks for it
 * with `audioSignal(source)`, where the source is a CSS selector for an
 * `<audio>` or `<video>`, or for a player's container (a WaveformPlayer,
 * whose `<audio>` is not in the page), or `'page'` for whatever plays.
 *
 * How it hears:
 *
 *   - Media in the page are seen by their own `play`, `pause` and
 *     `timeupdate` events, caught on the document. A WaveformPlayer's
 *     `<audio>` is not in the page: it is reached through the player's
 *     `waveformplayer:play`, `:pause`, `:ended`, `:timeupdate` and `:destroy`
 *     events, whose `detail.player.audio` it is. `timeupdate` lets an effect
 *     that mounts mid-track join in.
 *   - One AudioContext for the page, and one analyser per media element,
 *     shared by every effect following it. `createMediaElementSource` can be
 *     called once per element, ever, and from then on the element's sound
 *     goes through the context, so the source stays connected to the
 *     speakers as well as the analyser, and the context is woken whenever
 *     the element plays, by a listener on the element itself that outlives
 *     every effect.
 *   - Browsers start an AudioContext only after the visitor has interacted
 *     with the page. It is made (or woken) on the first press or key while
 *     an effect is listening, and an element is only routed through it once
 *     it runs, so a context that cannot start never silences anything: the
 *     sound plays as before and the effects keep their own motion.
 *   - Audio from another origin can only be read with CORS: the element
 *     needs `crossorigin="anonymous"` (WaveformPlayer: `crossOrigin` or
 *     `data-cross-origin`) and the server an `Access-Control-Allow-Origin`
 *     header. Without both, routing it would silence it, so it is left alone
 *     and a warning says why. (A same-origin URL that redirects to another
 *     origin cannot be told apart beforehand; serve audio from where it is.)
 *
 * What it costs: nothing until something plays. No context is made before
 * the visitor first interacts, the analysers are read only while their
 * element plays (once a frame, however many effects follow it), and the
 * context is suspended a few seconds after the last sound stops.
 */

import { createMeter } from './audio-meter.js';

/**
 * @typedef {import('./audio-meter.js').Reading} Reading
 */

/**
 * What an effect reads each frame while sound plays: the meter's reading,
 * how far to follow it, and where the track is.
 *
 * @typedef {Reading & { on: number, progress: number }} AudioReading
 *   `on` is how much the effect should follow the sound, 0–1: it eases in as
 *   playback starts and out after it stops, so the effect can blend from its
 *   own motion and back. `progress` is how far through the track, 0–1, or -1
 *   when its length is unknown (a stream).
 */

/**
 * @typedef {object} AudioSignal
 * @property {(now: number, dt: number) => AudioReading | null} read The sound
 *   this frame, or null when nothing it follows has played lately: the effect
 *   then runs as it would without sound, at no cost.
 * @property {() => void} stop Stops listening.
 */

/**
 * One media element routed through the context.
 *
 * @typedef {object} Tap
 * @property {AnalyserNode} analyser Its analyser.
 * @property {Uint8Array<ArrayBuffer>} freq Its spectrum, read each frame.
 * @property {Uint8Array<ArrayBuffer>} time Its waveform, read each frame.
 * @property {import('./audio-meter.js').Meter} meter What the bytes mean.
 * @property {number} stamp The frame last read (its time), so effects sharing it read it once.
 */

/**
 * A media element heard playing: the element whose events told of it (the
 * media itself, or a player's container), and when it started.
 *
 * @typedef {object} Heard
 * @property {Element} owner The element its events came from.
 * @property {number} at When it was first heard, ms.
 */

/**
 * One effect listening.
 *
 * @typedef {object} Listener
 * @property {(media: HTMLMediaElement, owner: Element) => boolean} follows Whether it follows a media element.
 */

/** The analyser's FFT size: 1024 bins, about 21 Hz each at 44.1 kHz. */
const FFT = 2048;
/** Its decibel range, mapped to the spectrum's bytes 0–255. */
const MIN_DB = -90;
const MAX_DB = -20;
/** Seconds `on` takes to ease in when playback starts, and out after it stops. */
const ON_RISE = 0.25;
const ON_FALL = 0.35;
/** How long after the last sound stops the context is suspended, ms. */
const IDLE = 4000;
/** The longest frame the meter steps, seconds: after a stall it resumes, not jumps. */
const MAX_DT = 0.05;
/** WaveformPlayer's events: those that mean its audio is playing, and those that mean it has stopped. */
const PLAYER_ON = ['waveformplayer:play', 'waveformplayer:timeupdate'];
const PLAYER_OFF = ['waveformplayer:pause', 'waveformplayer:ended', 'waveformplayer:destroy'];
/** Media events, caught on the document (they do not bubble): playing, and stopped. */
const MEDIA_ON = ['play', 'timeupdate'];
const MEDIA_OFF = ['pause', 'ended', 'emptied'];
/** Presses and keys that let a context start. */
const GESTURES = ['pointerdown', 'keydown'];

/** @type {AudioContext | null} */
let context = null;
/** Every element routed through the context: it stays routed for good, so it is held for good. */
/** @type {Map<HTMLMediaElement, Tap>} */
const taps = new Map();
/** @type {Map<HTMLMediaElement, Heard>} */
const heard = new Map();
/** @type {Set<Listener>} */
const listeners = new Set();
/** Sources already warned about (cross-origin, or taken by another context). */
const warned = new Set();
let idleTimer = 0;
/** True while a context is being asked to start, so it is asked once. */
let starting = false;

/**
 * Whether audio from a URL can be read by Web Audio: same origin, a blob or
 * data URL, or fetched with CORS (`crossorigin` set: if the server had not
 * allowed it, the element would not have played).
 *
 * @param {string} src The element's current source URL ('' for a stream set as `srcObject`).
 * @param {string | null} crossOrigin The element's `crossOrigin`.
 * @param {string} origin The page's origin.
 * @returns {boolean} Whether it can be read.
 */
export function readable(src, crossOrigin, origin) {
	if (!src || crossOrigin !== null) return true;
	try {
		const url = new URL(src, origin);
		return url.protocol === 'blob:' || url.protocol === 'data:' || url.origin === origin;
	} catch {
		return false;
	}
}

/**
 * Says once, per source, why some audio cannot be followed.
 *
 * @param {string} key What it is about, so it is said once.
 * @param {string} message Why.
 */
function warnOnce(key, message) {
	if (warned.has(key)) return;
	warned.add(key);
	console.warn('[effects-astro]', message);
}

/**
 * The page's AudioContext: made on first use, but only once the visitor has
 * interacted (before that, browsers would refuse it and log a warning).
 *
 * @returns {AudioContext | null} The context, or null for now.
 */
function getContext() {
	if (context) return context;
	const Context = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
	const active = navigator.userActivation?.hasBeenActive ?? true;
	if (!Context || !active) return null;
	context = /** @type {AudioContext} */ (new Context());
	return context;
}

/**
 * Whether anything routed through the context is playing.
 *
 * @returns {boolean} True while a tapped element plays.
 */
function sounding() {
	for (const media of taps.keys()) if (!media.paused) return true;
	return false;
}

/**
 * Suspends the context a while after the last sound stops (it is woken
 * when one plays again), and forgets elements no longer playing.
 */
function idleSoon() {
	clearTimeout(idleTimer);
	idleTimer = window.setTimeout(() => {
		for (const media of heard.keys()) if (media.paused) heard.delete(media);
		if (context?.state === 'running' && !sounding()) context.suspend();
	}, IDLE);
}

/**
 * Wakes the context for an element routed through it that has started to
 * play: its sound goes nowhere else. Warns if it now plays audio that
 * cannot be read, which Web Audio will silence.
 *
 * @param {Event} e The element's `play`.
 */
function wake(e) {
	const media = /** @type {HTMLMediaElement} */ (e.target);
	const src = media.currentSrc || media.src;
	if (!readable(src, media.crossOrigin, location.origin)) {
		warnOnce(src, `The audio at ${src} is on another origin without CORS, and its element is already routed through Web Audio, so it plays silent. Serve it with Access-Control-Allow-Origin and set crossorigin="anonymous" on the element (WaveformPlayer: crossOrigin: 'anonymous' or data-cross-origin="anonymous").`);
	}
	if (context?.state !== 'running') context?.resume();
	idleSoon();
}

/**
 * Routes a playing element through the context to an analyser (and on to
 * the speakers), if it can be read and is wanted, once the context runs.
 *
 * @param {HTMLMediaElement} media The element.
 */
function tap(media) {
	if (taps.has(media)) {
		if (context?.state !== 'running') context?.resume();
		idleSoon();
		return;
	}
	const src = media.currentSrc || media.src;
	if (!readable(src, media.crossOrigin, location.origin)) {
		warnOnce(src, `The audio at ${src} is on another origin without CORS, so it cannot be followed (routing it through Web Audio would silence it). Serve it with Access-Control-Allow-Origin and set crossorigin="anonymous" on the element (WaveformPlayer: crossOrigin: 'anonymous' or data-cross-origin="anonymous"). The effect keeps its own motion.`);
		return;
	}
	const ctx = getContext();
	if (!ctx) return;
	if (ctx.state !== 'running') {
		// Routed only once the context runs, so a context that cannot start
		// never silences the element; it is tried again on the next press.
		if (starting) return;
		starting = true;
		ctx.resume().then(
			() => {
				starting = false;
				if (ctx.state === 'running' && !media.paused) tap(media);
			},
			() => {
				starting = false;
			},
		);
		return;
	}
	let source;
	try {
		source = ctx.createMediaElementSource(media);
	} catch {
		warnOnce(`taken:${src}`, `The audio at ${src} is already routed through another AudioContext, so it cannot be followed.`);
		return;
	}
	const analyser = ctx.createAnalyser();
	analyser.fftSize = FFT;
	analyser.minDecibels = MIN_DB;
	analyser.maxDecibels = MAX_DB;
	analyser.smoothingTimeConstant = 0.6;
	source.connect(ctx.destination);
	source.connect(analyser);
	taps.set(media, {
		analyser,
		freq: new Uint8Array(analyser.frequencyBinCount),
		time: new Uint8Array(FFT),
		meter: createMeter(),
		stamp: -1,
	});
	// The element plays only through the context now, listened to or not.
	media.addEventListener('play', wake);
	media.addEventListener('pause', idleSoon);
	idleSoon();
}

/**
 * Notes an element playing, and taps it if an effect follows it.
 *
 * @param {HTMLMediaElement} media The element.
 * @param {Element} owner The element its events came from.
 * @param {boolean} [started=false] It has just started (not a `timeupdate`): the latest to start is the one followed.
 */
function playing(media, owner, started = false) {
	if (started || !heard.has(media)) heard.set(media, { owner, at: performance.now() });
	for (const listener of listeners) {
		if (listener.follows(media, owner)) {
			tap(media);
			return;
		}
	}
}

/**
 * A media element's events, caught on the document.
 *
 * @param {Event} e The event.
 */
function onMedia(e) {
	const media = e.target;
	if (!(media instanceof HTMLMediaElement)) return;
	if (MEDIA_ON.includes(e.type)) {
		if (!media.paused) playing(media, media, e.type === 'play');
	} else {
		idleSoon();
	}
}

/**
 * A WaveformPlayer's events: its `<audio>` is `detail.player.audio`.
 *
 * @param {Event} e The event.
 */
function onPlayer(e) {
	const media = /** @type {CustomEvent} */ (e).detail?.player?.audio;
	if (!(media instanceof HTMLMediaElement) || !(e.target instanceof Element)) return;
	if (PLAYER_ON.includes(e.type)) {
		if (!media.paused) playing(media, e.target, e.type === 'waveformplayer:play');
	} else {
		if (e.type === 'waveformplayer:destroy') heard.delete(media);
		idleSoon();
	}
}

/**
 * A press or a key: the moment a context may start. Makes or wakes it, and
 * taps whatever is already playing that an effect follows.
 */
function onGesture() {
	const ctx = getContext();
	if (!ctx) return;
	if (ctx.state !== 'running') {
		ctx.resume().then(() => {
			for (const [media, { owner }] of heard) if (!media.paused) playing(media, owner);
		}, () => {});
	}
	idleSoon();
}

/**
 * Starts or stops hearing the page: its media and players' events, and the
 * presses and keys that let a context start.
 *
 * @param {boolean} on Whether to listen.
 */
function hearPage(on) {
	const method = on ? 'addEventListener' : 'removeEventListener';
	for (const type of [...MEDIA_ON, ...MEDIA_OFF]) document[method](type, onMedia, true);
	for (const type of [...PLAYER_ON, ...PLAYER_OFF]) document[method](type, onPlayer);
	for (const type of GESTURES) document[method](type, onGesture, { capture: true, passive: true });
}

/**
 * Which media elements a source follows.
 *
 * @param {string} source `'page'`, or a CSS selector for a media element or a player's container.
 * @returns {(media: HTMLMediaElement, owner: Element) => boolean} The test.
 */
function follower(source) {
	if (source === 'page') return () => true;
	/** @type {WeakMap<HTMLMediaElement, boolean>} */
	const known = new WeakMap();
	return (media, owner) => {
		let yes = known.get(media);
		if (yes === undefined) {
			let target = null;
			try {
				target = document.querySelector(source);
			} catch {
				warnOnce(`selector:${source}`, `audio="${source}" is not a CSS selector; use one, or "page".`);
			}
			yes = !!target && (target === media || target.contains(owner) || owner.contains(target));
			// Not found yet may mean not rendered yet: asked again next time.
			if (target) known.set(media, yes);
		}
		return yes;
	};
}

/**
 * Starts listening to the sound an effect follows.
 *
 * @param {string} source `'page'` for whatever plays, or a CSS selector for
 *   an `<audio>`/`<video>` or a player's container (a WaveformPlayer).
 * @returns {AudioSignal} The signal: read it each frame, stop it with the effect.
 */
export function audioSignal(source) {
	/** @type {Listener} */
	const listener = { follows: follower(source.trim() || 'page') };
	if (!listeners.size) hearPage(true);
	listeners.add(listener);
	let on = 0;
	/** @type {HTMLMediaElement | null} */
	let current = null;
	/** @type {AudioReading | null} */
	let out = null;

	/**
	 * The element to follow this frame: the latest to start of those playing
	 * that this effect follows and that are tapped.
	 *
	 * @returns {HTMLMediaElement | null} It, or null.
	 */
	const pick = () => {
		/** @type {HTMLMediaElement | null} */
		let best = null;
		let at = -Infinity;
		for (const [media, h] of heard) {
			if (media.paused || h.at < at || !taps.has(media) || !listener.follows(media, h.owner)) continue;
			best = media;
			at = h.at;
		}
		return best;
	};

	return {
		read(now, frameDt) {
			if (!heard.size && !on) return null;
			const dt = Math.min(frameDt, MAX_DT);
			const next = pick();
			if (next) current = next;
			on += ((next ? 1 : 0) - on) * (1 - Math.exp(-dt / (next ? ON_RISE : ON_FALL)));
			if (!next && on < 0.01) {
				on = 0;
				current = null;
				return null;
			}
			const t = current && taps.get(current);
			if (!current || !t) return null;
			if (t.stamp !== now) {
				t.stamp = now;
				t.analyser.getByteFrequencyData(t.freq);
				t.analyser.getByteTimeDomainData(t.time);
				t.meter.update(t.freq, t.time, t.analyser.context.sampleRate / FFT, dt);
			}
			const duration = current.duration;
			out = Object.assign(out ?? { on: 0, progress: -1 }, t.meter.reading);
			out.on = on;
			out.progress = Number.isFinite(duration) && duration > 0 ? current.currentTime / duration : -1;
			return out;
		},
		stop() {
			listeners.delete(listener);
			if (!listeners.size) {
				hearPage(false);
				idleSoon();
			}
		},
	};
}
