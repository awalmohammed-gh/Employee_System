import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  modalBackdropVariants,
  modalCardVariants,
  durationFast,
} from "../../utils/motion";

/**
 * AnimatedModal component providing standardized Framer Motion
 * backdrop fade and modal scale/vertical lift transitions.
 */
export const AnimatedModal = ({
  isOpen = true,
  onClose,
  children,
  className = "",
  containerClassName = "",
  id,
}) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const activeCardVariants = shouldReduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: durationFast } },
        exit: { opacity: 0, transition: { duration: durationFast } },
      }
    : modalCardVariants;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div
          id={id || "modal-animated-portal"}
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 ${containerClassName}`}
        >
          {/* Backdrop */}
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Modal Dialog Card */}
          <motion.div
            variants={activeCardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className={`relative z-10 w-full ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedModal;
