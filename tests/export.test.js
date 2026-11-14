import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssNumber, round2, escapeXml, matrixOf } from '../src/runtime/export/format.js';
import { pixelColor } from '../src/runtime/export/probe.js';
import { outerUrls, hasOuterUrl, blobToDataUrl, toDataUrl, inlineCssUrls } from '../src/runtime/export/fetch.js';
import { familyKey, noteUse, unicodeRanges, coversAny, servesWeight, fontSource, faceRule } from '../src/runtime/export/fonts.js';
import { kept, pseudoShows, PSEUDOS } from '../src/runtime/export/styles.js';
import { cssProperty, keyframeProps, mergeProps, clock } from '../src/runtime/export/clock.js';
import { rootStyle, pseudoCss, snapshotSvg } from '../src/runtime/export/snapshot.js';
import { attrValue, aboutOrigin } from '../src/runtime/export/svg-attrs.js';
import { transformText, groupLines } from '../src/runtime/export/svg-text.js';
import { plainTransform, describe, faded, inlinePictures } from '../src/runtime/export/clean-svg.js';
import { svgDataUrl } from '../src/runtime/export/raster.js';
import { fileSlug } from '../src/runtime/export/save.js';
import { canRecord, evenSize, pickFormat, eachFrame } from '../src/runtime/export/video.js';

// Just enough of a page for the fetch helpers: where it is, what it fetches, and
// a FileReader that turns a blob into a data: URL as a browser's does.
globalThis.location = /** @type {any} */ ({ href: 'https://example.test/cards/' });
globalThis.FileReader = /** @type {any} */ (
	class {
		/** @type {string | null} */
		result = null;
		/** @type {() => void} */
		onload = () => {};
		/** @type {() => void} */
		onerror = () => {};
		/**
		 * Reads a blob as a data: URL.
		 *
		 * @param {Blob} blob The blob.
		 */
		readAsDataURL(blob) {
			blob.arrayBuffer().then((b) => {
				this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;
				this.onload();
			});
		}
	}
);

/** @type {string[]} */
const fetched = [];
/** Paths the fake server answers 404 to, until they are taken off. */
const missing = new Set(['/gone.png']);
globalThis.fetch = /** @type {any} */ (
	async (/** @type {string} */ url) => {
		fetched.push(url);
		if (missing.has(new URL(url).pathname)) return new Response('', { status: 404 });
		return new Response(`file ${new URL(url).pathname}`, { headers: { 'content-type': 'image/png' } });
	}
);

/**
 * The data: URL the fake server's file at a path comes back as.
 *
 * @param {string} path The path.
 * @returns {string} Its data: URL.
 */
const dataOf = (path) => `data:image/png;base64,${Buffer.from(`file ${path}`).toString('base64')}`;

test('format: CSS numbers, two places, XML escapes and 2D matrices', () => {
	assert.equal(cssNumber('12.5px'), 12.5);
	assert.equal(cssNumber('auto'), 0);
	assert.equal(round2(1 / 3), '0.33');
	assert.equal(round2(2), '2');
	assert.equal(escapeXml('a < b & "c" > d'), 'a &lt; b &amp; &quot;c&quot; &gt; d');
	assert.deepEqual(matrixOf('matrix(1, 0, 0, 1, 10, 20)'), [1, 0, 0, 1, 10, 20]);
	assert.equal(matrixOf('none'), null);
	assert.equal(matrixOf('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'), null);
});

test('pixelColor: hex and alpha, un-premultiplied; null for a clear pixel', () => {
	assert.deepEqual(pixelColor(255, 92, 138, 255), { hex: '#ff5c8a', a: 1 });
	assert.deepEqual(pixelColor(0, 0, 0, 255), { hex: '#000000', a: 1 });
	// half-transparent white reads back premultiplied as 128s
	assert.deepEqual(pixelColor(128, 128, 128, 128), { hex: '#ffffff', a: 128 / 255 });
	assert.equal(pixelColor(10, 20, 30, 0), null);
});

