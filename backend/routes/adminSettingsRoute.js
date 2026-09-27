import express from "express";
import {
  getSettings,
  getPenaltySettings,
  updatePenaltySettings,
  updateAttendanceSettings,
  updateCompanySettings,
  updateEmployeeSettings,
  updateLeaveSettings,
  updatePayrollSettings,
  updateSecuritySettings,
} from "../controllers/adminSettingsController.js";
import { verifyAdmin } from "../middleware/authAdmin.js";
import { protect } from "../middleware/authMiddleware.js";

const settingsRouter = express.Router();

// Allow authenticated employees and admins to read settings and penalty rules
settingsRouter.get("/get-settings", protect, getSettings);
settingsRouter.get("/penalties", protect, getPenaltySettings);
settingsRouter.put("/penalties", verifyAdmin, updatePenaltySettings);

settingsRouter.put("/company", verifyAdmin, updateCompanySettings);
settingsRouter.put("/employee", verifyAdmin, updateEmployeeSettings);
settingsRouter.put("/payroll", verifyAdmin, updatePayrollSettings);
settingsRouter.put("/leave", verifyAdmin, updateLeaveSettings);
settingsRouter.put("/attendance", verifyAdmin, updateAttendanceSettings);
settingsRouter.put("/security", verifyAdmin, updateSecuritySettings);

export default settingsRouter;
