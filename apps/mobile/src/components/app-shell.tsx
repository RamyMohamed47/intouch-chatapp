import { useQuery } from "@tanstack/react-query";
import { router, useNavigation, usePathname } from "expo-router";
import {
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from "expo-router/drawer";
import { Menu, MessageCircle, UserRound, Warehouse } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { OrganizationAvatar } from "@/components/organization-avatar";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { organizationsApi } from "@/features/organizations/organizations-api";
import { useWorkspace } from "@/features/organizations/workspace-provider";

interface NestedNavigation {
  getParent: () => { openDrawer: () => void } | undefined;
}

export const MainScreenHeader = ({
  subtitle,
  title,
}: {
  subtitle?: string;
  title: string;
}) => {
  const { theme } = useAppearance();
  const navigation = useNavigation<NestedNavigation>();

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Open navigation menu"
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => navigation.getParent()?.openDrawer()}
        style={({ pressed }) => [
          styles.menuButton,
          { backgroundColor: theme.panelStrong, borderColor: theme.border },
          pressed && styles.pressed,
        ]}
      >
        <Menu color={theme.text} size={22} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: theme.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export const AppDrawerContent = (props: DrawerContentComponentProps) => {
  const { theme } = useAppearance();
  const pathname = usePathname();
  const { activeOrganizationId } = useWorkspace();
  const organizations = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
  });
  const activeOrganization = organizations.data?.find(
    ({ id }) => id === activeOrganizationId,
  );

  const navigate = (path: "/chats" | "/workspaces" | "/profile") => {
    props.navigation.closeDrawer();
    router.navigate(path);
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.drawer,
        { backgroundColor: theme.background },
      ]}
    >
      <View style={[styles.brand, { borderBottomColor: theme.border }]}>
        <Text style={[styles.brandName, { color: theme.text }]}>InTouch</Text>
        <Text style={[styles.brandTagline, { color: theme.muted }]}>
          Mobile
        </Text>
      </View>

      <View
        accessibilityLabel={
          activeOrganization
            ? `Current workspace ${activeOrganization.name}`
            : "No workspace selected"
        }
        style={[
          styles.workspace,
          { backgroundColor: theme.panel, borderColor: theme.border },
        ]}
      >
        <OrganizationAvatar
          logoAssetId={activeOrganization?.logoAssetId ?? null}
          name={activeOrganization?.name ?? "No workspace"}
          size={48}
        />
        <View style={styles.workspaceCopy}>
          <Text style={[styles.workspaceLabel, { color: theme.muted }]}>
            CURRENT WORKSPACE
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.workspaceName, { color: theme.text }]}
          >
            {activeOrganization?.name ?? "Choose a workspace"}
          </Text>
        </View>
      </View>

      <View style={styles.items}>
        <DrawerItem
          focused={pathname === "/chats"}
          icon={({ color, size }) => (
            <MessageCircle color={color} size={size} />
          )}
          label="Chats"
          labelStyle={styles.itemLabel}
          onPress={() => navigate("/chats")}
          activeTintColor={theme.accent}
          activeBackgroundColor={theme.accentSoft}
          inactiveTintColor={theme.text}
        />
        <DrawerItem
          focused={pathname === "/workspaces"}
          icon={({ color, size }) => <Warehouse color={color} size={size} />}
          label="Workspaces"
          labelStyle={styles.itemLabel}
          onPress={() => navigate("/workspaces")}
          activeTintColor={theme.accent}
          activeBackgroundColor={theme.accentSoft}
          inactiveTintColor={theme.text}
        />
        <DrawerItem
          focused={pathname === "/profile"}
          icon={({ color, size }) => <UserRound color={color} size={size} />}
          label="Profile"
          labelStyle={styles.itemLabel}
          onPress={() => navigate("/profile")}
          activeTintColor={theme.accent}
          activeBackgroundColor={theme.accentSoft}
          inactiveTintColor={theme.text}
        />
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawer: { flexGrow: 1, paddingHorizontal: 14 },
  brand: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 18,
    paddingTop: 10,
  },
  brandName: { fontSize: 27, fontWeight: "900", letterSpacing: -1 },
  brandTagline: {
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 2,
    textTransform: "uppercase",
  },
  workspace: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 4,
    marginTop: 18,
    padding: 13,
  },
  workspaceCopy: { flex: 1, gap: 3 },
  workspaceLabel: { fontFamily: "monospace", fontSize: 10, letterSpacing: 1 },
  workspaceName: { fontSize: 16, fontWeight: "900" },
  items: { gap: 4, marginTop: 18 },
  itemLabel: { fontSize: 15, fontWeight: "800" },
  header: { alignItems: "center", flexDirection: "row", gap: 13 },
  menuButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  headerCopy: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  headerSubtitle: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.72 },
});
