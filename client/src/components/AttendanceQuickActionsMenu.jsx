import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  ShieldCheck,
  Flag,
  RotateCcw,
  Eye,
  Edit3,
  Trash2,
  Zap,
  CheckCircle2,
  Printer,
} from "lucide-react";

const AttendanceQuickActionsMenu = ({
  item,
  onExcuse,
  onFlag,
  onUnflag,
  onRecalculate,
  onViewDetails,
  onPrintReport,
  onEdit,
  onDelete,
  usePortal = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const portalRef = useRef(null);

  // Compute anchored coordinates for fixed portal positioning
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // Anchor flush to the right edge of the trigger button
    const rightOffset = Math.max(8, window.innerWidth - rect.right);
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < 320 && rect.top > 320;

    setMenuPosition({
      top: showAbove ? rect.top - 8 : rect.bottom + 8, // 8px = mt-2
      right: rightOffset,
      showAbove,
    });
  }, []);

  // Update position on open, window resize, or scroll
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Close on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        (!portalRef.current || !portalRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isExcused = Boolean(item.isExcused);
  const isFlagged = Boolean(item.flaggedForReview);

  // The Popover Dropdown Menu Panel
  const menuContent = (
    <div
      ref={portalRef}
      id={`quick-action-menu-${item._id || item.id}`}
      role="menu"
      aria-orientation="vertical"
      onClick={(e) => e.stopPropagation()}
      className={`${
        usePortal ? "fixed" : "absolute right-0 top-full mt-2"
      } z-50 w-60 rounded-xl bg-white dark:bg-[#111927] shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 animate-in fade-in zoom-in-95 duration-150 origin-top-right text-left divide-y divide-slate-100 dark:divide-slate-800/80`}
      style={
        usePortal && menuPosition
          ? {
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
              transform: menuPosition.showAbove ? "translateY(-100%)" : "none",
            }
          : undefined
      }
    >
      {/* Header Info */}
      <div className="px-3.5 py-2 bg-slate-50 dark:bg-[#162033]/70 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between rounded-t-xl">
        <span className="font-bold text-[#0B1E48] dark:text-white truncate">
          {item.employee?.fullName?.split(" ")[0] || "Quick Actions"}
        </span>
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
          {item.date}
        </span>
      </div>

      {/* Lateness & Management Actions */}
      <div className="py-1">
        {/* Excuse Lateness Option */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            onExcuse(item);
          }}
          className="w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center gap-2.5 cursor-pointer group hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-800/60 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[#0B1E48] dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 leading-tight">
              {isExcused ? "Edit Excuse Reason" : "Excuse Lateness"}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isExcused ? "Lateness waived (GH₵0)" : "Waive penalty deduction"}
            </p>
          </div>
        </button>

        {/* Flag / Unflag for Review */}
        {isFlagged ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onUnflag(item);
            }}
            className="w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center gap-2.5 cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#162033] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#0B1E48] dark:text-white group-hover:text-slate-900 dark:group-hover:text-slate-100 leading-tight">
                Remove Review Flag
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Clear supervisor notice
              </p>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onFlag(item);
            }}
            className="w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center gap-2.5 cursor-pointer group hover:bg-amber-50 dark:hover:bg-amber-950/40"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-800/60 group-hover:scale-105 transition-transform">
              <Flag className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#0B1E48] dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 leading-tight">
                Flag for HR Review
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Mark for audit or policy notice
              </p>
            </div>
          </button>
        )}

        {/* Recalculate Policy Penalty */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            onRecalculate(item);
          }}
          className="w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center gap-2.5 cursor-pointer group hover:bg-blue-50 dark:hover:bg-blue-950/40"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800/60 group-hover:scale-105 transition-transform">
            <RotateCcw className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[#0B1E48] dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 leading-tight">
              Recalculate Policy
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Reset to shift rules & tiers
            </p>
          </div>
        </button>
      </div>

      {/* Standard Navigation / Editing & Print Report */}
      <div className="py-1">
        {typeof onPrintReport === "function" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onPrintReport(item);
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-2.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Print Official Report</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            onViewDetails(item);
          }}
          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#0B1E48] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2.5 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>Full Record Log</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            onEdit(item);
          }}
          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#0B1E48] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2.5 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>Manual Edit / Override</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            onDelete(item);
          }}
          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-2.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
          <span>Delete Record</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Quick Actions Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        id={`quick-action-btn-${item._id || item.id}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border select-none ${
          isFlagged
            ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/80 hover:bg-amber-100 dark:hover:bg-amber-900/60"
            : isExcused
            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
            : isOpen
            ? "bg-[#002185] text-white border-[#002185] dark:bg-blue-600 dark:border-blue-600 shadow-xs"
            : "bg-white dark:bg-[#162033] text-[#002185] dark:text-white border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-[#002185]/40 dark:hover:border-slate-600 shadow-2xs"
        }`}
        title="Open Quick Actions Menu"
      >
        <Zap
          className={`w-3.5 h-3.5 ${
            isExcused
              ? "text-emerald-600 dark:text-emerald-400"
              : isFlagged
              ? "text-amber-600 dark:text-amber-400"
              : isOpen
              ? "text-white"
              : "text-[#002185] dark:text-blue-400"
          }`}
        />
        <span>Actions</span>
        <MoreVertical className="w-3.5 h-3.5 opacity-70" />
      </button>

      {/* Popover Dropdown Menu (via Portal to escape overflow constraints or inline relative) */}
      {isOpen &&
        (usePortal && typeof document !== "undefined"
          ? createPortal(menuContent, document.body)
          : menuContent)}
    </div>
  );
};

export default AttendanceQuickActionsMenu;
