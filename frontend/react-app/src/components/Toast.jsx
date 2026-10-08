import { useMarketplace } from "../context/MarketplaceContext.jsx";

export default function Toast() {
  const { toast } = useMarketplace();
  return (
    <div
      className={`toast ${toast ? "toast-visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      {toast}
    </div>
  );
}
