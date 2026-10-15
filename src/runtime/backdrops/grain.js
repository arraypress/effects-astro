/**
 * @module @arraypress/effects-astro/backdrops/grain
 *
 * Grain: moving film grain over a faint vignette in the colours: the quietest,
 * texture rather than motion.
 */

import { BACKDROP_GLSL } from './common.js';

/** The grain backdrop's fragment shader. */
export const GRAIN = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float g=hash(uv*uRes*.5+fract(uTime*.7)*vec2(17.,31.));
	float vig=1.-smoothstep(.1,.8,distance(uv,vec2(.5,.45)));
	vec3 col=uColor1*vig*.10+uColor2*(1.-vig)*.03;
	col+=vec3(g)*.06;
	col*=uIntensity;
	float a=clamp((g*.5+vig*.55)*.5*uIntensity,0.,1.);
	gl_FragColor = premultiply(vec4(col,a));
}
`;
