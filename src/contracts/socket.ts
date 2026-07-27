import type { Server } from "socket.io";

import type { MessageRecord } from "./message.js";

export type ClientToServerEvents = Record<string, never>;

export interface ServerToClientEvents {
  message: (message: MessageRecord) => void;
}

export type InterServerEvents = Record<string, never>;

export type SocketData = Record<string, never>;

export type InTouchSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
