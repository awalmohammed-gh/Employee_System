
import mongoose from "mongoose";

// Disable command buffering so queries fail fast rather than hanging indefinitely when disconnected
mongoose.set("bufferCommands", false);

// Attach connection event listeners to handle drops and errors gracefully
mongoose.connection.on("error", (err) => {
  console.warn("[MongoDB Event] Connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[MongoDB Event] Connection lost or disconnected.");
});

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const uri = rawUri && typeof rawUri === "string" ? rawUri.trim() : "";

  if (!uri) {
    console.warn("[MongoDB] Notice: Neither MONGODB_URI nor MONGO_URI is set. Database operations will run in offline mode.");
    return null;
  }

  let timeoutId;
  try {
    console.log("[MongoDB] Attempting database connection (5s timeout guard)...");

    const connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      maxPoolSize: 10,
    });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Mongoose connection timed out after 5000ms")), 5000);
    });

    await Promise.race([connectionPromise, timeoutPromise]);
    console.log("[MongoDB] Connected successfully to database.");
    return mongoose.connection;
  } catch (error) {
    console.warn("[MongoDB] Connection warning (running in resilient mode):", error.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Shares one in-flight connection attempt between concurrent callers (used by serverless request handling)
let pendingConnection = null;
export const ensureMongodbConnection = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!pendingConnection) {
    pendingConnection = connectDB().finally(() => {
      pendingConnection = null;
    });
  }
  return pendingConnection;
};

const closeMongodb = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("[MongoDB] Connection closed.");
    }
  } catch (error) {
    console.error("[MongoDB] Close error:", error.message);
  }
};

export const connectMongodb = connectDB;
export const disconnectDB = closeMongodb;
export { connectDB, closeMongodb };
export default connectDB;


