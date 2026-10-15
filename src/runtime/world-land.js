/**
 * @module @arraypress/effects-astro/world-land
 *
 * Where the land is, at 1.5° a cell, for drawing a world map without
 * shipping one: Natural Earth's 1:110m land (public domain), sampled on
 * an equirectangular grid from 84°N to 60°S (Antarctica left out), and
 * stored as runs of sea and land, alternately, in base 36.
 */

/** The grid: columns from 180°W, rows from 84°N, each `step` degrees. */
export const LAND = {
	cols: 240,
	rows: 96,
	step: 1.5,
	top: 84,
	runs:
		'2m,9,5g,h,2,r,3,3,55,6,3,8,2,x,o,6,d,2,s,5,2r,1,4,3,1,2,1,4,1,7,4,y,l,5,1i,3,2i,2,j,6,7,x,m,3,1k,2,2k,4,1,2,3,' +
		'3,3,2,4,1,f,r,1g,4,j,e,g,4,1p,3,16,o,1f,2,j,f,2c,4,1,3,1,1,1,2,2,3,1,2,2,6,h,m,1e,2,9,2,6,w,7,2,p,2,d,1,m,1,3,' +
		'8,6,2,2,c,d,8,c,1b,3,3,7,3,1,11,2,d,u,f,6,4,2,1,3,b,1,1,1,2,5,1,4,7,9,k,t,9,i,1,4,3,1,1l,7,5,4,7,z,4,2,4,2,1,4' +
		',2,2,6,4,a,f,u,g,3,2,3,2,1,8,1,3,1,21,1,2,6,1h,6,8,5,d,w,i,3,i,1,1z,3,2,4,1h,1,1,4,7,2,1,7,8,c,6,h,6,3,6,4,2y,' +
		'1b,2,2,1,2,5,5,9,7,d,2,i,7,2,2w,b,1c,6,1,3,3,3,2,b,5,w,8,2,2n,1,8,c,b,1,z,b,6,f,2,w,9,2,2i,5,5,i,5,a,u,b,6,2,2' +
		',1a,8,4,28,2,1,2,2,4,2,q,1,1,1,d,r,b,a,11,1,b,3,5,25,c,3,p,1,i,u,7,a,11,2,7,2,1,3,3,26,c,5,l,1,m,w,2,f,x,1,1,2' +
		',7,1,4,1,1,25,e,4,17,1,2,v,2,g,v,2,1,3,3,2k,9,3,1c,v,1,f,z,4,2,2k,9,1,1e,15,2,2,10,2,3,2l,1,1,1o,12,1,2,4,3,x,' +
		'1,1,2m,1s,14,7,1,x,2n,1s,17,13,l,2,1,2,7,3,1l,1t,11,2,1,16,9,2,9,7,5,3,1l,3,2,1p,10,15,8,5,2,3,7,9,4,3,1h,5,3,' +
		'1p,z,16,7,8,2,2,6,2,4,2,6,3,1e,1z,y,17,6,a,1,2,2,3,f,3,18,1,1,1,2,8,2,1r,w,18,6,a,1,3,2,2,f,3,17,4,3,7,1,1t,u,' +
		'1b,3,3,1,1,3,b,1r,3,2,5,3,1t,u,1b,2,1,8,9,2,4,1,1,1k,4,2,2,6,1v,r,1b,c,h,1k,8,3,1z,o,1c,g,3,2,8,1m,6,1,23,1,1,' +
		'l,1c,i,1,1w,2a,1,1,c,2,1,5,1,1b,13,2,1b,2a,2,1,9,a,1,19,v,2,9,2,1a,2c,1,1,8,a,2,1,1,15,x,1,9,4,17,2d,1,2,7,1j,' +
		'x,2,9,2,2,7,y,2i,6,1i,z,2,d,7,w,2,1,2h,5,c,1,15,10,1,e,6,d,2,e,2n,5,5,2,6,3,12,10,2,c,a,9,4,9,2s,5,3,3,a,2,z,1' +
		'0,2,b,b,7,7,8,1,2,2r,8,1c,11,2,9,c,6,8,8,9,2,2l,1,2,6,19,11,2,7,e,5,9,1,1,7,8,1,2q,6,18,13,1,4,h,3,c,8,7,1,2t,' +
		'2,19,15,k,3,d,7,9,1,2s,1,7,1,1,1,10,13,3,2,h,2,g,3,9,1,1,1,2s,1,5,2,1,6,w,17,h,2,h,1,36,1,2,c,v,16,k,1,b,2,f,2' +
		',2w,d,v,15,k,1,d,1,f,1,2w,h,t,6,3,t,w,1,2,2,8,2,32,h,14,q,w,2,1,2,7,2,32,i,14,p,y,2,1,1,5,5,30,k,13,n,11,3,4,6' +
		',1,3,2,1,2s,n,11,m,13,2,4,5,7,1,2,1,2p,o,10,l,14,3,3,5,1,2,8,1,1,2,2l,s,x,k,15,3,5,1,4,1,2,1,4,7,2i,u,w,i,17,2' +
		',l,5,2h,v,v,i,18,2,2,1,e,1,2,6,6,1,2a,u,w,h,1c,3,f,4,1,2,7,1,29,s,x,i,1j,1,f,2,2g,r,y,i,4i,q,y,i,1o,4,4,1,2l,p' +
		',y,j,5,1,1f,1,1,5,3,2,2m,o,y,j,4,3,1d,8,3,3,2n,m,y,h,4,4,1d,b,1,3,2o,l,y,g,5,4,1c,h,2n,k,10,e,7,2,1b,k,a,1,2b,' +
		'k,10,f,5,3,19,n,a,1,2a,i,13,e,5,3,18,p,2k,f,16,d,6,2,19,q,2j,f,16,c,1i,q,2j,f,16,c,1i,q,2i,f,18,a,1k,p,2i,e,1a' +
		',8,1l,p,2i,d,1b,7,1m,8,4,d,2i,c,1c,5,1o,6,7,1,1,9,2j,a,3m,8,f,1,23,b,3n,7,g,1,22,a,3p,2,1,1,i,3,20,8,4d,2,21,6' +
		',3w,2,h,1,22,6,3w,2,f,2,22,6,4c,2,24,5,4c,3,24,6,6i,5,6j,4,6k,4,5,2,6e,4,6l,5,oj',
};

