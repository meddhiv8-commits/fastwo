import { Heart, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext.jsx";
import { getPromotionState } from "../lib/pricing.js";
import ProductImage from "./ProductImage.jsx";

export function formatPrice(price) {
  return new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(
    price,
  );
}

export default function ProductCard({ product }) {
  const { addToCart, toggleWishlist, wishlist, t } = useMarketplace();
  const favorite = wishlist.includes(product.id);
  const pricing = getPromotionState(product);
  const pageNumber = product.pageNumber ?? product.id;

  return (
    <article className="product-card">
      <div className="product-photo-wrap">
        <Link
          to={`/products/${pageNumber}`}
          className="product-photo-link"
          aria-label={`Voir ${product.brand} ${product.model}`}
        >
          <ProductImage
            src={product.images?.[0]}
            alt={`${product.brand} ${product.model}`}
            loading="lazy"
          />
          <span className="sku-tag">#{pageNumber}</span>
          {pricing.active && (
            <span className="sale-tag">
              {pricing.promotion?.flashSale ? "Flash Sale" : "Promo"}
            </span>
          )}
        </Link>
        <button
          className={`favorite-button ${favorite ? "is-favorite" : ""}`}
          onClick={() => toggleWishlist(product.id)}
          aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={favorite}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <div className="product-category-line">
          <span>{product.brand}</span>
          <span className={`condition condition-${product.condition}`}>
            {t("État")} {product.condition}
          </span>
        </div>
        <Link to={`/products/${pageNumber}`} className="product-title">
          {product.model}
        </Link>
        <div className="product-bottom">
          <div className="product-price">
            {pricing.active && <del>{formatPrice(pricing.basePrice)} TND</del>}
            <strong>
              {formatPrice(pricing.finalPrice)} <small>TND</small>
            </strong>
            {pricing.active && (
              <small className="discount-label">{pricing.discountLabel}</small>
            )}
          </div>
          <button
            className="add-button"
            onClick={() => addToCart(product)}
            aria-label={`Ajouter ${product.model} au panier`}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
