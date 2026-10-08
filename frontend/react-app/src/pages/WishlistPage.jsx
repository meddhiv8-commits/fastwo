import { ArrowLeft, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import ProductGrid from "../components/ProductGrid.jsx";
import { useMarketplace } from "../context/MarketplaceContext.jsx";

export default function WishlistPage() {
  const { products, wishlist, t } = useMarketplace();
  const saved = products.filter(
    (product) => wishlist.includes(product.id) && product.status === "APPROVED",
  );
  return (
    <section className="standard-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> {t("Retour à la sélection")}
      </Link>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">{t("VOTRE SÉLECTION")}</p>
          <h1>
            {t("Les coups de cœur")}
            <span className="title-dot">.</span>
          </h1>
        </div>
        <span className="subtle-count">
          {saved.length} {t("article(s)")}
        </span>
      </div>
      {saved.length ? (
        <ProductGrid products={saved} />
      ) : (
        <div className="empty-state empty-large">
          <Heart size={34} />
          <h3>{t("Rien de gardé pour plus tard")}</h3>
          <p>{t("Ajoutez un article à vos favoris pour le retrouver ici.")}</p>
          <Link className="button-secondary" to="/">
            {t("Explorer les articles")}
          </Link>
        </div>
      )}
    </section>
  );
}
