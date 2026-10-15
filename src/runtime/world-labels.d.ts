/** A name to place beside its city. */
export interface LabelItem {
	/** The city, CSS px. */
	x: number;
	y: number;
	/** The name's size, CSS px. */
	w: number;
	h: number;
	/** Space between the city's centre and its name. */
	gap: number;
	/** Show it even where it overlaps. */
	force?: boolean;
}

/** A box: its top left and size. */
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Places names beside their cities, most important first: right, left,
 * above or below, whichever first covers no placed name and no obstacle
 * and stays in `bounds` (null for anywhere). A name with nowhere to go is
 * null, unless `force` puts it on the first side that fits the bounds.
 */
export function placeLabels(items: LabelItem[], obstacles: Rect[], bounds: { width: number; height: number } | null): (Rect | null)[];
