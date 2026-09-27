import express from "express";
import { uploadAvatar, handleMulterError } from "../middleware/uploadMiddleware.js";
import { uploadProfilePicture, removeProfilePicture } from "../controllers/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const userRouter = express.Router();

// Profile picture upload endpoint (accepts multipart/form-data under key 'avatar', 'profilePicture', 'image', or JSON body)
userRouter.patch(
  "/profile-picture",
  requireAuth,
  uploadAvatar.any(),
  handleMulterError,
  uploadProfilePicture
);

userRouter.post(
  "/profile-picture",
  requireAuth,
  uploadAvatar.any(),
  handleMulterError,
  uploadProfilePicture
);

userRouter.put(
  "/profile-picture",
  requireAuth,
  uploadAvatar.any(),
  handleMulterError,
  uploadProfilePicture
);

// Remove Profile Picture
userRouter.delete("/profile-picture", requireAuth, removeProfilePicture);

export default userRouter;