test('outerUrls: quoted, single-quoted and bare URLs, not data: or #fragments', () => {
	const css = `background:url("/a.png");mask:url('b.svg'), url(c.png);filter:url(#f);list-style:url(data:image/png;base64,AA)`;
	assert.deepEqual(outerUrls(css), ['/a.png', 'b.svg', 'c.png']);
	assert.ok(hasOuterUrl(css));
	assert.ok(!hasOuterUrl('fill:url(#g);background:none'));
	// a url(#id) inside a quoted data: URL's own text is not another URL
	assert.deepEqual(outerUrls(`background:url("data:image/svg+xml,<use href='url(x.png)'/>")`), []);
});

test('blobToDataUrl: a blob as a data: URL', async () => {
	assert.equal(await blobToDataUrl(new Blob(['hi'], { type: 'text/plain' })), 'data:text/plain;base64,aGk=');
});

test('toDataUrl: resolves against the page, fetches once, passes data: through', async () => {
	const before = fetched.length;
	assert.equal(await toDataUrl('logo.png'), dataOf('/cards/logo.png'));
	assert.equal(await toDataUrl('https://example.test/cards/logo.png'), dataOf('/cards/logo.png'));
	assert.deepEqual(fetched.slice(before), ['https://example.test/cards/logo.png'], 'the same file is fetched once');
	assert.equal(await toDataUrl('data:text/plain,hi'), 'data:text/plain,hi');
	assert.equal(fetched.length, before + 1);
});

test('toDataUrl: a failed fetch rejects, and is tried again next time', async () => {
	await assert.rejects(toDataUrl('/gone.png'), /404 fetching https:\/\/example\.test\/gone\.png/);
	missing.delete('/gone.png');
	assert.equal(await toDataUrl('/gone.png'), dataOf('/gone.png'));
});

test('inlineCssUrls: every outer url() inlined however it is quoted; an unreachable one becomes none', async () => {
	missing.add('/broken.png');
	const css = `background-image:url("/bg.png");mask-image:url('/mask.png');border-image-source:url(/edge.png);filter:url(#f);list-style-image:url("/broken.png")`;
	assert.equal(
		await inlineCssUrls(css),
		`background-image:url("${dataOf('/bg.png')}");mask-image:url("${dataOf('/mask.png')}");border-image-source:url("${dataOf('/edge.png')}");filter:url(#f);list-style-image:none`,
	);
	assert.equal(await inlineCssUrls('color:red'), 'color:red');
});

test('fonts: family keys, the faces text asks for, unicode ranges and weights', () => {
	assert.equal(familyKey(' "Space Grotesk" '), 'space grotesk');
	/** @type {Map<string, import('../src/runtime/export/fonts.js').FontUse[]>} */
	const uses = new Map();
	noteUse(uses, { fontStyle: 'normal', fontWeight: '700', fontFamily: '"Inter", sans-serif' }, 'Hi');
	noteUse(uses, { fontStyle: 'oblique 10deg', fontWeight: 'bold', fontFamily: 'Inter' }, 'é');
	noteUse(uses, { fontStyle: 'normal', fontWeight: '400', fontFamily: 'Inter' }, '   ');
	const inter = /** @type {any[]} */ (uses.get('inter'));
	assert.deepEqual(
		inter.map((u) => [u.style, [...u.weights]]),
		[
			['normal', [700]],
			['italic', [400]],
		],
		'an oblique counts as italic, a weight that is not a number as 400, blank text not at all',
	);
	assert.ok(inter[0].chars.has('h'.codePointAt(0)) && inter[0].chars.has('I'.codePointAt(0)), 'both cases of each letter');
	assert.ok(uses.has('sans-serif'));

	assert.deepEqual(unicodeRanges(''), [[0, 0x10ffff]]);
	assert.deepEqual(unicodeRanges('U+0000-00FF, U+0131, u+02??'), [
		[0, 0xff],
		[0x131, 0x131],
		[0x200, 0x2ff],
	]);
	assert.ok(coversAny([0x41], unicodeRanges('U+0000-00FF')));
	assert.ok(!coversAny([0x416], unicodeRanges('U+0000-00FF')));

	assert.ok(servesWeight('400', [400]));
	assert.ok(servesWeight('400', [500]), 'the nearest the browser falls back to');
	assert.ok(!servesWeight('400', [700]));
	assert.ok(servesWeight('100 900', [650]), 'a variable face');
	assert.ok(servesWeight('normal', [900]), 'a descriptor that is not a number');
});

