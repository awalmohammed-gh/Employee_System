/**
 * One-time repair: convert attendance records whose `date` was stored as a long Date string
 * (e.g. "Mon Sep 28 2026 00:00:00 GMT+0000 (Greenwich Mean Time)") to the "YYYY-MM-DD" day key
 * used everywhere else. Safe to run repeatedly.
 *
 * If the same employee already has a record under the normalised key, the old record is left
 * untouched and reported, so no attendance data is ever overwritten or merged automatically.
 *
 * Usage: npm run db:normalize-attendance-dates            (apply)
 *        npm run db:normalize-attendance-dates -- --dry   (report only)
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectMongodb, closeMongodb } from "../config/mongodb.js";
import { attendanceDateKey } from "../utils/attendanceDate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry");

const run = async () => {
  await connectMongodb();
  if (mongoose.connection.readyState !== 1) {
    console.error("❌ Could not connect to MongoDB. Check MONGODB_URI in backend/.env.");
    process.exit(1);
  }

  const collection = mongoose.connection.collection("attendances");
  const cursor = collection.find({ date: { $not: /^\d{4}-\d{2}-\d{2}$/ } });

  let fixed = 0;
  let conflicts = 0;
  let unparseable = 0;
  for await (const doc of cursor) {
    const key = attendanceDateKey(doc.date) || attendanceDateKey(doc.clockIn || doc.createdAt);
    if (!key) {
      unparseable++;
      console.warn(`  ! ${doc._id}: cannot parse date "${doc.date}"`);
      continue;
    }
    const clash = await collection.findOne({ _id: { $ne: doc._id }, employee: doc.employee, date: key });
    if (clash) {
      conflicts++;
      console.warn(`  ! ${doc._id}: employee ${doc.employee} already has a record for ${key} (${clash._id}); left unchanged`);
      continue;
    }
    if (!DRY_RUN) await collection.updateOne({ _id: doc._id }, { $set: { date: key } });
    fixed++;
  }

  console.log(`${DRY_RUN ? "[dry run] would normalise" : "Normalised"} ${fixed} record(s); ${conflicts} conflict(s) left for review; ${unparseable} unparseable.`);
  await closeMongodb();
  process.exit(0);
};

run().catch(async (err) => {
  console.error("❌ Normalisation failed:", err.message);
  await closeMongodb();
  process.exit(1);
});
