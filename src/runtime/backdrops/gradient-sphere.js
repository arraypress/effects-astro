/**
 * @module @arraypress/effects-astro/backdrops/gradient-sphere
 *
 * Gradient sphere: a soft lit orb: the surface solved from the circle's equation, its
 * normal bent by moving noise, with a rim that lifts the silhouette.
 */

import { BACKDROP_GLSL } from './common.js';

/** The gradient sphere backdrop's fragment shader. */
export const GRADIENT_SPHERE = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 p=(uv-.5)*vec2(ar,1.);
	float t=uTime*.15;

	vec2 c=vec2(.06,-.02)+(uMouse-.5)*vec2(ar,1.)*.06;
	float R=.66;
	vec2 rel=p-c;
	float r=length(rel);

	/* Surface normal from the implicit sphere. Outside the radius we
	   clamp to the silhouette so the rim glow still has a normal. */
	float z=sqrt(max(R*R-r*r,0.));
	vec3 n=normalize(vec3(rel,z+1e-4));

	/* Two octaves over the surface, advected so it churns in place, then
	   perturb the normal by their gradient so the light reacts to the
	   churn instead of sliding over a perfect sphere. */
	float nz=fbm(n.xy*2.4+vec2(t,-t*.8))+.5*fbm(n.xy*5.0+vec2(-t*.7,t*1.1));
	float e=.045;
	float nzx=fbm((n.xy+vec2(e,0.))*2.4+vec2(t,-t*.8))+.5*fbm((n.xy+vec2(e,0.))*5.0+vec2(-t*.7,t*1.1));
	float nzy=fbm((n.xy+vec2(0.,e))*2.4+vec2(t,-t*.8))+.5*fbm((n.xy+vec2(0.,e))*5.0+vec2(-t*.7,t*1.1));
	n=normalize(n+vec3((nz-nzx)*.55,(nz-nzy)*.55,0.));

	float ramp=clamp(nz*.85+.12+n.y*.25,0.,1.);
	vec3 col=mix(uColor1,uColor2,smoothstep(.16,.86,ramp));
	float spec=pow(max(dot(n,normalize(vec3(-.35,.6,.72))),0.),22.);
	col=mix(col,uColor3,spec*.6);

	/* Soft body + a rim that lifts the silhouette. */
	float body=1.-smoothstep(R*.72,R*1.04,r);
	float rim=smoothstep(R*.80,R*1.0,r)*(1.-smoothstep(R*1.0,R*1.22,r));
	float a=(body*(.34+.46*ramp+spec*.5)+rim*.30)*uIntensity;

	gl_FragColor = premultiply(vec4(col*uIntensity,clamp(a,0.,1.)));
}
`;
