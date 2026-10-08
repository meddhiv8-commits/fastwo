import {
  ArrowDownWideNarrow,
  ArrowRight,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ProductGrid from "../components/ProductGrid.jsx";
import { categories } from "../data/demoData.js";
import { useMarketplace } from "../context/MarketplaceContext.jsx";

export default function ShopPage() {
  const { products, query, reviews, t } = useMarketplace();
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedId = searchParams.get("id");
  useEffect(() => {
    if (!requestedId) return;
    const target = products.find(
      (product) =>
        String(product.id) === requestedId ||
        String(product.pageNumber ?? product.id) === requestedId,
    );
    if (target)
      navigate(`/products/${target.pageNumber ?? target.id}`, {
        replace: true,
      });
  }, [navigate, products, requestedId]);
  useEffect(() => {
    const exactId = query.trim().replace(/^#/, "");
    if (!/^\d+$/.test(exactId)) return;
    const target = products.find(
      (product) =>
        String(product.id) === exactId ||
        String(product.pageNumber ?? product.id) === exactId,
    );
    if (target) navigate(`/products/${target.pageNumber ?? target.id}`);
  }, [navigate, products, query]);
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const visibleProducts = products.filter((product) => {
    if (product.status === "REJECTED") return false;
    const matchesCategory = category === "all" || product.category === category;
    const searchable =
      `${product.brand} ${product.model} ${product.sku} ${product.category} ${product.id} ${product.pageNumber ?? ""}`.toLocaleLowerCase(
        "fr",
      );
    return (
      matchesCategory &&
      (!normalizedQuery || searchable.includes(normalizedQuery))
    );
  });
  if (sort === "price-low")
    visibleProducts.sort((a, b) => a.finalPrice - b.finalPrice);
  if (sort === "price-high")
    visibleProducts.sort((a, b) => b.finalPrice - a.finalPrice);
  const reviewAverage = reviews.length
    ? (
        reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      ).toFixed(1)
    : "0.0";

  if (requestedId) {
    const directProduct = products.find(
      (product) =>
        String(product.id) === requestedId ||
        String(product.pageNumber ?? product.id) === requestedId,
    );
    if (directProduct) return null;
  }

  return (
    <div className="shop-page">
      <section className="shop-intro">
        <div className="intro-copy">
          <p className="eyebrow">{t("LE BON OBJET, AU BON MOMENT")}</p>
          <h1>
            {t("La seconde main.")}
            <br />
            <em>{t("Premier choix.")}</em>
          </h1>
          <p>
            {t(
              "Des pièces sélectionnées, vérifiées et prêtes à vivre une nouvelle histoire.",
            )}
          </p>
          <Link className="intro-link" to="/sell">
            {t("Vendre un article")} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="intro-art" aria-label="Sélection Fastwo">
          <img
            src="https://images.unsplash.com/photo-1491553895911-0055uj0c0?auto=format&fit=crop&w=1000&q=85"
            alt="Sneakers choisies sur Fastwo"
            onError={(event) => {
              event.currentTarget.src =
                "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85";
            }}
          />
          <span className="art-note">
            {t("TROUVÉ EN TUNISIE")}
            <br />
            <b>{t("CHOISI POUR DURER")}</b>
          </span>
        </div>
      </section>

      <div className="trust-strip">
        <span>
          <ShieldCheck size={17} /> {t("Articles vérifiés")}
        </span>
        <span>
          <Truck size={17} /> {t("Livraison nationale")}
        </span>
        <span>دفع عند الاستلام · Paiement à la livraison</span>
      </div>

      <section className="catalog-section" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("LA SÉLECTION FASTWO")}</p>
            <h2 id="catalog-title">{t("À découvrir")}</h2>
          </div>
          <label className="sort-control">
            <ArrowDownWideNarrow size={16} />
            <select
              aria-label={t("Trier les produits")}
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">{t("À la une")}</option>
              <option value="price-low">{t("Prix croissant")}</option>
              <option value="price-high">{t("Prix décroissant")}</option>
            </select>
          </label>
        </div>
        <div className="category-scroller" aria-label="Filtrer par catégorie">
          {categories.map((item) => (
            <button
              key={item.value}
              className={`category-chip ${category === item.value ? "is-active" : ""}`}
              onClick={() => setCategory(item.value)}
            >
              <span>{item.icon}</span>
              {t(item.name)}
            </button>
          ))}
        </div>
        {query && (
          <p className="search-summary">
            {visibleProducts.length} résultat(s) pour « {query} »
          </p>
        )}
        <ProductGrid products={visibleProducts} />
      </section>

      <section className="reviews-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("ILS NOUS ONT FAIT CONFIANCE")}</p>
            <h2>Leurs trouvailles, leurs mots.</h2>
          </div>
          <span className="review-score">
            ★ {reviewAverage.replace(".", ",")} <small>/ 5</small>
          </span>
        </div>
        <div className="review-grid">
          {reviews.map((review, index) => (
            <article
              className="review-item"
              key={review.id || `${review.name}-${index}`}
            >
              <div className="review-meta">
                <span className="review-avatar">{review.avatar}</span>
                <div>
                  <strong>{review.name}</strong>
                  <small>{review.city}</small>
                </div>
                <span className="review-stars">
                  {"★".repeat(review.rating)}
                </span>
              </div>
              <p>“{review.text}”</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
