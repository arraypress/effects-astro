/**
 * @module @arraypress/effects-astro/backdrops/waves
 *
 * Waves: three glowing waveform lines across the middle: a signal, on brand for
 * audio shops.
 */

import { BACKDROP_GLSL } from './common.js';

/** The waves backdrop's fragment shader. */
export const WAVES = `${BACKDROP_GLSL}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	float t=uTime;
	vec3 col=vec3(0.);
	for(int i=0;i<3;i++){
		float fi=float(i);
		float yy=.5+(fi-1.)*.15+(uMouse.y-.5)*.05;
		float w=sin(uv.x*(4.5+fi*1.4)*ar*.6+t*(.45+fi*.2)+fi*2.1)
		       *sin(uv.x*1.6*ar-t*.3+fi*.7);
		float amp=.09+.045*fi;
		float d=abs(uv.y-yy-w*amp);
		vec3 c=i==0?uColor1:(i==1?uColor2:uColor3);
		col+=c*(.005/(d+.004))*.55;
	}
	col*=uIntensity;
	float a=clamp(max(max(col.r,col.g),col.b)*1.2,0.,1.);
	gl_FragColor = premultiply(vec4(col,a));
}
`;
