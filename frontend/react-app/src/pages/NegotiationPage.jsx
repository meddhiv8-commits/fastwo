import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock3,
  Send,
  Tag,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatPrice } from "../components/ProductCard.jsx";
import { useMarketplace } from "../context/MarketplaceContext.jsx";
import ProductImage from "../components/ProductImage.jsx";

const MAX_OFFERS = 8;

export default function NegotiationPage() {
  const { productId } = useParams();
  const {
    products,
    negotiations,
    user,
    submitNegotiation,
    addToCart,
    setCartOpen,
    t,
  } = useMarketplace();
  const product = products.find(
    (item) =>
      String(item.id) === productId ||
      String(item.pageNumber ?? item.id) === productId,
  );
  const thread = negotiations.find(
    (item) => item.productId === product?.id && item.buyerPhone === user?.phone,
  );
  const offers = thread?.offers || [];
  const usedOffers = offers.length;
  const remainingOffers = Math.max(0, MAX_OFFERS - usedOffers);
  const minimumPrice = product ? Math.ceil(product.finalPrice * 0.9) : 0;
  const [offerPrice, setOfferPrice] = useState(product?.finalPrice || 0);
  const [error, setError] = useState("");
  const numericOffer = Number(offerPrice);
  const discount = product
    ? Math.max(0, Math.round((1 - numericOffer / product.finalPrice) * 100))
    : 0;
  const isClosed =
    thread?.status === "accepted" || thread?.status === "declined";

  if (!product || product.status === "REJECTED") {
    return (
      <section className="not-found">
        <p className="eyebrow">{t("ARTICLE INTROUVABLE")}</p>
        <h1>{t("Cette trouvaille est partie.")}</h1>
        <Link className="button-primary" to="/">
          {t("Retour à la sélection")}
        </Link>
      </section>
    );
  }

  function sendOffer(event) {
    event.preventDefault();
    setError("");
    try {
      submitNegotiation(product, numericOffer);
    } catch (issue) {
      setError(issue.message);
    }
  }

  function buyAt(price) {
    addToCart(product, price);
    setCartOpen(true);
  }

  return (
    <section className="negotiation-page">
      <Link
        to={`/products/${product.pageNumber ?? product.id}`}
        className="back-link"
      >
        <ArrowLeft size={16} /> {t("Retour à l’article")}
      </Link>
      <div className="negotiation-heading">
        <div>
          <p className="eyebrow">{t("FASTWO / OFFRE PRIVÉE")}</p>
          <h1>
            {t("Parlons du")} <em>{t("prix.")}</em>
          </h1>
          <p>
            {t("Faites une proposition au vendeur. Le prix reste entre vous.")}
          </p>
        </div>
        <div className="negotiation-rule">
          <Tag size={16} />
          <span>
            {t("8 propositions maximum")}
            <br />
            <strong>jusqu’à −10 %</strong>
          </span>
        </div>
      </div>

      <div className="negotiation-layout">
        <aside className="negotiation-product">
          <div className="negotiation-product-image">
            <ProductImage
              src={product.images?.[0]}
              alt={`${product.brand} ${product.model}`}
            />
          </div>
          <div className="negotiation-product-copy">
            <p className="eyebrow">
              {product.sku} / {product.category}
            </p>
            <h2>
              {product.brand} {product.model}
            </h2>
            <p>
              {t("Vendeur")} <strong>{product.sellerName}</strong>
            </p>
            <div className="negotiation-listed-price">
              <span>{t("Prix affiché")}</span>
              <strong>
                {formatPrice(product.finalPrice)} <small>TND</small>
              </strong>
            </div>
            <div className="negotiation-floor">
              <span>{t("Prix minimum autorisé")}</span>
              <strong>{formatPrice(minimumPrice)} TND</strong>
            </div>
          </div>
        </aside>

        <div className="negotiation-workspace">
          <div className="offer-progress">
            <div>
              <p className="eyebrow">VOTRE NÉGOCIATION</p>
              <h2>
                {remainingOffers} <small>/ {MAX_OFFERS}</small> propositions
                restantes
              </h2>
            </div>
            <div
              className="offer-progress-bars"
              aria-label={`${usedOffers} proposition(s) utilisée(s) sur 8`}
            >
              {Array.from({ length: MAX_OFFERS }, (_, index) => (
                <span
                  key={index}
                  className={index < usedOffers ? "is-used" : ""}
                />
              ))}
            </div>
          </div>

          {thread?.status === "accepted" ? (
            <div className="negotiation-result accepted-result">
              <span className="result-icon">
                <BadgeCheck size={22} />
              </span>
              <p className="eyebrow">ACCORD TROUVÉ</p>
              <h2>Le vendeur accepte votre prix.</h2>
              <p>Vous pouvez acheter cet article au montant convenu.</p>
              <strong className="result-price">
                {formatPrice(thread.agreedPrice)} TND
              </strong>
              <button
                className="button-primary"
                onClick={() => buyAt(thread.agreedPrice)}
              >
                Acheter à ce prix
              </button>
            </div>
          ) : thread?.status === "declined" ? (
            <div className="negotiation-result declined-result">
              <span className="result-icon">
                <X size={21} />
              </span>
              <p className="eyebrow">OFFRE REFUSÉE</p>
              <h2>Le vendeur ne peut pas accepter.</h2>
              <p>Vous pouvez toujours acheter au prix affiché.</p>
              <button
                className="button-primary"
                onClick={() => buyAt(product.finalPrice)}
              >
                Acheter au prix affiché
              </button>
            </div>
          ) : remainingOffers === 0 ? (
            <div className="negotiation-result">
              <span className="result-icon">
                <Clock3 size={20} />
              </span>
              <p className="eyebrow">8 PROPOSITIONS UTILISÉES</p>
              <h2>Votre marge de négociation est épuisée.</h2>
              <p>
                Le prix affiché reste disponible pour finaliser votre achat.
              </p>
              <button
                className="button-primary"
                onClick={() => buyAt(product.finalPrice)}
              >
                Acheter au prix affiché
              </button>
            </div>
          ) : (
            <form className="offer-form" onSubmit={sendOffer}>
              <label className="offer-amount-label" htmlFor="offerAmount">
                Votre proposition <span>TND</span>
              </label>
              <div className="offer-amount-field">
                <input
                  id="offerAmount"
                  type="number"
                  min={minimumPrice}
                  max={product.finalPrice}
                  step="1"
                  value={offerPrice}
                  onChange={(event) => setOfferPrice(event.target.value)}
                  required
                />
                <span>TND</span>
              </div>
              <input
                className="offer-range"
                type="range"
                min={minimumPrice}
                max={product.finalPrice}
                step="1"
                value={Math.min(
                  product.finalPrice,
                  Math.max(minimumPrice, numericOffer || minimumPrice),
                )}
                onChange={(event) => setOfferPrice(event.target.value)}
                aria-label="Ajuster le montant proposé"
              />
              <div className="offer-range-labels">
                <span>
                  {formatPrice(minimumPrice)} TND <small>−10 % max</small>
                </span>
                <span>
                  {formatPrice(product.finalPrice)} TND{" "}
                  <small>prix affiché</small>
                </span>
              </div>
              <div className="offer-summary">
                <span>Votre réduction</span>
                <strong>−{discount}%</strong>
                <span className="offer-summary-price">
                  Vous proposez <b>{formatPrice(numericOffer)} TND</b>
                </span>
              </div>
              {thread?.status === "pending" && (
                <p className="pending-note">
                  <Clock3 size={15} /> Votre dernière proposition attend une
                  réponse. Vous pouvez en envoyer une nouvelle.
                </p>
              )}
              {error && <p className="form-error">{error}</p>}
              <button className="button-primary offer-submit" type="submit">
                <Send size={16} /> Envoyer ma proposition{" "}
                <span>{remainingOffers} restantes</span>
              </button>
              <p className="offer-disclaimer">
                Une proposition est une demande, pas une réservation. Aucun
                montant inférieur à −10 % ne sera accepté par le formulaire.
              </p>
            </form>
          )}

          <div className="offer-history">
            <div className="offer-history-heading">
              <h3>Historique</h3>
              <span>
                {usedOffers} / {MAX_OFFERS}
              </span>
            </div>
            {offers.length ? (
              offers.map((offer, index) => (
                <div className="offer-history-item" key={offer.id}>
                  <span className="offer-history-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="offer-history-copy">
                    <strong>Votre proposition</strong>
                    <small>
                      {new Date(offer.createdAt).toLocaleString("fr-TN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </span>
                  <b>{formatPrice(offer.amount)} TND</b>
                </div>
              ))
            ) : (
              <p className="offer-history-empty">
                Votre première proposition apparaîtra ici.
              </p>
            )}
            {thread?.status === "pending" && (
              <div className="seller-reply-note">
                <Clock3 size={14} /> En attente de la réponse de{" "}
                {product.sellerName}
              </div>
            )}
            {thread?.status === "accepted" && (
              <div className="seller-reply-note is-accepted">
                <Check size={14} /> Prix accepté par le vendeur
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
