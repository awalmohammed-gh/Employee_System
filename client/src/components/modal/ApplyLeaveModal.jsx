import { X } from "lucide-react";
import LeaveRequestForm from "../LeaveRequestForm";
import { ui } from "../../pages/Employees/ui/tokens";

export const ApplyLeaveModal = ({ onClose, onSuccess }) => {
  const handleSuccess = (createdLeave) => {
    if (onSuccess) {
      onSuccess(createdLeave);
    }
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div id="apply-leave-modal-overlay" onClick={onClose} className={`${ui.overlay} animate-fade-in`}>
      <div
        id="apply-leave-modal-container"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`${ui.modal} relative p-5 sm:p-6`}
      >
        <button
          id="btn-close-apply-leave-modal"
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`${ui.iconBtn} absolute top-4 right-4`}
        >
          <X className="w-4.5 h-4.5" />
        </button>

        <LeaveRequestForm
          inline={false}
          onSuccess={handleSuccess}
          onCancel={onClose}
          title="Apply for Leave"
          subtitle="Submit your time off request with date range and justification"
        />
      </div>
    </div>
  );
};

export default ApplyLeaveModal;
