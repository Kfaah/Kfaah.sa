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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Download,
  File,
  Loader2,
  Eye,
  X,
  FolderPlus,
  Pencil,
  MoreVertical,
  GraduationCap,
  Award,
  Briefcase,
  FolderOpen,
  FileCheck,
  FileBadge,
  Sparkles,
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

interface FileCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  display_order: number;
  created_at: string;
}

interface ProfileFilesSectionProps {
  userId: string;
}

// الأقسام الافتراضية مع ألوان وأيقونات
const DEFAULT_CATEGORIES = [
  { name: "السيرة الذاتية", icon: "FileText", color: "from-blue-500 to-cyan-500" },
  { name: "الشهادات", icon: "GraduationCap", color: "from-amber-500 to-orange-500" },
  { name: "الدورات التدريبية", icon: "Award", color: "from-emerald-500 to-green-500" },
  { name: "العقود", icon: "Briefcase", color: "from-purple-500 to-violet-500" },
  { name: "أخرى", icon: "File", color: "from-slate-500 to-gray-500" },
];

// خريطة الأيقونات
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  GraduationCap,
  Award,
  Briefcase,
  File,
  FolderOpen,
  FileCheck,
  FileBadge,
};

// ألوان للأقسام
const CATEGORY_COLORS = [
  "from-blue-500 to-cyan-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-green-500",
  "from-purple-500 to-violet-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-500",
  "from-teal-500 to-emerald-500",
  "from-fuchsia-500 to-purple-500",
];

