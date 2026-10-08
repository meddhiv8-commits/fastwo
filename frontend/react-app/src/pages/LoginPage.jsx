import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext.jsx";

export default function LoginPage() {
  const { requestOtp, verifyOtp, user, t } = useMarketplace();
  const [step, setStep] = useState("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (user)
    return (
      <section className="login-page">
        <div className="login-card">
          <p className="eyebrow">{t("COMPTE FASTWO")}</p>
          <h1>
            {t("Bonjour,")} {user.name}.
          </h1>
          <Link to="/seller" className="button-primary">
            {t("Mon espace vendeur")} <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    );

  async function submitPhone(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const demo = await requestOtp(name.trim(), phone.trim());
      setStep("code");
      if (demo)
        setError("Mode démo activé. Votre code de vérification est 1234.");
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verifyOtp(code.trim());
      navigate(location.state?.from || "/seller", { replace: true });
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="login-page">
      <div className="login-aside">
        <span className="login-stamp">F2</span>
        <p className="eyebrow">{t("UNE COMMUNAUTÉ DE TROUVAILLES")}</p>
        <h2>
          {t("Chaque objet a")}
          <br />
          <em>{t("une suite.")}</em>
        </h2>
        <p>
          {t(
            "Connectez-vous pour vendre, suivre vos annonces et garder vos favoris à portée de main.",
          )}
        </p>
        <div className="login-promise">
          <ShieldCheck size={18} /> {t("Vos informations restent privées")}
        </div>
      </div>
      <div className="login-card">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} /> {t("Boutique")}
        </Link>
        {step === "phone" ? (
          <>
            <p className="eyebrow">{t("VOTRE COMPTE FASTWO")}</p>
            <h1>{t("Ravi de vous retrouver.")}</h1>
            <p className="login-lede">
              {t("Un code de vérification vous sera envoyé par WhatsApp.")}
            </p>
            <form className="stacked-form" onSubmit={submitPhone}>
              <label>
                {t("Votre nom")}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  placeholder={t("Prénom et nom")}
                />
              </label>
              <label>
                {t("Téléphone tunisien")}
                <div className="phone-field">
                  <span>+216</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    minLength="8"
                    placeholder="XX XXX XXX"
                  />
                </div>
              </label>
              {error && (
                <p
                  className={
                    error.includes("démo") ? "form-note" : "form-error"
                  }
                >
                  {error}
                </p>
              )}
              <button className="button-primary form-submit" disabled={busy}>
                {busy ? (
                  t("Envoi en cours…")
                ) : (
                  <>
                    {t("Recevoir mon code")} <MessageCircle size={17} />
                  </>
                )}
              </button>
            </form>
            <p className="login-legal">
              <LockKeyhole size={13} />{" "}
              {t("Connexion sécurisée par code à usage unique")}
            </p>
          </>
        ) : (
          <>
            <button
              className="back-link back-button"
              onClick={() => {
                setStep("phone");
                setError("");
              }}
            >
              <ArrowLeft size={16} /> {t("Modifier mon numéro")}
            </button>
            <p className="eyebrow">{t("VÉRIFICATION")}</p>
            <h1>{t("Un dernier pas.")}</h1>
            <p className="login-lede">
              {t("Saisissez le code envoyé au")} <strong>+216 {phone}</strong>.
            </p>
            <form className="stacked-form" onSubmit={submitCode}>
              <label>
                {t("Code à 4 chiffres")}
                <input
                  className="otp-input"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  required
                  placeholder="0000"
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              <button
                className="button-primary form-submit"
                disabled={busy || code.length < 4}
              >
                {busy ? (
                  t("Vérification…")
                ) : (
                  <>
                    {t("Confirmer")} <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
            <p className="login-legal">{t("La démo accepte le code 1234.")}</p>
          </>
        )}
      </div>
    </section>
  );
}
