import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState } from "react";
import {
  Calendar,
  Clock,
  FileText,
  Send,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Info,
} from "lucide-react";
import { applyForLeave } from "../apis/fontApis";
import { useManagement } from "../context/ManagementContextProvider";
import { ui, tones, selectChevronStyle } from "../pages/Employees/ui/tokens";
import { Badge } from "../pages/Employees/ui/primitives";

const LEAVE_TYPE_OPTIONS = [
  { value: "Annual Leave", label: "Annual Leave" },
  { value: "Sick Leave", label: "Sick Leave" },
  { value: "Casual Leave", label: "Casual Leave" },
  { value: "Maternity Leave", label: "Maternity Leave" },
  { value: "Paternity Leave", label: "Paternity Leave" },
  { value: "Study Leave", label: "Study Leave" },
  { value: "Compassionate Leave", label: "Compassionate Leave" },
  { value: "Unpaid Leave", label: "Unpaid Leave" },
];

export const LeaveRequestForm = ({
  onSuccess = null,
  onCancel = null,
  inline = true,
  title = "Submit Leave Request",
  subtitle = "Request time off by specifying your leave type, date range, and reason.",
}) => {
  const [formData, setFormData] = useState({
    leaveType: "Annual Leave",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const { setShowToast } = useManagement();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errorMessage) setErrorMessage(null);
    if (successMessage) setSuccessMessage(null);
  };

  // Calculate inclusive duration in days
  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    const diff = Math.abs(end - start);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysCount = calculateDays();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.leaveType) {
      setErrorMessage("Please select a valid leave category.");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setErrorMessage("Please select both a start date and an end date.");
      return;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    if (end < start) {
      setErrorMessage("End date cannot be prior to the start date.");
      return;
    }

    if (!formData.reason || formData.reason.trim().length < 5) {
      setErrorMessage("Please provide a meaningful reason (minimum 5 characters).");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const payload = {
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason.trim(),
      };

      const response = await applyForLeave(payload);
      const data = response.data;

      if (data && (data.success || response.status === 200 || response.status === 201)) {
        const msg = data.message || "Leave request submitted successfully!";
        setSuccessMessage(msg);
        setShowToast({
          show: true,
          message: msg,
          type: "success",
        });

        // Reset form
        setFormData({
          leaveType: "Annual Leave",
          startDate: "",
          endDate: "",
          reason: "",
        });

        if (onSuccess) {
          onSuccess(data.leave);
        }
      } else {
        const errorMsg = data?.message || "Failed to submit leave request.";
        setErrorMessage(errorMsg);
        setShowToast({
          show: true,
          message: errorMsg,
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error submitting leave request:", err);
      const msg =
        err.response?.data?.message ||
        "An unexpected error occurred while communicating with the backend. Please try again.";
      setErrorMessage(msg);
      setShowToast({
        show: true,
        message: msg,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div
      id="employee-leave-request-form"
      className={inline ? `${ui.card} ${ui.cardPad}` : ""}
    >
      {/* Header */}
      <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100 dark:border-slate-800 pr-10">
        <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${tones.brand.icon}`}>
          <CalendarDays className="w-4.5 h-4.5" />
        </span>
        <div>
          <h3 className={ui.h2}>{title}</h3>
          <p className={`${ui.caption} mt-0.5`}>{subtitle}</p>
        </div>
      </div>

      {successMessage && (
        <div role="status" className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300">
          <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Application received</p>
            <p className="text-xs mt-0.5 opacity-90">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="leave-type-select" className={ui.label}>
            Leave type <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              id="leave-type-select"
              name="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
              disabled={isLoading}
              required
              className={`${ui.select} pl-10`}
              style={selectChevronStyle}
            >
              {LEAVE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className={ui.label}>
            Leave date range <span className="text-rose-500">*</span>
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="leave-start-date" className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                Start date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="leave-start-date"
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  min={today}
                  required
                  disabled={isLoading}
                  className={`${ui.input} pl-10`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="leave-end-date" className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                End date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="leave-end-date"
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate || today}
                  required
                  disabled={isLoading}
                  className={`${ui.input} pl-10`}
                />
              </div>
            </div>
          </div>

          {daysCount > 0 && (
            <div className={`${ui.subtle} mt-3 flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]`}>
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Clock className="w-4 h-4 text-slate-400" />
                Requested period
              </span>
              <Badge tone="brand">
                {daysCount} {daysCount === 1 ? "day" : "days"} total
              </Badge>
            </div>
          )}
        </fieldset>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="leave-reason" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Reason / justification <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-slate-400 tabular-nums">{formData.reason.length} / 500</span>
          </div>
          <div className="relative">
            <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <textarea
              id="leave-reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={4}
              maxLength={500}
              placeholder="State the purpose of your leave request (e.g. medical appointment, annual holiday, personal development)..."
              required
              disabled={isLoading}
              className={`${ui.textarea} pl-10 resize-none`}
            />
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-600 dark:bg-blue-500/5 dark:border-blue-500/15 dark:text-slate-300 leading-relaxed">
          <Info className="w-4 h-4 text-[#002185] dark:text-blue-400 shrink-0 mt-px" />
          <p>
            Submitted requests are stored securely and routed to HR / Administration for review. Status updates will reflect
            live in your leave dashboard.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={isLoading} className={ui.btnSecondary}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={isLoading} className={ui.btnPrimary}>
            {isLoading ? (
              <>
                <WorkspaceLoader inline />
                <span>Processing request...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit leave request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
