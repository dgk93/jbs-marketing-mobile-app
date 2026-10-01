import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, Package, X } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const ALL_LOCATIONS_VALUE = "ALL";

type StockItem = { id: number; name: string; price?: number | null };
type LocationOption = { id: number; location_name: string };
type StockRow = {
  id: number;
  item_id: number;
  location_id: number;
  current_qty: number | null;
  yesterday_balance: number | null;
  yesterday_balance_at?: string | null;
  created_at: string;
};
type TransactionRow = {
  id: number;
  from_id: number;
  to_id: number;
  created_at: string;
  transaction_items: { item_id: number; qty: number }[] | null;
  good_return: { item_id: number; qty: number }[] | null;
};

type TableRow = {
  itemId: number;
  itemName: string;
  price: number;
  dayOpeningQty: number;
  orderQty: number;
  saleQty: number;
  goodReturnQty: number;
  currentQty: number;
};

export default function ItemsScreen() {
  const { user, userLocations, loading: authLoading } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [selectedLocation, setSelectedLocation] = useState(ALL_LOCATIONS_VALUE);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userLocationIds = useMemo(
    () => userLocations.map((loc) => Number(loc.id)),
    [userLocations]
  );

  const fetchStocksScreenData = useCallback(async () => {
    if (!user?.user_id || userLocationIds.length === 0) {
      setItems([]);
      setLocations([]);
      setStocks([]);
      setTransactions([]);
      setSelectedLocation(ALL_LOCATIONS_VALUE);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [stocksResult, transactionsResult] = await Promise.all([
        supabase
          .from("stocks")
          .select("id, item_id, location_id, current_qty, yesterday_balance, yesterday_balance_at, created_at")
          .in("location_id", userLocationIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("transaction_inventory")
          .select(`
            id, from_id, to_id, created_at,
            transaction_items (item_id, qty)
          `)
          .or(`from_id.in.(${userLocationIds.join(",")}),to_id.in.(${userLocationIds.join(",")})`)
          .gte("created_at", todayStart)
          .lt("created_at", todayEnd),
      ]);

      if (stocksResult.error) throw stocksResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      const loadedLocations = userLocations.map((loc) => ({
        id: loc.id,
        location_name: loc.location_name,
      }));
      const loadedStocks = (stocksResult.data || []) as StockRow[];
      let loadedTransactions = (transactionsResult.data || []) as TransactionRow[];

      const inventoryIds = loadedTransactions.map((row) => Number(row.id)).filter(Boolean);
      if (inventoryIds.length > 0) {
        const { data: goodReturnRows, error: goodReturnError } = await supabase
          .from("good_return")
          .select("inventry_id, item_id, qty")
          .in("inventry_id", inventoryIds);

        if (goodReturnError) throw goodReturnError;

        const goodReturnsByInventory = new Map<number, { item_id: number; qty: number }[]>();
        for (const row of goodReturnRows || []) {
          const inventoryId = Number(row.inventry_id);
          const existing = goodReturnsByInventory.get(inventoryId) || [];
          existing.push({ item_id: Number(row.item_id), qty: Number(row.qty || 0) });
          goodReturnsByInventory.set(inventoryId, existing);
        }

        loadedTransactions = loadedTransactions.map((transaction) => ({
          ...transaction,
          good_return: goodReturnsByInventory.get(Number(transaction.id)) || [],
        }));
      }

      // Only items that exist in stocks for this user's locations
      const stockItemIds = [...new Set(loadedStocks.map((s) => Number(s.item_id)))];
      let loadedItems: StockItem[] = [];

      if (stockItemIds.length > 0) {
        const itemsResult = await supabase
          .from("items")
          .select("id, name, price")
          .in("id", stockItemIds)
          .order("name", { ascending: true });

        if (itemsResult.error) throw itemsResult.error;
        loadedItems = (itemsResult.data || []) as StockItem[];
      }

      setItems(loadedItems);
      setLocations(loadedLocations);
      setStocks(loadedStocks);
      setTransactions(loadedTransactions);

      const lorryLocation = loadedLocations.find(
        (location) => location.location_name?.trim()?.toLowerCase().includes("lorry")
      );
      const warehouseLocation = loadedLocations.find(
        (location) => location.location_name?.trim()?.toLowerCase() === "warehouse"
      );
      const defaultLocation = lorryLocation || warehouseLocation || loadedLocations[0];

      setSelectedLocation((prev) => {
        if (prev !== ALL_LOCATIONS_VALUE && loadedLocations.some((l) => String(l.id) === prev)) {
          return prev;
        }
        return defaultLocation ? String(defaultLocation.id) : ALL_LOCATIONS_VALUE;
      });
    } catch (err: any) {
      console.error("Error loading stocks screen:", err);
      setError(`Failed to load stocks: ${err.message || "Unknown error"}`);
      setItems([]);
      setLocations([]);
      setStocks([]);
      setTransactions([]);
      setSelectedLocation(ALL_LOCATIONS_VALUE);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.user_id, userLocationIds, userLocations]);

  const updateDayOpeningStocks = useCallback(async () => {
    if (userLocationIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const systemDate = new Date();
      const { data: stocksData, error: stocksError } = await supabase
        .from("stocks")
        .select("*")
        .in("location_id", userLocationIds);

      if (stocksError) throw stocksError;

      for (const stock of stocksData || []) {
        const updatedAtDate = new Date(stock.yesterday_balance_at || 0);
        const previousQty = stock.current_qty;
        const systemDateOnly = new Date(systemDate.getFullYear(), systemDate.getMonth(), systemDate.getDate());
        const updatedAtDateOnly = new Date(
          updatedAtDate.getFullYear(),
          updatedAtDate.getMonth(),
          updatedAtDate.getDate()
        );

        if (systemDateOnly > updatedAtDateOnly) {
          const { error: updateError } = await supabase
            .from("stocks")
            .update({
              yesterday_balance: previousQty,
              yesterday_balance_at: systemDate.toISOString(),
            })
            .eq("id", stock.id);

          if (updateError) {
            console.error(`Failed to update stock ID ${stock.id}:`, updateError);
          }
        }
      }
    } catch (err) {
      console.error("Error updating day opening stocks:", err);
    } finally {
      await fetchStocksScreenData();
    }
  }, [userLocationIds, fetchStocksScreenData]);

  useEffect(() => {
    if (authLoading) return;
    updateDayOpeningStocks();
  }, [authLoading, updateDayOpeningStocks]);

  const latestStocks = useMemo(() => {
    const latest = new Map<string, StockRow>();
    for (const stockRow of stocks) {
      const key = `${stockRow.location_id}:${stockRow.item_id}`;
      const existing = latest.get(key);
      if (!existing) {
        latest.set(key, stockRow);
        continue;
      }
      const existingTime = new Date(existing.created_at).getTime();
      const rowTime = new Date(stockRow.created_at).getTime();
      if (rowTime > existingTime || (rowTime === existingTime && Number(stockRow.id) > Number(existing.id))) {
        latest.set(key, stockRow);
      }
    }
    return Array.from(latest.values());
  }, [stocks]);

  const itemQtyMap = useMemo(() => {
    const qtyMap = new Map<number, number>();
    for (const stockRow of latestStocks) {
      const rowItemId = Number(stockRow.item_id);
      const rowLocationId = Number(stockRow.location_id);
      const rowQty = Number(stockRow.current_qty || 0);
      const shouldInclude =
        selectedLocation === ALL_LOCATIONS_VALUE || Number(selectedLocation) === rowLocationId;
      if (!shouldInclude) continue;
      qtyMap.set(rowItemId, (qtyMap.get(rowItemId) || 0) + rowQty);
    }
    return qtyMap;
  }, [latestStocks, selectedLocation]);

  const dayOpeningQtyMap = useMemo(() => {
    const openingMap = new Map<number, number>();
    for (const stockRow of latestStocks) {
      const rowItemId = Number(stockRow.item_id);
      const rowLocationId = Number(stockRow.location_id);
      const rowYesterdayBalance = Number(stockRow.yesterday_balance || 0);
      const shouldInclude =
        selectedLocation === ALL_LOCATIONS_VALUE || Number(selectedLocation) === rowLocationId;
      if (!shouldInclude) continue;
      openingMap.set(rowItemId, (openingMap.get(rowItemId) || 0) + rowYesterdayBalance);
    }
    return openingMap;
  }, [latestStocks, selectedLocation]);

  const orderQtyMap = useMemo(() => {
    const orderMap = new Map<number, number>();
    for (const transaction of transactions) {
      const toId = Number(transaction.to_id);
      const shouldInclude =
        selectedLocation === ALL_LOCATIONS_VALUE || Number(selectedLocation) === toId;
      if (!shouldInclude) continue;
      for (const item of transaction.transaction_items || []) {
        const itemId = Number(item.item_id);
        orderMap.set(itemId, (orderMap.get(itemId) || 0) + Number(item.qty || 0));
      }
    }
    return orderMap;
  }, [transactions, selectedLocation]);

  const saleQtyMap = useMemo(() => {
    const saleMap = new Map<number, number>();
    for (const transaction of transactions) {
      const fromId = Number(transaction.from_id);
      const shouldInclude =
        selectedLocation === ALL_LOCATIONS_VALUE || Number(selectedLocation) === fromId;
      if (!shouldInclude) continue;
      for (const item of transaction.transaction_items || []) {
        const itemId = Number(item.item_id);
        saleMap.set(itemId, (saleMap.get(itemId) || 0) + Number(item.qty || 0));
      }
    }
    return saleMap;
  }, [transactions, selectedLocation]);

  const goodReturnQtyMap = useMemo(() => {
    const returnMap = new Map<number, number>();
    for (const transaction of transactions) {
      const fromId = Number(transaction.from_id);
      const shouldInclude =
        selectedLocation === ALL_LOCATIONS_VALUE || Number(selectedLocation) === fromId;
      if (!shouldInclude) continue;
      for (const item of transaction.good_return || []) {
        const itemId = Number(item.item_id);
        returnMap.set(itemId, (returnMap.get(itemId) || 0) + Number(item.qty || 0));
      }
    }
    return returnMap;
  }, [transactions, selectedLocation]);

  const tableRows: TableRow[] = useMemo(() => {
    const locationItemIds = new Set(
      latestStocks
        .filter((stockRow) =>
          selectedLocation === ALL_LOCATIONS_VALUE
            ? true
            : Number(stockRow.location_id) === Number(selectedLocation)
        )
        .map((stockRow) => Number(stockRow.item_id))
    );

    return items
      .filter((item) => locationItemIds.has(Number(item.id)))
      .map((item) => ({
        itemId: item.id,
        itemName: item.name,
        price: Number(item.price || 0),
        dayOpeningQty: dayOpeningQtyMap.get(Number(item.id)) || 0,
        orderQty: orderQtyMap.get(Number(item.id)) || 0,
        saleQty: saleQtyMap.get(Number(item.id)) || 0,
        goodReturnQty: goodReturnQtyMap.get(Number(item.id)) || 0,
        currentQty: itemQtyMap.get(Number(item.id)) || 0,
      }));
  }, [items, latestStocks, selectedLocation, itemQtyMap, dayOpeningQtyMap, orderQtyMap, saleQtyMap, goodReturnQtyMap]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tableRows;
    return tableRows.filter(
      (row) =>
        row.itemName?.toLowerCase().includes(term) ||
        String(row.dayOpeningQty).includes(term) ||
        String(row.orderQty).includes(term) ||
        String(row.saleQty).includes(term) ||
        String(row.goodReturnQty).includes(term) ||
        String(row.currentQty).includes(term)
    );
  }, [tableRows, search]);

  const selectedLocationLabel = useMemo(() => {
    if (selectedLocation === ALL_LOCATIONS_VALUE) return "All Locations";
    const match = locations.find((location) => Number(location.id) === Number(selectedLocation));
    return match?.location_name || "Selected Location";
  }, [locations, selectedLocation]);

  const stats = useMemo(
    () => [
      { label: "Total", value: filteredRows.length, color: "#1f2937" },
      { label: "In Stock", value: filteredRows.filter((i) => i.currentQty > 0).length, color: "#059669" },
      { label: "Out of Stock", value: filteredRows.filter((i) => i.currentQty === 0).length, color: "#dc2626" },
    ],
    [filteredRows]
  );

  if (authLoading || loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#4f46e5" size="large" />
        <Text style={{ color: "#6b7280", marginTop: 12 }}>Loading stocks...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Items</Text>
        </View>
        <View style={{ marginTop: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Search size={18} color="rgba(255,255,255,0.6)" style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, paddingVertical: 12, color: "#fff", fontSize: 14 }}
            placeholder="Search items..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: -16, gap: 12 }}>
        {stats.map((s) => (
          <View key={s.label} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 12, alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: s.color }}>{s.value}</Text>
            <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 2, textAlign: "center" }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {error ? (
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: "#fef2f2", borderRadius: 12, padding: 12 }}>
          <Text style={{ color: "#dc2626", fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {!user?.user_id || userLocationIds.length === 0 ? (
        <View style={{ marginHorizontal: 16, marginTop: 24, alignItems: "center" }}>
          <Text style={{ color: "#6b7280", textAlign: "center" }}>No locations assigned to this user.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ marginTop: 16, marginHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                updateDayOpeningStocks();
              }}
              tintColor="#4f46e5"
            />
          }
        >
          {filteredRows.length > 0 ? (
            filteredRows.map((item) => {
              const stockStatus =
                item.currentQty === 0
                  ? { label: "Out of Stock", bg: "#fef2f2", text: "#dc2626" }
                  : item.currentQty <= 10
                    ? { label: "Low Stock", bg: "#fffbeb", text: "#d97706" }
                    : { label: "In Stock", bg: "#ecfdf5", text: "#059669" };

              return (
                <View key={item.itemId} style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                      <Package size={22} color="#4338ca" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 14 }}>{item.itemName}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: stockStatus.bg }}>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: stockStatus.text }}>{stockStatus.label}</Text>
                        </View>
                        <Text style={{ color: "#9ca3af", fontSize: 11 }}>Qty: {item.currentQty}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }}>
                        LKR {item.price.toFixed(2)}
                      </Text>
                      <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>per unit</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 8 }}>
                    {[
                      { label: "Opening", value: item.dayOpeningQty, color: "#1f2937" },
                      { label: "Order", value: item.orderQty, color: "#4f46e5" },
                      { label: "Sale", value: item.saleQty, color: "#dc2626" },
                      { label: "G.Return", value: item.goodReturnQty, color: "#0d9488" },
                      { label: "Current", value: item.currentQty, color: "#059669" },
                    ].map((metric) => (
                      <View key={metric.label} style={{ flexGrow: 1, flexBasis: "18%", minWidth: 56, backgroundColor: "#f8fafc", borderRadius: 12, paddingVertical: 8, alignItems: "center" }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: metric.color }}>{metric.value}</Text>
                        <Text style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{metric.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <Text style={{ color: "#9ca3af" }}>No stock records found</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={locationModalVisible} transparent animationType="fade" onRequestClose={() => setLocationModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setLocationModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", maxHeight: 400 }}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "700", fontSize: 16, color: "#1f2937" }}>Select Location</Text>
                  <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                    <X size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={[{ id: ALL_LOCATIONS_VALUE, location_name: "All Locations" }, ...locations.map((l) => ({ id: String(l.id), location_name: l.location_name }))]}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => {
                    const selected = selectedLocation === String(item.id);
                    return (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedLocation(String(item.id));
                          setLocationModalVisible(false);
                        }}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 16,
                          borderBottomWidth: 1,
                          borderBottomColor: "#f9fafb",
                          backgroundColor: selected ? "#eef2ff" : "#fff",
                        }}
                      >
                        <Text style={{ color: selected ? "#4338ca" : "#1f2937", fontSize: 15, fontWeight: selected ? "600" : "400" }}>
                          {selected ? "✓  " : "    "}
                          {item.location_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
