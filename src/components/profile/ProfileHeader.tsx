import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Pencil, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface ProfileHeaderProps {
  user: {
    firstName: string;
    lastName: string;
    profileImage: string | null;
    role: string;
    department?: string;
    jobRole?: string;
    username?: string;
  };
  employeeTitle?: string | null;
  isAdmin: boolean;
  onEditClick: () => void;
  onImageClick: () => void;
}

export function ProfileHeader({
  user,
  employeeTitle,
  isAdmin,
  onEditClick,
  onImageClick,
}: ProfileHeaderProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl shadow-xl"
      style={{
        background:
          "linear-gradient(to left, hsl(var(--primary)) 0%, hsl(var(--primary)) 72%, hsl(var(--accent)) 100%)",
      }}
    >
      {/* Animated Background Decorations */}
      <div className="absolute inset-0 opacity-20">
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-0 right-0 w-80 h-80 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" 
        />
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" 
        />
      </div>

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row-reverse items-stretch gap-6 md:gap-8">
          {/* Avatar Section - LEFT Side */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
              delay: 0.2,
            }}
            className="relative group shrink-0 flex items-center"
          >
            <div className="relative">
              {/* Glow Effect */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1.1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="absolute inset-0 rounded-full bg-white/20 blur-xl"
              />

              <Avatar className="relative w-28 h-28 md:w-36 md:h-36 lg:w-40 lg:h-40 border-4 border-white/40 shadow-2xl ring-4 ring-white/10">
                <AvatarImage
                  src={user.profileImage || undefined}
                  alt="صورة الملف الشخصي"
                  className="object-cover -scale-x-100"
                />
                <AvatarFallback className="text-4xl md:text-5xl bg-white/20 text-white font-bold">
                  {user.firstName.charAt(0)}
                </AvatarFallback>
              </Avatar>

              {/* Upload Button Overlay */}
              <button
                type="button"
                onClick={onImageClick}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center cursor-pointer"
              >
                <Camera className="w-8 h-8 text-white" />
              </button>

              {/* Online Status Indicator */}
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.6 }}
                className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-400 rounded-full border-4 border-white shadow-lg"
              >
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </motion.span>
            </div>
          </motion.div>

          {/* Center Section - Employee Title with decorations */}
          <div className="flex-1 flex items-center justify-center">
            {employeeTitle && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="relative flex items-center gap-3"
              >
                {/* Right Star */}
                <motion.div
                  initial={{ rotate: -30, scale: 0 }}
                  animate={{ 
                    rotate: [0, 15, -15, 10, -10, 0],
                    scale: [1, 1.2, 0.9, 1.1, 1],
                  }}
                  transition={{ 
                    duration: 3,
                    delay: 0.6,
                    repeat: Infinity,
                    repeatDelay: 1,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="w-6 h-6 text-amber-400 drop-shadow-lg" />
                </motion.div>
                
                {/* Title Box */}
                <div className="relative bg-white/20 backdrop-blur-md rounded-2xl px-8 py-3 border-2 border-white/40 shadow-xl">
                  <span className="text-lg md:text-xl font-bold text-white">
                    {employeeTitle}
                  </span>
                </div>
                
                {/* Left Star */}
                <motion.div
                  initial={{ rotate: 30, scale: 0 }}
                  animate={{ 
                    rotate: [0, -15, 15, -10, 10, 0],
                    scale: [1, 0.9, 1.2, 1, 1.1, 1],
                  }}
                  transition={{ 
                    duration: 3,
                    delay: 0.8,
                    repeat: Infinity,
                    repeatDelay: 1,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="w-6 h-6 text-amber-400 drop-shadow-lg" />
                </motion.div>
              </motion.div>
            )}
          </div>

          {/* Right Section - Name and Edit Button - aligned right */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right space-y-2 shrink-0">
            {/* Name */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                {user.firstName} {user.lastName}
              </h1>
            </motion.div>

            {/* Role - Centered */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="w-full flex justify-center"
            >
              <span className="inline-block px-4 py-1.5 rounded-full bg-white text-slate-900 text-base md:text-lg font-semibold shadow-md">
                {user.role}
              </span>
            </motion.div>

            {/* Online Badge - Centered */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="w-full flex justify-center"
            >
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm gap-1.5 px-3 py-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                متصل الآن
              </Badge>
            </motion.div>

            {/* Edit Button */}
            {isAdmin && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className="pt-1"
              >
                <Button
                  onClick={onEditClick}
                  variant="secondary"
                  size="sm"
                  className="gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105"
                >
                  <Pencil className="w-4 h-4" />
                  تعديل الملف الشخصي
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
