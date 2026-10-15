/**
 * @module @arraypress/effects-astro/backdrops/grid
 *
 * Grid: a perspective floor grid scrolling towards a glowing horizon: retro,
 * synthwave.
 */

import { BACKDROP_GLSL } from './common.js';

/** The grid backdrop's fragment shader. */
export const GRID = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	float horizon=.62;
	vec3 col=vec3(0.);
	if(uv.y<horizon){
		float z=(horizon-uv.y)+.015;
		float pz=1./z;
		vec2 g=vec2((uv.x-.5)*ar*pz*.9,pz*.5+uTime*1.1);
		float dx=abs(fract(g.x+.5)-.5);
		float dy=abs(fract(g.y+.5)-.5);
		float fog=smoothstep(.0,.45,z);
		float line=(.022/(dx+.018)+.022/(dy+.018))*.5;
		col+=uColor1*line*fog*.85;
	}
	col+=uColor2*exp(-abs(uv.y-horizon)*22.)*.55;
	col+=uColor3*exp(-abs(uv.y-horizon)*5.)*.10;
	col*=uIntensity;
	float a=clamp(max(max(col.r,col.g),col.b)*1.35,0.,1.);
	gl_FragColor = premultiply(vec4(col,a));
}
`;
