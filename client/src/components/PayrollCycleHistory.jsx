import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Banknote,
  Users,
  AlertTriangle,
  RefreshCw,
  Search,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { getPayrollCycles } from "../apis/fontApis";

export const PayrollCycleHistory = ({ onSelectCycle = null }) => {
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedCycleDetails, setSelectedCycleDetails] = useState(null);

  const fetchCycles = async () => {
    setLoading(true);
    try {
      const res = await getPayrollCycles();
      if (res?.data?.success) {
        setCycles(res.data.cycles || res.data.data || []);
      } else {
        setCycles([]);
      }
    } catch (err) {
      console.warn("Failed to fetch payroll cycles:", err);
      setCycles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const filteredCycles = cycles.filter((c) => {
    const matchesStatus =
      statusFilter === "All" ||
      c.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      !search ||
      c.month?.toLowerCase().includes(search.toLowerCase()) ||
      c.generatedDate?.includes(search);
    return matchesStatus && matchesSearch;
  });

  const totalNetDisbursed = cycles.reduce((acc, c) => acc + (c.netExpenditure || 0), 0);
  const totalPenaltiesCollected = cycles.reduce(
    (acc, c) => acc + (c.totalAttendancePenalties || 0),
    0
  );
  const totalWaivedSum = cycles.reduce(
    (acc, c) => acc + (c.totalPenaltiesWaived || 0),
    0
  );

  return (
    <div id="payroll-cycle-history-container" className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Processed Cycles
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#002185] dark:text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {cycles.length}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Historical payroll generations
          </p>
        </div>

        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Net Disbursement
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalNetDisbursed)}
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            Paid out across all cycles
          </p>
        </div>

        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Attendance Penalties
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(totalPenaltiesCollected)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Absence + lateness deducted
          </p>
        </div>

        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Waived Penalties
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(totalWaivedSum)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Exempted by admin approval
          </p>
        </div>
      </div>

      {/* Main Cycle Table Section */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Controls Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Payroll Processing Cycles
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track status, generation dates, total expenditures, and attendance deductions for each payroll cycle
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center bg-slate-100 dark:bg-[#162033] p-1 rounded-xl text-xs font-semibold">
              {["All", "Completed", "Pending"].map((status) => (
                <button
                  key={status}
                  id={`cycle-filter-${status.toLowerCase()}`}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === status
                      ? "bg-white dark:bg-slate-700 text-[#002185] dark:text-blue-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative min-w-[200px]">
              <input
                id="cycle-search-input"
                type="text"
                placeholder="Search month or date..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#002185]/25"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            </div>

            <button
              id="btn-refresh-cycles"
              onClick={fetchCycles}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {(loading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Cycles Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#162033]/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Cycle Month</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date Generated</th>
                <th className="py-3 px-4">Staff Count</th>
                <th className="py-3 px-4">Gross Expenditure</th>
                <th className="py-3 px-4">Attendance Penalties</th>
                <th className="py-3 px-4">Net Expenditure</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <WorkspaceLoader compact title="" />
                    Loading payroll cycle history...
                  </td>
                </tr>
              ) : filteredCycles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No payroll cycles matching your search.
                  </td>
                </tr>
              ) : (
                filteredCycles.map((cycle, idx) => (
                  <tr
                    key={cycle.month || idx}
                    id={`cycle-row-${idx}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Cycle Month */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#002185] dark:text-blue-400 shrink-0" />
                      <span>{cycle.month}</span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          cycle.status === "Completed"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
                        }`}
                      >
                        {cycle.status === "Completed" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {cycle.status}
                      </span>
                    </td>

                    {/* Date Generated */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {cycle.generatedDate || "2026-08-25"}
                    </td>

                    {/* Staff Count */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {cycle.employeeCount || 15} Employees
                      </span>
                    </td>

                    {/* Gross Expenditure */}
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(cycle.grossExpenditure)}
                    </td>

                    {/* Attendance Penalties Breakdown */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(cycle.totalAttendancePenalties)}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>Abs: GH₵{cycle.totalAbsenceDeductions}</span>
                          <span>•</span>
                          <span>Late: GH₵{cycle.totalLatenessPenalties}</span>
                          {cycle.totalPenaltiesWaived > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600">
                                Waived: GH₵{cycle.totalPenaltiesWaived}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Net Expenditure */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(cycle.netExpenditure)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        id={`btn-view-cycle-${idx}`}
                        onClick={() => {
                          if (onSelectCycle) {
                            onSelectCycle(cycle.month);
                          } else {
                            setSelectedCycleDetails(cycle);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#002185]/10 hover:bg-[#002185]/20 text-[#002185] dark:text-blue-400 rounded-xl font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Cycle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cycle Modal Details if clicked */}
      {selectedCycleDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#002185]" />
                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                  {selectedCycleDetails.month} Cycle Summary
                </h4>
              </div>
              <button
                onClick={() => setSelectedCycleDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-[#162033]/40 rounded-xl">
                <span className="text-slate-500">Status:</span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedCycleDetails.status}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#162033]/40 rounded-xl">
                <span className="text-slate-500">Processed On:</span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedCycleDetails.generatedDate}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#162033]/40 rounded-xl">
                <span className="text-slate-500">Gross Expenditure:</span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatCurrency(selectedCycleDetails.grossExpenditure)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#162033]/40 rounded-xl">
                <span className="text-slate-500">Net Disbursed:</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(selectedCycleDetails.netExpenditure)}
                </p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl">
                <span className="text-rose-600 font-semibold">Absence Deductions:</span>
                <p className="font-bold text-rose-700 dark:text-rose-400 mt-0.5">
                  {formatCurrency(selectedCycleDetails.totalAbsenceDeductions)}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl">
                <span className="text-amber-600 font-semibold">Lateness Penalties:</span>
                <p className="font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                  {formatCurrency(selectedCycleDetails.totalLatenessPenalties)}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedCycleDetails(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-[#162033] text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollCycleHistory;
