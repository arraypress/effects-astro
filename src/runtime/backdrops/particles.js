/**
 * @module @arraypress/effects-astro/backdrops/particles
 *
 * Particles: three parallax layers of drifting, twinkling specks. Subtle enough for
 * dense hero copy.
 */

import { BACKDROP_GLSL } from './common.js';

/** The particles backdrop's fragment shader. */
export const PARTICLES = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 p=vec2(uv.x*ar,uv.y);
	vec3 col=vec3(0.);
	for(int i=0;i<3;i++){
		float fi=float(i);
		float scale=14.+fi*12.;
		vec2 drift=vec2(uTime*(.018+fi*.012),uTime*.008*(fi-1.));
		drift+=(uMouse-.5)*.04*(fi+1.);
		vec2 g=p*scale+drift*scale;
		vec2 id=floor(g);
		vec2 f=fract(g);
		vec2 pos=vec2(hash(id),hash(id+7.7))*.7+.15;
		float d=length(f-pos);
		float tw=.5+.5*sin(uTime*(.8+hash(id)*2.4)+hash(id)*6.28);
		vec3 c=i==0?uColor1:(i==1?uColor2:uColor3);
		col+=c*(.03/(d+.035))*tw*(.55-fi*.13);
	}
	col*=uIntensity;
	float a=clamp(max(max(col.r,col.g),col.b)*1.6,0.,1.);
	gl_FragColor = premultiply(vec4(col,a));
}
`;
