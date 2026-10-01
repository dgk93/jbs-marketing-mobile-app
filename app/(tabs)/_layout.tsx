import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Home, FileText, Package, Settings, Plus } from "lucide-react-native";

function TabIcon({
  label,
  focused,
  Icon,
}: {
  label: string;
  focused: boolean;
  Icon: LucideIcon;
}) {
  const color = focused ? "#4f46e5" : "#9ca3af";
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
      <Text style={{ fontSize: 11, marginTop: 2, fontWeight: "600", color }}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#e5e7eb", height: 64, paddingBottom: 8 },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} Icon={Home} /> }}
      />
      <Tabs.Screen
        name="invoices"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Invoices" focused={focused} Icon={FileText} /> }}
      />
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                backgroundColor: focused ? "#4338ca" : "#4f46e5",
                shadowColor: "#4f46e5",
                shadowOpacity: 0.4,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Plus size={28} color="#fff" strokeWidth={2.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Items" focused={focused} Icon={Package} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} Icon={Settings} /> }}
      />
    </Tabs>
  );
}
