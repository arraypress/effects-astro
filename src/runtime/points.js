/**
 * @module @arraypress/effects-astro/points
 *
 * Particles drawn as points: a buffer of per-particle data (read as the
 * vertex attribute `p`, a vec4), a program the effect writes the motion
 * for, and soft round dots added together so where they crowd they glow.
 *
 * Drawn once, or three times with the red, green and blue drawn a little
 * apart (`aberration`), so every dot fringes like light through a cheap
 * lens. The vertex shader adds `uShift` (clip space) to its position for
 * that, and gets `uRes`, `uTime` and `uRatio` (the pixel ratio, for sizes
 * in CSS px).
 */

import { createProgram } from './gl.js';

/**
 * GLSL for a vertex shader: rotations and a gentle perspective, for points
 * in a small 3D scene centred on the origin.
 */
export const GLSL_PROJECT = `
vec3 rotateX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
vec3 rotateY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
// A point in the scene to clip space: x scaled to the canvas's aspect, nearer points larger.
vec4 project(vec3 v, float aspect) {
	float w = 1.0 + v.z * 0.45;
	return vec4(v.x / aspect, v.y, 0.0, w);
}
`;

/**
 * GLSL_PROJECT's rotations and perspective in JavaScript, for placing
 * things over a point (a tracker box) where the shader draws it.
 *
 * @param {[number, number, number]} v The point in the scene.
 * @param {number} turnY Rotation about the vertical axis, radians (applied first).
 * @param {number} turnX Rotation about the horizontal axis, radians.
 * @param {number} aspect The canvas's width over height.
 * @returns {{ x: number, y: number }} Where it lands, 0–1 from the top left.
 */
export function projectPoint([x, y, z], turnY, turnX, aspect) {
	const cy = Math.cos(turnY);
	const sy = Math.sin(turnY);
	const x1 = cy * x + sy * z;
	const z1 = -sy * x + cy * z;
	const cx = Math.cos(turnX);
	const sx = Math.sin(turnX);
	const y2 = cx * y - sx * z1;
	const z2 = sx * y + cx * z1;
	const w = 1 + z2 * 0.45;
	return { x: (x1 / aspect / w) * 0.5 + 0.5, y: 0.5 - (y2 / w) * 0.5 };
}

/** The fragment shader every point effect shares: a soft round dot, in its colour, added up. */
const DOT = `
precision highp float;
varying vec3 vColour;
varying float vAlpha;
void main() {
	float d = length(gl_PointCoord - 0.5);
	float a = smoothstep(0.5, 0.15, d) * vAlpha;
	gl_FragColor = vec4(vColour * a, a);
}
`;

/**
 * @typedef {object} Points
 * @property {import('./gl.js').Program} program The points' program.
 * @property {(aberration: number, draw: () => void) => void} passes
 *   Draws the points: once, or with `aberration` > 0 three times, red,
 *   green and blue that many canvas pixels apart. `draw` sets the
 *   uniforms (the program is bound) before each pass.
 * @property {(data: Float32Array) => void} upload Replaces the particle data (four floats a particle).
 * @property {() => number} count How many particles there are.
 * @property {() => void} bind Binds the buffer to attribute 0.
 */

/**
 * Makes a point renderer.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {string} vertex The effect's vertex shader: reads `attribute vec4 p`,
 *   writes `gl_Position`, `gl_PointSize`, `vColour` and `vAlpha`, and adds
 *   `uniform vec2 uShift` to its clip position.
 * @returns {Points | null} The renderer, or null with the reason in the console.
 */
export function createPoints(gl, vertex) {
	const program = createProgram(gl, vertex, DOT);
	if (!program) return null;
	const buffer = gl.createBuffer();
	let count = 0;

	/** Binds the buffer to attribute 0, four floats a particle. */
	const bind = () => {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
	};

	return {
		program,
		upload(data) {
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
			count = data.length / 4;
		},
		count: () => count,
		bind,
		passes(aberration, draw) {
			bind();
			gl.useProgram(program.program);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			const split = aberration;
			const channels = split > 0 ? [[1, 0, 0, -split], [0, 1, 0, 0], [0, 0, 1, split]] : [[1, 1, 1, 0]];
			for (const [r, g, b, dx] of channels) {
				gl.colorMask(!!r, !!g, !!b, true);
				gl.uniform2f(program.uniform('uShift'), (dx * 2) / gl.drawingBufferWidth, 0);
				draw();
				gl.drawArrays(gl.POINTS, 0, count);
			}
			gl.colorMask(true, true, true, true);
			gl.disable(gl.BLEND);
		},
	};
}
