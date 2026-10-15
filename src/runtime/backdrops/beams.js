/**
 * @module @arraypress/effects-astro/backdrops/beams
 *
 * Beams: vertical beams of light falling from the top: noise sampled across x
 * only, so each band is constant down its column, in four octaves so it
 * never reads as a repeating stripe.
 */

import { BACKDROP_GLSL } from './common.js';

/** The beams backdrop's fragment shader. */
export const BEAMS = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float t=uTime*.10;

	/* Sampled on X only — constant down each column. The second
	   coordinate is time, so beams breathe in place instead of sliding. */
	float b =      smoothstep(.42,1.,vnoise(vec2(uv.x* 5.0,       t*.45)));
	b += .70*      smoothstep(.50,1.,vnoise(vec2(uv.x*13.0+ 9.1,  t*.30)));
	b += .45*      smoothstep(.58,1.,vnoise(vec2(uv.x*27.0+ 3.7,  t*.65)));
	b += .28*      smoothstep(.62,1.,vnoise(vec2(uv.x*53.0+21.3,  t*.85)));
	b/=2.43;

	/* Light falls from the top. gl_FragCoord.y is bottom-up, so uv.y=1
	   is the top edge — raise it to bias the glow into the upper third. */
	float fall=pow(clamp(uv.y,0.,1.),1.9);

	/* A slow vertical wash breaks the columns up so they don't read as
	   hard bars all the way down. */
	float wash=.72+.28*vnoise(vec2(uv.x*3.0,uv.y*1.6-t*.5));

	float g=b*fall*wash;

	/* Hot cores tend toward the third colour, the body sits between the
	   first two — that's what gives a beam its centre. */
	vec3 col=mix(uColor1,uColor2,smoothstep(.10,.55,g));
	col=mix(col,uColor3,smoothstep(.55,.95,g)*.75);

	float a=clamp(g*1.35,0.,1.)*uIntensity;
	gl_FragColor = premultiply(vec4(col*uIntensity,a));
}
`;
