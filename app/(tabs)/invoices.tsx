import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Check, Search, X } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type TabKey = "invoices" | "outstandings";

type InvoiceItem = {
  item_id: number;
  name: string;
  qty: number;
  price: number;
  discount: number;
  subtotal: number;
};

type ReturnItem = {
  item_id: number;
  name: string;
  qty: number;
  price: number;
  discount: number;
  subtotal: number;
};

type InvoiceRow = {
  id: number;
  total_price: number;
  cash: number;
  cheque: number;
  credit: number;
  credit_collected_at: string | null;
  created_at: string;
  from_id: number;
  to_id: number;
  customer: string;
  itemsCount: number;
  status: "Paid" | "Pending";
  items: InvoiceItem[];
  goodReturns: ReturnItem[];
  marketReturns: ReturnItem[];
};

type OutstandingGroup = {
  toId: number;
  customer: string;
  totalCredit: number;
  invoiceCount: number;
};

type ShopCreditRow = {
  id: number;
  transactionInventoryId: number;
  shopId: number;
  originalAmount: number;
  remainingAmount: number;
  createdAt: string;
  customer: string;
  totalPrice: number;
};

const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
  Paid: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  Pending: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
};

function formatLkr(amount: number) {
  return `LKR ${Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function invoiceStatus(
  credit: number,
  creditCollectedAt: string | null,
  remainingAmount?: number | null
): "Paid" | "Pending" {
  if (remainingAmount != null) return remainingAmount > 0 ? "Pending" : "Paid";
  return isPendingCredit(credit, creditCollectedAt) ? "Pending" : "Paid";
}

function isPendingCredit(credit: number, creditCollectedAt: string | null): boolean {
  return Number(credit || 0) > 0 && !creditCollectedAt;
}

function toMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export default function InvoicesScreen() {
  const { userLocations, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>(
    params.tab === "outstandings" ? "outstandings" : "invoices"
  );

  useEffect(() => {
    if (params.tab === "outstandings") setActiveTab("outstandings");
    else if (params.tab === "invoices") setActiveTab("invoices");
  }, [params.tab]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [selectedOutstanding, setSelectedOutstanding] = useState<OutstandingGroup | null>(null);
  const [collectingCredits, setCollectingCredits] = useState(false);
  const [shopCredits, setShopCredits] = useState<ShopCreditRow[]>([]);
  const [selectedCreditIds, setSelectedCreditIds] = useState<number[]>([]);
  const [collectAmount, setCollectAmount] = useState("");
  const [confirmCollectVisible, setConfirmCollectVisible] = useState(false);
  const [collectingSubmitting, setCollectingSubmitting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const outstandingScrollRef = useRef<ScrollView>(null);

  const userLocationIds = useMemo(
    () => userLocations.map((loc) => Number(loc.id)),
    [userLocations]
  );

  const fetchInvoices = useCallback(async () => {
    if (userLocationIds.length === 0) {
      setInvoices([]);
      setShopCredits([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("transaction_inventory")
        .select(
          `
          id,
          total_price,
          cash,
          cheque,
          credit,
          credit_collected_at,
          created_at,
          from_id,
          to_id,
          transaction_items (
            item_id,
            qty,
            discount,
            items ( id, name, price )
          )
        `
        )
        .in("from_id", userLocationIds)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const rows = data || [];
      const toIds = [...new Set(rows.map((row: any) => Number(row.to_id)).filter(Boolean))];
      const locationNameById = new Map<number, string>();

      if (toIds.length > 0) {
        const { data: locationRows, error: locationError } = await supabase
          .from("locations")
          .select("id, location_name")
          .in("id", toIds);

        if (locationError) throw locationError;
        for (const loc of locationRows || []) {
          locationNameById.set(Number(loc.id), loc.location_name);
        }
      }

      const inventoryIds = rows.map((row: any) => Number(row.id));

      let goodReturnMap = new Map<number, ReturnItem[]>();
      let marketReturnMap = new Map<number, ReturnItem[]>();

      if (inventoryIds.length > 0) {
        const [goodResult, marketResult] = await Promise.all([
          supabase
            .from("good_return")
            .select("inventry_id, item_id, qty, discount, items ( id, name, price )")
            .in("inventry_id", inventoryIds),
          supabase
            .from("market_return")
            .select("inventry_id, item_id, qty, discount, items ( id, name, price )")
            .in("inventry_id", inventoryIds),
        ]);

        if (goodResult.error) throw goodResult.error;
        if (marketResult.error) throw marketResult.error;

        const mapReturns = (list: any[] | null) => {
          const map = new Map<number, ReturnItem[]>();
          for (const row of list || []) {
            const invId = Number(row.inventry_id);
            const price = Number(row.items?.price || 0);
            const qty = Number(row.qty || 0);
            const discount = Number(row.discount || 0);
            const entry: ReturnItem = {
              item_id: Number(row.item_id),
              name: row.items?.name || `Item #${row.item_id}`,
              qty,
              price,
              discount,
              subtotal: qty * price - discount,
            };
            const existing = map.get(invId) || [];
            existing.push(entry);
            map.set(invId, existing);
          }
          return map;
        };

        goodReturnMap = mapReturns(goodResult.data);
        marketReturnMap = mapReturns(marketResult.data);
      }

      const mapped: InvoiceRow[] = rows.map((row: any) => {
        const items: InvoiceItem[] = (row.transaction_items || []).map((ti: any) => {
          const price = Number(ti.items?.price || 0);
          const qty = Number(ti.qty || 0);
          const discount = Number(ti.discount || 0);
          return {
            item_id: Number(ti.item_id),
            name: ti.items?.name || `Item #${ti.item_id}`,
            qty,
            price,
            discount,
            subtotal: qty * price - discount,
          };
        });

        const toLocationName = locationNameById.get(Number(row.to_id));

        return {
          id: Number(row.id),
          total_price: Number(row.total_price || 0),
          cash: Number(row.cash || 0),
          cheque: Number(row.cheque || 0),
          credit: Number(row.credit || 0),
          credit_collected_at: row.credit_collected_at || null,
          created_at: row.created_at,
          from_id: Number(row.from_id),
          to_id: Number(row.to_id),
          customer: toLocationName || `Shop #${row.to_id}`,
          itemsCount: items.length,
          status: invoiceStatus(row.credit, row.credit_collected_at || null),
          items,
          goodReturns: goodReturnMap.get(Number(row.id)) || [],
          marketReturns: marketReturnMap.get(Number(row.id)) || [],
        };
      });

      let creditRows: any[] = [];
      if (inventoryIds.length > 0) {
        const { data: existingCredits, error: creditFetchError } = await supabase
          .from("shop_credits")
          .select("id, transaction_inventory_id, shop_id, original_amount, remaining_amount, created_at")
          .in("transaction_inventory_id", inventoryIds);

        if (creditFetchError) throw creditFetchError;
        creditRows = existingCredits || [];

        const existingTxnIds = new Set(creditRows.map((row) => Number(row.transaction_inventory_id)));
        const missingCredits = mapped.filter(
          (inv) =>
            Number(inv.credit) > 0 &&
            !inv.credit_collected_at &&
            !existingTxnIds.has(inv.id)
        );

        if (missingCredits.length > 0) {
          const { error: backfillError } = await supabase.from("shop_credits").insert(
            missingCredits.map((inv) => ({
              transaction_inventory_id: inv.id,
              shop_id: inv.to_id,
              original_amount: inv.credit,
              remaining_amount: inv.credit,
            }))
          );
          if (backfillError) throw backfillError;

          const { data: refreshedCredits, error: refreshError } = await supabase
            .from("shop_credits")
            .select("id, transaction_inventory_id, shop_id, original_amount, remaining_amount, created_at")
            .in("transaction_inventory_id", inventoryIds);
          if (refreshError) throw refreshError;
          creditRows = refreshedCredits || [];
        }
      }

      const invoiceById = new Map(mapped.map((inv) => [inv.id, inv]));
      const remainingByInvoiceId = new Map<number, number>();
      const mappedCredits: ShopCreditRow[] = [];

      for (const row of creditRows) {
        const invoice = invoiceById.get(Number(row.transaction_inventory_id));
        if (!invoice) continue;
        const remainingAmount = toMoney(Number(row.remaining_amount || 0));
        remainingByInvoiceId.set(invoice.id, remainingAmount);
        if (remainingAmount <= 0) continue;
        mappedCredits.push({
          id: Number(row.id),
          transactionInventoryId: invoice.id,
          shopId: Number(row.shop_id || invoice.to_id),
          originalAmount: toMoney(Number(row.original_amount || invoice.credit)),
          remainingAmount,
          createdAt: row.created_at || invoice.created_at,
          customer: invoice.customer,
          totalPrice: invoice.total_price,
        });
      }

      setInvoices(
        mapped.map((inv) => ({
          ...inv,
          status: invoiceStatus(inv.credit, inv.credit_collected_at, remainingByInvoiceId.get(inv.id)),
        }))
      );
      setShopCredits(mappedCredits);
    } catch (err: any) {
      console.error("Error loading invoices:", err);
      setError(err.message || "Failed to load invoices");
      setInvoices([]);
      setShopCredits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userLocationIds]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    fetchInvoices();
  }, [authLoading, fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter(
      (inv) =>
        inv.customer.toLowerCase().includes(term) ||
        String(inv.id).includes(term) ||
        `inv-${inv.id}`.includes(term)
    );
  }, [invoices, search]);

  const outstandingGroups = useMemo(() => {
    const map = new Map<number, OutstandingGroup>();
    for (const credit of shopCredits) {
      const existing = map.get(credit.shopId);
      if (existing) {
        existing.totalCredit = toMoney(existing.totalCredit + credit.remainingAmount);
        existing.invoiceCount += 1;
      } else {
        map.set(credit.shopId, {
          toId: credit.shopId,
          customer: credit.customer,
          totalCredit: credit.remainingAmount,
          invoiceCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalCredit - a.totalCredit);
  }, [shopCredits]);

  const filteredOutstandings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return outstandingGroups;
    return outstandingGroups.filter(
      (row) => row.customer.toLowerCase().includes(term) || String(row.toId).includes(term)
    );
  }, [outstandingGroups, search]);

  const outstandingDetailCredits = useMemo(() => {
    if (!selectedOutstanding) return [];
    return shopCredits
      .filter((credit) => credit.shopId === selectedOutstanding.toId && credit.remainingAmount > 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [shopCredits, selectedOutstanding]);

  const outstandingDetailTotal = useMemo(
    () => outstandingDetailCredits.reduce((sum, credit) => toMoney(sum + credit.remainingAmount), 0),
    [outstandingDetailCredits]
  );

  const selectedCredits = useMemo(
    () => outstandingDetailCredits.filter((credit) => selectedCreditIds.includes(credit.id)),
    [outstandingDetailCredits, selectedCreditIds]
  );

  const selectedCreditTotal = useMemo(
    () => selectedCredits.reduce((sum, credit) => toMoney(sum + credit.remainingAmount), 0),
    [selectedCredits]
  );

  const parsedCollectAmount = toMoney(parseFloat(collectAmount) || 0);
  const remainingAfterCollect = toMoney(Math.max(selectedCreditTotal - parsedCollectAmount, 0));

  const resetCollectState = () => {
    setCollectingCredits(false);
    setSelectedCreditIds([]);
    setCollectAmount("");
    setConfirmCollectVisible(false);
    setCollectingSubmitting(false);
    setCollectError(null);
  };

  const closeOutstandingModal = () => {
    resetCollectState();
    setSelectedOutstanding(null);
  };

  const invoiceById = useMemo(() => new Map(invoices.map((inv) => [inv.id, inv])), [invoices]);

  useEffect(() => {
    if (!collectingCredits) return;
    setCollectAmount(selectedCreditTotal > 0 ? selectedCreditTotal.toFixed(2) : "");
  }, [collectingCredits, selectedCreditTotal]);

  useEffect(() => {
    if (!selectedOutstanding) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [selectedOutstanding]);

  const scrollPaymentFieldIntoView = () => {
    requestAnimationFrame(() => {
      outstandingScrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const toggleCreditSelection = (id: number) => {
    setSelectedCreditIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleCollectCreditsPress = () => {
    if (!collectingCredits) {
      setCollectingCredits(true);
      setSelectedCreditIds([]);
      setCollectAmount("");
      setCollectError(null);
      return;
    }
    if (selectedCredits.length === 0) {
      setCollectError("Select at least one outstanding credit.");
      return;
    }
    if (parsedCollectAmount <= 0) {
      setCollectError("Enter a payment amount greater than 0.");
      return;
    }
    if (parsedCollectAmount > selectedCreditTotal + 0.005) {
      setCollectError(`Amount cannot exceed ${formatLkr(selectedCreditTotal)}.`);
      return;
    }
    setCollectError(null);
    setConfirmCollectVisible(true);
  };

  const confirmCollectCredits = async () => {
    if (selectedCredits.length === 0) {
      setCollectError("Select at least one outstanding credit.");
      return;
    }
    if (parsedCollectAmount <= 0) {
      setCollectError("Enter a payment amount greater than 0.");
      return;
    }
    if (parsedCollectAmount > selectedCreditTotal + 0.005) {
      setCollectError(`Amount cannot exceed ${formatLkr(selectedCreditTotal)}.`);
      return;
    }

    try {
      setCollectingSubmitting(true);
      setCollectError(null);

      const collectedAt = new Date().toISOString();
      const { data: latestRows, error: latestError } = await supabase
        .from("shop_credits")
        .select("id, transaction_inventory_id, remaining_amount")
        .in(
          "id",
          selectedCredits.map((credit) => credit.id)
        );

      if (latestError) throw latestError;

      const latestById = new Map(
        (latestRows || []).map((row) => [
          Number(row.id),
          {
            remainingAmount: toMoney(Number(row.remaining_amount || 0)),
            transactionInventoryId: Number(row.transaction_inventory_id),
          },
        ])
      );

      const applyOrder = [...selectedCredits].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      let leftover = parsedCollectAmount;

      for (const credit of applyOrder) {
        if (leftover <= 0) break;
        const latest = latestById.get(credit.id);
        if (!latest || latest.remainingAmount <= 0) {
          throw new Error(`INV-${credit.transactionInventoryId} was already updated. Refresh and try again.`);
        }

        const applyAmount = toMoney(Math.min(latest.remainingAmount, leftover));
        const nextRemaining = toMoney(latest.remainingAmount - applyAmount);

        const { data: updatedCredit, error: updateError } = await supabase
          .from("shop_credits")
          .update({ remaining_amount: nextRemaining })
          .eq("id", credit.id)
          .eq("remaining_amount", latest.remainingAmount.toFixed(2))
          .select("id, remaining_amount")
          .maybeSingle();

        if (updateError) throw updateError;
        if (!updatedCredit?.id) {
          throw new Error(`INV-${credit.transactionInventoryId} was not updated. Refresh and try again.`);
        }

        const { error: paymentError } = await supabase.from("shop_credit_payments").insert({
          shop_credit_id: credit.id,
          amount: applyAmount,
          paid_at: collectedAt,
        });
        if (paymentError) throw paymentError;

        if (nextRemaining <= 0) {
          const { error: invoiceUpdateError } = await supabase
            .from("transaction_inventory")
            .update({ credit_collected_at: collectedAt })
            .eq("id", latest.transactionInventoryId);
          if (invoiceUpdateError) throw invoiceUpdateError;
        }

        leftover = toMoney(leftover - applyAmount);
      }

      resetCollectState();
      await fetchInvoices();
    } catch (err: any) {
      console.error("Error collecting credits:", err);
      const message = err.message || "Failed to collect credits";
      setCollectError(message);
      setCollectingSubmitting(false);
      Alert.alert("Collect Credits", message);
    }
  };

  useEffect(() => {
    if (!selectedOutstanding) return;
    const next = outstandingGroups.find((row) => row.toId === selectedOutstanding.toId);
    if (!next) {
      closeOutstandingModal();
      return;
    }
    if (
      next.totalCredit !== selectedOutstanding.totalCredit ||
      next.invoiceCount !== selectedOutstanding.invoiceCount
    ) {
      setSelectedOutstanding(next);
    }
  }, [outstandingGroups, selectedOutstanding]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices();
  };

  const selectedItemsTotal = selectedInvoice
    ? selectedInvoice.items.reduce((sum, item) => sum + item.subtotal, 0)
    : 0;
  const selectedGoodReturnTotal = selectedInvoice
    ? selectedInvoice.goodReturns.reduce((sum, item) => sum + item.subtotal, 0)
    : 0;
  const selectedMarketReturnTotal = selectedInvoice
    ? selectedInvoice.marketReturns.reduce((sum, item) => sum + item.subtotal, 0)
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Invoices</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/add")}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>+ New</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Search size={18} color="rgba(255,255,255,0.6)" style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, paddingVertical: 12, color: "#fff", fontSize: 14 }}
            placeholder={activeTab === "invoices" ? "Search invoices..." : "Search outstandings..."}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={{ marginHorizontal: 16, marginTop: -16, backgroundColor: "#fff", borderRadius: 16, padding: 6, flexDirection: "row" }}>
        {(
          [
            { key: "invoices", label: "Invoices" },
            { key: "outstandings", label: "Outstandings" },
          ] as const
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: activeTab === tab.key ? "#4f46e5" : "transparent",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: activeTab === tab.key ? "#fff" : "#6b7280" }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: "#fef2f2", borderRadius: 12, padding: 12 }}>
          <Text style={{ color: "#dc2626", fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {authLoading || loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#4f46e5" size="large" />
          <Text style={{ color: "#6b7280", marginTop: 12 }}>Loading...</Text>
        </View>
      ) : userLocationIds.length === 0 ? (
        <View style={{ marginTop: 40, alignItems: "center", paddingHorizontal: 24 }}>
          <Text style={{ color: "#6b7280", textAlign: "center" }}>No location assigned to this user.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ marginTop: 12, marginHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />}
        >
          {activeTab === "invoices" ? (
            filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => {
                const s = statusStyle[inv.status];
                return (
                  <TouchableOpacity
                    key={inv.id}
                    onPress={() => setSelectedInvoice(inv)}
                    style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center" }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                      <Text style={{ color: "#4338ca", fontWeight: "700", fontSize: 16 }}>{inv.customer.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 14 }}>{inv.customer}</Text>
                      <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                        INV-{inv.id} · {inv.itemsCount} items · {formatDate(inv.created_at)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }}>{formatLkr(inv.total_price)}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: s.bg }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.dot, marginRight: 6 }} />
                        <Text style={{ fontSize: 11, fontWeight: "600", color: s.text }}>{inv.status}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 32 }}>No invoices found.</Text>
            )
          ) : filteredOutstandings.length > 0 ? (
            filteredOutstandings.map((row) => (
              <TouchableOpacity
                key={row.toId}
                onPress={() => {
                  resetCollectState();
                  setSelectedOutstanding(row);
                }}
                style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center" }}
              >
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                  <Text style={{ color: "#92400e", fontWeight: "700", fontSize: 16 }}>{row.customer.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 14 }}>{row.customer}</Text>
                  <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                    {row.invoiceCount} credit invoice{row.invoiceCount === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }}>{formatLkr(row.totalCredit)}</Text>
                  <View style={{ marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "#fee2e2" }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#991b1b" }}>Credit</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 32 }}>No outstandings found.</Text>
          )}
        </ScrollView>
      )}

      {/* Invoice details modal (same layout as Add Invoice preview) */}
      <Modal visible={!!selectedInvoice} transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontWeight: "700", fontSize: 18, color: "#1f2937" }}>Invoice Details</Text>
                {selectedInvoice ? (
                  <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                    INV-{selectedInvoice.id} · {selectedInvoice.customer} · {formatDate(selectedInvoice.created_at)}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setSelectedInvoice(null)}>
                <X size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {selectedInvoice ? (
              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
                <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 8 }}>Added Items</Text>
                <View style={{ backgroundColor: "#f9fafb", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
                  {selectedInvoice.items.map((item, index) => (
                    <View
                      key={`${item.item_id}-${index}`}
                      style={{
                        padding: 14,
                        borderBottomWidth: index < selectedInvoice.items.length - 1 ? 1 : 0,
                        borderBottomColor: "#e5e7eb",
                      }}
                    >
                      <Text style={{ fontWeight: "600", color: "#1f2937" }}>{item.name}</Text>
                      <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        Qty: {item.qty} · Price: {formatLkr(item.price)} · Discount: {formatLkr(item.discount)}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                        Subtotal: {formatLkr(item.subtotal)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                  <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>{formatLkr(selectedItemsTotal)}</Text>
                </View>

                <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 8 }}>Good Return</Text>
                {selectedInvoice.goodReturns.length > 0 ? (
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ backgroundColor: "#f9fafb", borderRadius: 16, overflow: "hidden" }}>
                      {selectedInvoice.goodReturns.map((item, index) => (
                        <View
                          key={`g-${item.item_id}-${index}`}
                          style={{
                            padding: 14,
                            borderBottomWidth: index < selectedInvoice.goodReturns.length - 1 ? 1 : 0,
                            borderBottomColor: "#e5e7eb",
                          }}
                        >
                          <Text style={{ fontWeight: "600", color: "#1f2937" }}>{item.name}</Text>
                          <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                            Qty: {item.qty} · Price: {formatLkr(item.price)}
                            {item.discount > 0 ? ` · Discount: ${formatLkr(item.discount)}` : ""}
                          </Text>
                          <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                            Subtotal: {formatLkr(item.subtotal)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                      <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>{formatLkr(selectedGoodReturnTotal)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>No good return items</Text>
                )}

                <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 8 }}>Market Return</Text>
                {selectedInvoice.marketReturns.length > 0 ? (
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ backgroundColor: "#f9fafb", borderRadius: 16, overflow: "hidden" }}>
                      {selectedInvoice.marketReturns.map((item, index) => (
                        <View
                          key={`m-${item.item_id}-${index}`}
                          style={{
                            padding: 14,
                            borderBottomWidth: index < selectedInvoice.marketReturns.length - 1 ? 1 : 0,
                            borderBottomColor: "#e5e7eb",
                          }}
                        >
                          <Text style={{ fontWeight: "600", color: "#1f2937" }}>{item.name}</Text>
                          <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                            Qty: {item.qty} · Price: {formatLkr(item.price)}
                            {item.discount > 0 ? ` · Discount: ${formatLkr(item.discount)}` : ""}
                          </Text>
                          <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                            Subtotal: {formatLkr(item.subtotal)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                      <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>{formatLkr(selectedMarketReturnTotal)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>No market return items</Text>
                )}

                <View style={{ gap: 10, marginBottom: 16 }}>
                  <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#3730a3", fontWeight: "600" }}>Net Total</Text>
                    <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>{formatLkr(selectedInvoice.total_price)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#4b5563", fontSize: 14 }}>Cash Amount</Text>
                    <Text style={{ color: "#1f2937", fontWeight: "600" }}>{formatLkr(selectedInvoice.cash)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#4b5563", fontSize: 14 }}>Cheque Amount</Text>
                    <Text style={{ color: "#1f2937", fontWeight: "600" }}>{formatLkr(selectedInvoice.cheque)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#4b5563", fontSize: 14 }}>Credit Amount</Text>
                    <Text style={{ color: "#1f2937", fontWeight: "600" }}>{formatLkr(selectedInvoice.credit)}</Text>
                  </View>
                </View>

              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Outstanding customer credit list */}
      <Modal visible={!!selectedOutstanding} transparent animationType="slide" onRequestClose={closeOutstandingModal}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight:
                keyboardInset > 0
                  ? Dimensions.get("window").height - keyboardInset - (Platform.OS === "android" ? 8 : 0)
                  : "85%",
              marginBottom: Platform.OS === "android" ? keyboardInset : 0,
            }}
          >
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontWeight: "700", fontSize: 18, color: "#1f2937" }}>Outstanding Credits</Text>
                {selectedOutstanding ? (
                  <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                    {selectedOutstanding.customer} · Total {formatLkr(outstandingDetailTotal)}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={closeOutstandingModal}>
                <X size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={outstandingScrollRef}
              contentContainerStyle={{ padding: 16, paddingBottom: 16, gap: 12 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {outstandingDetailCredits.map((credit) => {
                const selected = selectedCreditIds.includes(credit.id);
                const invoice = invoiceById.get(credit.transactionInventoryId);
                return (
                  <TouchableOpacity
                    key={credit.id}
                    onPress={() => {
                      if (collectingCredits) {
                        toggleCreditSelection(credit.id);
                        return;
                      }
                      if (!invoice) return;
                      closeOutstandingModal();
                      setSelectedInvoice(invoice);
                    }}
                    style={{
                      backgroundColor: "#f9fafb",
                      borderRadius: 16,
                      padding: 14,
                      borderWidth: collectingCredits && selected ? 2 : 0,
                      borderColor: "#4f46e5",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {collectingCredits ? (
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: selected ? "#4f46e5" : "#d1d5db",
                            backgroundColor: selected ? "#4f46e5" : "#fff",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                          }}
                        >
                          {selected ? <Check size={14} color="#fff" /> : null}
                        </View>
                      ) : null}
                      <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 14 }}>
                            INV-{credit.transactionInventoryId}
                          </Text>
                          <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{formatDate(credit.createdAt)}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ color: "#991b1b", fontWeight: "700", fontSize: 14 }}>
                            {formatLkr(credit.remainingAmount)}
                          </Text>
                          <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                            {credit.remainingAmount < credit.originalAmount
                              ? `of ${formatLkr(credit.originalAmount)}`
                              : `Net ${formatLkr(credit.totalPrice)}`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {outstandingDetailCredits.length === 0 ? (
                <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 16 }}>No credit invoices for this location.</Text>
              ) : null}

              {collectingCredits && outstandingDetailCredits.length > 0 ? (
                <View>
                  <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
                    Payment amount
                  </Text>
                  <TextInput
                    value={collectAmount}
                    onChangeText={setCollectAmount}
                    onFocus={scrollPaymentFieldIntoView}
                    keyboardType="decimal-pad"
                    placeholder={selectedCreditTotal > 0 ? selectedCreditTotal.toFixed(2) : "0.00"}
                    placeholderTextColor="#9ca3af"
                    style={{
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 16,
                      color: "#111827",
                      backgroundColor: "#f9fafb",
                    }}
                  />
                  <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
                    Selected remaining {formatLkr(selectedCreditTotal)}
                    {parsedCollectAmount > 0 && parsedCollectAmount <= selectedCreditTotal
                      ? ` · After pay ${formatLkr(remainingAfterCollect)}`
                      : ""}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {outstandingDetailCredits.length > 0 ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4, gap: 10 }}>
                {collectError ? (
                  <Text style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>{collectError}</Text>
                ) : null}
                <TouchableOpacity
                  onPress={handleCollectCreditsPress}
                  disabled={collectingCredits && selectedCreditIds.length === 0}
                  style={{
                    backgroundColor: collectingCredits && selectedCreditIds.length === 0 ? "#a5b4fc" : "#4f46e5",
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                    {collectingCredits ? "Pay Selected Amount" : "Collect Credits"}
                  </Text>
                  {collectingCredits ? (
                    <Text style={{ color: "#e0e7ff", fontWeight: "600", fontSize: 13, marginTop: 4 }}>
                      {formatLkr(parsedCollectAmount || selectedCreditTotal)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
                {collectingCredits ? (
                  <TouchableOpacity onPress={resetCollectState} style={{ paddingVertical: 8, alignItems: "center" }}>
                    <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 13 }}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {confirmCollectVisible ? (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  justifyContent: "center",
                  paddingHorizontal: 24,
                  zIndex: 20,
                  elevation: 20,
                }}
                pointerEvents="auto"
              >
                <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20 }}>
                  <Text style={{ fontWeight: "700", fontSize: 17, color: "#1f2937", marginBottom: 8 }}>
                    Confirm Collection
                  </Text>
                  <Text style={{ color: "#4b5563", fontSize: 14, lineHeight: 20 }}>
                    Pay {formatLkr(parsedCollectAmount)} towards {selectedCredits.length} credit
                    {selectedCredits.length === 1 ? "" : "s"}
                    {selectedOutstanding ? ` for ${selectedOutstanding.customer}` : ""}?
                    {remainingAfterCollect > 0
                      ? ` Remaining will be ${formatLkr(remainingAfterCollect)}.`
                      : " Selected credits will be cleared."}
                    {selectedCredits.length > 1
                      ? " Amount is applied to the oldest selected credit first."
                      : ""}
                  </Text>
                  {collectError ? (
                    <Text style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{collectError}</Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                    <TouchableOpacity
                      onPress={() => setConfirmCollectVisible(false)}
                      disabled={collectingSubmitting}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: "#f3f4f6",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#374151", fontWeight: "600" }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={confirmCollectCredits}
                      disabled={collectingSubmitting}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: "#4f46e5",
                        alignItems: "center",
                      }}
                    >
                      {collectingSubmitting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: "#fff", fontWeight: "600" }}>Confirm</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
