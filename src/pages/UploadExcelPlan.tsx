import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Upload, Save, ArrowRight, Sparkles, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableYears, getCurrentYear } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function UploadExcelPlan() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>("");
  const [sheetName, setSheetName] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);

  const [planName, setPlanName] = useState("الخطة الأولى");
  const [year, setYear] = useState<number>(getCurrentYear());
  const [useForAi, setUseForAi] = useState(true);
  const [saving, setSaving] = useState(false);

  const years = getAvailableYears();

  const handleFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      // Read using header row as keys; defval keeps empty cells
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: false });

      if (json.length === 0) {
        toast({ title: "الملف فارغ", description: "لم نجد أي صفوف بيانات", variant: "destructive" });
        return;
      }

      // Extract headers in original order from the first data row
      const headerRow = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" })[0] as any[];
      const headers = (headerRow || []).map((h) => String(h ?? "").trim()).filter(Boolean);

      setFileName(file.name);
      setSheetName(firstSheet);
      setColumns(headers.length > 0 ? headers : Object.keys(json[0]));
      setRows(json);

      // Suggest plan name from filename
      const base = file.name.replace(/\.[^.]+$/, "");
      if (base) setPlanName(base);

      toast({ title: "تم تحميل الملف", description: `${json.length} صف، ${headers.length} عمود` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "تعذر قراءة الملف", description: err?.message || "تأكد من صحة ملف Excel", variant: "destructive" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setFileName("");
    setSheetName("");
    setColumns([]);
    setRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      toast({ title: "لا توجد بيانات", description: "ارفع ملف Excel أولاً", variant: "destructive" });
      return;
    }
    if (!planName.trim()) {
      toast({ title: "اسم الخطة مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("excel_plans").insert({
        plan_name: planName.trim(),
        year,
        sheet_name: sheetName,
        columns: columns as any,
        rows: rows as any,
        use_for_ai: useForAi,
        source_filename: fileName,
        user_id: userRes.user?.id ?? null,
      });
      if (error) throw error;
      toast({ title: "تم حفظ الخطة بنجاح", description: `${rows.length} صف بـ ${columns.length} عمود` });
      navigate("/operational-plans");
    } catch (err: any) {
      console.error(err);
      toast({ title: "فشل الحفظ", description: err?.message || "حدث خطأ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const previewRows = rows.slice(0, 50);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <PageHeader
          icon={<FileSpreadsheet className="w-6 h-6" />}
          title="رفع خطة من ملف Excel"
          subtitle="ارفع ملف Excel وستُحفظ الخطة بنفس الأعمدة والبيانات تماماً"
          actions={
            <Button
              variant="outline"
              className="gap-2 bg-white/15 text-white border-white/30 hover:bg-white/25"
              onClick={() => navigate("/operational-plans")}
            >
              <ArrowRight className="w-4 h-4" />
              العودة
            </Button>
          }
        />

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" dir="rtl">
          {/* Upload zone */}
          {rows.length === 0 ? (
            <Card
              className="p-12 border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center justify-center text-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">اسحب وأفلت ملف Excel هنا</h3>
                  <p className="text-sm text-slate-500 mt-1">أو انقر لاختيار ملف (.xlsx, .xls, .csv)</p>
                </div>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <p className="text-xs text-slate-400 mt-2">
                  السطر الأول من الملف يُعتبر رؤوس الأعمدة، وباقي الصفوف تُحفظ كما هي
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* File info & settings */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{fileName}</div>
                      <div className="text-sm text-slate-500">
                        ورقة: {sheetName} · {rows.length} صف · {columns.length} عمود
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={reset} className="gap-1">
                    <X className="w-4 h-4" />
                    إعادة تعيين
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-right block mb-2">اسم الخطة</Label>
                    <Input
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      placeholder="مثلاً: الخطة الأولى"
                      className="text-right"
                    />
                  </div>
                  <div>
                    <Label className="text-right block mb-2">السنة</Label>
                    <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                      <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <div className={cn(
                      "w-full p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors",
                      useForAi ? "bg-primary/5 border-primary/40" : "bg-slate-50 border-slate-200"
                    )}>
                      <div className="flex items-center gap-2">
                        <Sparkles className={cn("w-5 h-5", useForAi ? "text-primary" : "text-slate-400")} />
                        <div>
                          <div className="text-sm font-semibold text-slate-800">اعتمدها للذكاء الاصطناعي</div>
                          <div className="text-xs text-slate-500">سيُبنى عليها لتوليد خطط مقترحة</div>
                        </div>
                      </div>
                      <Switch checked={useForAi} onCheckedChange={setUseForAi} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Preview table */}
              <Card className="p-0 overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-l from-emerald-50 to-white border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">معاينة البيانات</h3>
                  <span className="text-xs text-slate-500">
                    عرض أول {previewRows.length} صف من أصل {rows.length}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm" dir="rtl">
                    <thead className="bg-[hsl(160,50%,25%)] text-white sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-right font-semibold border-l border-white/20 w-12">#</th>
                        {columns.map((c, i) => (
                          <th key={i} className="px-3 py-2 text-right font-semibold border-l border-white/20 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                          <td className="px-3 py-2 text-slate-400 border-b border-slate-100 text-center">{ri + 1}</td>
                          {columns.map((c, ci) => (
                            <td key={ci} className="px-3 py-2 text-slate-700 border-b border-slate-100 whitespace-nowrap max-w-[260px] truncate">
                              {String(row[c] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => navigate("/operational-plans")}>إلغاء</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ الخطة
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}