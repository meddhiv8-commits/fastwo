import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import ProductGrid from "../components/ProductGrid.jsx";
import { formatPrice } from "../components/ProductCard.jsx";
import { useMarketplace } from "../context/MarketplaceContext.jsx";
import { getPromotionState } from "../lib/pricing.js";
import ProductImage from "../components/ProductImage.jsx";

const PRODUCT_FIELDS = new Set([
  "id",
  "pageNumber",
  "sku",
  "category",
  "condition",
  "taille",
  "brand",
  "model",
  "images",
  "sellerName",
  "seller_name",
  "sellerPhone",
  "seller_phone",
  "sellerPrice",
  "seller_price",
  "finalPrice",
  "final_price",
  "originalPrice",
  "discount",
  "promotion",
  "promotion_enabled",
  "promotion_type",
  "promotion_value",
  "promotion_starts_at",
  "promotion_ends_at",
  "flash_sale",
  "createdAt",
  "created_at",
  "status",
  "customAttributes",
  "custom_attributes",
  "attributes",
  "specifications",
  "iphoneDetails",
  "iphone_details",
  "ipadDetails",
  "ipad_details",
  "repairInfo",
  "repair_info",
  "commissionRate",
  "commissionAmount",
  "sellerPayout",
  "basePrice",
  "base_price",
  "appleType",
  "batteryHealth",
  "faceIdEnabled",
  "trueToneEnabled",
  "repaired",
  "repairType",
]);

const ATTRIBUTE_LABELS = {
  appleType: "Type de produit",
  apple_type: "Type de produit",
  batteryHealth: "État batterie",
  battery_health: "État batterie",
  faceIdEnabled: "Face ID activé",
  face_id_enabled: "Face ID activé",
  trueToneEnabled: "True Tone activé",
  true_tone_enabled: "True Tone activé",
  repaired: "Réparé",
  repairType: "Type de réparation",
  repair_type: "Type de réparation",
  accessories: "Accessoires inclus",
  accessoriesIncluded: "Accessoires inclus",
  accessories_included: "Accessoires inclus",
  repairHistory: "Historique de réparation",
  repair_history: "Historique de réparation",
};

function attributeLabel(attribute, t) {
  const label = attribute.label || attribute.key;
  const fallback = ATTRIBUTE_LABELS[label] || ATTRIBUTE_LABELS[attribute.key];
  if (fallback) return t(fallback);
  const readable = String(label)
    .split(".")
    .at(-1)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ");
  return t(readable.charAt(0).toLocaleUpperCase() + readable.slice(1));
}

function isFilled(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some(isFilled);
  if (typeof value === "object") return Object.values(value).some(isFilled);
  return true;
}

function collectProductAttributes(product) {
  const attributes = [];
  const knownKeys = new Set();
  function add(key, label, value) {
    if (!isFilled(value) || knownKeys.has(key)) return;
    knownKeys.add(key);
    attributes.push({ key, label, value });
  }
  function addRecord(record, prefix = "") {
    if (!record || typeof record !== "object") return;
    for (const [key, value] of Object.entries(record)) {
      if (!isFilled(value)) continue;
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && !Array.isArray(value)) {
        addRecord(value, fullKey);
      } else {
        add(fullKey, key, value);
      }
    }
  }
  for (const candidate of [
    product.customAttributes,
    product.custom_attributes,
    product.attributes,
    product.specifications,
  ]) {
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => {
        if (item && typeof item === "object")
          add(
            item.key || item.name || item.label,
            item.label || item.name,
            item.value,
          );
      });
    } else {
      addRecord(candidate);
    }
  }
  add("taille", "Pointure", product.taille ?? product.size);
  add("appleType", "Type de produit", product.appleType);
  add("batteryHealth", "État batterie", product.batteryHealth);
  add("faceIdEnabled", "Face ID activé", product.faceIdEnabled);
  add("trueToneEnabled", "True Tone activé", product.trueToneEnabled);
  add("repaired", "Réparé", product.repaired);
  add("repairType", "Type de réparation", product.repairType);
  addRecord(product.iphoneDetails || product.iphone_details, "iPhone");
  addRecord(product.ipadDetails || product.ipad_details, "iPad");
  addRecord(product.repairInfo || product.repair_info, "Réparation");
  for (const [key, value] of Object.entries(product)) {
    if (!PRODUCT_FIELDS.has(key)) add(key, key, value);
  }
  return attributes;
}

function displayAttributeValue(value, key, t) {
  if (key === "condition") {
    const conditionLabels = {
      S: "Neuf",
      A: "Très bon",
      B: "Bon",
      C: "Utilisé",
    };
    return conditionLabels[value]
      ? t(conditionLabels[value])
      : t(String(value));
  }
  if (value === true || value === "yes") return t("Oui");
  if (value === false || value === "no") return t("Non");
  if (Array.isArray(value))
    return value.map((item) => displayAttributeValue(item, key, t)).join(", ");
  if (typeof value === "object")
    return Object.entries(value)
      .filter(([, item]) => isFilled(item))
      .map(
        ([label, item]) =>
          `${t(label)}: ${displayAttributeValue(item, label, t)}`,
      )
      .join(", ");
  return t(String(value));
}