test('fonts: a face rule’s file and format, and the rule again with its file inlined', () => {
	assert.deepEqual(fontSource(`url("/f/inter.woff2") format("woff2"), url(/f/inter.woff) format('woff')`), { url: '/f/inter.woff2', format: 'woff2' });
	assert.deepEqual(fontSource('url(/f/inter.ttf)'), { url: '/f/inter.ttf', format: 'woff2' });
	assert.equal(fontSource('local(Inter)'), null);
	/** @type {Record<string, string>} */
	const desc = { 'font-family': 'Inter', 'font-style': 'normal', 'font-weight': '400', 'unicode-range': 'U+0000-00FF' };
	assert.equal(
		faceRule({ getPropertyValue: (p) => desc[p] ?? '' }, 'data:font/woff2;base64,AA', 'woff2'),
		'@font-face{font-family:Inter;font-style:normal;font-weight:400;unicode-range:U+0000-00FF;src:url("data:font/woff2;base64,AA") format("woff2");}',
	);
});

test('styles: which properties are kept, and which pseudo-elements show', () => {
	assert.deepEqual(PSEUDOS, ['::before', '::after']);
	for (const name of ['color', 'margin-top', 'transform', 'background-image', 'font-size']) assert.ok(kept(name), name);
	for (const name of ['--accent', 'animation-name', 'transition-duration', 'cursor', 'pointer-events', 'margin-block-start', 'inline-size', 'd', 'will-change'])
		assert.ok(!kept(name), name);
	assert.ok(pseudoShows({ content: '""', display: 'block' }));
	assert.ok(!pseudoShows({ content: 'none', display: 'block' }));
	assert.ok(!pseudoShows({ content: 'normal', display: 'block' }));
	assert.ok(!pseudoShows({ content: '"x"', display: 'none' }));
	assert.ok(!pseudoShows({ content: '', display: 'block' }));
});

test('clock: keyframe properties in CSS spelling, and what to read again', () => {
	assert.equal(cssProperty('backgroundColor'), 'background-color');
	assert.equal(cssProperty('--glow'), '--glow');
	assert.deepEqual([...keyframeProps([{ offset: 0, easing: 'linear', composite: 'auto', opacity: '0', backgroundColor: 'red' }, { offset: 1, computedOffset: 1, opacity: '1' }])], [
		'opacity',
		'background-color',
	]);
	assert.deepEqual(mergeProps(['opacity'], new Set(['transform', 'opacity'])), ['opacity', 'transform']);
	assert.equal(mergeProps(['opacity'], new Set(['--glow'])), 'all', 'a custom property reads everything again');
	assert.equal(mergeProps([], new Set()), 'all', 'keyframes that name nothing animate a custom property');
	assert.equal(mergeProps('all', new Set(['opacity'])), 'all');
});

test('clock: holds the animations, steps them together, and lets them run on', () => {
	const card = { name: 'card' };
	const dot = { name: 'dot' };
	/**
	 * An animation, just enough of one.
	 *
	 * @param {object} target What it moves.
	 * @param {object[]} keyframes Its keyframes.
	 * @param {{ pseudo?: string, state?: string, t?: number }} [o] Its pseudo-element, play state and time.
	 * @returns {any} The animation.
	 */
	const anim = (target, keyframes, { pseudo, state = 'running', t = 120 } = {}) => {
		const a = {
			currentTime: t,
			playState: state,
			plays: 0,
			effect: { target, pseudoElement: pseudo ?? null, getKeyframes: () => keyframes },
			pause: () => (a.playState = 'paused'),
			play: () => {
				a.plays++;
				a.playState = 'running';
			},
		};
		return a;
	};
	const anims = [
		anim(card, [{ offset: 0, opacity: '0' }]),
		anim(card, [{ offset: 0, transform: 'none' }]),
		anim(card, [{ offset: 0, opacity: '0' }], { pseudo: '::after' }),
		anim(dot, [{ offset: 0 }], { state: 'paused', t: 40 }),
	];
	const root = /** @type {any} */ ({ getAnimations: (/** @type {any} */ o) => (assert.deepEqual(o, { subtree: true }), anims) });
	const clk = clock(root);
	assert.equal(clk.count, 4);
	assert.ok(anims.every((a) => a.playState === 'paused'));
	assert.deepEqual(clk.moved(), [
		{ el: card, pseudo: undefined, props: ['opacity', 'transform'] },
		{ el: card, pseudo: '::after', props: ['opacity'] },
		{ el: dot, pseudo: undefined, props: 'all' },
	]);
	clk.seek(500);
	assert.ok(anims.every((a) => a.currentTime === 500));
	clk.release();
	assert.deepEqual(
		anims.map((a) => [a.currentTime, a.playState, a.plays]),
		[
			[120, 'running', 1],
			[120, 'running', 1],
			[120, 'running', 1],
			[40, 'paused', 0],
		],
		'each back where it was, and only the running ones run on',
	);
});

