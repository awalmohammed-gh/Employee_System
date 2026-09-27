import { useReducedMotion } from "framer-motion";

/**
 * Standard enterprise easing curves & durations
 * Fast, fluid, modern, and understated
 */
export const easeOutStandard = [0.16, 1, 0.3, 1];
export const easeInStandard = [0.4, 0, 1, 1];
export const easeInOutStandard = [0.4, 0, 0.2, 1];

export const durationFast = 0.15;
export const durationStandard = 0.2;
export const durationPage = 0.18;

/**
 * Page & Route Transition Variants
 */
export const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: durationPage, ease: easeOutStandard },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: durationPage, ease: easeOutStandard },
  },
};

export const reducedPageVariants = {
  initial: { opacity: 0, y: 0 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: durationFast },
  },
  exit: {
    opacity: 0,
    y: 0,
    transition: { duration: durationFast },
  },
};

/**
 * Hook to get appropriate page variants respecting reduced motion preferences
 */
export const usePageVariants = () => {
  const shouldReduceMotion = useReducedMotion();
  return shouldReduceMotion ? reducedPageVariants : pageVariants;
};

/**
 * Modal Dialog Variants
 */
export const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: durationStandard, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: durationFast, ease: "easeIn" },
  },
};

export const modalCardVariants = {
  hidden: { opacity: 0, scale: 0.98, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: durationStandard, ease: easeOutStandard },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: { duration: durationFast, ease: "easeIn" },
  },
};

/**
 * Android Bottom Sheets & Mobile Drawers Variants
 */
export const sheetVariants = {
  hidden: { y: "100%" },
  visible: {
    y: 0,
    transition: {
      type: "spring",
      damping: 25,
      stiffness: 280,
    },
  },
  exit: {
    y: "100%",
    transition: {
      duration: durationStandard,
      ease: [0.32, 0, 0.67, 0],
    },
  },
};

/**
 * Custom Dropdowns & Select Popovers Variants
 */
export const dropdownPopoverVariants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: durationFast, ease: easeOutStandard },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: { duration: 0.12, ease: "easeIn" },
  },
};

/**
 * Interactive Button & Micro-action Props
 */
export const buttonPressProps = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.12 },
};

export const subtleButtonPressProps = {
  whileHover: { scale: 1.005 },
  whileTap: { scale: 0.99 },
  transition: { duration: 0.1 },
};

/**
 * Interactive Card Hover Lift Props
 */
export const cardHoverLiftProps = {
  whileHover: { y: -2 },
  transition: { duration: durationPage, ease: "easeOut" },
};

/**
 * Staggered Lists & Table Rows Variants
 */
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durationPage,
      ease: easeOutStandard,
    },
  },
};

/**
 * Table Container & Row Stagger Variants
 * Designed specifically for admin tables with responsive filtering
 */
export const tableContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.015,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1 },
  },
};

export const tableRowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durationPage,
      ease: easeOutStandard,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: durationFast,
      ease: "easeIn",
    },
  },
};
