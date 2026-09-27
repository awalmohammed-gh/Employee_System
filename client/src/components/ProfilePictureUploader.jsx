import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useRef } from "react";
import { Camera, Upload, Trash2, Check, X, ZoomIn, RotateCw, Image as ImageIcon, AlertCircle, Palette } from "lucide-react";
import { uploadProfilePicture, removeProfilePicture } from "../apis/fontApis";
import { useManagement } from "../context/ManagementContextProvider";
import Avatar from "./Avatar";
import AvatarGeneratorModal from "./AvatarGeneratorModal";

export const ProfilePictureUploader = ({
  currentAvatarUrl = "",
  userName = "",
  userRole = "User",
  onAvatarUpdated,
  size = "lg", // "sm", "md", "lg", "xl"
}) => {
  const { user, setUser, admin, setAdmin, setShowToast } = useManagement();
  const fileInputRef = useRef(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Crop & Transform controls
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Derive active avatar
  const activeAvatar = previewUrl || currentAvatarUrl || admin?.profile_image_url || admin?.avatar || user?.profilePicture || user?.avatar || "";

  // Derive user initials
  const initials = (userName || admin?.fullName || user?.fullName || userRole)
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Validate and stage file
  const handleFileSelection = (file) => {
    setErrorMessage("");
    if (!file) return;

    // Validate type: strictly JPEG, PNG, WEBP
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      const err = "Invalid format. Only JPEG, PNG, and WEBP image files are allowed.";
      setErrorMessage(err);
      setShowToast({
        show: true,
        message: err,
        type: "error",
      });
      return;
    }

    // Validate size: max 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const err = "Image exceeds the 5MB maximum file size limit.";
      setErrorMessage(err);
      setShowToast({
        show: true,
        message: err,
        type: "error",
      });
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setZoom(1);
    setRotation(0);
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Perform upload
  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setErrorMessage("");

      const formData = new FormData();
      formData.append("avatar", selectedFile);

      const res = await uploadProfilePicture(formData);

      if (res.data?.success) {
        const newUrl = res.data.avatarUrl || res.data.profilePicture || res.data.user?.avatar || res.data.user?.profile_image_url;
        
        // Immediately update local preview
        setPreviewUrl(newUrl);

        // Update Management context and localStorage
        const updatedAdmin = {
          ...(admin || {}),
          profile_image_url: newUrl,
          avatar: newUrl,
          profilePicture: newUrl,
          profile_picture: newUrl,
        };

        const updatedUser = {
          ...(user || {}),
          profilePicture: newUrl,
          profile_picture: newUrl,
          profile_image_url: newUrl,
          avatar: newUrl,
          avatar_url: newUrl,
        };

        if (typeof setAdmin === "function") setAdmin(updatedAdmin);
        if (typeof setUser === "function") setUser(updatedUser);

        // Dispatch events for across-the-board instant UI update
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("avatarUpdated", { detail: { avatarUrl: newUrl } }));
          window.dispatchEvent(new Event("storage"));
        }

        if (typeof onAvatarUpdated === "function") {
          onAvatarUpdated(newUrl);
        }

        setShowToast({
          show: true,
          message: "Profile picture successfully updated in database!",
          type: "success",
        });

        setIsModalOpen(false);
        setSelectedFile(null);
      } else {
        throw new Error(res.data?.message || "Failed to upload image.");
      }
    } catch (err) {
      console.error("Upload avatar error:", err);
      const msg = err.response?.data?.message || err.message || "Failed to upload profile picture.";
      setErrorMessage(msg);
      setShowToast({
        show: true,
        message: msg,
        type: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Remove Picture
  const handleRemovePicture = async () => {
    try {
      setIsDeleting(true);
      const res = await removeProfilePicture();

      if (res.data?.success) {
        setPreviewUrl("");
        setSelectedFile(null);

        // Update Management context and localStorage
        const updatedAdmin = {
          ...(admin || {}),
          profile_image_url: "",
          avatar: "",
          profilePicture: "",
          profile_picture: "",
        };

        const updatedUser = {
          ...(user || {}),
          profilePicture: "",
          profile_picture: "",
          profile_image_url: "",
          avatar: "",
          avatar_url: "",
        };

        if (typeof setAdmin === "function") setAdmin(updatedAdmin);
        if (typeof setUser === "function") setUser(updatedUser);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("avatarUpdated", { detail: { avatarUrl: "" } }));
          window.dispatchEvent(new Event("storage"));
        }

        if (typeof onAvatarUpdated === "function") {
          onAvatarUpdated("");
        }

        setShowToast({
          show: true,
          message: "Profile picture removed successfully.",
          type: "success",
        });

        setIsModalOpen(false);
      }
    } catch (err) {
      console.error("Remove avatar error:", err);
      const msg = err.response?.data?.message || err.message || "Failed to remove profile picture.";
      setShowToast({
        show: true,
        message: msg,
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Size variations
  const sizeClasses = {
    sm: "w-10 h-10 text-xs",
    md: "w-16 h-16 text-base",
    lg: "w-24 h-24 text-2xl",
    xl: "w-32 h-32 text-4xl",
  }[size] || "w-24 h-24 text-2xl";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        id="profile-picture-file-input"
      />

      {/* Avatar Container with Hover Overlay & Drag-and-Drop */}
      <div
        className="relative group shrink-0"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div
          className={`${sizeClasses} rounded-3xl overflow-hidden shadow-md ${
            dragOver ? "ring-4 ring-[#ff5500] scale-105" : "ring-4 ring-[#002185]/10 dark:ring-blue-400/20 group-hover:ring-[#ff5500]/30"
          } transition-all duration-300 relative select-none`}
        >
          <Avatar
            src={activeAvatar}
            name={userName || admin?.fullName || user?.fullName || userRole}
            className="w-full h-full text-2xl font-black"
            shape="rounded"
            fallbackInitials={initials}
          />

          {/* Hover overlay button to trigger file picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-all duration-200 cursor-pointer"
            title="Upload new picture"
          >
            <Camera className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold">Change</span>
          </button>
        </div>

        {/* Small floating action button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#ff5500] hover:bg-[#e04b00] text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-800 transition-transform hover:scale-110 cursor-pointer"
          title="Upload new profile picture"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {/* Controls & Guideline details */}
      <div className="flex-1 text-center sm:text-left space-y-2">
        <div className="flex flex-wrap items-center gap-2.5 justify-center sm:justify-start">
          <button
            type="button"
            id="btn-open-avatar-studio-generator"
            onClick={() => setIsGeneratorModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer border border-transparent"
          >
            <Palette className="w-4 h-4" />
            <span>Customize Avatar</span>
          </button>

          <button
            type="button"
            id="btn-upload-avatar-file"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Upload Photo</span>
          </button>

          {activeAvatar && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleRemovePicture}
              className="px-3.5 py-2 rounded-xl border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <WorkspaceLoader inline />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Remove</span>
            </button>
          )}
        </div>

        <p className="text-xs text-[#64748B] flex items-center gap-1.5 justify-center sm:justify-start">
          <span>Allowed formats: <strong>JPEG, PNG, WEBP</strong>. Max size: <strong>5MB</strong>.</span>
        </p>
      </div>

      {/* Interactive Crop / Preview Modal */}
      {isModalOpen && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E2E8F0] dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#002185]/10 dark:bg-blue-900/30 text-[#002185] dark:text-blue-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-slate-100">Preview & Crop Avatar</h3>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">Adjust orientation before saving</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedFile(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-[#FEF2F2] dark:bg-red-950/30 border border-[#FCA5A5] dark:border-red-800 text-[#DC2626] dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Circular Preview Stage */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-44 h-44 rounded-full overflow-hidden border-4 border-[#002185] dark:border-blue-500 shadow-lg relative bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover transition-transform duration-150"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-2.5 font-medium">
                {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            </div>

            {/* Controls: Zoom & Rotate */}
            <div className="space-y-3 bg-[#F8FAFC] dark:bg-slate-800/50 p-3.5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-[#475569] dark:text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-[#002185] dark:text-blue-400" />
                  Zoom
                </span>
                <span>{(zoom * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#CBD5E1] dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#002185] dark:accent-blue-500"
              />

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#F1F5F9] dark:hover:bg-slate-700 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#ff5500]" />
                  <span>Rotate 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="text-xs text-[#64748B] dark:text-slate-400 hover:text-[#002185] dark:hover:text-blue-400 font-medium cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedFile(null);
                }}
                className="px-4 py-2 rounded-xl border border-[#CBD5E1] dark:border-slate-700 text-[#475569] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={handleConfirmUpload}
                className="px-5 py-2 rounded-xl bg-[#002185] hover:bg-[#ff5500] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isUploading ? (
                  <>
                    <WorkspaceLoader inline />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save & Update</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Avatar Studio / Generator Modal */}
      <AvatarGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        initialAvatarUrl={activeAvatar}
        userName={userName || admin?.fullName || user?.fullName}
        userRole={userRole}
        onAvatarSaved={(newUrl) => {
          setPreviewUrl(newUrl);
          if (typeof onAvatarUpdated === "function") {
            onAvatarUpdated(newUrl);
          }
        }}
      />
    </div>
  );
};

export default ProfilePictureUploader;
