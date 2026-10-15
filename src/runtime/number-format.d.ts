/** How to write a number. */
export interface NumberStyle {
	/** A BCP 47 language tag. Default the page's `lang`, else the browser's. */
	locale?: string;
	/** An ISO 4217 code (`GBP`, `USD`) to write it as money. */
	currency?: string;
	/** Decimal places. Default as many as the number has, or a currency's own. */
	decimals?: number;
	/** Short form: 1.2K, 3.4M. Default false. */
	compact?: boolean;
}

/** Makes a formatter for a style. */
export function numberFormat(style: NumberStyle): (value: number) => string;
