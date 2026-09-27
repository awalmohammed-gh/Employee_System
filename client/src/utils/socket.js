import { io } from "socket.io-client";

let socket = null;

export const getSocket = () => {
  if (!socket) {
    // In browser, connects to window.location.origin (same host & port 3000)
    socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("[Socket.io] Connected to server:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.io] Disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.warn("[Socket.io] Connection error:", error.message);
    });
  }

  return socket;
};

export const registerSocketUser = (userId, role = "employee") => {
  const s = getSocket();
  if (s && userId) {
    if (s.connected) {
      s.emit("join_room", { employeeId: userId, role });
    } else {
      s.once("connect", () => {
        s.emit("join_room", { employeeId: userId, role });
      });
    }
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default getSocket;
