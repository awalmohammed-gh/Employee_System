import "dotenv/config";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { User } from "../models/userModel.js";
import { Employee } from "../models/employeeModel.js";
import { Attendance } from "../models/attendanceModel.js";
import { Payroll } from "../models/payrollModel.js";
import { Leave } from "../models/leaveModel.js";
import { Settings } from "../models/adminSettingsModel.js";
import { Announcement } from "../models/announcementModel.js";
import { Notification } from "../models/notificationModel.js";
import { connectMongodb, closeMongodb } from "../config/mongodb.js";

const seedRealData = async () => {
  try {
    console.log("Connecting to MongoDB via consolidated lifecycle for seed...");
    await connectMongodb();
    console.log("✅ MongoDB Connected successfully.");

    // 1. Seed / Upsert Settings
    console.log("🔧 Seeding Company Settings...");
    await Settings.findOneAndUpdate(
      {},
      {
        $set: {
          company: {
            companyName: "EYENIT Technologies Ltd",
            logo: "",
            address: "14 Independence Avenue, Ridge, Accra, Ghana",
            phone: "+233 24 000 1234",
            email: "info@eyenit.com",
            website: "https://eyenit.com",
          },
          payroll: {
            currency: "GHS",
            currencySymbol: "₵",
            payrollFrequency: "Monthly",
            paymentDate: 25,
            paymentMethods: ["Bank Transfer", "Mobile Money", "Cash"],
          },
          attendance: {
            workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            workStartTime: "08:00",
            workEndTime: "19:00",
            lateAfterMinutes: 15,
            overtimeEnabled: true,
          },
          leave: {
            annualLeaveDays: 20,
            sickLeaveDays: 10,
            casualLeaveDays: 5,
            maternityLeaveDays: 90,
            paternityLeaveDays: 14,
            requireApproval: true,
          },
          security: {
            twoFactorAuthentication: false,
            sessionTimeout: 60,
            maxLoginAttempts: 5,
            passwordExpiryDays: 90,
          },
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // 2. Seed Super Admin
    console.log("👤 Seeding System Administrator...");
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@eyenit.com").toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PSD || "admin123";
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

    await Admin.findOneAndUpdate(
      { email: adminEmail },
      {
        $set: {
          full_name: "System Administrator",
          email: adminEmail,
          password_hash: adminPasswordHash,
          role: "super_admin",
          profile_image_url: "",
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await User.findOneAndUpdate(
      { email: adminEmail },
      {
        $set: {
          fullName: "System Administrator",
          email: adminEmail,
          password: adminPasswordHash,
          role: "admin",
          status: "active",
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // 3. Seed 8 Diverse Employees
    console.log("👥 Seeding 8 realistic Employee accounts across departments...");
    const defaultEmployeePassword = await bcrypt.hash("password123", 10);

    const employeeDefs = [
      {
        fullName: "Kwame Mensah",
        employeeId: "EMP-1001",
        email: "kwame.mensah@eyenit.com",
        phone: "+233 24 111 2233",
        department: "Engineering",
        position: "Lead Software Architect",
        baseSalary: 12500,
        role: "employee",
        status: "active",
        employmentDate: new Date("2022-03-15"),
        totalLeaveDays: 20,
        usedLeaveDays: 4,
        leaveBalance: 16,
      },
      {
        fullName: "Abena Osei",
        employeeId: "EMP-1002",
        email: "abena.osei@eyenit.com",
        phone: "+233 20 222 3344",
        department: "HR",
        position: "Human Resources Specialist",
        baseSalary: 8200,
        role: "hr",
        status: "active",
        employmentDate: new Date("2022-06-01"),
        totalLeaveDays: 20,
        usedLeaveDays: 2,
        leaveBalance: 18,
      },
      {
        fullName: "Kofi Boateng",
        employeeId: "EMP-1003",
        email: "kofi.boateng@eyenit.com",
        phone: "+233 26 333 4455",
        department: "Marketing",
        position: "Growth Marketing Manager",
        baseSalary: 9500,
        role: "employee",
        status: "active",
        employmentDate: new Date("2023-01-10"),
        totalLeaveDays: 20,
        usedLeaveDays: 5,
        leaveBalance: 15,
      },
      {
        fullName: "Akosua Danquah",
        employeeId: "EMP-1004",
        email: "akosua.danquah@eyenit.com",
        phone: "+233 50 444 5566",
        department: "Finance",
        position: "Senior Financial Analyst",
        baseSalary: 11000,
        role: "employee",
        status: "active",
        employmentDate: new Date("2022-09-20"),
        totalLeaveDays: 20,
        usedLeaveDays: 3,
        leaveBalance: 17,
      },
      {
        fullName: "Yaw Addo",
        employeeId: "EMP-1005",
        email: "yaw.addo@eyenit.com",
        phone: "+233 54 555 6677",
        department: "Product",
        position: "Principal Product Manager",
        baseSalary: 13000,
        role: "manager",
        status: "active",
        employmentDate: new Date("2021-11-05"),
        totalLeaveDays: 20,
        usedLeaveDays: 6,
        leaveBalance: 14,
      },
      {
        fullName: "Efua Sutherland",
        employeeId: "EMP-1006",
        email: "efua.sutherland@eyenit.com",
        phone: "+233 27 666 7788",
        department: "Operations",
        position: "Operations Supervisor",
        baseSalary: 7800,
        role: "employee",
        status: "active",
        employmentDate: new Date("2023-04-12"),
        totalLeaveDays: 20,
        usedLeaveDays: 1,
        leaveBalance: 19,
      },
      {
        fullName: "Esi Quaye",
        employeeId: "EMP-1007",
        email: "esi.quaye@eyenit.com",
        phone: "+233 24 777 8899",
        department: "Design",
        position: "Senior UI/UX Designer",
        baseSalary: 9800,
        role: "employee",
        status: "active",
        employmentDate: new Date("2023-02-18"),
        totalLeaveDays: 20,
        usedLeaveDays: 2,
        leaveBalance: 18,
      },
      {
        fullName: "Kojo Owusu",
        employeeId: "EMP-1008",
        email: "kojo.owusu@eyenit.com",
        phone: "+233 55 888 9900",
        department: "Support",
        position: "Customer Success Lead",
        baseSalary: 7200,
        role: "employee",
        status: "active",
        employmentDate: new Date("2023-07-01"),
        totalLeaveDays: 20,
        usedLeaveDays: 0,
        leaveBalance: 20,
      },
    ];

    const seededEmployees = [];

    for (const def of employeeDefs) {
      const empDoc = await Employee.findOneAndUpdate(
        { email: def.email },
        {
          $set: {
            ...def,
            password: defaultEmployeePassword,
            isActive: true,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      await User.findOneAndUpdate(
        { email: def.email },
        {
          $set: {
            fullName: def.fullName,
            email: def.email,
            password: defaultEmployeePassword,
            role: def.role,
            status: "active",
            isActive: true,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      seededEmployees.push(empDoc);
    }

    console.log(`✅ Seeded ${seededEmployees.length} employees successfully.`);

    // 4. Seed 30 Days of Attendance per Employee
    console.log("📅 Seeding 30 days of realistic attendance records per employee...");
    const now = new Date();
    const attendanceRecords = [];

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const targetDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const dayOfWeek = targetDate.getDay(); // 0 = Sun, 6 = Sat
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      const dateStr = targetDate.toISOString().split("T")[0];

      for (let i = 0; i < seededEmployees.length; i++) {
        const emp = seededEmployees[i];
        // Deterministic variation based on day and employee index
        const patternVal = (dayOffset + i * 3) % 10;

        let status = "On Time";
        let delayMinutes = 0;
        let latePenalty = 0;
        let penaltyTier = "";
        let workHours = 8.5;
        let clockIn = null;
        let clockOut = null;

        if (patternVal === 9) {
          // Absent day
          status = "Absent";
          workHours = 0;
          clockIn = null;
          clockOut = null;
        } else if (patternVal >= 6) {
          // Late arrival
          status = "Late";
          delayMinutes = 20 + ((dayOffset * 7 + i) % 35); // 20 to 54 mins
          if (delayMinutes <= 15) {
            penaltyTier = "Grace (0-15m)";
            latePenalty = 0;
          } else if (delayMinutes <= 30) {
            penaltyTier = "Tier 1 (16-30m)";
            latePenalty = 15;
          } else if (delayMinutes <= 60) {
            penaltyTier = "Tier 2 (31-60m)";
            latePenalty = 30;
          } else {
            penaltyTier = "Tier 3 (>60m)";
            latePenalty = 50;
          }
          workHours = Math.max(7.2, Number((8.5 - delayMinutes / 60).toFixed(2)));

          const [yr, mo, dy] = dateStr.split("-").map(Number);
          clockIn = new Date(Date.UTC(yr, mo - 1, dy, 8, delayMinutes, 0));
          clockOut = new Date(Date.UTC(yr, mo - 1, dy, 17, 10, 0));
        } else {
          // On Time
          status = "On Time";
          delayMinutes = 0;
          latePenalty = 0;
          penaltyTier = "On Time";
          workHours = 8.5;

          const [yr, mo, dy] = dateStr.split("-").map(Number);
          const earlyMins = (dayOffset + i) % 10; // Arrived 0-10m before 8:00
          clockIn = new Date(Date.UTC(yr, mo - 1, dy, 7, 50 + earlyMins, 0));
          clockOut = new Date(Date.UTC(yr, mo - 1, dy, 17, 0, 0));
        }

        attendanceRecords.push({
          employee: emp._id,
          employeeId: emp.employeeId,
          date: dateStr,
          clockIn,
          clockInTime: clockIn,
          clockOut,
          clockOutTime: clockOut,
          workHours,
          status,
          delayMinutes,
          lateMinutes: delayMinutes,
          latePenalty,
          penaltyTier,
          notes: status === "Absent" ? "Unexcused Absence" : status === "Late" ? "Traffic delay" : "Standard shift",
        });
      }
    }

    // Upsert attendance records
    for (const record of attendanceRecords) {
      await Attendance.findOneAndUpdate(
        { employee: record.employee, date: record.date },
        { $set: record },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ Seeded ${attendanceRecords.length} attendance records.`);

    // 5. Seed Payslips with mathematically verified net calculations
    console.log("💰 Seeding verified Payslips (Published and Draft)...");
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    const currentPayMonth = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`;
    const prevMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
    const prevYearNum = currentMonthNum === 1 ? currentYear - 1 : currentYear;
    const prevPayMonth = `${prevYearNum}-${String(prevMonthNum).padStart(2, "0")}`;

    const monthsToSeed = [
      { payMonth: prevPayMonth, status: "Paid", isPrevious: true },
      { payMonth: currentPayMonth, status: "Published", isPrevious: false },
    ];

    for (const m of monthsToSeed) {
      for (let i = 0; i < seededEmployees.length; i++) {
        const emp = seededEmployees[i];
        const payslipNumber = `PS-${m.payMonth.replace("-", "")}-${emp.employeeId.replace("EMP-", "")}`;

        const baseSalary = emp.baseSalary;
        const allowances = Math.round(baseSalary * 0.1); // 10% allowance
        const absentDeduction = (i % 3 === 0) ? Math.round((baseSalary / 22) * 1) : 0; // 1 day absence for some
        const latenessDeduction = (i % 2 === 0) ? 45 : 0;
        const customDeductions = [
          { title: "Income Tax (PAYE)", description: "Standard statutory tax", amount: Math.round(baseSalary * 0.05) },
          { title: "Social Security (SSNIT)", description: "5.5% Tier 1 contribution", amount: Math.round(baseSalary * 0.055) },
        ];
        const totalCustomDeductions = customDeductions.reduce((sum, d) => sum + d.amount, 0);

        const totalDeductions = absentDeduction + latenessDeduction + totalCustomDeductions;
        const netSalary = Math.max(0, baseSalary + allowances - totalDeductions);

        const breakdown = {
          baseSalary,
          allowances,
          grossEarnings: baseSalary + allowances,
          absenceDeduction: {
            daysCount: absentDeduction > 0 ? 1 : 0,
            ratePerDay: Math.round(baseSalary / 22),
            totalAmount: absentDeduction,
          },
          latenessDeduction: {
            lateDaysCount: latenessDeduction > 0 ? 2 : 0,
            totalLateMinutes: latenessDeduction > 0 ? 55 : 0,
            totalAmount: latenessDeduction,
          },
          customDeductions,
          totalDeductions,
          netPay: netSalary,
        };

        const paymentDate = new Date(`${m.payMonth}-25T12:00:00.000Z`);

        await Payroll.findOneAndUpdate(
          { employee: emp._id, payMonth: m.payMonth },
          {
            $set: {
              employee: emp._id,
              payslipNumber,
              payMonth: m.payMonth,
              paymentDate,
              basicSalary: baseSalary,
              baseSalary: baseSalary,
              allowances,
              absentDaysDeduction: absentDeduction,
              latenessDeduction: latenessDeduction,
              totalAttendanceDeductions: absentDeduction + latenessDeduction,
              originalAbsenceDeduction: absentDeduction,
              originalLatenessDeduction: latenessDeduction,
              customDeductions,
              deductions: customDeductions,
              earnings: [{ title: "Transport & Housing Allowance", description: "Standard company allowance", amount: allowances }],
              breakdown,
              netSalary,
              netPay: netSalary,
              paymentMethod: i % 2 === 0 ? "Bank Transfer" : "Mobile Money",
              status: m.status,
              remarks: `Verified ${m.status} payslip for ${m.payMonth}`,
            },
          },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
      }
    }
    console.log("✅ Seeded verified payslips for all employees.");

    // 6. Seed Leave Requests
    console.log("🏖️ Seeding Leave requests...");
    const leaveTypes = ["Annual Leave", "Sick Leave", "Casual Leave"];
    for (let i = 0; i < seededEmployees.length; i++) {
      const emp = seededEmployees[i];
      const status = i % 3 === 0 ? "Approved" : i % 3 === 1 ? "Pending" : "Rejected";
      const start = new Date(Date.UTC(currentYear, currentMonthNum - 1, 10 + (i % 10)));
      const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);

      await Leave.findOneAndUpdate(
        { employee: emp._id, reason: `Personal leave request by ${emp.fullName}` },
        {
          $set: {
            employee: emp._id,
            leaveType: leaveTypes[i % leaveTypes.length],
            startDate: start,
            endDate: end,
            totalDays: 2,
            reason: `Personal leave request by ${emp.fullName}`,
            status,
            adminRemark: status === "Approved" ? "Approved by HR" : status === "Rejected" ? "Overlap with high workload" : "",
            reviewedAt: status !== "Pending" ? new Date() : null,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
    }
    console.log("✅ Seeded leave requests.");

    // 7. Seed Announcements
    console.log("📢 Seeding Company Announcements...");
    const announcements = [
      {
        title: "All-Hands Quarterly Strategy Meeting",
        content: "Please join our Q3 Company All-Hands meeting this Friday at 2:00 PM GMT in the main conference hall and online.",
        priority: "high",
        category: "Company",
        isPinned: true,
        department: "All",
        author: "System Administrator",
      },
      {
        title: "Updated Health & Wellness Benefits",
        content: "New health insurance tiers and wellness coverage are now active for all full-time staff.",
        priority: "medium",
        category: "HR",
        isPinned: false,
        department: "HR",
        author: "Abena Osei",
      },
    ];

    for (const ann of announcements) {
      await Announcement.findOneAndUpdate(
        { title: ann.title },
        { $set: ann },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
    }
    console.log("✅ Seeded announcements.");

    // 8. Seed Notifications
    console.log("🔔 Seeding Initial System Notifications...");
    for (const emp of seededEmployees.slice(0, 4)) {
      await Notification.findOneAndUpdate(
        { recipient: emp._id, title: "Payslip Published" },
        {
          $set: {
            recipient: emp._id,
            recipient_id: String(emp._id),
            title: "Payslip Published",
            message: `Your payslip for ${currentPayMonth} has been published and is ready for review.`,
            type: "payroll",
            category: "Payroll",
            is_read: false,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
    }
    console.log("✅ Seeded notifications.");

    console.log("🎉 Complete production-ready database seed finished successfully!");
    await closeMongodb();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error running seedRealData:", error);
    process.exit(1);
  }
};

seedRealData();
