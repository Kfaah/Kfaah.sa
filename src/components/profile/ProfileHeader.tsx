import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Building, Briefcase, AtSign, Pencil } from "lucide-react";

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
  currentMessage: string;
  isAdmin: boolean;
  onEditClick: () => void;
  onImageClick: () => void;
}

export function ProfileHeader({
  user,
  currentMessage,
  isAdmin,
  onEditClick,
  onImageClick,
}: ProfileHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-primary via-accent to-primary/80 p-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative flex flex-col md:flex-row items-center gap-8">
        {/* Avatar Section */}
        <div className="relative group shrink-0">
          <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-white/30 shadow-2xl">
            <AvatarImage src={user.profileImage || undefined} alt="صورة الملف الشخصي" className="object-cover" />
            <AvatarFallback className="text-4xl md:text-5xl bg-white/20 text-white font-bold">
              {user.firstName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={onImageClick}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
          >
            <Camera className="w-8 h-8 text-white" />
          </button>
          {/* Online Status */}
          <span className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-400 rounded-full border-4 border-white shadow-lg animate-pulse" />
        </div>

        {/* Info Section */}
        <div className="flex-1 text-center md:text-right">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-xl text-white/80 font-medium mb-4">{user.role}</p>
          
          {/* Badges */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 gap-1.5 px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              متصل الآن
            </Badge>
            {user.department && (
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 gap-1.5 px-3 py-1.5">
                <Building className="w-3.5 h-3.5" />
                {user.department}
              </Badge>
            )}
            {user.jobRole && (
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 gap-1.5 px-3 py-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                {user.jobRole}
              </Badge>
            )}
            {user.username && (
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 gap-1.5 px-3 py-1.5">
                <AtSign className="w-3.5 h-3.5" />
                {user.username}
              </Badge>
            )}
          </div>

          {/* Message */}
          <div className="inline-block px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4">
            <p className="text-sm font-medium text-white/90">{currentMessage}</p>
          </div>

          {/* Edit Button */}
          {isAdmin && (
            <div className="flex justify-center md:justify-start">
              <Button 
                onClick={onEditClick} 
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30"
              >
                <Pencil className="w-4 h-4" />
                تعديل الملف الشخصي
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
