import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAllPayslips, getPayslipDetails } from "../../apis/fontApis";
import Loading from "../../ui/Loading";
import ErrorMessage from "../../ui/ErrorMessage";
import OfficialPayslipDocument from "../../components/OfficialPayslipDocument";

const PrintPayslips = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPayslipData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First attempt fetching by single record details
        try {
          const detailRes = await getPayslipDetails(id);
          if (detailRes.data?.success && (detailRes.data.payroll || detailRes.data.payslip)) {
            setPayslip(detailRes.data.payroll || detailRes.data.payslip);
            setIsLoading(false);
            return;
          }
        } catch {
          // Fallback to all payslips list
        }

        const { data } = await getAllPayslips();
        if (data.success && data.list) {
          const found = data.list.find(
            (p) =>
              String(p._id) === String(id) ||
              String(p.id) === String(id) ||
              String(p.payslipNumber) === String(id)
          );
          if (found) {
            setPayslip(found);
          } else {
            setError("Payslip record not found.");
          }
        } else {
          setError("Failed to load payslip data.");
        }
      } catch (err) {
        setError(err.message || "Failed to load payslip.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayslipData();
  }, [id]);

  if (isLoading) return <Loading />;
  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900 p-8 flex items-center justify-center">
        <ErrorMessage
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <OfficialPayslipDocument
        payslip={payslip}
        onBack={() => navigate("/admin/payslips")}
        showControls={true}
        title="Admin Payslip Document View"
      />
    </div>
  );
};

export default PrintPayslips;
