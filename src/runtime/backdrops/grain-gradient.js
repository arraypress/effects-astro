/**
 * @module @arraypress/effects-astro/backdrops/grain-gradient
 *
 * Grain gradient: noise-bent colour bands under heavy grain: the grainy-gradient poster
 * look. Texture and colour more than motion; best at a low `speed`.
 * `intensity` also sets how hard the noise chews the bands' edges.
 */

import { BACKDROP_GLSL } from './common.js';

/** The grain gradient backdrop's fragment shader. */
export const GRAIN_GRADIENT = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 p=(uv-.5)*vec2(ar,1.);
	float t=uTime*.10;

	/* The underlying field: a diagonal sweep bent by low-frequency fbm.
	   This is what the colour ramp is read along. */
	float field=dot(p,normalize(vec2(.75,1.)))*.9+.5;
	field+=(fbm(p*1.15+vec2(t*.8,-t*.5))-.5)*1.15;
	field+=(fbm(p*2.4-vec2(t*.4,t*.7)+9.1)-.5)*.45;

	/* Chew the band edges with high-frequency noise, scaled by
	   intensity — this is the "grainy distortion" rather than a clean
	   posterisation. */
	float chew=(hash(uv*uRes*.32+floor(uTime*8.)*vec2(11.,23.))-.5);
	field+=chew*.06*uIntensity;

	/* Read the 4-stop ramp. smoothstep between stops keeps the bands
	   soft; the mix chain is the ramp itself. */
	float f=clamp(field,0.,1.);
	vec3 col=mix(uColor2,uColor1,smoothstep(.00,.38,f));
	col=mix(col,uColor3,smoothstep(.34,.68,f));
	col=mix(col,uColor4,smoothstep(.62,1.,f));

	/* Radial falloff so it melts into the page. */
	float vig=1.-smoothstep(.2,1.1,length(p));

	/* Heavy grain — the signature of the look. It rides in the ALPHA
	   rather than being added to the colour, for the same reason as
	   mesh-gradient (see the note there): grain added to the colour
	   greys out on a light page, grain in the alpha reads as texture on
	   either. */
	float g=hash(uv*uRes*.9+fract(uTime*.5)*vec2(29.,13.));

	float mask=vig*(1.+(g-.5)*.85);
	float a=clamp(mask*uIntensity,0.,1.);
	gl_FragColor = premultiply(vec4(clamp(col,0.,1.),a));
}
`;
