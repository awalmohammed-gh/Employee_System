/**
 * WorkPulse - Purge Mock and Test Companies Migration Script
 * 
 * Purges all hardcoded mock companies, automated Jest/Supertest fixtures,
 * and test seed data from MongoDB, ensuring the Super Admin Dashboard renders
 * strictly legitimate registered organizations.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectMongodb, closeMongodb } from "../backend/config/mongodb.js";
import { Organization } from "../backend/models/Organization.js";
import { Employee } from "../backend/models/employeeModel.js";
import { Admin } from "../backend/models/Admin.js";
import { User } from "../backend/models/userModel.js";
import { Attendance } from "../backend/models/attendanceModel.js";
import { Payroll } from "../backend/models/payrollModel.js";
import { Leave } from "../backend/models/leaveModel.js";
import { CompanySettings } from "../backend/models/CompanySettings.js";
import { Department } from "../backend/models/Department.js";
import { Announcement } from "../backend/models/announcementModel.js";
import { Notification } from "../backend/models/notificationModel.js";

const TEST_ORG_CRITERIA = {
  $or: [
    {
      companyName: {
        $in: [
          "Alpha Jest Corp",
          "Beta Jest Corp",
          "Alpha Logistics Corp",
          "Beta Financial Group",
          "Beta LLC",
          "Alpha Corp",
          "Apex Innovations Ltd",
          "Vortex Systems Inc",
          "Alpha Corporation",
          "Beta Technologies",
          "Acme Innovations Unique 2",
        ],
      },
    },
    {
      name: {
        $in: [
          "Alpha Jest Corp",
          "Beta Jest Corp",
          "Alpha Logistics Corp",
          "Beta Financial Group",
          "Beta LLC",
          "Alpha Corp",
          "Apex Innovations Ltd",
          "Vortex Systems Inc",
          "Alpha Corporation",
          "Beta Technologies",
          "Acme Innovations Unique 2",
        ],
      },
    },
    {
      slug: {
        $in: [
          "alpha-jest-corp",
          "beta-jest-corp",
          "test-corp-alpha",
          "test-corp-beta",
          "test-org-alpha",
          "test-org-beta",
          "apex-innovations",
          "vortex-systems",
          "alpha-corp",
          "beta-tech",
          "acme-innovations-unique-2",
          "undefined",
        ],
      },
    },
    { slug: /^test-/i },
    { slug: null },
    { companyEmail: /\.test$/i },
    { email: /\.test$/i },
    { companyEmail: /@(alpha\.com|beta\.com|acme-unique\.io)/i },
    { email: /@(alpha\.com|beta\.com|acme-unique\.io)/i },
  ],
};

async function purgeMockCompanies() {
  console.log("==================================================");
  console.log("   WorkPulse Database Purge: Mock & Test Seeds   ");
  console.log("==================================================");

  try {
    await connectMongodb();

    // 1. Identify mock organizations
    const mockOrgs = await Organization.find(TEST_ORG_CRITERIA, null, { skipTenant: true }).lean();
    console.log(`[Audit] Found ${mockOrgs.length} mock/test organization(s) to purge:`);

    if (mockOrgs.length === 0) {
      console.log("[Audit] No mock or test organizations detected in MongoDB.");
    } else {
      for (const org of mockOrgs) {
        console.log(` - ID: ${org._id} | Name: "${org.companyName || org.name}" | Slug: "${org.slug}" | Email: "${org.companyEmail || org.email}"`);
      }
    }

    const mockOrgIds = mockOrgs.map((o) => o._id);

    if (mockOrgIds.length > 0) {
      // 2. Cascade delete all linked records
      const tenantMatch = {
        $or: [
          { companyId: { $in: mockOrgIds } },
          { organizationId: { $in: mockOrgIds } },
        ],
      };

      const emailTestFilter = {
        email: { $regex: /(\.test$|@alpha\.com$|@beta\.com$|@acme-unique\.io$)/i },
      };

      const [
        delEmployees,
        delAdmins,
        delUsers,
        delAttendance,
        delPayroll,
        delLeave,
        delSettings,
        delDepts,
        delAnnouncements,
        delNotifications,
      ] = await Promise.all([
        Employee.deleteMany({ $or: [tenantMatch, emailTestFilter] }, { skipTenant: true }),
        Admin.deleteMany({
          $and: [
            { role: { $ne: "super_admin" } },
            { $or: [tenantMatch, emailTestFilter] },
          ],
        }, { skipTenant: true }),
        User.deleteMany({
          $and: [
            { role: { $ne: "super_admin" } },
            { $or: [tenantMatch, emailTestFilter] },
          ],
        }, { skipTenant: true }),
        Attendance.deleteMany(tenantMatch, { skipTenant: true }),
        Payroll.deleteMany(tenantMatch, { skipTenant: true }),
        Leave.deleteMany(tenantMatch, { skipTenant: true }),
        CompanySettings.deleteMany(tenantMatch, { skipTenant: true }),
        Department.deleteMany(tenantMatch, { skipTenant: true }),
        Announcement.deleteMany(tenantMatch, { skipTenant: true }),
        Notification.deleteMany(tenantMatch, { skipTenant: true }),
      ]);

      console.log("\n[Cleanup] Cascade purge counts:");
      console.log(` - Employees deleted:     ${delEmployees.deletedCount}`);
      console.log(` - Non-super admins deleted: ${delAdmins.deletedCount}`);
      console.log(` - Users deleted:         ${delUsers.deletedCount}`);
      console.log(` - Attendance deleted:    ${delAttendance.deletedCount}`);
      console.log(` - Payroll deleted:       ${delPayroll.deletedCount}`);
      console.log(` - Leave records deleted: ${delLeave.deletedCount}`);
      console.log(` - Settings deleted:      ${delSettings.deletedCount}`);
      console.log(` - Departments deleted:   ${delDepts.deletedCount}`);
      console.log(` - Announcements deleted: ${delAnnouncements.deletedCount}`);
      console.log(` - Notifications deleted: ${delNotifications.deletedCount}`);

      // 3. Delete the mock organizations themselves
      const delOrgs = await Organization.deleteMany({ _id: { $in: mockOrgIds } }, { skipTenant: true });
      console.log(`\n[Cleanup] Organizations purged: ${delOrgs.deletedCount}`);
    }

    // 4. Verification: Print remaining live organizations
    const remainingOrgs = await Organization.find({}, null, { skipTenant: true }).lean();
    console.log("\n==================================================");
    console.log(`   LIVE ORGANIZATIONS IN DATABASE (${remainingOrgs.length})   `);
    console.log("==================================================");

    for (const org of remainingOrgs) {
      const empCount = await Employee.countDocuments({
        $or: [{ companyId: org._id }, { organizationId: org._id }],
      });
      console.log(`* [${org.slug}] "${org.companyName || org.name}"`);
      console.log(`  ID: ${org._id} | Email: ${org.companyEmail || org.email} | Status: ${org.status} | Plan: ${org.subscriptionPlan || org.plan || "standard"} | Employees: ${empCount}`);
    }
    console.log("==================================================\n");

    console.log("Purge operation completed successfully.");
  } catch (error) {
    console.error("[Purge Error] Failed to purge mock companies:", error);
    process.exit(1);
  } finally {
    await closeMongodb();
  }
}

purgeMockCompanies();
