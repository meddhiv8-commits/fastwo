const crypto = require("crypto");

function requireSupabase(supabase) {
  if (!supabase) throw new Error("Base de données indisponible");
}

function activePromotion(product, now = Date.now()) {
  if (!product.promotion_enabled) return null;
  const starts = product.promotion_starts_at
    ? new Date(product.promotion_starts_at).getTime()
    : -Infinity;
  const ends = product.promotion_ends_at
    ? new Date(product.promotion_ends_at).getTime()
    : Infinity;
  if (now < starts || now > ends) return null;
  const basePrice = Number(product.base_price || product.final_price);
  const value = Number(product.promotion_value || 0);
  const amount =
    product.promotion_type === "fixed" ? value : basePrice * (value / 100);
  return {
    type: product.promotion_type,
    value,
    flashSale: Boolean(product.flash_sale),
    startsAt: product.promotion_starts_at,
    endsAt: product.promotion_ends_at,
    discountAmount: Math.round(amount),
    finalPrice: Math.max(0, Math.round(basePrice - amount)),
  };
}

function presentProduct(product) {
  const promotion = activePromotion(product);
  const basePrice = Number(product.base_price || product.final_price);
  return {
    id: product.id,
    sku: product.sku,
    brand: product.brand,
    model: product.model,
    category: product.category,
    condition: product.condition,
    size: product.taille,
    available: product.status === "APPROVED",
    price: promotion?.finalPrice || Number(product.final_price),
    originalPrice: promotion ? basePrice : null,
    promotion,
  };
}

async function searchProducts(
  supabase,
  { query = "", category = "", size = "", maxPrice = null } = {},
) {
  requireSupabase(supabase);
  let request = supabase
    .from("products")
    .select(
      "id, sku, brand, model, category, condition, taille, final_price, base_price, status, promotion_enabled, promotion_type, promotion_value, promotion_starts_at, promotion_ends_at, flash_sale",
    )
    .eq("status", "APPROVED")
    .limit(12);
  const cleanQuery = String(query).trim();
  if (cleanQuery)
    request = request.or(
      `brand.ilike.%${cleanQuery}%,model.ilike.%${cleanQuery}%,category.ilike.%${cleanQuery}%,sku.ilike.%${cleanQuery}%`,
    );
  if (category) request = request.eq("category", category);
  if (size) request = request.eq("taille", size);
  const { data, error } = await request;
  if (error) throw error;
  return (data || [])
    .map(presentProduct)
    .filter((product) => maxPrice == null || product.price <= Number(maxPrice));
}

async function getProductDetails(supabase, { productId = null, sku = null }) {
  requireSupabase(supabase);
  let request = supabase.from("products").select("*").eq("status", "APPROVED");
  request = productId ? request.eq("id", productId) : request.eq("sku", sku);
  const { data, error } = await request.maybeSingle();
  if (error) throw error;
  return data ? presentProduct(data) : null;
}

async function checkInventory(supabase, args) {
  const product = await getProductDetails(supabase, args);
  return product
    ? { product, available: product.available }
    : { product: null, available: false };
}

async function getActivePromotions(supabase) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("status", "APPROVED")
    .eq("promotion_enabled", true);
  if (error) throw error;
  return (data || [])
    .map(presentProduct)
    .filter((product) => product.promotion);
}

async function calculateOrderTotal(supabase, { items, deliveryAddress = "" }) {
  requireSupabase(supabase);
  if (!Array.isArray(items) || !items.length)
    throw new Error("Ajoutez au moins un article.");
  const ids = items.map((item) => item.productId).filter(Boolean);
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .in("id", ids)
    .eq("status", "APPROVED");
  if (error) throw error;
  const products = new Map(
    (data || []).map((product) => [String(product.id), product]),
  );
  const lines = items.map((item) => {
    const product = products.get(String(item.productId));
    const quantity = Number(item.quantity);
    if (
      !product ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    )
      throw new Error("Article ou quantité invalide.");
    const shown = presentProduct(product);
    return { product, shown, quantity, lineTotal: shown.price * quantity };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const deliveryFee = Number(process.env.DELIVERY_FEE_TND);
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0)
    throw new Error("Frais de livraison non configurés.");
  return {
    lines: lines.map(({ shown, quantity, lineTotal }) => ({
      product: shown,
      quantity,
      lineTotal,
    })),
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    deliveryAddress,
  };
}

async function createOrder(
  supabase,
  {
    phone,
    name,
    address,
    city,
    region,
    deliveryNotes,
    paymentMethod,
    items,
    confirmed,
  },
) {
  requireSupabase(supabase);
  if (!confirmed) throw new Error("La confirmation du client est obligatoire.");
  if (!phone || !name || !address || !city || !paymentMethod)
    throw new Error("Informations de livraison incomplètes.");
  const total = await calculateOrderTotal(supabase, {
    items,
    deliveryAddress: address,
  });
  const order = {
    order_id: `WA-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    date: new Date().toISOString().slice(0, 10),
    client_name: name,
    client_phone: phone,
    address,
    city,
    region: region || null,
    delivery_notes: deliveryNotes || null,
    items: total.lines,
    total_amount: total.total,
    payment_method: paymentMethod,
    status: "En attente",
    delivery_status: "À préparer",
  };
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();
  if (error) throw error;
  return {
    orderId: data.order_id,
    total: data.total_amount,
    status: data.status,
    deliveryStatus: data.delivery_status,
    lines: total.lines,
    deliveryFee: total.deliveryFee,
  };
}

async function getOrderStatus(supabase, { orderId, phone }) {
  requireSupabase(supabase);
  let request = supabase
    .from("orders")
    .select(
      "order_id, client_name, date, status, delivery_status, total_amount",
    )
    .eq("order_id", orderId);
  if (phone) request = request.eq("client_phone", phone);
  const { data, error } = await request.maybeSingle();
  if (error) throw error;
  return data || null;
}

function getDeliveryInformation() {
  return {
    payment: "Paiement à la livraison",
    fee: Number(process.env.DELIVERY_FEE_TND),
    regions: process.env.DELIVERY_REGIONS || "Tunisie",
    estimate: process.env.DELIVERY_ESTIMATE || "Selon la région",
  };
}

module.exports = {
  searchProducts,
  getProductDetails,
  checkInventory,
  getActivePromotions,
  calculateOrderTotal,
  createOrder,
  getOrderStatus,
  getDeliveryInformation,
  presentProduct,
};
