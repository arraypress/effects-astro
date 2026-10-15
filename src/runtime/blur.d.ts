/** Blurs RGBA pixels in place: three box blurs each way, close to a Gaussian with a standard deviation of about `radius` pixels. */
export function boxBlur(data: Uint8ClampedArray, width: number, height: number, radius: number): void;
