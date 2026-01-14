import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Building, Briefcase, AtSign, Pencil, Sparkles } from "lucide-react";

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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary via-accent to-primary/90">
      {/* Background Decorations */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-80 h-80 bg-white/20 rounded-full -translate-y-1/2 -translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col-reverse md:flex-row items-center gap-6 md:gap-8">
          {/* Info Section - Left Side */}
          <div className="flex-1 text-center md:text-right space-y-4">
            {/* Name */}
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-lg md:text-xl text-white/80 font-medium mt-1">
                {user.role}
              </p>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm gap-1.5 px-3 py-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                متصل الآن
              </Badge>
              {user.jobRole && (
                <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm gap-1.5 px-3 py-1.5 text-sm">
                  <Briefcase className="w-3.5 h-3.5" />
                  {user.jobRole}
                </Badge>
              )}
            </div>

            {/* Employee Title/Motto */}
            {employeeTitle && (
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 border border-white/25 backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span className="text-sm md:text-base font-semibold text-white">
                  {employeeTitle}
                </span>
              </div>
            )}

            {/* Edit Button */}
            {isAdmin && (
              <div className="pt-2">
                <Button
                  onClick={onEditClick}
                  variant="secondary"
                  className="gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                >
                  <Pencil className="w-4 h-4" />
                  تعديل الملف الشخصي
                </Button>
              </div>
            )}
          </div>

          {/* Avatar Section - Right Side */}
          <div className="relative group shrink-0">
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-full bg-white/20 blur-xl scale-110" />
              
              <Avatar className="relative w-28 h-28 md:w-36 md:h-36 lg:w-40 lg:h-40 border-4 border-white/40 shadow-2xl ring-4 ring-white/10">
                <AvatarImage 
                  src={user.profileImage || undefined} 
                  alt="صورة الملف الشخصي" 
                  className="object-cover" 
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
              <span className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-400 rounded-full border-4 border-white shadow-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
