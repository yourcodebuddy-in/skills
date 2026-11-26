const SYMBOLS = { EUR: '€', GBP: '£', USD: '$' };

// The booking fee is a share of the subtotal in basis points, rounded to the nearest cent once per order.
export function bookingFee(subtotalCents, feeBps) {
  return Math.round((subtotalCents * feeBps) / 10_000);
}

export function formatMoney(cents, currency = 'EUR') {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${symbol}${whole}.${fraction}`;
}
