/**
 * What the gallery's pages share: its pages, in order, and the copy and
 * colours the heroes without copy of their own borrow.
 */

/** The pages, in the order the bar lists them. */
export const PAGES = [
	{ name: 'Backgrounds', href: '/' },
	{ name: 'Backdrop', href: '/backdrop' },
	{ name: 'Paper', href: '/paper' },
	{ name: 'Logos', href: '/logos' },
	{ name: 'Wordmarks', href: '/wordmarks' },
	{ name: 'Text', href: '/text' },
	{ name: 'Surfaces', href: '/surfaces' },
];

/** A made-up business for a hero with no copy of its own: who it is, what it says, and what it asks. */
export interface Pitch {
	brand: string;
	headline: string;
	lede: string;
	cta: string;
}

/** Copy for the heroes that have none of their own: fifteen made-up businesses, so no two neighbours read alike. */
export const PITCHES: Pitch[] = [
	{ brand: 'Brightside · banking', headline: 'Money that moves at your speed.', lede: 'Instant transfers, no hidden fees, and an app that actually explains where your money went.', cta: 'Open an account' },
	{ brand: 'Saltmarsh Coffee', headline: 'Roasted Monday. At your door Wednesday.', lede: 'Single-origin beans on a schedule that suits your cup, from a roastery by the sea.', cta: 'Choose a roast' },
	{ brand: 'Orbit · CRM', headline: 'Every customer, in one view.', lede: 'Notes, calls and invoices together, so nobody asks a client the same thing twice.', cta: 'Try Orbit free' },
	{ brand: 'Kiln & Co', headline: 'Handmade, a kiln at a time.', lede: 'Small batches of stoneware from a two-person studio. This firing ships on Friday.', cta: 'Shop the firing' },
	{ brand: 'Tempo · run coaching', headline: 'Train for the race you want.', lede: 'Plans that adapt to how your week actually went, not how you hoped it would.', cta: 'Start training' },
	{ brand: 'Paperline · invoicing', headline: 'Get paid in days, not months.', lede: 'Send an invoice in a minute. We chase it politely, so you never have to.', cta: 'Send your first invoice' },
	{ brand: 'Fernway · rail journeys', headline: 'Slow trips, well planned.', lede: 'Rail-first itineraries across Europe, booked end to end, with a person on call.', cta: 'Plan a journey' },
	{ brand: 'Meridian Solar', headline: 'Your roof, earning.', lede: 'Panels and a battery fitted in a day, at a fixed price agreed before we start.', cta: 'Get a quote' },
	{ brand: 'Quill · writing app', headline: 'Write first. Edit later.', lede: 'A quiet editor that keeps every draft and gets out of the way of the sentence.', cta: 'Download Quill' },
	{ brand: 'Granary · bakery', headline: 'Bread worth waiting for.', lede: 'Sourdough proved overnight and on your doorstep by eight, three mornings a week.', cta: 'Start a subscription' },
	{ brand: 'Sparrow Health', headline: 'A GP, the same day.', lede: 'Video appointments with doctors who can see your history before you say a word.', cta: 'Book an appointment' },
	{ brand: 'Arcade Supply · game assets', headline: 'Ship your game sooner.', lede: 'Sprites, sound effects and shaders, licensed for anything you make with them.', cta: 'Browse assets' },
	{ brand: 'Studio Halden · architects', headline: 'Buildings that age well.', lede: 'Low-carbon homes and workplaces, designed to be loved for a century.', cta: 'See our work' },
	{ brand: 'Pulse · fitness', headline: 'Thirty minutes. Every muscle.', lede: 'Small classes, real coaches and a timetable that fits before work.', cta: 'Book a class' },
	{ brand: 'Lantern · research', headline: 'Answers you can check.', lede: 'Ask a question and get a short answer with every source linked, nothing invented.', cta: 'Join the beta' },
];

/**
 * The made-up business for the nth hero without copy.
 *
 * @param i Which hero.
 * @returns Its pitch.
 */
export const pitch = (i: number): Pitch => PITCHES[i % PITCHES.length];
/** Accents for heroes that take one, chosen to look like real brands, not one shade of violet. */
export const ACCENTS = ['#f97316', '#10b981', '#0ea5e9', '#f43f5e', '#eab308', '#14b8a6', '#84cc16', '#6366f1'];
/**
 * A shader's file name as a title: `halftone-dots` → `Halftone Dots`.
 *
 * @param name The name.
 * @returns The title.
 */
export const title = (name: string) => name.replace(/(^|-)(\w)/g, (_, dash, c) => (dash ? ' ' : '') + c.toUpperCase());

/** Paper shaders that bend a photo, and those that work on a logo's shape. */
export const PICTURES = ['fluted-glass', 'water', 'lens-distortion', 'image-dithering', 'halftone-dots', 'halftone-cmyk', 'paper-texture'];
export const LOGOS = ['liquid-metal', 'heatmap', 'gem-smoke'];
