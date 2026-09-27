import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useState, useEffect, useCallback } from "react";
import { Megaphone, Pin, Plus, Trash2, Edit3, Calendar, Search, X, ChevronDown, ChevronUp, Send, AlertTriangle, Users, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { ui } from "./ui/tokens";
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  togglePinAnnouncement,
  deleteAnnouncement,
} from "../../apis/fontApis";
import { useBranding } from "../../context/BrandingContext";

const AdminAnnouncements = () => {
  const { companyName } = useBranding() || {};
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State for creating/editing
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "Company News",
    priority: "normal",
    isPinned: false,
    department: "All",
  });

  const categories = [
    "All",
    "Company News",
    "Policy Update",
    "Event",
    "Urgent Alert",
    "General",
  ];

  const fetchBoardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getAnnouncements({
        category: selectedCategory !== "All" ? selectedCategory : undefined,
        priority: selectedPriority !== "All" ? selectedPriority : undefined,
        search: searchQuery ? searchQuery : undefined,
      });

      if (res?.data?.success) {
        setAnnouncements(res.data.announcements || []);
      }
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, selectedPriority, searchQuery]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  const showToast = (msg, type = "success") => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      content: "",
      category: "Company News",
      priority: "normal",
      isPinned: false,
      department: "All",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || "",
      content: item.content || "",
      category: item.category || "Company News",
      priority: item.priority || "normal",
      isPinned: Boolean(item.isPinned),
      department: item.department || "All",
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      showToast("Please enter both title and content.", "error");
      return;
    }

    try {
      setActionLoading(true);
      if (editingItem) {
        await updateAnnouncement(editingItem._id, formData);
        showToast("Announcement updated successfully.");
      } else {
        await createAnnouncement(formData);
        showToast("Announcement published and broadcasted to employees.");
      }
      setIsModalOpen(false);
      fetchBoardData();
    } catch (err) {
      console.error("Error saving announcement:", err);
      showToast(err.response?.data?.message || "Failed to save announcement", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePin = async (id, currentPinned) => {
    try {
      setAnnouncements((prev) =>
        prev
          .map((a) => (a._id === id ? { ...a, isPinned: !currentPinned } : a))
          .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
      );

      await togglePinAnnouncement(id);
      showToast(!currentPinned ? "Announcement pinned to top." : "Announcement unpinned.");
      fetchBoardData();
    } catch (err) {
      console.error("Error toggling pin:", err);
      showToast("Failed to update pin state.", "error");
      fetchBoardData();
    }
  };

  const handleDelete = async (id) => {
    try {
      setIsDeleting(true);
      const res = await deleteAnnouncement(id);
      if (res?.data?.success || res?.status === 200) {
        setAnnouncements((prev) => prev.filter((a) => a._id !== id));
        showToast("Announcement removed from board permanently.");
        setDeleteConfirmId(null);
        fetchBoardData();
      } else {
        throw new Error(res?.data?.message || "Failed to delete announcement");
      }
    } catch (err) {
      console.error("Error deleting announcement:", err);
      showToast(err.response?.data?.message || err.message || "Failed to delete announcement.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-GH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case "Urgent Alert":
      case "Urgent":
        return "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "Policy Update":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Event":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "Company News":
        return "bg-blue-100 text-[#002185] dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-[#162033] dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            Urgent
          </span>
        );
      case "important":
      case "high":
        return (
          <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider">
            Important
          </span>
        );
      default:
        return (
          <span className="font-semibold text-slate-500 bg-slate-100 dark:bg-[#162033] border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md text-[10px]">
            Normal
          </span>
        );
    }
  };

  // Filter announcements by category, priority, and search query (title or content)
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const displayedAnnouncements = announcements.filter((item) => {
    if (selectedCategory !== "All" && item.category !== selectedCategory) {
      return false;
    }
    if (selectedPriority !== "All" && item.priority?.toLowerCase() !== selectedPriority.toLowerCase()) {
      return false;
    }
    if (normalizedQuery) {
      const matchTitle = (item.title || "").toLowerCase().includes(normalizedQuery);
      const matchContent = (item.content || "").toLowerCase().includes(normalizedQuery);
      const matchCategory = (item.category || "").toLowerCase().includes(normalizedQuery);
      const matchAuthor = (item.author || item.createdBy?.fullName || "").toLowerCase().includes(normalizedQuery);
      return matchTitle || matchContent || matchCategory || matchAuthor;
    }
    return true;
  });

  const pinnedList = displayedAnnouncements.filter((a) => a.isPinned);
  const unpinnedList = displayedAnnouncements.filter((a) => !a.isPinned);

  return (
    <div className={`${ui.page} overflow-x-hidden`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-xl border animate-in slide-in-from-top-3 duration-200 ${
            toastMessage.type === "error"
              ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900"
              : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900"
          }`}
        >
          {toastMessage.type === "error" ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className={ui.toolbar}>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Share updates with your team and manage published announcements.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchBoardData()}
            disabled={isLoading}
            className={`${ui.btnSecondary} w-10! px-0!`}
            title="Refresh announcements"
            aria-label="Refresh announcements"
          >
            {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <button id="admin-create-announcement-btn" type="button" onClick={handleOpenCreateModal} className={ui.btnPrimary}>
            <Plus className="w-4 h-4" />
            <span>Create announcement</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Total Bulletins
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
              {announcements.length}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Pinned on Dashboard
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {pinnedList.length}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Pin className="w-5 h-5 fill-current" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Broadcast Delivery
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              Real-time
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Board Container */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-5">
        {/* Filters & Search Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800 pb-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#002185] text-white dark:bg-blue-600 shadow-2xs font-bold"
                    : "bg-[#F1F5F9] dark:bg-[#162033] text-[#64748B] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search & Priority Selector */}
          <div className="flex items-center gap-2.5">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#002185]/25"
            >
              <option value="All">All Priorities</option>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>

            <div className="relative w-full sm:w-64 md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="admin-announcements-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or content..."
                className="w-full pl-9 pr-8 py-2 bg-[#F8FAFC] dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
              />
              {searchQuery && (
                <button
                  id="admin-announcements-clear-search-btn"
                  type="button"
                  onClick={() => setSearchQuery("")}
                  title="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Search / Filter Indicator */}
        {(searchQuery.trim() || selectedCategory !== "All" || selectedPriority !== "All") && (
          <div className="flex items-center justify-between gap-2 p-2.5 px-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-[#002185] dark:text-blue-400">
                Active Filter:
              </span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-white dark:bg-[#162033] px-2 py-0.5 rounded-md border border-blue-200 dark:border-slate-700 text-[11px]">
                  Keyword: &quot;{searchQuery}&quot;
                </span>
              )}
              {selectedCategory !== "All" && (
                <span className="inline-flex items-center gap-1 bg-white dark:bg-[#162033] px-2 py-0.5 rounded-md border border-blue-200 dark:border-slate-700 text-[11px]">
                  Category: {selectedCategory}
                </span>
              )}
              {selectedPriority !== "All" && (
                <span className="inline-flex items-center gap-1 bg-white dark:bg-[#162033] px-2 py-0.5 rounded-md border border-blue-200 dark:border-slate-700 text-[11px]">
                  Priority: {selectedPriority}
                </span>
              )}
              <span className="text-[#64748B] dark:text-slate-400 text-[11px]">
                ({displayedAnnouncements.length} of {announcements.length} shown)
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setSelectedPriority("All");
              }}
              className="text-[#002185] dark:text-blue-400 hover:text-[#ff5500] font-bold text-xs underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Announcements List */}
        <div className="space-y-3.5">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <WorkspaceLoader compact title="" />
              <p className="text-xs">
                Loading {companyName ? `${companyName} ` : ""}announcement records...
              </p>
            </div>
          ) : displayedAnnouncements.length === 0 ? (
            <div className="py-16 text-center bg-[#F8FAFC] dark:bg-[#162033]/40 rounded-xl border border-dashed border-[#E2E8F0] dark:border-slate-800 p-6">
              <Megaphone className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <h4 className="text-base font-bold text-[#002185] dark:text-slate-200">
                {searchQuery || selectedCategory !== "All" || selectedPriority !== "All"
                  ? "No matching announcements found"
                  : "No announcements published yet"}
              </h4>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No announcements contain the title or content matching "${searchQuery}".`
                  : selectedCategory !== "All" || selectedPriority !== "All"
                  ? "No updates match the selected category or priority filter."
                  : "Start by publishing your first company-wide announcement."}
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                {searchQuery || selectedCategory !== "All" || selectedPriority !== "All" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                      setSelectedPriority("All");
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Clear Search & Filters</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#002185] hover:bg-[#001760] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Announcement</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Pinned Highlights */}
              {pinnedList.length > 0 && selectedCategory === "All" && selectedPriority === "All" && !searchQuery && (
                <div className="space-y-3 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#ff5500] uppercase tracking-wider">
                    <Pin className="w-3.5 h-3.5 fill-[#ff5500]" />
                    <span>Pinned to Dashboard Top ({pinnedList.length})</span>
                  </div>
                  {pinnedList.map((item) => renderAnnouncementCard(item, true))}
                </div>
              )}

              {/* General Announcements */}
              {(selectedCategory !== "All" || selectedPriority !== "All" || searchQuery
                ? displayedAnnouncements
                : unpinnedList
              ).map((item) => renderAnnouncementCard(item, item.isPinned))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create or Edit Announcement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-2xl max-w-xl w-full p-6 border border-[#E2E8F0] dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-[#002185] dark:text-blue-400">
                <div className="w-8 h-8 rounded-lg bg-[#002185]/10 dark:bg-blue-500/20 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-[#002185] dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingItem ? "Edit Announcement" : "Create Company Announcement"}
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    Will automatically broadcast real-time notifications to all active employees
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Company Townhall Meeting & Strategy Session"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#002185]/20 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#002185]/25"
                  >
                    <option value="Company News">Company News</option>
                    <option value="Policy Update">Policy Update</option>
                    <option value="Event">Event</option>
                    <option value="Urgent Alert">Urgent Alert</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#002185]/25"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="important">Important (Pinned alert)</option>
                    <option value="urgent">Urgent (Immediate alert)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Content / Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter complete message, directives, links or instructions for employees..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#002185]/20 resize-none font-normal leading-relaxed"
                />
              </div>

              {/* Pin Checkbox */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#162033]/60 border border-[#E2E8F0] dark:border-slate-700/60">
                <input
                  type="checkbox"
                  id="pin-announcement-checkbox-page"
                  checked={formData.isPinned}
                  onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                  className="w-4 h-4 text-[#ff5500] rounded-sm focus:ring-[#ff5500] cursor-pointer"
                />
                <label
                  htmlFor="pin-announcement-checkbox-page"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Pin className="w-3.5 h-3.5 text-[#ff5500]" />
                  <span>Pin this announcement at the top of employee and admin dashboards</span>
                </label>
              </div>

              {/* Broadcast Note */}
              <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-400 bg-blue-50/60 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900">
                <Sparkles className="w-4 h-4 text-[#002185] dark:text-blue-400 shrink-0" />
                <span>
                  Posting will automatically create notification records for all active employees and update their notification bells.
                </span>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#002185] hover:bg-[#001760] text-white font-bold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? (
                    <WorkspaceLoader inline />
                  ) : editingItem ? (
                    "Save Changes"
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish & Broadcast</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-2xl max-w-sm w-full p-6 border border-[#E2E8F0] dark:border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Announcement?
              </h4>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                This will permanently remove the bulletin from both Admin and Employee views.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <WorkspaceLoader inline />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderAnnouncementCard(item, isPinnedCard = false) {
    const isExpanded = expandedId === item._id;
    const isLong = (item.content || "").length > 200;

    return (
      <div
        key={item._id}
        className={`p-5 rounded-2xl border transition-all duration-200 ${
          isPinnedCard
            ? "bg-orange-50/40 dark:bg-[#162033]/80 border-orange-200 dark:border-orange-900/60 shadow-2xs"
            : "bg-[#F8FAFC] dark:bg-[#162033]/40 border-[#E2E8F0] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {item.isPinned && (
                <span className="inline-flex items-center gap-1 font-bold text-[#ff5500] bg-white dark:bg-[#111927] border border-[#ff5500]/30 px-2 py-0.5 rounded-md shadow-2xs">
                  <Pin className="w-3 h-3 fill-[#ff5500]" />
                  Pinned
                </span>
              )}
              <span
                className={`font-semibold px-2 py-0.5 rounded-md border text-[11px] ${getCategoryBadgeClass(
                  item.category
                )}`}
              >
                {item.category || "Company News"}
              </span>
              {getPriorityBadge(item.priority)}
              <span className="text-slate-400 dark:text-slate-500 text-[11px] flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(item.createdAt)}
              </span>
              {item.author && (
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                  • by {item.author}
                </span>
              )}
            </div>

            {/* Title */}
            <h4 className="text-base font-bold text-[#002185] dark:text-white leading-snug">
              {item.title}
            </h4>

            {/* Content */}
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {isExpanded || !isLong
                ? item.content
                : `${item.content.substring(0, 200)}...`}
            </p>

            {isLong && (
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : item._id)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#002185] dark:text-blue-400 hover:text-[#ff5500] transition-colors pt-1 cursor-pointer"
              >
                {isExpanded ? (
                  <>
                    Show less <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Read full announcement <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleTogglePin(item._id, item.isPinned)}
              title={item.isPinned ? "Unpin announcement" : "Pin announcement to top"}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                item.isPinned
                  ? "bg-[#ff5500]/10 border-[#ff5500]/30 text-[#ff5500] hover:bg-[#ff5500]/20"
                  : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 hover:text-[#ff5500]"
              }`}
            >
              <Pin className={`w-4 h-4 ${item.isPinned ? "fill-[#ff5500]" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => handleOpenEditModal(item)}
              title="Edit announcement"
              className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-[#002185] dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirmId(item._id)}
              title="Delete announcement"
              className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default AdminAnnouncements;
