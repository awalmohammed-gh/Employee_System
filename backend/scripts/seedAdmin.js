import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";
import { connectMongodb, closeMongodb } from "../config/mongodb.js";

// Load backend/.env regardless of the directory the script is launched from (npm runs it from the repo root)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Creates or updates the administrator account defined by ADMIN_EMAIL / ADMIN_PSD (or ADMIN_PASSWORD).
 * Usage: npm run seed:admin
 */
const seedAdmin = async () => {
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PSD || "";
  const adminFullName = process.env.ADMIN_NAME || "System Administrator";

  if (!adminEmail || !adminPassword) {
    console.error("❌ ADMIN_EMAIL and ADMIN_PSD (or ADMIN_PASSWORD) must be set in backend/.env.");
    process.exit(1);
  }
  if (adminPassword.length < 8) {
    console.error("❌ The admin password must be at least 8 characters long.");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await connectMongodb();
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Could not connect to MongoDB. Check MONGODB_URI in backend/.env.");
    }

    const password_hash = await bcrypt.hash(adminPassword, 10);
    const existingAdmin = await Admin.findOne({ email: adminEmail });

    if (existingAdmin) {
      existingAdmin.full_name = adminFullName;
      existingAdmin.password_hash = password_hash;
      existingAdmin.role = "admin";
      await existingAdmin.save();
      console.log(`✅ Admin account updated: ${adminEmail}`);
    } else {
      await Admin.create({
        full_name: adminFullName,
        email: adminEmail,
        password_hash,
        role: "admin",
        profile_image_url: "",
      });
      console.log(`✅ Admin account created: ${adminEmail}`);
    }

    await closeMongodb();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding admin account:", error.message);
    await closeMongodb();
    process.exit(1);
  }
};

seedAdmin();
