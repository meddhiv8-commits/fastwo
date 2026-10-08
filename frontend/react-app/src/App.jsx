import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import { RequireAdmin, RequireUser } from "./middleware/routeGuards.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import NegotiationPage from "./pages/NegotiationPage.jsx";
import SellPage from "./pages/SellPage.jsx";
import SellerPage from "./pages/SellerPage.jsx";
import ShopPage from "./pages/ShopPage.jsx";
import WishlistPage from "./pages/WishlistPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ShopPage />} />
        <Route path="products" element={<ProductPage />} />
        <Route path="products/:productId" element={<ProductPage />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireUser />}>
          <Route
            path="products/:productId/negotiate"
            element={<NegotiationPage />}
          />
          <Route path="sell" element={<SellPage />} />
          <Route path="seller" element={<SellerPage />} />
        </Route>
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="not-found" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Route>
    </Routes>
  );
}
