import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext.jsx";

export function RequireUser() {
  const { user } = useMarketplace();
  const location = useLocation();
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  );
}

export function RequireAdmin() {
  const { isAdmin } = useMarketplace();
  return isAdmin ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
