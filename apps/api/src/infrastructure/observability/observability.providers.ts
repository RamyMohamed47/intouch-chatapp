import type { MailTransport } from "../../modules/mail/mail.types.js";
import type { ObjectStorage } from "../../modules/uploads/upload.types.js";
import type { VoiceMediaProvider } from "../../modules/voice/index.js";
import { getObservabilityMetrics } from "./observability.metrics.js";

const timed = async <T>(
  provider: string,
  operation: string,
  work: () => Promise<T>,
) => {
  const startedAt = performance.now();
  try {
    const result = await work();
    getObservabilityMetrics().recordProviderOperation({
      durationSeconds: (performance.now() - startedAt) / 1_000,
      operation,
      provider,
      result: "success",
    });
    return result;
  } catch (error) {
    getObservabilityMetrics().recordProviderOperation({
      durationSeconds: (performance.now() - startedAt) / 1_000,
      operation,
      provider,
      result: "failure",
    });
    throw error;
  }
};

export const instrumentMailTransport = (
  transport: MailTransport,
  provider: string,
): MailTransport => ({
  close: () => transport.close(),
  send: (mail) => timed(provider, "mail.send", () => transport.send(mail)),
});

export const instrumentObjectStorage = (
  storage: ObjectStorage,
  provider: string,
): ObjectStorage => ({
  createAccessUrl: (key, expiresInSeconds) =>
    timed(provider, "storage.access_url", () =>
      storage.createAccessUrl(key, expiresInSeconds),
    ),
  createUploadUrl: (key, contentType, expiresInSeconds) =>
    timed(provider, "storage.upload_url", () =>
      storage.createUploadUrl(key, contentType, expiresInSeconds),
    ),
  deleteObjects: (keys) =>
    timed(provider, "storage.delete", () => storage.deleteObjects(keys)),
  inspect: (key) =>
    timed(provider, "storage.inspect", () => storage.inspect(key)),
  promote: (input) =>
    timed(provider, "storage.promote", () => storage.promote(input)),
});

export const instrumentVoiceMediaProvider = (
  media: VoiceMediaProvider,
  provider: string,
): VoiceMediaProvider => ({
  closeRoom: (providerRoomId) =>
    timed(provider, "voice.close_room", () => media.closeRoom(providerRoomId)),
  createJoinCredentials: (input) =>
    timed(provider, "voice.create_credentials", () =>
      media.createJoinCredentials(input),
    ),
  listParticipantIdentities: (providerRoomId) =>
    timed(provider, "voice.list_participants", () =>
      media.listParticipantIdentities(providerRoomId),
    ),
  muteParticipant: (providerRoomId, participantIdentity) =>
    timed(provider, "voice.mute_participant", () =>
      media.muteParticipant(providerRoomId, participantIdentity),
    ),
  parseWebhook: (body, authorization) =>
    timed(provider, "voice.parse_webhook", () =>
      media.parseWebhook(body, authorization),
    ),
  removeParticipant: (providerRoomId, participantIdentity) =>
    timed(provider, "voice.remove_participant", () =>
      media.removeParticipant(providerRoomId, participantIdentity),
    ),
});
