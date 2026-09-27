import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Mail, Phone, Briefcase, MapPin, LayoutGrid, List, Copy, Check, Users, X, ChevronRight, Download, FileSpreadsheet, Trash2, UserPlus, AlertTriangle, ShieldAlert, RefreshCw, CheckSquare, Square, Layers, Building, Building2, Activity, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from "lucide-react";
import { exportEmployeesToCSV } from "../utils/exportCsv";
import {
  updateEmployeeStatus,
  bulkUpdateEmployees,
  bulkDeleteEmployees,
  deleteEmployee,
} from "../apis/fontApis";
import { useManagement } from "../context/ManagementContextProvider";
import Avatar from "./Avatar";
import EmployeeDetailModal from "./EmployeeDetailModal";
import { tableContainerVariants, tableRowVariants } from "../utils/motion";

export const EmployeeDirectory = ({
  employees: propEmployees = [],
  setEmployees: propSetEmployees,
  onEmployeeDeleted,
  onDeleteSuccess,
  isLoading = false,
  onRefresh,
}) => {
  const { role, setShowEmployeeModal } = useManagement();
  const isAdmin =
    role === "admin" || window.location.pathname.startsWith("/admin");

  // Local employees state for instant UI eviction upon deletion
  const [localEmployees, setLocalEmployees] = useState(propEmployees);

  useEffect(() => {
    setLocalEmployees(propEmployees);
  }, [propEmployees]);

  const employees = localEmployees;

  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [viewMode, setViewMode] = useState("table");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Sorting state for table and directory views
  const [sortField, setSortField] = useState("fullName");
  const [sortOrder, setSortOrder] = useState("asc");

  // Bulk Selection State
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [bulkAction, setBulkAction] = useState(""); // "department" | "status" | ""
  const [bulkTargetDepartment, setBulkTargetDepartment] = useState("");
  const [bulkTargetStatus, setBulkTargetStatus] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Single Status update & delete state
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Extract unique departments and statuses
  const rawDepartments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
  }, [employees]);

  const departments = useMemo(() => {
    return ["All", ...rawDepartments];
  }, [rawDepartments]);

  const standardDepartments = [
    "Engineering",
    "Product",
    "Design",
    "Marketing",
    "Human Resources",
    "Finance",
    "Operations",
    "Customer Support",
    "Sales",
  ];

  const allAvailableDepartments = useMemo(() => {
    return Array.from(new Set([...rawDepartments, ...standardDepartments])).filter(Boolean);
  }, [rawDepartments]);

  const statusOptions = [
    "All",
    "Active",
    "On Leave",
    "Terminated",
    "Inactive",
    "Suspended",
  ];

  const getStatusBadge = (status, isActive, emp = null) => {
    let raw;
    if (emp?.isOnLeave || emp?.onLeave || emp?.currentLeaveStatus === "Approved") {
      raw = "on leave";
    } else if (emp?.isTerminated || emp?.terminated) {
      raw = "terminated";
    } else if (status) {
      raw = String(status).toLowerCase().trim().replace(/[-_]/g, " ");
    } else if (isActive !== false) {
      raw = "active";
    } else {
      raw = "inactive";
    }

    if (raw === "on leave" || raw === "onleave" || raw === "leave" || raw === "on-leave") {
      return {
        bg: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70",
        dot: "bg-blue-500",
        label: "On Leave",
        code: "on leave",
      };
    }

    if (raw === "terminated" || raw === "dismissed") {
      return {
        bg: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70",
        dot: "bg-rose-500",
        label: "Terminated",
        code: "terminated",
      };
    }

    if (raw === "active") {
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70",
        dot: "bg-emerald-500",
        label: "Active",
        code: "active",
      };
    }

    if (raw === "suspended") {
      return {
        bg: "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/70",
        dot: "bg-red-500",
        label: "Suspended",
        code: "suspended",
      };
    }

    if (raw === "inactive") {
      return {
        bg: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70",
        dot: "bg-amber-500",
        label: "Inactive",
        code: "inactive",
      };
    }

    return {
      bg: "bg-slate-50 dark:bg-[#162033]/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
      dot: "bg-slate-500",
      label: raw.charAt(0).toUpperCase() + raw.slice(1),
      code: raw,
    };
  };

  // Filtered and sorted employees list
  const filteredEmployees = useMemo(() => {
    const list = employees.filter((emp) => {
      const q = search.toLowerCase().trim();
      const nameMatch = (emp.fullName || emp.name || "").toLowerCase().includes(q);
      const emailMatch = (emp.email || "").toLowerCase().includes(q);
      const phoneMatch = (emp.phone || "").toLowerCase().includes(q);
      const deptMatch = (emp.department || emp.dept || "").toLowerCase().includes(q);
      const posMatch = (emp.position || emp.role || emp.title || "").toLowerCase().includes(q);
      const idMatch = (emp.employeeId || emp.id || "").toLowerCase().includes(q);
      const locMatch = (emp.location || "").toLowerCase().includes(q);

      const matchesSearch =
        !q ||
        nameMatch ||
        deptMatch ||
        emailMatch ||
        phoneMatch ||
        posMatch ||
        idMatch ||
        locMatch;

      const badge = getStatusBadge(emp.status, emp.isActive, emp);
      const empStatusLabel = badge.label.toLowerCase();
      const matchesStatus =
        selectedStatus === "All" ||
        empStatusLabel === selectedStatus.toLowerCase() ||
        badge.code === selectedStatus.toLowerCase();

      const matchesDept =
        selectedDepartment === "All" || emp.department === selectedDepartment;

      return matchesSearch && matchesStatus && matchesDept;
    });

    if (!sortField) return list;

    return [...list].sort((a, b) => {
      let aVal;
      let bVal;

      if (sortField === "fullName" || sortField === "name") {
        aVal = (a.fullName || "").toLowerCase();
        bVal = (b.fullName || "").toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (sortField === "employeeId" || sortField === "id") {
        aVal = (a.employeeId || "").toLowerCase();
        bVal = (b.employeeId || "").toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" })
          : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: "base" });
      }

      if (sortField === "department" || sortField === "role") {
        aVal = (a.department || a.position || "").toLowerCase();
        bVal = (b.department || b.position || "").toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (
        sortField === "employmentDate" ||
        sortField === "joiningDate" ||
        sortField === "date"
      ) {
        aVal = new Date(
          a.employmentDate ||
            a.joiningDate ||
            a.hireDate ||
            a.dateOfJoining ||
            a.createdAt ||
            0
        ).getTime();
        bVal = new Date(
          b.employmentDate ||
            b.joiningDate ||
            b.hireDate ||
            b.dateOfJoining ||
            b.createdAt ||
            0
        ).getTime();
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (sortField === "baseSalary" || sortField === "salary") {
        aVal = Number(a.baseSalary ?? a.basicSalary ?? a.salary ?? 0);
        bVal = Number(b.baseSalary ?? b.basicSalary ?? b.salary ?? 0);
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (sortField === "status") {
        aVal = getStatusBadge(a.status, a.isActive, a).label.toLowerCase();
        bVal = getStatusBadge(b.status, b.isActive, b).label.toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (sortField === "location") {
        aVal = (a.location || "").toLowerCase();
        bVal = (b.location || "").toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });
  }, [employees, search, selectedStatus, selectedDepartment, sortField, sortOrder]);

  // Quick Metrics
  const metrics = useMemo(() => {
    const total = employees.length;
    let active = 0;
    let onLeave = 0;
    let terminated = 0;
    let inactive = 0;
    let suspended = 0;

    employees.forEach((e) => {
      const badge = getStatusBadge(e.status, e.isActive, e);
      if (badge.label === "Active") active++;
      else if (badge.label === "On Leave") onLeave++;
      else if (badge.label === "Terminated") terminated++;
      else if (badge.label === "Suspended") suspended++;
      else inactive++;
    });

    const deptsCount = new Set(employees.map((e) => e.department).filter(Boolean)).size;
    return { total, active, onLeave, terminated, inactive, suspended, deptsCount };
  }, [employees]);

  // Bulk selection toggles
  const handleToggleSelectAll = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0) {
      setSelectedEmployeeIds([]);
    } else {
      const allIds = filteredEmployees.map((e) => e._id || e.employeeId);
      setSelectedEmployeeIds(allIds);
    }
  };

  const handleToggleSelectOne = (id) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedEmployeesList = useMemo(() => {
    const idSet = new Set(selectedEmployeeIds.map(String));
    return employees.filter(
      (e) => idSet.has(String(e._id)) || idSet.has(String(e.employeeId))
    );
  }, [employees, selectedEmployeeIds]);

  // Bulk delete execution
  const handleExecuteBulkDelete = async () => {
    if (selectedEmployeeIds.length === 0) return;
    try {
      setIsBulkUpdating(true);
      const res = await bulkDeleteEmployees(selectedEmployeeIds);
      if (res?.data?.success) {
        const deletedIds = new Set(selectedEmployeeIds.map(String));
        // Evict from local state immediately
        setLocalEmployees((prev) =>
          prev.filter(
            (emp) =>
              !deletedIds.has(String(emp._id)) &&
              !deletedIds.has(String(emp.employeeId))
          )
        );
        if (typeof propSetEmployees === "function") {
          propSetEmployees((prev) =>
            prev.filter(
              (emp) =>
                !deletedIds.has(String(emp._id)) &&
                !deletedIds.has(String(emp.employeeId))
            )
          );
        }
        if (typeof onEmployeeDeleted === "function") {
          selectedEmployeeIds.forEach((id) => onEmployeeDeleted(id));
        }
        if (typeof onDeleteSuccess === "function") {
          selectedEmployeeIds.forEach((id) => onDeleteSuccess(id));
        }

        setActionMessage({
          type: "success",
          text:
            res.data.message ||
            `Successfully deleted ${selectedEmployeeIds.length} employee record(s).`,
        });
        setSelectedEmployeeIds([]);
        setShowBulkModal(false);
        setBulkAction("");
        if (typeof onRefresh === "function") {
          await onRefresh();
        }
      } else {
        setActionMessage({
          type: "error",
          text: res?.data?.message || "Failed to delete selected employees.",
        });
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      setActionMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to perform batch deletion.",
      });
    } finally {
      setIsBulkUpdating(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  // Bulk update execution
  const handleExecuteBulkUpdate = async () => {
    if (selectedEmployeeIds.length === 0) return;
    if (bulkAction === "delete") {
      return handleExecuteBulkDelete();
    }
    try {
      setIsBulkUpdating(true);
      const updates = {};
      if (bulkAction === "department" && bulkTargetDepartment) {
        updates.department = bulkTargetDepartment;
      } else if (bulkAction === "status" && bulkTargetStatus) {
        updates.status = bulkTargetStatus;
      } else {
        return;
      }

      const res = await bulkUpdateEmployees(selectedEmployeeIds, updates);
      if (res?.data?.success) {
        const targetIds = new Set(selectedEmployeeIds.map(String));
        setLocalEmployees((prev) =>
          prev.map((emp) => {
            if (targetIds.has(String(emp._id)) || targetIds.has(String(emp.employeeId))) {
              return { ...emp, ...updates };
            }
            return emp;
          })
        );
        if (typeof propSetEmployees === "function") {
          propSetEmployees((prev) =>
            prev.map((emp) => {
              if (targetIds.has(String(emp._id)) || targetIds.has(String(emp.employeeId))) {
                return { ...emp, ...updates };
              }
              return emp;
            })
          );
        }

        setActionMessage({
          type: "success",
          text:
            res.data.message ||
            `Successfully updated ${selectedEmployeeIds.length} employee record(s).`,
        });
        setSelectedEmployeeIds([]);
        setShowBulkModal(false);
        setBulkAction("");
        if (typeof onRefresh === "function") {
          await onRefresh();
        }
      } else {
        setActionMessage({
          type: "error",
          text: res?.data?.message || "Failed to execute batch update.",
        });
      }
    } catch (err) {
      console.error("Bulk update error:", err);
      setActionMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to perform batch update.",
      });
    } finally {
      setIsBulkUpdating(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleExportCSV = () => {
    try {
      setIsExporting(true);
      const isFiltered =
        Boolean(search) ||
        selectedDepartment !== "All" ||
        selectedStatus !== "All";

      let listToExport = employees;
      if (selectedEmployeeIds.length > 0) {
        listToExport = employees.filter((e) =>
          selectedEmployeeIds.includes(e._id || e.employeeId)
        );
      } else if (filteredEmployees.length > 0) {
        listToExport = filteredEmployees;
      }

      const dateTag = new Date().toISOString().split("T")[0];
      const filename =
        selectedEmployeeIds.length > 0
          ? `employee_directory_selected_${selectedEmployeeIds.length}_${dateTag}.csv`
          : isFiltered
          ? `employee_directory_filtered_${dateTag}.csv`
          : `employee_directory_all_${dateTag}.csv`;

      const success = exportEmployeesToCSV(listToExport, filename);
      if (success) {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 2500);
      }
    } catch (err) {
      console.error("Export CSV error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStatusChange = async (employeeId, newStatus) => {
    try {
      setStatusUpdatingId(employeeId);
      setActionMessage(null);
      const res = await updateEmployeeStatus(employeeId, newStatus);
      if (res?.data?.success) {
        setActionMessage({
          type: "success",
          text: res.data.message || `Status updated to ${newStatus}.`,
        });
        if (
          selectedEmployee &&
          (selectedEmployee._id === employeeId ||
            selectedEmployee.employeeId === employeeId)
        ) {
          setSelectedEmployee((prev) => ({
            ...prev,
            status: newStatus,
            isActive: newStatus === "active",
          }));
        }
        if (typeof onRefresh === "function") {
          await onRefresh();
        }
      }
    } catch (err) {
      console.error("Status update error:", err);
      setActionMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to update employee status.",
      });
    } finally {
      setStatusUpdatingId(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    const targetId = employeeToDelete._id || employeeToDelete.employeeId;
    try {
      setIsDeleting(true);
      const res = await deleteEmployee(targetId);
      if (res?.data?.success) {
        const deletedEmployeeId = targetId;
        // Evict immediately from local component state without requiring a manual refresh
        setLocalEmployees((prev) =>
          prev.filter(
            (emp) =>
              emp._id !== deletedEmployeeId &&
              emp.employeeId !== deletedEmployeeId &&
              String(emp._id) !== String(deletedEmployeeId)
          )
        );

        if (typeof propSetEmployees === "function") {
          propSetEmployees((prev) =>
            prev.filter(
              (emp) =>
                emp._id !== deletedEmployeeId &&
                emp.employeeId !== deletedEmployeeId &&
                String(emp._id) !== String(deletedEmployeeId)
            )
          );
        }

        if (typeof onEmployeeDeleted === "function") {
          onEmployeeDeleted(deletedEmployeeId);
        }

        if (typeof onDeleteSuccess === "function") {
          onDeleteSuccess(deletedEmployeeId);
        }

        setActionMessage({
          type: "success",
          text:
            res.data.message ||
            `Employee "${employeeToDelete.fullName}" successfully removed.`,
        });
        setEmployeeToDelete(null);
        if (
          selectedEmployee &&
          (selectedEmployee._id === targetId ||
            selectedEmployee.employeeId === targetId)
        ) {
          setSelectedEmployee(null);
        }
        if (typeof onRefresh === "function") {
          onRefresh();
        }
      }
    } catch (err) {
      console.error("Delete employee error:", err);
      // If 404 or record already removed, treat gracefully as success
      if (err.response?.status === 404) {
        const deletedEmployeeId = targetId;
        setLocalEmployees((prev) =>
          prev.filter(
            (emp) =>
              emp._id !== deletedEmployeeId &&
              emp.employeeId !== deletedEmployeeId &&
              String(emp._id) !== String(deletedEmployeeId)
          )
        );

        if (typeof propSetEmployees === "function") {
          propSetEmployees((prev) =>
            prev.filter(
              (emp) =>
                emp._id !== deletedEmployeeId &&
                emp.employeeId !== deletedEmployeeId &&
                String(emp._id) !== String(deletedEmployeeId)
            )
          );
        }

        if (typeof onEmployeeDeleted === "function") {
          onEmployeeDeleted(deletedEmployeeId);
        }

        if (typeof onDeleteSuccess === "function") {
          onDeleteSuccess(deletedEmployeeId);
        }

        setActionMessage({
          type: "success",
          text: `Employee record was already removed from database.`,
        });
        setEmployeeToDelete(null);
        if (
          selectedEmployee &&
          (selectedEmployee._id === targetId ||
            selectedEmployee.employeeId === targetId)
        ) {
          setSelectedEmployee(null);
        }
        if (typeof onRefresh === "function") {
          onRefresh();
        }
      } else {
        setActionMessage({
          type: "error",
          text:
            err.response?.data?.message ||
            err.message ||
            "Failed to delete employee from database.",
        });
      }
    } finally {
      setIsDeleting(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return "N/A";
    try {
      return new Date(dateVal).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return String(dateVal);
    }
  };

  const formatSalary = (val) => {
    const num = Number(val ?? 0);
    return `GH₵${num.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // For dates and salary, highest/newest first by default
      if (field === "employmentDate" || field === "baseSalary") {
        setSortOrder("desc");
      } else {
        setSortOrder("asc");
      }
    }
  };

  const renderSortHeader = (field, label, align = "left", className = "") => {
    const isSorted = sortField === field;
    return (
      <th
        scope="col"
        key={`sort-header-${field}`}
        onClick={() => handleSort(field)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSort(field);
          }
        }}
        tabIndex={0}
        role="columnheader"
        aria-sort={
          isSorted
            ? sortOrder === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className={`px-4 py-3.5 select-none transition-colors group cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:outline-none focus:bg-blue-50/50 dark:focus:bg-blue-950/30 ${
          align === "right"
            ? "text-right"
            : align === "center"
            ? "text-center"
            : "text-left"
        } ${
          isSorted
            ? "text-[#002185] dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/30"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        } ${className}`}
        title={`Click to sort by ${label} (${
          isSorted && sortOrder === "asc" ? "descending" : "ascending"
        })`}
      >
        <div
          className={`inline-flex items-center gap-1.5 uppercase tracking-wider text-xs font-semibold ${
            align === "right"
              ? "justify-end"
              : align === "center"
              ? "justify-center"
              : "justify-start"
          }`}
        >
          <span>{label}</span>
          <span
            className={`inline-flex items-center shrink-0 transition-transform ${
              isSorted
                ? "text-[#002185] dark:text-blue-400"
                : "text-slate-400/60 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
            }`}
          >
            {isSorted ? (
              sortOrder === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            )}
          </span>
        </div>
      </th>
    );
  };

  const isAllSelected =
    filteredEmployees.length > 0 &&
    selectedEmployeeIds.length === filteredEmployees.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      id="employee-directory-component"
      className="space-y-6"
    >
      {/* Top Filter / Search Bar & KPI Stat Chips */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#002185] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Staff Members & Directory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Search, filter, manage records, bulk-update departments/statuses, and access full employee profiles.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50/70 dark:bg-[#111927]/60 border border-slate-200/70 dark:border-slate-800 text-center min-w-[60px] shadow-none">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {metrics.total}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Total
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 text-center min-w-[65px] shadow-none">
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.active}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">
                Active
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/60 text-center min-w-[70px] shadow-none">
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {metrics.onLeave}
              </div>
              <div className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider">
                On Leave
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/60 text-center min-w-[75px] shadow-none">
              <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                {metrics.terminated}
              </div>
              <div className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold uppercase tracking-wider">
                Terminated
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 text-center min-w-[65px] shadow-none">
              <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {metrics.inactive}
              </div>
              <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wider">
                Inactive
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50/70 dark:bg-[#111927]/60 border border-slate-200/70 dark:border-slate-800 text-center min-w-[55px] shadow-none">
              <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {metrics.deptsCount}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Depts
              </div>
            </div>
          </div>
        </div>

        {/* Action Message Feedback Banner */}
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-none ${
              actionMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/60"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/70 dark:border-rose-800/60"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bulk Selection Actions Bar */}
        {isAdmin && selectedEmployeeIds.length > 0 && (
          <div className="mt-4 p-3.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-none">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#002185] dark:bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-none">
                {selectedEmployeeIds.length}
              </div>
              <div>
                <div className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  {selectedEmployeeIds.length} Employee{selectedEmployeeIds.length > 1 ? "s" : ""} Selected
                </div>
                <div className="text-[11px] text-blue-700 dark:text-blue-300">
                  Choose a batch action to apply across selected employees.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Delete Selected Employees */}
              <button
                type="button"
                id="btn-bulk-delete"
                onClick={() => {
                  setBulkAction("delete");
                  setShowBulkModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-600 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              {/* Update Status */}
              <button
                type="button"
                id="btn-bulk-change-status"
                onClick={() => {
                  setBulkAction("status");
                  setBulkTargetStatus("active");
                  setShowBulkModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#111927] border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Update Status</span>
              </button>

              {/* Assign Department */}
              <button
                type="button"
                id="btn-bulk-change-department"
                onClick={() => {
                  setBulkAction("department");
                  setBulkTargetDepartment(rawDepartments[0] || "Engineering");
                  setShowBulkModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#111927] border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Building className="w-3.5 h-3.5" />
                <span>Assign Department</span>
              </button>

              {/* Export Selected CSV */}
              <button
                type="button"
                id="btn-bulk-export-csv"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Selected</span>
              </button>

              {/* Clear Selection */}
              <button
                type="button"
                id="btn-bulk-clear-selection"
                onClick={() => setSelectedEmployeeIds([])}
                className="p-1.5 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-200/50 dark:hover:bg-blue-900/40 text-xs font-semibold transition-all cursor-pointer"
                title="Deselect all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Search Input and Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row gap-3">
          {/* Real-Time Name Search Bar & Department Dropdown Filter Group */}
          <div className="flex-1 flex flex-col sm:flex-row gap-2.5">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="employee-search-bar"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee records by name, role, email, or ID..."
                aria-label="Real-time employee search by name or department"
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-[#002185]/25 transition-all shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  title="Clear search input"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Department Dropdown Filter alongside Search Bar */}
            <div className="relative sm:w-52 shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <select
                id="employee-department-filter"
                aria-label="Filter by department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full pl-8.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer hover:border-blue-500 transition-all shrink-0 font-medium shadow-2xs"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "All" ? "All Departments" : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Controls: Status, Sort, View Mode & Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Status Filter */}
            <select
              id="employee-status-filter"
              aria-label="Filter by status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer hover:border-blue-500 transition-all shrink-0"
            >
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st === "All" ? "All Statuses" : st}
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              id="employee-sort-select"
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split("-");
                setSortField(f);
                setSortOrder(o);
              }}
              className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer hover:border-blue-500 transition-all shrink-0 font-medium"
              title="Sort employee list"
            >
              <option value="fullName-asc">Sort: Name (A → Z)</option>
              <option value="fullName-desc">Sort: Name (Z → A)</option>
              <option value="employmentDate-desc">Sort: Joining Date (Newest)</option>
              <option value="employmentDate-asc">Sort: Joining Date (Oldest)</option>
              <option value="baseSalary-desc">Sort: Salary (Highest)</option>
              <option value="baseSalary-asc">Sort: Salary (Lowest)</option>
              <option value="employeeId-asc">Sort: ID (Ascending)</option>
              <option value="department-asc">Sort: Department (A → Z)</option>
              <option value="status-asc">Sort: Status</option>
            </select>

            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-[#162033]/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid Card View"
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-[#002185] dark:bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Table List View"
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-[#002185] dark:bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh Button */}
            {typeof onRefresh === "function" && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                title="Refresh staff records"
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#162033]/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw
                  className="w-4 h-4"
                />}
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            {/* Download / Export CSV Button */}
            <button
              id="btn-directory-export-csv"
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting || employees.length === 0}
              title={`Download employee records as CSV (${filteredEmployees.length} records)`}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer disabled:opacity-50 ${
                exportSuccess
                  ? "bg-emerald-600 text-white border border-emerald-600"
                  : "bg-slate-50 dark:bg-[#162033]/80 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-600"
              }`}
            >
              {exportSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Exported!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                  <span className="ml-0.5 px-1.5 py-px rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-current font-bold">
                    {selectedEmployeeIds.length > 0
                      ? selectedEmployeeIds.length
                      : filteredEmployees.length}
                  </span>
                </>
              )}
            </button>

            {/* New Employee Button */}
            {typeof setShowEmployeeModal === "function" && (
              <button
                id="btn-directory-new-employee"
                type="button"
                onClick={() => setShowEmployeeModal(true)}
                title="Add a new employee to directory"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Employee</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Department Quick Filter Pills */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <span className="text-slate-400 dark:text-slate-500 font-medium shrink-0 flex items-center gap-1 mr-0.5">
            <Layers className="w-3 h-3" />
            <span>Quick Dept:</span>
          </span>
          {departments.slice(0, 9).map((dept) => {
            const isActive = selectedDepartment === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDepartment(dept)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#002185] dark:bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60"
                }`}
              >
                {dept === "All" ? "All Departments" : dept}
              </button>
            );
          })}
        </div>

        {/* Filter tags summary */}
        {(search || selectedDepartment !== "All" || selectedStatus !== "All") && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>
                Showing <strong className="text-slate-900 dark:text-white">{filteredEmployees.length}</strong> matching results of {employees.length} total staff
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportCSV}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1 text-[11px]"
              >
                <Download className="w-3 h-3" />
                Export Filtered
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedDepartment("All");
                  setSelectedStatus("All");
                }}
                className="text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LOADING STATE PROTECTION & EMPTY STATE CONDITION */}
      {isLoading ? (
        <WorkspaceLoader fullScreen={false} />
      ) : !isLoading && employees.length === 0 ? (
        /* PROFESSIONAL EMPTY STATE: Zero database records */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 sm:p-16 text-center shadow-xs"
        >
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center mx-auto mb-4 shadow-2xs">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            No employees added yet.
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            Get started by adding your first employee to the system to view attendance and payroll data.
          </p>
          <div className="mt-6 flex items-center justify-center">
            <button
              id="btn-empty-add-employee"
              type="button"
              onClick={() => {
                if (typeof setShowEmployeeModal === "function") {
                  setShowEmployeeModal(true);
                } else {
                  window.location.href = "/admin/employees";
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer hover:shadow-md active:scale-98"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Employee</span>
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Grid Card View with Selection Checkboxes & Framer Motion Transitions */}
          {viewMode === "grid" && filteredEmployees.length > 0 && (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
        >
          <AnimatePresence mode="popLayout">
            {filteredEmployees.map((emp) => {
              const badge = getStatusBadge(emp.status, emp.isActive, emp);
              const empId = emp._id || emp.employeeId;
              const isSelected = selectedEmployeeIds.includes(empId);
              const initials = (emp.fullName || "E")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  key={empId}
                  id={`directory-card-${emp.employeeId || empId}`}
                  className={`bg-white dark:bg-[#111927] border rounded-2xl p-5 sm:p-6 shadow-none hover:shadow-sm transition-all duration-150 flex flex-col justify-between group cursor-default relative ${
                    isSelected
                      ? "border-blue-500/80 ring-1 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20"
                      : "border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div>
                    {/* Top Row: Checkbox, Avatar, Name, ID & Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox for Admin bulk action */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleSelectOne(empId)}
                            className="shrink-0 text-slate-400 hover:text-blue-600 transition-colors p-0.5 cursor-pointer"
                            title={isSelected ? "Deselect" : "Select employee"}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                            )}
                          </button>
                        )}

                        <Avatar
                          src={
                            emp.profilePicture ||
                            emp.profile_picture ||
                            emp.avatar ||
                            emp.avatar_url ||
                            emp.profile_image_url
                          }
                          name={emp.fullName}
                          size="lg"
                          shape="rounded"
                          className="w-12 h-12 rounded-xl shrink-0 shadow-none"
                          fallbackInitials={initials}
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {emp.fullName}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-mono bg-slate-50 dark:bg-[#111927] px-1.5 py-0.5 rounded border border-slate-200/70 dark:border-slate-800 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                              {emp.employeeId || "EMP"}
                            </span>
                            <span className="truncate">{emp.department}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-lg border shrink-0 transition-all shadow-none ${badge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </div>

                    {/* Role Title */}
                    <div className="mt-3.5 flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50/70 dark:bg-[#111927]/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                      <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">
                        {emp.position || "Staff Member"}
                      </span>
                    </div>

                    {/* Contact Details Info Box */}
                    <div className="mt-3 space-y-1.5 text-xs">
                      {/* Email */}
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group/item">
                        <a
                          href={`mailto:${emp.email}`}
                          className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {emp.email || "No email"}
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy(emp.email, `email_${empId}`)}
                          title="Copy email"
                          className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors cursor-pointer"
                        >
                          {copiedField === `email_${empId}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group/item">
                        <a
                          href={`tel:${emp.phone}`}
                          className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{emp.phone || "+233 24 000 0000"}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy(emp.phone, `phone_${empId}`)}
                          title="Copy phone number"
                          className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors cursor-pointer"
                        >
                          {copiedField === `phone_${empId}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-2 px-2 py-1 text-slate-400 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{emp.location || "Accra Head Office"}</span>
                      </div>

                      {/* Joining Date & Salary Meta Row */}
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400" title="Joining Date">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Joined {formatDate(emp.employmentDate || emp.joiningDate || emp.hireDate || emp.dateOfJoining || emp.createdAt)}</span>
                        </div>
                        <div className="font-mono font-semibold text-slate-800 dark:text-slate-200" title="Base Salary">
                          {formatSalary(emp.baseSalary ?? emp.basicSalary ?? emp.salary ?? 0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => setEmployeeToDelete(emp)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-none"
                        title="Delete employee permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Type: {emp.employmentType || "Full-time"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedEmployee(emp)}
                      className="px-3 py-1.5 rounded-xl bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-none flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Table / List View - Desktop Table + Mobile Card-View */}
      {viewMode === "table" && filteredEmployees.length > 0 && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Mobile Card-View Mode (Visible on small screens: < md) */}
          <div className="block md:hidden space-y-3.5">
            {/* Mobile Bulk Selection Bar (Admin only) */}
            {isAdmin && filteredEmployees.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-[#111927] rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-none">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {isAllSelected
                      ? `All ${filteredEmployees.length} selected`
                      : selectedEmployeeIds.length > 0
                      ? `${selectedEmployeeIds.length} selected`
                      : "Select all staff"}
                  </span>
                </button>
                {selectedEmployeeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(true)}
                    className="px-2.5 py-1 bg-[#002185] dark:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-none cursor-pointer"
                  >
                    Bulk Action
                  </button>
                )}
              </div>
            )}

            {/* Mobile Cards List with Staggered Variants */}
            <motion.div
              key={`mobile-cards-${selectedDepartment}-${selectedStatus}-${search}-${sortField}-${sortOrder}`}
              variants={tableContainerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3.5"
            >
              {filteredEmployees.map((emp) => {
                const badge = getStatusBadge(emp.status, emp.isActive, emp);
                const empId = emp._id || emp.employeeId;
                const isSelected = selectedEmployeeIds.includes(empId);
                const initials = (emp.fullName || "E")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const isUpdatingThis = statusUpdatingId === empId;

                return (
                  <motion.div
                    layout
                    variants={tableRowVariants}
                    key={`mobile-card-${empId}`}
                    id={`mobile-employee-card-${empId}`}
                    className={`bg-white dark:bg-[#111927] border rounded-xl p-4 shadow-none transition-all ${
                      isSelected
                        ? "border-blue-500/80 bg-blue-50/20 dark:bg-blue-950/20"
                        : "border-slate-200/70 dark:border-slate-800"
                    }`}
                  >
                  {/* Card Header: Checkbox + Avatar + Names + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggleSelectOne(empId)}
                          className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer shrink-0"
                          title={isSelected ? "Deselect" : "Select"}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          )}
                        </button>
                      )}

                      <Avatar
                        src={
                          emp.profilePicture ||
                          emp.profile_picture ||
                          emp.avatar ||
                          emp.avatar_url ||
                          emp.profile_image_url
                        }
                        name={emp.fullName}
                        size="md"
                        shape="rounded"
                        className="w-11 h-11 rounded-xl shrink-0 shadow-2xs"
                        fallbackInitials={initials}
                      />

                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {emp.fullName}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-px rounded border border-blue-200/60 dark:border-blue-800/60">
                            {emp.employeeId || "EMP"}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {emp.role || "Staff"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>

                  {/* Department & Role Badge */}
                  <div className="mt-3 flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#162033]/50 border border-slate-200/60 dark:border-slate-800/60 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold truncate">
                      <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{emp.position || "Staff Member"}</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0 bg-white dark:bg-[#111927] px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                      {emp.department || "General"}
                    </span>
                  </div>

                  {/* Contact Info (Clickable for Mobile) */}
                  <div className="mt-2.5 space-y-1.5 text-xs">
                    {/* Email */}
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50/50 dark:bg-[#162033]/30">
                      <a
                        href={`mailto:${emp.email}`}
                        className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 truncate text-[11px]"
                      >
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{emp.email || "No email"}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(emp.email, `mobile_email_${empId}`)}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded cursor-pointer"
                        title="Copy email"
                      >
                        {copiedField === `mobile_email_${empId}` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50/50 dark:bg-[#162033]/30">
                      <a
                        href={`tel:${emp.phone}`}
                        className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 text-[11px]"
                      >
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{emp.phone || "+233 24 000 0000"}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(emp.phone, `mobile_phone_${empId}`)}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded cursor-pointer"
                        title="Copy phone"
                      >
                        {copiedField === `mobile_phone_${empId}` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 px-1.5 text-slate-400 text-[11px]">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{emp.location || "Accra Head Office"}</span>
                    </div>

                    {/* Joining Date & Salary Meta Row */}
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400" title="Joining Date">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Joined {formatDate(emp.employmentDate || emp.joiningDate || emp.hireDate || emp.dateOfJoining || emp.createdAt)}</span>
                      </div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-200" title="Base Salary">
                        {formatSalary(emp.baseSalary ?? emp.basicSalary ?? emp.salary ?? 0)}
                      </div>
                    </div>
                  </div>

                  {/* Admin Status Switcher Row */}
                  {isAdmin && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Status:
                        </span>
                        <div className="grid grid-cols-4 gap-1 flex-1 max-w-[240px]">
                          {[
                            { key: "active", label: "Active", activeClass: "bg-emerald-600 text-white" },
                            { key: "on leave", label: "Leave", activeClass: "bg-[#002185] dark:bg-blue-600 text-white" },
                            { key: "terminated", label: "Term", activeClass: "bg-rose-600 text-white" },
                            { key: "inactive", label: "Inact", activeClass: "bg-amber-600 text-white" },
                          ].map((st) => {
                            const isCurrent =
                              badge.code === st.key ||
                              badge.label.toLowerCase() === st.key;
                            return (
                              <button
                                key={st.key}
                                type="button"
                                disabled={isUpdatingThis || isCurrent}
                                onClick={() => handleStatusChange(empId, st.key)}
                                className={`py-1 rounded-lg text-[10px] font-semibold text-center transition-all cursor-pointer ${
                                  isCurrent
                                    ? `${st.activeClass} shadow-2xs font-bold`
                                    : "bg-slate-100 dark:bg-[#162033] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                                } disabled:opacity-50`}
                                title={`Set status to ${st.label}`}
                              >
                                {st.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Actions Footer */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => setEmployeeToDelete(emp)}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                        title="Delete employee permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {emp.employmentType || "Full-time"}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedEmployee(emp)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-none flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
            </motion.div>
          </div>

          {/* Desktop Table View (Visible on md and larger screens) */}
          <div className="hidden md:block bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl overflow-hidden shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 dark:bg-[#111927]/60 border-b border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold text-xs tracking-wider">
                  <tr>
                    {isAdmin && (
                      <th className="px-4 py-3.5 w-10 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={handleToggleSelectAll}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-[#002185]/25 cursor-pointer accent-blue-600"
                            aria-label={isAllSelected ? "Deselect all employees" : "Select all employees"}
                          />
                        </label>
                      </th>
                    )}
                    {renderSortHeader("fullName", "Staff Member")}
                    {renderSortHeader("employeeId", "ID")}
                    {renderSortHeader("department", "Role & Dept")}
                    {renderSortHeader("employmentDate", "Joining Date")}
                    {renderSortHeader("baseSalary", "Salary", "right")}
                    <th className="px-4 py-3.5">Contact Details</th>
                    {renderSortHeader("location", "Location")}
                    {renderSortHeader("status", "Status", "center")}
                    {isAdmin && <th className="px-4 py-3.5 text-center">Update Status</th>}
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <motion.tbody
                  key={`table-tbody-${selectedDepartment}-${selectedStatus}-${search}-${sortField}-${sortOrder}`}
                  variants={tableContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-slate-100 dark:divide-slate-800/80"
                >
                  {filteredEmployees.map((emp) => {
                    const badge = getStatusBadge(emp.status, emp.isActive, emp);
                    const empId = emp._id || emp.employeeId;
                    const isSelected = selectedEmployeeIds.includes(empId);
                    const initials = (emp.fullName || "E")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    const isUpdatingThis = statusUpdatingId === empId;

                    return (
                      <motion.tr
                        layout
                        variants={tableRowVariants}
                        key={empId}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelected ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
                        }`}
                      >
                        {/* Checkbox for Admin */}
                        {isAdmin && (
                          <td className="px-4 py-3 text-center">
                            <label className="inline-flex items-center justify-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectOne(empId)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-[#002185]/25 cursor-pointer accent-blue-600"
                                aria-label={`Select ${emp.fullName || emp.name || empId}`}
                              />
                            </label>
                          </td>
                        )}

                        {/* Name & Avatar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={
                                emp.profilePicture ||
                                emp.profile_picture ||
                                emp.avatar ||
                                emp.avatar_url ||
                                emp.profile_image_url
                              }
                              name={emp.fullName}
                              size="sm"
                              shape="rounded"
                              className="w-9 h-9 rounded-lg shrink-0 shadow-none"
                              fallbackInitials={initials}
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {emp.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {emp.role || "Employee"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Employee ID */}
                        <td className="px-4 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {emp.employeeId || "EMP"}
                        </td>

                        {/* Role & Dept */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {emp.position || "Staff Member"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {emp.department}
                          </div>
                        </td>

                        {/* Joining Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {formatDate(
                                emp.employmentDate ||
                                  emp.joiningDate ||
                                  emp.hireDate ||
                                  emp.dateOfJoining ||
                                  emp.createdAt
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Base Salary */}
                        <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-semibold text-slate-900 dark:text-white text-xs">
                          {formatSalary(emp.baseSalary ?? emp.basicSalary ?? emp.salary ?? 0)}
                        </td>

                        {/* Contact Details */}
                        <td className="px-4 py-3 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <a
                              href={`mailto:${emp.email}`}
                              className="hover:text-blue-600 hover:underline truncate max-w-[160px]"
                            >
                              {emp.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <Phone className="w-3 h-3" />
                            <span>{emp.phone || "+233 24 000 0000"}</span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{emp.location || "Accra Head Office"}</span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-lg border shadow-none ${badge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        </td>

                        {/* Change Status Action (Admin only) */}
                        {isAdmin && (
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-[#162033] rounded-lg border border-slate-200/70 dark:border-slate-700">
                              {[
                                { key: "active", label: "Active", activeClass: "bg-emerald-600 text-white" },
                                { key: "on leave", label: "On Leave", activeClass: "bg-[#002185] dark:bg-blue-600 text-white" },
                                { key: "terminated", label: "Terminated", activeClass: "bg-rose-600 text-white" },
                                { key: "inactive", label: "Inactive", activeClass: "bg-amber-600 text-white" },
                              ].map((st) => {
                                const isCurrent =
                                  badge.code === st.key ||
                                  badge.label.toLowerCase() === st.key;
                                return (
                                  <button
                                    key={st.key}
                                    type="button"
                                    disabled={isUpdatingThis || isCurrent}
                                    onClick={() => handleStatusChange(empId, st.key)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                                      isCurrent
                                        ? `${st.activeClass} shadow-none font-bold`
                                        : "bg-white dark:bg-[#111927] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600"
                                    } disabled:opacity-50`}
                                    title={`Set status to ${st.label}`}
                                  >
                                    {st.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        )}

                        {/* Action Buttons */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedEmployee(emp)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#162033] hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer shadow-none"
                            >
                              Profile
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setEmployeeToDelete(emp)}
                                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shadow-none"
                                title="Delete employee permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

          {/* Filter Empty State (when records exist in database but active search/filter matches 0) */}
          {filteredEmployees.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl p-12 text-center shadow-none"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#162033] text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No matching staff members found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Try adjusting your search query or clear the filter selections to view all registered staff.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  id="btn-empty-clear-filters"
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedDepartment("All");
                    setSelectedStatus("All");
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-[#162033] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Clear All Filters
                </button>
                {typeof setShowEmployeeModal === "function" && (
                  <button
                    id="btn-empty-new-employee"
                    type="button"
                    onClick={() => setShowEmployeeModal(true)}
                    className="px-4 py-2 bg-[#002185] dark:bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-[#001760] dark:hover:bg-blue-500 transition-colors cursor-pointer shadow-none flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>New Employee</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Bulk Action Confirmation Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            onClick={() => !isBulkUpdating && setShowBulkModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-[#111927] rounded-2xl max-w-md w-full overflow-hidden shadow-md dark:shadow-none border border-slate-200/70 dark:border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`p-5 border-b flex items-center gap-3.5 ${
                  bulkAction === "delete"
                    ? "bg-rose-50/70 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/60"
                    : "bg-blue-50/70 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/60"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-none shrink-0 ${
                    bulkAction === "delete" ? "bg-rose-600" : "bg-[#002185] dark:bg-blue-600"
                  }`}
                >
                  {bulkAction === "delete" ? (
                    <Trash2 className="w-5 h-5" />
                  ) : bulkAction === "department" ? (
                    <Building className="w-5 h-5" />
                  ) : (
                    <Activity className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3
                    className={`text-base font-bold ${
                      bulkAction === "delete"
                        ? "text-rose-950 dark:text-rose-100"
                        : "text-blue-950 dark:text-blue-100"
                    }`}
                  >
                    {bulkAction === "delete"
                      ? "Delete Selected Employees"
                      : bulkAction === "department"
                      ? "Assign Department"
                      : "Update Status"}
                  </h3>
                  <p
                    className={`text-xs mt-0.5 ${
                      bulkAction === "delete"
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {bulkAction === "delete"
                      ? `Permanently removing ${selectedEmployeeIds.length} selected employee record(s).`
                      : bulkAction === "department"
                      ? `Assigning department to ${selectedEmployeeIds.length} selected employee(s).`
                      : `Updating status for ${selectedEmployeeIds.length} selected employee(s).`}
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {bulkAction === "delete" && (
                  <div className="space-y-3">
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Permanent Action:</span> Deleting selected employees will permanently purge their profile data, system accounts, attendance logs, payroll calculations, and leave applications.
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-semibold mb-1.5 block">
                        Selected Employees ({selectedEmployeeIds.length}):
                      </span>
                      <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927]/40 p-2">
                        {selectedEmployeesList.map((emp) => (
                          <div
                            key={emp._id || emp.employeeId}
                            className="py-1.5 px-2 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {emp.fullName || emp.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {emp.employeeId}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {bulkAction === "department" && (
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                      Select Target Department
                    </label>
                    <select
                      value={bulkTargetDepartment}
                      onChange={(e) => setBulkTargetDepartment(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-[#162033] border border-slate-200/70 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                    >
                      {allAvailableDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {bulkAction === "status" && (
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                      Select Target Account Status
                    </label>
                    <select
                      value={bulkTargetStatus}
                      onChange={(e) => setBulkTargetStatus(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-[#162033] border border-slate-200/70 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="active">Active</option>
                      <option value="on leave">On Leave</option>
                      <option value="terminated">Terminated</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                )}

                {bulkAction !== "delete" && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#162033]/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700">
                    This change will be applied directly to the database and will reflect across payroll, permissions, and reporting modules.
                  </p>
                )}
              </div>

              <div className="p-4 bg-slate-50/70 dark:bg-[#162033]/60 border-t border-slate-200/70 dark:border-slate-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isBulkUpdating}
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-bulk-action"
                  disabled={isBulkUpdating}
                  onClick={handleExecuteBulkUpdate}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold transition-all shadow-none flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    bulkAction === "delete"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500"
                  }`}
                >
                  {isBulkUpdating ? (
                    <>
                      <WorkspaceLoader inline />
                      <span>
                        {bulkAction === "delete"
                          ? "Deleting Records..."
                          : "Updating Records..."}
                      </span>
                    </>
                  ) : bulkAction === "delete" ? (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete {selectedEmployeeIds.length} Employee{selectedEmployeeIds.length > 1 ? "s" : ""}</span>
                    </>
                  ) : bulkAction === "department" ? (
                    <>
                      <Building className="w-3.5 h-3.5" />
                      <span>Assign Department</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Update Status</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {employeeToDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            onClick={() => !isDeleting && setEmployeeToDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-[#111927] rounded-2xl max-w-md w-full overflow-hidden shadow-md dark:shadow-none border border-slate-200/70 dark:border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-rose-50/70 dark:bg-rose-950/40 p-5 border-b border-rose-200/60 dark:border-rose-800/60 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-none shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-950 dark:text-rose-100">
                    Confirm Employee Deletion
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                    This action permanently removes the record from the database.
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3 bg-slate-50/70 dark:bg-[#162033]/60 rounded-xl border border-slate-200/70 dark:border-slate-700 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Staff Name:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {employeeToDelete.fullName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Employee ID:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {employeeToDelete.employeeId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email Address:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {employeeToDelete.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {employeeToDelete.department}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-800/60">
                  Warning: Once deleted, this employee will no longer be able to log in, and all associated profile data will be permanently cleared from the active database.
                </p>
              </div>

              <div className="p-4 bg-slate-50/70 dark:bg-[#162033]/60 border-t border-slate-200/70 dark:border-slate-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setEmployeeToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteEmployee}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-none flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <WorkspaceLoader inline />
                      <span>Deleting Record...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Employee</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Employee Profile Detail Modal with Print and Salary Adjustments Tab */}
      <EmployeeDetailModal
        employee={selectedEmployee}
        isOpen={Boolean(selectedEmployee)}
        onClose={() => setSelectedEmployee(null)}
        isAdmin={isAdmin}
        statusUpdatingId={statusUpdatingId}
        onStatusChange={handleStatusChange}
        onDeleteRequest={(emp) => setEmployeeToDelete(emp)}
        getStatusBadge={getStatusBadge}
        formatDate={formatDate}
      />
    </motion.div>
  );
};

export default EmployeeDirectory;
