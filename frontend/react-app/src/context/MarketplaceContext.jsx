import { createContext, useContext, useEffect, useState } from "react";
import { demoOrders, demoProducts, testimonials } from "../data/demoData.js";
import {
  getBasePrice,
  getPromotionState,
  validatePromotion,
} from "../lib/pricing.js";
import { translate } from "../lib/translations.js";

const MarketplaceContext = createContext(null);

function authApiBase() {
  const configuredApi = import.meta.env.VITE_FASTWO_AUTH_API;
  if (configuredApi) return configuredApi;
  if (import.meta.env.DEV) {
    return window.location.port === "3001"
      ? window.location.origin
      : "http://localhost:3001";
  }
  return window.location.origin;
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readProducts() {
  const storedProducts = readStorage("fastwo_products", demoProducts);
  const existingNumbers = storedProducts
    .map((product) => Number(product.pageNumber))
    .filter(
      (number) =>
        Number.isSafeInteger(number) &&
        number >= 1001 &&
        number < 1_000_000_000,
    );
  let nextPageNumber = Math.max(1000, ...existingNumbers) + 1;
  const migratedProducts = storedProducts.map((product) => {
    const currentNumber = Number(product.pageNumber);
    if (
      Number.isSafeInteger(currentNumber) &&
      currentNumber >= 1001 &&
      currentNumber < 1_000_000_000
    )
      return product;
    return { ...product, pageNumber: nextPageNumber++ };
  });
  localStorage.setItem("fastwo_next_product_page", String(nextPageNumber));
  return migratedProducts;
}

function normalizeOfferRecord(record) {
  return {
    ...record,
    id: record.id,
    productId: Number(record.product_id ?? record.productId),
    sku: record.sku,
    productLabel: record.product_label ?? record.productLabel,
    productUrl: record.product_url ?? record.productUrl,
    listedPrice: Number(record.listed_price ?? record.listedPrice),
    sellerPhone: record.seller_phone ?? record.sellerPhone,
    buyerPhone: record.buyer_phone ?? record.buyerPhone,
    buyerName: record.buyer_name ?? record.buyerName,
    status: record.status,
    offers: record.history ?? record.offers ?? [],
    agreedPrice: record.final_agreed_price ?? record.agreedPrice,
  };
}

export function MarketplaceProvider({ children }) {
  const [products, setProducts] = useState(readProducts);
  const [orders, setOrders] = useState(() =>
    readStorage("fastwo_orders", demoOrders),
  );
  const [reviews, setReviews] = useState(() =>
    readStorage("fastwo_reviews", testimonials),
  );
  const [cart, setCart] = useState(() => readStorage("fastwo_cart", []));
  const [wishlist, setWishlist] = useState(() =>
    readStorage("fastwo_wishlist", []),
  );
  const [negotiations, setNegotiations] = useState(() =>
    readStorage("fastwo_negotiations", []),
  );
  const [sellerOffers, setSellerOffers] = useState([]);
  const [user, setUser] = useState(() => readStorage("fastwo_session", null));
  const [isAdmin, setIsAdmin] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState(() =>
    readStorage("fastwo_language", "fr"),
  );
  const [supportWhatsappNumber, setSupportWhatsappNumber] = useState(() => {
    const savedNumber = localStorage.getItem("fastwo_support_whatsapp");
    return savedNumber && /^\d{8,15}$/.test(savedNumber)
      ? savedNumber
      : "21623191586";
  });
  const [deliveryFees, setDeliveryFees] = useState(() =>
    readStorage("fastwo_delivery_fees", [
      { id: 1, amount: 7, minimum_order: 0, maximum_order: null, active: true },
    ]),
  );
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(0);
  const [pendingLogin, setPendingLogin] = useState(null);

  useEffect(
    () => localStorage.setItem("fastwo_products", JSON.stringify(products)),
    [products],
  );
  useEffect(() => {
    function syncStorage(event) {
      if (event.key === "fastwo_products" && event.newValue) {
        try {
          setProducts(JSON.parse(event.newValue));
        } catch {
          return;
        }
      }
      if (event.key === "fastwo_language" && event.newValue) {
        try {
          setLanguage(JSON.parse(event.newValue));
        } catch {
          return;
        }
      }
      if (event.key === "fastwo_support_whatsapp" && event.newValue) {
        if (/^\d{8,15}$/.test(event.newValue))
          setSupportWhatsappNumber(event.newValue);
      }
      if (event.key === "fastwo_delivery_fees" && event.newValue) {
        try {
          setDeliveryFees(JSON.parse(event.newValue));
        } catch {
          return;
        }
      }
    }
    window.addEventListener("storage", syncStorage);
    return () => window.removeEventListener("storage", syncStorage);
  }, []);
  useEffect(() => {
    localStorage.setItem("fastwo_language", JSON.stringify(language));
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  useEffect(
    () => localStorage.setItem("fastwo_orders", JSON.stringify(orders)),
    [orders],
  );
  useEffect(
    () => localStorage.setItem("fastwo_reviews", JSON.stringify(reviews)),
    [reviews],
  );
  useEffect(
    () => localStorage.setItem("fastwo_cart", JSON.stringify(cart)),
    [cart],
  );
  useEffect(
    () => localStorage.setItem("fastwo_wishlist", JSON.stringify(wishlist)),
    [wishlist],
  );
  useEffect(
    () =>
      localStorage.setItem("fastwo_negotiations", JSON.stringify(negotiations)),
    [negotiations],
  );
  useEffect(
    () =>
      localStorage.setItem("fastwo_support_whatsapp", supportWhatsappNumber),
    [supportWhatsappNumber],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "fastwo_delivery_fees",
        JSON.stringify(deliveryFees),
      ),
    [deliveryFees],
  );
  async function refreshPlatformSettings() {
    try {
      const response = await fetch(
        `${authApiBase()}/api/admin/public-settings`,
      );
      if (!response.ok) return;
      const data = await response.json();
      if (/^\d{8,15}$/.test(String(data.whatsappPhone || "")))
        setSupportWhatsappNumber(String(data.whatsappPhone));
      if (Array.isArray(data.deliveryFees)) setDeliveryFees(data.deliveryFees);
      setFreeShippingThreshold(Number(data.freeShippingThreshold || 0));
    } catch {
      return;
    }
  }
  useEffect(() => {
    refreshPlatformSettings();
    const interval = window.setInterval(refreshPlatformSettings, 15000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!user) setCart([]);
  }, [user]);

  useEffect(() => {
    if (!user?.phone) {
      setSellerOffers([]);
      return undefined;
    }
    let active = true;
    async function refreshOffers() {
      const token = localStorage.getItem("fastwo_session_token");
      if (!token) {
        if (active) {
          setSellerOffers(
            negotiations
              .filter(
                (offer) =>
                  String(offer.sellerPhone || "")
                    .replace(/\D/g, "")
                    .slice(-8) ===
                    String(user.phone).replace(/\D/g, "").slice(-8) &&
                  offer.status === "pending",
              )
              .map(normalizeOfferRecord),
          );
        }
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [inboxResponse, mineResponse] = await Promise.all([
          fetch(`${authApiBase()}/api/negotiations/inbox`, { headers }),
          fetch(`${authApiBase()}/api/negotiations/mine`, { headers }),
        ]);
        if (!inboxResponse.ok || !mineResponse.ok) return;
        const [inboxData, mineData] = await Promise.all([
          inboxResponse.json(),
          mineResponse.json(),
        ]);
        if (!active) return;
        setSellerOffers((inboxData.offers || []).map(normalizeOfferRecord));
        const remoteBuyerOffers = (mineData.offers || []).map(
          normalizeOfferRecord,
        );
        setNegotiations((current) => {
          const remoteIds = new Set(
            remoteBuyerOffers.map((offer) => String(offer.id)),
          );
          const merged = [
            ...current.filter((offer) => !remoteIds.has(String(offer.id))),
            ...remoteBuyerOffers,
          ];
          return JSON.stringify(merged) === JSON.stringify(current)
            ? current
            : merged;
        });
      } catch {
        return;
      }
    }
    refreshOffers();
    const interval = window.setInterval(refreshOffers, 12000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.phone, negotiations]);

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(""), 2600);
  }

  function updateSupportWhatsappNumber(value) {
    const normalized = String(value || "").replace(/\D/g, "");
    if (!/^\d{8,15}$/.test(normalized))
      throw new Error("Entrez un numéro WhatsApp international valide.");
    setSupportWhatsappNumber(normalized);
    notify("Numéro WhatsApp mis à jour");
  }

  function getDeliveryFee(subtotal) {
    if (freeShippingThreshold > 0 && subtotal >= freeShippingThreshold)
      return 0;
    const eligible = deliveryFees
      .filter(
        (fee) =>
          fee.active !== false &&
          subtotal >= Number(fee.minimum_order || 0) &&
          (fee.maximum_order == null || subtotal <= Number(fee.maximum_order)),
      )
      .sort(
        (left, right) =>
          Number(right.minimum_order || 0) - Number(left.minimum_order || 0),
      );
    return Number(eligible[0]?.amount ?? 7);
  }

  function addToCart(product, negotiatedPrice = null) {
    if (!user) {
      notify("Connectez-vous pour acheter un article.");
      return false;
    }
    const unitPrice = negotiatedPrice ?? product.finalPrice;
    setCart((current) => {
      const found = current.find((line) => line.id === product.id);
      return found
        ? current.map((line) =>
            line.id === product.id
              ? {
                  ...line,
                  quantity: line.quantity + 1,
                  unitPrice:
                    negotiatedPrice ?? line.unitPrice ?? product.finalPrice,
                }
              : line,
          )
        : [...current, { id: product.id, quantity: 1, unitPrice }];
    });
    notify("Ajouté au panier");
    return true;
  }

  function changeQuantity(id, quantity) {
    setCart((current) =>
      quantity < 1
        ? current.filter((line) => line.id !== id)
        : current.map((line) =>
            line.id === id ? { ...line, quantity } : line,
          ),
    );
  }

  function toggleWishlist(id) {
    const saved = wishlist.includes(id);
    setWishlist((current) =>
      saved ? current.filter((item) => item !== id) : [...current, id],
    );
    notify(saved ? "Retiré des favoris" : "Ajouté aux favoris");
  }

  async function notifySellerOfNegotiation({
    negotiationId,
    product,
    offerAmount,
  }) {
    const authApi = authApiBase();
    const token = localStorage.getItem("fastwo_session_token");
    if (!authApi || !token || !product.sellerPhone) return;
    try {
      const response = await fetch(
        `${authApi}/api/negotiations/notify-seller`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            negotiationId,
            productId: product.id,
            offerAmount,
            sellerPhone: product.sellerPhone,
            pageNumber: product.pageNumber ?? product.id,
            sku: product.sku,
            brand: product.brand,
            model: product.model,
            listedPrice: product.finalPrice,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        notify("Offre enregistrée, notification WhatsApp indisponible");
      else if (!data.sent)
        notify("Offre enregistrée, WhatsApp n’est pas configuré");
    } catch {
      notify("Offre enregistrée, notification WhatsApp indisponible");
    }
  }

  function submitNegotiation(product, amount) {
    if (!user) throw new Error("Connectez-vous pour proposer un prix.");
    const offerPrice = Number(amount);
    const minimumPrice = Math.ceil(product.finalPrice * 0.9);
    if (
      !Number.isInteger(offerPrice) ||
      offerPrice < minimumPrice ||
      offerPrice > product.finalPrice
    ) {
      throw new Error(
        `Proposez un montant entre ${minimumPrice} et ${product.finalPrice} TND.`,
      );
    }
    const existing = negotiations.find(
      (item) => item.productId === product.id && item.buyerPhone === user.phone,
    );
    if (existing?.status === "accepted" || existing?.status === "declined") {
      throw new Error("Cette négociation est terminée.");
    }
    if ((existing?.offers.length || 0) >= 8) {
      throw new Error("Vous avez utilisé vos 8 propositions pour cet article.");
    }
    const offer = {
      id: Date.now(),
      amount: offerPrice,
      by: "buyer",
      createdAt: new Date().toISOString(),
    };
    const negotiationId = existing?.id || offer.id;
    if (existing) {
      setNegotiations((current) =>
        current.map((item) =>
          item.id === existing.id
            ? { ...item, status: "pending", offers: [...item.offers, offer] }
            : item,
        ),
      );
    } else {
      setNegotiations((current) => [
        ...current,
        {
          id: negotiationId,
          productId: product.id,
          sku: product.sku,
          productLabel: `${product.brand} ${product.model}`,
          listedPrice: product.finalPrice,
          sellerPhone: product.sellerPhone,
          productUrl: `${window.location.origin}/products/${product.pageNumber ?? product.id}`,
          buyerPhone: user.phone,
          buyerName: user.name,
          status: "pending",
          offers: [offer],
        },
      ]);
    }
    notifySellerOfNegotiation({
      negotiationId,
      product,
      offerAmount: offerPrice,
    });
    notify("Votre proposition a été envoyée au vendeur");
  }

  async function respondToNegotiation(negotiationId, accepted) {
    const token = localStorage.getItem("fastwo_session_token");
    if (token) {
      const response = await fetch(
        `${authApiBase()}/api/negotiations/${encodeURIComponent(negotiationId)}/respond`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accepted }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Réponse à l’offre impossible.");
      const updatedOffer = normalizeOfferRecord(data.offer);
      setNegotiations((current) => [
        ...current.filter((item) => String(item.id) !== String(negotiationId)),
        updatedOffer,
      ]);
      setSellerOffers((current) =>
        current.filter((item) => String(item.id) !== String(negotiationId)),
      );
      notify(
        data.buyerNotified
          ? accepted
            ? "Proposition acceptée, acheteur informé"
            : "Proposition refusée, acheteur informé"
          : "Décision enregistrée, WhatsApp indisponible",
      );
      return;
    }
    setNegotiations((current) =>
      current.map((item) => {
        if (item.id !== negotiationId || item.status !== "pending") return item;
        const latestOffer = item.offers[item.offers.length - 1];
        return {
          ...item,
          status: accepted ? "accepted" : "declined",
          agreedPrice: accepted ? latestOffer.amount : null,
          respondedAt: new Date().toISOString(),
        };
      }),
    );
    notify(accepted ? "Proposition acceptée" : "Proposition refusée");
  }

  async function requestOtp(name, phone) {
    const authApi = authApiBase();
    let localDemo = !authApi;
    if (authApi) {
      const response = await fetch(`${authApi}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Impossible d’envoyer le code.");
      localDemo = data.mode === "local";
    }
    setPendingLogin({ name, phone, demo: localDemo });
    return localDemo;
  }

  async function verifyOtp(code) {
    if (!pendingLogin) throw new Error("Demandez d’abord un code.");
    let nextUser;
    const authApi = authApiBase();
    if (authApi) {
      const response = await fetch(`${authApi}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pendingLogin, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Code invalide.");
      nextUser = data.user;
      localStorage.setItem("fastwo_session_token", data.token);
      localStorage.setItem("fastwo_session_expires", String(data.expiresAt));
    } else {
      if (code !== "1234")
        throw new Error("Code incorrect. Pour la démo, utilisez 1234.");
      nextUser = { name: pendingLogin.name, phone: pendingLogin.phone };
    }
    setUser(nextUser);
    localStorage.setItem("fastwo_session", JSON.stringify(nextUser));
    setPendingLogin(null);
    notify(`Bienvenue ${nextUser.name}`);
  }

  function logout() {
    const token = localStorage.getItem("fastwo_session_token");
    const authApi = authApiBase();
    if (authApi && token) {
      fetch(`${authApi}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    [
      "fastwo_session",
      "fastwo_session_token",
      "fastwo_session_expires",
    ].forEach((key) => localStorage.removeItem(key));
    setUser(null);
    setCart([]);
    notify("Vous êtes déconnecté");
  }

  async function loginAdmin(password) {
    const authApi = authApiBase();
    const response = await fetch(`${authApi}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Accès administrateur refusé.");
    localStorage.setItem("fastwo_admin_token", data.token);
    setIsAdmin(true);
  }

  function logoutAdmin() {
    setIsAdmin(false);
    ["fastwo_admin", "fastwo_admin_token"].forEach((key) =>
      localStorage.removeItem(key),
    );
  }

  function submitProduct(details) {
    let id = Date.now();
    while (products.some((product) => Number(product.id) === id)) id += 1;
    const nextSavedPageNumber = Number(
      localStorage.getItem("fastwo_next_product_page"),
    );
    const pageNumber = Math.max(
      1001,
      Number.isSafeInteger(nextSavedPageNumber) ? nextSavedPageNumber : 1001,
      ...products.map((product) => Number(product.pageNumber) + 1 || 1001),
    );
    localStorage.setItem("fastwo_next_product_page", String(pageNumber + 1));
    const product = {
      ...details,
      id,
      pageNumber,
      sku: `FW${String(id).slice(-6)}`,
      sellerName: user?.name || "Nouveau vendeur",
      sellerPhone: user?.phone || "",
      status: "PENDING",
      discount: 0,
      originalPrice: null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setProducts((current) => [product, ...current]);
    notify("Annonce envoyée pour vérification");
    return product;
  }

  function updateProduct(id, changes) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, ...changes } : product,
      ),
    );
  }

  function updatePromotion(productId, promotion) {
    const product = products.find((item) => item.id === productId);
    if (!product) throw new Error("Article introuvable.");
    const basePrice = getBasePrice(product);
    if (!promotion) {
      setProducts((current) =>
        current.map((item) =>
          item.id === productId
            ? {
                ...item,
                basePrice,
                originalPrice: null,
                finalPrice: basePrice,
                discount: 0,
                promotion: null,
              }
            : item,
        ),
      );
      return;
    }
    const nextPromotion = validatePromotion(promotion, basePrice);
    const preview = getPromotionState({
      ...product,
      basePrice,
      promotion: nextPromotion,
    });
    setProducts((current) =>
      current.map((item) =>
        item.id === productId
          ? {
              ...item,
              basePrice,
              originalPrice: basePrice,
              finalPrice: preview.finalPrice,
              discount:
                nextPromotion.type === "percentage"
                  ? nextPromotion.value
                  : Math.round((preview.discountAmount / basePrice) * 100),
              promotion: nextPromotion,
            }
          : item,
      ),
    );
  }

  function updateOrder(orderId, changes) {
    const orderChanges =
      typeof changes === "string" ? { status: changes } : changes;
    setOrders((current) =>
      current.map((order) =>
        order.orderId === orderId ? { ...order, ...orderChanges } : order,
      ),
    );
  }

  function submitReview({ rating, text }) {
    const cleanText = text.trim();
    if (!rating || !cleanText)
      throw new Error("Ajoutez une note et un commentaire.");
    const reviewerName = user?.name || "Client Fastwo";
    const review = {
      id: `review-${Date.now()}`,
      name: reviewerName,
      city: "Tunisie",
      rating: Number(rating),
      text: cleanText,
      avatar: reviewerName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    };
    setReviews((current) => [review, ...current]);
    notify("Merci pour votre évaluation");
    return review;
  }

  function deleteProduct(id) {
    setProducts((current) => current.filter((product) => product.id !== id));
  }

  function placeOrder({ clientName, clientPhone, address }) {
    if (!user) throw new Error("Connectez-vous avant de passer commande.");
    const lines = cart
      .map((line) => ({
        ...products.find((product) => product.id === line.id),
        finalPrice:
          line.unitPrice ??
          products.find((product) => product.id === line.id)?.finalPrice,
        quantity: line.quantity,
      }))
      .filter((product) => product.id);
    if (!lines.length) throw new Error("Votre panier est vide.");
    const subtotal = lines.reduce(
      (sum, product) => sum + product.finalPrice * product.quantity,
      0,
    );
    const deliveryFee = getDeliveryFee(subtotal);
    const totalAmount = subtotal + deliveryFee;
    const order = {
      orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      clientName,
      clientPhone,
      address,
      items: lines,
      deliveryFee,
      totalAmount,
      status: "En attente",
    };
    setOrders((current) => [order, ...current]);
    setCart([]);
    notify(`Commande ${order.orderId} confirmée`);
    return order;
  }

  const cartLines = cart
    .map((line) => {
      const product = products.find((item) => item.id === line.id);
      return {
        ...line,
        product,
        unitPrice: line.unitPrice ?? product?.finalPrice ?? 0,
      };
    })
    .filter((line) => line.product);
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartLines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const cartDeliveryFee = getDeliveryFee(cartTotal);

  const value = {
    products,
    orders,
    reviews,
    cart,
    cartLines,
    cartCount,
    cartTotal,
    wishlist,
    negotiations,
    sellerOffers,
    user,
    isAdmin,
    cartOpen,
    setCartOpen,
    toast,
    query,
    setQuery,
    supportWhatsappNumber,
    deliveryFees,
    freeShippingThreshold,
    cartDeliveryFee,
    getDeliveryFee,
    refreshPlatformSettings,
    language,
    setLanguage,
    t: (phrase) => translate(language, phrase),
    updateSupportWhatsappNumber,
    pendingLogin,
    addToCart,
    changeQuantity,
    toggleWishlist,
    submitNegotiation,
    respondToNegotiation,
    requestOtp,
    verifyOtp,
    logout,
    loginAdmin,
    logoutAdmin,
    submitProduct,
    updateProduct,
    updatePromotion,
    updateOrder,
    submitReview,
    deleteProduct,
    placeOrder,
    notify,
  };

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context)
    throw new Error("useMarketplace must be used inside MarketplaceProvider");
  return context;
}
