import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Banknote, Building2, CalendarCheck, Check, Clock, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { useBranding } from "../context/BrandingContext";

const features = [
  { icon: Users, title: "People, in one place", text: "Keep employee records organized and give every team member access to their own workspace." },
  { icon: Clock, title: "A clearer working day", text: "Track clock-ins, review attendance, and manage leave requests without the back-and-forth." },
  { icon: Banknote, title: "Payroll with clarity", text: "Bring salaries, allowances, and deductions together, then generate branded payslips." },
];
const previews = {
  attendance: { title: "A snapshot of the workday", metric: "24", label: "Employees scheduled", rows: [["On time", "21 employees"], ["Late arrivals", "2 employees"], ["On leave", "1 employee"]], note: "Attendance records, ready to review." },
  leave: { title: "Keep time off organized", metric: "03", label: "Requests to review", rows: [["Annual leave", "2 requests"], ["Sick leave", "1 request"], ["Reviewed this week", "5 requests"]], note: "A clear view of requests and approvals." },
  payroll: { title: "Every payslip, accounted for", metric: "24", label: "Payslips prepared", rows: [["Salary details", "Included"], ["Allowances & deductions", "Included"], ["Payroll status", "Ready for review"]], note: "Review the details before finalizing payroll." },
};
const tabs = [{ id: "attendance", label: "Attendance", icon: Clock }, { id: "leave", label: "Leave", icon: CalendarCheck }, { id: "payroll", label: "Payroll", icon: Banknote }];
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-950";

