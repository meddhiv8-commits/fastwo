const PROMOTION_TYPES = new Set(["percentage", "fixed"]);

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function validatePromotion(promotion, basePrice) {
  const type = promotion?.type || "percentage";
  const value = toNumber(promotion?.value);
  const price = toNumber(basePrice);
  if (!PROMOTION_TYPES.has(type)) throw new Error("Type de remise invalide.");
  if (value <= 0) throw new Error("La remise doit être supérieure à zéro.");
  if (type === "percentage" && value > 100)
    throw new Error("La remise en pourcentage ne peut pas dépasser 100%.");
  if (type === "fixed" && value >= price)
    throw new Error("La remise fixe doit rester inférieure au prix.");
  if (
    promotion?.startsAt &&
    promotion?.endsAt &&
    new Date(promotion.endsAt).getTime() <=
      new Date(promotion.startsAt).getTime()
  ) {
    throw new Error("La fin de la promotion doit être après son début.");
  }
  return {
    enabled: promotion.enabled !== false,
    type,
    value,
    startsAt: promotion.startsAt || "",
    endsAt: promotion.endsAt || "",
    flashSale: Boolean(promotion.flashSale),
  };
}

export function getBasePrice(product) {
  return toNumber(
    product.basePrice || product.originalPrice || product.finalPrice,
  );
}

export function getPromotionState(product, now = Date.now()) {
  const basePrice = getBasePrice(product);
  const promotion = product.promotion;
  let discountAmount = 0;
  let discountLabel = "";
  let active = false;
  let activePromotion = null;

  if (promotion?.enabled) {
    const startsAt = promotion.startsAt
      ? new Date(promotion.startsAt).getTime()
      : -Infinity;
    const endsAt = promotion.endsAt
      ? new Date(promotion.endsAt).getTime()
      : Infinity;
    active = now >= startsAt && now <= endsAt;
    if (active) {
      activePromotion = promotion;
      discountAmount =
        promotion.type === "fixed"
          ? toNumber(promotion.value)
          : basePrice * (toNumber(promotion.value) / 100);
      discountLabel =
        promotion.type === "fixed"
          ? `-${toNumber(promotion.value)} TND`
          : `-${toNumber(promotion.value)}%`;
    }
  } else if (product.discount > 0 && product.originalPrice) {
    active = true;
    discountAmount = basePrice - toNumber(product.finalPrice);
    discountLabel = `-${toNumber(product.discount)}%`;
  }

  const finalPrice = Math.max(0, Math.round(basePrice - discountAmount));
  return {
    active,
    basePrice,
    finalPrice: active ? finalPrice : toNumber(product.finalPrice || basePrice),
    discountAmount: active ? Math.round(discountAmount) : 0,
    discountLabel,
    promotion: activePromotion,
  };
}
