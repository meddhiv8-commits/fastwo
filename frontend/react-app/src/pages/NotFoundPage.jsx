import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="eyebrow">ERREUR 404 / PAGE INTROUVABLE</p>
      <h1>Cette page a pris un autre chemin.</h1>
      <p>Retrouvez la sélection Fastwo et ses dernières trouvailles.</p>
      <Link to="/" className="button-primary">
        <ArrowLeft size={17} /> Retour à l’accueil
      </Link>
    </section>
  );
}
