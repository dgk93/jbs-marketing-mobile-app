import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Modal, FlatList, TouchableWithoutFeedback, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TempItem = { 
  item_id: number; 
  name: string; 
  qty: number; 
  price: number;
  discount: number;
  subtotal: number;
};

type ItemOption = { id: number; name: string; price: number };

export default function AddScreen() {
  const { userLocations } = useAuth();
  const [activeTab, setActiveTab] = useState<"invoice" | "item">("invoice");
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedShopName, setSelectedShopName] = useState("");
  const [notes, setNotes] = useState("");
  const [tempItems, setTempItems] = useState<TempItem[]>([]);
  const [currentItem, setCurrentItem] = useState({ item_id: 0, qty: "", discount: "" });
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemStock, setItemStock] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [items, setItems] = useState<ItemOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lorryLocation, setLorryLocation] = useState<{ id: number; location_name: string } | null>(null);
  const [shopLocations, setShopLocations] = useState<{ id: number; location_name: string }[]>([]);

  const total = tempItems.reduce((sum, item) => sum + item.subtotal, 0);

  async function fetchItems() {
    const { data, error } = await supabase.from("items").select("id, name, price");
    if (error) {
      console.error("Error fetching items:", error);
      return [];
    }
    return data || [];
  }

  async function fetchLorryLocation() {
    const { data, error } = await supabase.from("locations").select("id, location_name").eq("location_type", "lorry").limit(1).single();
    if (error) {
      console.error("Error fetching lorry location:", error);
      return null;
    }
    return data;
  }

  async function fetchShops() {
    const { data, error } = await supabase.from("locations").select("id, location_name").eq("location_type", "shop");
    if (error) {
      console.error("Error fetching shops:", error);
      return [];
    }
    return data || [];
  }

  const handleAddTempItem = () => {
    if (!currentItem.item_id) {
      Alert.alert("Validation", "Please select an item");
      return;
    }
    if (!currentItem.qty || parseFloat(currentItem.qty) <= 0) {
      Alert.alert("Validation", "Quantity must be greater than 0");
      return;
    }

    const selectedItemData = items.find((i) => i.id === currentItem.item_id);
    if (!selectedItemData) return;

    const alreadyAdded = tempItems.find((t) => t.item_id === currentItem.item_id);
    if (alreadyAdded) {
      Alert.alert("Validation", "This item is already added");
      return;
    }

    const qty = parseFloat(currentItem.qty);
    const discount = parseFloat(currentItem.discount) || 0;
    const price = selectedItemData.price;
    const subtotal = (qty * price) - discount;

    setTempItems((prev) => [
      ...prev,
      {
        item_id: currentItem.item_id,
        name: selectedItemData.name,
        qty,
        price,
        discount,
        subtotal,
      },
    ]);
    setCurrentItem({ item_id: 0, qty: "", discount: "" });
  };

  const handleRemoveTempItem = (itemId: number) => {
    setTempItems((prev) => prev.filter((t) => t.item_id !== itemId));
  };

  const upsertStockRecord = async ({ locationId, itemId, qty, stockAction }: { locationId: number; itemId: number; qty: number; stockAction: string }) => {
    const { data: existingRows, error: existingError } = await supabase
      .from("stocks")
      .select("id, current_qty, created_at")
      .eq("location_id", locationId)
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);

    if (existingError) throw existingError;

    const existing = existingRows?.[0] || null;
    const previousQty = Number(existing?.current_qty || 0);
    const currentQty = stockAction === "add" ? previousQty + qty : previousQty - qty;

    if (existing) {
      const { error: updateError } = await supabase
        .from("stocks")
        .update({
          prevoius_qty: previousQty,
          stock_action: stockAction,
          transaction_qty: qty,
          current_qty: currentQty,
        })
        .eq("location_id", locationId)
        .eq("item_id", itemId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("stocks").insert([
        {
          location_id: locationId,
          item_id: itemId,
          prevoius_qty: previousQty,
          stock_action: stockAction,
          transaction_qty: qty,
          current_qty: currentQty,
        },
      ]);

      if (insertError) throw insertError;
    }
  };

  const handleSaveInvoice = async () => {
    if (!selectedShopId) {
      Alert.alert("Validation", "Please select a shop");
      return;
    }
    if (tempItems.length === 0) {
      Alert.alert("Validation", "Please add at least one item");
      return;
    }
    if (!lorryLocation) {
      Alert.alert("Error", "No lorry location found");
      return;
    }

    setSubmitting(true);
    try {
      const totalPrice = tempItems.reduce((sum, item) => sum + item.subtotal, 0);

      // Transaction type: OUT (id = 4 or 5 based on your setup - using 4 for "lorry to shop")
      const transactionTypeId = 4;

      // Insert transaction_inventory
      const { data: transactionData, error: transactionError } = await supabase
        .from("transaction_inventory")
        .insert([
          {
            type_id: transactionTypeId,
            total_price: totalPrice,
            from_id: lorryLocation.id,
            to_id: selectedShopId,
          },
        ])
        .select("id")
        .single();

      if (transactionError) throw transactionError;

      // Insert transaction_items with discount
      const transactionItems = tempItems.map((item) => ({
        item_id: item.item_id,
        qty: item.qty,
        discount: item.discount,
        transaction_inventory_id: transactionData.id,
      }));

      const { error: itemError } = await supabase.from("transaction_items").insert(transactionItems);

      if (itemError) throw itemError;

      // Update stocks (reduce from lorry, add to shop)
      for (const item of tempItems) {
        await upsertStockRecord({
          locationId: lorryLocation.id,
          itemId: item.item_id,
          qty: item.qty,
          stockAction: "reduce",
        });

        await upsertStockRecord({
          locationId: selectedShopId,
          itemId: item.item_id,
          qty: item.qty,
          stockAction: "add",
        });
      }

      Alert.alert("Success", "Invoice saved successfully!");
      setSelectedShopId(null);
      setSelectedShopName("");
      setTempItems([]);
      setCurrentItem({ item_id: 0, qty: "", discount: "" });
      setNotes("");
    } catch (err) {
      console.error("Error saving invoice:", err);
      Alert.alert("Error", "Failed to save invoice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchItems().then(setItems);
    fetchLorryLocation().then(setLorryLocation);
    fetchShops().then(setShopLocations);
  }, []);

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
              
              <SelectField
                label="Select Shop *"
                value={selectedShopName}
                onSelect={(loc) => {
                  setSelectedShopId(loc.id);
                  setSelectedShopName(loc.location_name);
                }}
                placeholder="Select a shop"
                options={shopLocations}
              />

              {/* Added Items List */}
              {tempItems.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 8 }}>Added Items</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" }}>
                    {tempItems.map((item, index) => (
                      <View
                        key={item.item_id}
                        style={{
                          padding: 16,
                          borderBottomWidth: index < tempItems.length - 1 ? 1 : 0,
                          borderBottomColor: "#f3f4f6",
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text style={{ fontWeight: "600", color: "#1f2937", flex: 1 }}>{item.name}</Text>
                          <TouchableOpacity onPress={() => handleRemoveTempItem(item.item_id)}>
                            <Text style={{ color: "#ef4444", fontSize: 18 }}>×</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 12, color: "#6b7280" }}>
                          Qty: {item.qty} · Price: LKR {item.price.toFixed(2)} · Discount: LKR {item.discount.toFixed(2)}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                          Subtotal: LKR {item.subtotal.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                    <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>LKR {total.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              {/* Add Item Section */}
              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 12 }}>Add Item</Text>
              <SelectField
                label="Item *"
                value={items.find((i) => i.id === currentItem.item_id)?.name || ""}
                onSelect={(item) => setCurrentItem((prev) => ({ ...prev, item_id: item.id }))}
                placeholder="Select an item"
                options={items.map((i) => ({ id: i.id, location_name: i.name }))}
              />
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Quantity *</Text>
                  <TextInput
                    style={{
                      backgroundColor: "#fff",
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                      borderRadius: 16,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      color: "#1f2937",
                      fontSize: 15,
                    }}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={currentItem.qty}
                    onChangeText={(v) => setCurrentItem((prev) => ({ ...prev, qty: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Discount (LKR)</Text>
                  <TextInput
                    style={{
                      backgroundColor: "#fff",
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                      borderRadius: 16,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      color: "#1f2937",
                      fontSize: 15,
                    }}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={currentItem.discount}
                    onChangeText={(v) => setCurrentItem((prev) => ({ ...prev, discount: v }))}
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={handleAddTempItem}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "#a5b4fc",
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>+ Add Item</Text>
              </TouchableOpacity>

              <Field label="Notes (Optional)" value={notes} onChange={setNotes} placeholder="Any additional notes..." multiline />

              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, borderWidth: 1, borderColor: "#4f46e5", borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>🖨️ Print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveInvoice}
                  disabled={submitting || !selectedShopId || tempItems.length === 0}
                  style={{
                    flex: 2,
                    backgroundColor: submitting || !selectedShopId || tempItems.length === 0 ? "#9ca3af" : "#4f46e5",
                    borderRadius: 16,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Save Invoice</Text>
                  )}
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

function SelectField({ label, value, onSelect, placeholder, options }: {
  label: string;
  value: string;
  onSelect: (item: { id: number; location_name: string }) => void;
  placeholder: string;
  options: { id: number; location_name: string }[];
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>{label}</Text>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      >
        <Text style={{ color: value ? "#1f2937" : "#9ca3af", fontSize: 15, flex: 1 }}>{value || placeholder}</Text>
        <Text style={{ color: "#9ca3af", fontSize: 12 }}>▼</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", maxHeight: 400 }}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "700", fontSize: 16, color: "#1f2937" }}>Select Shop</Text>
                  <TouchableOpacity onPress={() => setVisible(false)}>
                    <Text style={{ color: "#9ca3af", fontSize: 20, lineHeight: 22 }}>×</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => { onSelect(item); setVisible(false); }}
                      style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f9fafb", backgroundColor: value === item.location_name ? "#eef2ff" : "#fff" }}
                    >
                      <Text style={{ color: value === item.location_name ? "#4338ca" : "#1f2937", fontSize: 15, fontWeight: value === item.location_name ? "600" : "400" }}>
                        {value === item.location_name ? "✓  " : "    "}{item.location_name}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={{ padding: 24, color: "#9ca3af", textAlign: "center" }}>No shops available</Text>
                  }
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
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
