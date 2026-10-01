import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ArrowLeft, Calendar } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type ReportType = "outlet" | "item";

type OutletRow = {
  id: number;
  shopName: string;
  amount: number;
  cash: number;
  cheque: number;
  credit: number;
};

type ItemRow = {
  itemId: number;
  itemName: string;
  qty: number;
  price: number;
  totalAmount: number;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLkr(amount: number) {
  return `LKR ${Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ReportsScreen() {
  const { userLocations, loading: authLoading } = useAuth();
  const today = startOfDay(new Date());
  const [reportType, setReportType] = useState<ReportType>("outlet");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [pickerTarget, setPickerTarget] = useState<"from" | "to" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outletRows, setOutletRows] = useState<OutletRow[]>([]);
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);

  const userLocationIds = useMemo(
    () => userLocations.map((loc) => Number(loc.id)),
    [userLocations]
  );

  const fetchReports = useCallback(async () => {
    if (userLocationIds.length === 0) {
      setOutletRows([]);
      setItemRows([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const rangeStart = startOfDay(fromDate).toISOString();
      const rangeEnd = endOfDay(toDate).toISOString();

      const { data, error: fetchError } = await supabase
        .from("transaction_inventory")
        .select(
          `
          id,
          total_price,
          cash,
          cheque,
          credit,
          to_id,
          created_at,
          transaction_items (
            item_id,
            qty,
            discount,
            items ( id, name, price )
          )
        `
        )
        .in("from_id", userLocationIds)
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const rows = data || [];
      const toIds = [...new Set(rows.map((row: any) => Number(row.to_id)).filter(Boolean))];
      const locationNameById = new Map<number, string>();

      if (toIds.length > 0) {
        const { data: locations, error: locError } = await supabase
          .from("locations")
          .select("id, location_name")
          .in("id", toIds);
        if (locError) throw locError;
        for (const loc of locations || []) {
          locationNameById.set(Number(loc.id), loc.location_name);
        }
      }

      const outlets: OutletRow[] = rows.map((row: any) => ({
        id: Number(row.id),
        shopName: locationNameById.get(Number(row.to_id)) || `Shop #${row.to_id}`,
        amount: Number(row.total_price || 0),
        cash: Number(row.cash || 0),
        cheque: Number(row.cheque || 0),
        credit: Number(row.credit || 0),
      }));

      const itemMap = new Map<number, ItemRow>();
      for (const row of rows) {
        for (const ti of (row as any).transaction_items || []) {
          const itemId = Number(ti.item_id);
          const price = Number(ti.items?.price || 0);
          const qty = Number(ti.qty || 0);
          const discount = Number(ti.discount || 0);
          const lineTotal = qty * price - discount;
          const existing = itemMap.get(itemId);
          if (existing) {
            existing.qty += qty;
            existing.totalAmount += lineTotal;
          } else {
            itemMap.set(itemId, {
              itemId,
              itemName: ti.items?.name || `Item #${itemId}`,
              qty,
              price,
              totalAmount: lineTotal,
            });
          }
        }
      }

      setOutletRows(outlets);
      setItemRows(
        Array.from(itemMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName))
      );
    } catch (err: any) {
      console.error("Error loading reports:", err);
      setError(err.message || "Failed to load reports");
      setOutletRows([]);
      setItemRows([]);
    } finally {
      setLoading(false);
    }
  }, [userLocationIds, fromDate, toDate]);

  useEffect(() => {
    if (authLoading) return;
    fetchReports();
  }, [authLoading, fetchReports]);

  const totalSale = useMemo(() => {
    if (reportType === "outlet") {
      return outletRows.reduce((sum, row) => sum + row.amount, 0);
    }
    return itemRows.reduce((sum, row) => sum + row.totalAmount, 0);
  }, [reportType, outletRows, itemRows]);

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setPickerTarget(null);
    }
    if (event.type === "dismissed" || !selected) return;

    const next = startOfDay(selected);
    if (pickerTarget === "from") {
      setFromDate(next);
      if (next > toDate) setToDate(next);
    } else if (pickerTarget === "to") {
      setToDate(next);
      if (next < fromDate) setFromDate(next);
    }

    if (Platform.OS === "ios") {
      // keep modal open until Done
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Reports</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 6, flexDirection: "row" }}>
          {(
            [
              { key: "outlet", label: "Outlet wise" },
              { key: "item", label: "Item wise" },
            ] as const
          ).map((option) => {
            const active = reportType === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setReportType(option.key)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: active ? "#4f46e5" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: active ? "#fff" : "#9ca3af",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} /> : null}
                </View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : "#6b7280" }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            onPress={() => setPickerTarget("from")}
            style={{
              flex: 1,
              backgroundColor: "#fff",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              padding: 12,
            }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "600", marginBottom: 4 }}>From</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Calendar size={16} color="#4f46e5" />
              <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 13 }}>{formatDateLabel(fromDate)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPickerTarget("to")}
            style={{
              flex: 1,
              backgroundColor: "#fff",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              padding: 12,
            }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "600", marginBottom: 4 }}>To</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Calendar size={16} color="#4f46e5" />
              <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 13 }}>{formatDateLabel(toDate)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: "#eef2ff",
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total Sale</Text>
          <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>{formatLkr(totalSale)}</Text>
        </View>

        {error ? (
          <View style={{ backgroundColor: "#fef2f2", borderRadius: 12, padding: 12 }}>
            <Text style={{ color: "#dc2626", fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, marginTop: 12, marginHorizontal: 16, marginBottom: 16 }}>
        {authLoading || loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#4f46e5" />
            <Text style={{ color: "#6b7280", marginTop: 8 }}>Loading report...</Text>
          </View>
        ) : userLocationIds.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#6b7280" }}>No location assigned to this user.</Text>
          </View>
        ) : reportType === "outlet" ? (
          <FlatList
            data={outletRows}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16, flexGrow: 1 }}
            ListEmptyComponent={
              <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 40 }}>No outlet sales in this range.</Text>
            }
            renderItem={({ item }) => (
              <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: "#1f2937", fontWeight: "700" }}>INV-{item.id}</Text>
                  <Text style={{ color: "#111827", fontWeight: "700" }}>{formatLkr(item.amount)}</Text>
                </View>
                <Text style={{ color: "#4b5563", fontSize: 13, marginBottom: 10 }}>{item.shopName}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>Cash {formatLkr(item.cash)}</Text>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>Cheque {formatLkr(item.cheque)}</Text>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>Credit {formatLkr(item.credit)}</Text>
                </View>
              </View>
            )}
          />
        ) : (
          <FlatList
            data={itemRows}
            keyExtractor={(item) => String(item.itemId)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16, flexGrow: 1 }}
            ListEmptyComponent={
              <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 40 }}>No item sales in this range.</Text>
            }
            renderItem={({ item }) => (
              <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 14 }}>
                <Text style={{ color: "#1f2937", fontWeight: "700", marginBottom: 8 }}>{item.itemName}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>Qty {item.qty}</Text>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>Price {formatLkr(item.price)}</Text>
                  <Text style={{ color: "#111827", fontSize: 12, fontWeight: "700" }}>{formatLkr(item.totalAmount)}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {pickerTarget && Platform.OS === "android" ? (
        <DateTimePicker
          value={pickerTarget === "from" ? fromDate : toDate}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      ) : null}

      <Modal visible={pickerTarget !== null && Platform.OS === "ios"} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: "#1f2937" }}>
                Select {pickerTarget === "from" ? "From" : "To"} Date
              </Text>
              <TouchableOpacity onPress={() => setPickerTarget(null)}>
                <Text style={{ color: "#4f46e5", fontWeight: "700" }}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerTarget === "from" ? fromDate : toDate}
              mode="date"
              display="spinner"
              onChange={onDateChange}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
