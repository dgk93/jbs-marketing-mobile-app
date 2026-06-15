import { Tabs } from "expo-router";
import { View, Text } from "react-native";

function TabIcon({ label, focused, icon }: { label: string; focused: boolean; icon: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{icon}</Text>
      <Text style={{ fontSize: 11, marginTop: 2, fontWeight: "600", color: focused ? "#4f46e5" : "#9ca3af" }}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#e5e7eb", height: 64, paddingBottom: 8 }, tabBarShowLabel: false }}>
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} icon="🏠" /> }} />
      <Tabs.Screen name="invoices" options={{ tabBarIcon: ({ focused }) => <TabIcon label="Invoices" focused={focused} icon="🧾" /> }} />
      <Tabs.Screen name="add" options={{
        tabBarIcon: ({ focused }) => (
          <View style={{ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 20, backgroundColor: focused ? "#4338ca" : "#4f46e5", shadowColor: "#4f46e5", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 }}>+</Text>
          </View>
        )
      }} />
      <Tabs.Screen name="items" options={{ tabBarIcon: ({ focused }) => <TabIcon label="Items" focused={focused} icon="📦" /> }} />
      <Tabs.Screen name="settings" options={{ tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} icon="⚙️" /> }} />
    </Tabs>
  );
}
