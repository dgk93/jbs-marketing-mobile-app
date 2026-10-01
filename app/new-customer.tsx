import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabase";

export default function NewCustomerScreen() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter customer / shop name");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("locations").insert([
        {
          location_name: name.trim(),
          location_type: "shop",
          mobile: mobile.trim() ? Number(mobile.trim()) : null,
          address: address.trim() || null,
        },
      ]);

      if (error) throw error;

      Alert.alert("Success", "Customer added successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.error("Error adding customer:", err);
      Alert.alert("Error", err.message || "Failed to add customer");
    } finally {
      setSaving(false);
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
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>New Customer</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Shop / Customer Name *</Text>
            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: "#1f2937",
              }}
              placeholder="Enter name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
            />
          </View>
          <View>
            <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Mobile</Text>
            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: "#1f2937",
              }}
              placeholder="e.g. 0771234567"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
            />
          </View>
          <View>
            <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Address</Text>
            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: "#1f2937",
                minHeight: 90,
                textAlignVertical: "top",
              }}
              placeholder="Optional address"
              placeholderTextColor="#9ca3af"
              multiline
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              marginTop: 8,
              backgroundColor: saving ? "#9ca3af" : "#4f46e5",
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {saving ? "Saving..." : "Save Customer"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
