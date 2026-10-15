/**
 * @module @arraypress/effects-astro/shader-backgrounds/common
 *
 * What every shader background shader starts with: its uniforms, the noise they
 * share, a rotation, a vortex, and `premultiply`.
 *
 * The noise is the shader backgrounds' own (`hash`, value noise `vnoise`, and a
 * five-octave `fbm` without rotation between octaves), not glsl.js's: the
 * two give different fields, and every shader background was tuned against this one.
 *
 * Uniforms (set by shader-background.js):
 *
 * - `uRes`: the canvas size in pixels.
 * - `uTime`: seconds since it started, times `speed`.
 * - `uColor1`…`uColor4`: the colours, 0–1. Only mesh-gradient,
 *   grain-gradient and silk read the fourth.
 * - `uIntensity`: the strength, 0–2.
 * - `uMouse`: the smoothed pointer, 0–1 from the bottom left (the middle when idle).
 *
 * Each shader works out a straight colour and an alpha that follows its
 * brightness, so dark pixels let the page through, and hands them to
 * `premultiply` for the stage's premultiplied canvas.
 */

/** GLSL: the shader backgrounds' precision, uniforms, noise, rotation, vortex and `premultiply`. */
export const SHADER_BACKGROUND_GLSL = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uIntensity;
uniform vec2 uMouse;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);
	float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
	return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p*=2.03;a*=.5;}return v;}
/* Rotates p about the origin by a radians. */
vec2 rot(vec2 p,float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c)*p;}
/* A vortex: turns hardest at the centre, falling to nothing by the edge, so it reads as a swirl rather than a spin. */
vec2 swirl(vec2 p,float amt){float r=length(p);return rot(p,amt*(1.-smoothstep(0.,.9,r)));}
/* A straight colour and alpha as the premultiplied canvas takes them (each clamped to 0-1 first, as a straight canvas would). */
vec4 premultiply(vec4 c){c=clamp(c,0.,1.);return vec4(c.rgb*c.a,c.a);}
`;
