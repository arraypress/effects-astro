/** The budget a shader is compiled for. */
export interface OceanQuality {
	/** How many waves in all. */
	waves: number;
	/** How many of the longest shape the surface the march finds. */
	geometry: number;
	/** March steps through the waves' band. */
	steps: number;
	/** False-position steps after the march. */
	refine: number;
}

/** The ocean's fragment shader (GLSL ES 1.00) for a budget. */
export function oceanShader(quality: OceanQuality): string;
