/**
 * @module @arraypress/effects-astro/shader-backgrounds/silk
 *
 * Silk: flowing folds like a sheet of silk: fbm warped by fbm warped by fbm
 * (after Inigo Quilez's domain warping), where the warp fields themselves
 * flow, so the folds travel across the frame rather than churning in
 * place, with a sheen on the crests and a calmer middle for a headline.
 */

import { SHADER_BACKGROUND_GLSL } from './common.js';

/** The silk shader background's fragment shader. */
export const SILK = `${SHADER_BACKGROUND_GLSL}
/* Three octaves, not fbm's five: silk is BROAD soft folds. The extra
   octaves are what turned the first draft into marbled smoke. */
float fbm3(vec2 p){float v=0.;float a=.5;for(int i=0;i<3;i++){v+=a*vnoise(p);p*=2.03;a*=.5;}return v;}
void main(){
	vec2 uv=gl_FragCoord.xy/uRes;
	float ar=uRes.x/uRes.y;
	vec2 p=(uv-.5)*vec2(ar,1.)*.95;
	float t=uTime*.05;

	/* Slow drift of the whole sheet, plus a gentle cursor pull. */
	p=rot(p,t*.30);
	p+=(uMouse-.5)*vec2(ar,1.)*.20;

	/* Two warp fields that flow at different rates and in different
	   directions — the folds move because THESE move. */
	vec2 q=vec2(fbm3(p+vec2(t*.90,t*.30)),
	            fbm3(p+vec2(5.2,1.3)-vec2(t*.60,t*.80)));
	vec2 r=vec2(fbm3(p+2.1*q+vec2(1.7,9.2)+vec2(t*.45,-t*.25)),
	            fbm3(p+2.1*q+vec2(8.3,2.8)-vec2(t*.30,t*.50)));
	float f=fbm3(p+2.3*r);

	/* Colour: depth (c4 -> c2) by the folded field, cooler body (c3) where
	   the first warp is strong, accent (c1) on the high ridges. */
	/* fbm3 lives in ~.25-.65, so every threshold is centred there. */
	vec3 col=mix(uColor4,uColor2,smoothstep(.25,.55,f));
	col=mix(col,uColor3,smoothstep(.20,.55,dot(q,q)));
	col=mix(col,uColor1,smoothstep(.40,.64,r.y));

	/* Sheen: a soft, wide highlight along the fold crests. */
	float sheen=pow(clamp(1.-abs(f-.52)*3.,0.,1.),2.);
	col+=uColor1*sheen*.25;

	/* Coverage: a sheet, not pools — the troughs keep a FLOOR of the deep
	   colour (c4) rather than going see-through, which is what made the
	   first drafts read as faint smudges on the page. Radial falloff melts
	   the outer edge; a copy-safe dip keeps the centre (where hero text
	   sits) calmer; grain dithers the ramps. */
	float vig=1.-smoothstep(.45,1.35,length((uv-.5)*vec2(ar,1.)));
	float copy=mix(.7,1.,smoothstep(.05,.5,length((uv-vec2(.5,.52))*vec2(ar*.55,1.))));
	float g=hash(uv*uRes*.65+fract(uTime*.35)*vec2(19.,37.));
	float mask=clamp(.42+smoothstep(.28,.6,f)*.58+sheen*.3,0.,1.)*vig*copy*(1.+(g-.5)*.3);
	gl_FragColor = premultiply(vec4(clamp(col,0.,1.),clamp(mask*uIntensity,0.,1.)));
}
`;
