export const getVectMag = (x: number, y: number): number => {
	return Math.sqrt(x ** 2 + y ** 2);
};

export function lightenColor(color: number, percent: number): number {
	const amt = Math.round(2.55 * percent);
	const R = ((color >> 16) & 0xFF) + amt;
	const G = ((color >> 8) & 0xFF) + amt;
	const B = (color & 0xFF) + amt;

	const newR = R < 255 ? (R < 0 ? 0 : R) : 255;
	const newG = G < 255 ? (G < 0 ? 0 : G) : 255;
	const newB = B < 255 ? (B < 0 ? 0 : B) : 255;

	return (newR << 16) + (newG << 8) + newB;
}

export function blendColors(color1: number, color2: number, amount: number): number {
    let r1 = (color1 >> 16) & 0xFF;
    let g1 = (color1 >> 8) & 0xFF;
    let b1 = color1 & 0xFF;

    let r2 = (color2 >> 16) & 0xFF;
    let g2 = (color2 >> 8) & 0xFF;
    let b2 = color2 & 0xFF;

    let r = Math.round(r1 + (r2 - r1) * amount);
    let g = Math.round(g1 + (g2 - g1) * amount);
    let b = Math.round(b1 + (b2 - b1) * amount);

    return (r << 16) + (g << 8) + b;
}