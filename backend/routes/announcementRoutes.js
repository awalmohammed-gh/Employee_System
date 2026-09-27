import express from "express";
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  togglePinAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcementController.js";
import { verifyAdmin } from "../middleware/authAdmin.js";

const announcementRouter = express.Router();

// Public / Authenticated read access for both admins and employees
announcementRouter.get("/", getAnnouncements);
announcementRouter.get("/:id", getAnnouncementById);

// Admin-only management endpoints
announcementRouter.post("/", verifyAdmin, createAnnouncement);
announcementRouter.put("/:id", verifyAdmin, updateAnnouncement);
announcementRouter.patch("/:id/pin", verifyAdmin, togglePinAnnouncement);
announcementRouter.delete("/:id", verifyAdmin, deleteAnnouncement);

export default announcementRouter;
