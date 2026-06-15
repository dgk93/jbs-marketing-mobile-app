import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LineItem = { id: string; name: string; qty: string; price: string };

export default function AddScreen() {
  const [activeTab, setActiveTab] = useState<"invoice" | "item">("invoice");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ id: "1", name: "", qty: "1", price: "" }]);
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemStock, setItemStock] = useState("");
  const [itemCategory, setItemCategory] = useState("");

  const addLineItem = () => setLineItems((p) => [...p, { id: Date.now().toString(), name: "", qty: "1", price: "" }]);
  const removeLineItem = (id: string) => { if (lineItems.length > 1) setLineItems((p) => p.filter((i) => i.id !== id)); };
  const updateLineItem = (id: string, field: keyof LineItem, value: string) => setLineItems((p) => p.map((i) => i.id === id ? { ...i, [field]: value } : i));
  const total = lineItems.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 }}>Add New</Text>
        <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 4, flexDirection: "row" }}>
          {(["invoice", "item"] as const).map((tab) => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={{ flex: 1, paddingVertical: 10, borderRadius: 16, alignItems: "center", backgroundColor: activeTab === tab ? "#fff" : "transparent" }}>
              <Text style={{ fontWeight: "600", fontSize: 13, color: activeTab === tab ? "#4338ca" : "rgba(255,255,255,0.7)" }}>{tab === "invoice" ? "🧾 Invoice" : "📦 Item"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, marginTop: -16 }}>
        <ScrollView style={{ backgroundColor: "#f8fafc", borderTopLeftRadius: 28, borderTopRightRadius: 28 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {activeTab === "invoice" ? (
            <>
              <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 18, marginBottom: 16 }}>Invoice Details</Text>
              <Field label="Select Shop *" value={customer} onChange={setCustomer} placeholder="Enter customer name" />
              <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="+94 7X XXX XXXX" keyboardType="phone-pad" />

              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 12 }}>Line Items</Text>
              <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#f9fafb", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
                  <Text style={{ flex: 1, color: "#9ca3af", fontSize: 11, fontWeight: "600" }}>ITEM</Text>
                  <Text style={{ width: 50, color: "#9ca3af", fontSize: 11, fontWeight: "600", textAlign: "center" }}>QTY</Text>
                  <Text style={{ width: 70, color: "#9ca3af", fontSize: 11, fontWeight: "600", textAlign: "right" }}>PRICE</Text>
                  <View style={{ width: 32 }} />
                </View>
                {lineItems.map((item, idx) => (
                  <View key={item.id} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: idx < lineItems.length - 1 ? 1 : 0, borderBottomColor: "#f9fafb", gap: 8 }}>
                    <TextInput style={{ flex: 1, color: "#1f2937", fontSize: 14 }} placeholder="Item name" placeholderTextColor="#9ca3af" value={item.name} onChangeText={(v) => updateLineItem(item.id, "name", v)} />
                    <TextInput style={{ width: 50, textAlign: "center", color: "#1f2937", fontSize: 14, borderWidth: 1, borderColor: "#f3f4f6", borderRadius: 8, paddingVertical: 6 }} placeholder="1" placeholderTextColor="#9ca3af" keyboardType="numeric" value={item.qty} onChangeText={(v) => updateLineItem(item.id, "qty", v)} />
                    <TextInput style={{ width: 70, textAlign: "right", color: "#1f2937", fontSize: 14, borderWidth: 1, borderColor: "#f3f4f6", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 6 }} placeholder="0.00" placeholderTextColor="#9ca3af" keyboardType="numeric" value={item.price} onChangeText={(v) => updateLineItem(item.id, "price", v)} />
                    <TouchableOpacity onPress={() => removeLineItem(item.id)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#f87171", fontSize: 18, lineHeight: 20 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={addLineItem} style={{ alignItems: "center", justifyContent: "center", paddingVertical: 12, borderWidth: 1, borderStyle: "dashed", borderColor: "#a5b4fc", borderRadius: 16, marginBottom: 16 }}>
                <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>+ Add Line Item</Text>
              </TouchableOpacity>

              <View style={{ backgroundColor: "#eef2ff", borderRadius: 16, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ color: "#3730a3", fontWeight: "500" }}>Total Amount</Text>
                <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 20 }}>LKR {total.toFixed(2)}</Text>
              </View>

              <Field label="Notes (Optional)" value={notes} onChange={setNotes} placeholder="Any additional notes..." multiline />

              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <TouchableOpacity style={{ flex: 1, borderWidth: 1, borderColor: "#4f46e5", borderRadius: 16, paddingVertical: 14, alignItems: "center" }}>
                  <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>🖨️ Print</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (!customer) { Alert.alert("Validation", "Customer name is required."); return; } Alert.alert("Success", "Invoice saved!"); }} style={{ flex: 2, backgroundColor: "#4f46e5", borderRadius: 16, paddingVertical: 14, alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Save Invoice</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 18, marginBottom: 16 }}>Item Details</Text>
              <Field label="Item Name *" value={itemName} onChange={setItemName} placeholder="Enter item name" />
              <Field label="Item Code / SKU" value={itemCode} onChange={setItemCode} placeholder="e.g. SKU-0001" />
              <Field label="Category" value={itemCategory} onChange={setItemCategory} placeholder="e.g. Electronics" />
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Unit Price (LKR) *</Text>
                  <TextInput style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: "#1f2937", fontSize: 15 }} placeholder="0.00" placeholderTextColor="#9ca3af" keyboardType="numeric" value={itemPrice} onChangeText={setItemPrice} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Stock Qty</Text>
                  <TextInput style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: "#1f2937", fontSize: 15 }} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" value={itemStock} onChangeText={setItemStock} />
                </View>
              </View>
              <TouchableOpacity onPress={() => { if (!itemName || !itemPrice) { Alert.alert("Validation", "Name and price required."); return; } Alert.alert("Success", "Item saved!"); }} style={{ backgroundColor: "#4f46e5", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Item</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType = "default", multiline = false }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; keyboardType?: any; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>{label}</Text>
      <TextInput style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: "#1f2937", fontSize: 15, textAlignVertical: multiline ? "top" : "auto", minHeight: multiline ? 80 : undefined }} placeholder={placeholder} placeholderTextColor="#9ca3af" keyboardType={keyboardType} value={value} onChangeText={onChange} multiline={multiline} />
    </View>
  );
}
