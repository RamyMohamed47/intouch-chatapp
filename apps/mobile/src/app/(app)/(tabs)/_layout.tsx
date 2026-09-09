import { Tabs } from "expo-router";
import {
  MessageCircle,
  Sparkles,
  UserRound,
  Warehouse,
} from "lucide-react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";

export default function TabsLayout() {
  const { theme } = useAppearance();
  return (
    <Tabs
      initialRouteName="workspaces"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.panel,
          borderTopColor: theme.border,
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => <MessageCircle color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="workspaces"
        options={{
          title: "Workspaces",
          tabBarIcon: ({ color }) => <Warehouse color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="echo"
        options={{
          title: "Echo",
          tabBarIcon: ({ color }) => <Sparkles color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <UserRound color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
