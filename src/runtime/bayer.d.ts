/** GLSL (ES 1.00): `float bayer8(vec2 cell)`, the 8×8 Bayer threshold 0–63/64 at a dot. */
export declare const GLSL_BAYER: string;

/** The 8×8 Bayer threshold at a dot, 0–63/64 (it repeats every 8 dots). */
export declare function bayer(x: number, y: number): number;
