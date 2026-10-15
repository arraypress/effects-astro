/**
 * @module @arraypress/effects-astro/iso-city
 *
 * A small isometric city in flat-shaded low poly, the way a tidy puzzle
 * game draws one: blocks of buildings with cluttered roofs, parks with
 * round trees, streets with lane markings and zebra crossings, soft
 * shadows, all fading into the background at the edges. Cars drive it,
 * keeping their lanes and their distance, slowing into turns and waiting
 * at crossings while people walk over; some are the brand's taxis, in its
 * colour with a sign on the roof. Click a street and the nearest taxi by road comes: its route
 * draws itself in, and it pulls in at the pin and picks up with a hop.
 * `night` lights the windows, the lamps and the headlights.
 *
 * The city is built once from `seed` into one static mesh (and a baked
 * shadow map); each frame only the cars' places are written, and every car
 * is drawn in one instanced call. The camera drifts very slowly and leans
 * a little towards the pointer, staying isometric. With reduced motion the
 * cars are parked and one frame is drawn. Without WebGL the element gets
 * `is-flat`, and the component's stylesheet draws a plain street grid.
 *
 * Opaque: it is the whole background of what it fills.
 */

import { createStage } from './stage.js';
import { createProgram } from './gl.js';
import { instancing } from './instancing.js';
import { ISO_PITCH, isoCamera } from './iso-camera.js';
import { STRIDE } from './mesh.js';
import { canHover, isMobileGpu } from './device.js';
import { pointerIn, pressAt } from './pointer.js';
import { watchColors } from './mount.js';
import { quietUniform } from './glsl.js';
import { seededRandom } from './random.js';
import { toHex } from './color.js';
import { firstHit, planCity, SLAB } from './iso-city/plan.js';
import { buildRoads } from './iso-city/roads.js';
import { createTraffic } from './iso-city/traffic.js';
import { INSTANCE, PIN_SCALE, carInstances, peopleInstances, pinStates } from './iso-city/figures.js';
import { cityLook } from './iso-city/look.js';
import { carMesh, cityMesh, personMesh, pinMesh, ribbonMesh } from './iso-city/scene.js';
import { bakeShadows, shadowShift } from './iso-city/shadows.js';
import { BACKGROUND, FRAGMENT, VERTEX } from './iso-city/shaders.js';

/**
 * @typedef {object} IsoCityConfig
 * @property {string[]} [colors] Buildings, parks, roads (default warm off-white, sage, graphite; at night slate, deep green, near-black).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), softened into a city, when there are no `colors`.
 * @property {string} [accent] The taxis' colour (default amber).
 * @property {string} [background] The ground the city fades into (default paper; at night midnight).
 * @property {number} [cars=24] How many cars, 0–60.
 * @property {number} [taxis=0.3] How many are taxis: a share (under 1) or a count.
 * @property {number} [speed=1] How fast they drive, 0–3.
 * @property {number} [seed=7] Which city: any number; the same one always builds the same city.
 * @property {number} [size=6] Blocks across, 3–10.
 * @property {boolean} [night=false] Night: lit windows, street lamps, headlights.
 * @property {boolean} [interactive=true] A click on a street calls the nearest taxi.
 * @property {boolean} [drift=true] Let the view drift very slowly.
 * @property {number} [zoom=1] How close the camera is, 0.5–2.
 * @property {'center' | 'left' | 'right'} [side='center'] Where the city sits on a wide screen.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area faded towards the background behind copy.
 */

/** The direction towards the sun: from the left and in front, a little over halfway up the sky. */
const SUN = /** @type {[number, number, number]} */ ([-0.55, 1, 0.62].map((v, _, a) => v / Math.hypot(...a)));
/** Light by day and by night: ambient, sky, sun, and the windows' glow. */
const LIGHT = {
	day: { ambient: [0.6, 0.6, 0.62], sky: [0.06, 0.07, 0.09], sun: [0.4, 0.38, 0.34], window: [1, 0.85, 0.6] },
	night: { ambient: [0.64, 0.67, 0.74], sky: [0.04, 0.05, 0.08], sun: [0.16, 0.17, 0.2], window: [1, 0.8, 0.5] },
};
/** How fast a route draws itself in, world units a second. */
const REVEAL = 16;

