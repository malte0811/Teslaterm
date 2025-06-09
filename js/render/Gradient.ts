export interface Stripe {
    color: string;
    size: number;
}

export function buildGradientDefinition(angle: number, ...stripes: Stripe[]) {
    stripes = stripes.filter((color) => color.size > 0);
    if (stripes.length === 0) {
        return 'orange';
    } else if (stripes.length === 1) {
        return stripes[0].color;
    } else {
        const totalSize = stripes.map((s) => s.size).reduce((a, b) => a + b, 0);
        let spec = `linear-gradient(${angle}deg`;
        let sizeNow = 0;
        for (const color of stripes) {
            const newSize = sizeNow + Math.floor(100 * color.size / totalSize);
            spec += `, ${color.color} ${sizeNow}% ${newSize}%`;
            sizeNow = newSize;
        }
        return spec + ')';
    }
}