test('snapshot: the root’s reset, pseudo-element rules and the document round it', () => {
	assert.equal(
		rootStyle(320, 400, true),
		'margin:0;transform:none;translate:none;rotate:none;scale:none;box-shadow:none;position:relative;inset:auto;width:320px;height:400px;border-radius:0;',
	);
	assert.ok(!rootStyle(320, 400, false).includes('border-radius'));
	assert.equal(
		pseudoCss(
			new Map([
				['0::before', 'content:"";color:red;'],
				['12::after', 'opacity:0.5;'],
			]),
		),
		'.xs0::before{content:"";color:red;}\n.xs12::after{opacity:0.5;}',
	);
	assert.equal(
		snapshotSvg('<div/>', 320, 400, 2.5),
		'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 320 400"><foreignObject x="0" y="0" width="320" height="400"><div/></foreignObject></svg>',
	);
});

test('svg-attrs: computed values as attributes, and a transform about its origin', () => {
	const alpha = new Map();
	assert.equal(attrValue('fill', 'none', alpha), 'none');
	assert.equal(attrValue('fill', 'url("#grad") none', alpha), 'url(#grad)');
	assert.equal(attrValue('clip-path', 'url("#clip")', alpha), 'url(#clip)');
	assert.equal(attrValue('mask', 'none', alpha), 'none');
	assert.equal(attrValue('stroke-dasharray', '4px, 2px', alpha), '4 2');
	assert.equal(attrValue('font-family', '"Space Grotesk", sans-serif', alpha), "'Space Grotesk', sans-serif");
	assert.equal(attrValue('stroke-width', '1.5px', alpha), '1.5');
	assert.equal(attrValue('letter-spacing', 'normal', alpha), 'normal');
	assert.equal(alpha.size, 0);
	// identity stays put; a scale of 2 about (10, 10) moves the origin back by 10
	assert.equal(aboutOrigin([1, 0, 0, 1, 0, 0], 50, 50), 'matrix(1 0 0 1 0 0)');
	assert.equal(aboutOrigin([2, 0, 0, 2, 0, 0], 10, 10), 'matrix(2 0 0 2 -10 -10)');
	assert.equal(aboutOrigin([0, 1, -1, 0, 5, 0], 10, 0), 'matrix(0 1 -1 0 15 -10)');
});

test('svg-text: text-transform, and letters grouped into their lines', () => {
	assert.equal(transformText('make it yours', 'uppercase'), 'MAKE IT YOURS');
	assert.equal(transformText('Make It', 'lowercase'), 'make it');
	assert.equal(transformText('make it  yours', 'capitalize'), 'Make It  Yours');
	assert.equal(transformText('as is', 'none'), 'as is');
	/**
	 * A letter's box.
	 *
	 * @param {string} ch The letter.
	 * @param {number} left Its left.
	 * @param {number} top Its top.
	 * @returns {{ rect: { top: number, left: number, right: number, height: number }, ch: string }} The letter and its box.
	 */
	const g = (ch, left, top) => ({ rect: { top, left, right: left + 10, height: 20 }, ch });
	assert.deepEqual(groupLines([g('a', 0, 0), g('b', 10, 1), g(' ', 20, 0), g('c', 0, 24), g('d', 10, 24)]), [
		{ top: 0, h: 20, left: 0, right: 30, s: 'ab ' },
		{ top: 24, h: 20, left: 0, right: 20, s: 'cd' },
	]);
});

