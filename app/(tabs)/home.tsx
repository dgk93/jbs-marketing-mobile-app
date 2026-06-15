import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "../../context/AuthContext";

const { width } = Dimensions.get("window");

const stats = [
  { label: "Total Sales", value: "LKR 124,500", icon: "💰", trend: "+12%" },
  { label: "Invoices", value: "38", icon: "🧾", trend: "+5" },
  { label: "Items", value: "124", icon: "📦", trend: "+3" },
  { label: "Customers", value: "56", icon: "👥", trend: "+2" },
];

const recentInvoices = [
  { id: "INV-001", customer: "Amal Perera", amount: "LKR 4,500", status: "Paid", date: "17 May" },
  { id: "INV-002", customer: "Sanduni Silva", amount: "LKR 8,200", status: "Pending", date: "16 May" },
  { id: "INV-003", customer: "Kasun Fernando", amount: "LKR 2,750", status: "Paid", date: "15 May" },
  { id: "INV-004", customer: "Nimali Dias", amount: "LKR 6,300", status: "Overdue", date: "14 May" },
];

const statusColor: Record<string, { bg: string; text: string }> = {
  Paid:    { bg: "#d1fae5", text: "#065f46" },
  Pending: { bg: "#fef3c7", text: "#92400e" },
  Overdue: { bg: "#fee2e2", text: "#991b1b" },
};

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: "#c7d2fe", fontSize: 13 }}>Good morning 👋</Text>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 2 }}>JBS Marketing</Text>
          </View>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: -16 }}>
        {/* Stats Grid */}
        <View style={{ marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {stats.map((s) => (
              <View key={s.label} style={{ width: (width - 80) / 2, backgroundColor: "#f8fafc", borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</Text>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>{s.label}</Text>
                <Text style={{ color: "#111827", fontSize: 18, fontWeight: "700", marginTop: 2 }}>{s.value}</Text>
                <Text style={{ color: "#059669", fontSize: 12, fontWeight: "500", marginTop: 4 }}>{s.trend} this month</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>Quick Actions</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/add")} style={{ flex: 1, backgroundColor: "#4f46e5", borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>➕</Text>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>New Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(tabs)/items")} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#f3f4f6" }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>📦</Text>
              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 13 }}>Add Item</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#f3f4f6" }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>🖨️</Text>
              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 13 }}>Print Bill</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Invoices */}
        <View style={{ marginHorizontal: 16, marginBottom: 32 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 16 }}>Recent Invoices</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/invoices")}>
              <Text style={{ color: "#4f46e5", fontSize: 14, fontWeight: "500" }}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, overflow: "hidden" }}>
            {recentInvoices.map((inv, i) => (
              <TouchableOpacity key={inv.id} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: i < recentInvoices.length - 1 ? 1 : 0, borderBottomColor: "#f9fafb" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ color: "#4f46e5", fontWeight: "700", fontSize: 14 }}>{inv.customer.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 14 }}>{inv.customer}</Text>
                  <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{inv.id} · {inv.date}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 14 }}>{inv.amount}</Text>
                  <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: statusColor[inv.status].bg }}>
                    <Text style={{ color: statusColor[inv.status].text, fontSize: 11, fontWeight: "600" }}>{inv.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
