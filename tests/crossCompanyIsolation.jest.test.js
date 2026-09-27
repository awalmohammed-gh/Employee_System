import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import app from "../backend/server.js";
import { connectMongodb, closeMongodb } from "../backend/config/mongodb.js";
import { Company } from "../backend/models/Company.js";
import { Organization } from "../backend/models/Organization.js";
import { User } from "../backend/models/userModel.js";
import { Admin } from "../backend/models/Admin.js";
import { Employee } from "../backend/models/employeeModel.js";
import { Payroll } from "../backend/models/payrollModel.js";
import { Attendance } from "../backend/models/attendanceModel.js";
import { authorizeCompanyTenant } from "../backend/middleware/authorizeCompanyTenant.js";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key_12345";

describe("Cross-Company Access Isolation & Super Admin Management Integration Tests (Jest & Supertest)", () => {
  let companyAlpha;
  let companyBeta;

  let managerAlpha;
  let employeeAlpha;
  let payrollAlpha;
  let attendanceAlpha;

  let managerBeta;
  let employeeBeta;
  let payrollBeta;
  let attendanceBeta;

  let superAdminUser;

  let tokenManagerAlpha;
  let tokenManagerBeta;
  let tokenEmployeeAlpha;
  let tokenEmployeeBeta;
  let tokenSuperAdmin;

  beforeAll(async () => {
    await connectMongodb();

    const hashedPassword = await bcrypt.hash("TestPass@2026", 10);

    // 1. Provision Company Alpha
    companyAlpha = await Organization.findOne({ slug: "alpha-jest-corp" });
    if (!companyAlpha) {
      companyAlpha = await Organization.create({
        companyName: "Alpha Jest Corp",
        name: "Alpha Jest Corp",
        companySlug: "alpha-jest-corp",
        slug: "alpha-jest-corp",
        companyEmail: "admin@alphajest.test",
        email: "admin@alphajest.test",
        companyPhone: "+1 555-0101",
        phone: "+1 555-0101",
        companyAddress: "100 Alpha Jest Way, CA",
        address: "100 Alpha Jest Way, CA",
        status: "active",
        subscriptionStatus: "active",
        plan: "enterprise",
      });
    }

    // 2. Provision Company Beta
    companyBeta = await Organization.findOne({ slug: "beta-jest-corp" });
    if (!companyBeta) {
      companyBeta = await Organization.create({
        companyName: "Beta Jest Corp",
        name: "Beta Jest Corp",
        companySlug: "beta-jest-corp",
        slug: "beta-jest-corp",
        companyEmail: "admin@betajest.test",
        email: "admin@betajest.test",
        companyPhone: "+1 555-0202",
        phone: "+1 555-0202",
        companyAddress: "200 Beta Jest Way, NY",
        address: "200 Beta Jest Way, NY",
        status: "active",
        subscriptionStatus: "active",
        plan: "professional",
      });
    }

    // 3. Provision Manager & Employee for Company Alpha
    managerAlpha = await Admin.findOneAndUpdate(
      { email: "manager.alpha@jestcorp.test" },
      {
        name: "Manager Alpha",
        full_name: "Manager Alpha",
        email: "manager.alpha@jestcorp.test",
        password_hash: hashedPassword,
        role: "admin",
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    employeeAlpha = await Employee.findOneAndUpdate(
      { employeeId: "JST-ALP-001" },
      {
        fullName: "Employee Alpha",
        name: "Employee Alpha",
        employeeId: "JST-ALP-001",
        email: "emp.alpha@jestcorp.test",
        password: hashedPassword,
        phone: "+1 555-1111",
        department: "Engineering",
        designation: "Software Engineer",
        position: "Software Engineer",
        role: "employee",
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
        status: "active",
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    payrollAlpha = await Payroll.findOneAndUpdate(
      { companyId: companyAlpha._id, payslipNumber: "PAY-2026-ALP-JST" },
      {
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
        employee: employeeAlpha._id,
        employeeId: "JST-ALP-001",
        payslipNumber: "PAY-2026-ALP-JST",
        payMonth: "March 2026",
        payrollPeriod: { month: "March", year: 2026 },
        basicSalary: 8500,
        netSalary: 7200,
        netPay: 7200,
        currency: "USD",
        status: "paid",
        paymentDate: new Date(),
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    attendanceAlpha = await Attendance.findOneAndUpdate(
      { companyId: companyAlpha._id, employee: employeeAlpha._id, date: "2026-03-01" },
      {
        employee: employeeAlpha._id,
        employeeId: "JST-ALP-001",
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
        date: "2026-03-01",
        status: "present",
        checkInTime: new Date("2026-03-01T09:00:00Z"),
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // 4. Provision Manager & Employee for Company Beta
    managerBeta = await Admin.findOneAndUpdate(
      { email: "manager.beta@jestcorp.test" },
      {
        name: "Manager Beta",
        full_name: "Manager Beta",
        email: "manager.beta@jestcorp.test",
        password_hash: hashedPassword,
        role: "admin",
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    employeeBeta = await Employee.findOneAndUpdate(
      { employeeId: "JST-BET-001" },
      {
        fullName: "Employee Beta",
        name: "Employee Beta",
        employeeId: "JST-BET-001",
        email: "emp.beta@jestcorp.test",
        password: hashedPassword,
        phone: "+1 555-2222",
        department: "Finance",
        designation: "Financial Analyst",
        position: "Financial Analyst",
        role: "employee",
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
        status: "active",
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    payrollBeta = await Payroll.findOneAndUpdate(
      { companyId: companyBeta._id, payslipNumber: "PAY-2026-BET-JST" },
      {
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
        employee: employeeBeta._id,
        employeeId: "JST-BET-001",
        payslipNumber: "PAY-2026-BET-JST",
        payMonth: "March 2026",
        payrollPeriod: { month: "March", year: 2026 },
        basicSalary: 9500,
        netSalary: 8100,
        netPay: 8100,
        currency: "USD",
        status: "paid",
        paymentDate: new Date(),
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    attendanceBeta = await Attendance.findOneAndUpdate(
      { companyId: companyBeta._id, employee: employeeBeta._id, date: "2026-03-01" },
      {
        employee: employeeBeta._id,
        employeeId: "JST-BET-001",
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
        date: "2026-03-01",
        status: "present",
        checkInTime: new Date("2026-03-01T09:00:00Z"),
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // 5. Provision Platform Super Admin
    superAdminUser = await User.findOneAndUpdate(
      { email: "mohammed@gmail.com" },
      {
        name: "Mohammed Super Admin",
        fullName: "Mohammed Super Admin",
        email: "mohammed@gmail.com",
        password: hashedPassword,
        role: "superadmin",
        status: "active",
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Generate JWT Tokens with embedded session data
    tokenManagerAlpha = jwt.sign(
      {
        id: String(managerAlpha._id),
        role: "admin",
        companyId: String(companyAlpha._id),
        organizationId: String(companyAlpha._id),
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    tokenManagerBeta = jwt.sign(
      {
        id: String(managerBeta._id),
        role: "admin",
        companyId: String(companyBeta._id),
        organizationId: String(companyBeta._id),
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    tokenEmployeeAlpha = jwt.sign(
      {
        id: String(employeeAlpha._id),
        role: "employee",
        companyId: String(companyAlpha._id),
        organizationId: String(companyAlpha._id),
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    tokenEmployeeBeta = jwt.sign(
      {
        id: String(employeeBeta._id),
        role: "employee",
        companyId: String(companyBeta._id),
        organizationId: String(companyBeta._id),
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    tokenSuperAdmin = jwt.sign(
      {
        id: String(superAdminUser._id),
        role: "superadmin",
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );
  });

  afterAll(async () => {
    try {
      const orgIds = [companyAlpha?._id, companyBeta?._id].filter(Boolean);
      if (orgIds.length > 0) {
        const filter = { $or: [{ companyId: { $in: orgIds } }, { organizationId: { $in: orgIds } }] };
        await Organization.deleteMany({ _id: { $in: orgIds } }, { skipTenant: true });
        await Employee.deleteMany(filter, { skipTenant: true });
        await Admin.deleteMany(filter, { skipTenant: true });
        await User.deleteMany(filter, { skipTenant: true });
        await Attendance.deleteMany(filter, { skipTenant: true });
        await Payroll.deleteMany(filter, { skipTenant: true });
      }
      if (superAdminUser?._id) {
        await Admin.deleteOne({ _id: superAdminUser._id }, { skipTenant: true });
      }
    } catch (e) {
      console.warn("Test cleanup error:", e.message);
    }
    await closeMongodb();
  });

  describe("Cross-Company Data Isolation & IDOR Prevention", () => {
    test("Manager from Company Alpha attempting to GET payroll from Company Beta must return 403 or 404", async () => {
      // Direct IDOR attempt using Company Beta's employee payroll ID
      const resById = await request(app)
        .get(`/api/payroll/${payrollBeta._id}`)
        .set("Authorization", `Bearer ${tokenManagerAlpha}`);

      expect([403, 404]).toContain(resById.status);
      expect(resById.body.payroll?._id).toBeUndefined();

      // Scoped employee payroll lookup attempt for employee in Company Beta
      const resByEmp = await request(app)
        .get(`/api/payroll/employee/${employeeBeta._id}`)
        .set("Authorization", `Bearer ${tokenManagerAlpha}`);

      expect([403, 404]).toContain(resByEmp.status);
    });

    test("Manager from Company Alpha attempting to GET employee details from Company Beta must return 403 or 404", async () => {
      const res = await request(app)
        .get(`/api/admin/employees/${employeeBeta._id}`)
        .set("Authorization", `Bearer ${tokenManagerAlpha}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.employee?.fullName).toBeUndefined();
    });

    test("Manager from Company Alpha attempting to GET attendance records from Company Beta must return 403 or 404", async () => {
      const res = await request(app)
        .get(`/api/attendance/employee/${employeeBeta._id}`)
        .set("Authorization", `Bearer ${tokenManagerAlpha}`);

      expect([403, 404]).toContain(res.status);
    });

    test("Manager from Company Alpha attempting to modify / delete resource from Company Beta must return 403 or 404", async () => {
      const resUpdate = await request(app)
        .put(`/api/admin/employees/${employeeBeta._id}`)
        .set("Authorization", `Bearer ${tokenManagerAlpha}`)
        .send({ position: "Hacked Title" });

      expect([403, 404]).toContain(resUpdate.status);

      // Verify no changes occurred to employeeBeta in DB
      const freshBeta = await Employee.findById(employeeBeta._id);
      expect(freshBeta.position).toBe("Financial Analyst");
    });

    test("Payload tampering attack: Client-supplied companyId is ignored and scoped strictly to authenticated tenant", async () => {
      const fakeEmail = `tamper.${Date.now()}@jestcorp.test`;
      const res = await request(app)
        .post("/api/admin/employees")
        .set("Authorization", `Bearer ${tokenManagerAlpha}`)
        .send({
          fullName: "Tampered Employee",
          employeeId: `EMP-T-${Date.now()}`,
          email: fakeEmail,
          password: "SecurePass123!",
          phone: "+1 555-9999",
          department: "Engineering",
          // Malicious injection trying to create under Company Beta
          companyId: String(companyBeta._id),
          organizationId: String(companyBeta._id),
        });

      if (res.status === 201 || res.status === 200) {
        const createdId = res.body.employee?._id || res.body.data?._id;
        const freshCreated = await Employee.findById(createdId);
        expect(String(freshCreated.companyId)).toBe(String(companyAlpha._id));
        expect(String(freshCreated.companyId)).not.toBe(String(companyBeta._id));
      } else {
        expect([400, 403]).toContain(res.status);
      }
    });

    test("Employee from Company Beta cannot access Company Alpha's private endpoints", async () => {
      const res = await request(app)
        .get(`/api/admin/employees/${employeeAlpha._id}`)
        .set("Authorization", `Bearer ${tokenEmployeeBeta}`);

      expect([401, 403, 404]).toContain(res.status);
    });
  });

  describe("Super Admin Platform Management & Security Boundaries", () => {
    test("Unauthenticated user accessing /api/super-admin/companies must return 401", async () => {
      const res = await request(app).get("/api/super-admin/companies");
      expect(res.status).toBe(401);
    });

    test("Company Manager accessing /api/super-admin/companies must return 403 (restricted to role: superadmin)", async () => {
      const res = await request(app)
        .get("/api/super-admin/companies")
        .set("Authorization", `Bearer ${tokenManagerAlpha}`);

      expect(res.status).toBe(403);
    });

    test("Super Admin accessing /api/super-admin/companies bypasses tenant filter and returns companies across platform", async () => {
      const res = await request(app)
        .get("/api/super-admin/companies")
        .set("Authorization", `Bearer ${tokenSuperAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.companies)).toBe(true);

      const companyIds = res.body.companies.map((c) => String(c._id || c.id));
      expect(companyIds).toContain(String(companyAlpha._id));
      expect(companyIds).toContain(String(companyBeta._id));

      // STRICT PRIVACY: Verify passwords and secrets are completely redacted
      for (const comp of res.body.companies) {
        expect(comp.password).toBeUndefined();
        expect(comp.password_hash).toBeUndefined();
        if (comp.manager) {
          expect(comp.manager.password).toBeUndefined();
          expect(comp.manager.password_hash).toBeUndefined();
        }
      }
    });

    test("Super Admin accessing /api/super-admin/tenants-overview returns live aggregations without exposing PII", async () => {
      const res = await request(app)
        .get("/api/super-admin/tenants-overview")
        .set("Authorization", `Bearer ${tokenSuperAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
      expect(typeof res.body.stats.totalCompanies).toBe("number");
      expect(typeof res.body.stats.activeCompanies).toBe("number");
      expect(typeof res.body.stats.totalUsers).toBe("number");

      // Verify privacy boundaries: individual employee names and documents are not returned in overview
      for (const comp of res.body.companies) {
        expect(comp.password).toBeUndefined();
        expect(typeof comp.totalEmployees).toBe("number");
        expect(comp.employees).toBeUndefined(); // Individual employee list remains confidential
      }
    });

    test("Super Admin can update tenant workspace status via PATCH /api/super-admin/tenants/:id/status", async () => {
      const res = await request(app)
        .patch(`/api/super-admin/tenants/${companyBeta._id}/status`)
        .set("Authorization", `Bearer ${tokenSuperAdmin}`)
        .send({ status: "suspended", reason: "Audit compliance verification" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify directly in MongoDB
      const updatedBeta = await Company.findById(companyBeta._id);
      expect(updatedBeta.status).toBe("suspended");

      // Restore status to active
      await request(app)
        .patch(`/api/super-admin/tenants/${companyBeta._id}/status`)
        .set("Authorization", `Bearer ${tokenSuperAdmin}`)
        .send({ status: "active" });

      const restoredBeta = await Company.findById(companyBeta._id);
      expect(restoredBeta.status).toBe("active");
    });
  });

  describe("authorizeCompanyTenant Middleware Extraction & Scoping Verification", () => {
    test("Extracts companyId from validated JWT session and injects into req.user.companyId", async () => {
      let capturedUser = null;
      let capturedCompanyId = null;

      const mockReq = {
        method: "GET",
        headers: {
          authorization: `Bearer ${tokenManagerAlpha}`,
        },
        cookies: {},
        params: {},
        query: {},
        body: {},
        path: "/api/test-protected-route",
        originalUrl: "/api/test-protected-route",
      };

      const mockRes = {
        status: () => mockRes,
        json: () => mockRes,
      };

      await authorizeCompanyTenant(mockReq, mockRes, () => {
        capturedUser = mockReq.user;
        capturedCompanyId = mockReq.companyId;
      });

      expect(capturedUser).toBeDefined();
      expect(String(capturedUser.companyId)).toBe(String(companyAlpha._id));
      expect(String(capturedCompanyId)).toBe(String(companyAlpha._id));
    });

    test("Super Admin session bypasses company-tenant filter with isSuperAdmin=true", async () => {
      let isSuperAdmin = false;

      const mockReq = {
        headers: {
          authorization: `Bearer ${tokenSuperAdmin}`,
        },
        cookies: {},
        params: {},
        query: {},
        body: {},
        originalUrl: "/api/super-admin/companies",
      };

      const mockRes = {
        status: () => mockRes,
        json: () => mockRes,
      };

      await authorizeCompanyTenant(mockReq, mockRes, () => {
        isSuperAdmin = true;
      });

      expect(isSuperAdmin).toBe(true);
    });
  });
});
