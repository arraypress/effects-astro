/** GLSL: `studio(dir, lightDir, light)`, the light a mirror facing `dir` sees in a dark studio (a softbox on the light's side, a strip light opposite, a dim fill), and `schlick(cosine, f0)`, Schlick's fresnel. */
export declare const GLSL_STUDIO: string;

/** A light angle (degrees, 0 right, 90 top) as a unit vector on the screen, y up. */
export declare function lightVector(degrees: number): [number, number];
