import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, PenTool, RotateCcw, Check } from "lucide-react";

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // إعداد الـ Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // تعيين الخلفية البيضاء
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // إعداد القلم
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // دوال الرسم
  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getCoordinates]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCoordinates]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // مسح الـ Canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  // حفظ التوقيع المرسوم
  const saveDrawnSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      toast.error("يرجى رسم توقيعك أولاً");
      return;
    }

    setUploading(true);
    try {
      // تحويل الـ Canvas إلى Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!blob) throw new Error("فشل إنشاء الصورة");

      const fileName = `signatures/${userId}/signature.png`;

      // حذف التوقيع القديم إذا وجد
      if (currentSignature) {
        await supabase.storage
          .from("avatars")
          .remove([fileName]);
      }

      // رفع التوقيع الجديد
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { 
          upsert: true,
          contentType: "image/png"
        });

      if (uploadError) throw uploadError;

      // الحصول على الرابط العام
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const signatureUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // تحديث جدول الموظفين
      if (isEmployee) {
        const { error: updateError } = await supabase
          .from("employees")
          .update({ signature_url: signatureUrl })
          .eq("user_id", userId);

        if (updateError) throw updateError;
      }

      onSignatureUpdate(signatureUrl);
      clearCanvas();
      toast.success("تم حفظ التوقيع بنجاح");
    } catch (error) {
      console.error("Error saving signature:", error);
      toast.error("حدث خطأ أثناء حفظ التوقيع");
    } finally {
      setUploading(false);
    }
  };

  // رفع صورة التوقيع
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("يرجى رفع صورة فقط");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2 ميجابايت");
      return;
    }

    setUploading(true);
    try {
      const fileName = `signatures/${userId}/signature.png`;

      // حذف التوقيع القديم إذا وجد
      if (currentSignature) {
        await supabase.storage
          .from("avatars")
          .remove([fileName]);
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

      const signatureUrl = `${urlData.publicUrl}?t=${Date.now()}`;

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

  // حذف التوقيع
  const handleDelete = async () => {
    if (!currentSignature) return;

    setDeleting(true);
    try {
      const fileName = `signatures/${userId}/signature.png`;
      await supabase.storage.from("avatars").remove([fileName]);

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
                onClick={() => onSignatureUpdate(null)}
                disabled={uploading}
              >
                <PenTool className="w-4 h-4 ml-2" />
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
          <Tabs defaultValue="draw" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="draw" className="gap-2">
                <PenTool className="w-4 h-4" />
                رسم التوقيع
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="w-4 h-4" />
                رفع صورة
              </TabsTrigger>
            </TabsList>

            <TabsContent value="draw" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearCanvas}
                  disabled={!hasDrawn}
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 ml-2" />
                  مسح
                </Button>
                <Button
                  onClick={saveDrawnSignature}
                  disabled={!hasDrawn || uploading}
                  className="flex-1 bg-gradient-to-r from-accent to-teal-500"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 ml-2" />
                  )}
                  حفظ التوقيع
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                ارسم توقيعك باستخدام الماوس أو الإصبع على الشاشات اللمسية
              </p>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-accent transition-colors"
              >
                <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  اضغط لرفع صورة توقيعك
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG أو JPG بخلفية شفافة أو بيضاء (حد أقصى 2MB)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
            </TabsContent>
          </Tabs>
        )}

        <p className="text-xs text-muted-foreground text-center">
          يستخدم التوقيع في الخطابات والطلبات الرسمية
        </p>
      </CardContent>
    </Card>
  );
}
