import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, PenTool } from "lucide-react";

interface SignatureUploadProps {
  currentSignature?: string | null;
  userId: string;
  onSignatureUpdate: (url: string | null) => void;
  isEmployee?: boolean;
}

export function SignatureUpload({ 
  currentSignature, 
  userId, 
  onSignatureUpdate,
  isEmployee = false 
}: SignatureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى رفع صورة فقط");
      return;
    }

    // التحقق من حجم الملف (أقل من 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2 ميجابايت");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `signatures/${userId}/signature.${fileExt}`;

      // حذف التوقيع القديم إذا وجد
      if (currentSignature) {
        const oldPath = currentSignature.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("avatars")
            .remove([`signatures/${userId}/${oldPath}`]);
        }
      }

      // رفع التوقيع الجديد
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // الحصول على الرابط العام
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const signatureUrl = urlData.publicUrl;

      // تحديث جدول الموظفين
      if (isEmployee) {
        const { error: updateError } = await supabase
          .from("employees")
          .update({ signature_url: signatureUrl })
          .eq("user_id", userId);

        if (updateError) throw updateError;
      }

      onSignatureUpdate(signatureUrl);
      toast.success("تم رفع التوقيع بنجاح");
    } catch (error) {
      console.error("Error uploading signature:", error);
      toast.error("حدث خطأ أثناء رفع التوقيع");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentSignature) return;

    setDeleting(true);
    try {
      // حذف من التخزين
      const fileName = `signatures/${userId}/signature.${currentSignature.split(".").pop()}`;
      await supabase.storage.from("avatars").remove([fileName]);

      // تحديث جدول الموظفين
      if (isEmployee) {
        const { error: updateError } = await supabase
          .from("employees")
          .update({ signature_url: null })
          .eq("user_id", userId);

        if (updateError) throw updateError;
      }

      onSignatureUpdate(null);
      toast.success("تم حذف التوقيع");
    } catch (error) {
      console.error("Error deleting signature:", error);
      toast.error("حدث خطأ أثناء حذف التوقيع");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PenTool className="w-5 h-5 text-accent" />
          التوقيع الرسمي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentSignature ? (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-white flex items-center justify-center min-h-[120px]">
              <img
                src={currentSignature}
                alt="التوقيع"
                className="max-h-24 object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 ml-2" />
                )}
                تغيير التوقيع
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-accent transition-colors"
          >
            <PenTool className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              اضغط لرفع صورة توقيعك
            </p>
            <p className="text-xs text-muted-foreground">
              PNG أو JPG بخلفية شفافة أو بيضاء (حد أقصى 2MB)
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />

        <p className="text-xs text-muted-foreground text-center">
          يستخدم التوقيع في الخطابات والطلبات الرسمية
        </p>
      </CardContent>
    </Card>
  );
}
