import { io, type Socket } from "socket.io-client";

import { getAccessToken } from "@/lib/auth/access-token";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/realtime/types";

export type InTouchSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const createRealtimeClient = (): InTouchSocket =>
  io(process.env.NEXT_PUBLIC_SOCKET_ORIGIN ?? "http://localhost:3000", {
    autoConnect: false,
    auth: (setAuth) => {
      setAuth({ accessToken: getAccessToken() });
    },
  });
