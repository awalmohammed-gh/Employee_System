import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const modelsDir = path.resolve(__dirname, "../models");
const reportsDir = path.resolve(rootDir, "reports");

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Dynamically import all Mongoose models in backend/models
 */
async function loadAllModels() {
  const files = fs.readdirSync(modelsDir).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const fullPath = path.join(modelsDir, file);
    try {
      await import(`file://${fullPath}`);
    } catch (err) {
      console.warn(`[Audit Warning] Could not import ${file}:`, err.message);
    }
  }

  return mongoose.models;
}

/**
 * Inspect schema paths and indices for tenant-identifying fields
 */
function analyzeModel(name, model) {
  const schema = model.schema;
  const paths = Object.keys(schema.paths);
  const collectionName = model.collection?.name || name.toLowerCase();

  const tenantPatterns = [
    /^organizationid$/i,
    /^companyid$/i,
    /^tenantid$/i,
    /^workspaceid$/i,
    /^organization$/i,
    /^company$/i,
  ];

  const tenantFields = [];
  const fieldDetails = {};

  for (const p of paths) {
    const isTenantField = tenantPatterns.some((regex) => regex.test(p));
    if (isTenantField) {
      tenantFields.push(p);
      const pathObj = schema.paths[p];
      fieldDetails[p] = {
        type: pathObj.instance || pathObj.constructor.name,
        required: Boolean(pathObj.options?.required),
        index: Boolean(pathObj.options?.index || pathObj._index),
        ref: pathObj.options?.ref || null,
      };
    }
  }

  // Check compound indexes
  const rawIndexes = schema.indexes();
  const tenantIndexes = [];
  for (const idx of rawIndexes) {
    const keys = Object.keys(idx[0]);
    if (keys.some((k) => tenantPatterns.some((regex) => regex.test(k)))) {
      tenantIndexes.push({
        fields: idx[0],
        options: idx[1] || {},
      });
    }
  }

  // Classify model category
  let category = "Tenant-Owned Data";
  let deletionStrategy = "Cascade delete all records matching organizationId / companyId";
  let superAdminImpact = "None (Tenant-isolated)";

  if (name === "PlatformSettings") {
    category = "Platform-Level (Global)";
    deletionStrategy = "PRESERVE (Must NEVER be deleted on tenant deletion)";
    superAdminImpact = "Critical platform configuration - untouched";
  } else if (name === "Admin" || name === "User") {
    category = "Hybrid / Multi-Role Identity";
    deletionStrategy =
      "Cascade delete tenant users/admins ONLY. Must EXCLUDE Super Admin accounts (isSuperAdmin: true / role: superAdmin)";
    superAdminImpact =
      "CRITICAL: Platform Super Administrators must be preserved unconditionally";
  } else if (name === "AuditLog") {
    category = "Audit & Compliance";
    deletionStrategy =
      "Purge tenant-specific logs (matching organizationId / companyId). Preserve platform-level Super Admin audit records";
    superAdminImpact = "Platform logs preserved";
  } else if (name === "Organization" || name === "Company") {
    category = "Tenant Root Entity";
    deletionStrategy = "Delete target organization document and associated branding assets";
    superAdminImpact = "Target entity removed; Super Admin maintains platform oversight";
  }

  return {
    modelName: name,
    collectionName,
    hasTenantReference: tenantFields.length > 0,
    tenantFields,
    fieldDetails,
    tenantIndexes,
    category,
    deletionStrategy,
    superAdminImpact,
  };
}

