import "dotenv/config";
import mongoose from "mongoose";

/**
 * Single-Tenant HR System Database Reset Utility
 * Drops/clears users, admin credentials, company configurations, and dummy employees
 * so the application acts brand new and triggers the initial "Admin & Company Setup" wizard.
 */
async function resetDatabase() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/employee-management";

  console.log("==================================================");
  console.log("   WorkPulse HR System - Full Database Purge      ");
  console.log("==================================================");
  console.log(`Connecting to MongoDB at: ${uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);

  try {
    await mongoose.connect(uri);
    console.log("✅ Successfully connected to MongoDB.\n");

    const db = mongoose.connection.db;

    // Collections to wipe completely for a pristine brand-new onboarding experience
    const targetCollections = [
      "users",
      "admins",
      "employees",
      "companysettings",
      "companies",
      "workspaces",
      "organizations",
      "settings",
      "adminsettings",
      "platformsettings",
      "attendances",
      "payrolls",
      "payslips",
      "leaves",
      "leave_requests",
      "activitylogs",
      "auditlogs",
      "notifications",
      "announcements",
      "performancereviews",
      "shiftpolicies",
    ];

    const existingCollections = await db.listCollections().toArray();
    const existingNames = new Set(existingCollections.map((c) => c.name));

    console.log("Purging collections to restore initial onboarding state...");
    let totalPurgedCollections = 0;

    for (const colName of targetCollections) {
      if (existingNames.has(colName)) {
        try {
          const count = await db.collection(colName).countDocuments();
          await db.collection(colName).drop();
          console.log(`  ✓ Dropped collection: "${colName}" (${count} records deleted)`);
          totalPurgedCollections++;
        } catch (dropErr) {
          // If drop fails (e.g., namespace not found), delete all documents
          const res = await db.collection(colName).deleteMany({});
          console.log(`  ✓ Cleared collection: "${colName}" (${res.deletedCount} documents deleted)`);
          totalPurgedCollections++;
        }
      }
    }

    console.log(`\n✅ Database Reset Complete! Purged ${totalPurgedCollections} collections.`);
    console.log("All existing admin accounts, company profiles, and dummy records have been wiped.");
    console.log("The application is now in pristine zero-state and will trigger the setup wizard upon next page load.\n");

  } catch (err) {
    console.error("❌ Database reset failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

resetDatabase();
