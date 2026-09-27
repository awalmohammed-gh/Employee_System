import { useManagement } from "../context/ManagementContextProvider";
import { PageHeader } from "../pages/Employees/ui/primitives";

const greetingForNow = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

/** Employee page greeting. Company branding is shown in the employee sidebar and top bar. */
export const EmployeeHeader = ({ title, subtitle, actions }) => {
  const { user } = useManagement();
  const firstName = (user?.fullName || "Employee").split(" ")[0];

  return (
    <PageHeader
      eyebrow={greetingForNow()}
      title={title || `Welcome back, ${firstName}`}
      description={subtitle || "Track daily attendance, view payslips, and manage leave requests."}
      actions={actions}
    />
  );
};

export default EmployeeHeader;
