import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";

const settingsGroups = [
  {
    title: "Account",
    items: [
      { icon: "👤", label: "Profile", sub: "Manage your account details" },
      { icon: "🔒", label: "Change Password", sub: "Update your password" },
    ],
  },
  {
    title: "Printing",
    items: [
      { icon: "🖨️", label: "Bluetooth Printer", sub: "Connect & manage printers" },
      { icon: "🧾", label: "Invoice Template", sub: "Customize print layout" },
    ],
  },
  {
    title: "App",
    items: [
      { icon: "🌐", label: "Language", sub: "English" },
      { icon: "🌙", label: "Dark Mode", sub: "Off" },
      { icon: "ℹ️", label: "About", sub: "JBS Marketing v1.0.0" },
    ],
  },
];

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

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="bg-primary-700 px-6 pt-4 pb-10">
        <Text className="text-white text-xl font-bold">Settings</Text>
      </View>

      <ScrollView
        className="-mt-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View className="mx-4 bg-card rounded-2xl shadow-sm p-4 flex-row items-center mb-4">
          <View className="w-14 h-14 rounded-2xl bg-primary-100 items-center justify-center mr-4">
            <Text className="text-primary-700 font-bold text-xl">JB</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-800 font-bold text-base">JBS Admin</Text>
            <Text className="text-gray-400 text-sm mt-0.5">
              {user?.email ?? "admin@jbsmarketing.app"}
            </Text>
          </View>
          <View className="bg-primary-50 px-3 py-1.5 rounded-xl">
            <Text className="text-primary-700 text-xs font-semibold">Admin</Text>
          </View>
        </View>

        {settingsGroups.map((group) => (
          <View key={group.title} className="mx-4 mb-4">
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2 ml-1">
              {group.title}
            </Text>
            <View className="bg-card rounded-2xl shadow-sm overflow-hidden">
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  className={`flex-row items-center px-4 py-4 ${
                    i < group.items.length - 1 ? "border-b border-gray-50" : ""
                  }`}
                >
                  <View className="w-9 h-9 rounded-xl bg-primary-50 items-center justify-center mr-3">
                    <Text className="text-base">{item.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-800 font-medium text-sm">
                      {item.label}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5">{item.sub}</Text>
                  </View>
                  <Text className="text-gray-300 text-lg">›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="mx-4 bg-red-50 rounded-2xl py-4 items-center flex-row justify-center"
        >
          <Text className="text-lg mr-2">🚪</Text>
          <Text className="text-red-500 font-semibold">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
