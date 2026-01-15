import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Download,
  GraduationCap,
  Award,
  Briefcase,
  File,
  Loader2,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import { SmartPdfViewer } from "./SmartPdfViewer";

interface ProfileFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  category: string;
  created_at: string;
}

const FILE_CATEGORIES = [
  { id: "cv", label: "السيرة الذاتية", icon: FileText },
  { id: "certificate", label: "الشهادات", icon: GraduationCap },
  { id: "course", label: "الدورات التدريبية", icon: Award },
  { id: "contract", label: "العقود", icon: Briefcase },
  { id: "other", label: "أخرى", icon: File },
];

interface ProfileFilesSectionProps {
  userId: string;
}

export function ProfileFilesSection({ userId }: ProfileFilesSectionProps) {
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState("other");
  const [isUploading, setIsUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [previewFile, setPreviewFile] = useState<ProfileFile | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // دالة تحميل الملف عبر blob (تتجاوز مشاكل CORS)
  const handleDownload = async (url: string, name: string) => {
    setIsDownloading(true);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("فشل التحميل");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = name || "file";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      toast.success("تم تحميل الملف بنجاح");
    } catch (error) {
      toast.error("فشل تحميل الملف. حاول مرة أخرى.");
      // Fallback: open in new tab
      window.open(url, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  const inferFileKind = (file: ProfileFile) => {
    const type = (file.file_type || "").toLowerCase();
    const url = file.file_url || "";

    if (
      type.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(url)
    ) {
      return "image" as const;
    }

    if (type === "application/pdf" || /\.pdf(\?|$)/i.test(url)) {
      return "pdf" as const;
    }

    return "other" as const;
  };

  useEffect(() => {
    let canceled = false;
    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    };

    const load = async () => {
      if (!previewFile) {
        setPreviewObjectUrl(null);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }

      const kind = inferFileKind(previewFile);

      // PDFs: لا نحمل blob مسبقاً لأنه يكرر التحميل ويزيد التأخير.
      if (kind === "pdf") {
        setPreviewObjectUrl(null);
        setPreviewLoading(false);
        setPreviewError(null);
        return;
      }

      const shouldBlockUi = kind === "image";
      setPreviewLoading(shouldBlockUi);
      setPreviewError(null);

      try {
        const res = await fetch(previewFile.file_url, { cache: "no-store" });
        if (!res.ok) throw new Error(`http_${res.status}`);

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        if (canceled) {
          cleanup();
          return;
        }

        setPreviewObjectUrl(objectUrl);
      } catch (e) {
        if (!canceled) {
          setPreviewObjectUrl(null);
          setPreviewError("تعذر عرض الملف داخل الصفحة. يمكنك تنزيله وفتحه.");
        }
      } finally {
        if (!canceled && shouldBlockUi) setPreviewLoading(false);
      }
    };

    load();

    return () => {
      canceled = true;
      cleanup();
    };
  }, [previewFile?.file_url]);

  // جلب ملفات الموظف
  const { data: files = [], isLoading } = useQuery({
    queryKey: ["profile-files", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_files" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as ProfileFile[];
    },
    enabled: !!userId,
  });

  // رفع ملف جديد
  const uploadFile = async () => {
    if (!selectedFile) {
      toast.error("يرجى اختيار ملف");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-files")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("employee-files")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("employee_files" as any)
        .insert({
          user_id: userId,
          file_name: fileName || selectedFile.name,
          file_url: urlData.publicUrl,
          file_type: selectedFile.type,
          category,
        });

      if (insertError) throw insertError;

      toast.success("تم رفع الملف بنجاح");
      queryClient.invalidateQueries({ queryKey: ["profile-files", userId] });
      setIsUploadOpen(false);
      setSelectedFile(null);
      setFileName("");
      setCategory("other");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("حدث خطأ أثناء رفع الملف");
    } finally {
      setIsUploading(false);
    }
  };

  // حذف ملف
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from("employee_files" as any)
        .delete()
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الملف");
      queryClient.invalidateQueries({ queryKey: ["profile-files", userId] });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف الملف");
    },
  });

  const filteredFiles = activeCategory
    ? files.filter((f) => f.category === activeCategory)
    : files;

  const getCategoryInfo = (categoryId: string) => {
    return FILE_CATEGORIES.find((c) => c.id === categoryId) || FILE_CATEGORIES[4];
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          الملفات والمستندات
        </CardTitle>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة ملف
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة ملف جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم الملف</Label>
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="مثال: شهادة البكالوريوس"
                />
              </div>

              <div className="space-y-2">
                <Label>التصنيف</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <cat.icon className="w-4 h-4" />
                          {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الملف</Label>
                <div
                  className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors"
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  {selectedFile ? (
                    <div className="space-y-2">
                      <FileText className="w-8 h-8 mx-auto text-accent" />
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        اضغط لاختيار ملف أو اسحب الملف هنا
                      </p>
                    </div>
                  )}
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <Button
                onClick={uploadFile}
                className="w-full"
                disabled={isUploading || !selectedFile}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    جاري الرفع...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 ml-2" />
                    رفع الملف
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* فلاتر التصنيف */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={activeCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(null)}
          >
            الكل ({files.length})
          </Button>
          {FILE_CATEGORIES.map((cat) => {
            const count = files.filter((f) => f.category === cat.id).length;
            const Icon = cat.icon;
            return (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className="gap-1.5"
              >
                <Icon className="w-4 h-4" />
                {cat.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* قائمة الملفات */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">لا توجد ملفات</p>
            <p className="text-sm">أضف ملفاتك مثل السيرة الذاتية والشهادات</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFiles.map((file) => {
              const catInfo = getCategoryInfo(file.category);
              const CatIcon = catInfo.icon;
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <CatIcon className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {catInfo.label} • {formatDateTime(file.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPreviewFile(file)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a href={file.file_url} download>
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteFileMutation.mutate(file.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* مربع حوار معاينة الملف */}
      <Dialog
        open={!!previewFile}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewFile(null);
            setPreviewObjectUrl(null);
            setPreviewError(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col" dir="rtl" aria-describedby={undefined}>
          <DialogHeader className="p-4 border-b">
            <div className="flex flex-row items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                {previewFile?.file_name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (previewFile) {
                      handleDownload(previewFile.file_url, previewFile.file_name);
                    }
                  }}
                  disabled={isDownloading || !previewFile}
                  className="flex items-center gap-2"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>تحميل</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPreviewFile(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4">
            {!previewFile ? null : previewError ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground text-center">
                <FileText className="w-20 h-20 opacity-30" />
                <p>{previewError}</p>
                <Button
                  onClick={() => handleDownload(previewFile.file_url, previewFile.file_name)}
                  disabled={isDownloading}
                  className="gap-2"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  تحميل الملف
                </Button>
              </div>
            ) : previewLoading && inferFileKind(previewFile) !== "pdf" ? (
              <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : inferFileKind(previewFile) === "image" ? (
              <img
                src={previewObjectUrl || previewFile.file_url}
                alt={previewFile.file_name}
                loading="lazy"
                decoding="async"
                className="max-w-full h-auto mx-auto rounded-lg"
              />
            ) : inferFileKind(previewFile) === "pdf" ? (
              <div className="h-full flex flex-col">
                <SmartPdfViewer
                  fileUrl={previewFile.file_url}
                  blobUrl={previewObjectUrl}
                  fileName={previewFile.file_name}
                  className="w-full h-[65vh]"
                />
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Button
                    onClick={() => handleDownload(previewFile.file_url, previewFile.file_name)}
                    disabled={isDownloading}
                    className="gap-2"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    تحميل الملف
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    إذا تأخر العرض، اختر وضع <span className="font-medium">سريع</span>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
                <FileText className="w-20 h-20 opacity-30" />
                <p>لا يمكن عرض هذا النوع من الملفات</p>
                <Button
                  onClick={() => handleDownload(previewFile.file_url, previewFile.file_name)}
                  disabled={isDownloading}
                  className="gap-2"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  تحميل الملف
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
