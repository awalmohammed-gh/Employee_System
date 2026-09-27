import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Award, Star, CheckCircle2, Plus, ArrowUpRight, ShieldCheck, Target, Sparkles, BarChart3, X } from "lucide-react";
import {
  getEmployeePerformanceReviews,
  addEmployeePerformanceReview,
  getMyPerformanceReviews,
} from "../apis/fontApis";

const COMPETENCIES = [
  { key: "productivityScore", name: "Productivity", fill: "#2563EB" },
  { key: "qualityScore", name: "Quality", fill: "#10B981" },
  { key: "teamworkScore", name: "Teamwork", fill: "#8B5CF6" },
  { key: "initiativeScore", name: "Initiative", fill: "#F59E0B" },
  { key: "attendanceScore", name: "Attendance", fill: "#06B6D4" },
];

const hasValue = (v) => v !== null && v !== undefined && v !== "";

// Fresh form for the current calendar quarter; ratings and feedback start empty for the reviewer to fill.
const emptyReviewForm = () => {
  const now = new Date();
  const quarterNumber = Math.floor(now.getMonth() / 3) + 1;
  const year = now.getFullYear();
  return {
    quarter: `Q${quarterNumber} ${year}`,
    year,
    quarterNumber,
    overallRating: "",
    targetRating: "",
    productivityScore: "",
    qualityScore: "",
    teamworkScore: "",
    initiativeScore: "",
    attendanceScore: "",
    reviewer: "",
    feedbackSummary: "",
    strengths: "",
    growthOpportunities: "",
    goalsCompleted: "",
    totalGoals: "",
    promotionEligible: false,
  };
};

