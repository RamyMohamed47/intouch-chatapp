import {
  ChannelKind,
  ConversationVisibility,
  type ChannelConversationDto,
  type ConversationVisibilityType,
} from "@intouch/shared/conversations";
import { MembershipRole } from "@intouch/shared/memberships";
import {
  OrganizationVisibility,
  type OrganizationVisibility as OrganizationVisibilityValue,
} from "@intouch/shared/organizations";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import {
  BackButton,
  Button,
  Card,
  Field,
  Heading,
  Muted,
} from "@/components/ui/controls";
import { OrganizationAvatar } from "@/components/organization-avatar";
import { Screen } from "@/components/ui/screen";
import { UserAvatar } from "@/components/user-avatar";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { conversationsApi } from "@/features/conversations/conversations-api";
import { organizationsApi } from "@/features/organizations/organizations-api";
import { useWorkspace } from "@/features/organizations/workspace-provider";
import {
  prepareSquareImage,
  uploadFiles,
} from "@/features/uploads/upload-client";
import { uploadsApi } from "@/features/uploads/uploads-api";

export default function WorkspaceDetailScreen() {
  const { organizationId = "" } = useLocalSearchParams<{
    organizationId: string;
  }>();
  const { theme } = useAppearance();
  const { user } = useAuth();
  const { setActiveOrganizationId } = useWorkspace();
  const queryClient = useQueryClient();
  const [categoryName, setCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelVisibility, setChannelVisibility] =
    useState<ConversationVisibilityType>(ConversationVisibility.PUBLIC);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceVisibility, setWorkspaceVisibility] =
    useState<OrganizationVisibilityValue>(OrganizationVisibility.PRIVATE);
  const [managedChannelId, setManagedChannelId] = useState("");
  const [managedChannelName, setManagedChannelName] = useState("");
  const [managedChannelVisibility, setManagedChannelVisibility] =
    useState<ConversationVisibilityType>(ConversationVisibility.PUBLIC);
  const [inviteEmail, setInviteEmail] = useState("");
  const organization = useQuery({
    queryKey: ["organizations", organizationId],
    queryFn: () => organizationsApi.get(organizationId),
  });
  const members = useQuery({
    queryKey: ["organizations", organizationId, "members"],
    queryFn: () => organizationsApi.members(organizationId),
  });
  const categories = useQuery({
    queryKey: ["organizations", organizationId, "categories"],
    queryFn: () => organizationsApi.categories(organizationId),
  });
  const channels = useQuery({
    queryKey: ["organizations", organizationId, "conversations", "channels"],
    queryFn: () => conversationsApi.channels(organizationId),
  });
  const isOwner = organization.data?.currentUserRole === MembershipRole.OWNER;
  const managedChannel = channels.data?.find(
    (channel): channel is ChannelConversationDto =>
      channel.type === "CHANNEL" && channel.id === managedChannelId,
  );
  const participants = useQuery({
    queryKey: ["conversations", managedChannelId, "participants"],
    queryFn: () => conversationsApi.participants(managedChannelId),
    enabled:
      isOwner &&
      Boolean(managedChannelId) &&
      managedChannel?.visibility === ConversationVisibility.PRIVATE,
  });

  useEffect(() => {
    if (!organization.data) return;
    setWorkspaceName(organization.data.name);
    setWorkspaceVisibility(organization.data.visibility);
  }, [organization.data]);

  useEffect(() => {
    const selected = categories.data?.find(
      (category) => category.id === selectedCategoryId,
    );
    if (selected) return;
    const first = categories.data?.[0];
    setSelectedCategoryId(first?.id ?? "");
    setSelectedCategoryName(first?.name ?? "");
  }, [categories.data, selectedCategoryId]);
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };
  const createCategory = useMutation({
    mutationFn: () =>
      organizationsApi.createCategory(organizationId, { name: categoryName }),
    onSuccess: async () => {
      setCategoryName("");
      await invalidate();
    },
  });
  const createChannel = useMutation({
    mutationFn: () => {
      if (!selectedCategoryId) throw new Error("Create a category first");
      return conversationsApi.createChannel(organizationId, {
        categoryId: selectedCategoryId,
        name: channelName,
        kind: ChannelKind.TEXT,
        visibility: channelVisibility,
      });
    },
    onSuccess: async () => {
      setChannelName("");
      await invalidate();
    },
  });

  const saveWorkspace = useMutation({
    mutationFn: () =>
      organizationsApi.update(organizationId, {
        name: workspaceName,
        visibility: workspaceVisibility,
      }),
    onSuccess: invalidate,
  });

  const saveCategory = useMutation({
    mutationFn: () =>
      organizationsApi.updateCategory(organizationId, selectedCategoryId, {
        name: selectedCategoryName,
      }),
    onSuccess: invalidate,
  });

  const deleteCategory = () => {
    Alert.alert("Delete category?", "Only an empty category can be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void organizationsApi
            .removeCategory(organizationId, selectedCategoryId)
            .then(async () => {
              setSelectedCategoryId("");
              setSelectedCategoryName("");
              await invalidate();
            }),
      },
    ]);
  };

  const manageChannel = (channel: ChannelConversationDto) => {
    setManagedChannelId(channel.id);
    setManagedChannelName(channel.name);
    setManagedChannelVisibility(channel.visibility);
  };

  const saveChannel = useMutation({
    mutationFn: () =>
      conversationsApi.update(managedChannelId, {
        name: managedChannelName,
        visibility: managedChannelVisibility,
      }),
    onSuccess: invalidate,
  });

  const deleteChannel = () => {
    Alert.alert(
      "Delete channel?",
      "Its message history and private assets will be scheduled for deletion.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void conversationsApi.remove(managedChannelId).then(async () => {
              setManagedChannelId("");
              await invalidate();
            }),
        },
      ],
    );
  };

  const refreshParticipants = () =>
    queryClient.invalidateQueries({
      queryKey: ["conversations", managedChannelId, "participants"],
    });

  const replaceLogo = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
    });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset?.width || !asset.height) return;
    const file = await prepareSquareImage(asset.uri, asset.width, asset.height);
    const [uploadId] = await uploadFiles({
      purpose: "ORGANIZATION_LOGO",
      files: [file],
    });
    if (uploadId)
      await uploadsApi.setOrganizationLogo(organizationId, uploadId);
    await invalidate();
  };

  const openDirectMessage = async (recipientUserId: string) => {
    const direct = await conversationsApi.createDirectMessage(organizationId, {
      recipientUserId,
    });
    router.push(`/conversation/${direct.id}`);
  };

  const removeWorkspace = () => {
    Alert.alert(
      "Delete workspace?",
      "Messages, channels, and private assets will be scheduled for deletion.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void organizationsApi.remove(organizationId).then(async () => {
              setActiveOrganizationId(null);
              await invalidate();
              router.replace("/workspaces");
            }),
        },
      ],
    );
  };

  return (
    <Screen
      onRefresh={() =>
        void Promise.all([
          organization.refetch(),
          members.refetch(),
          categories.refetch(),
          channels.refetch(),
        ])
      }
      refreshing={organization.isRefetching || members.isRefetching}
    >
      <BackButton onPress={() => router.back()} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <OrganizationAvatar
          logoAssetId={organization.data?.logoAssetId ?? null}
          name={organization.data?.name ?? "Workspace"}
          size={58}
        />
        <View style={{ flex: 1 }}>
          <Heading>{organization.data?.name ?? "Workspace"}</Heading>
          <Muted>{organization.data?.visibility} workspace</Muted>
        </View>
      </View>

      {isOwner ? (
        <Card>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>
            Identity
          </Text>
          <Button onPress={() => void replaceLogo()} variant="secondary">
            Replace logo
          </Button>
          {organization.data?.logoAssetId ? (
            <Button
              onPress={() =>
                void uploadsApi.removeOrganizationLogo(organizationId)
              }
              variant="ghost"
            >
              Remove logo
            </Button>
          ) : null}
          <Field
            label="Workspace name"
            onChangeText={setWorkspaceName}
            value={workspaceName}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {Object.values(OrganizationVisibility).map((visibility) => (
              <View key={visibility} style={{ flex: 1 }}>
                <Button
                  onPress={() => setWorkspaceVisibility(visibility)}
                  variant={
                    workspaceVisibility === visibility ? "primary" : "secondary"
                  }
                >
                  {visibility === OrganizationVisibility.PUBLIC
                    ? "Public"
                    : "Private"}
                </Button>
              </View>
            ))}
          </View>
          <Button
            disabled={!workspaceName.trim() || saveWorkspace.isPending}
            onPress={() => saveWorkspace.mutate()}
          >
            {saveWorkspace.isPending ? "Saving..." : "Save workspace"}
          </Button>
          <Field
            label="Invite by email"
            onChangeText={setInviteEmail}
            value={inviteEmail}
          />
          <Button
            disabled={!inviteEmail.trim()}
            onPress={() =>
              void organizationsApi
                .invite(organizationId, { email: inviteEmail })
                .then(() => setInviteEmail(""))
            }
          >
            Send invitation
          </Button>
        </Card>
      ) : null}

      {isOwner ? (
        <Card>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>
            Structure
          </Text>
          <Field
            label="New category"
            onChangeText={setCategoryName}
            value={categoryName}
          />
          <Button
            disabled={!categoryName.trim()}
            onPress={() => createCategory.mutate()}
            variant="secondary"
          >
            Add category
          </Button>
          {categories.data?.length ? (
            <>
              <Muted>Select the category used for channel creation.</Muted>
              <View style={{ gap: 8 }}>
                {categories.data.map((category) => (
                  <Button
                    key={category.id}
                    onPress={() => {
                      setSelectedCategoryId(category.id);
                      setSelectedCategoryName(category.name);
                    }}
                    variant={
                      selectedCategoryId === category.id
                        ? "primary"
                        : "secondary"
                    }
                  >
                    {category.name}
                  </Button>
                ))}
              </View>
              <Field
                label="Selected category name"
                onChangeText={setSelectedCategoryName}
                value={selectedCategoryName}
              />
              <Button
                disabled={
                  !selectedCategoryName.trim() || saveCategory.isPending
                }
                onPress={() => saveCategory.mutate()}
                variant="secondary"
              >
                Save category
              </Button>
              <Button destructive onPress={deleteCategory}>
                Delete selected category
              </Button>
            </>
          ) : null}
          <Field
            label="New text channel"
            onChangeText={setChannelName}
            value={channelName}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {Object.values(ConversationVisibility).map((visibility) => (
              <View key={visibility} style={{ flex: 1 }}>
                <Button
                  onPress={() => setChannelVisibility(visibility)}
                  variant={
                    channelVisibility === visibility ? "primary" : "secondary"
                  }
                >
                  {visibility === ConversationVisibility.PUBLIC
                    ? "Public"
                    : "Private"}
                </Button>
              </View>
            ))}
          </View>
          <Button
            disabled={!channelName.trim() || !categories.data?.length}
            onPress={() => createChannel.mutate()}
          >
            Add text channel
          </Button>
        </Card>
      ) : null}

      <Text
        style={{
          color: theme.muted,
          fontFamily: "monospace",
          letterSpacing: 1.5,
        }}
      >
        CHANNELS
      </Text>
      {channels.data?.map((channel) => (
        <Card key={channel.id}>
          <Text style={{ color: theme.text, fontWeight: "800" }}>
            {channel.type === "CHANNEL" ? channel.name : "Direct message"}
          </Text>
          <Muted>
            {channel.type === "CHANNEL" && channel.kind === "VOICE"
              ? "Voice is available on web"
              : "Text channel"}
          </Muted>
          {channel.type === "CHANNEL" && channel.kind === ChannelKind.TEXT ? (
            <Button
              onPress={() => router.push(`/conversation/${channel.id}`)}
              variant="secondary"
            >
              Open channel
            </Button>
          ) : null}
          {isOwner && channel.type === "CHANNEL" ? (
            <Button onPress={() => manageChannel(channel)} variant="ghost">
              Manage channel
            </Button>
          ) : null}
        </Card>
      ))}

      {isOwner && managedChannel ? (
        <Card>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>
            Manage {managedChannel.name}
          </Text>
          <Muted>
            The {managedChannel.kind.toLowerCase()} channel kind cannot change.
          </Muted>
          <Field
            label="Channel name"
            onChangeText={setManagedChannelName}
            value={managedChannelName}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {Object.values(ConversationVisibility).map((visibility) => (
              <View key={visibility} style={{ flex: 1 }}>
                <Button
                  onPress={() => setManagedChannelVisibility(visibility)}
                  variant={
                    managedChannelVisibility === visibility
                      ? "primary"
                      : "secondary"
                  }
                >
                  {visibility === ConversationVisibility.PUBLIC
                    ? "Public"
                    : "Private"}
                </Button>
              </View>
            ))}
          </View>
          <Button
            disabled={!managedChannelName.trim() || saveChannel.isPending}
            onPress={() => saveChannel.mutate()}
          >
            Save channel
          </Button>
          {managedChannel.visibility === ConversationVisibility.PRIVATE ? (
            <>
              <Text style={{ color: theme.text, fontWeight: "800" }}>
                Private participants
              </Text>
              {participants.data?.map((participant) => (
                <View
                  key={participant.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Muted>{participant.user.displayName}</Muted>
                  <View style={{ flex: 1 }} />
                  <Button
                    onPress={() =>
                      void conversationsApi
                        .removeParticipant(
                          managedChannel.id,
                          participant.userId,
                        )
                        .then(refreshParticipants)
                    }
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </View>
              ))}
              {members.data
                ?.filter(
                  (member) =>
                    !participants.data?.some(
                      (participant) => participant.userId === member.user.id,
                    ),
                )
                .map((member) => (
                  <View
                    key={member.membershipId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Muted>{member.user.displayName}</Muted>
                    <View style={{ flex: 1 }} />
                    <Button
                      onPress={() =>
                        void conversationsApi
                          .addParticipant(managedChannel.id, {
                            userId: member.user.id,
                          })
                          .then(refreshParticipants)
                      }
                      variant="secondary"
                    >
                      Add
                    </Button>
                  </View>
                ))}
            </>
          ) : null}
          <Button destructive onPress={deleteChannel}>
            Delete channel
          </Button>
          <Button onPress={() => setManagedChannelId("")} variant="ghost">
            Close management
          </Button>
        </Card>
      ) : null}

      <Text
        style={{
          color: theme.muted,
          fontFamily: "monospace",
          letterSpacing: 1.5,
        }}
      >
        MEMBERS
      </Text>
      {members.data
        ?.filter((member) => member.user.id !== user?.id)
        .map((member) => (
          <Pressable
            key={member.membershipId}
            onPress={() => void openDirectMessage(member.user.id)}
          >
            <Card>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <UserAvatar
                  assetId={member.user.avatarAssetId}
                  displayName={member.user.displayName}
                  externalUrl={member.user.avatarUrl}
                  online={member.user.status === "ONLINE"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: "800" }}>
                    {member.user.displayName}
                  </Text>
                  <Muted>{member.role.toLowerCase()}</Muted>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}

      {isOwner ? (
        <Button destructive onPress={removeWorkspace}>
          Delete workspace
        </Button>
      ) : null}
    </Screen>
  );
}
