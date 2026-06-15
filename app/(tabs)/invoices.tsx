import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

const invoices = [
  { id: "INV-001", customer: "Amal Perera", amount: "LKR 4,500", status: "Paid", date: "17 May 2026", items: 3 },
  { id: "INV-002", customer: "Sanduni Silva", amount: "LKR 8,200", status: "Pending", date: "16 May 2026", items: 5 },
  { id: "INV-003", customer: "Kasun Fernando", amount: "LKR 2,750", status: "Paid", date: "15 May 2026", items: 2 },
  { id: "INV-004", customer: "Nimali Dias", amount: "LKR 6,300", status: "Overdue", date: "14 May 2026", items: 4 },
  { id: "INV-005", customer: "Ruwan Jayasena", amount: "LKR 11,000", status: "Paid", date: "13 May 2026", items: 7 },
  { id: "INV-006", customer: "Priya Wickrama", amount: "LKR 3,200", status: "Pending", date: "12 May 2026", items: 2 },
];

const filters = ["All", "Paid", "Pending", "Overdue"];

const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
  Paid:    { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  Pending: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  Overdue: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

export default function InvoicesScreen() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = invoices.filter((inv) => {
    const matchSearch = inv.customer.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter = activeFilter === "All" || inv.status === activeFilter;
    return matchSearch && matchFilter;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Invoices</Text>
          <TouchableOpacity onPress={() => router.push("/tabs/add")} style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>+ New</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", marginRight: 8 }}>🔍</Text>
          <TextInput style={{ flex: 1, paddingVertical: 12, color: "#fff", fontSize: 14 }} placeholder="Search invoices..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
        </View>
      </View>

      <View style={{ marginHorizontal: 16, marginTop: -16, backgroundColor: "#fff", borderRadius: 16, padding: 6, flexDirection: "row" }}>
        {filters.map((f) => (
          <TouchableOpacity key={f} onPress={() => setActiveFilter(f)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: activeFilter === f ? "#4f46e5" : "transparent" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: activeFilter === f ? "#fff" : "#6b7280" }}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ marginTop: 12, marginHorizontal: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
        {filtered.map((inv) => {
          const s = statusStyle[inv.status];
          return (
            <TouchableOpacity key={inv.id} style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                <Text style={{ color: "#4338ca", fontWeight: "700", fontSize: 16 }}>{inv.customer.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 14 }}>{inv.customer}</Text>
                <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{inv.id} · {inv.items} items · {inv.date}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }}>{inv.amount}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: s.bg }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.dot, marginRight: 6 }} />
                  <Text style={{ fontSize: 11, fontWeight: "600", color: s.text }}>{inv.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
