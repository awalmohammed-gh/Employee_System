import { Server } from "socket.io";

let ioInstance = null;

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  ioInstance.on("connection", (socket) => {
    // Client joins room for targeted real-time updates
    socket.on("join", (data) => {
      try {
        const userId = typeof data === "object" ? data?.userId || data?.id || data?.employeeId : data;
        const role = typeof data === "object" ? data?.role : null;
        if (userId) {
          socket.join(String(userId));
          socket.join(`user_${userId}`);
        }
        if (role) {
          socket.join(role);
          socket.join(`role_${role}`);
        }
      } catch (err) {
        console.warn("Socket join error:", err.message);
      }
    });

    socket.on("subscribe_leaves", (data) => {
      const userId = typeof data === "object" ? data?.userId || data?.id || data?.employeeId : data;
      if (userId) {
        socket.join(String(userId));
      }
    });

    socket.on("disconnect", () => {
      // Clean disconnect
    });
  });

  return ioInstance;
};

export const getIO = () => {
  return ioInstance;
};

export const emitToEmployee = (employeeId, eventName, payload) => {
  if (!ioInstance) return;
  try {
    const empIdStr = String(employeeId || "");
    if (empIdStr) {
      ioInstance.to(empIdStr).to(`user_${empIdStr}`).emit(eventName, payload);
    }
    // Also broadcast so listening clients can filter if necessary
    ioInstance.emit(eventName, { ...payload, targetEmployeeId: empIdStr });
  } catch (err) {
    console.warn("Socket emit error:", err.message);
  }
};

export const emitToAll = (eventName, payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.emit(eventName, payload);
  } catch (err) {
    console.warn("Socket emitToAll error:", err.message);
  }
};
