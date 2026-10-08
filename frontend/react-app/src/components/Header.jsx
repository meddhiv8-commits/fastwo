import { useState } from "react";
import {
  Heart,
  Bell,
  Search,
  Shield,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext.jsx";

export default function Header() {
  const {
    cartCount,
    setCartOpen,
    wishlist,
    user,
    logout,
    query,
    setQuery,
    language,
    setLanguage,
    t,
    sellerOffers,
  } = useMarketplace();
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  function submitSearch(event) {
    event.preventDefault();
    navigate("/");
    setSearchOpen(false);
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="Fastwo, accueil">
          <span className="brand-mark">F2</span>
          <span className="brand-word">
            FAST<span>WO</span>
            <small>TN</small>
          </span>
        </Link>
        <form
          className={`header-search ${searchOpen ? "is-open" : ""}`}
          onSubmit={submitSearch}
          role="search"
        >
          <Search size={17} aria-hidden="true" />
          <input
            aria-label={t("Rechercher")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Marque, modèle, catégorie ou numéro de page...")}
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery("")}
              aria-label={t("Effacer la recherche")}
            >
              ×
            </button>
          )}
        </form>
        <nav className="header-actions" aria-label={t("Navigation principale")}>
          <button
            className="icon-button mobile-search-trigger"
            onClick={() => setSearchOpen((open) => !open)}
            aria-label={t("Rechercher")}
          >
            <Search size={19} />
          </button>
          <NavLink
            className="icon-button wishlist-link"
            to="/wishlist"
            aria-label={t("Favoris")}
          >
            <Heart size={19} />
            {wishlist.length > 0 && (
              <span className="count-badge">{wishlist.length}</span>
            )}
          </NavLink>
          <NavLink
            className="icon-button admin-link"
            to="/admin"
            aria-label={t("Administration")}
            title={t("Administration")}
          >
            <Shield size={18} />
          </NavLink>
          <NavLink className="sell-link" to={user ? "/sell" : "/login"}>
            <Store size={16} />
            <span>{t("Vendre")}</span>
          </NavLink>
          {user ? (
            <div className="user-menu">
              <NavLink
                className="icon-button notification-link"
                to="/seller#notifications"
                aria-label={`${t("Offres reçues")}, ${sellerOffers.length}`}
                title={t("Offres reçues")}
              >
                <Bell size={18} />
                {sellerOffers.length > 0 && (
                  <span className="count-badge">{sellerOffers.length}</span>
                )}
              </NavLink>
              <NavLink className="user-name" to="/seller">
                <UserRound size={17} />
                <span>{user.name.split(" ")[0]}</span>
              </NavLink>
              <button className="text-button" onClick={logout}>
                {t("Sortir")}
              </button>
            </div>
          ) : (
            <NavLink className="login-link" to="/login">
              {t("Connexion")}
            </NavLink>
          )}
          <button
            className="bag-button"
            onClick={() => setCartOpen(true)}
            aria-label={`${t("Ouvrir le panier")}, ${cartCount} ${t("article(s)")}`}
          >
            <ShoppingBag size={19} />
            <span>{t("Panier")}</span>
            {cartCount > 0 && <b className="count-badge">{cartCount}</b>}
          </button>
          <label className="language-switch" aria-label={t("Langue")}>
            <span className="sr-only">{t("Langue")}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label={t("Langue")}
            >
              <option value="fr">FR</option>
              <option value="ar">عربي</option>
            </select>
          </label>
        </nav>
      </div>
      {searchOpen && (
        <form className="mobile-search" onSubmit={submitSearch}>
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Rechercher un article")}
          />
        </form>
      )}
    </header>
  );
}
