import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useRef, useMemo, useEffect } from "react";
import { Smile, Camera, UploadCloud, Shuffle, Check, X, Trash2, ZoomIn, RotateCw, Palette, AlertCircle, RefreshCw, Sliders } from "lucide-react";
import { uploadProfilePicture, removeProfilePicture } from "../apis/fontApis";
import { useManagement } from "../context/ManagementContextProvider";

// Available DiceBear avatar collections
export const AVATAR_STYLES = [
  { id: "personas", name: "Modern Personas", desc: "Clean, flat modern portraits" },
  { id: "lorelei", name: "Artistic Illustrated", desc: "Contemporary sketch portraits" },
  { id: "adventurer", name: "Expressive Adventurer", desc: "Vibrant character artwork" },
  { id: "avataaars", name: "Office Avataaars", desc: "Classic expressive avatars" },
  { id: "bottts", name: "Tech Bottts", desc: "Playful futuristic robots" },
  { id: "micah", name: "Line Art Micah", desc: "Minimalist modern face art" },
  { id: "notionists", name: "Notionist Editorial", desc: "Artistic monochrome style" },
  { id: "fun-emoji", name: "Fun 3D Emoji", desc: "Vibrant expressive faces" },
  { id: "initials", name: "Executive Monogram", desc: "Clean typographic gradients" },
  { id: "built-in", name: "Geometric Studio", desc: "Built-in offline vector gradients" },
];

// Color palette options for backgrounds
export const BG_COLORS = [
  { id: "002185", label: "Navy Blue", hex: "#002185", bgClass: "bg-[#002185]" },
  { id: "1e293b", label: "Slate Dark", hex: "#1e293b", bgClass: "bg-slate-800" },
  { id: "0284c7", label: "Sky Blue", hex: "#0284c7", bgClass: "bg-sky-600" },
  { id: "059669", label: "Emerald", hex: "#059669", bgClass: "bg-emerald-600" },
  { id: "7c3aed", label: "Violet", hex: "#7c3aed", bgClass: "bg-violet-600" },
  { id: "e11d48", label: "Rose Coral", hex: "#e11d48", bgClass: "bg-rose-600" },
  { id: "d97706", label: "Warm Amber", hex: "#d97706", bgClass: "bg-amber-600" },
  { id: "0d9488", label: "Teal Green", hex: "#0d9488", bgClass: "bg-teal-600" },
  { id: "transparent", label: "Transparent", hex: "transparent", bgClass: "bg-transparent border border-slate-300 dark:border-slate-600" },
];

// Curated seed suggestions for quick randomize
const SAMPLE_SEEDS = [
  "Sarah Mensah",
  "Kwame Asante",
  "Abena Osei",
  "Kofi Addo",
  "Akua Darko",
  "Yaw Boateng",
  "Ama Agyeman",
  "Esi Boakye",
  "Kweku Mensah",
  "Nana Yeboah",
  "Tech Pioneer",
  "Design Lead",
  "Global Strategist",
  "Operations Pro",
  "Atlas",
  "Orion",
  "Zenith",
  "Aura",
];

// Built-in SVG procedural avatars (guaranteed 100% offline support)
const generateBuiltinSvg = (seed = "User", colorHex = "002185") => {
  const safeColor = colorHex === "transparent" ? "#002185" : `#${colorHex.replace("#", "")}`;
  const initials = seed
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "EM";

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <defs>
      <linearGradient id="grad-${initials}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${safeColor}" stop-opacity="1"/>
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9"/>
      </linearGradient>
      <radialGradient id="glow" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="160" height="160" rx="80" fill="url(#grad-${initials})"/>
    <circle cx="80" cy="80" r="76" fill="url(#glow)"/>
    <circle cx="80" cy="80" r="68" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.2"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" fill="#ffffff" letter-spacing="1">
      ${initials}
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};

/**
 * Construct avatar URL based on style, seed, and background color
 */
export const buildAvatarUrl = (styleId, seed, bgColor) => {
  if (styleId === "built-in") {
    return generateBuiltinSvg(seed, bgColor);
  }

  const cleanSeed = encodeURIComponent(seed.trim() || "Employee");
  const bgParam = bgColor && bgColor !== "transparent" ? `&backgroundColor=${bgColor}` : "";
  return `https://api.dicebear.com/7.x/${styleId}/svg?seed=${cleanSeed}${bgParam}`;
};

