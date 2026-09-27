/**
 * One-time cleanup: remove the placeholder quarterly reviews that older versions of the performance
 * endpoint auto-inserted for every employee who had none (Q1 2025 – Q2 2026, ratings 3.9 → 4.8).
 * Those records were generated, not recorded by a reviewer.
 *
 * A review is only removed when its quarter, overall rating AND reviewer all match one of the six
 * generated entries exactly, so reviews an admin actually recorded are never touched.
 *
 * Usage: npm run db:remove-seeded-reviews            (apply)
 *        npm run db:remove-seeded-reviews -- --dry   (report only)
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectMongodb, closeMongodb } from "../config/mongodb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry");

const GENERATED_REVIEWS = [
  { quarter: "Q1 2025", overallRating: 3.9, reviewer: "Engineering & HR Review Committee" },
  { quarter: "Q2 2025", overallRating: 4.1, reviewer: "Operations & HR Review Board" },
  { quarter: "Q3 2025", overallRating: 4.3, reviewer: "Department Head & HR Directorate" },
  { quarter: "Q4 2025", overallRating: 4.5, reviewer: "Executive Management & HR Directorate" },
  { quarter: "Q1 2026", overallRating: 4.6, reviewer: "Executive Management & Board of Directors" },
  { quarter: "Q2 2026", overallRating: 4.8, reviewer: "Executive Leadership & HR Review Committee" },
];

const run = async () => {
  await connectMongodb();
  if (mongoose.connection.readyState !== 1) {
    console.error("❌ Could not connect to MongoDB. Check MONGODB_URI in backend/.env.");
    process.exit(1);
  }

  const collection = mongoose.connection.collection("performancereviews");
  const filter = { $or: GENERATED_REVIEWS };

  const matched = await collection.countDocuments(filter);
  const employees = (await collection.distinct("employee", filter)).length;

  if (DRY_RUN) {
    console.log(`[dry run] would remove ${matched} generated review(s) across ${employees} employee(s).`);
  } else {
    const { deletedCount } = await collection.deleteMany(filter);
    console.log(`Removed ${deletedCount} generated review(s) across ${employees} employee(s).`);
  }

  const remaining = await collection.countDocuments({});
  console.log(`${remaining} recorded review(s) ${DRY_RUN ? "currently in" : "remain in"} the collection.`);

  await closeMongodb();
  process.exit(0);
};

run().catch(async (err) => {
  console.error("❌ Cleanup failed:", err.message);
  await closeMongodb().catch(() => {});
  process.exit(1);
});
