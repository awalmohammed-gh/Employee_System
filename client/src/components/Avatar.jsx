import React, { useState, useMemo } from "react";

/**
 * Curated list of accessible, harmonious background & text color pairings
 * with dark mode variations and matching subtle rings.
 */
export const AVATAR_COLOR_PALETTES = [
  {
    bg: "bg-blue-600 dark:bg-blue-700",
    text: "text-white",
    ring: "ring-blue-500/25 dark:ring-blue-400/20",
    badge: "#2563eb",
  },
  {
    bg: "bg-indigo-600 dark:bg-indigo-700",
    text: "text-white",
    ring: "ring-indigo-500/25 dark:ring-indigo-400/20",
    badge: "#4f46e5",
  },
  {
    bg: "bg-purple-600 dark:bg-purple-700",
    text: "text-white",
    ring: "ring-purple-500/25 dark:ring-purple-400/20",
    badge: "#9333ea",
  },
  {
    bg: "bg-emerald-600 dark:bg-emerald-700",
    text: "text-white",
    ring: "ring-emerald-500/25 dark:ring-emerald-400/20",
    badge: "#059669",
  },
  {
    bg: "bg-teal-600 dark:bg-teal-700",
    text: "text-white",
    ring: "ring-teal-500/25 dark:ring-teal-400/20",
    badge: "#0d9488",
  },
  {
    bg: "bg-cyan-600 dark:bg-cyan-700",
    text: "text-white",
    ring: "ring-cyan-500/25 dark:ring-cyan-400/20",
    badge: "#0891b2",
  },
  {
    bg: "bg-amber-600 dark:bg-amber-700",
    text: "text-white",
    ring: "ring-amber-500/25 dark:ring-amber-400/20",
    badge: "#d97706",
  },
  {
    bg: "bg-orange-600 dark:bg-orange-700",
    text: "text-white",
    ring: "ring-orange-500/25 dark:ring-orange-400/20",
    badge: "#ea580c",
  },
  {
    bg: "bg-rose-600 dark:bg-rose-700",
    text: "text-white",
    ring: "ring-rose-500/25 dark:ring-rose-400/20",
    badge: "#e11d48",
  },
  {
    bg: "bg-[#002185] dark:bg-blue-900",
    text: "text-white",
    ring: "ring-[#002185]/25 dark:ring-blue-700/20",
    badge: "#002185",
  },
  {
    bg: "bg-violet-600 dark:bg-violet-700",
    text: "text-white",
    ring: "ring-violet-500/25 dark:ring-violet-400/20",
    badge: "#7c3aed",
  },
  {
    bg: "bg-fuchsia-600 dark:bg-fuchsia-700",
    text: "text-white",
    ring: "ring-fuchsia-500/25 dark:ring-fuchsia-400/20",
    badge: "#c026d3",
  },
  {
    bg: "bg-sky-600 dark:bg-sky-700",
    text: "text-white",
    ring: "ring-sky-500/25 dark:ring-sky-400/20",
    badge: "#0284c7",
  },
  {
    bg: "bg-pink-600 dark:bg-pink-700",
    text: "text-white",
    ring: "ring-pink-500/25 dark:ring-pink-400/20",
    badge: "#db2777",
  },
];

/**
 * Deterministic hash algorithm that maps any string (name, email, id) to a consistent palette index.
 */
export const getAvatarColorPalette = (identifier = "") => {
  if (!identifier || typeof identifier !== "string") {
    return AVATAR_COLOR_PALETTES[0];
  }
  const clean = identifier.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % AVATAR_COLOR_PALETTES.length;
  return AVATAR_COLOR_PALETTES[index];
};

/**
 * Extracts 1-2 character initials from a full name, title, or email.
 */
export const getInitials = (name = "", fallback = "EM") => {
  if (!name || typeof name !== "string") return fallback;
  const clean = name.trim();
  if (!clean) return fallback;

  // If email passed, take first letters of local part
  if (clean.includes("@")) {
    const local = clean.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
    return getInitials(local, fallback);
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) {
    const single = parts[0].replace(/[^a-zA-Z0-9]/g, "");
    return (single.slice(0, 2) || fallback).toUpperCase();
  }

  const firstChar = parts[0].charAt(0);
  const lastChar = parts[parts.length - 1].charAt(0);
  return `${firstChar}${lastChar}`.toUpperCase();
};