test('clean-svg: plain transforms, names, fades and pictures inlined', async () => {
	assert.ok(plainTransform('none'));
	assert.ok(plainTransform('matrix(2, 0, 0, 2, 10, 10)'));
	assert.ok(!plainTransform('matrix(0.7, 0.7, -0.7, 0.7, 0, 0)'));
	assert.ok(!plainTransform('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'));
	assert.equal(describe(/** @type {any} */ ({ localName: 'div', classList: ['card', 'wide', 'live'] })), 'div.card.wide');
	assert.equal(describe(/** @type {any} */ ({ localName: 'span', classList: [] })), 'span');
	assert.equal(faded('<rect/>', 0.5), '<g opacity="0.5"><rect/></g>');
	assert.equal(faded('<rect/>', 1), '<rect/>');
	assert.equal(faded('', 0.5), '');

	missing.add('/lost.jpg');
	const body = '<image data-src="/pic.png?w=2&amp;h=1" /><image data-src="data:image/gif;base64,R0" /><image data-src="/lost.jpg" />';
	assert.equal(await inlinePictures(body), `<image href="${dataOf('/pic.png')}" /><image href="data:image/gif;base64,R0" /><image href="" />`);
	assert.ok(fetched.includes('https://example.test/pic.png?w=2&h=1'), 'the URL is unescaped before it is fetched');
});

test('raster: SVG text as a data: URL', () => {
	const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>#1 & 50%</text></svg>';
	const url = svgDataUrl(svg);
	assert.ok(url.startsWith('data:image/svg+xml;charset=utf-8,'));
	assert.equal(decodeURIComponent(url.slice(url.indexOf(',') + 1)), svg);
	assert.doesNotMatch(url.slice(url.indexOf(',') + 1), /[#& ]/, 'nothing that would end or break the URL');
});

test('save: file names from any text', () => {
	assert.equal(fileSlug('Café Société'), 'cafe-societe');
	assert.equal(fileSlug('  Make it yours!  '), 'make-it-yours');
	assert.equal(fileSlug('Ünïcödé & Co. 2026'), 'unicode-co-2026');
	assert.equal(fileSlug('***'), 'export');
});

test('video: no recording without a browser, even sizes, the first format it can encode', async () => {
	assert.equal(canRecord(), false);
	assert.deepEqual(evenSize(1081, 1350), { width: 1080, height: 1350 });
	/**
	 * Just enough of mediabunny: the codecs this "browser" can encode, and the two formats.
	 *
	 * @param {string[]} can The codecs it can encode.
	 * @returns {any} The module.
	 */
	const mb = (can) => ({
		getFirstEncodableVideoCodec: async (/** @type {string[]} */ codecs) => codecs.find((c) => can.includes(c)) ?? null,
		Mp4OutputFormat: class {
			/** @param {object} o Its options. */
			constructor(o) {
				this.kind = 'mp4';
				this.options = o;
			}
		},
		WebMOutputFormat: class {
			kind = 'webm';
		},
	});
	const size = { width: 1080, height: 1350 };
	const mp4 = await pickFormat(mb(['avc', 'vp9']), size);
	assert.equal(mp4.codec, 'avc');
	assert.deepEqual([mp4.format.kind, mp4.format.options], ['mp4', { fastStart: 'in-memory' }]);
	const webm = await pickFormat(mb(['vp8', 'av1']), size);
	assert.deepEqual([webm.codec, webm.format.kind], ['vp8', 'webm']);
	await assert.rejects(pickFormat(mb([]), size), /cannot encode video/);
});

test('video: frames stepped at exact times, with progress, until stopped', async () => {
	/** @type {number[][]} */
	const made = [];
	/** @type {number[]} */
	const done = [];
	await eachFrame({ frames: 3, fps: 30, progress: (d) => done.push(d) }, async (t, dt) => {
		made.push([t, dt]);
	});
	assert.deepEqual(made, [
		[0, 1 / 30],
		[1 / 30, 1 / 30],
		[2 / 30, 1 / 30],
	]);
	assert.deepEqual(done, [1 / 3, 2 / 3, 1]);

	const stop = new AbortController();
	let count = 0;
	await assert.rejects(
		eachFrame({ frames: 10, fps: 30, signal: stop.signal }, async () => {
			if (++count === 2) stop.abort();
		}),
		{ name: 'AbortError' },
	);
	assert.equal(count, 2, 'no frame is made once it is stopped');
});
