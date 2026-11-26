/**
 * @module @arraypress/effects-astro/glass-optics
 *
 * The optics the glass logos share (GlassDrop, GlassStack): a small studio
 * for glass to mirror, and how much a surface mirrors at an angle. Glass
 * looks real when it reflects a room, not when it carries highlight spots,
 * so the bevels pick up a softbox and a strip light as they turn toward
 * them, and a flat face facing the viewer picks up almost nothing.
 */

/**
 * GLSL: `vec3 studio(vec3 dir, vec2 lightDir, vec3 light)`, the light a
 * mirror facing `dir` sees in a dark studio (`dir` points out of the
 * surface; +z is toward the viewer): a broad softbox up toward `lightDir`
 * (a unit vector on the screen, the side the light comes from), a thin
 * strip light opposite it, and a dim fill everywhere. And
 * `float schlick(float cosine, float f0)`, Schlick's fresnel: how much of
 * the light a surface mirrors when seen at that angle (`f0` head on).
 */
export const GLSL_STUDIO = `
vec3 studio(vec3 dir, vec2 lightDir, vec3 light) {
	vec3 d = normalize(dir);
	// The softbox: large, high on the light's side, so a face looking straight back sees only its edge.
	vec3 key = normalize(vec3(lightDir * 0.78, 0.62));
	float box = smoothstep(0.78, 0.93, dot(d, key));
	// The strip: a long, thin light low on the other side, for a rim on the shadowed bevels.
	vec3 across = normalize(vec3(-lightDir.y, lightDir.x, 0.0));
	vec3 back = normalize(vec3(-lightDir * 0.9, 0.42));
	float strip = smoothstep(0.86, 0.97, dot(d, back)) * smoothstep(0.55, 0.2, abs(dot(d, across)));
	// The room: a little light everywhere, more from above the horizon of the light's side.
	float fill = 0.035 + 0.05 * clamp(dot(d.xy, lightDir) * 0.5 + 0.5, 0.0, 1.0);
	return light * (box + strip * 0.45 + fill);
}
float schlick(float cosine, float f0) {
	float m = clamp(1.0 - cosine, 0.0, 1.0);
	return f0 + (1.0 - f0) * m * m * m * m * m;
}
`;

/**
 * A light angle as the shaders take it: a unit vector on the screen, y up.
 *
 * @param {number} degrees Where the light comes from, 0 right, 90 top.
 * @returns {[number, number]} Its direction.
 */
export function lightVector(degrees) {
	const a = (degrees * Math.PI) / 180;
	return [Math.cos(a), Math.sin(a)];
}