const QuarterlyPerformanceVisualizer = ({
  employeeId,
  employeeData,
  isAdmin = false,
  self = false,
}) => {
  const targetId = employeeId || employeeData?._id || employeeData?.employeeId;

  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employee, setEmployee] = useState(employeeData || null);
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(null);

  // Modal state for adding a review
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [formData, setFormData] = useState(emptyReviewForm);

  const openAddModal = () => {
    setFormData(emptyReviewForm());
    setSubmitError(null);
    setIsAddModalOpen(true);
  };

  const fetchPerformanceData = useCallback(async () => {
    if (!self && !targetId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setIsError(null);
      const res = self ? await getMyPerformanceReviews() : await getEmployeePerformanceReviews(targetId);
      if (res.data?.success) {
        const revList = res.data.reviews || [];
        setReviews(revList);
        setSummary(res.data.summary || null);
        if (res.data.employee) {
          setEmployee((prev) => ({ ...prev, ...res.data.employee }));
        }
        setSelectedQuarter(revList.length > 0 ? revList[revList.length - 1] : null);
      } else {
        setIsError(res.data?.message || "Failed to load quarterly performance ratings.");
      }
    } catch (err) {
      console.error("Error fetching performance reviews:", err);
      setIsError(
        err.response?.data?.message || "Failed to connect to performance review service."
      );
    } finally {
      setIsLoading(false);
    }
  }, [targetId, self]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Active selected review object
  const activeReview = useMemo(() => {
    if (!selectedQuarter && reviews.length > 0) {
      return reviews[reviews.length - 1];
    }
    return selectedQuarter || reviews[reviews.length - 1] || null;
  }, [selectedQuarter, reviews]);

  // Competency breakdown for the bar chart: only competencies the reviewer actually scored.
  const competencyData = useMemo(() => {
    if (!activeReview) return [];
    return COMPETENCIES.filter((c) => hasValue(activeReview[c.key])).map((c) => ({
      name: c.name,
      score: Number(activeReview[c.key]),
      fill: c.fill,
    }));
  }, [activeReview]);

  const hasGoals = hasValue(activeReview?.totalGoals) && Number(activeReview.totalGoals) > 0;
  const goalsPct = hasGoals
    ? Math.min(100, Math.round((Number(activeReview.goalsCompleted || 0) / Number(activeReview.totalGoals)) * 100))
    : 0;

  // Handle Add Review Submission
  const handleAddReviewSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Blank optional fields are sent as "" so the server stores nothing rather than a 0.
      const quarterMatch = String(formData.quarter).match(/Q([1-4])/i);
      const payload = {
        quarter: formData.quarter,
        year: Number(formData.year),
        quarterNumber: quarterMatch ? Number(quarterMatch[1]) : Number(formData.quarterNumber),
        overallRating: parseFloat(formData.overallRating),
        targetRating: formData.targetRating,
        productivityScore: formData.productivityScore,
        qualityScore: formData.qualityScore,
        teamworkScore: formData.teamworkScore,
        initiativeScore: formData.initiativeScore,
        attendanceScore: formData.attendanceScore,
        reviewer: formData.reviewer,
        feedbackSummary: formData.feedbackSummary,
        strengths: typeof formData.strengths === "string"
          ? formData.strengths.split(",").map((s) => s.trim()).filter(Boolean)
          : formData.strengths,
        growthOpportunities: typeof formData.growthOpportunities === "string"
          ? formData.growthOpportunities.split(",").map((s) => s.trim()).filter(Boolean)
          : formData.growthOpportunities,
        goalsCompleted: formData.goalsCompleted,
        totalGoals: formData.totalGoals,
        promotionEligible: !!formData.promotionEligible,
      };

      const res = await addEmployeePerformanceReview(targetId, payload);
      if (res.data?.success) {
        setIsAddModalOpen(false);
        await fetchPerformanceData();
      } else {
        setSubmitError(res.data?.message || "Failed to record review.");
      }
    } catch (err) {
      console.error("Error submitting performance review:", err);
      setSubmitError(
        err.response?.data?.message || "Error submitting review rating to database."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[360px]">
        <WorkspaceLoader compact title="" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Loading quarterly performance metrics & growth trends...
        </p>
        <p className="text-xs text-slate-400 mt-1">Fetching live review database records</p>
      </div>
    );
  }

  if (isError && reviews.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-6 text-center">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-2">
          {isError}
        </p>
        <button
          type="button"
          onClick={fetchPerformanceData}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const targetLine = hasValue(summary?.targetRating) ? Number(summary.targetRating) : null;
  const growth = summary?.growthRatePct;
  const growthUp = (growth ?? 0) >= 0;

  let targetNote = "No target rating set";
  if (summary?.targetMet === true) targetNote = `Target rating met (${Number(summary.targetRating).toFixed(1)})`;
  else if (summary?.targetMet === false) targetNote = `Below target rating (${Number(summary.targetRating).toFixed(1)})`;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50/70 to-white dark:from-[#162033] dark:to-[#111927] rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#002185]/10 dark:bg-blue-500/15 border border-[#002185]/15 dark:border-blue-400/20 flex items-center justify-center text-[#002185] dark:text-blue-300 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Quarterly Review Ratings & Growth Trajectory
                </h3>
                {summary?.currentTier && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                    {summary.currentTier}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ratings, goal attainment and growth trends from recorded quarterly reviews.
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#002185] hover:bg-[#001760] text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Quarterly Review</span>
            </button>
          )}
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 sm:p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <BarChart3 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            No performance reviews recorded yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {isAdmin
              ? "Record the first quarterly review to start tracking this employee's ratings and growth."
              : "Your quarterly reviews will appear here once they have been recorded."}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#002185] hover:bg-[#001760] text-white text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record First Review</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* KPI Metric Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Latest Overall Rating */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Latest Rating
                </span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {Number(summary.latestRating).toFixed(1)}
                </span>
                <span className="text-xs font-semibold text-slate-400">/ 5.0</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                {summary.latestQuarter} evaluation
              </p>
            </div>

            {/* QoQ Growth Trend */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  QoQ Growth
                </span>
                <div className={`p-1.5 rounded-lg ${growthUp ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                  {growthUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                {hasValue(growth) ? (
                  <span className={`text-2xl sm:text-3xl font-extrabold ${growthUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {growthUp ? "+" : ""}
                    {growth}%
                  </span>
                ) : (
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                {hasValue(growth) ? "vs. previous quarter rating" : "Needs two reviewed quarters"}
              </p>
            </div>

            {/* Average Career Rating */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Career Average
                </span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                  <Target className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {Number(summary.averageRating).toFixed(2)}
                </span>
                <span className="text-xs font-semibold text-slate-400">/ 5.0</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                Across {reviews.length} reviewed quarter{reviews.length === 1 ? "" : "s"}
              </p>
            </div>

            {/* Promotion Readiness */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Career Trajectory
                </span>
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`text-base sm:text-lg font-extrabold ${summary.promotionEligible ? "text-purple-600 dark:text-purple-400" : "text-slate-700 dark:text-slate-200"}`}>
                  {summary.promotionEligible ? "Promotion Eligible" : "Not Flagged"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${summary.targetMet ? "text-emerald-500" : "text-slate-400"}`} />
                <span className="truncate">{targetNote}</span>
              </p>
            </div>
          </div>

          {/* Quarterly Growth Trajectory & Competency Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Rating Progression Area Chart */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Quarterly Rating Trajectory</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Overall review scores per quarter{targetLine !== null ? ` against the target rating (${targetLine.toFixed(1)})` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600" />
                    <span>Rating</span>
                  </div>
                  {targetLine !== null && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-1 border-t-2 border-dashed border-emerald-500" />
                      <span>Target ({targetLine.toFixed(1)})</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={reviews}
                    margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
                    onClick={(e) => {
                      if (e && e.activePayload && e.activePayload[0]) {
                        setSelectedQuarter(e.activePayload[0].payload);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="quarter" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} />
                    {targetLine !== null && (
                      <ReferenceLine
                        y={targetLine}
                        stroke="#10B981"
                        strokeDasharray="4 4"
                        label={{
                          value: `Target: ${targetLine.toFixed(1)}`,
                          position: "insideTopRight",
                          fill: "#10B981",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      />
                    )}
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-3 bg-slate-900 border border-slate-700 text-white rounded-xl shadow-xl text-xs space-y-1">
                              <p className="font-bold text-sm text-blue-300">{data.quarter}</p>
                              <p className="text-slate-300">
                                Overall Rating:{" "}
                                <span className="font-bold text-emerald-400">{data.overallRating} / 5.0</span>
                              </p>
                              {data.performanceTier && (
                                <p className="text-slate-400 text-[11px]">Tier: {data.performanceTier}</p>
                              )}
                              {data.reviewer && (
                                <p className="text-slate-400 text-[10px] italic">Reviewer: {data.reviewer}</p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="overallRating"
                      stroke="#2563EB"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#performanceGradient)"
                      activeDot={{ r: 6, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Interactive Quarter Selectors */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                  Select Quarter:
                </span>
                {reviews.map((r, idx) => {
                  const isSelected = activeReview?.quarter === r.quarter;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedQuarter(r)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {r.quarter}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Competency Breakdown Bar Chart */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Competency Matrix</span>
                  </h4>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/60">
                    {activeReview?.quarter}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Category performance scores evaluated out of 100 points
                </p>
              </div>

              {competencyData.length > 0 ? (
                <div className="w-full h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={competencyData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} stroke="#94A3B8" fontSize={10} />
                      <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} width={80} />
                      <Tooltip
                        formatter={(val) => [`${val} / 100`, "Score"]}
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderColor: "#334155",
                          borderRadius: "10px",
                          color: "#FFFFFF",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={16}>
                        {competencyData.map((entry, index) => (
                          <Cell key={`comp-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-4">
                  No competency scores were recorded for this quarter.
                </div>
              )}

              {/* Goal Progress Bar */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                {hasGoals ? (
                  <>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Quarterly Goals Achieved</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {Number(activeReview.goalsCompleted || 0)} of {Number(activeReview.totalGoals)} ({goalsPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${goalsPct}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">No goals were recorded for this quarter.</p>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Review Feedback Card for the Selected Quarter */}
          {activeReview && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {activeReview.quarter} Review Report
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeReview.reviewer && (
                        <>
                          Evaluated by:{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{activeReview.reviewer}</span>
                          {activeReview.reviewDate && " • "}
                        </>
                      )}
                      {activeReview.reviewDate &&
                        new Date(activeReview.reviewDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {activeReview.overallRating} / 5.0 Rating
                  </span>
                  {activeReview.promotionEligible && (
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-purple-500 text-purple-500" />
                      <span>Promotion Eligible</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Performance Summary
                  </span>
                  {activeReview.feedbackSummary ? (
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                      &ldquo;{activeReview.feedbackSummary}&rdquo;
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500">No written feedback was recorded.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Key Strengths & Achievements</span>
                    </span>
                    {activeReview.strengths?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeReview.strengths.map((str, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                          >
                            {str}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">None recorded.</p>
                    )}
                  </div>

                  <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4">
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                      <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Growth & Focus Opportunities</span>
                    </span>
                    {activeReview.growthOpportunities?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeReview.growthOpportunities.map((opp, oIdx) => (
                          <span
                            key={oIdx}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs"
                          >
                            {opp}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">None recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ADD QUARTERLY REVIEW MODAL (Admin Only) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Record Quarterly Performance Review
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Submit new review ratings for {employee?.fullName || "Employee"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs">
                {submitError}
              </div>
            )}

            <form onSubmit={handleAddReviewSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Quarter Label
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.quarter}
                    onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                    placeholder="e.g. Q3 2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Overall Rating (1-5)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    required
                    value={formData.overallRating}
                    onChange={(e) =>
                      setFormData({ ...formData, overallRating: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Target Rating (optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={formData.targetRating}
                    onChange={(e) => setFormData({ ...formData, targetRating: e.target.value })}
                    placeholder="e.g. 4.0"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Goals Completed (optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.goalsCompleted}
                    onChange={(e) => setFormData({ ...formData, goalsCompleted: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Total Goals (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalGoals}
                    onChange={(e) => setFormData({ ...formData, totalGoals: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Competencies Sliders / Inputs */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Competency Scores (0 - 100, leave blank if not assessed)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Productivity</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.productivityScore}
                      onChange={(e) =>
                        setFormData({ ...formData, productivityScore: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Quality</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.qualityScore}
                      onChange={(e) =>
                        setFormData({ ...formData, qualityScore: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Teamwork</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.teamworkScore}
                      onChange={(e) =>
                        setFormData({ ...formData, teamworkScore: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Initiative</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.initiativeScore}
                      onChange={(e) =>
                        setFormData({ ...formData, initiativeScore: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Attendance</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.attendanceScore}
                      onChange={(e) =>
                        setFormData({ ...formData, attendanceScore: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Executive Reviewer
                </label>
                <input
                  type="text"
                  value={formData.reviewer}
                  onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
                  placeholder="Defaults to your name"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Qualitative Feedback Summary
                </label>
                <textarea
                  rows={3}
                  value={formData.feedbackSummary}
                  onChange={(e) => setFormData({ ...formData, feedbackSummary: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Key Strengths (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.strengths}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Growth Opportunities (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.growthOpportunities}
                  onChange={(e) =>
                    setFormData({ ...formData, growthOpportunities: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="promotionEligibleCheck"
                  checked={formData.promotionEligible}
                  onChange={(e) =>
                    setFormData({ ...formData, promotionEligible: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label
                  htmlFor="promotionEligibleCheck"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Candidate is eligible for promotion / compensation band advancement
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <><WorkspaceLoader inline /> Recording...</> : "Save Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuarterlyPerformanceVisualizer;
