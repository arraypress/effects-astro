/**
 * @module @arraypress/effects-astro/shader-backgrounds/mesh-gradient
 *
 * Mesh gradient: four colour spots on their own orbits, warped by noise and pulled
 * through a slow vortex, blended by inverse distance so no spot has an
 * edge, and finished with fine grain (which also stops the big ramps
 * banding). Coverage rides in the alpha and the colour keeps its chroma,
 * so it is a pastel tint on a light page and a deep pool on a dark one.
 */

import { SHADER_BACKGROUND_GLSL } from './common.js';

/** The mesh gradient shader background's fragment shader. */
export const MESH_GRADIENT = `${SHADER_BACKGROUND_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 p=(uv-.5)*vec2(ar,1.);
	float t=uTime*.12;

	/* Organic distortion — warp the sampling point by two decorrelated
	   fbm fields so the spots deform instead of sliding rigidly. */
	vec2 w=vec2(fbm(p*1.3+vec2(t,-t*.7)),fbm(p*1.3+vec2(-t*.6,t*.9)+4.2));
	p+=(w-.5)*.6;

	/* Slow vortex, oscillating so it never settles. */
	p=swirl(p,.85*sin(t*.35));
	p+=(uMouse-.5)*vec2(ar,1.)*.10;

	/* Four spots, each on its own orbit. */
	vec2 s1=vec2(sin(t*.90)*.44,cos(t*.70)*.32);
	vec2 s2=vec2(cos(t*.60+2.)*.48,sin(t*.80+1.)*.36);
	vec2 s3=vec2(sin(t*.50+4.)*.42,cos(t*.90+3.)*.40);
	vec2 s4=vec2(cos(t*.75+5.)*.38,sin(t*.55+2.5)*.30);

	/* Inverse-distance weighting: every pixel is a blend of ALL four,
	   weighted by proximity. The +.05 floor stops the weight blowing up
	   at a spot centre (which would punch a hard dot). */
	float w1=1./(dot(p-s1,p-s1)+.05);
	float w2=1./(dot(p-s2,p-s2)+.05);
	float w3=1./(dot(p-s3,p-s3)+.05);
	float w4=1./(dot(p-s4,p-s4)+.05);
	float sum=w1+w2+w3+w4;
	vec3 col=(uColor1*w1+uColor2*w2+uColor3*w3+uColor4*w4)/sum;

	/* COVERAGE — the load-bearing term. The weights above are normalised,
	   so the hue blend alone returns a fully-saturated colour at EVERY
	   pixel; left there it floods the page and swallows any text on top.
	   This density field breaks it into soft pools with the page showing
	   through between them, which is what a gradient mesh on a real site
	   actually looks like. */
	float cover=smoothstep(.30,.78,fbm(p*1.15+vec2(t*.5,-t*.35)+2.7));

	/* Radial falloff so the wash melts out rather than ending flat. */
	float vig=1.-smoothstep(.15,.95,length((uv-.5)*vec2(ar,1.)));

	/* Fine grain — dithers the gradient (big smooth ramps band badly on
	   8-bit displays) and adds the paper texture. */
	float g=hash(uv*uRes*.65+fract(uTime*.35)*vec2(19.,37.));

	/* The mask drives ALPHA ONLY; the colour keeps full chroma.
	   This is the whole trick, and getting it wrong is why washes look
	   dirty: the browser composites this canvas over the page as
	   col*a + page*(1-a). Multiplying the COLOUR by the mask (the
	   obvious move) darkens it toward black while alpha drops too, so
	   over a light page you composite a dark colour at partial alpha —
	   i.e. grey mud. Keep the colour saturated, mask the alpha, and the
	   same shader gives a pastel tint on white and a deep pool on black
	   with no per-mode branching. */
	float mask=cover*vig*(1.+(g-.5)*.4);
	float a=clamp(mask*uIntensity,0.,1.);
	gl_FragColor = premultiply(vec4(clamp(col,0.,1.),a));
}
`;
