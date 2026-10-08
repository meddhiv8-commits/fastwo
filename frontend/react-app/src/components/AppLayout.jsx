import { Outlet } from "react-router-dom";
import { Bot, MessageCircle } from "lucide-react";
import { useState } from "react";
import CartDrawer from "./CartDrawer.jsx";
import Header from "./Header.jsx";
import Toast from "./Toast.jsx";
import { useMarketplace } from "../context/MarketplaceContext.jsx";

export default function AppLayout() {
  const { notify, submitReview, supportWhatsappNumber, t } = useMarketplace();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    if (!rating || !comment.trim()) return;
    submitReview({ rating, text: comment });
    setSubmitted(true);
  }

  function openWhatsApp(message) {
    const number = String(supportWhatsappNumber || "21623191586").replace(
      /\D/g,
      "",
    );
    if (!number) {
      notify(t("Le numéro WhatsApp Fastwo n'est pas encore configuré."));
      return;
    }
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="page-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="footer-review">
          <div className="footer-review-copy">
            <p className="footer-eyebrow">{t("VOTRE AVIS COMPTE")}</p>
            <h2>{t("Une trouvaille à partager ?")}</h2>
            <p>
              {t(
                "Votre retour aide notre communauté à choisir avec confiance.",
              )}
            </p>
          </div>
          {submitted ? (
            <div className="review-success" role="status">
              <span className="review-success-icon">✓</span>
              <div>
                <strong>{t("Merci pour votre retour.")}</strong>
                <span>{t("Votre avis a bien été pris en compte.")}</span>
              </div>
            </div>
          ) : (
            <form className="footer-review-form" onSubmit={handleSubmit}>
              <fieldset className="star-picker">
                <legend>{t("Notez votre expérience")}</legend>
                <div className="star-options">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label
                      className={value <= rating ? "is-selected" : ""}
                      key={value}
                    >
                      <input
                        type="radio"
                        name="footer-rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                      />
                      <span aria-hidden="true">★</span>
                      <span className="sr-only">{value} étoile(s)</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="comment-field">
                <span className="sr-only">{t("Votre commentaire")}</span>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={t("Dites-nous ce que vous avez pensé...")}
                  rows="2"
                  maxLength="240"
                />
              </label>
              <button className="review-submit" type="submit">
                {t("Envoyer mon avis")} <span aria-hidden="true">→</span>
              </button>
            </form>
          )}
        </div>
        <div className="footer-channels" aria-label={t("Canaux Fastwo")}>
          <button
            className="footer-channel"
            type="button"
            onClick={() => openWhatsApp("Bonjour Fastwo, j'ai une question.")}
            title={t("Ouvrir WhatsApp")}
          >
            <span
              className="footer-channel-icon footer-whatsapp-icon"
              aria-hidden="true"
            >
              <MessageCircle size={18} />
            </span>
            <span>
              <strong>{t("WhatsApp")}</strong>
              <small>{t("Écrivez-nous pour toute question")}</small>
            </span>
          </button>
          <button
            className="footer-channel"
            type="button"
            onClick={() =>
              openWhatsApp(
                "Bonjour Fastwo, j'aimerais parler à l'assistant IA.",
              )
            }
            title={t("Ouvrir l'assistant Fastwo")}
          >
            <span
              className="footer-channel-icon footer-assistant-icon"
              aria-hidden="true"
            >
              <Bot size={18} />
            </span>
            <span>
              <strong>{t("Assistant Fastwo")}</strong>
              <small>{t("Réponses produits et commandes")}</small>
            </span>
          </button>
        </div>
        <div className="footer-bottom">
          <strong>FASTWO</strong>
          <span>{t("La seconde main, premier choix.")}</span>
          <span>{t("Tunis, Tunisie · Paiement à la livraison")}</span>
        </div>
      </footer>
      <CartDrawer />
      <Toast />
    </div>
  );
}
