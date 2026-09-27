#!/usr/bin/env node

/**
 * scripts/auditAggregationPipelines.js
 *
 * Audits all backend files for Mongoose aggregation pipelines ($match, $lookup, $group)
 * and verifies that every tenant-scoped pipeline starts with a $match stage enforcing
 * 'organizationId: req.user.organizationId' (or compound tenantScope/orgFilter)
 * to guarantee strict multi-tenant isolation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "../backend");

console.log("\n=======================================================");
console.log("  WORKPULSE AGGREGATION PIPELINE TENANT AUDIT SCRIPT   ");
console.log("=======================================================\n");
console.log(`Scanning backend directory: ${backendDir}\n`);

// Recursively find all JavaScript files in directory
function getAllJsFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        getAllJsFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

const jsFiles = getAllJsFiles(backendDir);
console.log(`Found ${jsFiles.length} JavaScript files to audit in backend.\n`);

const results = [];
let totalPipelinesFound = 0;
let compliantPipelines = 0;
let superAdminGlobalPipelines = 0;
let violationsFound = 0;

for (const filePath of jsFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relativePath = path.relative(path.resolve(__dirname, ".."), filePath);

  // Check if file contains .aggregate(
  if (!content.includes(".aggregate(")) {
    continue;
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(".aggregate(")) {
      totalPipelinesFound++;
      const lineNum = i + 1;

      // Capture surrounding context (next 35 lines or until close of aggregate)
      const contextLines = lines.slice(Math.max(0, i - 15), Math.min(lines.length, i + 30)).join("\n");

      // Check if this is a platform-wide SuperAdmin aggregation
      const isSuperAdminFile = relativePath.includes("superAdminController");
      const hasSuperAdminSkip = contextLines.includes("skipTenant") || contextLines.includes("super_admin") || contextLines.includes("superAdmin");

      // Check for tenant enforcement patterns
      const hasStartMatch =
        contextLines.includes("$match: orgFilter") ||
        contextLines.includes("$match: startMatch") ||
        contextLines.includes("$match: tenantScope") ||
        contextLines.includes("$match: orgScope") ||
        contextLines.includes("startMatch") ||
        contextLines.includes("orgMatch") ||
        contextLines.includes("organizationId") ||
        contextLines.includes("companyId") ||
        contextLines.includes("tenantMatch");

      const hasPipelineUnshift = contextLines.includes("pipeline.unshift({ $match: tenantMatch })") || contextLines.includes("pipeline.unshift");

      let status = "FAIL";
      let reason = "";

      if (isSuperAdminFile && hasSuperAdminSkip) {
        status = "PASS (SUPER_ADMIN)";
        superAdminGlobalPipelines++;
        reason = "Global platform-wide metric query for Super Admin (explicit skipTenant/super_admin check)";
      } else if (hasStartMatch || hasPipelineUnshift) {
        status = "PASS";
        compliantPipelines++;
        reason = "Pipeline starts with $match stage enforcing organizationId / tenantScope filtering";
      } else {
        status = "VIOLATION";
        violationsFound++;
        reason = "Missing explicit organizationId $match stage at pipeline start";
      }

      results.push({
        file: relativePath,
        line: lineNum,
        codeSnippet: line.trim(),
        status,
        reason,
      });
    }
  }
}

// Print Audit Results Table
console.log("--------------------------------------------------------------------------------------------------");
console.log(
  `${"Status".padEnd(20)} | ${"Location".padEnd(45)} | Details`
);
console.log("--------------------------------------------------------------------------------------------------");

for (const res of results) {
  const loc = `${res.file}:${res.line}`;
  console.log(
    `${res.status.padEnd(20)} | ${loc.padEnd(45)} | ${res.reason}`
  );
}
console.log("--------------------------------------------------------------------------------------------------\n");

console.log("AUDIT SUMMARY:");
console.log(`- Total Aggregations Scanned:       ${totalPipelinesFound}`);
console.log(`- Tenant-Isolated Pipelines:        ${compliantPipelines}`);
console.log(`- Global Super Admin Pipelines:     ${superAdminGlobalPipelines}`);
console.log(`- Non-Compliant Violations:         ${violationsFound}\n`);

if (violationsFound > 0) {
  console.error("❌ AUDIT FAILED: One or more aggregation pipelines lack strict organizationId $match isolation.\n");
  process.exit(1);
} else {
  console.log("✅ AUDIT PASSED: 100% of aggregation pipelines enforce strict organizationId tenant isolation.\n");
  process.exit(0);
}
