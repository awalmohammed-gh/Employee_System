import WorkspaceLoader from "../ui/WorkspaceLoader";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  X,
  User,
  Calendar,
  Banknote,
  Calculator,
  FileText,
  AlertTriangle,
  Clock,
  UserX,
  Plus,
  Trash2,
  Building2,
  Briefcase,
  ChevronDown,
  Check,
  Search,
  Info,
} from "lucide-react";
import { namesList, payrollGenerate, calculatePayrollSummary, getEmployeeProfile } from "../../apis/fontApis";
import { useManagement } from "../../context/ManagementContextProvider";
import Loading from "../../ui/Loading";
import AnimatedModal from "../ui/AnimatedModal";
import { motion } from "framer-motion";
import { buttonPressProps } from "../../utils/motion";
import { isWorkingDay, useWorkSchedule } from "../../utils/workSchedule";

/**
 * Calculates total standard business days (Monday to Friday) in a given month.
 * Supports both YYYY-MM and human-readable month strings.
 */
export const calculateWorkingDays = (monthString, isWorkDay = isWorkingDay) => {
  if (!monthString) return 22;
  const now = new Date();
  let year = now.getFullYear();
  let monthIdx = now.getMonth();

  const parts = String(monthString).trim().split("-");
  if (parts.length === 2) {
    const parsedY = parseInt(parts[0], 10);
    const parsedM = parseInt(parts[1], 10) - 1;
    if (!isNaN(parsedY)) year = parsedY;
    if (!isNaN(parsedM) && parsedM >= 0 && parsedM <= 11) monthIdx = parsedM;
  } else {
    const ym = String(monthString).match(/\b(20\d\d)\b/);
    if (ym) year = parseInt(ym[1], 10);
    const months = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];
    const found = months.findIndex((m) => String(monthString).toLowerCase().includes(m));
    if (found !== -1) monthIdx = found;
  }

  let count = 0;
  const totalDays = new Date(year, monthIdx + 1, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    if (isWorkDay(new Date(year, monthIdx, d))) {
      count++;
    }
  }
  return count > 0 ? count : 22;
};

/**
 * Formats a YYYY-MM string to human-readable Month YYYY (e.g. "September 2026").
 */
