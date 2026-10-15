/**
 * @module @arraypress/effects-astro/backdrops/mesh
 *
 * Mesh: four soft radial blobs orbiting and adding up, one of them following
 * the pointer: the animated mesh-gradient look. Discrete blobs, where
 * mesh-gradient is a seamless wash.
 */

import { BACKDROP_GLSL } from './common.js';

/** The mesh backdrop's fragment shader. */
export const MESH = `${BACKDROP_GLSL}
float blob(vec2 p,vec2 c,float r){float d=length(p-c);return r*r/(d*d+r*r);}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 p=(uv-.5)*vec2(ar,1.);
	float t=uTime*.22;
	vec2 m=(uMouse-.5)*vec2(ar,1.);
	vec3 col=vec3(0.);
	col+=uColor1*.50*blob(p,vec2(sin(t*.70)*.55,cos(t*.50)*.34),.30);
	col+=uColor2*.45*blob(p,vec2(cos(t*.40+2.)*.60,sin(t*.60+1.)*.40),.36);
	col+=uColor3*.40*blob(p,vec2(sin(t*.50+4.)*.50,cos(t*.34+3.)*.44),.28);
	col+=uColor1*.20*blob(p,m,.22);
	col*=uIntensity;
	float a=clamp(max(max(col.r,col.g),col.b)*1.3,0.,1.);
	gl_FragColor = premultiply(vec4(col,a));
}
`;
