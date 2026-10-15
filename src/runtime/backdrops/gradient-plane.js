/**
 * @module @arraypress/effects-astro/backdrops/gradient-plane
 *
 * Gradient plane: a silk sheet facing the camera, displaced by two octaves of noise and
 * lit: broad diagonal colour flow with a soft highlight rolling across it.
 */

import { BACKDROP_GLSL } from './common.js';

/** The gradient plane backdrop's fragment shader. */
export const GRADIENT_PLANE = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 p=(uv-.5)*vec2(ar,1.);
	float t=uTime*.16;

	/* Slight rake so the flow runs diagonally rather than square to
	   the viewport — square bands read as a CSS gradient, not a mesh. */
	vec2 q=rot(p,.42)*1.25;
	q+=(uMouse-.5)*vec2(ar,1.)*.12;

	float h=fbm(q+vec2(t*.7,-t*.5))+.5*fbm(q*2.3+vec2(-t*.4,t*.8));

	float e=.03;
	float hx=fbm(q+vec2(e,0.)+vec2(t*.7,-t*.5))+.5*fbm((q+vec2(e,0.))*2.3+vec2(-t*.4,t*.8));
	float hy=fbm(q+vec2(0.,e)+vec2(t*.7,-t*.5))+.5*fbm((q+vec2(0.,e))*2.3+vec2(-t*.4,t*.8));
	vec3 n=normalize(vec3((h-hx)*2.6,(h-hy)*2.6,1.));

	float ramp=clamp(h*.9+.1,0.,1.);
	vec3 col=mix(uColor1,uColor2,smoothstep(.18,.82,ramp));
	float spec=pow(max(dot(n,normalize(vec3(-.3,.5,.8))),0.),14.);
	col=mix(col,uColor3,spec*.5);

	/* Alpha-masked (never colour-multiplied) so it survives a light page. */
	float vig=1.-smoothstep(.30,1.05,length(p));
	float a=vig*(.30+.50*ramp+spec*.45)*uIntensity;

	gl_FragColor = premultiply(vec4(col*uIntensity,clamp(a,0.,1.)));
}
`;