export default function ProductPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const {
    products,
    addToCart,
    toggleWishlist,
    wishlist,
    negotiations,
    user,
    setCartOpen,
    t,
  } = useMarketplace();
  const requestedId = productId || searchParams.get("id");
  const product = products.find(
    (item) =>
      String(item.id) === requestedId ||
      String(item.pageNumber ?? item.id) === requestedId,
  );
  useEffect(() => setActiveImageIndex(0), [requestedId]);
  if (!product)
    return (
      <section className="not-found">
        <p className="eyebrow">{t("ARTICLE INTROUVABLE")}</p>
        <h1>{t("Cette trouvaille est partie.")}</h1>
        <Link className="button-primary" to="/">
          {t("Retour à la sélection")}
        </Link>
      </section>
    );
  const pricing = getPromotionState(product);
  const images = product.images?.filter(Boolean) || [];
  const specifications = collectProductAttributes(product).filter(
    (attribute) => attribute.key !== "condition",
  );
  const similar = products
    .filter(
      (item) =>
        item.category === product.category &&
        item.id !== product.id &&
        item.status === "APPROVED",
    )
    .slice(0, 4);
  const favorite = wishlist.includes(product.id);
  const acceptedNegotiation = negotiations.find(
    (item) =>
      item.productId === product.id &&
      item.buyerPhone === user?.phone &&
      item.status === "accepted",
  );

  return (
    <div className="detail-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> {t("Retour à la sélection")}
      </Link>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-photo">
            <ProductImage
              src={images[activeImageIndex] || images[0]}
              alt={`${product.brand} ${product.model} - photo ${activeImageIndex + 1}`}
            />
            <span>{product.sku}</span>
            {images.length > 1 && (
              <>
                <button
                  className="gallery-arrow gallery-arrow-left"
                  type="button"
                  onClick={() =>
                    setActiveImageIndex(
                      (activeImageIndex - 1 + images.length) % images.length,
                    )
                  }
                  aria-label={t("Photo précédente")}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="gallery-arrow gallery-arrow-right"
                  type="button"
                  onClick={() =>
                    setActiveImageIndex((activeImageIndex + 1) % images.length)
                  }
                  aria-label={t("Photo suivante")}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="detail-thumbnails" aria-label="Photos de l’article">
              {images.map((image, index) => (
                <button
                  className={index === activeImageIndex ? "is-active" : ""}
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`Afficher la photo ${index + 1}`}
                  aria-pressed={index === activeImageIndex}
                >
                  <ProductImage src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <section className="detail-info">
          <p className="eyebrow">
            {product.category} / {product.brand}
          </p>
          <h1>{product.model}</h1>
          <p className="detail-seller">
            {t("Vendu par")}{" "}
            <strong>{product.sellerName || product.seller_name}</strong> ·
            Tunisie
          </p>
          <div className="detail-price">
            {formatPrice(pricing.finalPrice)} <small>TND</small>
            {pricing.active && (
              <>
                <del>{formatPrice(pricing.basePrice)} TND</del>
                <span className="detail-discount">
                  {pricing.promotion?.flashSale ? "Flash Sale" : "Promo"}{" "}
                  {pricing.discountLabel}
                </span>
              </>
            )}
          </div>
          <div className="detail-facts">
            <div>
              <span>{t("État")}</span>
              <strong>
                {t("État")} {product.condition}
              </strong>
            </div>
            {product.taille && (
              <div>
                <span>{t("Pointure")}</span>
                <strong>{product.taille} EU</strong>
              </div>
            )}
            <div>
              <span>{t("Référence")}</span>
              <strong>{product.sku}</strong>
            </div>
            <div>
              <span>{t("Numéro de page")}</span>
              <strong>#{product.pageNumber ?? product.id}</strong>
            </div>
          </div>
          {specifications.length > 0 && (
            <section className="product-specifications">
              <h2>{t("Fiche technique / Détails")}</h2>
              <dl>
                {specifications.map((attribute) => (
                  <div key={attribute.key}>
                    <dt>{attributeLabel(attribute, t)}</dt>
                    <dd>
                      {attribute.key === "batteryHealth"
                        ? `${displayAttributeValue(attribute.value, attribute.key, t)}%`
                        : displayAttributeValue(
                            attribute.value,
                            attribute.key,
                            t,
                          )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <p className="detail-description">
            {t(
              "Une pièce soigneusement sélectionnée par notre communauté. Consultez les photos et les détails avant de la faire vôtre.",
            )}
          </p>
          <div className="detail-actions">
            <button
              className="button-primary"
              onClick={() => addToCart(product)}
            >
              <ShoppingBag size={17} /> {t("Ajouter au panier")}
            </button>
            <Link
              className="button-secondary negotiation-link"
              to={`/products/${product.pageNumber ?? product.id}/negotiate`}
            >
              <MessageCircle size={17} /> {t("Négocier")}
            </Link>
            <button
              className={`button-secondary favorite-detail ${favorite ? "is-favorite" : ""}`}
              onClick={() => toggleWishlist(product.id)}
              aria-label={t("Ajouter aux favoris")}
            >
              <Heart size={18} fill={favorite ? "currentColor" : "none"} />
            </button>
          </div>
          {acceptedNegotiation && (
            <div className="accepted-deal">
              <div>
                <span>
                  <BadgeCheck size={16} /> {t("Votre offre est acceptée")}
                </span>
                <strong>
                  {formatPrice(acceptedNegotiation.agreedPrice)} TND
                </strong>
              </div>
              <button
                className="button-primary"
                onClick={() => {
                  addToCart(product, acceptedNegotiation.agreedPrice);
                  setCartOpen(true);
                }}
              >
                {t("Acheter à ce prix")}
              </button>
            </div>
          )}
          <div className="detail-assurances">
            <span>
              <ShieldCheck size={17} /> {t("Sélection Fastwo")}
            </span>
            <span>
              <Truck size={17} /> {t("Livraison partout en Tunisie")}
            </span>
            <span>Paiement à la livraison</span>
          </div>
        </section>
      </div>
      {similar.length > 0 && (
        <section className="similar-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("DANS LE MÊME ESPRIT")}</p>
              <h2>{t("Vous aimerez aussi")}</h2>
            </div>
          </div>
          <ProductGrid products={similar} />
        </section>
      )}
    </div>
  );
}
