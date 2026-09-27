import WorkspaceLoader from "../ui/WorkspaceLoader";
import { useState } from "react";
import { useManagement } from "../../context/ManagementContextProvider";
import { createUserAccount } from "../../apis/fontApis";
import CustomSelect from "../CustomSelect";
import {
  X,
  User,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  UserPlus,
  Mail,
  Lock,
  Shield,
  Banknote,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Upload,
} from "lucide-react";

const ROLE_OPTIONS = [
  {
    value: "employee",
    label: "Employee / Standard Staff",
    sublabel: "Self-Service Attendance & Payslips",
  },
  {
    value: "manager",
    label: "Manager",
    sublabel: "Departmental Oversight & Approvals",
  },
  {
    value: "hr",
    label: "HR Specialist",
    sublabel: "Staff Directory & Onboarding",
  },
  {
    value: "admin",
    label: "Administrator",
    sublabel: "Full System & Role Privileges",
  },
];

const DEPARTMENT_OPTIONS = [
  { value: "Software Engineering", label: "Software Engineering" },
  { value: "Quality Assurance", label: "Quality Assurance" },
  { value: "DevOps & Infrastructure", label: "DevOps & Infrastructure" },
  { value: "Product & Design", label: "Product & Design" },
  { value: "Human Resources", label: "Human Resources" },
  { value: "Finance & Accounting", label: "Finance & Accounting" },
  { value: "Operations & Support", label: "Operations & Support" },
];

