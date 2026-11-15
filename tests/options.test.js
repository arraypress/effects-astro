import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plainText } from '../src/components/text.js';

/**
 * Reads a file of the package.
 *
 * @param {string} path Its path from the package's root.
 * @returns {string} Its text.
 */
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('plainText: a slot as the words an attribute repeats', () => {
	assert.equal(plainText('Free logos'), 'Free logos');
	assert.equal(plainText('Noise,<br /> <em>on purpose.</em>'), 'Noise, on purpose.');
	assert.equal(plainText('Tom &amp; Jerry&#39;s &lt;b&gt; &quot;x&quot;'), 'Tom & Jerry\'s <b> "x"');
	assert.equal(plainText('don&#x2019;t&nbsp;stop'), 'don’t stop');
	assert.equal(plainText('  two\n\t lines  '), 'two lines');
	assert.equal(plainText('&unknown; &#1114112;'), '&unknown; &#1114112;');
});

test('border-sweep.css: the new options, and the defaults as they were', () => {
	const css = read('src/styles/border-sweep.css');
	// the ring sits on the edge unless --sweep-outset moves it out
	assert.match(css, /inset: calc\(var\(--sweep-outset, 0px\) \* -1\);/);
	// the default light's stops are unchanged
	assert.match(css, /transparent 62%,\n\t\tvar\(--sweep-color, currentColor\) 78%,\n\t\tcolor-mix\(in srgb, var\(--sweep-color, currentColor\) 35%, transparent\) 86%,\n\t\ttransparent 94%/);
	// the long light: a lead-in from half a lap
	assert.match(css, /\.sweep-ring--long::after \{\n\tbackground: conic-gradient\(\n\t\tfrom var\(--sweep-angle\),\n\t\ttransparent 0%,\n\t\ttransparent 50%,\n\t\tcolor-mix\(in srgb, var\(--sweep-color, currentColor\) 30%, transparent\) 64%/);
	// focus lights it unless told otherwise, without adding weight to the selectors
	assert.match(css, /\.sweep-ring:where\(:not\(\.sweep-ring--focus-none\)\):focus-visible::after/);
	assert.match(css, /\.sweep-ring:where\(:not\(\.sweep-ring--focus-visible, \.sweep-ring--focus-none\)\):focus-within::after/);
	assert.doesNotMatch(css, /^\.sweep-ring:focus-(visible|within)::after/m);
	// reduced motion: a still edge, or nothing
	const still = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
	assert.match(still, /box-shadow: inset 0 0 0 1px var\(--sweep-color, currentColor\);/);
	assert.match(still, /\.sweep-ring\.sweep-ring--still-none::after \{\n\t\tanimation: none;\n\t\topacity: 0;/);
});

test('BorderSweep: each new prop reaches its class or property', () => {
	const source = read('src/components/BorderSweep.astro');
	assert.match(source, /'sweep-ring--long': long/);
	assert.match(source, /focus !== 'within' && `sweep-ring--focus-\$\{focus\}`/);
	assert.match(source, /still !== 'ring' && `sweep-ring--still-\$\{still\}`/);
	assert.match(source, /outset !== undefined && `--sweep-outset: \$\{outset\}px`/);
});

test('glitch-text.css: pseudo copies and the skew, still with reduced motion', () => {
	const css = read('src/styles/glitch-text.css');
	assert.match(css, /\.glitch-text--pseudo::before,\n\.glitch-text--pseudo::after \{\n\tcontent: attr\(data-text\);/);
	assert.match(css, /\.glitch-text--skew > \.glitch-text-a,\n\.glitch-text--skew::before \{\n\tanimation-name: effect-glitch-text-skew-a;/);
	assert.match(css, /\.glitch-text--skew > \.glitch-text-b,\n\.glitch-text--skew::after \{\n\tanimation-name: effect-glitch-text-skew-b;/);
	for (const name of ['effect-glitch-text-skew-a', 'effect-glitch-text-skew-b', 'effect-glitch-text-skew']) assert.match(css, new RegExp(`@keyframes ${name} \\{`));
	assert.match(css, /89% \{\n\t\ttransform: translateX\(0\.012em\) skewX\(-4deg\);/);
	const still = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
	for (const sel of ['.glitch-text > *', '.glitch-text--pseudo', '.glitch-text--pseudo::before', '.glitch-text--pseudo::after', '.glitch-text--skew']) assert.ok(still.includes(sel), sel);
});

test('GlitchText: pseudo copies are one element with the words in data-text', () => {
	const source = read('src/components/GlitchText.astro');
	assert.match(source, /const pseudo = copies === 'pseudo';/);
	assert.match(source, /class:list=\{\['glitch-text', pseudo && 'glitch-text--pseudo', variant !== 'slice' && `glitch-text--\$\{variant\}`, className\]\}/);
	assert.match(source, /data-text=\{pseudo \? plainText\(html\) : undefined\}/);
});

test('Marquee: four copies a quarter apart by default; fewer move by one of theirs', () => {
	const source = read('src/components/Marquee.astro');
	assert.match(source, /copies = 4,/);
	assert.match(source, /const shift = copies === 4 \? '' : `; --marquee-shift: \$\{-100 \/ copies\}%`;/);
	assert.match(source, /transform: translateX\(var\(--marquee-shift, -25%\)\);/);
	assert.match(source, /'no-fade': fade === 0/);
	assert.match(source, /role = 'region',/);
	assert.match(source, /\.still-hold \.set\[aria-hidden='true'\] \{\n\t\t\tdisplay: flex;/);
});
