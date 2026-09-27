import WorkspaceLoader from "../ui/WorkspaceLoader";
import { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { Pin, Calendar, ShieldCheck, X, CheckCircle2, AlertCircle, AlertTriangle, Info, Tag, Share2, Check } from "lucide-react";
import { getAnnouncementById } from "../../apis/fontApis";
import { notificationService } from "../../services/notificationService";

export const AnnouncementModal = ({
  isOpen = false,
  announcementId = null,
  announcementData = null,
  onClose = () => {},
  onMarkRead = () => {},
  role = "employee",
}) => {
  const [announcement, setAnnouncement] = useState(announcementData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Fetch full details whenever the modal is opened with an ID or data
  const fetchDetails = useCallback(async (id) => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await getAnnouncementById(id);
      if (res?.data?.success && res.data.announcement) {
        setAnnouncement(res.data.announcement);
      }
    } catch (err) {
      console.warn("Could not fetch announcement detail from backend:", err.message);
      if (!announcementData) {
        setError(err.response?.data?.message || "Failed to load announcement details.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [announcementData]);

  useEffect(() => {
    if (isOpen) {
      if (announcementData) {
        setAnnouncement(announcementData);
      }
      const targetId = announcementId || announcementData?._id || announcementData?.id;
      if (targetId) {
        fetchDetails(targetId);
      }
    } else {
      setError(null);
      setCopied(false);
    }
  }, [isOpen, announcementId, announcementData, fetchDetails]);

  const handleDismiss = useCallback(() => {
    try {
      notificationService.getNotifications({ role, force: true }).catch(() => {});
      const bc = new BroadcastChannel("eyenit_notification_channel");
      bc.postMessage({ type: "notification_read", timestamp: Date.now() });
      bc.close();
    } catch {
      // BroadcastChannel fallback
    }

    if (onMarkRead && announcement) {
      onMarkRead(announcement);
    }
    if (onClose) {
      onClose();
    }
  }, [role, onMarkRead, announcement, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleDismiss]);

  const handleCopyLink = () => {
    try {
      const textToCopy = `${announcement?.title || "Announcement"}\n\n${announcement?.content || ""}`;
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  if (!isOpen) return null;

  const currentItem = announcement || announcementData || {};
  const priority = (currentItem.priority || "normal").toLowerCase();

  // Priority Badge Helper
  const renderPriorityBadge = () => {
    if (priority === "urgent") {
      return (
        <span
          id="announcement-priority-urgent"
          className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Urgent
        </span>
      );
    }
    if (priority === "important" || priority === "high") {
      return (
        <span
          id="announcement-priority-important"
          className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Important
        </span>
      );
    }
    return (
      <span
        id="announcement-priority-normal"
        className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
      >
        <Info className="w-3.5 h-3.5" />
        Normal
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Recently published";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return String(dateStr);
    }
  };

  const authorName =
    currentItem.author ||
    currentItem.createdBy?.fullName ||
    currentItem.createdBy?.name ||
    "System";
  const authorInitial = authorName.charAt(0).toUpperCase() || "S";

  const modalContent = (
    <div
      id="announcement-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-modal-title"
    >
      <div
        id="announcement-detail-modal-container"
        className="w-full max-w-lg mx-auto bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in p-5 sm:p-6 gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* S badge avatar */}
            <div
              id="announcement-sender-avatar"
              className="w-10 h-10 rounded-full bg-[#002185] dark:bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm"
            >
              {authorInitial}
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  Posted by {authorName}
                </span>
                <span
                  id="announcement-official-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/80 text-[#002185] dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                >
                  <ShieldCheck className="w-3 h-3 text-[#ff5500]" />
                  Official
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(currentItem.createdAt || currentItem.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy announcement text"
              aria-label="Copy announcement text"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              id="announcement-modal-close-x-btn"
              type="button"
              onClick={handleDismiss}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Priority & Tags Strip */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {renderPriorityBadge()}

          {currentItem.isPinned && (
            <span
              id="announcement-pinned-tag"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff5500]/10 text-[#ff5500] border border-[#ff5500]/30"
            >
              <Pin className="w-3 h-3 fill-[#ff5500]" />
              Pinned
            </span>
          )}

          {currentItem.category && (
            <span
              id="announcement-category-tag"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              <Tag className="w-3 h-3 text-slate-400" />
              {currentItem.category}
            </span>
          )}
        </div>

        {/* Title */}
        {currentItem.title && (
          <h2
            id="announcement-modal-title"
            className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug tracking-tight shrink-0"
          >
            {currentItem.title}
          </h2>
        )}

        {/* Modal Scrollable Content Body */}
        <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3">
          {isLoading && !currentItem.content ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <WorkspaceLoader compact title="" />
              <p className="text-xs font-medium">Fetching details...</p>
            </div>
          ) : error ? (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Notice</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          ) : (
            <div
              id="announcement-full-content"
              className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed"
            >
              {currentItem.content || currentItem.message || "No content details provided for this announcement."}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-1 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold justify-center sm:justify-start">
            <CheckCircle2 className="w-4 h-4" />
            <span>Marked as read</span>
          </div>

          <button
            id="announcement-modal-dismiss-btn"
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#002185] hover:bg-[#ff5500] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 text-center"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return ReactDOM.createPortal(modalContent, document.body);
  }

  return modalContent;
};

export default AnnouncementModal;
