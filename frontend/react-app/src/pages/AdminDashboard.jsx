import {
  AlertTriangle,
  ArrowDownToLine,
  Ban,
  Check,
  CircleDollarSign,
  Clock3,
  Edit3,
  Filter,
  Package,
  PackageCheck,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../components/ProductCard.jsx";
import { useMarketplace } from "../context/MarketplaceContext.jsx";

const API_BASE =
  import.meta.env.VITE_FASTWO_AUTH_API ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");
const TABS = [
  "Vue d'ensemble",
  "Annonces",
  "Utilisateurs",
  "Commandes",
  "Livraison",
  "Tarification",
];
const STATUS_LABELS = {
  PENDING: "En attente",
  APPROVED: "Publiée",
  REJECTED: "Refusée",
};

function adminRequest(path, options = {}, token) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

function StatCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <article className={`admin-stat-card admin-stat-${tone}`}>
      <span className="admin-stat-icon">
        <Icon size={20} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
  loading,
}) {
  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={onCancel}
    >
      <div
        className="admin-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="admin-modal-icon">
          <AlertTriangle size={24} />
        </span>
        <h2 id="admin-confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="admin-modal-actions">
          <button
            className="button-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            className="button-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Traitement..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const {
    logoutAdmin,
    notify,
    products: marketplaceProducts,
    updateProduct: updateMarketplaceProduct,
    deleteProduct: deleteMarketplaceProduct,
    refreshPlatformSettings,
    t,
  } = useMarketplace();
  const [token] = useState(
    () => localStorage.getItem("fastwo_admin_token") || "",
  );
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fees, setFees] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderStatus, setOrderStatus] = useState("all");
  const [deliveryStatus, setDeliveryStatus] = useState("all");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingFee, setPendingFee] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({
    commissionRate: "",
    markupRate: "",
    freeShippingThreshold: "",
    whatsappPhone: "",
  });

  const request = (path, options) => adminRequest(path, options, token);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [
        dashboardResponse,
        productsResponse,
        usersResponse,
        ordersResponse,
        feesResponse,
        settingsResponse,
      ] = await Promise.all([
        request("/api/admin/dashboard"),
        request("/api/admin/products"),
        request("/api/admin/users"),
        request("/api/admin/orders"),
        request("/api/admin/delivery-fees"),
        request("/api/admin/settings"),
      ]);
      const responses = [
        dashboardResponse,
        productsResponse,
        usersResponse,
        ordersResponse,
        feesResponse,
        settingsResponse,
      ];
      if (responses.some((response) => !response.ok))
        throw new Error(
          "Les données administratives ne peuvent pas être chargées.",
        );
      const [
        dashboardData,
        productsData,
        usersData,
        ordersData,
        feesData,
        settingsData,
      ] = await Promise.all(responses.map((response) => response.json()));
      const serverProducts = productsData.products || [];
      const serverSkus = new Set(serverProducts.map((product) => product.sku));
      const submittedProducts = marketplaceProducts
        .filter((product) => product.createdAt && !serverSkus.has(product.sku))
        .map((product) => ({
          ...product,
          id: `local-${product.id}`,
          local_product_id: product.id,
          local_submission: true,
          seller_name: product.sellerName,
          seller_phone: product.sellerPhone,
          final_price: product.finalPrice,
          created_at: product.createdAt,
        }));
      const allProducts = [...submittedProducts, ...serverProducts];
      setProducts(allProducts);
      setDashboard({
        ...dashboardData,
        metrics: {
          ...dashboardData.metrics,
          products: allProducts.length,
          pending: allProducts.filter((product) => product.status === "PENDING")
            .length,
          approved: allProducts.filter(
            (product) => product.status === "APPROVED",
          ).length,
          rejected: allProducts.filter(
            (product) => product.status === "REJECTED",
          ).length,
        },
      });
      setUsers(usersData.users || []);
      setOrders(ordersData.orders || []);
      setFees(feesData.fees || []);
      setSettings(settingsData.settings || {});
      setSettingsDraft({
        commissionRate: settingsData.settings?.commission_rate ?? "",
        markupRate: settingsData.settings?.product_markup_rate ?? "",
        freeShippingThreshold:
          settingsData.settings?.free_shipping_threshold ?? "",
        whatsappPhone: settingsData.settings?.whatsapp_phone ?? "21623191586",
      });
    } catch (caught) {
      setError(caught.message || "Charge impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = search.toLowerCase();
        const matchesSearch =
          !query ||
          [
            product.sku,
            product.id,
            product.pageNumber,
            product.brand,
            product.model,
            product.seller_name,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(query),
          );
        const matchesStatus =
          statusFilter === "all" || product.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [products, search, statusFilter],
  );

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          !search ||
          `${user.name} ${user.phone}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [users, search],
  );
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const query = search.toLowerCase();
        const matchesSearch =
          !query ||
          [order.order_id, order.client_name, order.client_phone].some(
            (value) =>
              String(value || "")
                .toLowerCase()
                .includes(query),
          );
        const matchesStatus =
          orderStatus === "all" || order.status === orderStatus;
        const matchesDelivery =
          deliveryStatus === "all" || order.delivery_status === deliveryStatus;
        return matchesSearch && matchesStatus && matchesDelivery;
      }),
    [orders, search, orderStatus, deliveryStatus],
  );

  async function apiAction(path, method, body, successMessage) {
    setActionError("");
    try {
      const response = await request(path, {
        method,
        body: JSON.stringify(body || {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Opération impossible");
      notify(successMessage);
      await loadAll();
      return true;
    } catch (caught) {
      setActionError(caught.message || "Opération impossible");
      return false;
    }
  }

  async function updateProductStatus(product, status) {
    if (product.local_submission) {
      updateMarketplaceProduct(product.local_product_id, { status });
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, status } : item,
        ),
      );
      notify(
        status === "APPROVED"
          ? "Annonce publiée"
          : "Statut de l’annonce mis à jour",
      );
      return;
    }
    const success = await apiAction(
      `/api/admin/products/${product.id}`,
      "PATCH",
      { status },
      status === "APPROVED"
        ? "Annonce publiée"
        : "Statut de l’annonce mis à jour",
    );
    if (success) setPendingDelete(null);
  }

  async function deleteProduct() {
    if (!pendingDelete) return;
    if (pendingDelete.local_submission) {
      deleteMarketplaceProduct(pendingDelete.local_product_id);
      setProducts((current) =>
        current.filter((product) => product.id !== pendingDelete.id),
      );
      setPendingDelete(null);
      notify("Annonce supprimée définitivement");
      return;
    }
    const success = await apiAction(
      `/api/admin/products/${pendingDelete.id}`,
      "DELETE",
      {},
      "Annonce supprimée définitivement",
    );
    if (success) setPendingDelete(null);
  }

  async function toggleUser(user) {
    await apiAction(
      `/api/admin/users/${encodeURIComponent(user.phone)}/status`,
      "PATCH",
      { isActive: user.is_active === false },
      user.is_active === false ? "Compte réactivé" : "Compte suspendu",
    );
  }

  async function updateOrder(order, field, value) {
    await apiAction(
      `/api/admin/orders/${order.order_id}`,
      "PATCH",
      { [field]: value },
      "Commande mise à jour",
    );
  }

  async function saveFee(fee) {
    const amount = Number(fee.amount);
    const minimum = Number(fee.minimum_order || 0);
    const maximum = fee.maximum_order ? Number(fee.maximum_order) : null;
    const success = await apiAction(
      `/api/admin/delivery-fees/${fee.id}`,
      "PUT",
      {
        amount,
        minimum_order: minimum,
        maximum_order: maximum,
        active: fee.active,
      },
      "Frais de livraison mis à jour",
    );
    if (success) {
      setPendingFee(null);
      await refreshPlatformSettings();
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSavingSettings(true);
    const success = await apiAction(
      "/api/admin/settings",
      "PUT",
      {
        commissionRate: Number(settingsDraft.commissionRate),
        markupRate: Number(settingsDraft.markupRate),
        freeShippingThreshold: Number(settingsDraft.freeShippingThreshold),
        whatsappPhone: settingsDraft.whatsappPhone,
      },
      "Paramètres de tarification enregistrés",
    );
    setSavingSettings(false);
    if (success)
      setSettings({
        commission_rate: Number(settingsDraft.commissionRate),
        product_markup_rate: Number(settingsDraft.markupRate),
        free_shipping_threshold: Number(settingsDraft.freeShippingThreshold),
        whatsapp_phone: settingsDraft.whatsappPhone.replace(/\D/g, ""),
      });
    if (success) await refreshPlatformSettings();
  }

  function exportCsv() {
    const headers = [
      "Commande",
      "Client",
      "Téléphone",
      "Total",
      "Statut",
      "Livraison",
      "Date",
    ];
    const rows = filteredOrders.map((order) => [
      order.order_id,
      order.client_name,
      order.client_phone,
      order.total_amount,
      order.status,
      order.delivery_status,
      order.date,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = "fastwo-commandes.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (loading)
    return (
      <div className="admin-loading">
        <ShieldCheck size={28} />
        <span>{t("Chargement du contrôle...")}</span>
      </div>
    );
  if (error)
    return (
      <div className="admin-error">
        <AlertTriangle size={26} />
        <h2>{t("Le contrôle est indisponible")}</h2>
        <p>{error}</p>
        <button className="button-primary" onClick={loadAll}>
          {t("Réessayer")}
        </button>
      </div>
    );

  const metrics = dashboard?.metrics || {};
  return (
    <section className="standard-page admin-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">{t("FASTWO / OPÉRATIONS")}</p>
          <h1>
            {t("Tableau de bord")}
            <span className="title-dot">.</span>
          </h1>
          <p className="admin-subtitle">
            {t("Contrôle complet de la marketplace et de ses opérations.")}
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="button-secondary" onClick={loadAll}>
            <Clock3 size={15} /> {t("Actualiser")}
          </button>
          <button
            className="button-secondary"
            onClick={() => {
              logoutAdmin();
              notify(t("Session admin fermée"));
            }}
          >
            <X size={15} /> {t("Quitter")}
          </button>
        </div>
      </div>
      <div className="admin-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => {
              setActiveTab(tab);
              setSearch("");
            }}
          >
            {t(tab)}
          </button>
        ))}
      </div>
      {actionError && (
        <div className="admin-action-error">
          <AlertTriangle size={16} />
          {actionError}
        </div>
      )}

      {activeTab === "Vue d'ensemble" && (
        <>
          <div className="admin-kpis">
            <StatCard
              icon={Package}
              label={t("Annonces")}
              value={metrics.products || 0}
              detail={`${metrics.approved || 0} ${t("publiées")}`}
              tone="wine"
            />
            <StatCard
              icon={Clock3}
              label={t("En attente")}
              value={metrics.pending || 0}
              detail={t("À examiner")}
              tone="gold"
            />
            <StatCard
              icon={CircleDollarSign}
              label={t("Chiffre d'affaires")}
              value={`${formatPrice(metrics.revenue || 0)} TND`}
              detail={`${formatPrice(metrics.commission || 0)} TND ${t("commission")}`}
              tone="sage"
            />
            <StatCard
              icon={Users}
              label={t("Utilisateurs")}
              value={metrics.users || 0}
              detail={`${metrics.activeUsers || 0} ${t("actifs")}`}
              tone="blue"
            />
          </div>
          <div className="admin-overview-grid">
            <article className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <p className="eyebrow">{t("CATALOGUE")}</p>
                  <h2>{t("État des annonces")}</h2>
                </div>
                <PackageCheck size={20} />
              </div>
              <div className="admin-donut">
                <div>
                  <strong>{metrics.products || 0}</strong>
                  <span>{t("Total")}</span>
                </div>
              </div>
              <div className="admin-status-legend">
                <span>
                  <i className="status-dot status-pending" />
                  {metrics.pending || 0} {t("en attente")}
                </span>
                <span>
                  <i className="status-dot status-approved" />
                  {metrics.approved || 0} {t("publiées")}
                </span>
                <span>
                  <i className="status-dot status-rejected" />
                  {metrics.rejected || 0} {t("refusées")}
                </span>
              </div>
            </article>
            <article className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <p className="eyebrow">{t("COMMANDES")}</p>
                  <h2>{t("Activité récente")}</h2>
                </div>
                <ArrowDownToLine size={20} />
              </div>
              <div className="admin-order-list">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.order_id}>
                    <span>
                      <strong>{order.order_id}</strong>
                      <small>{order.client_name}</small>
                    </span>
                    <b>{formatPrice(order.total_amount)} TND</b>
                    <em>{order.status}</em>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </>
      )}

      {activeTab === "Annonces" && (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{t("GESTION DES ANNONCES")}</p>
              <h2>{t("Catalogue complet")}</h2>
            </div>
            <span className="admin-count">
              {filteredProducts.length} {t("résultats")}
            </span>
          </div>
          <div className="admin-filter-bar">
            <label className="admin-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Nom, marque, modèle, SKU ou numéro de page")}
              />
            </label>
            <label>
              <Filter size={14} />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">{t("Tous les statuts")}</option>
                <option value="PENDING">{t("En attente")}</option>
                <option value="APPROVED">{t("Publiées")}</option>
                <option value="REJECTED">{t("Refusées")}</option>
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Annonce</th>
                  <th>Vendeur</th>
                  <th>Prix</th>
                  <th>État</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="table-product">
                        <img src={product.images?.[0]} alt="" />
                        <div>
                          <strong>
                            {product.brand} {product.model}
                          </strong>
                          <small>
                            {product.local_submission ? (
                              <Link
                                to={`/products/${product.pageNumber ?? product.local_product_id}`}
                              >
                                #
                                {product.pageNumber ?? product.local_product_id}
                              </Link>
                            ) : (
                              `#${product.id}`
                            )}{" "}
                            · {product.sku} · {t(product.category)}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {product.seller_name}
                      <small>{product.seller_phone}</small>
                    </td>
                    <td>
                      <strong>{formatPrice(product.final_price)} TND</strong>
                    </td>
                    <td>
                      <span
                        className={`admin-status status-${product.status.toLowerCase()}`}
                      >
                        {t(STATUS_LABELS[product.status] || product.status)}
                      </span>
                    </td>
                    <td>
                      <div className="moderation-actions">
                        {product.status !== "APPROVED" && (
                          <button
                            className="approve-button"
                            onClick={() =>
                              updateProductStatus(product, "APPROVED")
                            }
                          >
                            <Check size={14} /> {t("Publier")}
                          </button>
                        )}
                        {product.status !== "REJECTED" && (
                          <button
                            className="reject-button"
                            onClick={() =>
                              updateProductStatus(product, "REJECTED")
                            }
                          >
                            <X size={14} /> {t("Refuser")}
                          </button>
                        )}
                        <button
                          className="delete-button"
                          onClick={() => setPendingDelete(product)}
                        >
                          <Trash2 size={14} /> {t("Supprimer")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredProducts.length && (
            <p className="admin-empty">{t("Aucune annonce ne correspond.")}</p>
          )}
        </div>
      )}

      {activeTab === "Utilisateurs" && (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{t("GESTION DES COMPTES")}</p>
              <h2>{t("Utilisateurs enregistrés")}</h2>
            </div>
            <span className="admin-count">
              {filteredUsers.length} {t("comptes")}
            </span>
          </div>
          <div className="admin-filter-bar">
            <label className="admin-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Nom ou numéro de téléphone")}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Utilisateur")}</th>
                  <th>{t("Inscrit le")}</th>
                  <th>{t("État")}</th>
                  <th>{t("Action")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.phone}>
                    <td>
                      <div className="user-cell">
                        <UserRound size={18} />
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.phone}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {new Date(user.created_at).toLocaleDateString("fr-TN")}
                    </td>
                    <td>
                      <span
                        className={`admin-status ${user.is_active === false ? "status-rejected" : "status-approved"}`}
                      >
                        {user.is_active === false ? t("Suspendu") : t("Actif")}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`button-secondary ${user.is_active === false ? "approve-button" : "reject-button"}`}
                        onClick={() => toggleUser(user)}
                      >
                        {user.is_active === false ? (
                          <Check size={14} />
                        ) : (
                          <Ban size={14} />
                        )}
                        {user.is_active === false
                          ? t("Réactiver")
                          : t("Suspendre")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Commandes" && (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{t("TRANSACTIONS")}</p>
              <h2>{t("Commandes et paiements")}</h2>
            </div>
            <button className="button-secondary" onClick={exportCsv}>
              <ArrowDownToLine size={15} /> Export CSV
            </button>
          </div>
          <div className="admin-filter-bar">
            <label className="admin-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Commande, client ou téléphone"
              />
            </label>
            <label>
              <select
                value={orderStatus}
                onChange={(event) => setOrderStatus(event.target.value)}
              >
                <option value="all">{t("Toutes les commandes")}</option>
                <option>En attente</option>
                <option>{t("Expédié")}</option>
                <option>{t("Livré")}</option>
              </select>
            </label>
            <label>
              <select
                value={deliveryStatus}
                onChange={(event) => setDeliveryStatus(event.target.value)}
              >
                <option value="all">{t("Toute livraison")}</option>
                <option>{t("À préparer")}</option>
                <option>{t("Pris en charge")}</option>
                <option>{t("En livraison")}</option>
                <option>{t("Livré")}</option>
                <option>{t("Échec")}</option>
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Commande")}</th>
                  <th>{t("Client")}</th>
                  <th>{t("Articles")}</th>
                  <th>{t("Total")}</th>
                  <th>{t("Commission")}</th>
                  <th>{t("Statut")}</th>
                  <th>{t("Livraison")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.order_id}>
                    <td>
                      <strong>{order.order_id}</strong>
                      <small>{order.date}</small>
                    </td>
                    <td>
                      <strong>{order.client_name}</strong>
                      <small>{order.client_phone}</small>
                    </td>
                    <td>
                      {(order.items || []).map((item) => item.sku).join(", ")}
                    </td>
                    <td>
                      <strong>{formatPrice(order.total_amount)} TND</strong>
                    </td>
                    <td>{formatPrice(order.fastwo_commission || 0)} TND</td>
                    <td>
                      <select
                        value={order.status}
                        onChange={(event) =>
                          updateOrder(order, "status", event.target.value)
                        }
                      >
                        <option>En attente</option>
                        <option value="Expédié">{t("Expédié")}</option>
                        <option value="Livré">{t("Livré")}</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={order.delivery_status || "À préparer"}
                        onChange={(event) =>
                          updateOrder(
                            order,
                            "delivery_status",
                            event.target.value,
                          )
                        }
                      >
                        <option value="À préparer">{t("À préparer")}</option>
                        <option value="Pris en charge">
                          {t("Pris en charge")}
                        </option>
                        <option value="En livraison">
                          {t("En livraison")}
                        </option>
                        <option value="Livré">{t("Livré")}</option>
                        <option value="Échec">{t("Échec")}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredOrders.length && (
            <p className="admin-empty">{t("Aucune commande ne correspond.")}</p>
          )}
        </div>
      )}

      {activeTab === "Livraison" && (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{t("FRAIS DE LIVRAISON")}</p>
              <h2>{t("Règles de livraison")}</h2>
            </div>
            <span className="admin-count">
              {fees.length} {t("règles")}
            </span>
          </div>
          <div className="fees-grid">
            {fees.map((fee) => (
              <article className="fee-card" key={fee.id}>
                <div className="fee-card-top">
                  <span
                    className={`fee-active ${fee.active ? "is-active" : ""}`}
                  >
                    {fee.active ? t("Activée") : t("Désactivée")}
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => setPendingFee(fee)}
                    aria-label={`${t("Modifier")} ${fee.name}`}
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
                <h3>{fee.name}</h3>
                <strong>{formatPrice(fee.amount)} TND</strong>
                <p>
                  {t("Commande minimale :")} {formatPrice(fee.minimum_order)}{" "}
                  TND
                  {fee.maximum_order
                    ? ` · ${t("maximale")} ${formatPrice(fee.maximum_order)} TND`
                    : ` · ${t("sans plafond")}`}
                </p>
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={Boolean(fee.active)}
                    onChange={(event) =>
                      setPendingFee({ ...fee, active: event.target.checked })
                    }
                  />{" "}
                  {t("Activée")}
                </label>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Tarification" && (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{t("PRIX & COMMISSION")}</p>
              <h2>{t("Paramètres dynamiques")}</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <form className="settings-form" onSubmit={saveSettings}>
            <div className="setting-field">
              <label>{t("Commission par vente")}</label>
              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settingsDraft.commissionRate}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      commissionRate: event.target.value,
                    })
                  }
                />
                <span>%</span>
              </div>
              <small>
                {t("Pourcentage appliqué à la valeur de chaque commande.")}
              </small>
            </div>
            <div className="setting-field">
              <label>{t("Marge de prix produit")}</label>
              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settingsDraft.markupRate}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      markupRate: event.target.value,
                    })
                  }
                />
                <span>%</span>
              </div>
              <small>{t("Augmentation automatique du prix de vente.")}</small>
            </div>
            <div className="setting-field">
              <label>{t("Seuil de livraison gratuite")}</label>
              <div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settingsDraft.freeShippingThreshold}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      freeShippingThreshold: event.target.value,
                    })
                  }
                />
                <span>TND</span>
              </div>
              <small>
                {t("Commande qui bénéficie de la livraison gratuite.")}
              </small>
            </div>
            <div className="setting-field">
              <label htmlFor="admin-whatsapp-phone">
                {t("Numéro WhatsApp officiel")}
              </label>
              <div>
                <input
                  id="admin-whatsapp-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  pattern="[0-9]{8,15}"
                  placeholder="21623191586"
                  value={settingsDraft.whatsappPhone}
                  required
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      whatsappPhone: event.target.value,
                    })
                  }
                />
              </div>
              <small>
                {t(
                  "Format international, chiffres uniquement. Les liens de contact du site seront actualisés.",
                )}
              </small>
              <small>
                {t(
                  "L’expéditeur des messages automatiques reste le numéro Business configuré dans Meta.",
                )}
              </small>
            </div>
            <button
              className="button-primary"
              type="submit"
              disabled={savingSettings}
            >
              {savingSettings
                ? t("Enregistrement...")
                : t("Enregistrer les paramètres")}
            </button>
          </form>
          <div className="settings-preview">
            <h3>{t("Aperçu de la tarification")}</h3>
            <div>
              <span>{t("Commission")}</span>
              <strong>{settingsDraft.commissionRate || 0}%</strong>
            </div>
            <div>
              <span>{t("Marge produit")}</span>
              <strong>{settingsDraft.markupRate || 0}%</strong>
            </div>
            <div>
              <span>{t("Livraison gratuite à partir de")}</span>
              <strong>
                {formatPrice(settingsDraft.freeShippingThreshold || 0)} TND
              </strong>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={t("Supprimer définitivement cette annonce ?")}
          message={`${t("L’annonce")} ${pendingDelete.brand} ${pendingDelete.model} ${t("sera supprimée définitivement et ne pourra pas être récupérée.")}`}
          confirmLabel={t("Supprimer l’annonce")}
          onCancel={() => setPendingDelete(null)}
          onConfirm={deleteProduct}
          loading={false}
        />
      )}
      {pendingFee && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={() => setPendingFee(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>{t("Modifier les frais de livraison")}</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveFee(pendingFee);
              }}
            >
              <label>
                {t("Montant")}{" "}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pendingFee.amount}
                  onChange={(event) =>
                    setPendingFee({ ...pendingFee, amount: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                {t("Commande minimale")}{" "}
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pendingFee.minimum_order || ""}
                  onChange={(event) =>
                    setPendingFee({
                      ...pendingFee,
                      minimum_order: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                {t("Commande maximale (facultatif)")}{" "}
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pendingFee.maximum_order || ""}
                  onChange={(event) =>
                    setPendingFee({
                      ...pendingFee,
                      maximum_order: event.target.value,
                    })
                  }
                />
              </label>
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={pendingFee.active}
                  onChange={(event) =>
                    setPendingFee({
                      ...pendingFee,
                      active: event.target.checked,
                    })
                  }
                />{" "}
                {t("Règle active")}
              </label>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setPendingFee(null)}
                >
                  {t("Annuler")}
                </button>
                <button className="button-primary" type="submit">
                  {t("Enregistrer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
