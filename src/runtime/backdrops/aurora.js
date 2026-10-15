/**
 * @module @arraypress/effects-astro/backdrops/aurora
 *
 * Aurora: slow curtains of light drifting over noise: the calm, premium hero
 * look. Brightest at the top, falling away down the frame.
 */

import { BACKDROP_GLSL } from './common.js';

/** The aurora backdrop's fragment shader. */
export const AURORA = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	vec2 p=vec2(uv.x*uRes.x/uRes.y,uv.y);
	p+=(uMouse-.5)*.12;
	float t=uTime*.05;
	float n1=fbm(p*vec2(1.1,2.1)+vec2(t,-t*.55));
	float n2=fbm(p*vec2(1.7,2.8)-vec2(t*.7,t*.35)+7.31);
	float curtain=smoothstep(.32,.95,n1)*(.35+.65*n2);
	float falloff=smoothstep(.0,.55,uv.y)*.9+.1;
	vec3 col=(uColor1*n1+uColor3*n2*.6)*curtain*falloff;
	col+=uColor2*.22*smoothstep(.45,1.,n2)*falloff;
	col*=uIntensity;
	float a=clamp(max(max(col.r,col.g),col.b)*1.5,0.,1.);
	gl_FragColor = premultiply(vec4(col,a));
}
`;
