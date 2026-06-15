import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

const items = [
  { id: "1", name: "A4 Paper Ream", code: "SKU-001", price: "LKR 1,200", stock: 45, category: "Stationery" },
  { id: "2", name: "Ballpoint Pen (Box)", code: "SKU-002", price: "LKR 350", stock: 120, category: "Stationery" },
  { id: "3", name: "Printer Ink Cartridge", code: "SKU-003", price: "LKR 2,800", stock: 18, category: "Electronics" },
  { id: "4", name: "Sticky Notes Pack", code: "SKU-004", price: "LKR 480", stock: 72, category: "Stationery" },
  { id: "5", name: "Thermal Paper Roll", code: "SKU-005", price: "LKR 650", stock: 34, category: "Printing" },
  { id: "6", name: "File Folder (10 pcs)", code: "SKU-006", price: "LKR 290", stock: 5, category: "Stationery" },
  { id: "7", name: "Stapler", code: "SKU-007", price: "LKR 890", stock: 0, category: "Stationery" },
];

export default function ItemsScreen() {
  const [search, setSearch] = useState("");
  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Items</Text>
          <TouchableOpacity onPress={() => router.push("/tabs/add")} style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>+ Add Item</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", marginRight: 8 }}>🔍</Text>
          <TextInput style={{ flex: 1, paddingVertical: 12, color: "#fff", fontSize: 14 }} placeholder="Search items..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
        </View>
      </View>

      <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: -16, gap: 12 }}>
        {[{ label: "Total", value: items.length, color: "#1f2937" }, { label: "In Stock", value: items.filter(i => i.stock > 0).length, color: "#059669" }, { label: "Out of Stock", value: items.filter(i => i.stock === 0).length, color: "#dc2626" }].map((s) => (
          <View key={s.label} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 12, alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: s.color }}>{s.value}</Text>
            <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 2, textAlign: "center" }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={{ marginTop: 16, marginHorizontal: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
        {filtered.map((item) => {
          const stockStatus = item.stock === 0 ? { label: "Out of Stock", bg: "#fef2f2", text: "#dc2626" } : item.stock <= 10 ? { label: "Low Stock", bg: "#fffbeb", text: "#d97706" } : { label: "In Stock", bg: "#ecfdf5", text: "#059669" };
          return (
            <TouchableOpacity key={item.id} style={{ backgroundColor: "#fff", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                <Text style={{ fontSize: 22 }}>📦</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 14 }}>{item.name}</Text>
                <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{item.code} · {item.category}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: stockStatus.bg }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: stockStatus.text }}>{stockStatus.label}</Text>
                  </View>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>Qty: {item.stock}</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: "#111827", fontWeight: "700", fontSize: 14 }}>{item.price}</Text>
                <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>per unit</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
