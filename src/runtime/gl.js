/**
 * @module @arraypress/effects-astro/gl
 *
 * The WebGL plumbing every effect shares: getting a context, compiling a
 * program, and the one full-screen triangle each pass draws.
 *
 * Every program reads its single attribute, `p` (clip-space position), at
 * location 0, so passes from different modules can share one buffer.
 */

/** The triangle that covers clip space: three corners, one draw. */
const TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);

/**
 * Gets a WebGL context, WebGL 2 first.
 *
 * @param {HTMLCanvasElement} canvas The canvas.
 * @param {WebGLContextAttributes} [attributes] Context attributes;
 *   antialiasing is off by default (full-screen shaders do not need it).
 * @param {boolean} [webgl1=true] Fall back to WebGL 1 without WebGL 2.
 * @returns {WebGL2RenderingContext | WebGLRenderingContext | null} The context.
 */
export function getContext(canvas, attributes = {}, webgl1 = true) {
	const options = { antialias: false, powerPreference: 'low-power', ...attributes };
	return /** @type {WebGL2RenderingContext | WebGLRenderingContext | null} */ (canvas.getContext('webgl2', options) ?? (webgl1 ? canvas.getContext('webgl', options) : null));
}

/**
 * Compiles and links a program, with `p` at attribute 0.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {string} vertex The vertex shader.
 * @param {string} fragment The fragment shader.
 * @returns {{ program: WebGLProgram, uniform: (name: string) => WebGLUniformLocation | null } | null}
 *   The program and a uniform lookup, or null with the reason in the console.
 */
export function createProgram(gl, vertex, fragment) {
	const program = gl.createProgram();
	if (!program) return null;
	/** @type {[number, string][]} */
	const stages = [
		[gl.VERTEX_SHADER, vertex],
		[gl.FRAGMENT_SHADER, fragment],
	];
	for (const [type, source] of stages) {
		const shader = gl.createShader(type);
		if (!shader) return null;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.warn('[effects-astro]', gl.getShaderInfoLog(shader));
			return null;
		}
		gl.attachShader(program, shader);
	}
	gl.bindAttribLocation(program, 0, 'p');
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.warn('[effects-astro]', gl.getProgramInfoLog(program));
		return null;
	}
	/** @type {Map<string, WebGLUniformLocation | null>} */
	const cache = new Map();
	return {
		program,
		uniform(name) {
			if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
			return cache.get(name) ?? null;
		},
	};
}

/**
 * Makes the full-screen triangle's buffer and points attribute 0 at it.
 * Call again before drawing whenever another module may have bound its own.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {WebGLBuffer} [buffer] A buffer made by an earlier call, to bind again.
 * @returns {WebGLBuffer} The buffer.
 */
export function bindTriangle(gl, buffer) {
	let b = buffer;
	if (!b) {
		b = /** @type {WebGLBuffer} */ (gl.createBuffer());
		gl.bindBuffer(gl.ARRAY_BUFFER, b);
		gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE, gl.STATIC_DRAW);
	} else {
		gl.bindBuffer(gl.ARRAY_BUFFER, b);
	}
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	return b;
}

/** The vertex shader most passes need: clip-space position, and `vUv` 0–1. */
export const VERTEX = `
precision highp float;
attribute vec2 p;
varying vec2 vUv;
void main() {
	vUv = p * 0.5 + 0.5;
	gl_Position = vec4(p, 0.0, 1.0);
}
`;
