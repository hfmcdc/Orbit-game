import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../shared/types";

// In dev, Vite proxies /socket.io to the local server (see vite.config.ts).
// In production, the client is served by the same origin as the server,
// so we can simply connect to the current origin.
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SOCKET_URL,
  {
    autoConnect: false,
    transports: ["websocket", "polling"],
  }
);
