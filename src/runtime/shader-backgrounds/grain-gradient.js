/**
 * @module @arraypress/effects-astro/shader-backgrounds/grain-gradient
 *
 * Grain gradient: the grainy-gradient poster look. Three large, soft
 * lights sweep slow loops round the copy through deep shadow, stretched
 * along their paths, folded by a broad warp, merging and parting: one in
 * the accent, one in the fourth colour and one drifting between the two,
 * with the lifted third glinting where they gather. Colour runs from the
 * deep second colour up through the lights' own, blended in Oklab.
 *
 * The grain is dither, not static: each pixel's place on that ramp is
 * jittered by fine triangular noise, a new frame twelve times a second
 * whatever the `speed`, so the lights' edges dissolve into specks of
 * colour, heaviest in the shadows as film grain is. The middle stays
 * darker and calmer for the copy. With `interactive`, the pointer pushes
 * the field aside and lights it where it rests. `intensity` sets how much
 * light there is.
 *
 * Dithering the ramp position is Paper's grain-gradient technique
 * (paper-design/shaders, Apache-2.0); the field and ramp are this
 * package's own. The grain hash is Dave Hoskins' "Hash without Sine" (MIT).
 */

import { SHADER_BACKGROUND_GLSL } from './common.js';
import { GLSL_OKLAB } from '../color.js';

/** The grain gradient shader background's fragment shader. */
export const GRAIN_GRADIENT = `${SHADER_BACKGROUND_GLSL}
${GLSL_OKLAB}
/* A hash fine enough for per-pixel grain (Dave Hoskins' Hash without Sine): the shared one streaks at pixel scale. */
float grain(vec2 p){vec3 p3=fract(p.xyx*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
/* One light: a soft glow on a slow loop round the middle, stretched along
   its path so it sweeps; k sets its size. */
float light(vec2 q,float th,float k,float w){vec2 c=vec2(.64,.4)*(1.+.18*sin(th*1.7+w))*vec2(cos(th),sin(th));vec2 v=rot(q-c,-th)*vec2(1.,2.2);return exp(-dot(v,v)*k);}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 at=(uv-.5)*vec2(ar,1.);
	float t=uTime*.12+8.;

	/* The pointer: a soft lens that pushes the field away from it. */
	vec2 d=at-(uMouse-.5)*vec2(ar,1.);
	float near=exp(-dot(d,d)*5.)*uPointer;
	vec2 p=at-d*.35*near;

	/* One broad warp, so the lights fold and morph as they sweep. */
	vec2 w=vec2(vnoise(p*1.6+vec2(t*.5,-t*.3)),vnoise(p*1.6+vec2(5.3-t*.4,1.7+t*.25)))-.5;
	vec2 q=p+w*.55;

	/* Three lights looping round the copy: two opposite each other, so
	   the frame stays balanced, and one the other way that meets, merges
	   with and parts from each. One in the accent, one in the fourth
	   colour, and one drifting between the two; where they gather, the
	   lifted third glints. Colours are blended in Oklab. */
	float th=t*.8;
	float l1=light(q,th,3.6,0.);
	float l2=light(q,th+3.14+.7*sin(t*.37),4.2,2.);
	float l3=light(q,2.-t*.6,5.,4.);
	float s=l1+l2+l3;
	float u=.5+.5*sin(t*.45);
	float w1=l1*l1+l3*l3*(1.-u),w4=l2*l2+l3*l3*u;
	vec3 body=(toOklab(uColor1)*w1+toOklab(uColor4)*w4)/max(w1+w4,1e-4);
	/* Calmer in the middle, for the copy; brighter towards the pointer. */
	float mid=exp(-dot(at*vec2(.8,1.4),at*vec2(.8,1.4))*4.);
	s*=1.-.62*mid;
	s+=.3*near;
	s*=.75+.25*uIntensity;

	/* Dither: triangular noise, a new frame twelve times a second whatever
	   the speed, moves each pixel along the ramp; wider in the shadows, as
	   film grain is, and a little calmer behind the copy. */
	float frame=floor(uClock*12.);
	vec2 px=gl_FragCoord.xy+fract(frame*.618)*vec2(173.,311.);
	float g=grain(px)+grain(px+vec2(41.,289.))-1.;
	float sd=s+g*(.09+.28*(1.-clamp(s,0.,1.)))*(1.-.35*mid);

	/* The ramp: the deep colour, then the lights' own, then the glint. */
	vec3 lab=mix(toOklab(uColor2),body,smoothstep(.2,.8,sd));
	vec3 col=fromOklab(mix(lab,toOklab(uColor3),smoothstep(.9,1.7,sd)*.85));
	/* A light film grain over the colour. */
	col*=1.+g*.06;

	/* Alpha follows the light, so the shadows let the page through. */
	float a=smoothstep(.18,.6,sd)*min(uIntensity,1.);
	gl_FragColor = premultiply(vec4(col,a));
}
`;