const SIZE_STYLES = {
  xs: {
    container: "w-6 h-6 min-w-6 min-h-6 text-[10px]",
    statusDot: "w-1.5 h-1.5 ring-1",
    indicatorOffset: "bottom-0 right-0",
  },
  sm: {
    container: "w-8 h-8 min-w-8 min-h-8 text-xs",
    statusDot: "w-2 h-2 ring-1",
    indicatorOffset: "bottom-0 right-0",
  },
  md: {
    container: "w-10 h-10 min-w-10 min-h-10 text-sm",
    statusDot: "w-2.5 h-2.5 ring-2",
    indicatorOffset: "bottom-0 right-0",
  },
  lg: {
    container: "w-12 h-12 min-w-12 min-h-12 text-base",
    statusDot: "w-3 h-3 ring-2",
    indicatorOffset: "bottom-0 right-0",
  },
  xl: {
    container: "w-16 h-16 min-w-16 min-h-16 text-xl",
    statusDot: "w-3.5 h-3.5 ring-2",
    indicatorOffset: "bottom-0.5 right-0.5",
  },
  "2xl": {
    container: "w-20 h-20 min-w-20 min-h-20 text-2xl",
    statusDot: "w-4 h-4 ring-2",
    indicatorOffset: "bottom-1 right-1",
  },
  "3xl": {
    container: "w-24 h-24 min-w-24 min-h-24 text-3xl",
    statusDot: "w-5 h-5 ring-2",
    indicatorOffset: "bottom-1.5 right-1.5",
  },
};

const SHAPE_STYLES = {
  circle: "rounded-full",
  rounded: "rounded-xl",
  square: "rounded-none",
};

const STATUS_COLORS = {
  online: "bg-emerald-500",
  active: "bg-emerald-500",
  offline: "bg-slate-400 dark:bg-slate-500",
  inactive: "bg-slate-400 dark:bg-slate-500",
  away: "bg-amber-500",
  busy: "bg-rose-500",
  "on leave": "bg-purple-500",
};

/**
 * Reusable Avatar component with guaranteed robust fallback UI.
 * Renders user image if valid, or calculates deterministic hash color initials.
 */
export const Avatar = ({
  src,
  avatarUrl,
  avatar_url,
  profilePicture,
  profile_picture,
  profile_image_url,
  avatar,
  image,
  name = "",
  fullName = "",
  userName = "",
  email = "",
  id,
  size = "md",
  shape = "circle",
  className = "",
  textClassName = "",
  alt,
  status = null,
  showStatus = false,
  onClick,
  fallbackInitials,
}) => {
  const [imageError, setImageError] = useState(false);

  // Normalize image source from various common field names
  const resolvedSrc = useMemo(() => {
    const raw = src || avatarUrl || avatar_url || profilePicture || profile_picture || profile_image_url || avatar || image;
    if (typeof raw === "string" && raw.trim() !== "") {
      return raw.trim();
    }
    return null;
  }, [src, avatarUrl, avatar_url, profilePicture, profile_picture, profile_image_url, avatar, image]);

  // Reset error state if image src changes
  React.useEffect(() => {
    setImageError(false);
  }, [resolvedSrc]);

  // Determine user identifier for name and color hashing
  const displayName = name || fullName || userName || email || "User";
  const initials = useMemo(
    () => getInitials(displayName, fallbackInitials || "EM"),
    [displayName, fallbackInitials]
  );

  const palette = useMemo(
    () => getAvatarColorPalette(displayName || id || "default"),
    [displayName, id]
  );

  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md;
  const shapeStyle = SHAPE_STYLES[shape] || SHAPE_STYLES.circle;

  const hasValidImage = Boolean(resolvedSrc && !imageError);

  const normalizedStatus = status ? String(status).toLowerCase().trim() : null;
  const statusBg = normalizedStatus ? STATUS_COLORS[normalizedStatus] || "bg-emerald-500" : null;

  return (
    <div
      id={id || `avatar-${initials.toLowerCase()}`}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${sizeStyle.container} ${shapeStyle} ${
        onClick ? "cursor-pointer hover:opacity-95 transition-opacity" : ""
      } ${className}`}
      style={{ userSelect: "none" }}
      aria-label={alt || displayName}
    >
      {hasValidImage ? (
        <img
          src={resolvedSrc}
          alt={alt || displayName}
          onError={() => setImageError(true)}
          className={`w-full h-full object-cover ${shapeStyle} ring-1 ring-black/5 dark:ring-white/10`}
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-bold tracking-wider ${palette.bg} ${palette.text} ${shapeStyle} shadow-sm ring-1 ring-inset ${palette.ring} ${textClassName}`}
        >
          <span>{initials}</span>
        </div>
      )}

      {showStatus && normalizedStatus && statusBg && (
        <span
          className={`absolute ${sizeStyle.indicatorOffset} ${sizeStyle.statusDot} ${statusBg} rounded-full ring-white dark:ring-slate-900`}
          title={`Status: ${normalizedStatus}`}
        />
      )}
    </div>
  );
};

export default Avatar;