async function runTenantModelsAudit() {
  console.log("================================================================================");
  console.log(" 🏢 WORKPULSE MULTI-TENANT MONGOOSE MODEL AUDIT & TENANT DELETION REPORT");
  console.log("================================================================================");

  const registeredModels = await loadAllModels();
  const analysisList = [];

  for (const [name, model] of Object.entries(registeredModels)) {
    analysisList.push(analyzeModel(name, model));
  }

  // Sort: Tenant-Root first, then Tenant-Owned, Hybrid, Audit, Platform
  analysisList.sort((a, b) => {
    if (a.hasTenantReference !== b.hasTenantReference) {
      return b.hasTenantReference ? 1 : -1;
    }
    return a.modelName.localeCompare(b.modelName);
  });

  const tenantModels = analysisList.filter((m) => m.hasTenantReference);
  const platformModels = analysisList.filter((m) => !m.hasTenantReference);

  console.log(`\nFound ${analysisList.length} registered Mongoose models:`);
  console.log(` - ${tenantModels.length} models contain tenant-reference fields (organizationId / companyId)`);
  console.log(` - ${platformModels.length} models are platform-level global models\n`);

  console.log("--------------------------------------------------------------------------------");
  console.log("TENANT-REFERENCING MODELS (Targeted for Cascading Organization Deletion):");
  console.log("--------------------------------------------------------------------------------");

  for (const m of tenantModels) {
    console.log(
      `• Model: \x1b[36m${m.modelName.padEnd(18)}\x1b[0m | Collection: \x1b[33m${m.collectionName.padEnd(16)}\x1b[0m | Tenant Fields: [\x1b[32m${m.tenantFields.join(", ")}\x1b[0m]`
    );
    console.log(`  Category: ${m.category}`);
    console.log(`  Strategy: ${m.deletionStrategy}`);
    console.log(`  Super Admin Safety: ${m.superAdminImpact}\n`);
  }

  if (platformModels.length > 0) {
    console.log("--------------------------------------------------------------------------------");
    console.log("PLATFORM-LEVEL MODELS (Exempt from Tenant Deletion):");
    console.log("--------------------------------------------------------------------------------");
    for (const m of platformModels) {
      console.log(`• Model: \x1b[35m${m.modelName.padEnd(18)}\x1b[0m | Collection: ${m.collectionName}`);
      console.log(`  Category: ${m.category}`);
      console.log(`  Strategy: ${m.deletionStrategy}\n`);
    }
  }

  // Generate Markdown report
  const reportDate = new Date().toISOString();
  let markdown = `# Multi-Tenant Mongoose Model Audit & Organization Deletion Plan
*Generated on: ${reportDate}*

## Executive Summary
This report analyzes all Mongoose schemas in the WorkPulse codebase to identify models with tenant-reference fields (\`organizationId\`, \`companyId\`, \`tenantId\`). It outlines the cascading deletion workflow for \`DELETE /api/super-admin/organizations/:organizationId\`, ensuring zero orphaned records while strictly preserving Super Admin platform data.

---

## 1. Tenant-Referencing Models Overview

| Model Name | MongoDB Collection | Tenant Fields | Category | Cascade Deletion Action |
| :--- | :--- | :--- | :--- | :--- |
`;

  for (const m of tenantModels) {
    markdown += `| **${m.modelName}** | \`${m.collectionName}\` | \`${m.tenantFields.join("`, `")}\` | ${m.category} | ${m.deletionStrategy} |\n`;
  }

  markdown += `\n---

## 2. Platform-Level Models (Exempt from Deletion)

| Model Name | MongoDB Collection | Tenant Reference | Safety Requirement |
| :--- | :--- | :--- | :--- |
`;

  for (const m of platformModels) {
    markdown += `| **${m.modelName}** | \`${m.collectionName}\` | None (Global) | **PRESERVED**: Never deleted on tenant teardown | \n`;
  }

  markdown += `
---

## 3. Critical Super Admin Platform Data Protection Rules

During the execution of \`DELETE /api/super-admin/organizations/:organizationId\`:
1. **User Collection Guard**:
   - Query filter MUST explicitly filter:
     \`\`\`js
     {
       $and: [
         tenantFilter,
         {
           role: { $nin: ["superAdmin", "super_admin", "superadmin"] },
           isSuperAdmin: { $ne: true }
         }
       ]
     }
     \`\`\`
   - Prevents accidental deletion of Platform Super Administrators residing in the \`users\` collection.
2. **Admin Collection Guard**:
   - Super Admin accounts in the \`admins\` collection have \`role: "superAdmin"\` and \`companyId: null\` / \`organizationId: null\`. The exclusion filter ensures they are never purged.
3. **Platform Settings**:
   - The \`PlatformSettings\` collection has zero tenant fields and stores system-wide policies; it is never touched during tenant deletion.
4. **External Asset Purge**:
   - Organization branding assets (\`logoUrl\`, \`welcomeBackgroundUrl\`, Cloudinary public IDs) are removed from storage.
   - Tenant employee/user avatar assets stored in \`uploads/avatars\` or Cloudinary are deleted.

---

## 4. Transactional Integrity
The deletion is orchestrated within a **MongoDB Transaction** (\`session.withTransaction\`), guaranteeing that either all tenant-owned documents across all collections are purged cleanly, or the transaction aborts with zero data corruption.
`;

  const reportPath = path.resolve(reportsDir, "tenant-models-audit.md");
  fs.writeFileSync(reportPath, markdown, "utf8");
  console.log(`\n📄 Markdown report generated at: ${path.relative(rootDir, reportPath)}`);
  console.log("================================================================================");
}

runTenantModelsAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
