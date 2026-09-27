import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import app from "../backend/server.js";
import { connectMongodb, closeMongodb } from "../backend/config/mongodb.js";
import { Organization } from "../backend/models/Organization.js";
import { CompanySettings } from "../backend/models/CompanySettings.js";
import { Admin } from "../backend/models/Admin.js";
import { User } from "../backend/models/userModel.js";
import { Employee } from "../backend/models/employeeModel.js";
import { Payroll } from "../backend/models/payrollModel.js";
import { Attendance } from "../backend/models/attendanceModel.js";
import { Leave } from "../backend/models/leaveModel.js";
import { Department } from "../backend/models/Department.js";
import { Settings } from "../backend/models/adminSettingsModel.js";
import { ShiftPolicy } from "../backend/models/ShiftPolicy.js";
import { Notification } from "../backend/models/notificationModel.js";
import { Announcement } from "../backend/models/announcementModel.js";
import { AuditLog } from "../backend/models/AuditLog.js";
import { Payslip } from "../backend/models/Payslip.js";
import { authorizeCompanyTenant } from "../backend/middleware/authorizeCompanyTenant.js";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key_12345";

describe("Multi-Tenant Isolation & Cross-Company Security Integration Tests", () => {
  let companyAlpha;
  let companyBeta;

  let managerAlpha;
  let employeeAlpha;
  let attendanceAlpha;
  let payrollAlpha;

  let managerBeta;
  let employeeBeta;
  let attendanceBeta;
  let payrollBeta;

  let superAdminUser;

  let tokenAlphaManager;
  let tokenAlphaEmployee;
  let tokenBetaManager;
  let tokenBetaEmployee;
  let tokenSuperAdmin;

  before(async () => {
    // Ensure MongoDB connection is established
    await connectMongodb();

    const passwordHash = await bcrypt.hash("SecurePass123!", 10);

    // 1. Provision Tenant Alpha
    companyAlpha = await Organization.findOne({
      $or: [{ slug: "alpha-corp" }, { companyEmail: "security@alphalogistics.test" }],
    });
    if (!companyAlpha) {
      companyAlpha = await Organization.create({
        companyName: "Alpha Logistics Corp",
        companySlug: "alpha-corp",
        slug: "alpha-corp",
        companyEmail: "security@alphalogistics.test",
        companyPhone: "+1 555-0101",
        companyAddress: "100 Alpha Way, Silicon Valley, CA",
        status: "active",
        subscriptionStatus: "active",
      });
    }

    // 2. Provision Tenant Beta
    companyBeta = await Organization.findOne({
      $or: [{ slug: "beta-corp" }, { companyEmail: "security@betafinancial.test" }],
    });
    if (!companyBeta) {
      companyBeta = await Organization.create({
        companyName: "Beta Financial Group",
        companySlug: "beta-corp",
        slug: "beta-corp",
        companyEmail: "security@betafinancial.test",
        companyPhone: "+1 555-0202",
        companyAddress: "200 Beta Street, New York, NY",
        status: "active",
        subscriptionStatus: "active",
      });
    }

    // 3. Provision Manager & Employee for Company Alpha
    managerAlpha = await Admin.findOneAndUpdate(
      { email: "manager@alphalogistics.test" },
      {
        full_name: "Alice Manager (Alpha)",
        email: "manager@alphalogistics.test",
        password_hash: passwordHash,
        role: "manager",
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await User.findOneAndUpdate(
      { email: "manager@alphalogistics.test", companyId: companyAlpha._id },
      {
        fullName: "Alice Manager (Alpha)",
        name: "Alice Manager (Alpha)",
        email: "manager@alphalogistics.test",
        password: "SecurePass123!",
        role: "manager",
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
        status: "active",
        isActive: true,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    employeeAlpha = await Employee.findOneAndUpdate(
      { email: "worker@alphalogistics.test", companyId: companyAlpha._id },
      {
        employeeId: "ALP-001",
        fullName: "Aaron Staff (Alpha)",
        email: "worker@alphalogistics.test",
        password: "SecurePass123!",
        phone: "+1 555-0103",
        department: "Operations",
        position: "Logistics Specialist",
        baseSalary: 6500,
        role: "employee",
        status: "active",
        isActive: true,
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Attendance record for Employee Alpha
    attendanceAlpha = await Attendance.findOneAndUpdate(
      { employee: employeeAlpha._id, date: "2026-03-01" },
      {
        employee: employeeAlpha._id,
        employeeId: "ALP-001",
        date: "2026-03-01",
        clockInTime: new Date("2026-03-01T08:00:00.000Z"),
        clockOutTime: new Date("2026-03-01T17:00:00.000Z"),
        status: "present",
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Payroll record for Employee Alpha
    payrollAlpha = await Payroll.findOneAndUpdate(
      { companyId: companyAlpha._id, payslipNumber: "PAY-2026-ALP001" },
      {
        companyId: companyAlpha._id,
        organizationId: companyAlpha._id,
        employee: employeeAlpha._id,
        employeeId: "ALP-001",
        payslipNumber: "PAY-2026-ALP001",
        payMonth: "March 2026",
        payrollPeriod: { month: "March", year: 2026 },
        basicSalary: 6500,
        netSalary: 5900,
        netPay: 5900,
        status: "paid",
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // 4. Provision Manager & Employee for Company Beta
    managerBeta = await Admin.findOneAndUpdate(
      { email: "manager@betafinancial.test" },
      {
        full_name: "Bob Manager (Beta)",
        email: "manager@betafinancial.test",
        password_hash: passwordHash,
        role: "manager",
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await User.findOneAndUpdate(
      { email: "manager@betafinancial.test", companyId: companyBeta._id },
      {
        fullName: "Bob Manager (Beta)",
        name: "Bob Manager (Beta)",
        email: "manager@betafinancial.test",
        password: "SecurePass123!",
        role: "manager",
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
        status: "active",
        isActive: true,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    employeeBeta = await Employee.findOneAndUpdate(
      { email: "worker@betafinancial.test", companyId: companyBeta._id },
      {
        employeeId: "BET-001",
        fullName: "Bella Financial Analyst (Beta)",
        email: "worker@betafinancial.test",
        password: "SecurePass123!",
        phone: "+1 555-0203",
        department: "Finance",
        position: "Senior Analyst",
        baseSalary: 9500,
        role: "employee",
        status: "active",
        isActive: true,
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Attendance record for Employee Beta
    attendanceBeta = await Attendance.findOneAndUpdate(
      { employee: employeeBeta._id, date: "2026-03-01" },
      {
        employee: employeeBeta._id,
        employeeId: "BET-001",
        date: "2026-03-01",
        clockInTime: new Date("2026-03-01T08:45:00.000Z"),
        clockOutTime: new Date("2026-03-01T18:00:00.000Z"),
        status: "present",
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Payroll record for Employee Beta
    payrollBeta = await Payroll.findOneAndUpdate(
      { companyId: companyBeta._id, payslipNumber: "PAY-2026-BET001" },
      {
        companyId: companyBeta._id,
        organizationId: companyBeta._id,
        employee: employeeBeta._id,
        employeeId: "BET-001",
        payslipNumber: "PAY-2026-BET001",
        payMonth: "March 2026",
        payrollPeriod: { month: "March", year: 2026 },
        basicSalary: 9500,
        netSalary: 8200,
        netPay: 8200,
        status: "paid",
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // 5. Provision Platform Super-Admin
    superAdminUser = await User.findOneAndUpdate(
      { email: "platform.superadmin.test@workpulse.com" },
      {
        fullName: "Platform SuperAdmin",
        name: "Platform SuperAdmin",
        email: "platform.superadmin.test@workpulse.com",
        password: "SuperSecretPass123!",
        role: "superadmin",
        status: "active",
        isActive: true,
        companyId: null,
        organizationId: null,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // 5B. Provision Mohammed as Platform Super-Admin
    const mohammedHash = await bcrypt.hash("mohammed0244", 10);
    await Admin.findOneAndUpdate(
      { email: "mohammed@gmail.com" },
      {
        full_name: "Mohammed",
        email: "mohammed@gmail.com",
        password_hash: mohammedHash,
        role: "super_admin",
        organizationId: null,
        companyId: null,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await User.findOneAndUpdate(
      { email: "mohammed@gmail.com" },
      {
        fullName: "Mohammed",
        name: "Mohammed",
        email: "mohammed@gmail.com",
        password: mohammedHash,
        role: "super_admin",
        status: "active",
        isActive: true,
        organizationId: null,
        companyId: null,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // 6. Generate Authenticated JWTs
    tokenAlphaManager = jwt.sign(
      {
        id: managerAlpha._id.toString(),
        userId: managerAlpha._id.toString(),
        role: "manager",
        companyId: companyAlpha._id.toString(),
        organizationId: companyAlpha._id.toString(),
        email: managerAlpha.email,
        fullName: managerAlpha.full_name,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    tokenAlphaEmployee = jwt.sign(
      {
        id: employeeAlpha._id.toString(),
        employeeId: employeeAlpha.employeeId,
        role: "employee",
        companyId: companyAlpha._id.toString(),
        organizationId: companyAlpha._id.toString(),
        email: employeeAlpha.email,
        fullName: employeeAlpha.fullName,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    tokenBetaManager = jwt.sign(
      {
        id: managerBeta._id.toString(),
        userId: managerBeta._id.toString(),
        role: "manager",
        companyId: companyBeta._id.toString(),
        organizationId: companyBeta._id.toString(),
        email: managerBeta.email,
        fullName: managerBeta.full_name,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    tokenBetaEmployee = jwt.sign(
      {
        id: employeeBeta._id.toString(),
        employeeId: employeeBeta.employeeId,
        role: "employee",
        companyId: companyBeta._id.toString(),
        organizationId: companyBeta._id.toString(),
        email: employeeBeta.email,
        fullName: employeeBeta.fullName,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    tokenSuperAdmin = jwt.sign(
      {
        id: superAdminUser._id.toString(),
        userId: superAdminUser._id.toString(),
        role: "superadmin",
        email: superAdminUser.email,
        fullName: superAdminUser.fullName,
        companyId: null,
        organizationId: null,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  after(async () => {
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
        await User.deleteOne({ _id: superAdminUser._id }, { skipTenant: true });
      }
    } catch (e) {
      console.warn("Tenant isolation test cleanup warning:", e.message);
    }
    await closeMongodb();
  });

  // =========================================================================
  // Test 1: Cross-Company Employee Directory Isolation (List Query)
  // =========================================================================
  it("Test 1: Cross-Company Employee Directory Isolation (List Query)", async () => {
    const res = await request(app)
      .get("/api/admin/employees")
      .set("Authorization", `Bearer ${tokenAlphaManager}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.strictEqual(res.status, 200, "Should return 200 OK for valid company admin request");
    assert.ok(res.body.success, "Response should have success: true");

    const employees = res.body.employees || [];
    assert.ok(Array.isArray(employees), "Employees field should be an array");

    // Verify all returned records strictly belong to Company Alpha
    const betaEmployeesFound = employees.filter(
      (emp) =>
        String(emp.companyId) === String(companyBeta._id) ||
        String(emp.organizationId) === String(companyBeta._id) ||
        emp.email === "worker@betafinancial.test" ||
        emp.employeeId === "BET-001"
    );

    assert.strictEqual(
      betaEmployeesFound.length,
      0,
      "CRITICAL: Zero employees belonging to Company Beta must appear in Company Alpha's directory."
    );

    // Verify Company Alpha employee is returned
    const alphaEmployeeFound = employees.some(
      (emp) => emp.email === "worker@alphalogistics.test" || emp.employeeId === "ALP-001"
    );
    assert.ok(alphaEmployeeFound, "Company Alpha employee should be present in the directory");
  });

  // =========================================================================
  // Test 2: Direct Resource Access by ID (IDOR Attack on Employee Details)
  // =========================================================================
  it("Test 2: Direct Resource Access by ID (IDOR Attack on Employee Details)", async () => {
    const res = await request(app)
      .get(`/api/admin/employees/${employeeBeta._id}`)
      .set("Authorization", `Bearer ${tokenAlphaManager}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.ok(
      res.status === 403 || res.status === 404,
      `Cross-company employee lookup must return 403 or 404, received: ${res.status}`
    );

    // Ensure no sensitive profile or salary data leaked
    if (res.body) {
      assert.notStrictEqual(res.body.employee?.email, "worker@betafinancial.test");
      assert.notStrictEqual(res.body.employee?.baseSalary, 9500);
      assert.notStrictEqual(res.body.baseSalary, 9500);
    }
  });

  // =========================================================================
  // Test 3: Cross-Company Attendance Records Access
  // =========================================================================
  it("Test 3: Cross-Company Attendance Records Access (List & IDOR)", async () => {
    // 3A: Directory list query
    const listRes = await request(app)
      .get("/api/admin/attendance")
      .set("Authorization", `Bearer ${tokenAlphaManager}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.strictEqual(listRes.status, 200, "Should return 200 OK for valid admin attendance query");
    const attendanceRecords = listRes.body.attendance || [];

    const betaAttendanceFound = attendanceRecords.filter(
      (att) =>
        String(att.companyId) === String(companyBeta._id) ||
        String(att.organizationId) === String(companyBeta._id) ||
        att.employeeId === "BET-001"
    );

    assert.strictEqual(
      betaAttendanceFound.length,
      0,
      "CRITICAL: Zero attendance records from Company Beta must appear in Company Alpha's response."
    );

    // 3B: IDOR attack accessing Company Beta attendance record by ID
    const singleRes = await request(app)
      .get(`/api/admin/attendance/${attendanceBeta._id}`)
      .set("Authorization", `Bearer ${tokenAlphaManager}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.ok(
      singleRes.status === 403 || singleRes.status === 404,
      `Accessing Company Beta attendance by ID must return 403 or 404, received: ${singleRes.status}`
    );
  });

  // =========================================================================
  // Test 4: Cross-Company Payroll & Payslip Access
  // =========================================================================
  it("Test 4: Cross-Company Payroll & Payslip Access (IDOR)", async () => {
    const res = await request(app)
      .get(`/api/admin/payroll/payslips/${payrollBeta._id}`)
      .set("Authorization", `Bearer ${tokenAlphaManager}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.ok(
      res.status === 403 || res.status === 404,
      `Cross-company payslip access must return 403 or 404, received: ${res.status}`
    );

    // Ensure financial data (salary, tax, lateness deductions) is not exposed
    if (res.body?.payroll || res.body?.payslip) {
      assert.notStrictEqual(res.body.payroll?.basicSalary, 9500);
      assert.notStrictEqual(res.body.payslip?.basicSalary, 9500);
    }
  });

  // =========================================================================
  // Test 5: Cross-Company Modification & Deletion Attack
  // =========================================================================
  it("Test 5: Cross-Company Modification & Deletion Attack", async () => {
    // 5A: Modification attempt (status change)
    const updateRes = await request(app)
      .put(`/api/admin/employees/${employeeBeta._id}/status`)
      .set("Authorization", `Bearer ${tokenAlphaManager}`)
      .set("x-company-id", companyAlpha._id.toString())
      .send({ status: "terminated" });

    assert.ok(
      updateRes.status === 403 || updateRes.status === 404,
      `Modifying an employee belonging to Company Beta must return 403 or 404, received: ${updateRes.status}`
    );

    // 5B: Deletion attempt
    const deleteRes = await request(app)
      .delete(`/api/admin/employees/${employeeBeta._id}`)
      .set("Authorization", `Bearer ${tokenAlphaManager}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.ok(
      deleteRes.status === 403 || deleteRes.status === 404,
      `Deleting an employee belonging to Company Beta must return 403 or 404, received: ${deleteRes.status}`
    );

    // 5C: Verify in database that Company Beta employee was NOT modified and NOT deleted
    const betaEmpInDb = await Employee.findById(employeeBeta._id).lean();
    assert.ok(betaEmpInDb, "Employee Beta must still exist in the database");
    assert.strictEqual(
      betaEmpInDb.status,
      "active",
      "Employee Beta status must remain unchanged as 'active'"
    );
  });

  // =========================================================================
  // Test 6: Payload Tampering / Injection Attack
  // =========================================================================
  it("Test 6: Payload Tampering / Injection Attack (Client-supplied companyId ignored)", async () => {
    const forgedEmail = "injected.worker@alphalogistics.test";
    await Employee.deleteMany({ $or: [{ email: forgedEmail }, { employeeId: "ALP-999" }] });

    const createRes = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", `Bearer ${tokenAlphaManager}`)
      .set("x-company-id", companyAlpha._id.toString())
      .send({
        employeeId: "ALP-999",
        fullName: "Injected Employee",
        email: forgedEmail,
        password: "SecurePass123!",
        phone: "+1 555-0999",
        department: "Logistics",
        position: "Security Tester",
        baseSalary: 5000,
        // MALICIOUS PAYLOAD: Manager Alpha attempts to assign record into Company Beta
        companyId: companyBeta._id.toString(),
        organizationId: companyBeta._id.toString(),
      });

    assert.ok(
      createRes.status === 200 || createRes.status === 201,
      `Employee creation should succeed within authenticated tenant, received: ${createRes.status}`
    );

    // Assert in database that the created record is bound to Company Alpha, NOT Company Beta
    const createdEmp = await Employee.findOne({ email: forgedEmail }).lean();
    assert.ok(createdEmp, "Newly created employee must exist in database");

    assert.strictEqual(
      String(createdEmp.companyId),
      String(companyAlpha._id),
      "CRITICAL: The backend must strictly bind the new employee to Company Alpha, ignoring forged companyId."
    );

    assert.notStrictEqual(
      String(createdEmp.companyId),
      String(companyBeta._id),
      "CRITICAL: Record must NOT be bound to Company Beta."
    );
  });

  // =========================================================================
  // Test 7: Cross-Company Employee Self-Service Penetration
  // =========================================================================
  it("Test 7: Cross-Company Employee Self-Service Penetration", async () => {
    // 7A: Employee Alpha gets their own payslips
    const payslipsRes = await request(app)
      .get("/api/employee/payslips")
      .set("Authorization", `Bearer ${tokenAlphaEmployee}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.strictEqual(payslipsRes.status, 200, "Employee should be able to view their own payslips");
    const payslips = payslipsRes.body.payslips || payslipsRes.body.data || [];
    assert.ok(Array.isArray(payslips), "Payslips should be an array");

    // Verify zero payslips belonging to Company Beta or other employees
    const foreignPayslips = payslips.filter(
      (p) =>
        String(p.companyId) === String(companyBeta._id) ||
        p.employeeId === "BET-001" ||
        p.payslipNumber === "PAY-2026-BET001"
    );
    assert.strictEqual(foreignPayslips.length, 0, "No Company Beta payslips may be returned to Employee Alpha");

    // 7B: IDOR: Employee Alpha tries to view Employee Beta's payslip breakdown
    const idorPayslipRes = await request(app)
      .get(`/api/employee/payslip/${payrollBeta._id}`)
      .set("Authorization", `Bearer ${tokenAlphaEmployee}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.ok(
      idorPayslipRes.status === 403 || idorPayslipRes.status === 404,
      `Employee Alpha accessing Employee Beta payslip must return 403 or 404, received: ${idorPayslipRes.status}`
    );

    // 7C: Employee Alpha gets attendance records
    const attendanceRes = await request(app)
      .get("/api/employee/attendance")
      .set("Authorization", `Bearer ${tokenAlphaEmployee}`)
      .set("x-company-id", companyAlpha._id.toString());

    assert.strictEqual(attendanceRes.status, 200, "Employee should be able to view their own attendance");
    const empAttendance = attendanceRes.body.attendance || [];
    assert.ok(Array.isArray(empAttendance), "Attendance should be an array");

    const foreignAttendance = empAttendance.filter(
      (att) =>
        String(att.companyId) === String(companyBeta._id) ||
        att.employeeId === "BET-001"
    );
    assert.strictEqual(
      foreignAttendance.length,
      0,
      "No Company Beta attendance records may be returned to Employee Alpha"
    );
  });

  // =========================================================================
  // Test 8: Super-Admin Cross-Tenant Oversight (Privilege Escalation & Bypass Audit)
  // =========================================================================
  it("Test 8: Super-Admin Cross-Tenant Oversight (Privilege Escalation & Bypass Audit)", async () => {
    // 8A: Manager Alpha attempts to access /api/super-admin/companies (Must be rejected with 403)
    const unauthorizedManagerRes = await request(app)
      .get("/api/super-admin/companies")
      .set("Authorization", `Bearer ${tokenAlphaManager}`);

    assert.strictEqual(
      unauthorizedManagerRes.status,
      403,
      "Company Manager must be blocked with 403 Forbidden from accessing super-admin routes"
    );

    // 8B: Employee Alpha attempts to access /api/super-admin/companies (Must be rejected with 403)
    const unauthorizedEmployeeRes = await request(app)
      .get("/api/super-admin/companies")
      .set("Authorization", `Bearer ${tokenAlphaEmployee}`);

    assert.strictEqual(
      unauthorizedEmployeeRes.status,
      403,
      "Employee must be blocked with 403 Forbidden from accessing super-admin routes"
    );

    // 8C: Unauthenticated user attempts to access /api/super-admin/companies (Must be rejected with 401)
    const unauthenticatedRes = await request(app).get("/api/super-admin/companies");

    assert.strictEqual(
      unauthenticatedRes.status,
      401,
      "Unauthenticated access to super-admin routes must return 401 Unauthorized"
    );

    // 8D: Platform SuperAdmin accesses /api/super-admin/companies (Must succeed and bypass tenant filter)
    const superAdminRes = await request(app)
      .get("/api/super-admin/companies")
      .set("Authorization", `Bearer ${tokenSuperAdmin}`);

    assert.strictEqual(
      superAdminRes.status,
      200,
      "SuperAdmin should successfully access /api/super-admin/companies"
    );
    assert.ok(superAdminRes.body.success, "Response should indicate success");

    const companies = superAdminRes.body.companies || superAdminRes.body.data || [];
    assert.ok(Array.isArray(companies), "Companies list should be an array");

    // SuperAdmin must see both Company Alpha and Company Beta
    const hasAlpha = companies.some((c) => String(c._id) === String(companyAlpha._id));
    const hasBeta = companies.some((c) => String(c._id) === String(companyBeta._id));

    assert.ok(hasAlpha, "Platform SuperAdmin must be able to view Company Alpha");
    assert.ok(hasBeta, "Platform SuperAdmin must be able to view Company Beta");

    // 8E: Super-Admin Credential Authentication (mohammed@gmail.com / mohammed0244)
    const superAdminLoginRes = await request(app)
      .post("/api/super-admin/login")
      .send({
        email: "mohammed@gmail.com",
        password: "mohammed0244",
      });

    assert.strictEqual(
      superAdminLoginRes.status,
      200,
      `SuperAdmin login with mohammed@gmail.com must succeed, got: ${superAdminLoginRes.status}`
    );
    assert.ok(superAdminLoginRes.body.token, "Login must return an auth token");

    const mohammedCompaniesRes = await request(app)
      .get("/api/super-admin/companies")
      .set("Authorization", `Bearer ${superAdminLoginRes.body.token}`);

    assert.strictEqual(
      mohammedCompaniesRes.status,
      200,
      "mohammed@gmail.com token must successfully access /api/super-admin/companies"
    );
    assert.ok(mohammedCompaniesRes.body.success, "Response must indicate success");
    const mCompanies = mohammedCompaniesRes.body.companies || [];
    assert.ok(Array.isArray(mCompanies), "Companies list must be an array");
    assert.ok(mCompanies.length >= 2, "Must list all tenant companies platform-wide");
  });

  // =========================================================================
  // Test 9: Mongoose Model Audit & Mandatory companyId Compound Index Verification
  // =========================================================================
  it("Test 9: Mongoose Model Audit & Mandatory companyId Compound Index Verification", () => {
    const modelsToAudit = [
      { name: "Employee", model: Employee },
      { name: "Attendance", model: Attendance },
      { name: "Payroll", model: Payroll },
      { name: "Payslip", model: Payslip },
      { name: "Leave", model: Leave },
      { name: "Department", model: Department },
      { name: "Settings", model: Settings },
      { name: "ShiftPolicy", model: ShiftPolicy },
      { name: "Notification", model: Notification },
      { name: "Announcement", model: Announcement },
      { name: "AuditLog", model: AuditLog },
      { name: "Admin", model: Admin },
      { name: "User", model: User },
    ];

    for (const { name, model } of modelsToAudit) {
      // 1. Check companyId field existence
      const companyIdPath = model.schema.path("companyId");
      assert.ok(
        companyIdPath,
        `Model ${name} must include a mandatory 'companyId' field definition in schema`
      );

      // 2. Check compound index on { companyId: 1, _id: 1 }
      const indexes = model.schema.indexes();
      const hasCompoundIndex = indexes.some(([indexDef]) => {
        const keys = Object.keys(indexDef);
        return (
          keys.length === 2 &&
          keys[0] === "companyId" &&
          keys[1] === "_id" &&
          indexDef.companyId === 1 &&
          indexDef._id === 1
        );
      });

      assert.ok(
        hasCompoundIndex,
        `Model ${name} must contain a compound index on '{ companyId: 1, _id: 1 }'`
      );
    }
  });

  // =========================================================================
  // Test 10: authorizeCompanyTenant Express Middleware Verification
  // =========================================================================
  it("Test 10: authorizeCompanyTenant Middleware Verification", async () => {
    const mockReq = {
      originalUrl: "/api/admin/employees",
      method: "GET",
      user: {
        id: managerAlpha._id.toString(),
        role: "manager",
        companyId: companyAlpha._id.toString(),
      },
      headers: {},
      params: {},
      query: {},
    };

    let nextCalled = false;
    const mockRes = {
      status: (code) => ({
        json: (data) => ({ statusCode: code, data }),
      }),
    };

    await authorizeCompanyTenant(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled, "authorizeCompanyTenant must invoke next() for authorized session");
    assert.strictEqual(
      String(mockReq.companyId),
      String(companyAlpha._id),
      "Middleware must extract and attach companyId to req.companyId"
    );
    assert.strictEqual(
      String(mockReq.organizationId),
      String(companyAlpha._id),
      "Middleware must extract and attach organizationId to req.organizationId"
    );
    assert.ok(
      typeof mockReq.scopedTenantQuery === "function",
      "Middleware must attach scopedTenantQuery function to req"
    );
  });
});
