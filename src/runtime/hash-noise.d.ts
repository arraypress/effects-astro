/** GLSL: `vec3 hash33(vec3 p3)`, three values 0–1 from three inputs (Hash without Sine). */
export declare const GLSL_HASH33: string;
/** Hash without Sine, three in and three out (the shader's `hash33`); each value 0–1. */
export declare function hash33(x: number, y: number, z: number): [number, number, number];
/** GLSL: `vec2 grad(vec2 p)` and `float gnoise(vec2 p)`, gradient noise with a quintic fade, 0–1. */
export declare const GLSL_GRADIENT_NOISE: string;
/** A lattice point's gradient (the shader's `grad`), each part −1 to 1. */
export declare function grad(x: number, y: number): [number, number];
/** Gradient noise with a quintic fade (the shader's `gnoise`), 0–1. */
export declare function gnoise(x: number, y: number): number;
/** GLSL: `float noiseField(vec2 p, float evo, float wt)`, the warped five-octave field, 0–1 (needs GLSL_GRADIENT_NOISE). */
export declare const GLSL_NOISE_FIELD: string;
/** The warped field (the shader's `noiseField`): five octaves of gradient noise, each warped by the sum so far; 0–1. */
export declare function noiseField(x: number, y: number, evo: number, wt: number): number;
