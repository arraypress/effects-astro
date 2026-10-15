/**
 * @module @arraypress/effects-astro/color
 *
 * Colours as the effects take them: CSS hex in, 0–1 channels out, and
 * blends made in Oklab rather than RGB. Mixed in RGB, two bright colours
 * meet in a muddy middle (violet to cyan passes through grey); in Oklab,
 * a space built so equal steps look equal, the middle stays as bright and
 * as saturated as the ends.
 *
 * The same blend is available to shaders as GLSL (`GLSL_OKLAB`), so a
 * palette loops the same way on the CPU (ink colours) and on the GPU (the
 * light).
 */

/**
 * An RGB colour, each channel 0–1, in sRGB (as CSS writes it).
 *
 * @typedef {[number, number, number]} Rgb
 */

/**
 * Reads a CSS hex colour: `#rgb`, `#rrggbb` (or either without the `#`).
 *
 * @param {string} hex The colour.
 * @returns {Rgb} Its channels, 0–1.
 * @throws {TypeError} When it is not a 3- or 6-digit hex colour.
 */
export function parseColor(hex) {
	const h = String(hex).trim().replace(/^#/, '');
	const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
	if (!/^[0-9a-f]{6}$/i.test(full)) throw new TypeError(`Not a hex colour: ${hex}`);
	return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/**
 * Writes a colour back as CSS hex.
 *
 * @param {Rgb} rgb Channels, 0–1 (clamped).
 * @returns {string} `#rrggbb`.
 */
export function toHex(rgb) {
	return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * One sRGB channel to linear light.
 *
 * @param {number} c The channel, 0–1.
 * @returns {number} Linear, 0–1.
 */
function toLinear(c) {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * One linear channel back to sRGB.
 *
 * @param {number} c Linear, 0–1.
 * @returns {number} The channel, 0–1.
 */
function toSrgb(c) {
	const v = Math.max(0, c);
	return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

/**
 * sRGB to Oklab (Björn Ottosson's matrices).
 *
 * @param {Rgb} rgb The colour.
 * @returns {[number, number, number]} L, a, b.
 */
export function toOklab(rgb) {
	const [r, g, b] = rgb.map(toLinear);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

/**
 * Oklab back to sRGB.
 *
 * @param {[number, number, number]} lab L, a, b.
 * @returns {Rgb} The colour, 0–1 (out-of-gamut channels clamped).
 */
export function fromOklab([L, a, b]) {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map((c) => Math.min(1, toSrgb(c)));
}

/**
 * Blends two colours in Oklab.
 *
 * @param {Rgb} from The colour at 0.
 * @param {Rgb} to The colour at 1.
 * @param {number} t How far, 0–1.
 * @returns {Rgb} The blend.
 */
export function mixOklab(from, to, t) {
	const a = toOklab(from);
	const b = toOklab(to);
	return fromOklab(a.map((v, i) => v + (b[i] - v) * t));
}

/**
 * A point on a palette looped through its colours and back to the first,
 * eased between them and blended in Oklab.
 *
 * @param {Rgb[]} colors The palette, at least one colour.
 * @param {number} t Where on the loop; whole turns wrap (1.25 is 0.25).
 * @returns {Rgb} The colour there.
 * @throws {RangeError} With an empty palette.
 */
export function paletteAt(colors, t) {
	if (!colors.length) throw new RangeError('A palette needs at least one colour');
	const x = (((t % 1) + 1) % 1) * colors.length;
	const i = Math.floor(x);
	const f = x - i;
	return mixOklab(colors[i], colors[(i + 1) % colors.length], f * f * (3 - 2 * f));
}

/**
 * GLSL (ES 1.00) for the same blend on the GPU: `oklabMix(a, b, t)` with
 * sRGB colours in and out.
 */
export const GLSL_OKLAB = `
vec3 oklabToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 oklabToSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 toOklab(vec3 srgb) {
	vec3 c = oklabToLinear(srgb);
	vec3 lms = pow(mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c, vec3(1.0 / 3.0));
	return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662, -0.0040720468, 0.4505937099, -0.8086757660) * lms;
}
vec3 fromOklab(vec3 lab) {
	vec3 lms = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * lab;
	lms = lms * lms * lms;
	return oklabToSrgb(mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.7076147010) * lms);
}
vec3 oklabMix(vec3 a, vec3 b, float t) { return fromOklab(mix(toOklab(a), toOklab(b), t)); }
`;
