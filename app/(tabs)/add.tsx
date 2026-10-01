import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  connectPrinter,
  getSavedPrinter,
  preferMtpPrinter,
  printInvoice,
  savePrinter,
  scanPrinters,
} from "@/lib/printer";
import type { Device } from "@/lib/printer";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Modal, FlatList, TouchableWithoutFeedback, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Printer, Search, X } from "lucide-react-native";

function toMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function lineDiscountTotal(unitDiscount: number, qty: number) {
  return toMoney(unitDiscount * qty);
}

function lineSubtotal(qty: number, price: number, unitDiscount: number) {
  return toMoney(qty * price - lineDiscountTotal(unitDiscount, qty));
}

type TempItem = {
  item_id: number;
  name: string;
  qty: number;
  price: number;
  discount: number;
  subtotal: number;
};

type TempReturnItem = {
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
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedShopName, setSelectedShopName] = useState("");
  const [tempItems, setTempItems] = useState<TempItem[]>([]);
  const [currentItem, setCurrentItem] = useState({ item_id: 0, qty: "", discount: "" });
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [goodReturns, setGoodReturns] = useState<TempReturnItem[]>([]);
  const [currentGoodReturn, setCurrentGoodReturn] = useState({ item_id: 0, qty: "", discount: "" });
  const [marketReturns, setMarketReturns] = useState<TempReturnItem[]>([]);
  const [currentMarketReturn, setCurrentMarketReturn] = useState({ item_id: 0, qty: "", discount: "" });
  const [items, setItems] = useState<ItemOption[]>([]);
  const [cashAmount, setCashAmount] = useState("");
  const [chequeAmount, setChequeAmount] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [printerDevices, setPrinterDevices] = useState<Device[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<{ address: string; name: string } | null>(null);
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shopLocations, setShopLocations] = useState<{ id: number; location_name: string }[]>([]);

  // Stock / invoice source = logged-in user's location (prefer lorry)
  const lorryLocation = useMemo(() => {
    const match =
      userLocations.find((loc) => loc.location_type?.trim()?.toLowerCase() === "lorry") ||
      userLocations.find((loc) => loc.location_name?.trim()?.toLowerCase().includes("lorry")) ||
      userLocations[0] ||
      null;

    return match ? { id: match.id, location_name: match.location_name } : null;
  }, [userLocations]);

  const assignedLorryIds = useMemo(() => {
    const lorries = userLocations.filter((loc) => {
      const type = loc.location_type?.trim()?.toLowerCase();
      const name = loc.location_name?.trim()?.toLowerCase() || "";
      return type === "lorry" || name.includes("lorry");
    });
    const source = lorries.length > 0 ? lorries : userLocations;
    return [...new Set(source.map((loc) => Number(loc.id)).filter(Boolean))];
  }, [userLocations]);

  const total = tempItems.reduce((sum, item) => sum + item.subtotal, 0);
  const goodReturnTotal = goodReturns.reduce((sum, item) => sum + item.subtotal, 0);
  const marketReturnTotal = marketReturns.reduce((sum, item) => sum + item.subtotal, 0);
  const netTotal = total - (goodReturnTotal + marketReturnTotal);
  const cashValue = parseFloat(cashAmount) || 0;
  const chequeValue = parseFloat(chequeAmount) || 0;
  const creditValue = toMoney(Math.max(netTotal - cashValue - chequeValue, 0));
  const paymentSum = toMoney(cashValue + chequeValue + creditValue);
  const paymentDifference = toMoney(paymentSum - netTotal);
  const paymentsMatchNetTotal = Math.abs(paymentDifference) < 0.005;

  async function fetchAvailableStock(locationId: number, itemId: number) {
    const { data, error } = await supabase
      .from("stocks")
      .select("current_qty, created_at, id")
      .eq("location_id", locationId)
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching available stock:", error);
      return 0;
    }

    return Number(data?.[0]?.current_qty || 0);
  }

  async function fetchItems() {
    const { data, error } = await supabase.from("items").select("id, name, price");
    if (error) {
      console.error("Error fetching items:", error);
      return [];
    }
    return data || [];
  }

  const fetchShops = useCallback(async () => {
    if (assignedLorryIds.length === 0) return [];

    try {
      const { data: routeLorries, error: routeLorryError } = await supabase
        .from("route_lorries")
        .select("route_id")
        .in("lorry_id", assignedLorryIds);

      if (routeLorryError) throw routeLorryError;

      const routeIds = [
        ...new Set((routeLorries || []).map((row) => Number(row.route_id)).filter(Boolean)),
      ];
      if (routeIds.length === 0) return [];

      const { data: routeShops, error: routeShopError } = await supabase
        .from("route_shops")
        .select("shop_id")
        .in("route_id", routeIds);

      if (routeShopError) throw routeShopError;

      const shopIds = [
        ...new Set((routeShops || []).map((row) => Number(row.shop_id)).filter(Boolean)),
      ];
      if (shopIds.length === 0) return [];

      const { data, error } = await supabase
        .from("locations")
        .select("id, location_name")
        .in("id", shopIds)
        .eq("location_type", "shop")
        .order("location_name", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error fetching shops:", err);
      return [];
    }
  }, [assignedLorryIds]);

  const handleAddTempItem = () => {
    if (!currentItem.item_id) {
      Alert.alert("Validation", "Please select an item");
      return;
    }
    if (!currentItem.qty || parseFloat(currentItem.qty) <= 0) {
      Alert.alert("Validation", "Quantity must be greater than 0");
      return;
    }

    const stock = availableQty ?? 0;
    if (stock === 0) {
      Alert.alert("Validation", "There is no available stock");
      return;
    }

    const qty = parseFloat(currentItem.qty);
    if (qty > stock) {
      Alert.alert("Validation", `You can add only ${stock} or less`);
      return;
    }

    const selectedItemData = items.find((i) => i.id === currentItem.item_id);
    if (!selectedItemData) return;

    const alreadyAdded = tempItems.find((t) => t.item_id === currentItem.item_id);
    if (alreadyAdded) {
      Alert.alert("Validation", "This item is already added");
      return;
    }

    const unitDiscount = parseFloat(currentItem.discount) || 0;
    const price = selectedItemData.price;
    if (unitDiscount < 0) {
      Alert.alert("Validation", "Discount cannot be negative");
      return;
    }
    if (unitDiscount > price) {
      Alert.alert("Validation", "Discount per item cannot exceed the item price");
      return;
    }
    const subtotal = lineSubtotal(qty, price, unitDiscount);

    setTempItems((prev) => [
      ...prev,
      {
        item_id: currentItem.item_id,
        name: selectedItemData.name,
        qty,
        price,
        discount: unitDiscount,
        subtotal,
      },
    ]);
    setCurrentItem({ item_id: 0, qty: "", discount: "" });
    setAvailableQty(null);
  };

  const handleRemoveTempItem = (itemId: number) => {
    setTempItems((prev) => prev.filter((t) => t.item_id !== itemId));
  };

  const handleAddReturnItem = (
    current: { item_id: number; qty: string; discount: string },
    list: TempReturnItem[],
    setList: React.Dispatch<React.SetStateAction<TempReturnItem[]>>,
    setCurrent: React.Dispatch<React.SetStateAction<{ item_id: number; qty: string; discount: string }>>
  ) => {
    if (!current.item_id) {
      Alert.alert("Validation", "Please select an item");
      return;
    }
    if (!current.qty || parseFloat(current.qty) <= 0) {
      Alert.alert("Validation", "Quantity must be greater than 0");
      return;
    }

    const selectedItemData = items.find((i) => i.id === current.item_id);
    if (!selectedItemData) return;

    if (list.find((t) => t.item_id === current.item_id)) {
      Alert.alert("Validation", "This item is already added");
      return;
    }

    const qty = parseFloat(current.qty);
    const unitDiscount = parseFloat(current.discount) || 0;
    if (unitDiscount < 0) {
      Alert.alert("Validation", "Discount cannot be negative");
      return;
    }
    if (unitDiscount > selectedItemData.price) {
      Alert.alert("Validation", "Discount per item cannot exceed the item price");
      return;
    }

    setList((prev) => [
      ...prev,
      {
        item_id: current.item_id,
        name: selectedItemData.name,
        qty,
        price: selectedItemData.price,
        discount: unitDiscount,
        subtotal: lineSubtotal(qty, selectedItemData.price, unitDiscount),
      },
    ]);
    setCurrent({ item_id: 0, qty: "", discount: "" });
  };

  const handleRemoveReturnItem = (type: "good" | "market", itemId: number) => {
    if (type === "good") {
      setGoodReturns((prev) => prev.filter((t) => t.item_id !== itemId));
    } else {
      setMarketReturns((prev) => prev.filter((t) => t.item_id !== itemId));
    }
  };

  const insertStockRecord = async ({ locationId, itemId, qty, stockAction }: { locationId: number; itemId: number; qty: number; stockAction: string }) => {
    const { data: existingRows, error: existingError } = await supabase
      .from("stocks")
      .select("id, current_qty, created_at")
      .eq("location_id", locationId)
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);

    if (existingError) throw existingError;

    const previousQty = Number(existingRows?.[0]?.current_qty || 0);
    const currentQty = stockAction === "add" ? previousQty + qty : previousQty - qty;

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
  };

  const handleScanPrinters = async () => {
    setScanningPrinters(true);
    try {
      const devices = await scanPrinters();
      const preferred = preferMtpPrinter(devices);
      const ordered = preferred
        ? [preferred, ...devices.filter((d) => d.address !== preferred.address)]
        : devices;
      setPrinterDevices(ordered);
      if (devices.length === 0) {
        Alert.alert("No printers", "Pair your MTP-3 in phone Bluetooth settings, then scan again.");
      }
    } catch (err: any) {
      console.error("Printer scan failed:", err);
      Alert.alert("Bluetooth Error", err?.message || "Failed to scan for printers. Pair MTP-3 in system settings first.");
    } finally {
      setScanningPrinters(false);
    }
  };

  const handleSelectPrinter = async (device: Device) => {
    setConnectingPrinter(true);
    try {
      const connectedAddress = await connectPrinter(device.address, device.deviceType);
      await savePrinter(connectedAddress, device.name || "MTP-3");
      setSelectedPrinter({ address: connectedAddress, name: device.name || "MTP-3" });
      setPrinterModalVisible(false);
      Alert.alert("Connected", `${device.name || "Printer"} is ready.`);
    } catch (err: any) {
      console.warn("Printer connect failed:", err);
      Alert.alert(
        "Connection Failed",
        `${err?.message || "Could not connect to printer."}\n\nMake sure MTP-III is paired in phone Bluetooth settings, turned on, and within range. Then scan and try again.`
      );
    } finally {
      setConnectingPrinter(false);
    }
  };

  const handleOpenPreview = () => {
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
    if (!paymentsMatchNetTotal) {
      Alert.alert(
        "Validation",
        `Cash + Cheque + Credit must equal Net Total (LKR ${netTotal.toFixed(2)}).\nCurrent payment total: LKR ${paymentSum.toFixed(2)}.`
      );
      return;
    }
    setPreviewVisible(true);
  };

  const handleSaveInvoice = async () => {
    if (!selectedShopId || !lorryLocation || tempItems.length === 0) return;

    const itemsTotal = tempItems.reduce((sum, item) => sum + item.subtotal, 0);
    const returnsTotal =
      goodReturns.reduce((sum, item) => sum + item.subtotal, 0) +
      marketReturns.reduce((sum, item) => sum + item.subtotal, 0);
    const netTotalPrice = itemsTotal - returnsTotal;
    const savePaymentSum = toMoney(
      (parseFloat(cashAmount) || 0) + (parseFloat(chequeAmount) || 0) + creditValue
    );

    if (Math.abs(savePaymentSum - netTotalPrice) >= 0.005) {
      Alert.alert(
        "Validation",
        `Cash + Cheque + Credit must equal Net Total (LKR ${netTotalPrice.toFixed(2)}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      // Transaction type: OUT (id = 4 or 5 based on your setup - using 4 for "lorry to shop")
      const transactionTypeId = 2;

      // Insert transaction_inventory
      const { data: transactionData, error: transactionError } = await supabase
        .from("transaction_inventory")
        .insert([
          {
            type_id: transactionTypeId,
            total_price: netTotalPrice,
            from_id: lorryLocation.id,
            to_id: selectedShopId,
            cash: parseFloat(cashAmount) || 0,
            cheque: parseFloat(chequeAmount) || 0,
            credit: creditValue,
          },
        ])
        .select("id")
        .single();

      if (transactionError) throw transactionError;

      const savedCredit = creditValue;
      if (savedCredit > 0) {
        const { error: shopCreditError } = await supabase.from("shop_credits").insert({
          transaction_inventory_id: transactionData.id,
          shop_id: selectedShopId,
          original_amount: savedCredit,
          remaining_amount: savedCredit,
        });
        if (shopCreditError) throw shopCreditError;
      }

      // Insert transaction_items with discount
      const transactionItems = tempItems.map((item) => ({
        item_id: item.item_id,
        qty: item.qty,
        discount: lineDiscountTotal(item.discount, item.qty),
        transaction_inventory_id: transactionData.id,
      }));

      const { error: itemError } = await supabase.from("transaction_items").insert(transactionItems);

      if (itemError) throw itemError;

      if (goodReturns.length > 0) {
        const goodReturnRows = goodReturns.map((item) => ({
          inventry_id: transactionData.id,
          item_id: item.item_id,
          qty: item.qty,
          discount: lineDiscountTotal(item.discount, item.qty),
        }));
        const { error: goodReturnError } = await supabase.from("good_return").insert(goodReturnRows);
        if (goodReturnError) throw goodReturnError;
      }

      if (marketReturns.length > 0) {
        const marketReturnRows = marketReturns.map((item) => ({
          inventry_id: transactionData.id,
          item_id: item.item_id,
          qty: item.qty,
          discount: lineDiscountTotal(item.discount, item.qty),
        }));
        const { error: marketReturnError } = await supabase.from("market_return").insert(marketReturnRows);
        if (marketReturnError) throw marketReturnError;
      }

      // Sold items: reduce lorry stock, add shop stock (separate rows)
      for (const item of tempItems) {
        await insertStockRecord({
          locationId: lorryLocation.id,
          itemId: item.item_id,
          qty: item.qty,
          stockAction: "reduce",
        });

        await insertStockRecord({
          locationId: selectedShopId,
          itemId: item.item_id,
          qty: item.qty,
          stockAction: "add",
        });
      }

      // Good returns: add back to lorry stock as a separate row
      for (const item of goodReturns) {
        await insertStockRecord({
          locationId: lorryLocation.id,
          itemId: item.item_id,
          qty: item.qty,
          stockAction: "add",
        });
      }

      let printMessage = "Invoice saved successfully!";
      if (selectedPrinter?.address) {
        try {
          await printInvoice(selectedPrinter.address, {
            shopName: selectedShopName,
            items: tempItems,
            total: itemsTotal,
            netTotal: netTotalPrice,
            cash: parseFloat(cashAmount) || 0,
            cheque: parseFloat(chequeAmount) || 0,
            credit: creditValue,
            goodReturns: goodReturns.map(({ name, qty, price, discount, subtotal }) => ({
              name,
              qty,
              price,
              discount,
              subtotal,
            })),
            marketReturns: marketReturns.map(({ name, qty, price, discount, subtotal }) => ({
              name,
              qty,
              price,
              discount,
              subtotal,
            })),
          });
          printMessage = "Invoice saved and printed successfully!";
        } catch (printErr: any) {
          console.error("Print failed:", printErr);
          printMessage = "Invoice saved, but printing failed. Check printer connection.";
        }
      } else {
        printMessage = "Invoice saved. No printer connected — connect MTP-3 to print next time.";
      }

      setPreviewVisible(false);
      Alert.alert("Success", printMessage);
      setSelectedShopId(null);
      setSelectedShopName("");
      setTempItems([]);
      setCurrentItem({ item_id: 0, qty: "", discount: "" });
      setAvailableQty(null);
      setCashAmount("");
      setChequeAmount("");
      setGoodReturns([]);
      setCurrentGoodReturn({ item_id: 0, qty: "", discount: "" });
      setMarketReturns([]);
      setCurrentMarketReturn({ item_id: 0, qty: "", discount: "" });
    } catch (err) {
      console.error("Error saving invoice:", err);
      Alert.alert("Error", "Failed to save invoice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchItems().then(setItems);
    getSavedPrinter().then(async (saved) => {
      if (!saved) return;
      setSelectedPrinter(saved);
      try {
        const connectedAddress = await connectPrinter(saved.address);
        if (connectedAddress !== saved.address) {
          await savePrinter(connectedAddress, saved.name);
          setSelectedPrinter({ address: connectedAddress, name: saved.name });
        }
      } catch (err) {
        console.warn("Could not auto-connect saved printer:", err);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchShops().then((shops) => {
      if (cancelled) return;
      setShopLocations(shops);
      setSelectedShopId((currentId) => {
        if (currentId && !shops.some((shop) => Number(shop.id) === Number(currentId))) {
          setSelectedShopName("");
          return null;
        }
        return currentId;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [fetchShops]);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailableStock() {
      if (!lorryLocation?.id || !currentItem.item_id) {
        setAvailableQty(null);
        return;
      }

      const qty = await fetchAvailableStock(lorryLocation.id, currentItem.item_id);
      if (!cancelled) {
        setAvailableQty(qty);
      }
    }

    loadAvailableStock();

    return () => {
      cancelled = true;
    };
  }, [lorryLocation?.id, currentItem.item_id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Add Invoice</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, marginTop: -16 }}>
        <ScrollView style={{ backgroundColor: "#f8fafc", borderTopLeftRadius: 28, borderTopRightRadius: 28 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 18, marginBottom: 16 }}>Invoice Details</Text>

          <SelectField
            label="Select Shop *"
            title="Select Shop"
            searchable
            searchPlaceholder="Search shops..."
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
                        <X size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: "#6b7280" }}>
                      Qty: {item.qty} · Price: LKR {item.price.toFixed(2)} · Discount: LKR {item.discount.toFixed(2)} × {item.qty}
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
            title="Select Item"
            searchable
            searchPlaceholder="Search items..."
            value={items.find((i) => i.id === currentItem.item_id)?.name || ""}
            onSelect={(item) => setCurrentItem((prev) => ({ ...prev, item_id: item.id }))}
            placeholder="Select an item"
            options={items.map((i) => ({ id: i.id, location_name: i.name }))}
          />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600" }}>Qty *</Text>
                {currentItem.item_id > 0 && (
                  <Text
                    style={{
                      color: availableQty === 0 || availableQty === null ? "#ef4444" : "#059669",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    In Stock: {availableQty == null ? 0 : `${availableQty}`}
                  </Text>
                )}
              </View>
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
              <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Discount / item (LKR)</Text>
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

          {/* Good Return Section */}
          <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 12, marginTop: 12 }}>Good Return</Text>
          {goodReturns.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" }}>
                {goodReturns.map((item, index) => (
                  <View
                    key={item.item_id}
                    style={{
                      padding: 16,
                      borderBottomWidth: index < goodReturns.length - 1 ? 1 : 0,
                      borderBottomColor: "#f3f4f6",
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontWeight: "600", color: "#1f2937", flex: 1 }}>{item.name}</Text>
                      <TouchableOpacity onPress={() => handleRemoveReturnItem("good", item.item_id)}>
                        <X size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: "#6b7280" }}>
                      Qty: {item.qty} · Price: LKR {item.price.toFixed(2)} · Discount: LKR {item.discount.toFixed(2)} × {item.qty}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                      Subtotal: LKR {item.subtotal.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>LKR {goodReturnTotal.toFixed(2)}</Text>
              </View>
            </View>
          )}
          <SelectField
            label="Item"
            title="Select Item"
            searchable
            searchPlaceholder="Search items..."
            value={items.find((i) => i.id === currentGoodReturn.item_id)?.name || ""}
            onSelect={(item) => setCurrentGoodReturn((prev) => ({ ...prev, item_id: item.id }))}
            placeholder="Select an item"
            options={items.map((i) => ({ id: i.id, location_name: i.name }))}
          />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Quantity</Text>
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
                value={currentGoodReturn.qty}
                onChangeText={(v) => setCurrentGoodReturn((prev) => ({ ...prev, qty: v }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Discount / item (LKR)</Text>
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
                value={currentGoodReturn.discount}
                onChangeText={(v) => setCurrentGoodReturn((prev) => ({ ...prev, discount: v }))}
              />
            </View>
          </View>
          <TouchableOpacity
            onPress={() =>
              handleAddReturnItem(currentGoodReturn, goodReturns, setGoodReturns, setCurrentGoodReturn)
            }
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
            <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>+ Add Good Return</Text>
          </TouchableOpacity>

          {/* Market Return Section */}
          <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 12 }}>Market Return</Text>
          {marketReturns.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" }}>
                {marketReturns.map((item, index) => (
                  <View
                    key={item.item_id}
                    style={{
                      padding: 16,
                      borderBottomWidth: index < marketReturns.length - 1 ? 1 : 0,
                      borderBottomColor: "#f3f4f6",
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontWeight: "600", color: "#1f2937", flex: 1 }}>{item.name}</Text>
                      <TouchableOpacity onPress={() => handleRemoveReturnItem("market", item.item_id)}>
                        <X size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: "#6b7280" }}>
                      Qty: {item.qty} · Price: LKR {item.price.toFixed(2)} · Discount: LKR {item.discount.toFixed(2)} × {item.qty}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                      Subtotal: LKR {item.subtotal.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>LKR {marketReturnTotal.toFixed(2)}</Text>
              </View>
            </View>
          )}
          <SelectField
            label="Item"
            title="Select Item"
            searchable
            searchPlaceholder="Search items..."
            value={items.find((i) => i.id === currentMarketReturn.item_id)?.name || ""}
            onSelect={(item) => setCurrentMarketReturn((prev) => ({ ...prev, item_id: item.id }))}
            placeholder="Select an item"
            options={items.map((i) => ({ id: i.id, location_name: i.name }))}
          />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Quantity</Text>
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
                value={currentMarketReturn.qty}
                onChangeText={(v) => setCurrentMarketReturn((prev) => ({ ...prev, qty: v }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Discount / item (LKR)</Text>
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
                value={currentMarketReturn.discount}
                onChangeText={(v) => setCurrentMarketReturn((prev) => ({ ...prev, discount: v }))}
              />
            </View>
          </View>
          <TouchableOpacity
            onPress={() =>
              handleAddReturnItem(currentMarketReturn, marketReturns, setMarketReturns, setCurrentMarketReturn)
            }
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
            <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>+ Add Market Return</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 12, gap: 12 }}>
            <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#3730a3", fontWeight: "600" }}>Net Total</Text>
              <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>LKR {netTotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", flex: 1 }}>Cash Amount</Text>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: "#1f2937",
                  fontSize: 15,
                  textAlign: "right",
                }}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={cashAmount}
                onChangeText={setCashAmount}
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", flex: 1 }}>Cheque Amount</Text>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: "#1f2937",
                  fontSize: 15,
                  textAlign: "right",
                }}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={chequeAmount}
                onChangeText={setChequeAmount}
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", flex: 1 }}>Credit Amount</Text>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: "#f3f4f6",
                  borderWidth: 1,
                  borderColor: paymentsMatchNetTotal ? "#e5e7eb" : "#fca5a5",
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: "#6b7280",
                  fontSize: 15,
                  textAlign: "right",
                }}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                editable={false}
                value={creditValue.toFixed(2)}
              />
            </View>
            <View
              style={{
                backgroundColor: paymentsMatchNetTotal ? "#ecfdf5" : "#fef2f2",
                borderRadius: 12,
                padding: 12,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: paymentsMatchNetTotal ? "#047857" : "#b91c1c", fontSize: 13, fontWeight: "600" }}>
                  Payment Total
                </Text>
                <Text style={{ color: paymentsMatchNetTotal ? "#047857" : "#b91c1c", fontSize: 13, fontWeight: "700" }}>
                  LKR {paymentSum.toFixed(2)}
                </Text>
              </View>
              {!paymentsMatchNetTotal ? (
                <Text style={{ color: "#dc2626", fontSize: 12 }}>
                  {paymentDifference > 0
                    ? `Over by LKR ${paymentDifference.toFixed(2)}. Cash + Cheque + Credit must equal Net Total.`
                    : `Short by LKR ${Math.abs(paymentDifference).toFixed(2)}. Cash + Cheque + Credit must equal Net Total.`}
                </Text>
              ) : (
                <Text style={{ color: "#059669", fontSize: 12 }}>Payments match Net Total.</Text>
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, borderWidth: 1, borderColor: "#4f46e5", borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Printer size={16} color="#4f46e5" />
                <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 14 }}>Print</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenPreview}
              disabled={!selectedShopId || tempItems.length === 0 || !paymentsMatchNetTotal}
              style={{
                flex: 2,
                backgroundColor:
                  !selectedShopId || tempItems.length === 0 || !paymentsMatchNetTotal ? "#9ca3af" : "#4f46e5",
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Save Invoice</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={previewVisible} transparent animationType="slide" onRequestClose={() => !submitting && setPreviewVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "700", fontSize: 18, color: "#1f2937" }}>Invoice Preview</Text>
              <TouchableOpacity onPress={() => !submitting && setPreviewVisible(false)} disabled={submitting}>
                <X size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 12 }}>
              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 8 }}>Added Items</Text>
              <View style={{ backgroundColor: "#f9fafb", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
                {tempItems.map((item, index) => (
                  <View
                    key={item.item_id}
                    style={{
                      padding: 14,
                      borderBottomWidth: index < tempItems.length - 1 ? 1 : 0,
                      borderBottomColor: "#e5e7eb",
                    }}
                  >
                    <Text style={{ fontWeight: "600", color: "#1f2937" }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      Qty: {item.qty} · Price: LKR {item.price.toFixed(2)} · Discount: LKR {item.discount.toFixed(2)} × {item.qty}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                      Subtotal: LKR {item.subtotal.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>LKR {total.toFixed(2)}</Text>
              </View>

              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 8 }}>Good Return</Text>
              {goodReturns.length > 0 ? (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ backgroundColor: "#f9fafb", borderRadius: 16, overflow: "hidden" }}>
                    {goodReturns.map((item, index) => (
                      <View
                        key={item.item_id}
                        style={{
                          padding: 14,
                          borderBottomWidth: index < goodReturns.length - 1 ? 1 : 0,
                          borderBottomColor: "#e5e7eb",
                        }}
                      >
                        <Text style={{ fontWeight: "600", color: "#1f2937" }}>{item.name}</Text>
                        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          Qty: {item.qty} · Price: LKR {item.price.toFixed(2)} · Discount: LKR {item.discount.toFixed(2)} × {item.qty}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                          Subtotal: LKR {item.subtotal.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                    <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>LKR {goodReturnTotal.toFixed(2)}</Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>No good return items</Text>
              )}

              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 8 }}>Market Return</Text>
              {marketReturns.length > 0 ? (
                <View style={{ marginBottom: 8 }}>
                  <View style={{ backgroundColor: "#f9fafb", borderRadius: 16, overflow: "hidden" }}>
                    {marketReturns.map((item, index) => (
                      <View
                        key={item.item_id}
                        style={{
                          padding: 14,
                          borderBottomWidth: index < marketReturns.length - 1 ? 1 : 0,
                          borderBottomColor: "#e5e7eb",
                        }}
                      >
                        <Text style={{ fontWeight: "600", color: "#1f2937" }}>{item.name}</Text>
                        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          Qty: {item.qty} · Price: LKR {item.price.toFixed(2)} · Discount: LKR {item.discount.toFixed(2)} × {item.qty}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#4338ca", fontWeight: "600", marginTop: 4 }}>
                          Subtotal: LKR {item.subtotal.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#3730a3", fontWeight: "600" }}>Total</Text>
                    <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>LKR {marketReturnTotal.toFixed(2)}</Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>No market return items</Text>
              )}

              <View style={{ gap: 10, marginBottom: 16 }}>
                <View style={{ backgroundColor: "#eef2ff", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#3730a3", fontWeight: "600" }}>Net Total</Text>
                  <Text style={{ color: "#3730a3", fontWeight: "700", fontSize: 16 }}>LKR {netTotal.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#4b5563", fontSize: 14 }}>Cash Amount</Text>
                  <Text style={{ color: "#1f2937", fontWeight: "600" }}>LKR {(parseFloat(cashAmount) || 0).toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#4b5563", fontSize: 14 }}>Cheque Amount</Text>
                  <Text style={{ color: "#1f2937", fontWeight: "600" }}>LKR {(parseFloat(chequeAmount) || 0).toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#4b5563", fontSize: 14 }}>Credit Amount</Text>
                  <Text style={{ color: "#1f2937", fontWeight: "600" }}>LKR {creditValue.toFixed(2)}</Text>
                </View>
              </View>

            </ScrollView>

            <View style={{ marginBottom: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb", padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600" }}>Bluetooth Printer</Text>
                <TouchableOpacity
                  onPress={async () => {
                    setPrinterModalVisible(true);
                    await handleScanPrinters();
                  }}
                >
                  <Text style={{ color: "#4f46e5", fontWeight: "600", fontSize: 13 }}>
                    {selectedPrinter ? "Change" : "Connect MTP-3"}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: selectedPrinter ? "#1f2937" : "#9ca3af", fontSize: 14 }}>
                {selectedPrinter ? `Connected: ${selectedPrinter.name}` : "No printer connected"}
              </Text>
            </View>

            <View style={{ padding: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" }}>
              <TouchableOpacity
                onPress={handleSaveInvoice}
                disabled={submitting}
                style={{
                  backgroundColor: submitting ? "#9ca3af" : "#4f46e5",
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                    {selectedPrinter ? "Save & Print Invoice" : "Save Invoice"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={printerModalVisible} transparent animationType="slide" onRequestClose={() => setPrinterModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%" }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "700", fontSize: 18, color: "#1f2937" }}>Select Printer</Text>
              <TouchableOpacity onPress={() => setPrinterModalVisible(false)}>
                <X size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <Text style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
                Pair MTP-3 in phone Bluetooth settings first, then select it below.
              </Text>
              <TouchableOpacity
                onPress={handleScanPrinters}
                disabled={scanningPrinters || connectingPrinter}
                style={{
                  borderWidth: 1,
                  borderColor: "#4f46e5",
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                {scanningPrinters ? (
                  <ActivityIndicator color="#4f46e5" />
                ) : (
                  <Text style={{ color: "#4f46e5", fontWeight: "600" }}>Scan Devices</Text>
                )}
              </TouchableOpacity>
            </View>

            {connectingPrinter ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color="#4f46e5" />
                <Text style={{ color: "#6b7280", marginTop: 8 }}>Connecting...</Text>
              </View>
            ) : (
              <FlatList
                data={printerDevices}
                keyExtractor={(item) => item.address}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
                ListEmptyComponent={
                  <Text style={{ color: "#9ca3af", textAlign: "center", paddingVertical: 24 }}>
                    {scanningPrinters ? "Scanning..." : "No devices found"}
                  </Text>
                }
                renderItem={({ item }) => {
                  const selected = selectedPrinter?.address === item.address;
                  return (
                    <TouchableOpacity
                      onPress={() => handleSelectPrinter(item)}
                      style={{
                        paddingVertical: 16,
                        paddingHorizontal: 14,
                        borderRadius: 14,
                        marginBottom: 8,
                        backgroundColor: selected ? "#eef2ff" : "#f9fafb",
                        borderWidth: 1,
                        borderColor: selected ? "#a5b4fc" : "#e5e7eb",
                      }}
                    >
                      <Text style={{ fontWeight: "600", color: selected ? "#4338ca" : "#1f2937" }}>
                        {item.name || "Unknown device"}
                      </Text>
                      <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{item.address}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SelectField({
  label,
  title,
  value,
  onSelect,
  placeholder,
  options,
  searchable = false,
  searchPlaceholder = "Search...",
}: {
  label: string;
  title?: string;
  value: string;
  onSelect: (item: { id: number; location_name: string }) => void;
  placeholder: string;
  options: { id: number; location_name: string }[];
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((item) => item.location_name.toLowerCase().includes(term));
  }, [options, search]);

  const closeModal = () => {
    setSearch("");
    setVisible(false);
  };

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
      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", maxHeight: 480 }}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "700", fontSize: 16, color: "#1f2937" }}>{title || placeholder}</Text>
                  <TouchableOpacity onPress={closeModal}>
                    <X size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                {searchable ? (
                  <View
                    style={{
                      margin: 12,
                      marginBottom: 4,
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    <Search size={16} color="#9ca3af" />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: "#1f2937", fontSize: 14 }}
                      placeholder={searchPlaceholder}
                      placeholderTextColor="#9ca3af"
                      value={search}
                      onChangeText={setSearch}
                      autoFocus
                    />
                  </View>
                ) : null}
                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item) => item.id.toString()}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => { onSelect(item); closeModal(); }}
                      style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f9fafb", backgroundColor: value === item.location_name ? "#eef2ff" : "#fff" }}
                    >
                      <Text style={{ color: value === item.location_name ? "#4338ca" : "#1f2937", fontSize: 15, fontWeight: value === item.location_name ? "600" : "400" }}>
                        {value === item.location_name ? "✓  " : "    "}{item.location_name}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={{ padding: 24, color: "#9ca3af", textAlign: "center" }}>
                      {searchable && search.trim() ? "No matches found" : "No options available"}
                    </Text>
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

