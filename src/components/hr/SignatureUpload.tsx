import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
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
  const [lineWidth, setLineWidth] = useState(2);
  const [previewBgGray, setPreviewBgGray] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processUploadedSignature = useCallback(async (file: File): Promise<Blob> => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const url = URL.createObjectURL(file);
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("failed_to_load_image"));
      };
      el.src = url;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no_canvas_context");

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // تقدير لون الخلفية من زوايا الصورة (عادة رمادي/أبيض)
    const sample = [
      { x: 0, y: 0 },
      { x: w - 1, y: 0 },
      { x: 0, y: h - 1 },
      { x: w - 1, y: h - 1 },
    ];

    let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
    for (const p of sample) {
      const idx = (p.y * w + p.x) * 4;
      const a = data[idx + 3];
      if (a < 10) continue;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
      bgCount++;
    }

    if (bgCount > 0) {
      bgR = Math.round(bgR / bgCount);
      bgG = Math.round(bgG / bgCount);
      bgB = Math.round(bgB / bgCount);
    } else {
      // افتراضي (أبيض)
      bgR = 255; bgG = 255; bgB = 255;
    }

    // تلوين التوقيع أزرق فاتح + تفريغ الخلفية
    const BLUE = { r: 59, g: 130, b: 246 };
    const THRESH_MIN = 18;
    const THRESH_MAX = 55;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 10) {
        data[i + 3] = 0;
        continue;
      }

      const dr = r - bgR;
      const dg = g - bgG;
      const db = b - bgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      // قرب شديد من الخلفية -> شفافية
      if (dist <= THRESH_MIN) {
        data[i + 3] = 0;
        continue;
      }

      // حافة ناعمة (Feather)
      if (dist < THRESH_MAX) {
        const t = (dist - THRESH_MIN) / (THRESH_MAX - THRESH_MIN);
        data[i + 3] = Math.round(a * t);
      }

      // صبغ لون التوقيع (فقط لو ما صار شفاف تماماً)
      if (data[i + 3] > 0) {
        data[i] = BLUE.r;
        data[i + 1] = BLUE.g;
        data[i + 2] = BLUE.b;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) throw new Error("failed_to_create_png");
    return blob;
  }, []);

  // إعداد الـ Canvas (بدون خلفية حتى يكون التوقيع PNG مفرّغ)
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // تنظيف (خلفية شفافة)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // إعداد القلم بلون أزرق فاتح
    ctx.strokeStyle = "rgb(59, 130, 246)";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [lineWidth]);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  // تحديث سُمك الخط عند التغيير
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = lineWidth;
  }, [lineWidth]);

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  // رفع صورة التوقيع (مع تفريغ الخلفية وتحويل اللون لأزرق فاتح)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // يسمح بإعادة رفع نفس الملف
    e.target.value = "";

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

      // معالجة الصورة: إزالة الخلفية الرمادية/البيضاء + صبغ أزرق
      let uploadBlob: Blob;
      try {
        uploadBlob = await processUploadedSignature(file);
      } catch (err) {
        console.warn("Signature processing failed, uploading original", err);
        uploadBlob = file;
      }

      // حذف التوقيع القديم إذا وجد
      if (currentSignature) {
        await supabase.storage
          .from("avatars")
          .remove([fileName]);
      }

      // رفع التوقيع الجديد
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, uploadBlob, {
          upsert: true,
          contentType: "image/png",
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
    <div className={`rounded-2xl p-6 border transition-colors ${previewBgGray ? 'bg-muted' : 'bg-background'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PenTool className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-semibold">التوقيع</h3>
        </div>
        {currentSignature && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewBgGray(!previewBgGray)}
            className="text-xs gap-1"
          >
            <div className={`w-4 h-4 rounded border ${previewBgGray ? 'bg-muted' : 'bg-background'}`} />
            {previewBgGray ? 'خلفية بيضاء' : 'خلفية رصاصية'}
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {currentSignature ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center min-h-[200px]">
              <img
                src={currentSignature}
                alt="التوقيع"
                className="max-h-40 object-contain"
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
              {/* التحكم بسُمك الخط */}
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground whitespace-nowrap">سُمك الخط:</span>
                <Slider
                  value={[lineWidth]}
                  onValueChange={(value) => setLineWidth(value[0])}
                  min={1}
                  max={6}
                  step={1}
                  className="flex-1"
                />
                <div 
                  className="w-8 h-8 rounded-full border-2 border-muted flex items-center justify-center bg-white"
                >
                  <div 
                    className="rounded-full bg-blue-800"
                    style={{ width: lineWidth * 3, height: lineWidth * 3 }}
                  />
                </div>
              </div>

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
      </div>
    </div>
  );
}
