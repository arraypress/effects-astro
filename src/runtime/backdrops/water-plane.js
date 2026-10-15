/**
 * @module @arraypress/effects-astro/backdrops/water-plane
 *
 * Water plane: a glossy sheet rippling away to a horizon: a raked ground plane, where
 * the perspective divide packs the ripples towards the horizon and a
 * normal from the height field gives the sheen. Clear above the horizon.
 */

import { BACKDROP_GLSL } from './common.js';

/** The water plane backdrop's fragment shader. */
export const WATER_PLANE = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	float t=uTime*.20;

	/* Everything above the horizon is empty sky — bail early so the
	   canvas stays transparent there and the hero text keeps its
	   contrast. */
	float horizon=.72;
	float d=horizon-uv.y;
	if(d<=.001){ gl_FragColor = premultiply(vec4(0.)); return; }

	/* Perspective: depth explodes as we approach the horizon line. The
	   +.10 floor caps it so the far field doesn't alias into noise. */
	float depth=1./(d*5.5+.10);
	vec2 pp=vec2((uv.x-.5)*ar*depth,depth)*1.2;

	/* Height field — two decorrelated octaves drifting toward camera. */
	vec2 flow=vec2(0.,-t*1.7);
	float h=fbm(pp+flow)+.5*fbm(pp*2.1+vec2(t*.6,-t*1.2));

	/* Normal by finite difference on the same field. The step scales
	   with depth so it stays roughly screen-constant. */
	float e=.035*depth;
	float hx=fbm(pp+vec2(e,0.)+flow)+.5*fbm((pp+vec2(e,0.))*2.1+vec2(t*.6,-t*1.2));
	float hy=fbm(pp+vec2(0.,e)+flow)+.5*fbm((pp+vec2(0.,e))*2.1+vec2(t*.6,-t*1.2));
	vec3 n=normalize(vec3((h-hx)*3.4,(h-hy)*3.4,1.));

	/* Colour ramp across the height, then a specular lift toward the
	   third colour so crests read as sheen rather than a lighter tint. */
	float ramp=clamp(h*.85+.15,0.,1.);
	vec3 col=mix(uColor1,uColor2,smoothstep(.15,.85,ramp));
	float spec=pow(max(dot(n,normalize(vec3(.35,.55,.75))),0.),18.);
	col=mix(col,uColor3,spec*.55);

	/* Coverage: fade the sheet out at the horizon and at the very
	   bottom edge so it sits in the layout instead of ending flat. */
	float far=smoothstep(.0,.16,d);
	float near=1.-smoothstep(.72,1.0,d);
	float a=far*near*(.34+.46*ramp+spec*.5)*uIntensity;

	gl_FragColor = premultiply(vec4(col*uIntensity,clamp(a,0.,1.)));
}
`;
