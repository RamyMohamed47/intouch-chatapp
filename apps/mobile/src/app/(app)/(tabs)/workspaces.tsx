import { OrganizationVisibility } from "@intouch/shared/organizations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MainScreenHeader } from "@/components/app-shell";
import { Button, Card, Field, Muted } from "@/components/ui/controls";
import { OrganizationAvatar } from "@/components/organization-avatar";
import { Screen } from "@/components/ui/screen";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { organizationsApi } from "@/features/organizations/organizations-api";
import { useWorkspace } from "@/features/organizations/workspace-provider";
import {
  prepareSquareImage,
  uploadFiles,
  type LocalUploadFile,
} from "@/features/uploads/upload-client";

export default function WorkspacesScreen() {
  const { theme } = useAppearance();
  const { activeOrganizationId, setActiveOrganizationId } = useWorkspace();
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<LocalUploadFile | null>(null);
  const [logoUploadId, setLogoUploadId] = useState<string | null>(null);
  const [logoProgress, setLogoProgress] = useState(0);
  const queryClient = useQueryClient();
  const organizations = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
  });
  const invitations = useQuery({
    queryKey: ["invitations"],
    queryFn: () => organizationsApi.invitations(),
  });
  const create = useMutation({
    mutationFn: async () => {
      let uploadId = logoUploadId;
      if (logoFile && !uploadId) {
        const [completedUploadId] = await uploadFiles(
          { purpose: "ORGANIZATION_LOGO", files: [logoFile] },
          (_index, progress) => setLogoProgress(progress),
        );
        uploadId = completedUploadId ?? null;
        setLogoUploadId(uploadId ?? null);
      }
      return organizationsApi.create({
        name,
        visibility: OrganizationVisibility.PRIVATE,
        ...(uploadId ? { logoUploadId: uploadId } : {}),
      });
    },
    onSuccess: async (organization) => {
      setName("");
      setLogoFile(null);
      setLogoUploadId(null);
      setLogoProgress(0);
      setActiveOrganizationId(organization.id);
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const pickLogo = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset?.width || !asset.height) return;
    setLogoFile(await prepareSquareImage(asset.uri, asset.width, asset.height));
    setLogoUploadId(null);
    setLogoProgress(0);
  };
  const respond = async (id: string, accept: boolean) => {
    if (accept) await organizationsApi.acceptInvitation(id);
    else await organizationsApi.declineInvitation(id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["invitations"] }),
      queryClient.invalidateQueries({ queryKey: ["organizations"] }),
    ]);
  };

  return (
    <Screen
      onRefresh={() =>
        void Promise.all([organizations.refetch(), invitations.refetch()])
      }
      refreshing={organizations.isRefetching || invitations.isRefetching}
    >
      <MainScreenHeader
        subtitle="Select where you want to collaborate or create a new workspace."
        title="Workspaces"
      />

      {organizations.data?.map((organization) => (
        <Pressable
          accessibilityState={{
            selected: activeOrganizationId === organization.id,
          }}
          key={organization.id}
          onPress={() => setActiveOrganizationId(organization.id)}
        >
          <Card>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <OrganizationAvatar
                logoAssetId={organization.logoAssetId}
                name={organization.name}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}
                >
                  {organization.name}
                </Text>
                <Muted>
                  {organization.currentUserRole ?? "Public workspace"}
                </Muted>
              </View>
              {organization.currentUserRole ? (
                <Button
                  onPress={() => router.push(`/workspace/${organization.id}`)}
                  variant="ghost"
                >
                  Manage
                </Button>
              ) : null}
            </View>
          </Card>
        </Pressable>
      ))}

      <Text
        style={{
          color: theme.muted,
          fontFamily: "monospace",
          letterSpacing: 1.5,
        }}
      >
        CREATE
      </Text>
      <Card>
        <Field label="Workspace name" onChangeText={setName} value={name} />
        <Button
          disabled={create.isPending}
          onPress={() => void pickLogo()}
          variant="secondary"
        >
          {logoFile || logoUploadId ? "Replace selected logo" : "Add a logo"}
        </Button>
        {logoFile || logoUploadId ? (
          <Button
            disabled={create.isPending}
            onPress={() => {
              setLogoFile(null);
              setLogoUploadId(null);
              setLogoProgress(0);
            }}
            variant="ghost"
          >
            Remove selected logo
          </Button>
        ) : null}
        {create.isPending && logoFile ? (
          <Muted>Uploading logo {Math.round(logoProgress * 100)}%</Muted>
        ) : null}
        {create.isError ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: theme.danger }}
          >
            {create.error instanceof Error
              ? create.error.message
              : "Workspace creation failed"}
          </Text>
        ) : null}
        <Button
          disabled={!name.trim() || create.isPending}
          onPress={() => create.mutate()}
        >
          {create.isPending ? "Creating..." : "Create workspace"}
        </Button>
      </Card>

      {invitations.data?.length ? (
        <Text
          style={{
            color: theme.muted,
            fontFamily: "monospace",
            letterSpacing: 1.5,
          }}
        >
          INVITATIONS
        </Text>
      ) : null}
      {invitations.data?.map((invitation) => (
        <Card key={invitation.id}>
          <View style={styles.invitationIdentity}>
            <OrganizationAvatar
              logoAssetId={invitation.organization.logoAssetId}
              name={invitation.organization.name}
            />
            <Text
              style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}
            >
              {invitation.organization.name}
            </Text>
          </View>
          <Muted>Pending workspace invitation</Muted>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button onPress={() => void respond(invitation.id, true)}>
                Accept
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => void respond(invitation.id, false)}
                variant="secondary"
              >
                Decline
              </Button>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = {
  invitationIdentity: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: 12,
  },
};