/**
 * Starts the city on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {IsoCityConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function isoCity(el, config) {
	let look = cityLook(config);
	const plan = planCity({ seed: config.seed ?? 7, size: Math.max(3, Math.min(10, config.size ?? 6)) });
	const roads = buildRoads(plan);
	const E = plan.extent;
	const carCount = Math.max(0, Math.min(60, Math.round(config.cars ?? 24)));
	const share = config.taxis ?? 0.3;
	const taxiCount = share < 1 ? Math.round(carCount * share) : Math.round(share);
	/** @type {ReturnType<typeof createTraffic> | null} */
	let traffic = null;
	/** @type {ReturnType<typeof isoCamera> | null} */
	let camera = null;
	const lean = { x: 0, y: 0 };
	const start = performance.now();
	/** @type {Map<number, { buffer: WebGLBuffer, count: number }>} */
	const ribbons = new Map();
	/** @type {(() => void) | null} */
	let rebuild = null;
	let clock = 0;
	/**
	 * Draws the city over the stage's backdrop (moving everything on first);
	 * set once the stage is ready.
	 *
	 * @type {(now: number, dt: number) => void}
	 */
	let drawScene = () => {};

	/**
	 * Each frame's camera: framing the city for the canvas's shape, leaning
	 * towards the pointer and drifting slowly.
	 *
	 * @param {number} aspect The canvas's width over its height.
	 * @param {number} t Seconds since the start.
	 * @returns {{ camera: ReturnType<typeof isoCamera>, height: number }} The camera, and the world height it shows.
	 */
	const frame = (aspect, t) => {
		const zoom = Math.max(0.5, Math.min(2, config.zoom ?? 1));
		const diagonal = (E + 1) * Math.SQRT2;
		const width = (diagonal * 0.56) / zoom;
		const height = Math.min(width / aspect, (diagonal * Math.sin(ISO_PITCH) * 0.92) / zoom);
		const wide = aspect > 1.15;
		const side = config.side === 'right' ? 0.3 : config.side === 'left' ? -0.3 : 0;
		const drift = config.drift === false ? 0 : 1;
		const camera = isoCamera({
			target: [E / 2 + Math.sin(t * 0.021) * 0.9 * drift, 0, E / 2 + Math.cos(t * 0.017) * 0.9 * drift - 0.9 * drift],
			yaw: Math.PI / 4 + lean.x * 0.07,
			pitch: ISO_PITCH + lean.y * 0.035,
			height,
			aspect,
			depth: E * 2 + 20,
			shift: [wide ? side : 0, 0],
		});
		return { camera, height };
	};

	const { stage, stop } = createStage(el, {
		fragment: BACKGROUND,
		alpha: false,
		antialias: true,
		setup(st) {
			const { gl } = st;
			const program = createProgram(gl, VERTEX, FRAGMENT);
			if (!program) return false;
			const inst = instancing(gl);
			const loc = {
				normal: gl.getAttribLocation(program.program, 'aNormal'),
				color: gl.getAttribLocation(program.program, 'aColor'),
				uv: gl.getAttribLocation(program.program, 'aUv'),
				tag: gl.getAttribLocation(program.program, 'aTag'),
				place: gl.getAttribLocation(program.program, 'iPlace'),
				paint: gl.getAttribLocation(program.program, 'iPaint'),
				state: gl.getAttribLocation(program.program, 'iState'),
			};
			const vertexAttribs = /** @type {[number, number, number][]} */ ([[0, 3, 0], [loc.normal, 3, 3], [loc.color, 3, 6], [loc.uv, 2, 9], [loc.tag, 2, 11]]);
			const instanceAttribs = [loc.place, loc.paint, loc.state];
			traffic = createTraffic(roads, { cars: carCount, taxis: taxiCount, speed: config.speed ?? 1, paints: look.neutrals.length, parked: st.still, random: seededRandom((config.seed ?? 7) * 31 + 5) });

			/**
			 * Uploads a mesh to a new buffer.
			 *
			 * @param {Float32Array} data The vertices.
			 * @returns {{ buffer: WebGLBuffer, count: number }} The buffer and its vertex count.
			 */
			const upload = (data) => {
				const buffer = /** @type {WebGLBuffer} */ (gl.createBuffer());
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
				return { buffer, count: data.length / STRIDE };
			};
			/** @type {Record<string, { buffer: WebGLBuffer, count: number }>} */
			let meshes = {};
			/** Builds (or rebuilds, after a colour change) the meshes that carry colours. */
			const build = () => {
				for (const m of Object.values(meshes)) gl.deleteBuffer(m.buffer);
				const city = cityMesh(plan, look);
				const car = carMesh(look);
				const pin = pinMesh(frame(16 / 9, 0).camera.eye);
				meshes = {
					city: upload(city.solid),
					glow: upload(city.glow),
					car: upload(car.body),
					carFx: upload(car.effects),
					person: upload(personMesh(look)),
					pin: upload(pin.body),
					ring: upload(pin.ring),
				};
			};
			build();
			rebuild = () => {
				build();
				if (st.still) st.redraw();
			};
			const instances = gl.createBuffer();
			const people = gl.createBuffer();
			const carData = new Float32Array(Math.max(1, carCount) * INSTANCE);
			/** @type {Float32Array} */
			let peopleData = new Float32Array(INSTANCE * 16);

			// The shadow map, baked once.
			const shadows = bakeShadows(plan, SUN, isMobileGpu() ? 768 : 1024);
			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shadows.canvas);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			/**
			 * Points the vertex attributes at a mesh.
			 *
			 * @param {WebGLBuffer} buffer The mesh's buffer.
			 */
			const bindMesh = (buffer) => {
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				for (const [l, size, offset] of vertexAttribs) {
					if (l < 0) continue;
					gl.enableVertexAttribArray(l);
					gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
				}
			};
			/**
			 * Points the instance attributes at a buffer of instances.
			 *
			 * @param {WebGLBuffer | null} buffer The instances.
			 */
			const bindInstances = (buffer) => {
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				instanceAttribs.forEach((l, i) => {
					if (l < 0) return;
					gl.enableVertexAttribArray(l);
					gl.vertexAttribPointer(l, 4, gl.FLOAT, false, INSTANCE * 4, i * 16);
					inst?.divisor(l, 1);
				});
			};
			/**
			 * Sets the instance attributes to one value for a plain draw.
			 *
			 * @param {ArrayLike<number>} [values] Twelve floats, as an instance; default at rest.
			 * @param {number} [offset=0] Where they start in `values`.
			 */
			const single = (values = [0, 0, 0, 0, 1, 1, 1, -1, 0, 1, 1, 0], offset = 0) => {
				instanceAttribs.forEach((l, i) => {
					if (l < 0) return;
					gl.disableVertexAttribArray(l);
					const o = offset + i * 4;
					gl.vertexAttrib4f(l, values[o], values[o + 1], values[o + 2], values[o + 3]);
				});
			};
			/**
			 * Draws a mesh once per instance.
			 *
			 * @param {{ buffer: WebGLBuffer, count: number }} mesh The mesh.
			 * @param {WebGLBuffer | null} buffer The instances.
			 * @param {Float32Array} data Their values (for drawing one by one without instancing).
			 * @param {number} count How many.
			 */
			const drawMany = (mesh, buffer, data, count) => {
				if (!count) return;
				bindMesh(mesh.buffer);
				if (inst) {
					bindInstances(buffer);
					inst.draw(gl.TRIANGLES, 0, mesh.count, count);
					return;
				}
				for (let i = 0; i < count; i++) {
					single(data, i * INSTANCE);
					gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
				}
			};
			/**
			 * Draws a mesh once, at rest or as one instance.
			 *
			 * @param {{ buffer: WebGLBuffer, count: number }} mesh The mesh.
			 * @param {ArrayLike<number>} [values] Its instance values.
			 */
			const drawOne = (mesh, values) => {
				bindMesh(mesh.buffer);
				single(values);
				gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
			};

			const u = program.uniform;
			const light = look.night ? LIGHT.night : LIGHT.day;
			const shift = shadowShift(SUN, 1);

			drawScene = (now, dt) => {
				const t = (now - start) / 1000;
				const tr = /** @type {NonNullable<typeof traffic>} */ (traffic);
				if (!st.still && dt > 0) {
					// Two steps when a frame runs long, so cars never jump far.
					const steps = dt > 1 / 45 ? 2 : 1;
					for (let k = 0; k < steps; k++) tr.step(dt / steps);
					const p = canHover() ? pointerIn(el) : null;
					const want = p?.inside ? { x: (p.x - 0.5) * 2, y: (p.y - 0.5) * 2 } : { x: 0, y: 0 };
					lean.x += (want.x - lean.x) * Math.min(1, dt * 2);
					lean.y += (want.y - lean.y) * Math.min(1, dt * 2);
				}
				clock = tr.time;
				const { canvas } = st;
				const aspect = canvas.width / canvas.height;
				const view = frame(aspect, st.still ? 0 : t);
				const cam = view.camera;
				camera = cam;

				// The cars' instances, then the people's: riders at pins, people on crossings.
				carInstances(tr.cars, look, carData);
				gl.bindBuffer(gl.ARRAY_BUFFER, instances);
				gl.bufferData(gl.ARRAY_BUFFER, carData, gl.DYNAMIC_DRAW);

				const folk = peopleInstances(tr, roads);
				const folkCount = folk.length / INSTANCE;
				if (peopleData.length < folk.length) peopleData = new Float32Array(folk.length * 2);
				peopleData.set(folk);
				gl.bindBuffer(gl.ARRAY_BUFFER, people);
				gl.bufferData(gl.ARRAY_BUFFER, peopleData, gl.DYNAMIC_DRAW);

				gl.useProgram(program.program);
				gl.uniformMatrix4fv(u('uView'), false, cam.matrix);
				gl.uniform2f(u('uRes'), canvas.width, canvas.height);
				gl.uniform3fv(u('uBackground'), look.background);
				gl.uniform3fv(u('uAccent'), look.accent);
				gl.uniform3fv(u('uSun'), SUN);
				gl.uniform3fv(u('uSunColor'), light.sun);
				gl.uniform3fv(u('uAmbient'), light.ambient);
				gl.uniform3fv(u('uSky'), light.sky);
				gl.uniform3fv(u('uWindow'), light.window);
				gl.uniform3fv(u('uEye'), cam.eye);
				gl.uniform1f(u('uNight'), look.night ? 1 : 0);
				gl.uniform1f(u('uTime'), t);
				gl.uniform1f(u('uPixel'), view.height / canvas.height);
				gl.uniform2f(u('uShadowShift'), shift[0], shift[1]);
				gl.uniform3fv(u('uShadowRect'), shadows.rect);
				gl.uniform4f(u('uFog'), E / 2, E / 2, E / 2 - 1.6, E / 2 + 2.4);
				gl.uniform4f(u('uQuiet'), ...quietUniform(config.quiet, aspect));
				gl.uniform4f(u('uRoute'), 0, 0, 1, 0);
				gl.uniform1f(u('uPulse'), 0);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.uniform1i(u('uShadow'), 0);

				gl.clear(gl.DEPTH_BUFFER_BIT);
				gl.enable(gl.DEPTH_TEST);
				gl.depthFunc(gl.LEQUAL);
				gl.enable(gl.CULL_FACE);

				// Solid things.
				drawOne(meshes.city);
				drawMany(meshes.car, instances, carData, tr.cars.length);
				drawMany(meshes.person, people, peopleData, folkCount);
				const pins = pinStates(tr.jobs, clock);
				for (const pin of pins) {
					if (pin.scale > 0.01) drawOne(meshes.pin, [pin.job.x, pin.job.z, 0, SLAB + pin.lift, 1, 1, 1, -1, 0, 1, pin.scale * PIN_SCALE, 0]);
				}

				// Things laid over: shadows, light, routes, rings.
				gl.disable(gl.CULL_FACE);
				gl.depthMask(false);
				gl.enable(gl.BLEND);
				gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
				if (look.night) drawOne(meshes.glow);
				drawMany(meshes.carFx, instances, carData, tr.cars.length);
				for (const job of tr.jobs) {
					const since = clock - job.since;
					const fade = job.state === 'going' ? 1 : job.state === 'done' ? 0 : Math.max(0, 1 - since / 0.5);
					if (fade <= 0) continue;
					let ribbon = ribbons.get(job.id);
					if (!ribbon) {
						ribbon = upload(ribbonMesh(job.points));
						ribbons.set(job.id, ribbon);
					}
					const born = job.state === 'going' ? since : 99;
					const trim = job.state === 'going' ? job.car.odo - job.odo : job.length;
					gl.uniform4f(u('uRoute'), Math.max(0, trim - 0.1), born * REVEAL + 0.3, fade, 0);
					drawOne(ribbon);
				}
				for (const pin of pins) {
					gl.uniform4f(u('uRoute'), 0, 0, pin.fade, 0);
					gl.uniform1f(u('uPulse'), pin.pulse);
					drawOne(meshes.ring, [pin.job.x, pin.job.z, 0, SLAB, 1, 1, 1, -1, 0, 1, PIN_SCALE, 0]);
				}
				gl.disable(gl.BLEND);
				gl.depthMask(true);
				gl.disable(gl.DEPTH_TEST);

				// Done with jobs whose last animation has played: forget them and their ribbons.
				for (let i = tr.jobs.length - 1; i >= 0; i--) {
					const job = tr.jobs[i];
					if (job.state !== 'going' && job.state !== 'pickup' && clock - job.since > 1) {
						const r = ribbons.get(job.id);
						if (r) gl.deleteBuffer(r.buffer);
						ribbons.delete(job.id);
						tr.jobs.splice(i, 1);
					}
				}
				// Leave attribute 0 alone for the stage's pass; the rest go back off.
				for (const l of [...vertexAttribs.map(([l]) => l).slice(1), ...instanceAttribs]) {
					if (l < 0) continue;
					gl.disableVertexAttribArray(l);
					if (instanceAttribs.includes(l)) inst?.divisor(l, 0);
				}
			};

			return () => {
				for (const m of Object.values(meshes)) gl.deleteBuffer(m.buffer);
				for (const r of ribbons.values()) gl.deleteBuffer(r.buffer);
				gl.deleteBuffer(instances);
				gl.deleteBuffer(people);
				gl.deleteTexture(texture);
			};
		},
		uniforms({ gl, uniform }) {
			gl.uniform3fv(uniform('uBackground'), look.background);
		},
		after(st, now, dt) {
			drawScene(now, dt);
		},
	});

	if (!stage) {
		// No WebGL: the component's stylesheet draws a plain street grid in the city's colours.
		el.classList.add('is-flat');
		el.style.setProperty('--iso-ground', toHex(look.background));
		el.style.setProperty('--iso-block', toHex(look.pavement));
		el.style.setProperty('--iso-road', toHex(look.roads));
		return stop;
	}
	stage.redraw();

	/**
	 * Calls a taxi to the street under a press.
	 *
	 * @param {PointerEvent} e The press.
	 */
	const press = (e) => {
		const at = pressAt(el, e);
		if (!at || !camera || !traffic) return;
		// A press on a building means a street in front of it, not one hidden behind:
		// from where the press meets the building, look a little towards the camera.
		const ground = camera.ground(at.x * 2 - 1, at.y * 2 - 1, 0);
		const hit = firstHit(plan, camera.ground(at.x * 2 - 1, at.y * 2 - 1, 6), ground);
		const eye = Math.hypot(camera.eye[0], camera.eye[2]) || 1;
		const p = hit ? [hit[0] + (camera.eye[0] / eye) * 1.4, hit[2] + (camera.eye[2] / eye) * 1.4] : [ground[0], ground[2]];
		traffic.call(p[0], p[1]);
	};
	const interactive = config.interactive !== false && !stage.still;
	if (interactive) document.addEventListener('pointerdown', press, { passive: true });

	const unwatch = watchColors(el, (next) => {
		look = cityLook({ ...config, colors: next.colors, accent: next.glint ?? config.accent });
		rebuild?.();
	});
	return () => {
		stop();
		unwatch();
		if (interactive) document.removeEventListener('pointerdown', press);
	};
}