export const AvatarGeneratorModal = ({
  isOpen,
  onClose,
  initialAvatarUrl = "",
  userName = "",
  _userRole = "Employee",
  initialTab = "generator",
  onAvatarSaved,
}) => {
  const { user, setUser, admin, setAdmin, setShowToast } = useManagement();

  // Active tab: 'generator' | 'upload'
  const [activeTab, setActiveTab] = useState(initialTab || "generator");

  // Generator states
  const [selectedStyle, setSelectedStyle] = useState("personas");
  const [seed, setSeed] = useState(userName || user?.fullName || admin?.fullName || "Employee");
  const [bgColor, setBgColor] = useState("002185");

  // Upload states
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Status & error states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Sync initial state on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || "generator");
      setErrorMessage("");
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setZoom(1);
      setRotation(0);
      if (userName || user?.fullName || admin?.fullName) {
        setSeed(userName || user?.fullName || admin?.fullName || "Employee");
      }
    }
  }, [isOpen, initialTab, userName, user?.fullName, admin?.fullName]);

  // Derived current generated avatar URL
  const currentGeneratedUrl = useMemo(() => {
    return buildAvatarUrl(selectedStyle, seed, bgColor);
  }, [selectedStyle, seed, bgColor]);

  // Quick preset preview variations for gallery
  const presetVariations = useMemo(() => {
    return AVATAR_STYLES.map((style) => ({
      ...style,
      url: buildAvatarUrl(style.id, seed, bgColor),
    }));
  }, [seed, bgColor]);

  // Handle Randomize Seed
  const handleRandomizeSeed = () => {
    const randomSeed = SAMPLE_SEEDS[Math.floor(Math.random() * SAMPLE_SEEDS.length)];
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    setSeed(`${randomSeed} ${randomSuffix}`);
  };

  // Handle File Drag & Selection
  const handleFileSelection = (file) => {
    setErrorMessage("");
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Invalid format. Only JPEG, PNG, and WEBP files are allowed.");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setErrorMessage("Image exceeds 5MB limit. Please choose a smaller photo.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);
    setZoom(1);
    setRotation(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Save selected avatar (either generated or uploaded file)
  const handleApplyAvatar = async () => {
    try {
      setIsSaving(true);
      setErrorMessage("");

      let res;

      if (activeTab === "upload") {
        if (!selectedFile) {
          setErrorMessage("Please select or drop an image file first.");
          setIsSaving(false);
          return;
        }
        const formData = new FormData();
        formData.append("avatar", selectedFile);
        res = await uploadProfilePicture(formData);
      } else {
        // Tab is generator: send generated avatar URL string
        const avatarToSave = currentGeneratedUrl;
        res = await uploadProfilePicture({
          avatar: avatarToSave,
          profilePicture: avatarToSave,
          profile_image_url: avatarToSave,
        });
      }

      if (res.data?.success) {
        const newUrl =
          res.data.avatarUrl ||
          res.data.profilePicture ||
          res.data.user?.avatar ||
          res.data.user?.profile_image_url ||
          (activeTab === "generator" ? currentGeneratedUrl : filePreviewUrl);

        // Update management contexts & localStorage
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

        // Broadcast event across windows and pages
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("avatarUpdated", { detail: { avatarUrl: newUrl } })
          );
          window.dispatchEvent(new Event("storage"));
        }

        if (typeof onAvatarSaved === "function") {
          onAvatarSaved(newUrl);
        }

        setShowToast({
          show: true,
          message: "Profile avatar successfully updated across your dashboard!",
          type: "success",
        });

        onClose();
      } else {
        throw new Error(res.data?.message || "Failed to update profile avatar.");
      }
    } catch (err) {
      console.error("Error saving avatar:", err);
      const msg =
        err.response?.data?.message || err.message || "Failed to save profile picture.";
      setErrorMessage(msg);
      setShowToast({
        show: true,
        message: msg,
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset/Remove avatar to default initials
  const handleRemoveAvatar = async () => {
    try {
      setIsDeleting(true);
      setErrorMessage("");

      const res = await removeProfilePicture();
      if (res.data?.success) {
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
          window.dispatchEvent(
            new CustomEvent("avatarUpdated", { detail: { avatarUrl: "" } })
          );
          window.dispatchEvent(new Event("storage"));
        }

        if (typeof onAvatarSaved === "function") {
          onAvatarSaved("");
        }

        setShowToast({
          show: true,
          message: "Profile avatar reset to standard initials.",
          type: "success",
        });

        onClose();
      }
    } catch (err) {
      console.error("Error removing avatar:", err);
      const msg =
        err.response?.data?.message || err.message || "Failed to reset avatar.";
      setShowToast({
        show: true,
        message: msg,
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-avatar-studio-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target.id === "modal-avatar-studio-backdrop") onClose();
      }}
    >
      <div className="w-full max-w-2xl mx-auto bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-5 sm:px-6 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#002185]/10 dark:bg-blue-900/30 text-[#002185] dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Profile Avatar & Visual Identity
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate an artistic avatar or upload an executive profile photo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto overflow-x-hidden flex-1">
          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("generator")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "generator"
                ? "bg-white dark:bg-[#162033] text-[#002185] dark:text-blue-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Smile className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Avatar Generator</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "upload"
                ? "bg-white dark:bg-[#162033] text-[#002185] dark:text-blue-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-blue-500" />
            <span>Upload Photo</span>
          </button>
        </div>

        {/* Error notice if any */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: AVATAR GENERATOR */}
        {activeTab === "generator" && (
          <div className="space-y-4">
            {/* Top Stage: Active Preview + Seed Input */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-5">
              {/* Central Big Avatar Preview */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-4 ring-[#002185]/20 dark:ring-blue-500/20 bg-white dark:bg-slate-800 shadow-md flex items-center justify-center transition-transform hover:scale-105">
                  <img
                    src={currentGeneratedUrl}
                    alt="Generated Avatar Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to local SVG generator if CDN fails
                      e.target.src = generateBuiltinSvg(seed, bgColor);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRandomizeSeed}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 transition-transform hover:rotate-180 cursor-pointer"
                  title="Randomize avatar seed"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Seed customizer & quick randomize */}
              <div className="flex-1 w-full space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    <span>Avatar Seed / Label</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRandomizeSeed}
                    className="text-[11px] font-semibold text-[#002185] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Shuffle Name</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Enter employee name or custom tag..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162033] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002185] dark:focus:ring-blue-500"
                />

                {/* Background color swatches */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-slate-400" />
                    Mood:
                  </span>
                  {BG_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setBgColor(c.id)}
                      className={`w-5 h-5 rounded-full ${c.bgClass} transition-transform cursor-pointer ${
                        bgColor === c.id ? "ring-2 ring-offset-2 ring-[#002185] scale-110" : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Style Collections Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Choose Art Style Collection ({AVATAR_STYLES.length} styles)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
                {presetVariations.map((item) => {
                  const isSelected = selectedStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedStyle(item.id)}
                      className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/60 border-[#002185] dark:border-blue-500 ring-2 ring-[#002185]/20 dark:ring-blue-400/30"
                          : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = generateBuiltinSvg(seed, bgColor);
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate w-full">
                        {item.name}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-[#002185] dark:text-blue-400">
                          <Check className="w-2.5 h-2.5" /> Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PHOTO UPLOADER */}
        {activeTab === "upload" && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
              accept="image/jpeg,image/png,image/webp,image/jpg"
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3 ${
                  dragOver
                    ? "border-[#002185] bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-[#002185] dark:hover:border-blue-500 bg-slate-50/60 dark:bg-slate-900/40"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#002185]/10 dark:bg-blue-900/30 text-[#002185] dark:text-blue-400 flex items-center justify-center">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Click to browse or drag and drop photo
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Supports high-resolution JPEG, PNG, or WEBP (Max 5MB)
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-[#002185] hover:bg-[#001760] text-white text-xs font-bold transition-all shadow-xs"
                >
                  Select Photo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Photo crop preview stage */}
                <div className="flex flex-col items-center justify-center py-2 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-[#002185] dark:border-blue-500 shadow-md relative bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                    <img
                      src={filePreviewUrl}
                      alt="Crop preview"
                      className="w-full h-full object-cover transition-transform duration-100"
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>

                  {/* Reset/Change photo button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreviewUrl(null);
                    }}
                    className="mt-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                  >
                    Choose different photo
                  </button>
                </div>

                {/* Zoom & Rotation sliders */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
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
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#002185] dark:accent-blue-500"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setRotation((prev) => (prev + 90) % 360)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-amber-500" />
                      <span>Rotate 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(1);
                        setRotation(0);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium cursor-pointer"
                    >
                      Reset Zoom
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800/80 shrink-0">
          <div>
            {(initialAvatarUrl || user?.profilePicture || user?.avatar || admin?.profile_image_url) && (
              <button
                type="button"
                disabled={isDeleting || isSaving}
                onClick={handleRemoveAvatar}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-semibold flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <WorkspaceLoader inline />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Reset to Initials</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              id="btn-apply-avatar-studio"
              disabled={isSaving || (activeTab === "upload" && !selectedFile)}
              onClick={handleApplyAvatar}
              className="px-5 py-2.5 rounded-xl bg-[#002185] hover:bg-[#001760] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {isSaving ? (
                <>
                  <WorkspaceLoader inline />
                  <span>Applying Avatar...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {activeTab === "generator" ? "Apply Generated Avatar" : "Save Photo"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarGeneratorModal;