export function ProfileFilesSection({ userId }: ProfileFilesSectionProps) {
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [previewFile, setPreviewFile] = useState<ProfileFile | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // إدارة الأقسام
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FileCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isInitializingCategories, setIsInitializingCategories] = useState(false);

  // إنشاء الأقسام الافتراضية للمستخدم الجديد
  const initializeDefaultCategories = async () => {
    setIsInitializingCategories(true);
    try {
      const categoriesToInsert = DEFAULT_CATEGORIES.map((cat, index) => ({
        user_id: userId,
        name: cat.name,
        icon: cat.icon,
        display_order: index,
      }));

      const { error } = await supabase
        .from("file_categories")
        .insert(categoriesToInsert);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["file-categories", userId] });
    } catch (error) {
      console.error("Error initializing categories:", error);
    } finally {
      setIsInitializingCategories(false);
    }
  };

  // جلب أقسام المستخدم
  const { data: userCategories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["file-categories", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("file_categories")
        .select("*")
        .eq("user_id", userId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      
      // إذا لم يكن للمستخدم أقسام، أنشئ الأقسام الافتراضية
      if (!data || data.length === 0) {
        // سيتم إنشاؤها في useEffect
        return [];
      }
      
      return (data || []) as FileCategory[];
    },
    enabled: !!userId,
  });

  // إنشاء الأقسام الافتراضية تلقائياً للمستخدمين الجدد
  useEffect(() => {
    if (!isCategoriesLoading && userCategories.length === 0 && userId && !isInitializingCategories) {
      initializeDefaultCategories();
    }
  }, [isCategoriesLoading, userCategories.length, userId]);

  // رابط تحميل مباشر
  const getDownloadHref = (url: string, name?: string) => {
    try {
      const u = new URL(url);
      u.searchParams.set("download", name || "1");
      return u.toString();
    } catch {
      return url;
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

  // إضافة قسم جديد
  const addCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("يرجى إدخال اسم القسم");
      return;
    }

    setIsSavingCategory(true);
    try {
      const { error } = await supabase.from("file_categories").insert({
        user_id: userId,
        name: newCategoryName.trim(),
        display_order: userCategories.length,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("هذا القسم موجود مسبقاً");
        } else {
          throw error;
        }
        return;
      }

      toast.success("تم إضافة القسم بنجاح");
      queryClient.invalidateQueries({ queryKey: ["file-categories", userId] });
      setNewCategoryName("");
      setIsCategoryDialogOpen(false);
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("حدث خطأ أثناء إضافة القسم");
    } finally {
      setIsSavingCategory(false);
    }
  };

  // تعديل قسم
  const updateCategory = async () => {
    if (!editingCategory || !newCategoryName.trim()) {
      toast.error("يرجى إدخال اسم القسم");
      return;
    }

    setIsSavingCategory(true);
    try {
      const { error } = await supabase
        .from("file_categories")
        .update({ name: newCategoryName.trim() })
        .eq("id", editingCategory.id);

      if (error) {
        if (error.code === "23505") {
          toast.error("هذا القسم موجود مسبقاً");
        } else {
          throw error;
        }
        return;
      }

      toast.success("تم تعديل القسم بنجاح");
      queryClient.invalidateQueries({ queryKey: ["file-categories", userId] });
      setNewCategoryName("");
      setEditingCategory(null);
      setIsCategoryDialogOpen(false);
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("حدث خطأ أثناء تعديل القسم");
    } finally {
      setIsSavingCategory(false);
    }
  };

  // حذف قسم
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("file_categories")
        .delete()
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف القسم");
      queryClient.invalidateQueries({ queryKey: ["file-categories", userId] });
      if (activeCategory && userCategories.find((c) => c.id === activeCategory)) {
        setActiveCategory(null);
      }
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف القسم");
    },
  });

  // رفع ملف جديد
  const uploadFile = async () => {
    if (!selectedFile) {
      toast.error("يرجى اختيار ملف");
      return;
    }

    if (!category) {
      toast.error("يرجى اختيار القسم");
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
      setCategory("");
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

  const getCategoryInfo = (categoryId: string, index: number = 0) => {
    const cat = userCategories.find((c) => c.id === categoryId);
    const catIndex = cat ? userCategories.findIndex((c) => c.id === categoryId) : index;
    const color = CATEGORY_COLORS[catIndex % CATEGORY_COLORS.length];
    const IconComponent = cat?.icon ? ICON_MAP[cat.icon] || File : File;
    return { 
      id: cat?.id || categoryId, 
      label: cat?.name || categoryId,
      color,
      Icon: IconComponent,
    };
  };

  const openAddCategoryDialog = () => {
    setEditingCategory(null);
    setNewCategoryName("");
    setIsCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (cat: FileCategory) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setIsCategoryDialogOpen(true);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-l from-blue-50/50 to-transparent dark:from-blue-950/20 pb-6">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold">الملفات والمستندات</span>
            <p className="text-xs text-muted-foreground font-normal mt-0.5">
              {files.length} ملف في {userCategories.length} قسم
            </p>
          </div>
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* زر إضافة قسم */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-dashed hover:border-solid hover:bg-accent/10 transition-all"
            onClick={openAddCategoryDialog}
          >
            <FolderPlus className="w-4 h-4" />
            <span className="hidden sm:inline">قسم جديد</span>
          </Button>

          {/* زر إضافة ملف */}
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                className="gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/25 transition-all" 
                disabled={userCategories.length === 0}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">إضافة ملف</span>
                <Plus className="w-4 h-4 sm:hidden" />
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-accent" />
                  إضافة ملف جديد
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم الملف</Label>
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="مثال: شهادة البكالوريوس"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>القسم</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {userCategories.map((cat, idx) => {
                        const catInfo = getCategoryInfo(cat.id, idx);
                        const CatIcon = catInfo.Icon;
                        return (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${catInfo.color} flex items-center justify-center`}>
                                <CatIcon className="w-3 h-3 text-white" />
                              </div>
                              {cat.name}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>الملف</Label>
                  <div
                    className="border-2 border-dashed border-muted-foreground/20 rounded-2xl p-8 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all group"
                    onClick={() => document.getElementById("file-input")?.click()}
                  >
                    {selectedFile ? (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg">
                          <FileCheck className="w-8 h-8 text-white" />
                        </div>
                        <p className="font-medium text-foreground">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                          <Upload className="w-8 h-8 text-muted-foreground group-hover:text-accent transition-colors" />
                        </div>
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
                  className="w-full rounded-xl h-11 bg-gradient-to-l from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  disabled={isUploading || !selectedFile || !category}
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
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* فلاتر التصنيف */}
        {isCategoriesLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : userCategories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-2xl mb-6 bg-muted/30">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <FolderPlus className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-semibold text-lg">لا توجد أقسام بعد</p>
            <p className="text-sm mb-5">أنشئ قسمًا جديدًا لتنظيم ملفاتك</p>
            <Button size="sm" onClick={openAddCategoryDialog} className="gap-2 rounded-xl">
              <Plus className="w-4 h-4" />
              إنشاء أول قسم
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
            {/* زر الكل */}
            <button
              onClick={() => setActiveCategory(null)}
              className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-center group ${
                activeCategory === null
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20"
              }`}
            >
              <div className={`w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center transition-all ${
                activeCategory === null
                  ? "bg-gradient-to-br from-primary to-primary/70 shadow-lg"
                  : "bg-muted-foreground/10 group-hover:bg-muted-foreground/20"
              }`}>
                <FolderOpen className={`w-6 h-6 ${activeCategory === null ? "text-white" : "text-muted-foreground"}`} />
              </div>
              <p className={`text-sm font-medium ${activeCategory === null ? "text-primary" : "text-foreground"}`}>
                الكل
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{files.length} ملف</p>
            </button>

            {/* أقسام المستخدم */}
            {userCategories.map((cat, idx) => {
              const count = files.filter((f) => f.category === cat.id).length;
              const catInfo = getCategoryInfo(cat.id, idx);
              const CatIcon = catInfo.Icon;
              const isActive = activeCategory === cat.id;

              return (
                <div key={cat.id} className="relative group">
                  <button
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 text-center ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-lg"
                        : "border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20"
                    }`}
                  >
                    <div className={`w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br ${catInfo.color} flex items-center justify-center shadow-lg transition-transform group-hover:scale-105`}>
                      <CatIcon className="w-6 h-6 text-white" />
                    </div>
                    <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                      {cat.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{count} ملف</p>
                  </button>

                  {/* قائمة التعديل */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 left-2 h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-sm"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="rounded-xl">
                      <DropdownMenuItem onClick={() => openEditCategoryDialog(cat)} className="gap-2">
                        <Pencil className="w-4 h-4" />
                        تعديل الاسم
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive gap-2"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف قسم "${cat.name}"؟`)) {
                            deleteCategoryMutation.mutate(cat.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف القسم
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        {/* قائمة الملفات */}
        {userCategories.length > 0 && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <FileText className="w-10 h-10 opacity-30" />
                </div>
                <p className="text-lg font-medium">لا توجد ملفات</p>
                <p className="text-sm">أضف ملفاتك مثل السيرة الذاتية والشهادات</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFiles.map((file, fileIdx) => {
                  const catInfo = getCategoryInfo(file.category, fileIdx);
                  const CatIcon = catInfo.Icon;
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-l from-muted/30 to-muted/60 hover:from-muted/50 hover:to-muted/80 transition-all group border border-transparent hover:border-muted-foreground/10"
                    >
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${catInfo.color} flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-105`}>
                        <CatIcon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{file.file_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-l ${catInfo.color} text-white`}>
                            {catInfo.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(file.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-blue-500/10 hover:text-blue-600"
                          onClick={() => setPreviewFile(file)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-600"
                          asChild
                        >
                          <a
                            href={getDownloadHref(file.file_url, file.file_name)}
                            rel="noopener noreferrer"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-destructive/10 text-destructive"
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
          </>
        )}
      </CardContent>

      {/* مربع حوار إضافة/تعديل قسم */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent dir="rtl" className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                {editingCategory ? <Pencil className="w-4 h-4 text-white" /> : <FolderPlus className="w-4 h-4 text-white" />}
              </div>
              {editingCategory ? "تعديل القسم" : "إضافة قسم جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم القسم</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="مثال: الشهادات الأكاديمية"
                className="rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    editingCategory ? updateCategory() : addCategory();
                  }
                }}
              />
            </div>
            <Button
              onClick={editingCategory ? updateCategory : addCategory}
              className="w-full rounded-xl h-11 bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              disabled={isSavingCategory || !newCategoryName.trim()}
            >
              {isSavingCategory ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  جاري الحفظ...
                </>
              ) : editingCategory ? (
                <>
                  <Pencil className="w-4 h-4 ml-2" />
                  حفظ التعديلات
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة القسم
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  asChild
                  className="flex items-center gap-2"
                >
                  <a
                    href={
                      previewFile
                        ? getDownloadHref(previewFile.file_url, previewFile.file_name)
                        : "#"
                    }
                    onClick={(e) => {
                      if (!previewFile) e.preventDefault();
                    }}
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل</span>
                  </a>
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
                <Button asChild className="gap-2">
                  <a
                    href={getDownloadHref(previewFile.file_url, previewFile.file_name)}
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4" />
                    تحميل الملف
                  </a>
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
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
                <FileText className="w-20 h-20 opacity-30" />
                <p>لا يمكن عرض هذا النوع من الملفات</p>
                <Button asChild className="gap-2">
                  <a
                    href={getDownloadHref(previewFile.file_url, previewFile.file_name)}
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4" />
                    تحميل الملف
                  </a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
