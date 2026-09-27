import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useCallback, memo } from "react";
import { Megaphone, Pin, Plus, Trash2, Edit3, Calendar, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  togglePinAnnouncement,
  deleteAnnouncement,
} from "../apis/fontApis";
import { AnnouncementModal } from "./modal/AnnouncementModal";

const AnnouncementBoardComponent = ({
  role = "employee", // "admin" | "employee"
  className = "",
}) => {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [readerModalItem, setReaderModalItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Form State for creating/editing
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "Company News",
    priority: "medium",
    isPinned: false,
    department: "All",
  });

  const categories = [
    "All",
    "Company News",
    "Policy Update",
    "Urgent",
    "Event",
    "General",
  ];

  const fetchBoardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getAnnouncements({
        category: selectedCategory !== "All" ? selectedCategory : undefined,
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
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  const showToast = (msg, type = "success") => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      content: "",
      category: "Company News",
      priority: "medium",
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
      priority: item.priority || "medium",
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
        showToast("New announcement posted to the board.");
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
      // Optimistic update
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

  const handleDelete = (id) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      setIsDeleting(true);
      const res = await deleteAnnouncement(deleteConfirmId);
      if (res?.data?.success || res?.status === 200) {
        setAnnouncements((prev) => prev.filter((a) => a._id !== deleteConfirmId));
        showToast("Announcement deleted permanently.");
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
      return d.toLocaleDateString("en-US", {
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
      case "Urgent":
        return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "Policy Update":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Event":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "Company News":
        return "bg-blue-100 text-[#002185] dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  // Filter announcements by category and search query (title or content)
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const displayedAnnouncements = announcements.filter((item) => {
    if (selectedCategory !== "All" && item.category !== selectedCategory) {
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
    <div
      id="company-announcement-board"
      className={`bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-6 shadow-sm ${className}`}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between animate-fade-in ${
            toastMessage.type === "error"
              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900"
              : "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E2E8F0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#002185] flex items-center justify-center text-white shadow-sm shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-[#002185] dark:text-white">
                Company Announcement Board
              </h3>
              {pinnedList.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#ff5500]/10 text-[#ff5500] px-2 py-0.5 rounded-full">
                  <Pin className="w-3 h-3 fill-[#ff5500]" />
                  {pinnedList.length} Pinned
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Official company updates, HR notices, and executive bulletins
            </p>
          </div>
        </div>

        {/* Action Button for Admins */}
        {role === "admin" && (
          <button
            type="button"
            id="create-announcement-btn"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#002185] hover:bg-[#ff5500] text-white text-xs font-bold rounded-xl shadow-xs transition-all duration-200 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Post Announcement
          </button>
        )}
      </div>

      {/* Toolbar: Category Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-4 pb-2">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#002185] text-white dark:bg-blue-600 shadow-2xs"
                  : "bg-[#F1F5F9] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="announcement-board-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or content..."
            className="w-full pl-9 pr-8 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#002185] dark:focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              title="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Announcements Stream */}
      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <WorkspaceLoader compact title="" />
            <p className="text-xs">Loading announcements...</p>
          </div>
        ) : displayedAnnouncements.length === 0 ? (
          <div className="py-12 text-center bg-[#F8FAFC] dark:bg-slate-800/40 rounded-xl border border-dashed border-[#E2E8F0] dark:border-slate-800">
            <Megaphone className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <h4 className="text-sm font-semibold text-[#002185] dark:text-slate-200">
              {searchQuery || selectedCategory !== "All"
                ? "No matching announcements found"
                : "No company announcements at this time"}
            </h4>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {searchQuery || selectedCategory !== "All"
                ? "No updates match the current search or category filter."
                : "Check back later for company-wide bulletins and HR notifications."}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            ) : role === "admin" ? (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#002185] hover:bg-[#ff5500] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Announcement
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pinned Section (if any) */}
            {pinnedList.length > 0 && selectedCategory === "All" && !searchQuery && (
              <div className="space-y-2.5 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#ff5500] uppercase tracking-wider">
                  <Pin className="w-3.5 h-3.5 fill-[#ff5500]" />
                  <span>Pinned Highlights</span>
                </div>
                {pinnedList.map((item) => renderAnnouncementCard(item, true))}
              </div>
            )}

            {/* General Announcements Section */}
            {(!selectedCategory.includes("All") || searchQuery ? displayedAnnouncements : unpinnedList).map(
              (item) => renderAnnouncementCard(item, item.isPinned)
            )}
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Announcement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-[#E2E8F0] dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-[#002185] dark:text-blue-400">
                <Megaphone className="w-5 h-5 text-[#ff5500]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingItem ? "Edit Announcement" : "Post Company Announcement"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
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
                  placeholder="e.g. Annual Company Offsite & Strategy Days"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#002185]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#002185]"
                  >
                    <option value="Company News">Company News</option>
                    <option value="Policy Update">Policy Update</option>
                    <option value="Urgent">Urgent Alert</option>
                    <option value="Event">Event</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#002185]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
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
                  placeholder="Provide complete information, instructions, or meeting links for the team..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#002185] resize-none"
                />
              </div>

              {/* Pin Checkbox */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="pin-announcement-checkbox"
                  checked={formData.isPinned}
                  onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                  className="w-4 h-4 text-[#ff5500] rounded-sm focus:ring-[#ff5500] cursor-pointer"
                />
                <label
                  htmlFor="pin-announcement-checkbox"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Pin className="w-3.5 h-3.5 text-[#ff5500]" />
                  Pin this announcement to top of dashboard
                </label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#002185] hover:bg-[#ff5500] text-white font-bold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <WorkspaceLoader inline />
                  ) : editingItem ? (
                    "Save Changes"
                  ) : (
                    "Publish Announcement"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee & Admin Detail Reader Modal */}
      <AnnouncementModal
        isOpen={Boolean(readerModalItem)}
        announcementId={readerModalItem?._id || readerModalItem?.id}
        announcementData={readerModalItem}
        onClose={() => setReaderModalItem(null)}
        role={role}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 border border-[#E2E8F0] dark:border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#002185] dark:text-white">
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
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
    const isLong = (item.content || "").length > 180;

    return (
      <div
        key={item._id}
        className={`p-4 rounded-xl border transition-all duration-200 ${
          isPinnedCard
            ? "bg-orange-50/40 dark:bg-slate-800/80 border-orange-200 dark:border-orange-900/50 shadow-2xs"
            : "bg-[#F8FAFC] dark:bg-slate-800/40 border-[#E2E8F0] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {item.isPinned && (
                <span className="inline-flex items-center gap-1 font-bold text-[#ff5500] bg-white dark:bg-slate-900 border border-[#ff5500]/30 px-2 py-0.5 rounded-md shadow-2xs">
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
              {item.priority === "urgent" && (
                <span className="font-bold text-rose-600 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md text-[10px] uppercase">
                  Urgent
                </span>
              )}
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

            {/* Title - clickable to open detail reader modal */}
            <h4
              onClick={() => setReaderModalItem(item)}
              className="text-sm sm:text-base font-bold text-[#002185] dark:text-white leading-snug hover:text-[#ff5500] dark:hover:text-blue-400 cursor-pointer transition-colors"
            >
              {item.title}
            </h4>

            {/* Content */}
            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {isExpanded || !isLong
                ? item.content
                : `${item.content.substring(0, 180)}...`}
            </p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setReaderModalItem(item)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#002185] dark:text-blue-400 hover:text-[#ff5500] transition-colors"
              >
                View full details
              </button>

              {isLong && (
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item._id)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      Show less <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      Expand inline <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Admin Management Actions */}
          {role === "admin" && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleTogglePin(item._id, item.isPinned)}
                title={item.isPinned ? "Unpin announcement" : "Pin announcement to top"}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  item.isPinned
                    ? "bg-[#ff5500]/10 border-[#ff5500]/30 text-[#ff5500] hover:bg-[#ff5500]/20"
                    : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 hover:text-[#ff5500]"
                }`}
              >
                <Pin
                  className={`w-3.5 h-3.5 ${item.isPinned ? "fill-[#ff5500]" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => handleOpenEditModal(item)}
                title="Edit announcement"
                className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-[#002185] dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item._id)}
                title="Delete announcement"
                className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
};

export const AnnouncementBoard = memo(AnnouncementBoardComponent);
export default AnnouncementBoard;
