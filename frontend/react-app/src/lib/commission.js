export function getCommissionRate(price) {
  const amount = Number(price) || 0;
  if (amount >= 1000) return 0.08;
  if (amount >= 400) return 0.1;
  return 0.12;
}

export function calculateCommission(price) {
  const amount = Number(price) || 0;
  const rate = getCommissionRate(amount);
  const commission = Math.round(amount * rate * 100) / 100;
  return {
    rate,
    commission,
    sellerPayout: Math.max(0, Math.round(amount * 100) / 100),
    publicPrice: Math.round(amount + commission),
  };
}
