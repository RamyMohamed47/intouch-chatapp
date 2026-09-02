import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
} from "livekit-server-sdk";

import { VoiceUnavailableError } from "./voice.errors.js";
import type { VoiceWebhookEvent } from "./voice.types.js";

export interface VoiceJoinCredentials {
  serverUrl: string;
  token: string;
  expiresAt: Date;
}

export interface VoiceMediaProvider {
  closeRoom(providerRoomId: string): Promise<void>;
  createJoinCredentials(input: {
    providerRoomId: string;
    participantIdentity: string;
    capacity: number;
  }): Promise<VoiceJoinCredentials>;
  listParticipantIdentities(providerRoomId: string): Promise<string[]>;
  muteParticipant(
    providerRoomId: string,
    participantIdentity: string,
  ): Promise<void>;
  parseWebhook(
    body: string,
    authorization?: string,
  ): Promise<VoiceWebhookEvent>;
  removeParticipant(
    providerRoomId: string,
    participantIdentity: string,
  ): Promise<void>;
}

export const createDisabledVoiceMediaProvider = (): VoiceMediaProvider => {
  const unavailable = <T>(): Promise<T> =>
    Promise.reject(new VoiceUnavailableError());
  return {
    closeRoom: () => unavailable(),
    createJoinCredentials: () => unavailable(),
    listParticipantIdentities: () => unavailable(),
    muteParticipant: () => unavailable(),
    parseWebhook: () => unavailable(),
    removeParticipant: () => unavailable(),
  };
};

export interface LiveKitVoiceMediaProviderConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
}

const toApiUrl = (url: string) =>
  url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

export const createLiveKitVoiceMediaProvider = (
  config: LiveKitVoiceMediaProviderConfig,
): VoiceMediaProvider => {
  const rooms = new RoomServiceClient(
    toApiUrl(config.url),
    config.apiKey,
    config.apiSecret,
  );
  const webhooks = new WebhookReceiver(config.apiKey, config.apiSecret);

  return {
    async createJoinCredentials({
      providerRoomId,
      participantIdentity,
      capacity,
    }) {
      await rooms.createRoom({
        name: providerRoomId,
        maxParticipants: capacity,
        emptyTimeout: 60,
        departureTimeout: 10,
      });
      const token = new AccessToken(config.apiKey, config.apiSecret, {
        identity: participantIdentity,
        ttl: 300,
      });
      token.addGrant({
        room: providerRoomId,
        roomJoin: true,
        canPublish: true,
        canPublishData: false,
        canPublishSources: [TrackSource.MICROPHONE],
        canSubscribe: true,
      });
      return {
        serverUrl: config.url,
        token: await token.toJwt(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    },
    async listParticipantIdentities(providerRoomId) {
      try {
        return (await rooms.listParticipants(providerRoomId)).map(
          ({ identity }) => identity,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          /not found|does not exist/i.test(error.message)
        ) {
          return [];
        }
        throw error;
      }
    },
    async removeParticipant(providerRoomId, participantIdentity) {
      try {
        await rooms.removeParticipant(providerRoomId, participantIdentity);
      } catch (error) {
        if (
          error instanceof Error &&
          /not found|does not exist/i.test(error.message)
        ) {
          return;
        }
        throw error;
      }
    },
    async muteParticipant(providerRoomId, participantIdentity) {
      const participant = await rooms.getParticipant(
        providerRoomId,
        participantIdentity,
      );
      const microphoneTracks = participant.tracks.filter(
        ({ source }) => source === TrackSource.MICROPHONE,
      );
      await Promise.all(
        microphoneTracks.map(({ sid }) =>
          rooms.mutePublishedTrack(
            providerRoomId,
            participantIdentity,
            sid,
            true,
          ),
        ),
      );
    },
    async closeRoom(providerRoomId) {
      try {
        await rooms.deleteRoom(providerRoomId);
      } catch (error) {
        if (
          error instanceof Error &&
          /not found|does not exist/i.test(error.message)
        ) {
          return;
        }
        throw error;
      }
    },
    async parseWebhook(body, authorization) {
      const event = await webhooks.receive(body, authorization);
      const kind = [
        "participant_joined",
        "participant_left",
        "participant_connection_aborted",
        "room_finished",
      ].includes(event.event)
        ? (event.event as VoiceWebhookEvent["kind"])
        : "other";
      return {
        id: event.id,
        kind,
        providerRoomId: event.room?.name || null,
        participantIdentity: event.participant?.identity || null,
      };
    },
  };
};
