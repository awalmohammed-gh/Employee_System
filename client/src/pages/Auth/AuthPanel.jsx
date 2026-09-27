import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Building2 } from "lucide-react";
import "./AuthPanel.css";

export default function AuthPanel({ branding, title, description, employee = false, children }) {
  const reduceMotion = useReducedMotion();
  const [failedLogo, setFailedLogo] = useState(null);
  return (
    <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }} className={`auth-panel ${employee ? "auth-panel--employee" : "auth-panel--management"} bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_16px_48px_-24px_rgba(11,30,72,0.2)] p-6 sm:p-9`}>
      <div className="text-center mb-7">
        <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
          {branding.logoUrl && failedLogo !== branding.logoUrl ? <img key={branding.logoUrl} src={branding.logoUrl} alt={`${branding.companyName} logo`} className="w-full h-full object-contain" onError={() => setFailedLogo(branding.logoUrl)} /> : <Building2 className="w-8 h-8 text-[#0B1E48]" aria-hidden="true" />}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-2 break-words">{branding.companyName}</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1E48] dark:text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {children}
    </motion.div>
  );
}
