export type GL = WebGLRenderingContext | WebGL2RenderingContext;

/** A linked program and a cached uniform lookup. */
export interface Program {
	program: WebGLProgram;
	uniform(name: string): WebGLUniformLocation | null;
}

/** A WebGL 2 context, or WebGL 1 when `webgl1` (default true) and WebGL 2 is missing. Antialiasing off by default. */
export function getContext(canvas: HTMLCanvasElement, attributes?: WebGLContextAttributes, webgl1?: boolean): GL | null;

/** Compiles and links a program with `p` at attribute 0; null (reason in the console) on failure. */
export function createProgram(gl: GL, vertex: string, fragment: string): Program | null;

/** Makes (or binds again) the full-screen triangle buffer and points attribute 0 at it. */
export function bindTriangle(gl: GL, buffer?: WebGLBuffer): WebGLBuffer;

/** A vertex shader giving `vUv`, 0–1 across the target. */
export const VERTEX: string;
