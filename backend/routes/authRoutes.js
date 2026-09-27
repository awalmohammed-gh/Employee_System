import express from "express";
import {
  adminRegister,
  adminLogin,
  checkAdminExists,
  employeeLogin,
  authLogout,
  getAuthMe,
  unifiedLogin,
} from "../controllers/authController.js";

const authRouter = express.Router();

// Support CORS preflight requests
authRouter.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Unified Authentication Route
authRouter.post("/login", unifiedLogin);

// Admin Authentication Routes (Consolidated for /admin/auth)
authRouter.get("/admin/exists", checkAdminExists);
authRouter.post("/admin/register", adminRegister);
authRouter.post("/admin/login", adminLogin);
authRouter.post("/admin/logout", authLogout);

// Employee Authentication Routes
authRouter.post("/employee/login", employeeLogin);
authRouter.post("/employee/logout", authLogout);

// General Session Routes
authRouter.post("/logout", authLogout);
authRouter.get("/me", getAuthMe);

export default authRouter;
