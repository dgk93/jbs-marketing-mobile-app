import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";

export default function SettingsScreen() {
  const { signOut, user } = useAuth();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  const displayName = user?.name?.trim() || "User";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#4338ca", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Settings</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, marginTop: -20 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 24,
            paddingVertical: 28,
            paddingHorizontal: 24,
            alignItems: "center",
            shadowColor: "#1e1b4b",
            shadowOpacity: 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 3,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: "#eef2ff",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#4338ca", fontWeight: "700", fontSize: 26 }}>{initials || "U"}</Text>
          </View>

          <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" }}>
            Signed in as
          </Text>
          <Text
            style={{
              color: "#111827",
              fontSize: 22,
              fontWeight: "700",
              marginTop: 6,
              textAlign: "center",
            }}
          >
            {displayName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.85}
          style={{
            marginTop: 20,
            backgroundColor: "#fff",
            borderRadius: 20,
            paddingVertical: 16,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#fecaca",
          }}
        >
          <Text style={{ color: "#dc2626", fontWeight: "700", fontSize: 15 }}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
