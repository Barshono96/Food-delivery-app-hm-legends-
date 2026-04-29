export function generateDriverId(): string {
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    return `Dv${randomDigits}`;
}
