/** Loads and decodes an image with CORS, for a WebGL texture. Rejects when it cannot be loaded. */
export function loadImage(src: string): Promise<HTMLImageElement>;

/** Uploads a picture as a clamped, smoothly filtered texture on the active unit; `mipmap` where the GPU allows. */
export function imageTexture(gl: WebGLRenderingContext | WebGL2RenderingContext, source: TexImageSource, options?: { mipmap?: boolean }): WebGLTexture | null;

/** The texture-coordinate scale that makes a picture cover a box (CSS `object-fit: cover`), for `coverUv`. */
export function coverScale(imageAspect: number, boxAspect: number): [number, number];

/** GLSL: `coverUv(uv, scale)`, a box coordinate to a picture's, cropped to cover. */
export const GLSL_COVER: string;