export const AddEmployee = ({ onEmployeeAdded, onOpenBulkUpload }) => {
  const { setShowEmployeeModal, setShowToast } = useManagement();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState({});
  const [formErrors, setFormErrors] = useState({});

  const initialForm = {
    employeeId: `EMP00${Math.floor(Math.random() * 900) + 100}`,
    fullName: "",
    email: "",
    password: "Password@123",
    phone: "",
    department: "Software Engineering",
    position: "",
    baseSalary: "2500.00",
    employmentDate: new Date().toISOString().split("T")[0],
    role: "employee",
  };

  const [employeeForm, setEmployeeForm] = useState(initialForm);

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "fullName":
        if (!value || !value.trim()) {
          error = "Full Name is required.";
        } else if (value.trim().length < 2) {
          error = "Full Name must be at least 2 characters.";
        }
        break;
      case "email":
        if (!value || !value.trim()) {
          error = "Email address is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          error = "Please enter a valid email address (e.g. name@company.com).";
        }
        break;
      case "phone":
        if (!value || !value.trim()) {
          error = "Phone number is required.";
        } else if (value.trim().replace(/[^0-9]/g, "").length < 7) {
          error = "Please enter a valid phone number (at least 7 digits).";
        }
        break;
      case "department":
        if (!value || !value.trim()) {
          error = "Department is required.";
        }
        break;
      case "position":
        if (!value || !value.trim()) {
          error = "Position / job title is required.";
        } else if (value.trim().length < 2) {
          error = "Position title must be at least 2 characters.";
        }
        break;
      case "password":
        if (!value || !value.trim()) {
          error = "Password is required.";
        } else if (value.length < 6) {
          error = "Temporary password must be at least 6 characters.";
        }
        break;
      case "baseSalary":
        if (value !== "" && value !== null && value !== undefined) {
          const num = parseFloat(value);
          if (isNaN(num) || num < 0) {
            error = "Base salary must be a positive number.";
          }
        }
        break;
      case "employeeId":
        if (!value || !value.trim()) {
          error = "Employee ID is required.";
        }
        break;
      default:
        break;
    }
    return error;
  };

  const validateAll = () => {
    const errors = {};
    const fieldsToValidate = ["fullName", "email", "phone", "department", "position", "password", "employeeId", "baseSalary"];
    fieldsToValidate.forEach((field) => {
      const err = validateField(field, employeeForm[field]);
      if (err) errors[field] = err;
    });
    setFormErrors(errors);
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmployeeForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (touched[name]) {
      const err = validateField(name, value);
      setFormErrors((prev) => ({
        ...prev,
        [name]: err,
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const err = validateField(name, value);
    setFormErrors((prev) => ({
      ...prev,
      [name]: err,
    }));
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Staff Account Credentials:
Full Name: ${createdCredentials.fullName || employeeForm.fullName}
Employee ID: ${createdCredentials.employeeId}
Email / Login ID: ${createdCredentials.email}
Temporary Password: ${createdCredentials.temporaryPassword}
Assigned Role: ${createdCredentials.role?.toUpperCase()}
Login URL: ${window.location.origin}/auth/employee/login`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setShowToast({
      show: true,
      message: "Credentials copied to clipboard!",
      type: "success",
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mark all fields as touched for validation
    const allTouched = {
      fullName: true,
      email: true,
      phone: true,
      department: true,
      position: true,
      password: true,
      employeeId: true,
      baseSalary: true,
      employmentDate: true,
      role: true,
    };
    setTouched(allTouched);

    const errors = validateAll();
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      setShowToast({
        show: true,
        message: firstError || "Please correct all form validation errors before saving.",
        type: "error",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const { data } = await createUserAccount({
        employeeId: employeeForm.employeeId.trim(),
        fullName: employeeForm.fullName.trim(),
        email: employeeForm.email.toLowerCase().trim(),
        password: employeeForm.password.trim(),
        phone: employeeForm.phone.trim(),
        department: employeeForm.department.trim(),
        position: employeeForm.position.trim(),
        baseSalary: parseFloat(employeeForm.baseSalary) || 0,
        employmentDate: employeeForm.employmentDate,
        role: employeeForm.role,
      });

      if (data.success) {
        setShowToast({
          show: true,
          message:
            data.message ||
            `Account for ${employeeForm.fullName} (${employeeForm.role.toUpperCase()}) created successfully!`,
          type: "success",
        });

        if (onEmployeeAdded) {
          onEmployeeAdded();
        }

        // Show credentials view so Admin can copy login details
        setCreatedCredentials(
          data.credentials || {
            employeeId: employeeForm.employeeId,
            email: employeeForm.email.toLowerCase().trim(),
            temporaryPassword: employeeForm.password.trim(),
            role: employeeForm.role,
            fullName: employeeForm.fullName,
          }
        );
      } else {
        setShowToast({
          show: true,
          message: data.message || "Failed to create user account.",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error creating user account:", error);
      setShowToast({
        show: true,
        message:
          error.response?.data?.message ||
          error.message ||
          "Failed to create user account.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setCreatedCredentials(null);
    setTouched({});
    setFormErrors({});
    setEmployeeForm({
      ...initialForm,
      employeeId: `EMP00${Math.floor(Math.random() * 900) + 100}`,
    });
  };

  return (
    <>
      {/* Modal Overlay & Backdrop Container */}
      <div
        id="modal-add-employee"
        onClick={() => setShowEmployeeModal(false)}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/50 backdrop-blur-[2px] animate-fade-in"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg sm:max-w-2xl mx-auto bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in"
        >
          {createdCredentials ? (
            /* Success & Copyable Credentials Screen */
            <div id="employee-credentials-success-screen" className="flex flex-col flex-1 overflow-y-auto">
              <div className="bg-[#002185] dark:bg-blue-700 px-5 sm:px-6 py-4 sm:py-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-xs shrink-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold">Account Created Successfully</h2>
                    <p className="text-[11px] sm:text-xs text-blue-100">
                      Share the following login credentials with the employee
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-credentials-modal"
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-all shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 flex-1">
                <div className="p-3.5 sm:p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold">Database Synchronized:</span> The employee record has been added to the directory and activated for immediate login.
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Staff Member</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {createdCredentials.fullName || employeeForm.fullName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Assigned Role</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md uppercase">
                      {createdCredentials.role}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Employee ID</span>
                    <code className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 bg-white dark:bg-[#111927] px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
                      {createdCredentials.employeeId}
                    </code>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Login Email</span>
                    <code className="text-xs font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-[#111927] px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
                      {createdCredentials.email}
                    </code>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Temporary Password</span>
                    <code className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-[#111927] px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
                      {createdCredentials.temporaryPassword}
                    </code>
                  </div>
                </div>

                <button
                  id="btn-copy-employee-credentials"
                  type="button"
                  onClick={handleCopyCredentials}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied Credentials to Clipboard</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Login Credentials</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-white dark:bg-[#111927] px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 sm:gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  id="btn-add-another-employee"
                  type="button"
                  onClick={handleResetForAnother}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer text-center"
                >
                  Add Another Employee
                </button>

                <button
                  id="btn-done-add-employee"
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-[#162033] dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer text-center"
                >
                  Done & Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="shrink-0 bg-white dark:bg-[#111927] px-5 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#002185] dark:bg-blue-700 flex items-center justify-center shrink-0 shadow-xs">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                      Add New Employee
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      Create and activate a new employee record with system credentials and department placement
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenBulkUpload && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmployeeModal(false);
                        onOpenBulkUpload();
                      }}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold transition cursor-pointer"
                      title="Upload CSV to add multiple employees at once"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Bulk CSV Import</span>
                    </button>
                  )}
                  <button
                    id="btn-close-add-employee-modal"
                    type="button"
                    onClick={() => setShowEmployeeModal(false)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all shrink-0 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form Body with Live Validation */}
              <form
                id="add-employee-form"
                onSubmit={handleSubmit}
                noValidate
                className="flex-1 overflow-y-auto overflow-x-hidden max-h-[85vh] sm:max-h-[80vh] p-4 sm:p-6 space-y-4"
              >
                {/* Validation errors summary banner */}
                {Object.keys(formErrors).some((k) => formErrors[k]) && (
                  <div id="validation-errors-banner" className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Please complete the required fields correctly:</span>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                        {Object.entries(formErrors)
                          .filter(([, err]) => Boolean(err))
                          .map(([key, err]) => (
                            <li key={key}>{err}</li>
                          ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Role Assignment Selector */}
                <div className="p-3.5 bg-slate-50 dark:bg-[#162033]/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <label htmlFor="add-employee-role-select" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Assigned Role <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    id="add-employee-role-select"
                    name="role"
                    value={employeeForm.role}
                    onChange={handleChange}
                    options={ROLE_OPTIONS}
                    icon={Shield}
                    placeholder="Select Assigned Role"
                    required
                  />
                </div>

                {/* Employee ID & Full Name */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="input-employee-id" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Employee ID <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="input-employee-id"
                        type="text"
                        name="employeeId"
                        value={employeeForm.employeeId}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-white dark:bg-[#111927] text-slate-900 dark:text-white text-xs font-mono font-bold transition-all focus:outline-none focus:ring-1 ${
                          touched.employeeId && formErrors.employeeId
                            ? "border-rose-400 dark:border-rose-600 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:border-blue-600 focus:ring-[#002185]/25"
                        }`}
                        required
                      />
                    </div>
                    {touched.employeeId && formErrors.employeeId && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{formErrors.employeeId}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="input-employee-fullname" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="input-employee-fullname"
                        type="text"
                        name="fullName"
                        value={employeeForm.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="e.g. Kwame Mensah"
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-white dark:bg-[#111927] text-slate-900 dark:text-white text-xs transition-all focus:outline-none focus:ring-1 ${
                          touched.fullName && formErrors.fullName
                            ? "border-rose-400 dark:border-rose-600 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:border-blue-600 focus:ring-[#002185]/25"
                        }`}
                        required
                      />
                    </div>
                    {touched.fullName && formErrors.fullName && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{formErrors.fullName}</p>
                    )}
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="input-employee-email" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Work Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="input-employee-email"
                        type="email"
                        name="email"
                        value={employeeForm.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="kwame.mensah@company.com"
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-white dark:bg-[#111927] text-slate-900 dark:text-white text-xs transition-all focus:outline-none focus:ring-1 ${
                          touched.email && formErrors.email
                            ? "border-rose-400 dark:border-rose-600 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:border-blue-600 focus:ring-[#002185]/25"
                        }`}
                        required
                      />
                    </div>
                    {touched.email && formErrors.email && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{formErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="input-employee-phone" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="input-employee-phone"
                        type="tel"
                        name="phone"
                        value={employeeForm.phone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="+233 24 123 4567"
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-white dark:bg-[#111927] text-slate-900 dark:text-white text-xs transition-all focus:outline-none focus:ring-1 ${
                          touched.phone && formErrors.phone
                            ? "border-rose-400 dark:border-rose-600 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:border-blue-600 focus:ring-[#002185]/25"
                        }`}
                        required
                      />
                    </div>
                    {touched.phone && formErrors.phone && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{formErrors.phone}</p>
                    )}
                  </div>
                </div>

                {/* Department Selector */}
                <div>
                  <label htmlFor="select-employee-department" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    id="select-employee-department"
                    name="department"
                    value={employeeForm.department}
                    onChange={handleChange}
                    options={DEPARTMENT_OPTIONS}
                    icon={Building2}
                    placeholder="Select Department"
                    required
                  />
                  {touched.department && formErrors.department && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{formErrors.department}</p>
                  )}
                </div>

                {/* Position & Base Salary */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="input-employee-position" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Position / Title <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Briefcase className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="input-employee-position"
                        type="text"
                        name="position"
                        value={employeeForm.position}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="e.g. Senior Software Engineer"
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-white dark:bg-[#111927] text-slate-900 dark:text-white text-xs transition-all focus:outline-none focus:ring-1 ${
                          touched.position && formErrors.position
                            ? "border-rose-400 dark:border-rose-600 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:border-blue-600 focus:ring-[#002185]/25"
                        }`}
                        required
                      />
                    </div>
                    {touched.position && formErrors.position && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{formErrors.position}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="input-employee-base-salary" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Basic Monthly Salary (GH₵)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Banknote className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="input-employee-base-salary"
                        type="number"
                        step="0.01"
                        min="0"
                        name="baseSalary"
                        value={employeeForm.baseSalary}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="e.g., 2500.00"
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-white dark:bg-[#111927] text-slate-900 dark:text-white text-xs transition-all focus:outline-none focus:ring-1 ${
                          touched.baseSalary && formErrors.baseSalary
                            ? "border-rose-400 dark:border-rose-600 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:border-blue-600 focus:ring-[#002185]/25"
                        }`}
                      />
                    </div>
                    {touched.baseSalary && formErrors.baseSalary && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{formErrors.baseSalary}</p>
                    )}
                  </div>
                </div>

                {/* Employment Date & Default Temporary Password */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="input-employee-employment-date" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Employment Date <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="input-employee-employment-date"
                        type="date"
                        name="employmentDate"
                        value={employeeForm.employmentDate}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#111927] text-slate-900 dark:text-white text-xs hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-[#002185]/25"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="input-employee-password" className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Temporary Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="input-employee-password"
                        type="text"
                        name="password"
                        value={employeeForm.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Password@123"
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-white dark:bg-[#111927] text-slate-900 dark:text-white text-xs transition-all focus:outline-none focus:ring-1 ${
                          touched.password && formErrors.password
                            ? "border-rose-400 dark:border-rose-600 focus:ring-rose-500"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:border-blue-600 focus:ring-[#002185]/25"
                        }`}
                        required
                      />
                    </div>
                    {touched.password && formErrors.password && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{formErrors.password}</p>
                    )}
                  </div>
                </div>
              </form>

              {/* Footer */}
              <div className="shrink-0 bg-white dark:bg-[#111927] px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  id="btn-cancel-add-employee"
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#162033] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>

                <button
                  id="btn-submit-add-employee"
                  type="submit"
                  form="add-employee-form"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? <><WorkspaceLoader inline /> Creating Record...</> : "Add to Directory"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AddEmployee;

