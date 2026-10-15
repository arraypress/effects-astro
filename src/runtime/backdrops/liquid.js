/**
 * @module @arraypress/effects-astro/backdrops/liquid
 *
 * Liquid: a flowing water surface in the colours, on which the pointer sets off
 * damped rings: up to eight at once, in `uRipples` (origin, birth time in
 * shader seconds, strength; 0 strength for an empty slot). Opaque: a
 * surface for a button or panel, or a whole section.
 */

import { BACKDROP_GLSL } from './common.js';

/** The liquid backdrop's fragment shader. */
export const LIQUID = `${BACKDROP_GLSL}
uniform vec4 uRipples[8];
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 p=vec2(uv.x*ar,uv.y);
	float t=uTime;
	float h=(fbm(p*2.6+vec2(t*.10,-t*.07))-.5)*.5;
	h+=(fbm(p*5.2-vec2(t*.06,t*.04))-.5)*.22;
	for(int i=0;i<8;i++){
		vec4 r=uRipples[i];
		float age=t-r.z;
		if(r.w<=0.||age<0.)continue;
		vec2 rp=vec2(r.x*ar,r.y);
		float d=length(p-rp);
		h+=sin(d*42.-age*7.5)*exp(-d*6.5)*exp(-age*2.4)*r.w*.6;
	}
	vec3 base=mix(uColor2,uColor1,clamp(.62+h*1.1,0.,1.));
	float spec=smoothstep(.16,.44,h);
	vec3 col=base+uColor3*spec*.25+vec3(spec*.22);
	col*=uIntensity;
	gl_FragColor = premultiply(vec4(col,1.));
}
`;
