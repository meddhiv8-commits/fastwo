import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext.jsx";

export default function AdminLoginPage() {
  const { isAdmin, loginAdmin, t } = useMarketplace();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  if (isAdmin) return <Navigate to="/admin" replace />;

  async function submit(event) {
    event.preventDefault();
    try {
      await loginAdmin(password);
      navigate("/admin", { replace: true });
    } catch (issue) {
      setError(issue.message);
      setPassword("");
    }
  }

  return (
    <section className="login-page admin-login-page">
      <div className="login-card">
        <span className="admin-icon">
          <LockKeyhole size={21} />
        </span>
        <p className="eyebrow">{t("FASTWO / ADMIN")}</p>
        <h1>{t("Accès équipe.")}</h1>
        <p className="login-lede">
          {t("Connectez-vous pour gérer les annonces et les commandes.")}
        </p>
        <form className="stacked-form" onSubmit={submit}>
          <label>
            {t("Mot de passe")}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button-primary form-submit">
            {t("Ouvrir le tableau de bord")}
          </button>
        </form>
      </div>
    </section>
  );
}
