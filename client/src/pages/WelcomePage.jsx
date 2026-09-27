import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { useBranding } from "../context/BrandingContext";

export const WelcomePage = () => {
  const navigate = useNavigate();
  const { companyName, logoUrl, branding } = useBranding();
  const [failedLogo, setFailedLogo] = useState(null);
  const contactEmail = branding?.contactEmail || branding?.email;
  const contactPhone = branding?.contactPhone || branding?.phone;

  useEffect(() => {
    document.title = `${companyName} | Welcome`;
  }, [companyName]);

  return (
    <div id="workpulse-welcome-portal" className="min-h-screen min-h-[100svh] flex flex-col bg-[#F4F7FB] text-[#0B1E48] dark:bg-slate-950 dark:text-white selection:bg-[#0B1E48]/10">
      <header className="w-full max-w-6xl mx-auto px-5 sm:px-8 py-5 sm:py-7 flex items-center justify-between gap-4">
        <Link id="link-welcome-to-landing" to="/" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-[#0B1E48] dark:hover:text-white rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-950">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Product overview
        </Link>
        <span className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400">Company portal</span>
      </header>

      <main className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center px-5 sm:px-8 py-6 sm:py-10">
        <div className="text-center max-w-xl mx-auto mb-7 sm:mb-9">
          <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white shadow-sm flex items-center justify-center overflow-hidden p-2">
            {logoUrl && failedLogo !== logoUrl ? (
              <img key={logoUrl} src={logoUrl} alt={`${companyName} logo`} className="w-full h-full object-contain" onError={() => setFailedLogo(logoUrl)} />
            ) : (
              <Building2 className="w-10 h-10 text-[#0B1E48]" aria-label="Company" />
            )}
          </div>
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2">Your workplace, connected</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight break-words">Welcome to {companyName}</h1>
          <p className="mt-3 text-sm sm:text-base text-slate-500 dark:text-slate-400">Choose how you would like to sign in.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <section id="card-choice-employee" aria-labelledby="employee-portal-title" className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-3 sm:mb-5">
              <span className="w-11 h-11 shrink-0 rounded-xl bg-[#ff5500]/10 flex items-center justify-center text-[#ff5500]"><User className="w-5 h-5" aria-hidden="true" /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">For your workday</p>
                <h2 id="employee-portal-title" className="text-lg font-bold tracking-tight">Employee access</h2>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 flex-1">Clock in, request leave, and view your payslips in one place.</p>
            <button id="btn-welcome-employee" type="button" onClick={() => navigate("/employee/login")} className="group mt-5 sm:mt-7 w-full min-h-12 flex items-center justify-between gap-3 rounded-xl bg-[#ff5500] hover:bg-[#ff5500]/90 text-white px-4 py-3 text-sm font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-900">
              Employee Login <ArrowRight className="w-4 h-4 motion-safe:group-hover:translate-x-1 motion-safe:transition-transform" aria-hidden="true" />
            </button>
          </section>

          <section id="card-choice-admin" aria-labelledby="management-portal-title" className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-3 sm:mb-5">
              <span className="w-11 h-11 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-[#0B1E48] dark:text-blue-400"><ShieldCheck className="w-5 h-5" aria-hidden="true" /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">For your team</p>
                <h2 id="management-portal-title" className="text-lg font-bold tracking-tight">Management access</h2>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 flex-1">Manage your team, review attendance, and keep payroll on track.</p>
            <button id="btn-welcome-admin" type="button" onClick={() => navigate("/admin/auth")} className="group mt-5 sm:mt-7 w-full min-h-12 flex items-center justify-between gap-3 rounded-xl bg-[#0B1E48] hover:bg-[#071534] dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-3 text-sm font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E48] dark:focus-visible:ring-blue-400 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-900">
              Management Login <ArrowRight className="w-4 h-4 motion-safe:group-hover:translate-x-1 motion-safe:transition-transform" aria-hidden="true" />
            </button>
          </section>
        </div>

        <div className="mt-6 sm:mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>Need help signing in? Contact your company administrator.</p>
          {(contactEmail || contactPhone) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {contactEmail && <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-1.5 hover:underline break-all"><Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{contactEmail}</a>}
              {contactPhone && <a href={`tel:${contactPhone}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{contactPhone}</a>}
            </div>
          )}
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500 text-center">
        <span>&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</span>
        <span>Workforce Management System</span>
      </footer>
    </div>
  );
};

export default WelcomePage;
