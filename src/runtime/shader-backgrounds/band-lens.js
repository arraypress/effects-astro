/**
 * @module @arraypress/effects-astro/shader-backgrounds/band-lens
 *
 * Band lens: a flowing two-colour field seen through a grid of lens cells about a
 * hundred times wider than they are tall, which smears it into tall,
 * uneven streaks with bright refracted edges. Plumb, never rotated:
 * light falling, not a swipe.
 */

import { SHADER_BACKGROUND_GLSL } from './common.js';

/** The band lens shader background's fragment shader. */
export const BAND_LENS = `${SHADER_BACKGROUND_GLSL}
/* One cell of the lens grid. Tiling with fract() puts every fragment in
   its own cell, then the sphere equation gives the warp for that cell. */
vec2 bandLens(vec2 p, float spacingX, float spacingY, float radiusSq){
	vec2 c;
	c.x = fract(p.x/spacingX + .5)*spacingX - spacingX*.5;
	c.y = fract(p.y/spacingY + .5)*spacingY - spacingY*.5;
	float sp = radiusSq - c.x*c.x - c.y*c.y;
	float amount = smoothstep(-.1, .05, sp);
	float lens = sqrt(max(sp, -sp*.1)/.3);
	float warp = mix(1., lens, amount);
	vec2 out_ = p;
	out_.x += c.x*warp - c.x;
	out_.y *= warp;          /* the vertical smear */
	return out_;
}

/* Smooth flowing scalar in 0-1, from three interfering directional waves.
   Cheaper and far smoother than fbm, which is what keeps the streaks clean
   instead of grainy. */
float flowField(vec2 uv, float t){
	vec2 d1 = vec2(cos(1.31), sin(1.31));
	vec2 d2 = vec2(cos(4.02), sin(4.02));
	/* Time terms are negated relative to the obvious reading: the field
	   drifts right-to-left. Flip the signs on the two t terms to reverse
	   it — that is the only thing controlling travel direction. */
	float a = dot(uv,d1) + sin(dot(uv,d2)*2.1 - t)*.30 - t*.20;
	float b = dot(uv,d2.yx) + cos(dot(uv,d1.yx)*1.9 + t*.80)*.25;
	float v = sin(a*1.5)*.5 + .5;
	v += cos(b*1.2)*1.3;
	v += sin(dot(uv,d1+d2)*2.4 - t*3.5)*1.2;
	return smoothstep(0., 4.12, v);
}

void main(){
	vec2 r = uRes;
	/* Aspect-correct, origin-centred — matches the reference's framing. */
	vec2 p = (gl_FragCoord.xy*2. - r)/r.y;
	float t = uTime*.30;

	/* Deliberately NOT rotated. The beams are plumb — the reference sets
	   no rotation uniform, and tilting them reads as a swipe rather than
	   as light falling. The irregularity comes from the flow field, not
	   from any angle. */
	float scale = 3.7;
	vec2 warped = bandLens(p*scale, 1.0, 0.01, 0.41*0.41);
	float g = flowField(warped/scale, t*.8);

	/* Two-stop ramp: accent into the page tone. A third colour would mud
	   the streaks — the reference ships two for the same reason. */
	vec3 col = mix(uColor2, uColor1, g);

	/* ALPHA carries the streaks, never a darkened colour (see the note on
	   mesh-gradient). Squared so dim areas fall to fully transparent and
	   the page black shows through between beams. */
	float a = g*g*uIntensity;

	gl_FragColor = premultiply(vec4(col, clamp(a, 0., 1.)));
}
`;
