import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Building, Briefcase, MapPin, AtSign } from "lucide-react";
import { motion } from "framer-motion";

interface ProfileInfoSectionProps {
  user: {
    email: string;
    phone: string;
    department?: string;
    jobRole?: string;
    location?: string;
    username?: string;
  };
}

export function ProfileInfoSection({ user }: ProfileInfoSectionProps) {
  const workInfo = [
    { icon: Briefcase, label: "الدور الوظيفي", value: user.jobRole },
    { icon: AtSign, label: "اسم المستخدم", value: user.username, dir: "ltr" },
  ];

  const contactInfo = [
    { icon: Mail, label: "البريد الإلكتروني", value: user.email, dir: "ltr" },
    { icon: Phone, label: "رقم الهاتف", value: user.phone, dir: "ltr" },
  ];

  return (
    <div className="space-y-6">
      {/* معلومات العمل */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-end gap-2 text-lg">
              معلومات العمل
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-violet-600" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workInfo.filter(item => item.value).map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-violet-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <p 
                    className="font-medium text-foreground" 
                    dir={item.dir || "rtl"}
                  >
                    {item.value}
                  </p>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* معلومات التواصل */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-end gap-2 text-lg">
              معلومات التواصل
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-accent" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contactInfo.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <p 
                    className="font-medium text-foreground truncate text-sm" 
                    dir={item.dir || "rtl"}
                  >
                    {item.value || "-"}
                  </p>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