export const LandingPage = () => {
  const { companyName, logoUrl, branding } = useBranding();
  const [failedLogo, setFailedLogo] = useState(null);
  const [activeTab, setActiveTab] = useState("attendance");
  const reduceMotion = useReducedMotion();
  const transition = { duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] };
  const reveal = { initial: { opacity: 0, y: reduceMotion ? 0 : 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 }, transition };
  const preview = previews[activeTab];

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0B1E48] dark:bg-slate-950 dark:text-white selection:bg-[#ff5500]/20">
      <a href="#landing-main" onClick={(event) => { event.preventDefault(); document.getElementById("landing-main")?.focus(); }} className={`sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-white focus:p-3 focus:rounded-lg ${focus}`}>Skip to content</a>
      <header className="sticky top-0 z-40 bg-[#F4F7FB] dark:bg-slate-950 border-b border-slate-200/70 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden">
              {logoUrl && failedLogo !== logoUrl ? <img src={logoUrl} alt={`${companyName} logo`} className="w-full h-full object-contain" onError={() => setFailedLogo(logoUrl)} /> : <Building2 className="w-6 h-6 text-[#0B1E48]" aria-hidden="true" />}
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight truncate">{companyName}</span>
          </div>
          <nav aria-label="Main navigation" className="flex items-center gap-6 sm:gap-8">
            <Link to="/welcome" className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B1E48] dark:bg-blue-600 text-white text-sm font-semibold whitespace-nowrap hover:bg-[#071534] dark:hover:bg-blue-700 transition-colors ${focus}`}>Sign in <ArrowUpRight className="w-4 h-4" aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1} className="outline-none">
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-14 sm:pb-20 grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-14 items-center">
          <motion.div {...reveal}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 flex items-center gap-2.5 mb-5"><span className="w-6 h-0.5 bg-[#ff5500]" /> Built around your people</p>
            <h1 className="text-[2.75rem] sm:text-6xl lg:text-[3.5rem] font-bold tracking-[-0.045em] leading-[1.08] max-w-xl">Less admin.<br />More room<br className="hidden lg:block" /> for <span className="text-[#ff5500]">your team.</span></h1>
            <p className="mt-6 text-base leading-relaxed text-slate-500 dark:text-slate-400 max-w-md">Bring people, attendance, leave, and payroll into one workspace. Make everyday work easier to manage.</p>
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-x-5 gap-y-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex gap-2 items-center"><ShieldCheck className="w-4 h-4 text-[#ff5500]" aria-hidden="true" />Role-based access</span>
              <span className="inline-flex gap-2 items-center"><Users className="w-4 h-4 text-[#ff5500]" aria-hidden="true" />Employee self-service</span>
            </div>
          </motion.div>

          <motion.div {...reveal} id="product-preview" className="scroll-mt-8 min-w-0">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_16px_48px_-24px_rgba(11,30,72,0.25)] overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold"><LayoutDashboard className="w-4 h-4 text-[#ff5500]" aria-hidden="true" />Workspace preview</span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-1 whitespace-nowrap">DEMO DATA</span>
              </div>
              <div className="p-5 sm:p-6">
                <div role="group" aria-label="Choose a product preview" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F4F7FB] dark:bg-slate-950 mb-6">
                  {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={activeTab === id} aria-controls="preview-content" onClick={() => setActiveTab(id)} className={`relative min-h-10 px-2 py-2 rounded-lg inline-flex justify-center items-center gap-1.5 text-xs font-semibold cursor-pointer ${focus} ${activeTab === id ? "text-white" : "text-slate-500 dark:text-slate-400"}`}>
                    {activeTab === id && <motion.span layoutId="landing-active-tab" transition={transition} className="absolute inset-0 bg-[#0B1E48] dark:bg-blue-600 rounded-lg" />}
                    <Icon className="relative w-3.5 h-3.5 shrink-0" aria-hidden="true" /><span className="relative">{label}</span>
                  </button>)}
                </div>
                <div id="preview-content" aria-live="polite" aria-atomic="true" className="min-h-[294px]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={activeTab} initial={{ opacity: 0, y: reduceMotion ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ...transition, duration: reduceMotion ? 0 : 0.12 }}>
                      <p className="text-sm font-semibold">{preview.title}</p>
                      <div className="mt-4 mb-5 flex items-end gap-3"><span className="text-5xl font-bold tracking-tight">{preview.metric}</span><span className="text-xs text-slate-500 dark:text-slate-400 pb-1 max-w-24">{preview.label}</span></div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {preview.rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-3 text-xs"><span className="text-slate-500 dark:text-slate-400">{label}</span><span className="font-semibold text-right">{value}</span></div>)}
                      </div>
                      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400"><Check className="w-3.5 h-3.5 text-[#ff5500] shrink-0" aria-hidden="true" />{preview.note}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-4">Illustrative preview. Your workspace shows your company&apos;s records.</p>
          </motion.div>
        </section>

        <section id="features" className="scroll-mt-8 border-y border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/50">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
            <motion.div {...reveal} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div><p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-3">One connected workspace</p><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">The essentials. Working together.</h2></div>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">From the first clock-in to the next payslip, keep your team moving.</p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
              {features.map(({ icon: Icon, title, text }) => <motion.article key={title} {...reveal} whileHover={reduceMotion ? undefined : { y: -3 }} className="p-6 rounded-2xl bg-[#F4F7FB] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 grid place-items-center mb-5"><Icon className="w-5 h-5 text-[#ff5500]" aria-hidden="true" /></div>
                <h3 className="text-base font-bold mb-2">{title}</h3><p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
              </motion.article>)}
            </div>
          </div>
        </section>

        <motion.section {...reveal} className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16 flex flex-col sm:flex-row justify-between sm:items-center gap-5">
          <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">A place for everyone on your team.</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Employees and management each have their own sign-in option.</p></div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><ShieldCheck className="w-4 h-4 text-[#ff5500]" aria-hidden="true" />One company. Connected roles.</span>
        </motion.section>
      </main>
      <footer className="max-w-6xl mx-auto px-5 sm:px-8 py-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400 text-center">
        <span>&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</span>
        {branding?.contactEmail ? <a href={`mailto:${branding.contactEmail}`} className={`hover:text-[#ff5500] break-all rounded-md ${focus}`}>{branding.contactEmail}</a> : <span>Workforce Management System</span>}
      </footer>
    </div>
  );
};

export default LandingPage;
