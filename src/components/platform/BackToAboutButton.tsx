import { motion } from "framer-motion";
import { ArrowRight, LogIn } from "lucide-react";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

interface Props {
  onClick: () => void;
  label?: string;
}

export default function BackToAboutButton({ onClick, label = "العودة إلى عن المنصة" }: Props) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      onClick={onClick}
      className="group inline-flex items-center gap-3 rounded-full px-6 py-3 bg-white/[0.06] backdrop-blur-xl border border-white/20 hover:border-white/50 hover:bg-white/[0.12] shadow-[0_12px_40px_-12px_hsl(220_75%_3%/0.7)] transition-all duration-500 hover:-translate-y-0.5"
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg shadow-black/30 group-hover:scale-110 transition-transform duration-500"
        style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
      >
        <LogIn className="w-4 h-4 text-white rotate-180" />
      </span>
      <span className="text-sm font-bold text-white">{label}</span>
      <ArrowRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:-translate-x-1 transition-all" />
    </motion.button>
  );
}