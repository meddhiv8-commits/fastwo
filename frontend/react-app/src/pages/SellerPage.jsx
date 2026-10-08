import {
  ArrowRight,
  Check,
  CirclePlus,
  MessageCircle,
  Package,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useMarketplace } from "../context/MarketplaceContext.jsx";
import { calculateCommission } from "../lib/commission.js";
import { formatPrice } from "../components/ProductCard.jsx";
import ProductImage from "../components/ProductImage.jsx";

function phoneMatches(left, right) {
  const localLeft = String(left || "")
    .replace(/\D/g, "")
    .slice(-8);
  const localRight = String(right || "")
    .replace(/\D/g, "")
    .slice(-8);
  return localLeft.length === 8 && localLeft === localRight;
}

export default function SellerPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const focusedNegotiationId = searchParams.get("negotiation");
  const {
    user,
    products,
    negotiations,
    sellerOffers,
    updateProduct,
    deleteProduct,
    respondToNegotiation,
    notify,
    t,
  } = useMarketplace();
  const [offerError, setOfferError] = useState("");
  const mine = products.filter((product) =>
    phoneMatches(product.sellerPhone, user?.phone),
  );
  const incomingOffers = sellerOffers.length
    ? sellerOffers
    : negotiations.filter(
        (item) =>
          phoneMatches(item.sellerPhone, user?.phone) &&
          item.status === "pending",
      );

  useEffect(() => {
    if (location.hash === "#notifications" && incomingOffers.length > 0) {
      document.getElementById("notifications")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [incomingOffers.length, location.hash]);

  async function answerOffer(offerId, accepted) {
    setOfferError("");
    try {
      await respondToNegotiation(offerId, accepted);
    } catch (issue) {
      setOfferError(issue.message || t("Réponse à l’offre impossible"));
    }
  }

  function updatePrice(product) {
    const nextPrice = Number(
      window.prompt(t("Nouveau prix vendeur (TND)"), product.sellerPrice),
    );
    if (!nextPrice || nextPrice < 1) return;
    const commission = calculateCommission(nextPrice);
    updateProduct(product.id, {
      sellerPrice: nextPrice,
      finalPrice: commission.publicPrice,
      commissionRate: commission.rate,
      commissionAmount: commission.commission,
      sellerPayout: commission.sellerPayout,
    });
    notify(t("Prix mis à jour"));
  }

  function removeProduct(product) {
    if (window.confirm(`${t("Supprimer")} « ${product.model} » ?`))
      deleteProduct(product.id);
  }

  return (
    <section className="standard-page seller-page">
      <div className="page-title-row seller-heading">
        <div>
          <p className="eyebrow">{t("VOTRE COMPTE / VENDEUR")}</p>
          <h1>
            {t("Bonjour,")} {user?.name.split(" ")[0]}
            <span className="title-dot">.</span>
          </h1>
          <p className="page-lede">
            {t("Suivez vos annonces et mettez à jour vos prix.")}
          </p>
        </div>
        <Link className="button-primary" to="/sell">
          <CirclePlus size={17} /> {t("Nouvelle annonce")}
        </Link>
      </div>
      <div className="seller-stats">
        <div>
          <span>{t("Annonces")}</span>
          <strong>{mine.length}</strong>
        </div>
        <div>
          <span>{t("Publiées")}</span>
          <strong>
            {mine.filter((product) => product.status === "APPROVED").length}
          </strong>
        </div>
        <div>
          <span>{t("À vérifier")}</span>
          <strong>
            {mine.filter((product) => product.status === "PENDING").length}
          </strong>
        </div>
      </div>
      {incomingOffers.length > 0 && (
        <section className="incoming-offers" id="notifications">
          <div className="incoming-offers-heading">
            <div>
              <p className="eyebrow">{t("OFFRES REÇUES")}</p>
              <h2>{t("À vous de répondre")}</h2>
            </div>
            <span>{incomingOffers.length}</span>
          </div>
          {offerError && <p className="form-error">{offerError}</p>}
          {incomingOffers.map((offer) => {
            const latestOffer = offer.offers[offer.offers.length - 1];
            const reduction = Math.round(
              (1 - latestOffer.amount / offer.listedPrice) * 100,
            );
            return (
              <article
                className={`incoming-offer ${String(offer.id) === focusedNegotiationId ? "is-focused" : ""}`}
                key={offer.id}
              >
                <div className="incoming-offer-product">
                  <MessageCircle size={18} />
                  <div>
                    <strong>{offer.productLabel}</strong>
                    <span>
                      {offer.buyerName} · {offer.offers.length}/8{" "}
                      {t("propositions")}
                    </span>
                    <Link
                      to={offer.productUrl || `/products/${offer.productId}`}
                    >
                      {t("Voir l’annonce")} · #
                      {offer.pageNumber || offer.productId}
                    </Link>
                  </div>
                </div>
                <div className="incoming-offer-price">
                  <strong>
                    {new Intl.NumberFormat("fr-TN").format(latestOffer.amount)}{" "}
                    TND
                  </strong>
                  <span>
                    −{reduction}% · {t("affiché")}{" "}
                    {new Intl.NumberFormat("fr-TN").format(offer.listedPrice)}{" "}
                    TND
                  </span>
                </div>
                <div className="incoming-offer-actions">
                  <button
                    className="button-secondary"
                    onClick={() => answerOffer(offer.id, false)}
                  >
                    <X size={15} /> {t("Non, refuser")}
                  </button>
                  <button
                    className="button-primary"
                    onClick={() => answerOffer(offer.id, true)}
                  >
                    <Check size={15} /> {t("Oui, accepter")}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
      {mine.length ? (
        <div className="seller-list">
          {mine.map((product) => (
            <article className="seller-item" key={product.id}>
              <ProductImage src={product.images?.[0]} alt="" />
              <div className="seller-item-copy">
                <span
                  className={`status-pill status-${product.status.toLowerCase()}`}
                >
                  {product.status === "APPROVED"
                    ? t("En ligne")
                    : product.status === "PENDING"
                      ? t("En vérification")
                      : t("Refusée")}
                </span>
                <h2>
                  {product.brand} {product.model}
                </h2>
                <p>
                  {product.sku} · {t("État")} {product.condition}
                </p>
              </div>
              <div className="seller-item-price">
                <span>{t("Votre prix")}</span>
                <strong>{formatPrice(product.sellerPrice)} TND</strong>
                <small>
                  {t("Prix public")} {formatPrice(product.finalPrice)} TND
                </small>
              </div>
              <div className="seller-item-actions">
                <button
                  className="icon-button"
                  onClick={() => updatePrice(product)}
                  aria-label={`${t("Modifier le prix de")} ${product.model}`}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button danger-button"
                  onClick={() => removeProduct(product)}
                  aria-label={`${t("Supprimer")} ${product.model}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-large">
          <Package size={34} />
          <h3>{t("Votre vitrine est encore vide")}</h3>
          <p>
            {t(
              "Déposez votre première annonce et laissez Fastwo s’occuper de la suite.",
            )}
          </p>
          <Link className="button-primary" to="/sell">
            {t("Déposer une annonce")} <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </section>
  );
}