/** @type {Uint8Array | null} */
let cells = null;

/**
 * The grid decoded, once: 1 for land, 0 for sea, row by row from 84°N.
 *
 * @returns {Uint8Array} The cells.
 */
function grid() {
	if (!cells) {
		const decoded = new Uint8Array(LAND.cols * LAND.rows);
		let at = 0;
		LAND.runs.split(',').forEach((run, i) => {
			const length = parseInt(run, 36);
			if (i % 2) decoded.fill(1, at, at + length);
			at += length;
		});
		cells = decoded;
	}
	return cells;
}

/**
 * One cell, with longitude wrapping round the world and anything off the
 * grid's top or bottom counted as sea.
 *
 * @param {number} row The row, from 84°N.
 * @param {number} col The column, from 180°W (any whole number).
 * @returns {number} 1 for land, 0 for sea.
 */
function cell(row, col) {
	if (row < 0 || row >= LAND.rows) return 0;
	return grid()[row * LAND.cols + (((col % LAND.cols) + LAND.cols) % LAND.cols)];
}

/**
 * Whether a point is on land.
 *
 * @param {number} lat Latitude, degrees north.
 * @param {number} lon Longitude, degrees east.
 * @returns {boolean} True on land.
 */
export function isLand(lat, lon) {
	return cell(Math.floor((LAND.top - lat) / LAND.step), Math.floor((lon + 180) / LAND.step)) === 1;
}

/**
 * How much of the land is at a point, blended between the four nearest
 * cell centres. Above one half is land: a map zoomed in far enough that a
 * cell spans several dots gets rounded coasts rather than 1.5° steps.
 *
 * @param {number} lat Latitude, degrees north.
 * @param {number} lon Longitude, degrees east.
 * @returns {number} 0 (open sea) to 1 (inland).
 */
export function landAt(lat, lon) {
	const y = (LAND.top - lat) / LAND.step - 0.5;
	const x = (lon + 180) / LAND.step - 0.5;
	const row = Math.floor(y);
	const col = Math.floor(x);
	const fy = y - row;
	const fx = x - col;
	const top = cell(row, col) * (1 - fx) + cell(row, col + 1) * fx;
	const bottom = cell(row + 1, col) * (1 - fx) + cell(row + 1, col + 1) * fx;
	return top * (1 - fy) + bottom * fy;
}