export const formatMonthLabel = (monthString) => {
  if (!monthString) return "";
  const parts = String(monthString).trim().split("-");
  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (!isNaN(year) && !isNaN(monthIdx) && monthIdx >= 0 && monthIdx <= 11) {
      return new Date(year, monthIdx, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
  }
  return monthString;
};

export const GeneratePayslipModal = ({ onClose, onSuccess, isOpen = true }) => {
  // Current month in YYYY-MM format by default
  const defaultPayMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const [payslipForm, setPayslipForm] = useState({
    employeeId: "",
    month: defaultPayMonth,
    paymentDate: new Date().toISOString().split("T")[0],
    basicSalary: "",
    deductions: 0,
    absentDaysDeduction: 0,
    latenessDeduction: 0,
    originalAbsenceDeduction: 0,
    originalLatenessDeduction: 0,
    paymentMethod: "Bank Transfer",
    remarks: "",
  });

  // Dynamic Manual Allowances line items
  const [manualAllowances, setManualAllowances] = useState([
    { id: "allowance-1", title: "Transport Allowance", amount: "" },
  ]);

  // Selected Employee Profile Cache & Attendance Metrics
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [attendanceMetrics, setAttendanceMetrics] = useState(null);

  // Manual Penalty Override & Waiver States
  const [isWaiverActive, setIsWaiverActive] = useState(false);
  const [waiveAbsence, setWaiveAbsence] = useState(false);
  const [waiveLateness, setWaiveLateness] = useState(false);
  const [waiverReason, setWaiverReason] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const { setShowToast } = useManagement();
  const [employeeNames, setEmployeeNames] = useState([]);

  // Fetch compact employee list for dropdown
  useEffect(() => {
    const fetchNameList = async () => {
      try {
        const { data } = await namesList();
        if (data.success) {
          setEmployeeNames(data.employees || []);
        } else {
          setShowToast({
            message: data.message || "Failed to load employee list",
            type: "error",
            show: true,
          });
        }
      } catch (error) {
        console.error("Error loading employee names:", error);
      }
    };

    fetchNameList();
  }, [setShowToast]);

  const { isWorkingDay: checkWorkingDay } = useWorkSchedule();

  // Working days determination for selected month
  const standardWorkingDays = useMemo(() => {
    if (attendanceMetrics?.standardWorkingDays && Number(attendanceMetrics.standardWorkingDays) > 0) {
      return Number(attendanceMetrics.standardWorkingDays);
    }
    return calculateWorkingDays(payslipForm.month, checkWorkingDay);
  }, [attendanceMetrics, payslipForm.month, checkWorkingDay]);

  // Base monthly salary numeric value
  const basicSalary = Number(payslipForm.basicSalary) || 0;
  const generalDeductions = Number(payslipForm.deductions) || 0;

  // Daily Salary Rate = Employee Base Salary / Total Working Days in Month
  const dailySalaryRate = useMemo(() => {
    if (standardWorkingDays > 0 && basicSalary > 0) {
      return parseFloat((basicSalary / standardWorkingDays).toFixed(2));
    }
    return 0;
  }, [basicSalary, standardWorkingDays]);

  // Sum of manual allowances
  const sumManualAllowances = useMemo(() => {
    return manualAllowances.reduce((sum, item) => {
      const val = parseFloat(item.amount);
      return sum + (isNaN(val) || val < 0 ? 0 : val);
    }, 0);
  }, [manualAllowances]);

  // Unexcused Absent Days count from attendance metrics
  const absentDaysCount = useMemo(() => {
    if (attendanceMetrics?.absentDays !== undefined && !isNaN(Number(attendanceMetrics.absentDays))) {
      return Number(attendanceMetrics.absentDays);
    }
    if (attendanceMetrics?.unexcusedAbsences !== undefined && !isNaN(Number(attendanceMetrics.unexcusedAbsences))) {
      return Number(attendanceMetrics.unexcusedAbsences);
    }
    const storedDeduct = Number(payslipForm.originalAbsenceDeduction || payslipForm.absentDaysDeduction || 0);
    if (storedDeduct > 0 && dailySalaryRate > 0) {
      return Math.round(storedDeduct / dailySalaryRate);
    }
    return 0;
  }, [
    attendanceMetrics,
    payslipForm.originalAbsenceDeduction,
    payslipForm.absentDaysDeduction,
    dailySalaryRate,
  ]);

  // Dynamic Total Absence Deduction = absentDays * dailySalaryRate
  // Automatically updates in real time when basicSalary or absentDaysCount changes
  const computedAbsenceDeduction = useMemo(() => {
    if (absentDaysCount > 0 && dailySalaryRate > 0) {
      return parseFloat((absentDaysCount * dailySalaryRate).toFixed(2));
    }
    if (absentDaysCount === 0) return 0;
    return Number(payslipForm.originalAbsenceDeduction || payslipForm.absentDaysDeduction || 0);
  }, [absentDaysCount, dailySalaryRate, payslipForm.originalAbsenceDeduction, payslipForm.absentDaysDeduction]);

  // Compute calculated vs waived attendance penalties
  const origAbsence = computedAbsenceDeduction;
  const origLateness = Number(payslipForm.originalLatenessDeduction || payslipForm.latenessDeduction || 0);
  const totalOriginalPenalties = parseFloat((origAbsence + origLateness).toFixed(2));

  let waivedAbsenceAmount = 0;
  let waivedLatenessAmount = 0;

  if (isWaiverActive) {
    if (waiveAbsence) waivedAbsenceAmount = origAbsence;
    if (waiveLateness) waivedLatenessAmount = origLateness;
  }

  const effectiveAbsentDeduction = Math.max(0, parseFloat((origAbsence - waivedAbsenceAmount).toFixed(2)));
  const effectiveLatenessDeduction = Math.max(0, parseFloat((origLateness - waivedLatenessAmount).toFixed(2)));
  const totalEffectiveAttendanceDeductions = parseFloat((effectiveAbsentDeduction + effectiveLatenessDeduction).toFixed(2));
  const totalWaivedSum = parseFloat((waivedAbsenceAmount + waivedLatenessAmount).toFixed(2));

  // Final Net Salary calculation: Base Salary + Total Allowances - (Total Absence Deductions + Total Lateness Penalties + Other Deductions)
  const totalAllDeductions = parseFloat((generalDeductions + totalEffectiveAttendanceDeductions).toFixed(2));
  const netSalary = Math.max(
    0,
    parseFloat((basicSalary + sumManualAllowances - totalAllDeductions).toFixed(2))
  );

  const formatCurrency = (amount) => {
    return (Number(amount) || 0).toLocaleString("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Auto-calculate values based on employee's attendance, working days, and penalties
  const handleAutoCalculate = useCallback(async (empId, monthVal, baseVal) => {
    const targetEmpId = empId !== undefined ? empId : payslipForm.employeeId;
    const targetMonth = monthVal || payslipForm.month || defaultPayMonth;
    const targetBase = baseVal !== undefined ? baseVal : (Number(payslipForm.basicSalary) || 2500);

    if (!targetEmpId) return;

    try {
      setIsCalculating(true);
      const params = {
        month: targetMonth,
        baseSalaryInput: targetBase,
        employeeId: targetEmpId,
      };

      const res = await calculatePayrollSummary(params);
      if (res.data && res.data.success) {
        const resData = res.data;
        const summary = resData.summary || resData;
        const calc = summary?.salaryCalculation || summary;
        const metrics = summary?.workingDaysMetric || resData.workingDaysMetric || null;

        const earnedBase = resData.baseSalary ?? resData.basicSalary ?? calc?.baseSalary ?? calc?.basicSalary ?? calc?.earnedBaseSalary ?? targetBase;
        const absDeduct = Number(
          resData.absenceDeductions ??
          resData.absentDaysDeduction ??
          calc?.absenceDeductions ??
          calc?.absentDaysDeduction ??
          calc?.deductions?.absenceDeductions ??
          calc?.deductions?.absenceDeduction ??
          summary?.absenceDeductions ??
          summary?.absentDaysDeduction ??
          0
        );
        const lateDeduct = Number(
          resData.latenessPenalties ??
          resData.latenessDeductions ??
          calc?.latenessPenalties ??
          calc?.latenessDeductions ??
          calc?.latenessPenalty ??
          calc?.deductions?.latenessPenalties ??
          calc?.deductions?.latenessDeduction ??
          summary?.latenessPenalties ??
          summary?.latenessDeductions ??
          0
        );

        setAttendanceMetrics(metrics);

        const remarksText = resData.remarks || `Calculated from ${metrics?.presentDays ?? metrics?.attendedDays ?? 0} attended days, ${metrics?.approvedPaidLeaveDays || 0} approved leaves, ${metrics?.absentDays ?? resData.absentDays ?? 0} absent days, and ${metrics?.lateDays ?? resData.lateDays ?? 0} late check-in(s) for ${formatMonthLabel(targetMonth)}.`;

        setPayslipForm((prev) => ({
          ...prev,
          basicSalary: earnedBase,
          absentDaysDeduction: absDeduct,
          latenessDeduction: lateDeduct,
          originalAbsenceDeduction: absDeduct,
          originalLatenessDeduction: lateDeduct,
          remarks: remarksText,
        }));
      }
    } catch (err) {
      console.warn("Auto calculation notice:", err.message);
    } finally {
      setIsCalculating(false);
    }
  }, [payslipForm.employeeId, payslipForm.month, payslipForm.basicSalary, defaultPayMonth]);

  const handleRecalculate = () => {
    if (!payslipForm.employeeId) {
      setShowToast({
        message: "Please select an employee before recalculating.",
        type: "error",
        show: true,
      });
      return;
    }
    handleAutoCalculate(payslipForm.employeeId, payslipForm.month, payslipForm.basicSalary);
  };

  // Handle Employee Change -> immediately fetch profile & auto-calculate
  const handleEmployeeChange = async (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setSelectedEmployee(null);
      setAttendanceMetrics(null);
      setPayslipForm((prev) => ({
        ...prev,
        employeeId: "",
        basicSalary: "",
        absentDaysDeduction: 0,
        latenessDeduction: 0,
        originalAbsenceDeduction: 0,
        originalLatenessDeduction: 0,
      }));
      return;
    }

    // Find in local list
    const foundEmp = employeeNames.find((emp) => String(emp._id) === String(selectedId));
    let empBaseSalary = foundEmp && foundEmp.baseSalary ? Number(foundEmp.baseSalary) : 2500;

    setSelectedEmployee(foundEmp || { _id: selectedId });

    // Update form state with employee base salary
    setPayslipForm((prev) => ({
      ...prev,
      employeeId: selectedId,
      basicSalary: empBaseSalary > 0 ? empBaseSalary : 2500,
    }));

    // Trigger auto-calculation
    handleAutoCalculate(selectedId, payslipForm.month, empBaseSalary > 0 ? empBaseSalary : 2500);

    // Also fetch full employee profile asynchronously if needed
    try {
      const profileRes = await getEmployeeProfile(selectedId);
      if (profileRes.data?.success && profileRes.data?.employee) {
        const fullEmp = profileRes.data.employee;
        setSelectedEmployee(fullEmp);
        if (fullEmp.baseSalary && Number(fullEmp.baseSalary) > 0) {
          const profileBaseSalary = Number(fullEmp.baseSalary);
          setPayslipForm((prev) => ({
            ...prev,
            basicSalary: profileBaseSalary,
          }));
        }
      }
    } catch (err) {
      console.warn("Could not fetch full profile:", err.message);
    }
  };

  // Format employee option text with fallback
  const formatEmployeeOption = useCallback((employee) => {
    if (!employee) return "";
    const idStr = employee.employeeId || "EMP";
    const nameStr = employee.fullName || "Staff";
    const deptStr = employee.department ? ` (${employee.department})` : "";
    const baseStr = employee.baseSalary ? ` - Base: ${formatCurrency(employee.baseSalary)}` : "";
    return `${idStr} - ${nameStr}${deptStr}${baseStr}`;
  }, []);

  // Dropdown state for accessible contained employee selection
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedEmployeeLabel = useMemo(() => {
    if (!payslipForm.employeeId) return "";
    const found = employeeNames.find((e) => String(e._id) === String(payslipForm.employeeId));
    return found ? formatEmployeeOption(found) : "";
  }, [payslipForm.employeeId, employeeNames, formatEmployeeOption]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearchQuery.trim()) return employeeNames;
    const q = employeeSearchQuery.toLowerCase();
    return employeeNames.filter((emp) => {
      const name = (emp.fullName || "").toLowerCase();
      const id = (emp.employeeId || "").toLowerCase();
      const dept = (emp.department || "").toLowerCase();
      return name.includes(q) || id.includes(q) || dept.includes(q);
    });
  }, [employeeNames, employeeSearchQuery]);

  const handleSelectEmployee = (empId) => {
    handleEmployeeChange({ target: { value: empId } });
  };

  // Handle Input Changes with immediate auto-calculation trigger on Month change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setPayslipForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // If month changes, automatically trigger attendance & rate recalculation
    if (name === "month" && payslipForm.employeeId) {
      handleAutoCalculate(payslipForm.employeeId, value, payslipForm.basicSalary);
    }
  };

  // Manual Allowance handlers
  const handleAddAllowance = () => {
    setManualAllowances((prev) => [
      ...prev,
      { id: `allowance-${Date.now()}`, title: "", amount: "" },
    ]);
  };

  const handleRemoveAllowance = (id) => {
    setManualAllowances((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAllowanceChange = (id, field, value) => {
    setManualAllowances((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e) => {
    try {
      e.preventDefault();
      if (!payslipForm.employeeId) {
        setShowToast({
          message: "Please select an employee first.",
          type: "error",
          show: true,
        });
        return;
      }

      setIsLoading(true);

      const penaltyOverrideData = isWaiverActive && totalWaivedSum > 0 ? {
        isWaived: true,
        waivedAbsenceDeduction: waivedAbsenceAmount,
        waivedLatenessDeduction: waivedLatenessAmount,
        totalWaived: totalWaivedSum,
        reason: waiverReason.trim() || "Manual attendance penalty waiver approved by Administrator.",
      } : { isWaived: false };

      // Format custom earnings / allowances
      const validAllowances = manualAllowances
        .filter((a) => a.title.trim() && Number(a.amount) > 0)
        .map((a) => ({
          name: a.title.trim(),
          description: a.title.trim(),
          amount: parseFloat(a.amount),
        }));

      const payslipData = {
        employee: payslipForm.employeeId,
        payMonth: payslipForm.month,
        formattedPayMonth: formatMonthLabel(payslipForm.month),
        paymentDate: payslipForm.paymentDate,
        basicSalary: basicSalary,
        baseSalary: basicSalary,
        standardWorkingDays,
        dailySalaryRate,
        dailyRate: dailySalaryRate,
        absentDays: absentDaysCount,
        earnings: validAllowances,
        allowances: sumManualAllowances,
        deductions: generalDeductions,
        absentDaysDeduction: effectiveAbsentDeduction,
        latenessDeduction: effectiveLatenessDeduction,
        originalAbsenceDeduction: origAbsence,
        originalLatenessDeduction: origLateness,
        penaltyOverride: penaltyOverrideData,
        paymentMethod: payslipForm.paymentMethod,
        remarks: payslipForm.remarks || (penaltyOverrideData.isWaived ? `Waived GH₵${totalWaivedSum} penalties. (${penaltyOverrideData.reason})` : ""),
        netSalary: netSalary,
        netPay: netSalary,
        status: "Published",
      };

      const { data } = await payrollGenerate(payslipData);
      if (data.success) {
        setShowToast({
          message: data.message || "Payslip generated and recorded successfully!",
          type: "success",
          show: true,
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setShowToast({
          message: data.message || "Failed to generate payslip",
          type: "error",
          show: true,
        });
      }
    } catch (error) {
      console.error(error);
      setShowToast({
        message: error.response?.data?.message || "An error occurred while generating the payslip.",
        type: "error",
        show: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return <Loading />;
  }

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      id="payslip-modal-container"
      className="max-w-xl lg:max-w-2xl"
    >
      {/* Modal Container */}
      <div
        className="relative z-10 flex max-h-[90vh] w-full flex-col rounded-2xl bg-white dark:bg-[#111927] shadow-xl border border-slate-200/70 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 px-5 sm:px-6 py-3.5 bg-white dark:bg-[#111927] shrink-0">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-[#002185] dark:text-blue-400">
              Generate &amp; Calculate Payslip
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
              Dynamic pay month selection, individual daily rate absence deductions, and live net pay.
            </p>
          </div>

          <motion.button
            id="btn-close-payslip-modal"
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Top Notice Banner: fluid wrapping layout, enterprise Info icon, clean hairline border */}
        <div className="mx-4 sm:mx-6 mt-3.5 p-3 rounded-xl bg-slate-50/80 dark:bg-[#162033]/50 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs shrink-0">
          <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm font-medium leading-relaxed text-[#002185] dark:text-blue-300 min-w-0">
            <Info className="w-4 h-4 text-[#002185] dark:text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">
              Dynamic absence penalty: Base Salary ÷ {standardWorkingDays} Working Days × Absent Days
            </span>
          </div>
          <button
            id="btn-auto-calculate-payslip"
            type="button"
            onClick={handleRecalculate}
            disabled={isCalculating || !payslipForm.employeeId}
            className="self-end sm:self-auto shrink-0 px-3.5 py-1.5 rounded-lg bg-[#002185] hover:bg-[#001760] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>{isCalculating ? <><WorkspaceLoader inline /> Calculating...</> : "Recalculate"}</span>
          </button>
        </div>

        {/* Form Body - Scrollable without horizontal overflow */}
        <form
          id="payslip-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-3.5 space-y-4 text-xs"
        >
          {/* Employee Selection */}
          <div ref={dropdownRef} className="relative w-full max-w-full">
            <label className="mb-1 block font-semibold text-[#002185] dark:text-slate-200 uppercase tracking-wider text-[11px]">
              Select Employee <span className="text-red-500">*</span>
            </label>

            <div className="relative w-full max-w-full">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />

              {/* Accessible Custom Dropdown Trigger Button */}
              <button
                id="payslip-employee-dropdown-trigger"
                type="button"
                onClick={() => setIsEmployeeDropdownOpen((prev) => !prev)}
                className="w-full max-w-full flex items-center justify-between rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111927] py-2.5 pl-10 pr-3 font-semibold text-slate-900 dark:text-slate-100 outline-hidden transition hover:border-[#002185] focus:border-[#002185] focus:ring-2 focus:ring-[#002185]/20 cursor-pointer overflow-hidden text-left shadow-2xs"
                aria-haspopup="listbox"
                aria-expanded={isEmployeeDropdownOpen}
              >
                <span
                  className={`truncate block flex-1 pr-2 text-xs sm:text-sm ${
                    selectedEmployee ? "text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-400 font-normal"
                  }`}
                  title={selectedEmployeeLabel || "-- Choose Staff Member --"}
                >
                  {selectedEmployeeLabel || "-- Choose Staff Member --"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isEmployeeDropdownOpen ? "rotate-180 text-[#002185] dark:text-blue-400" : ""
                  }`}
                />
              </button>

              {/* Native select kept for full DOM/form test compatibility */}
              <select
                id="payslip-employee-select"
                name="employeeId"
                value={payslipForm.employeeId}
                onChange={handleEmployeeChange}
                required
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="">-- Choose Staff Member --</option>
                {employeeNames.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {formatEmployeeOption(employee)}
                  </option>
                ))}
              </select>

              {/* Custom Popover Listbox: Anchored left-0 right-0 w-full max-w-full */}
              {isEmployeeDropdownOpen && (
                <div
                  id="payslip-employee-dropdown-menu"
                  className="absolute left-0 right-0 top-full mt-1.5 z-40 w-full max-w-full overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111927] shadow-xl animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Search Filter Input */}
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-[#162033]/50">
                    <div className="relative w-full">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search employee by name, ID or department..."
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111927] text-slate-900 dark:text-slate-100 outline-hidden focus:border-[#002185] focus:ring-1 focus:ring-[#002185]/30"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Options List */}
                  <div
                    role="listbox"
                    className="max-h-56 overflow-y-auto overflow-x-hidden divide-y divide-slate-100 dark:divide-slate-800/60"
                  >
                    {filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                        No matching staff members found
                      </div>
                    ) : (
                      filteredEmployees.map((employee) => {
                        const label = formatEmployeeOption(employee);
                        const isSelected = employee._id === payslipForm.employeeId;
                        return (
                          <button
                            key={employee._id}
                            type="button"
                            onClick={() => {
                              handleSelectEmployee(employee._id);
                              setIsEmployeeDropdownOpen(false);
                              setEmployeeSearchQuery("");
                            }}
                            className={`w-full max-w-full text-left px-3.5 py-2.5 transition flex items-center justify-between gap-2 overflow-hidden cursor-pointer ${
                              isSelected
                                ? "bg-blue-50/90 dark:bg-blue-950/50 text-[#002185] dark:text-blue-300 font-semibold"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            <span className="truncate block flex-1 text-xs" title={label}>
                              {label}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#002185] dark:text-blue-400 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Employee Profile Summary Pill */}
            {selectedEmployee && (
              <div className="mt-2 p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-2 text-[11px] animate-fade-in max-w-full overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <span className="font-bold text-[#002185] dark:text-blue-300 flex items-center gap-1 truncate max-w-full">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{selectedEmployee.fullName || selectedEmployee.employeeId}</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{selectedEmployee.department || "Operations"}</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                    <Briefcase className="w-3 h-3 shrink-0" />
                    <span className="truncate">{selectedEmployee.position || "Staff"}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span>Base: {formatCurrency(selectedEmployee.baseSalary || payslipForm.basicSalary || 2500)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Pay Month & Payment Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-[#002185] dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  Pay Month <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] font-bold text-[#002185] dark:text-blue-400">
                  {formatMonthLabel(payslipForm.month)}
                </span>
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="payslip-month-input"
                  type="month"
                  name="month"
                  value={payslipForm.month}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] py-2 pl-10 pr-4 font-semibold text-slate-900 dark:text-slate-100 outline-hidden transition focus:border-[#002185] focus:ring-2 focus:ring-[#002185]/20 cursor-pointer"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Selecting month auto-recalculates attendance for that billing period.
              </p>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#002185] dark:text-slate-200 uppercase tracking-wider text-[11px]">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="payslip-date-input"
                  type="date"
                  name="paymentDate"
                  value={payslipForm.paymentDate}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] py-2 pl-10 pr-4 font-medium text-slate-900 dark:text-slate-100 outline-hidden transition focus:border-[#002185] focus:ring-2 focus:ring-[#002185]/20 cursor-pointer"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Disbursement record execution date.
              </p>
            </div>
          </div>

          {/* Basic Monthly Salary & General Deductions */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-[#002185] dark:text-slate-200 uppercase tracking-wider text-[11px]">
                Basic Monthly Salary (GH₵) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="payslip-basic-salary"
                  type="number"
                  name="basicSalary"
                  value={payslipForm.basicSalary}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="2500.00"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] py-2 pl-10 pr-3 font-bold text-slate-900 dark:text-slate-100 outline-hidden transition focus:border-[#002185]"
                />
              </div>

              {/* Display computed daily rate alongside base salary */}
              <div className="mt-1.5 flex items-center justify-between text-[11px] px-0.5">
                <span className="font-bold text-[#002185] dark:text-blue-300">
                  Daily Rate: {formatCurrency(dailySalaryRate)}/day ({standardWorkingDays} Working Days)
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                  Base ÷ {standardWorkingDays}d
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#002185] dark:text-slate-200 uppercase tracking-wider text-[11px]">
                Other General Deductions (GH₵)
              </label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="payslip-deductions"
                  type="number"
                  name="deductions"
                  value={payslipForm.deductions}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] py-2 pl-10 pr-3 font-medium text-slate-900 dark:text-slate-100 outline-hidden transition focus:border-[#002185]"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Loan recovery, taxes, or general company adjustments.
              </p>
            </div>
          </div>

          {/* Manual Allowances Section (Dynamic Rows) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[#002185] dark:text-blue-400 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  Custom Allowances &amp; Bonuses
                </span>
                <p className="text-[10px] text-slate-500">Add individual allowance items (e.g. Transport, Overtime, Housing)</p>
              </div>

              <button
                id="btn-add-allowance-row"
                type="button"
                onClick={handleAddAllowance}
                className="px-2.5 py-1 rounded-lg border border-[#002185]/20 hover:bg-[#002185]/10 text-[#002185] dark:text-blue-400 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Allowance</span>
              </button>
            </div>

            {/* Allowance Rows */}
            <div className="space-y-2 max-w-full">
              {manualAllowances.map((item) => (
                <div key={item.id} className="flex items-center gap-2 max-w-full min-w-0">
                  <input
                    type="text"
                    placeholder="Allowance Title (e.g. Transport Allowance)"
                    value={item.title}
                    onChange={(e) => handleAllowanceChange(item.id, "title", e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-[#002185]"
                  />

                  <div className="relative w-28 sm:w-36 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">GH₵</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={item.amount}
                      onChange={(e) => handleAllowanceChange(item.id, "amount", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-8 pr-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-[#002185]"
                    />
                  </div>

                  {manualAllowances.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAllowance(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition cursor-pointer shrink-0"
                      title="Remove allowance"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-1 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              Total Allowances: <span className="font-bold text-emerald-600 dark:text-emerald-400 ml-1">{formatCurrency(sumManualAllowances)}</span>
            </div>
          </div>

          {/* Attendance Penalty Review & Auto-Calculation Breakdown */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#162033]/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-slate-900 dark:text-white">
                  Attendance Penalty Auto-Calculation
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Total Penalties: {formatCurrency(totalOriginalPenalties)}
              </span>
            </div>

            {/* Attendance Days Metric Stats */}
            {attendanceMetrics && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] text-center">
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block">Attended</span>
                    <span className="font-bold text-emerald-600 text-xs">{attendanceMetrics.presentDays || attendanceMetrics.attendedDays || 0}d</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block">Leaves</span>
                    <span className="font-bold text-blue-600 text-xs">{attendanceMetrics.approvedPaidLeaveDays || 0}d</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block">Absent</span>
                    <span className="font-bold text-rose-600 text-xs">{absentDaysCount}d</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block">Late Days</span>
                    <span className="font-bold text-amber-600 text-xs">{attendanceMetrics.lateDays || 0}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-slate-500 block">Unelapsed</span>
                    <span className="font-bold text-slate-600 dark:text-slate-400 text-xs">
                      {attendanceMetrics.futureWorkingDays !== undefined ? `${attendanceMetrics.futureWorkingDays}d (0 penalty)` : "0d"}
                    </span>
                  </div>
                </div>
                {attendanceMetrics.isCurrentMonth && attendanceMetrics.futureWorkingDays > 0 && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1.5 font-medium">
                    ℹ️ Active Mid-Month: Audited up to today ({attendanceMetrics.elapsedWorkingDays || 0} elapsed workdays). {attendanceMetrics.futureWorkingDays} future days are strictly unpenalized.
                  </p>
                )}
              </div>
            )}

            {/* Breakdown Grid with Explicit Absence Formula */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Absence Deductions Breakdown Box */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1 font-semibold">
                    <UserX className="w-3.5 h-3.5 text-rose-500" /> Absence Deductions:
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -{formatCurrency(origAbsence)}
                  </span>
                </div>

                {/* Explicit breakdown: Absent Days: 2 days × GH₵90.91 = -GH₵181.82 */}
                <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/30 px-2 py-1 rounded border border-rose-100 dark:border-rose-900/30">
                  Absent Days: {absentDaysCount} day{absentDaysCount === 1 ? "" : "s"} × {formatCurrency(dailySalaryRate)} = -{formatCurrency(origAbsence)}
                </div>
              </div>

              {/* Lateness Penalties Box */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Lateness Penalties:
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    -{formatCurrency(origLateness)}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/30 px-2 py-1 rounded border border-amber-100 dark:border-amber-900/30">
                  Evaluated across tiered delay minutes
                </div>
              </div>
            </div>

            {/* Manual Waiver / Override Controls */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-semibold text-[#002185] dark:text-blue-400 cursor-pointer">
                  <input
                    id="toggle-waiver-active"
                    type="checkbox"
                    checked={isWaiverActive}
                    onChange={(e) => setIsWaiverActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#002185] focus:ring-[#002185]/25"
                  />
                  <span>Enable Manual Penalty Waiver / Override</span>
                </label>
                {isWaiverActive && totalWaivedSum > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Waiving: {formatCurrency(totalWaivedSum)}
                  </span>
                )}
              </div>

              {isWaiverActive && (
                <div className="space-y-3 pt-2 pl-6 animate-fade-in">
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        id="chk-waive-absence"
                        type="checkbox"
                        checked={waiveAbsence}
                        onChange={(e) => setWaiveAbsence(e.target.checked)}
                        className="w-3.5 h-3.5 text-[#002185]"
                      />
                      <span>Waive Absence Deductions ({formatCurrency(origAbsence)})</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        id="chk-waive-lateness"
                        type="checkbox"
                        checked={waiveLateness}
                        onChange={(e) => setWaiveLateness(e.target.checked)}
                        className="w-3.5 h-3.5 text-[#002185]"
                      />
                      <span>Waive Lateness Penalties ({formatCurrency(origLateness)})</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Waiver Approval Reason / Justification <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="input-waiver-reason"
                      type="text"
                      placeholder="e.g. Medical emergency excused by HR, authorized client meeting on site"
                      value={waiverReason}
                      onChange={(e) => setWaiverReason(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111927] text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="mb-1 block font-semibold text-[#002185] dark:text-slate-200 uppercase tracking-wider text-[11px]">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="relative w-full max-w-full">
              <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                id="payslip-payment-method"
                name="paymentMethod"
                value={payslipForm.paymentMethod}
                onChange={handleChange}
                required
                className="w-full max-w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] py-2.5 pl-10 pr-9 font-medium text-slate-900 dark:text-slate-100 outline-hidden transition hover:border-[#002185] focus:border-[#002185] focus:ring-2 focus:ring-[#002185]/20 cursor-pointer truncate"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Cash">Cash</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1 block font-semibold text-[#002185] dark:text-slate-200 uppercase tracking-wider text-[11px]">
              Remarks
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <textarea
                id="payslip-remarks"
                name="remarks"
                value={payslipForm.remarks}
                onChange={handleChange}
                rows={2}
                placeholder="Attendance notes or payment remarks..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] py-2 pl-10 pr-4 font-medium text-slate-900 dark:text-slate-100 outline-hidden transition focus:border-[#002185] resize-none"
              />
            </div>
          </div>

          {/* Live Net Pay Preview Card */}
          <div className="rounded-xl border-2 border-[#002185]/30 bg-blue-50/70 dark:bg-blue-950/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[#002185] dark:text-blue-400 uppercase tracking-wider text-xs block">
                  Live Net Pay Preview:
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Base ({formatCurrency(basicSalary)}) + Allowances ({formatCurrency(sumManualAllowances)}) - Deductions &amp; Penalties ({formatCurrency(totalAllDeductions)})
                </p>
              </div>
              <span className="text-2xl font-bold text-[#002185] dark:text-blue-400">
                {formatCurrency(netSalary)}
              </span>
            </div>

            {/* Mini visual equation */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100 dark:border-blue-900/50 text-[10px] text-slate-500">
              <span>Base: <strong className="text-slate-700 dark:text-slate-300">{formatCurrency(basicSalary)}</strong></span>
              <span>+</span>
              <span>Allowances: <strong className="text-emerald-600">{formatCurrency(sumManualAllowances)}</strong></span>
              <span>-</span>
              <span>Absence: <strong className="text-rose-600">{formatCurrency(effectiveAbsentDeduction)}</strong></span>
              <span>-</span>
              <span>Late: <strong className="text-amber-600">{formatCurrency(effectiveLatenessDeduction)}</strong></span>
              {generalDeductions > 0 && (
                <>
                  <span>-</span>
                  <span>Other: <strong className="text-rose-600">{formatCurrency(generalDeductions)}</strong></span>
                </>
              )}
              <span>=</span>
              <span className="font-bold text-[#002185] dark:text-blue-300 text-xs">{formatCurrency(netSalary)}</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 border-t border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-3 bg-white dark:bg-[#111927] shrink-0">
          <motion.button
            id="btn-cancel-payslip"
            type="button"
            {...buttonPressProps}
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 font-semibold text-xs sm:text-sm text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-center"
          >
            Cancel
          </motion.button>

          <motion.button
            id="btn-submit-payslip"
            type="submit"
            form="payslip-form"
            {...buttonPressProps}
            disabled={!payslipForm.employeeId || isCalculating}
            className="w-full sm:w-auto rounded-xl bg-[#002185] hover:bg-[#001760] px-6 py-2.5 font-bold text-xs sm:text-sm text-white transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-center"
          >
            <Banknote className="w-4 h-4" />
            <span>Save &amp; Publish Payslip</span>
          </motion.button>
        </div>
      </div>
    </AnimatedModal>
  );
};

export default GeneratePayslipModal;
