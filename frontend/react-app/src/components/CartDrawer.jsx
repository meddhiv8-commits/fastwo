import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { useMarketplace } from "../context/MarketplaceContext.jsx";
import { formatPrice } from "./ProductCard.jsx";
import ProductImage from "./ProductImage.jsx";

export default function CartDrawer() {
  const {
    cartOpen,
    setCartOpen,
    cartLines,
    cartTotal,
    cartDeliveryFee,
    changeQuantity,
    placeOrder,
    user,
    t,
  } = useMarketplace();
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  if (!cartOpen) return null;

  function checkout(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const order = placeOrder(values);
      setPlaced(order.orderId);
      setError("");
    } catch (issue) {
      setError(issue.message);
    }
  }

  return (
    <div
      className="drawer-scrim"
      onMouseDown={(event) =>
        event.target === event.currentTarget && setCartOpen(false)
      }
    >
      <section
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-heading"
      >
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">{t("FASTWO / COMMANDE")}</span>
            <h2 id="cart-heading">{t("Votre panier")}</h2>
          </div>
          <button
            className="icon-button"
            onClick={() => {
              setCartOpen(false);
              setPlaced(null);
            }}
            aria-label={t("Fermer le panier")}
          >
            <X />
          </button>
        </div>
        {placed ? (
          <div className="order-success">
            <span className="success-mark">✓</span>
            <p className="eyebrow">{t("COMMANDE CONFIRMÉE")}</p>
            <h3>{placed}</h3>
            <p>{t("Nous vous contacterons pour confirmer la livraison.")}</p>
            <button
              className="button-primary"
              onClick={() => {
                setCartOpen(false);
                setPlaced(null);
              }}
            >
              {t("Continuer mes achats")}
            </button>
          </div>
        ) : cartLines.length === 0 ? (
          <div className="empty-cart">
            <ShoppingBag size={38} />
            <h3>{t("Votre panier est vide")}</h3>
            <p>{t("Les belles trouvailles n’attendent que vous.")}</p>
            <button
              className="button-secondary"
              onClick={() => setCartOpen(false)}
            >
              {t("Voir les articles")}
            </button>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {cartLines.map(({ id, quantity, product, unitPrice }) => (
                <div className="cart-line" key={id}>
                  <ProductImage src={product.images?.[0]} alt="" />
                  <div className="cart-line-details">
                    <span>{product.brand}</span>
                    <strong>{product.model}</strong>
                    <b>{formatPrice(unitPrice)} TND</b>
                    {unitPrice < product.finalPrice && (
                      <small className="negotiated-cart-note">
                        {t("Prix négocié accepté")}
                      </small>
                    )}
                    <div className="quantity-control">
                      <button
                        onClick={() => changeQuantity(id, quantity - 1)}
                        aria-label={t("Diminuer la quantité")}
                      >
                        <Minus size={13} />
                      </button>
                      <span>{quantity}</span>
                      <button
                        onClick={() => changeQuantity(id, quantity + 1)}
                        aria-label={t("Augmenter la quantité")}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form className="checkout-form" onSubmit={checkout}>
              <div className="cart-total">
                <span>{t("Sous-total")}</span>
                <strong>{formatPrice(cartTotal)} TND</strong>
              </div>
              <div className="cart-total delivery-fee">
                <span>{t("Livraison")}</span>
                <span>
                  {cartDeliveryFee === 0
                    ? t("Gratuite")
                    : `${formatPrice(cartDeliveryFee)} TND`}
                </span>
              </div>
              <label>
                {t("Nom complet")}
                <input
                  name="clientName"
                  defaultValue={user?.name || ""}
                  required
                />
              </label>
              <label>
                {t("Téléphone")}
                <input
                  name="clientPhone"
                  inputMode="tel"
                  defaultValue={user?.phone || ""}
                  required
                />
              </label>
              <label>
                {t("Adresse de livraison")}
                <textarea
                  name="address"
                  rows="2"
                  required
                  placeholder={t("Rue, ville, repère")}
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              <button className="button-primary checkout-button" type="submit">
                {t("Commander")} · {formatPrice(cartTotal + cartDeliveryFee)}{" "}
                TND
              </button>
              <p className="checkout-note">
                {t("Paiement à la livraison · Livraison partout en Tunisie")}
              </p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
