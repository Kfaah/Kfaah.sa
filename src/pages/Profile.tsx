import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, User, Mail, Phone, Building, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const [profileData, setProfileData] = useState({
    firstName: "جابر",
    lastName: "الحريصي",
    email: "jaber@atef.org",
    phone: "+966 50 123 4567",
    department: "الإدارة العليا",
    location: "الرياض، السعودية",
  });
  
  const [profileImage, setProfileImage] = useState<string | null>(
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
        toast.success("تم تحديث الصورة بنجاح");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("تم حفظ التغييرات بنجاح");
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">الملف الشخصي</h1>
            <p className="text-muted-foreground mt-1">إدارة معلوماتك الشخصية وإعدادات حسابك</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture Card */}
          <Card className="overflow-hidden">
            <div className="h-32 bg-gradient-to-l from-accent via-primary to-accent/80" />
            <CardContent className="relative pt-0 pb-6">
              <div className="flex flex-col sm:flex-row items-center gap-6 -mt-16">
                {/* Avatar with upload */}
                <div className="relative group">
                  <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                    <AvatarImage src={profileImage || undefined} alt="صورة الملف الشخصي" />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-accent to-primary text-white">
                      {profileData.firstName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <Camera className="w-8 h-8 text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                
                <div className="text-center sm:text-right flex-1">
                  <h2 className="text-2xl font-bold text-foreground">
                    {profileData.firstName} {profileData.lastName}
                  </h2>
                  <p className="text-muted-foreground">مدير النظام</p>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      متصل الآن
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Camera className="w-4 h-4" />
                  تغيير الصورة
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <User className="w-5 h-5 text-accent" />
                المعلومات الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-base">الاسم الأول</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className="text-base h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-base">اسم العائلة</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className="text-base h-12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    البريد الإلكتروني
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="text-base h-12"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    رقم الهاتف
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className="text-base h-12"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="department" className="text-base flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    القسم
                  </Label>
                  <Input
                    id="department"
                    value={profileData.department}
                    onChange={(e) => handleInputChange("department", e.target.value)}
                    className="text-base h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    الموقع
                  </Label>
                  <Input
                    id="location"
                    value={profileData.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    className="text-base h-12"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" size="lg">
              إلغاء
            </Button>
            <Button type="submit" size="lg" className="gap-2 bg-gradient-to-l from-accent to-primary hover:opacity-90">
              <Save className="w-4 h-4" />
              حفظ التغييرات
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
