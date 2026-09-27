import express from "express";
import { employeeAuth } from "../middleware/employeeAuth.js";
import {
  applyLeave,
  getAllLeaves,
  getEmployeeLeave,
  getLeaveEmployeeStats,
  updateLeaveStatus,
  deleteLeave,
} from "../controllers/leaveController.js";
import { verifyAdmin } from "../middleware/authAdmin.js";
import { Leave } from "../models/leaveModel.js";
import { validateOrganizationAccess } from "../middleware/validateOrganizationAccess.js";

const leaveRouter = express.Router();

// ================= Employee =================

// Apply for leave
leaveRouter.post("/apply", employeeAuth, applyLeave);
leaveRouter.post("/request", employeeAuth, applyLeave);

// Get logged-in employee's leave history
leaveRouter.get("/my-leaves", employeeAuth, getEmployeeLeave);
leaveRouter.get("/leave-requests", employeeAuth, getEmployeeLeave);
leaveRouter.get("/requests", employeeAuth, getEmployeeLeave);
leaveRouter.get("/history", employeeAuth, getEmployeeLeave);

// Aggregated leave statistics strictly for authenticated employee
leaveRouter.get("/employee-stats", employeeAuth, getLeaveEmployeeStats);
leaveRouter.get("/stats", employeeAuth, getLeaveEmployeeStats);

// Delete leave (Employee can delete own pending request, or Admin) - verified with validateOrganizationAccess
leaveRouter.delete("/:id", employeeAuth, validateOrganizationAccess(Leave), deleteLeave);
leaveRouter.delete("/request/:id", employeeAuth, validateOrganizationAccess(Leave), deleteLeave);

// ================= Admin =================

// Get all leave applications
leaveRouter.get("/all", verifyAdmin, getAllLeaves);
leaveRouter.get("/", verifyAdmin, getAllLeaves);

// Approve or Reject leave - verified with validateOrganizationAccess
leaveRouter.patch("/status/:id", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
leaveRouter.put("/status/:id", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
leaveRouter.patch("/:id/status", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
leaveRouter.put("/:id/status", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
leaveRouter.patch("/:id", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
leaveRouter.put("/:id", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);

// Admin-only delete route - verified with validateOrganizationAccess
leaveRouter.delete("/admin/:id", verifyAdmin, validateOrganizationAccess(Leave), deleteLeave);

export default leaveRouter;
