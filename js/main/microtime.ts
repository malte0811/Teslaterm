let baseTime: bigint;

export function now(): number {
    const now_bigint = process.hrtime.bigint();
    if (!baseTime) {
        baseTime = now_bigint;
    }
    return Number((now_bigint - baseTime) / BigInt(1000));
}
