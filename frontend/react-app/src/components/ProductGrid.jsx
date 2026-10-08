import { PackageSearch } from "lucide-react";
import ProductCard from "./ProductCard.jsx";

export default function ProductGrid({
  products,
  emptyTitle = "Aucun article trouvé",
  emptyText = "Essayez une autre recherche ou catégorie.",
}) {
  if (!products.length) {
    return (
      <div className="empty-state">
        <PackageSearch size={32} />
        <h3>{emptyTitle}</h3>
        <p>{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
