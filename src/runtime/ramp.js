/**
 * @module @arraypress/effects-astro/ramp
 *
 * A gradient for shaders: up to MAX_COLORS colours in Oklab (from
 * `gradientUniform`), read at any point from the first to the last. Each
 * stretch between two colours is blended in Oklab, so a ramp from navy to
 * sand never passes through grey.
 */

import { MAX_COLORS } from './dot-surface.js';

/**
 * GLSL (ES 1.00): `uniform vec3 uRamp[MAX_COLORS]` (Oklab, from
 * `gradientUniform`), `uniform float uRamps` (how many are set) and
 * `vec3 ramp(float t)`, the gradient at t (0 the first colour, 1 the
 * last), in Oklab.
 */
export const GLSL_RAMP = `
uniform vec3 uRamp[${MAX_COLORS}];
uniform float uRamps;
vec3 ramp(float t) {
	float x = clamp(t, 0.0, 1.0) * (uRamps - 1.0);
	float i = min(floor(x), max(uRamps - 2.0, 0.0));
	vec3 a = uRamp[0], b = uRamp[0];
	for (int n = 0; n < ${MAX_COLORS - 1}; n++) {
		if (float(n) == i) { a = uRamp[n]; b = uRamp[n + 1]; }
	}
	return uRamps > 1.0 ? mix(a, b, x - i) : a;
}
`;
