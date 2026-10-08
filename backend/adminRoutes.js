const express = require("express");

function createAdminRouter(supabase, requireAdmin) {
  const router = express.Router();
  const localStore = {
    products: [
      {
        id: 1,
        sku: "FW-DEMO-001",
        category: "Apple",
        brand: "Apple",
        model: "iPhone 14",
        seller_name: "Demo Seller",
        seller_phone: "21623191586",
        status: "APPROVED",
        final_price: 2200,
        created_at: "2026-09-01T10:00:00.000Z",
        images: [],
      },
      {
        id: 2,
        sku: "FW-DEMO-002",
        category: "Sneakers",
        brand: "Nike",
        model: "Air Jordan 1",
        seller_name: "Demo Seller",
        seller_phone: "21623191586",
        status: "PENDING",
        final_price: 500,
        created_at: "2026-09-02T10:00:00.000Z",
        images: [],
      },
    ],
    users: [
      {
        phone: "21623191586",
        name: "Demo Client",
        is_active: true,
        created_at: "2026-08-01T10:00:00.000Z",
      },
      {
        phone: "21699123456",
        name: "Suspended User",
        is_active: false,
        created_at: "2026-08-02T10:00:00.000Z",
      },
    ],
    orders: [
      {
        order_id: "ORD-DEMO-001",
        date: "2026-10-01",
        client_name: "Demo Client",
        client_phone: "21623191586",
        total_amount: 2200,
        status: "Livré",
        delivery_status: "Livré",
        fastwo_commission: 220,
        items: [{ sku: "FW-DEMO-001", quantity: 1 }],
      },
    ],
    fees: [
      {
        id: 1,
        name: "Livraison standard",
        amount: 7,
        minimum_order: 0,
        maximum_order: null,
        active: true,
      },
      {
        id: 2,
        name: "Livraison régionale",
        amount: 12,
        minimum_order: 500,
        maximum_order: null,
        active: true,
      },
      {
        id: 3,
        name: "Livraison gratuite",
        amount: 0,
        minimum_order: 0,
        maximum_order: null,
        active: false,
      },
    ],
    settings: {
      id: 1,
      commission_rate: 10,
      product_markup_rate: 0,
      free_shipping_threshold: 0,
      whatsapp_phone: "21623191586",
      updated_at: new Date().toISOString(),
    },
  };

  function localDashboard() {
    const products = localStore.products;
    const orders = localStore.orders;
    return {
      products,
      orders,
      users: localStore.users,
      settings: localStore.settings,
      metrics: {
        products: products.length,
        pending: products.filter((product) => product.status === "PENDING")
          .length,
        approved: products.filter((product) => product.status === "APPROVED")
          .length,
        rejected: products.filter((product) => product.status === "REJECTED")
          .length,
        orders: orders.length,
        revenue: orders.reduce(
          (sum, order) => sum + Number(order.total_amount || 0),
          0,
        ),
        commission: orders.reduce(
          (sum, order) => sum + Number(order.fastwo_commission || 0),
          0,
        ),
        users: localStore.users.length,
        activeUsers: localStore.users.filter((user) => user.is_active !== false)
          .length,
      },
    };
  }

  async function readDashboard() {
    if (!supabase) return localDashboard();
    const [productsResult, ordersResult, usersResult, settingsResult] =
      await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("orders").select("*").order("date", { ascending: false }),
        supabase
          .from("profiles")
          .select("phone,name,is_active,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("admin_settings").select("*").limit(1).maybeSingle(),
      ]);

    if (
      [productsResult, ordersResult, usersResult, settingsResult].some(
        (result) => result.error,
      )
    ) {
      throw new Error("Données d’administration indisponibles");
    }

    const products = productsResult.data || [];
    const orders = ordersResult.data || [];
    const users = usersResult.data || [];
    const totalRevenue = orders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0,
    );
    const commission = orders.reduce(
      (sum, order) => sum + Number(order.fastwo_commission || 0),
      0,
    );

    return {
      products,
      orders,
      users,
      settings: settingsResult.data || {},
      metrics: {
        products: products.length,
        pending: products.filter((product) => product.status === "PENDING")
          .length,
        approved: products.filter((product) => product.status === "APPROVED")
          .length,
        rejected: products.filter((product) => product.status === "REJECTED")
          .length,
        orders: orders.length,
        revenue: totalRevenue,
        commission,
        users: users.length,
        activeUsers: users.filter((user) => user.is_active !== false).length,
      },
    };
  }

  router.get("/dashboard", requireAdmin, async (req, res) => {
    try {
      res.json(await readDashboard());
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message || "Téléchargement impossible" });
    }
  });

  router.get("/products", requireAdmin, async (req, res) => {
    try {
      if (!supabase) {
        const query = String(req.query.search || "").toLowerCase();
        const products = localStore.products.filter((product) => {
          const matchesStatus =
            !req.query.status || product.status === req.query.status;
          const matchesSearch =
            !query ||
            [
              product.sku,
              product.brand,
              product.model,
              product.seller_name,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query),
            );
          return matchesStatus && matchesSearch;
        });
        return res.json({ products });
      }
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (req.query.status) query = query.eq("status", req.query.status);
      if (req.query.search)
        query = query.or(
          `brand.ilike.%${req.query.search}%,model.ilike.%${req.query.search}%,sku.ilike.%${req.query.search}%`,
        );
      const { data, error } = await query;
      if (error) throw error;
      res.json({ products: data || [] });
    } catch (error) {
      res.status(500).json({ error: error.message || "Liste indisponible" });
    }
  });

  router.patch("/products/:id", requireAdmin, async (req, res) => {
    try {
      const allowed = ["status", "seller_name", "seller_phone"];
      const changes = Object.fromEntries(
        Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)),
      );
      if (Object.keys(changes).length === 0) {
        return res.status(400).json({ error: "Aucune modification valide" });
      }
      if (
        changes.status &&
        !["PENDING", "APPROVED", "REJECTED"].includes(changes.status)
      ) {
        return res.status(400).json({ error: "Statut invalide" });
      }
      if (!supabase) {
        const product = localStore.products.find(
          (item) => item.id === Number(req.params.id),
        );
        if (!product)
          return res.status(404).json({ error: "Article introuvable" });
        Object.assign(product, changes);
        return res.json({ product });
      }
      const { data, error } = await supabase
        .from("products")
        .update(changes)
        .eq("id", Number(req.params.id))
        .select()
        .single();
      if (error) throw error;
      res.json({ product: data });
    } catch (error) {
      res
        .status(400)
        .json({ error: error.message || "Modification impossible" });
    }
  });

  router.delete("/products/:id", requireAdmin, async (req, res) => {
    try {
      if (!supabase) {
        const index = localStore.products.findIndex(
          (product) => product.id === Number(req.params.id),
        );
        if (index < 0)
          return res.status(404).json({ error: "Article introuvable" });
        localStore.products.splice(index, 1);
        return res.status(204).send();
      }
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", Number(req.params.id));
      if (error) throw error;
      res.status(204).send();
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message || "Suppression impossible" });
    }
  });

  router.get("/users", requireAdmin, async (req, res) => {
    try {
      if (!supabase) {
        const query = String(req.query.search || "").toLowerCase();
        const users = localStore.users.filter(
          (user) =>
            !query ||
            `${user.name} ${user.phone}`.toLowerCase().includes(query),
        );
        return res.json({ users });
      }
      let query = supabase
        .from("profiles")
        .select("phone,name,is_active,created_at")
        .order("created_at", { ascending: false });
      if (req.query.search)
        query = query.or(
          `phone.ilike.%${req.query.search}%,name.ilike.%${req.query.search}%`,
        );
      const { data, error } = await query;
      if (error) throw error;
      res.json({ users: data || [] });
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message || "Utilisateurs indisponibles" });
    }
  });

  router.patch("/users/:phone/status", requireAdmin, async (req, res) => {
    try {
      const isActive = req.body.isActive !== false;
      if (!supabase) {
        const user = localStore.users.find(
          (item) => item.phone === req.params.phone,
        );
        if (!user)
          return res.status(404).json({ error: "Utilisateur introuvable" });
        user.is_active = isActive;
        return res.json({ user });
      }
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_active: isActive })
        .eq("phone", req.params.phone)
        .select("phone,name,is_active,created_at")
        .single();
      if (error) throw error;
      if (!isActive) {
        await supabase.from("sessions").delete().eq("phone", req.params.phone);
      }
      res.json({ user: data });
    } catch (error) {
      res.status(400).json({
        error: error.message || "Modification de l’utilisateur impossible",
      });
    }
  });

  router.get("/orders", requireAdmin, async (req, res) => {
    try {
      if (!supabase) {
        const query = String(req.query.search || "").toLowerCase();
        const orders = localStore.orders.filter((order) => {
          const matchesSearch =
            !query ||
            [order.order_id, order.client_name, order.client_phone].some(
              (value) =>
                String(value || "")
                  .toLowerCase()
                  .includes(query),
            );
          const matchesStatus =
            !req.query.status || order.status === req.query.status;
          const matchesDelivery =
            !req.query.deliveryStatus ||
            order.delivery_status === req.query.deliveryStatus;
          return matchesSearch && matchesStatus && matchesDelivery;
        });
        return res.json({ orders });
      }
      let query = supabase
        .from("orders")
        .select("*")
        .order("date", { ascending: false });
      if (req.query.status) query = query.eq("status", req.query.status);
      if (req.query.deliveryStatus)
        query = query.eq("delivery_status", req.query.deliveryStatus);
      if (req.query.search)
        query = query.or(
          `order_id.ilike.%${req.query.search}%,client_name.ilike.%${req.query.search}%,client_phone.ilike.%${req.query.search}%`,
        );
      const { data, error } = await query;
      if (error) throw error;
      res.json({ orders: data || [] });
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message || "Commandes indisponibles" });
    }
  });

  router.patch("/orders/:id", requireAdmin, async (req, res) => {
    try {
      const allowed = ["status", "delivery_status"];
      const changes = Object.fromEntries(
        Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)),
      );
      if (Object.keys(changes).length === 0)
        return res.status(400).json({ error: "Aucune modification" });
      if (!supabase) {
        const order = localStore.orders.find(
          (item) => item.order_id === req.params.id,
        );
        if (!order)
          return res.status(404).json({ error: "Commande introuvable" });
        Object.assign(order, changes);
        return res.json({ order });
      }
      const { data, error } = await supabase
        .from("orders")
        .update(changes)
        .eq("order_id", req.params.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ order: data });
    } catch (error) {
      res.status(400).json({
        error: error.message || "Modification de commande impossible",
      });
    }
  });

  router.get("/delivery-fees", requireAdmin, async (req, res) => {
    try {
      if (!supabase) return res.json({ fees: localStore.fees });
      const { data, error } = await supabase
        .from("delivery_fees")
        .select("*")
        .order("name");
      if (error) throw error;
      res.json({ fees: data || [] });
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message || "Frais de livraison indisponibles" });
    }
  });

  router.put("/delivery-fees/:id", requireAdmin, async (req, res) => {
    try {
      const amount = Number(req.body.amount);
      const minimum = Number(req.body.minimum_order || 0);
      const maximum = req.body.maximum_order
        ? Number(req.body.maximum_order)
        : null;
      const active = req.body.active !== false;
      if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        !Number.isFinite(minimum) ||
        minimum < 0 ||
        (maximum !== null && (!Number.isFinite(maximum) || maximum < minimum))
      ) {
        return res.status(400).json({ error: "Données de frais invalides" });
      }
      if (!supabase) {
        const fee = localStore.fees.find(
          (item) => item.id === Number(req.params.id),
        );
        if (!fee) return res.status(404).json({ error: "Règle introuvable" });
        Object.assign(fee, {
          amount,
          minimum_order: minimum,
          maximum_order: maximum,
          active,
        });
        return res.json({ fee });
      }
      const { data, error } = await supabase
        .from("delivery_fees")
        .update({
          amount,
          minimum_order: minimum,
          maximum_order: maximum,
          active,
        })
        .eq("id", Number(req.params.id))
        .select()
        .single();
      if (error) throw error;
      res.json({ fee: data });
    } catch (error) {
      res
        .status(400)
        .json({ error: error.message || "Modification des frais impossible" });
    }
  });

  router.get("/settings", requireAdmin, async (req, res) => {
    try {
      if (!supabase) return res.json({ settings: localStore.settings });
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      res.json({ settings: data || {} });
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message || "Paramètres indisponibles" });
    }
  });

  router.get("/public-settings", async (req, res) => {
    try {
      if (!supabase) {
        return res.json({
          whatsappPhone: localStore.settings.whatsapp_phone,
          freeShippingThreshold: localStore.settings.free_shipping_threshold,
          deliveryFees: localStore.fees.filter((fee) => fee.active),
        });
      }
      const [settingsResult, feesResult] = await Promise.all([
        supabase
          .from("admin_settings")
          .select("whatsapp_phone,free_shipping_threshold")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("delivery_fees")
          .select("id,name,amount,minimum_order,maximum_order,active")
          .eq("active", true),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (feesResult.error) throw feesResult.error;
      res.json({
        whatsappPhone: settingsResult.data?.whatsapp_phone || "21623191586",
        freeShippingThreshold: Number(
          settingsResult.data?.free_shipping_threshold || 0,
        ),
        deliveryFees: feesResult.data || [],
      });
    } catch (error) {
      res.status(500).json({ error: "Paramètres publics indisponibles" });
    }
  });

  router.put("/settings", requireAdmin, async (req, res) => {
    try {
      const commissionRate = Number(req.body.commissionRate);
      const markupRate = Number(req.body.markupRate);
      const freeShippingThreshold = Number(req.body.freeShippingThreshold);
      const whatsappPhone =
        req.body.whatsappPhone === undefined
          ? undefined
          : String(req.body.whatsappPhone).replace(/\D/g, "");
      if (
        ![commissionRate, markupRate, freeShippingThreshold].every(
          Number.isFinite,
        ) ||
        commissionRate < 0 ||
        commissionRate > 100 ||
        markupRate < 0 ||
        markupRate > 100 ||
        freeShippingThreshold < 0 ||
        (whatsappPhone !== undefined && !/^\d{8,15}$/.test(whatsappPhone))
      ) {
        return res
          .status(400)
          .json({ error: "Valeurs de configuration invalides" });
      }
      if (!supabase) {
        localStore.settings = {
          ...localStore.settings,
          commission_rate: commissionRate,
          product_markup_rate: markupRate,
          free_shipping_threshold: freeShippingThreshold,
          ...(whatsappPhone ? { whatsapp_phone: whatsappPhone } : {}),
          updated_at: new Date().toISOString(),
        };
        return res.json({ settings: localStore.settings });
      }
      const current = await supabase
        .from("admin_settings")
        .select("id")
        .limit(1)
        .maybeSingle();
      const values = {
        commission_rate: commissionRate,
        product_markup_rate: markupRate,
        free_shipping_threshold: freeShippingThreshold,
        ...(whatsappPhone ? { whatsapp_phone: whatsappPhone } : {}),
        updated_at: new Date().toISOString(),
      };
      const result = current.data
        ? await supabase
            .from("admin_settings")
            .update(values)
            .eq("id", current.data.id)
            .select()
            .single()
        : await supabase
            .from("admin_settings")
            .insert(values)
            .select()
            .single();
      if (result.error) throw result.error;
      res.json({ settings: result.data });
    } catch (error) {
      res
        .status(400)
        .json({ error: error.message || "Configuration impossible" });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
