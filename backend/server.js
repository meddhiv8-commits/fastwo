/**
 * Fastwo TN — Auth API (WhatsApp OTP)
 *
 * Endpoints (consumed by the React frontend):
 *   POST /api/auth/send-otp    { phone, name? }      -> sends 4-digit OTP via WhatsApp
 *   POST /api/auth/verify-otp  { phone, code, name? }-> verifies, creates session
 *   GET  /api/auth/me          (Bearer <token>)      -> returns current user
 *   POST /api/auth/logout      (Bearer <token>)      -> destroys session
 *
 * Supabase is optional locally; in-memory auth is used when credentials are absent.
 * Meta WhatsApp token stays ONLY on this server.
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
const {
  getOrCreateConversation,
  processWebhookPayload,
  sendWhatsAppNegotiationNotification,
  sendWhatsAppNegotiationResponseNotification,
  sendWhatsAppText,
  storeMessage,
  verifySignature,
} = require("./whatsapp.js");
const { createAdminRouter } = require("./adminRoutes.js");

const PORT = Number(process.env.PORT || 3001);
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  (process.env.NODE_ENV === "production" ? "" : "admin23191");
const SESSION_TTL_MS = Number(
  process.env.SESSION_TTL_MS || 30 * 24 * 60 * 60 * 1000,
);
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const app = express();
app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  }),
);

const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (curl, mobile) and listed origins
      if (!origin || allowed.length === 0 || allowed.includes(origin))
        return cb(null, true);
      cb(new Error("Origin not allowed: " + origin));
    },
  }),
);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const localProfiles = new Map();
const localOtpCodes = new Map();
const localSessions = new Map();
const localOffers = new Map();
const frontendBuildPath = path.resolve(__dirname, "../frontend/dist");

// ---------- helpers ----------

function normPhone(phone) {
  let p = String(phone || "").replace(/\D/g, "");
  if (p.length === 8) p = "216" + p; // Tunisian local number
  return p;
}

function isValidPhone(p) {
  return /^\d{8,15}$/.test(p);
}

async function getProfile(phone) {
  if (!supabase) return localProfiles.get(phone) || null;
  const { data, error } = await supabase
    .from("profiles")
    .select("phone, name, is_active, created_at")
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function isProfileActive(profile) {
  return Boolean(profile?.is_active !== false);
}

async function sendWhatsAppOtp(phone, code) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.log(
      `[DEV] OTP for ${phone}: ${code}  (no WHATSAPP_TOKEN configured)`,
    );
    return { delivered: false };
  }
  const version = process.env.WHATSAPP_API_VERSION || "v19.0";
  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "fastwo_otp",
          language: { code: "fr" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error("WhatsApp API error:", res.status, body);
    return { delivered: false, error: body };
  }
  return { delivered: true };
}

function bearerToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

async function sessionUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  if (!supabase) {
    const session = localSessions.get(token);
    if (!session || new Date(session.expires_at).getTime() < Date.now())
      return null;
    const profile = localProfiles.get(session.phone);
    if (!isProfileActive(profile)) return null;
    return profile ? { name: profile.name, phone: session.phone } : null;
  }
  const { data, error } = await supabase
    .from("sessions")
    .select("token, phone, expires_at, profiles(name, is_active)")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  const prof = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  if (!isProfileActive(prof)) return null;
  return { name: prof ? prof.name : "", phone: data.phone };
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD)
    return res.status(503).json({ error: "Admin password is not configured" });
  const bearer = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer || !verifyAdminToken(bearer))
    return res
      .status(403)
      .json({ error: "Autorisation administrateur requise" });
  next();
}

function createAdminToken() {
  const payload = `${Date.now()}.${crypto.randomBytes(18).toString("hex")}`;
  const signature = crypto
    .createHmac("sha256", ADMIN_PASSWORD)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function verifyAdminToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8").split(".");
    const timestamp = Number(decoded.shift());
    const signature = decoded.pop();
    const payload = `${timestamp}.${decoded.join(".")}`;
    const expected = crypto
      .createHmac("sha256", ADMIN_PASSWORD)
      .update(payload)
      .digest("hex");
    return (
      Date.now() - timestamp < 8 * 60 * 60 * 1000 &&
      signature?.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    );
  } catch {
    return false;
  }
}

function parsePromotion(input, basePrice) {
  const type = input?.type;
  const value = Number(input?.value);
  if (!Number.isFinite(basePrice) || basePrice <= 0)
    throw new Error("Prix de base invalide");
  if (!input?.enabled) return null;
  if (
    !["percentage", "fixed"].includes(type) ||
    !Number.isFinite(value) ||
    value <= 0
  )
    throw new Error("Promotion invalide");
  if (type === "percentage" && value > 100)
    throw new Error("La remise ne peut pas dépasser 100%");
  if (type === "fixed" && value >= basePrice)
    throw new Error("La remise fixe doit rester inférieure au prix");
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (
    (startsAt && Number.isNaN(startsAt.getTime())) ||
    (endsAt && Number.isNaN(endsAt.getTime()))
  )
    throw new Error("Dates de promotion invalides");
  if (startsAt && endsAt && endsAt <= startsAt)
    throw new Error("La fin doit être après le début");
  const now = Date.now();
  const active =
    (!startsAt || startsAt.getTime() <= now) &&
    (!endsAt || endsAt.getTime() >= now);
  const discount = type === "fixed" ? value : basePrice * (value / 100);
  return {
    enabled: true,
    type,
    value,
    startsAt: startsAt?.toISOString() || null,
    endsAt: endsAt?.toISOString() || null,
    flashSale: Boolean(input.flashSale),
    active,
    finalPrice: active
      ? Math.max(0, Math.round(basePrice - discount))
      : basePrice,
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function orderExportRow(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    "Order ID": order.order_id,
    "Customer name": order.client_name,
    "Phone number": order.client_phone,
    "Full delivery address": order.address,
    "City / Region": order.city || order.region || "",
    "Ordered products": items
      .map((item) =>
        `${item.brand || ""} ${item.model || item.sku || ""}`.trim(),
      )
      .join(" | "),
    "Product quantities": items.map((item) => item.quantity || 1).join(" | "),
    "Total amount": order.total_amount,
    "Payment method": order.payment_method,
    "Order date": order.date,
    "Delivery notes": order.delivery_notes || "",
    "Order status": order.status,
    "Delivery status": order.delivery_status || "À préparer",
  };
}

// ---------- routes ----------

app.get("/api/whatsapp/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  return res.sendStatus(403);
});

app.post("/api/whatsapp/webhook", (req, res) => {
  if (
    !verifySignature(
      req.rawBody,
      req.get("x-hub-signature-256"),
      process.env.WHATSAPP_APP_SECRET,
    )
  )
    return res.sendStatus(401);
  if (!supabase) return res.sendStatus(503);
  res.sendStatus(200);
  processWebhookPayload(supabase, req.body).catch((error) =>
    console.error("WhatsApp webhook error:", error),
  );
});

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    service: "fastwo-auth",
    storage: supabase ? "supabase" : "memory",
    website: fs.existsSync(path.join(frontendBuildPath, "index.html"))
      ? "built"
      : "not-built",
  }),
);

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD)
    return res.status(503).json({ error: "Admin password is not configured" });
  if (String(req.body.password || "") !== ADMIN_PASSWORD)
    return res.status(401).json({ error: "Mot de passe incorrect" });
  res.json({ token: createAdminToken(), expiresIn: 8 * 60 * 60 * 1000 });
});

app.use("/api/admin", createAdminRouter(supabase, requireAdmin));

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const phone = normPhone(req.body.phone);
    const name = (req.body.name || "").trim();
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: "Numero invalide" });
    }

    const profile = await getProfile(phone);
    if (profile && !isProfileActive(profile)) {
      return res.status(403).json({ error: "Ce compte est suspendu" });
    }
    if (!profile && !name) {
      return res.status(400).json({
        needName: true,
        error: "Premiere fois: entrez aussi votre nom",
      });
    }

    const code = supabase
      ? String(crypto.randomInt(1000, 10000))
      : String(process.env.DEV_OTP_CODE || "1234");
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    if (supabase) {
      const { error } = await supabase
        .from("otp_codes")
        .upsert(
          { phone, code, expires_at: expiresAt, attempts: 0 },
          { onConflict: "phone" },
        );
      if (error) throw error;
    } else {
      localOtpCodes.set(phone, {
        phone,
        code,
        expires_at: expiresAt,
        attempts: 0,
      });
    }

    if (name && !profile) {
      const newProfile = { phone, name, created_at: new Date().toISOString() };
      if (supabase) {
        const { error } = await supabase.from("profiles").insert(newProfile);
        if (error) throw error;
      } else {
        localProfiles.set(phone, newProfile);
      }
    }

    const wa = await sendWhatsAppOtp(phone, code);
    res.json({
      message: wa.delivered
        ? "Code envoye sur WhatsApp"
        : "Code genere (voir console serveur en mode dev)",
      mode: supabase ? "supabase" : "local",
    });
  } catch (err) {
    console.error("send-otp error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const phone = normPhone(req.body.phone);
    const code = String(req.body.code || "").replace(/\D/g, "");
    const name = (req.body.name || "").trim();

    let otp;
    if (supabase) {
      const { data, error } = await supabase
        .from("otp_codes")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      if (error) throw error;
      otp = data;
    } else {
      otp = localOtpCodes.get(phone) || null;
    }

    if (!otp || new Date(otp.expires_at).getTime() < Date.now()) {
      return res
        .status(400)
        .json({ error: "Code expire — demandez un nouveau" });
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return res
        .status(429)
        .json({ error: "Trop d essais — demandez un nouveau code" });
    }
    if (otp.code !== code) {
      if (supabase) {
        await supabase
          .from("otp_codes")
          .update({ attempts: otp.attempts + 1 })
          .eq("phone", phone);
      } else {
        otp.attempts += 1;
      }
      return res.status(400).json({ error: "Code incorrect" });
    }

    let profile = await getProfile(phone);
    if (profile && !isProfileActive(profile)) {
      return res.status(403).json({ error: "Ce compte est suspendu" });
    }
    if (!profile) {
      if (!name)
        return res
          .status(400)
          .json({ needName: true, error: "Entrez votre nom" });
      if (supabase) {
        await supabase
          .from("profiles")
          .insert({ phone, name, is_active: true });
      } else {
        localProfiles.set(phone, {
          phone,
          name,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      }
      profile = { phone, name, is_active: true };
    }

    // One-time code: delete after success
    if (supabase) {
      await supabase.from("otp_codes").delete().eq("phone", phone);
    } else {
      localOtpCodes.delete(phone);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAtMs = Date.now() + SESSION_TTL_MS;
    const session = {
      token,
      phone,
      expires_at: new Date(expiresAtMs).toISOString(),
    };
    if (supabase) {
      await supabase.from("sessions").insert(session);
    } else {
      localSessions.set(token, session);
    }

    res.json({
      user: { name: profile.name, phone: profile.phone },
      token,
      expiresAt: expiresAtMs,
    });
  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const user = await sessionUser(req);
  if (!user) return res.status(401).json({ error: "Session invalide" });
  res.json({ user });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = bearerToken(req);
  if (token) {
    if (supabase) await supabase.from("sessions").delete().eq("token", token);
    else localSessions.delete(token);
  }
  res.json({ ok: true });
});

app.post("/api/negotiations/notify-seller", async (req, res) => {
  try {
    const buyer = await sessionUser(req);
    if (!buyer) return res.status(401).json({ error: "Session invalide" });
    const productId = Number(req.body.productId);
    const negotiationId = String(req.body.negotiationId || "").trim();
    const offerAmount = Number(req.body.offerAmount);
    if (
      !Number.isInteger(productId) ||
      !negotiationId ||
      !Number.isInteger(offerAmount)
    )
      return res
        .status(400)
        .json({ error: "Données de négociation invalides" });
    let product;
    if (supabase) {
      const { data, error } = await supabase
        .from("products")
        .select("id, brand, model, seller_phone, final_price, status")
        .eq("id", productId)
        .eq("status", "APPROVED")
        .maybeSingle();
      if (error) throw error;
      product = data;
    } else {
      product = {
        id: productId,
        brand: String(req.body.brand || "Article Fastwo"),
        model: String(req.body.model || "Annonce"),
        seller_phone: req.body.sellerPhone,
        final_price: Number(req.body.listedPrice),
        status: "APPROVED",
      };
    }
    if (!product) return res.status(404).json({ error: "Article introuvable" });
    const sellerPhone = normPhone(product.seller_phone);
    const listedPrice = Number(product.final_price);
    const minimumOffer = Math.ceil(listedPrice * 0.9);
    if (
      !isValidPhone(sellerPhone) ||
      !Number.isFinite(listedPrice) ||
      offerAmount < minimumOffer ||
      offerAmount > listedPrice
    )
      return res.status(400).json({ error: "Offre hors limites" });
    const buyerPhone = normPhone(buyer.phone);
    const publicUrl = (
      process.env.APP_PUBLIC_URL || "http://localhost:5173"
    ).replace(/\/$/, "");
    const pageNumber = String(req.body.pageNumber || productId);
    const productUrl = `${publicUrl}/products/${encodeURIComponent(pageNumber)}`;
    const sellerLink = `${publicUrl}/seller?negotiation=${encodeURIComponent(negotiationId)}`;
    const productLabel = `${product.brand} ${product.model}`;
    const latestOffer = {
      id: String(Date.now()),
      amount: offerAmount,
      by: "buyer",
      createdAt: new Date().toISOString(),
    };
    if (supabase) {
      const { data: previous, error: readError } = await supabase
        .from("offers")
        .select("history")
        .eq("id", negotiationId)
        .maybeSingle();
      if (readError) throw readError;
      const values = {
        id: negotiationId,
        product_id: product.id,
        sku: String(req.body.sku || ""),
        product_label: productLabel,
        product_url: productUrl,
        listed_price: listedPrice,
        seller_phone: sellerPhone,
        buyer_phone: buyerPhone,
        buyer_name: buyer.name,
        status: "pending",
        history: [...(previous?.history || []), latestOffer],
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("offers").upsert(values);
      if (error) throw error;
    } else {
      const previous = localOffers.get(negotiationId);
      localOffers.set(negotiationId, {
        id: negotiationId,
        product_id: product.id,
        sku: String(req.body.sku || ""),
        product_label: productLabel,
        product_url: productUrl,
        listed_price: listedPrice,
        seller_phone: sellerPhone,
        buyer_phone: buyerPhone,
        buyer_name: buyer.name,
        status: "pending",
        history: [...(previous?.history || []), latestOffer],
        updated_at: new Date().toISOString(),
      });
    }
    let messageId = null;
    let sent = false;
    try {
      messageId = await sendWhatsAppNegotiationNotification({
        to: sellerPhone,
        productLabel,
        offerAmount,
        sellerLink,
        productUrl,
      });
      sent = true;
    } catch (error) {
      console.warn("Negotiation WhatsApp notification skipped:", error.message);
    }
    res.json({ sent, messageId, sellerLink, productUrl });
  } catch (error) {
    console.error("negotiation notification error:", error);
    res.status(500).json({ error: "Offre non enregistrée" });
  }
});

app.get("/api/negotiations/inbox", async (req, res) => {
  try {
    const seller = await sessionUser(req);
    if (!seller) return res.status(401).json({ error: "Session invalide" });
    const sellerPhone = normPhone(seller.phone);
    if (!supabase) {
      const offers = [...localOffers.values()].filter(
        (offer) =>
          offer.seller_phone === sellerPhone && offer.status === "pending",
      );
      return res.json({ offers });
    }
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .eq("seller_phone", sellerPhone)
      .eq("status", "pending")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    res.json({ offers: data || [] });
  } catch (error) {
    res.status(500).json({ error: "Offres indisponibles" });
  }
});

app.get("/api/negotiations/mine", async (req, res) => {
  try {
    const buyer = await sessionUser(req);
    if (!buyer) return res.status(401).json({ error: "Session invalide" });
    const buyerPhone = normPhone(buyer.phone);
    if (!supabase) {
      const offers = [...localOffers.values()].filter(
        (offer) => offer.buyer_phone === buyerPhone,
      );
      return res.json({ offers });
    }
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .eq("buyer_phone", buyerPhone)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    res.json({ offers: data || [] });
  } catch (error) {
    res.status(500).json({ error: "Négociations indisponibles" });
  }
});

app.post("/api/negotiations/:id/respond", async (req, res) => {
  try {
    const seller = await sessionUser(req);
    if (!seller) return res.status(401).json({ error: "Session invalide" });
    const accepted = req.body.accepted === true;
    const sellerPhone = normPhone(seller.phone);
    const negotiationId = req.params.id;
    let offer;
    if (supabase) {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("id", negotiationId)
        .eq("seller_phone", sellerPhone)
        .maybeSingle();
      if (error) throw error;
      offer = data;
    } else {
      offer = localOffers.get(negotiationId);
      if (offer?.seller_phone !== sellerPhone) offer = null;
    }
    if (!offer) return res.status(404).json({ error: "Offre introuvable" });
    if (offer.status !== "pending")
      return res.status(409).json({ error: "Cette offre a déjà été traitée" });
    const latest = (offer.history || []).at(-1);
    if (!latest || latest.by !== "buyer")
      return res.status(400).json({ error: "Proposition invalide" });
    const status = accepted ? "accepted" : "declined";
    const updated = {
      ...offer,
      status,
      final_agreed_price: accepted ? latest.amount : null,
      updated_at: new Date().toISOString(),
    };
    if (supabase) {
      const { data, error } = await supabase
        .from("offers")
        .update({
          status,
          final_agreed_price: updated.final_agreed_price,
          updated_at: updated.updated_at,
        })
        .eq("id", negotiationId)
        .eq("seller_phone", sellerPhone)
        .eq("status", "pending")
        .select()
        .single();
      if (error) throw error;
      Object.assign(updated, data);
    } else {
      localOffers.set(negotiationId, updated);
    }
    const publicUrl = (
      process.env.APP_PUBLIC_URL || "http://localhost:5173"
    ).replace(/\/$/, "");
    const productUrl =
      offer.product_url || `${publicUrl}/products/${offer.product_id}`;
    let buyerNotified = false;
    try {
      const decision = accepted ? "acceptée" : "refusée";
      await sendWhatsAppNegotiationResponseNotification({
        to: normPhone(offer.buyer_phone),
        productLabel: offer.product_label,
        offerAmount: latest.amount,
        decision: `${decision} par le vendeur`,
        productUrl,
      });
      buyerNotified = true;
    } catch (error) {
      console.warn("Buyer WhatsApp notification skipped:", error.message);
    }
    res.json({ offer: updated, buyerNotified });
  } catch (error) {
    console.error("negotiation response error:", error);
    res.status(500).json({ error: "Réponse à l’offre impossible" });
  }
});

app.post(
  "/api/admin/products/:id/promotion",
  requireAdmin,
  async (req, res) => {
    try {
      if (!supabase)
        return res.status(503).json({ error: "Supabase indisponible" });
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, final_price, original_price, base_price")
        .eq("id", req.params.id)
        .maybeSingle();
      if (productError) throw productError;
      if (!product)
        return res.status(404).json({ error: "Article introuvable" });
      const basePrice = Number(
        product.base_price || product.original_price || product.final_price,
      );
      const promotion = parsePromotion(req.body, basePrice);
      const update = promotion
        ? {
            base_price: basePrice,
            original_price: basePrice,
            final_price: promotion.finalPrice,
            discount:
              promotion.type === "percentage"
                ? promotion.value
                : Math.round(
                    ((basePrice - promotion.finalPrice) / basePrice) * 100,
                  ),
            promotion_enabled: true,
            promotion_type: promotion.type,
            promotion_value: promotion.value,
            promotion_starts_at: promotion.startsAt,
            promotion_ends_at: promotion.endsAt,
            flash_sale: promotion.flashSale,
          }
        : {
            base_price: basePrice,
            original_price: null,
            final_price: basePrice,
            discount: 0,
            promotion_enabled: false,
            promotion_type: null,
            promotion_value: null,
            promotion_starts_at: null,
            promotion_ends_at: null,
            flash_sale: false,
          };
      const { data, error } = await supabase
        .from("products")
        .update(update)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ product: data, promotion });
    } catch (error) {
      res.status(400).json({ error: error.message || "Promotion invalide" });
    }
  },
);

app.get("/api/admin/orders/export", requireAdmin, async (req, res) => {
  try {
    if (!supabase)
      return res.status(503).json({ error: "Supabase indisponible" });
    let query = supabase
      .from("orders")
      .select("*")
      .order("date", { ascending: false });
    if (req.query.from) query = query.gte("date", req.query.from);
    if (req.query.to) query = query.lte("date", req.query.to);
    if (req.query.status) query = query.eq("status", req.query.status);
    if (req.query.deliveryStatus)
      query = query.eq("delivery_status", req.query.deliveryStatus);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data.map(orderExportRow);
    if (req.query.format === "csv") {
      const headers = Object.keys(rows[0] || orderExportRow({}));
      const csv = [
        headers,
        ...rows.map((row) => headers.map((header) => row[header])),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
      res
        .type("text/csv")
        .set("Content-Disposition", "attachment; filename=fastwo-orders.csv")
        .send("\ufeff" + csv);
      return;
    }
    res.json({ orders: rows });
  } catch (error) {
    res.status(500).json({ error: "Export impossible" });
  }
});

app.get("/api/admin/whatsapp/conversations", requireAdmin, async (req, res) => {
  try {
    if (!supabase)
      return res.status(503).json({ error: "Supabase indisponible" });
    let query = supabase
      .from("whatsapp_conversations")
      .select("*, orders(order_id, status, total_amount)")
      .order("last_message_at", { ascending: false });
    if (req.query.status) query = query.eq("status", req.query.status);
    if (req.query.search)
      query = query.ilike("whatsapp_id", `%${req.query.search}%`);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ conversations: data || [] });
  } catch (error) {
    res.status(500).json({ error: "Conversations indisponibles" });
  }
});

app.get(
  "/api/admin/whatsapp/conversations/:id",
  requireAdmin,
  async (req, res) => {
    try {
      if (!supabase)
        return res.status(503).json({ error: "Supabase indisponible" });
      const [conversationResult, messagesResult] = await Promise.all([
        supabase
          .from("whatsapp_conversations")
          .select("*, orders(*)")
          .eq("id", req.params.id)
          .maybeSingle(),
        supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", req.params.id)
          .order("created_at", { ascending: true }),
      ]);
      if (conversationResult.error) throw conversationResult.error;
      if (messagesResult.error) throw messagesResult.error;
      if (!conversationResult.data)
        return res.status(404).json({ error: "Conversation introuvable" });
      res.json({
        conversation: conversationResult.data,
        messages: messagesResult.data || [],
      });
    } catch (error) {
      res.status(500).json({ error: "Conversation indisponible" });
    }
  },
);

app.post(
  "/api/admin/whatsapp/conversations/:id/control",
  requireAdmin,
  async (req, res) => {
    try {
      if (!supabase)
        return res.status(503).json({ error: "Supabase indisponible" });
      const controlMode = req.body.controlMode === "ai" ? "ai" : "human";
      const status = controlMode === "ai" ? "active" : "waiting_for_admin";
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .update({
          control_mode: controlMode,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ conversation: data });
    } catch (error) {
      res.status(400).json({ error: "Impossible de modifier le contrôle" });
    }
  },
);

app.post(
  "/api/admin/whatsapp/conversations/:id/reply",
  requireAdmin,
  async (req, res) => {
    try {
      if (!supabase)
        return res.status(503).json({ error: "Supabase indisponible" });
      const text = String(req.body.text || "").trim();
      if (!text) return res.status(400).json({ error: "Message vide" });
      const { data: conversation, error: conversationError } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", req.params.id)
        .maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation)
        return res.status(404).json({ error: "Conversation introuvable" });
      const providerId = await sendWhatsAppText(conversation.whatsapp_id, text);
      await storeMessage(supabase, conversation.id, {
        whatsappMessageId: providerId,
        direction: "outbound",
        senderType: "admin",
        body: text,
        payload: { provider: "whatsapp_cloud" },
      });
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .update({
          control_mode: "human",
          status: "waiting_for_customer",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ conversation: data });
    } catch (error) {
      res.status(400).json({ error: "Message non envoyé" });
    }
  },
);

app.use(express.static(frontendBuildPath));
app.use((req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Not found" });
  const indexPath = path.join(frontendBuildPath, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res
    .status(503)
    .type("html")
    .send(
      "<h1>Fastwo website is not built yet</h1><p>Run <code>npm run build --prefix frontend</code> from the project root, then restart the backend.</p>",
    );
});

function openBrowser(url) {
  const command =
    process.platform === "win32"
      ? "cmd.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const browser = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  browser.on("error", (error) =>
    console.error("Could not open browser:", error.message),
  );
  browser.unref();
}

const server = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Fastwo website and API listening on ${url}`);
  console.log(
    `Authentication storage: ${supabase ? "Supabase" : "in-memory local demo"}`,
  );
  if (!supabase)
    console.log(
      "[DEV] Local OTP code: " + (process.env.DEV_OTP_CODE || "1234"),
    );
  else if (!process.env.WHATSAPP_ACCESS_TOKEN && !process.env.WHATSAPP_TOKEN)
    console.log(
      "WHATSAPP_TOKEN not set — OTP codes will be printed here (dev mode).",
    );
  if (process.argv.includes("--open-browser")) openBrowser(url);
});

server.on("error", async (error) => {
  if (error.code !== "EADDRINUSE") {
    console.error("Backend failed to start:", error.message);
    process.exitCode = 1;
    return;
  }

  const url = `http://localhost:${PORT}`;
  try {
    const response = await fetch(`${url}/api/health`);
    const health = await response.json();
    if (!response.ok || health.service !== "fastwo-auth") {
      throw new Error("another service is using the port");
    }
    console.log(`Fastwo is already running on ${url}; reusing it.`);
    if (process.argv.includes("--open-browser")) openBrowser(url);
  } catch {
    console.error(
      `Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`,
    );
    process.exitCode = 1;
  }
});
