import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { Bell, Banknote, FileText, Package, Users, Plus, UserPlus, Wallet, BarChart3 } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "@/lib/supabase";

const { width } = Dimensions.get("window");

type DashboardStats = {
  totalSales: number;
  invoices: number;
  itemsQty: number;
  customers: number;
};

type TransactionRow = {
  id: number;
  total_price: number | null;
  to_id: number;
  transaction_items: { qty: number | null }[] | null;
};

function formatLkr(amount: number) {
  return `LKR ${amount.toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

export default function HomeScreen() {
  const { user, userLocations, loading: authLoading } = useAuth();
  const [statsData, setStatsData] = useState<DashboardStats>({
    totalSales: 0,
    invoices: 0,
    itemsQty: 0,
    customers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userLocationIds = useMemo(
    () => userLocations.map((loc) => Number(loc.id)),
    [userLocations]
  );

  const fetchDashboardStats = useCallback(async () => {
    if (userLocationIds.length === 0) {
      setStatsData({ totalSales: 0, invoices: 0, itemsQty: 0, customers: 0 });
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      // Today's transactions where from_id = logged-in user's location id(s)
      const { data, error: fetchError } = await supabase
        .from("transaction_inventory")
        .select(
          `
          id,
          total_price,
          to_id,
          transaction_items ( qty )
        `
        )
        .in("from_id", userLocationIds)
        .gte("created_at", todayStart)
        .lt("created_at", todayEnd);

      if (fetchError) throw fetchError;

      const rows = (data || []) as TransactionRow[];
      const customerIds = new Set<number>();
      let totalSales = 0;
      let itemsQty = 0;

      for (const row of rows) {
        totalSales += Number(row.total_price || 0);
        if (row.to_id != null) customerIds.add(Number(row.to_id));
        for (const item of row.transaction_items || []) {
          itemsQty += Number(item.qty || 0);
        }
      }

      setStatsData({
        totalSales,
        invoices: rows.length,
        itemsQty,
        customers: customerIds.size,
      });
    } catch (err: any) {
      console.error("Error loading dashboard stats:", err);
      setError(err.message || "Failed to load stats");
      setStatsData({ totalSales: 0, invoices: 0, itemsQty: 0, customers: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userLocationIds]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    fetchDashboardStats();
  }, [authLoading, fetchDashboardStats]);

  const stats: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: "Total Sales", value: formatLkr(statsData.totalSales), Icon: Banknote },
    { label: "Invoices", value: String(statsData.invoices), Icon: FileText },
    { label: "Items", value: String(statsData.itemsQty), Icon: Package },
    { label: "Customers", value: String(statsData.customers), Icon: Users },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: "#c7d2fe", fontSize: 13 }}>{user ? `${user.name}` : ""}</Text>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 2 }}>JBS Marketing</Text>
          </View>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Bell size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ marginTop: -16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDashboardStats();
            }}
            tintColor="#4f46e5"
          />
        }
      >
        {/* Stats Grid */}
        <View style={{ marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 16 }}>
          {authLoading || loading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color="#4f46e5" />
              <Text style={{ color: "#6b7280", marginTop: 8, fontSize: 13 }}>Loading stats...</Text>
            </View>
          ) : userLocationIds.length === 0 ? (
            <Text style={{ color: "#6b7280", textAlign: "center", paddingVertical: 16 }}>
              No location assigned to this user.
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {stats.map((s) => (
                <View key={s.label} style={{ width: (width - 80) / 2, backgroundColor: "#f8fafc", borderRadius: 16, padding: 16 }}>
                  <s.Icon size={24} color="#4f46e5" style={{ marginBottom: 8 }} />
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>{s.label}</Text>
                  <Text style={{ color: "#111827", fontSize: 18, fontWeight: "700", marginTop: 2 }}>{s.value}</Text>
                </View>
              ))}
            </View>
          )}
          {error ? (
            <Text style={{ color: "#dc2626", fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</Text>
          ) : null}
        </View>

        {/* Quick Actions */}
        <View style={{ marginHorizontal: 16, marginBottom: 32 }}>
          <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>Quick Actions</Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/add")}
                style={{ flex: 1, backgroundColor: "#4f46e5", borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
              >
                <Plus size={22} color="#fff" style={{ marginBottom: 4 }} />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>New Invoice</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/new-customer")}
                style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#f3f4f6" }}
              >
                <UserPlus size={22} color="#374151" style={{ marginBottom: 4 }} />
                <Text style={{ color: "#374151", fontWeight: "600", fontSize: 13 }}>New Customer</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/(tabs)/invoices", params: { tab: "outstandings" } })}
                style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#f3f4f6" }}
              >
                <Wallet size={22} color="#374151" style={{ marginBottom: 4 }} />
                <Text style={{ color: "#374151", fontWeight: "600", fontSize: 13, textAlign: "center" }}>Outstanding Collection</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/reports")}
                style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#f3f4f6" }}
              >
                <BarChart3 size={22} color="#374151" style={{ marginBottom: 4 }} />
                <Text style={{ color: "#374151", fontWeight: "600", fontSize: 13 }}>Reports</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
