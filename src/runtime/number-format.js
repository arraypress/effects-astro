/**
 * @module @arraypress/effects-astro/number-format
 *
 * Numbers written the reader's way, for effects that show amounts: the
 * page's language, a currency, a fixed number of decimals or compact
 * notation (1.2K).
 */

/**
 * @typedef {object} NumberStyle
 * @property {string} [locale] A BCP 47 language tag. Default the page's `lang`, else the browser's.
 * @property {string} [currency] An ISO 4217 code (`GBP`, `USD`) to write it as money.
 * @property {number} [decimals] Decimal places. Default as many as the number has, or a currency's own.
 * @property {boolean} [compact=false] Short form: 1.2K, 3.4M.
 */

/**
 * Makes a formatter for a style.
 *
 * @param {NumberStyle} style How to write numbers.
 * @returns {(value: number) => string} Writes a number.
 */
export function numberFormat({ locale, currency, decimals, compact = false }) {
	const lang = locale || (typeof document !== 'undefined' && document.documentElement.lang) || undefined;
	const format = new Intl.NumberFormat(lang, {
		style: currency ? 'currency' : 'decimal',
		currency,
		notation: compact ? 'compact' : 'standard',
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals ?? (compact ? 1 : undefined),
	});
	return (value) => format.format(value);
}
