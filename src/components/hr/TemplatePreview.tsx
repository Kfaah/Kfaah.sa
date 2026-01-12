import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText, Calendar, Type, List, Workflow } from "lucide-react";

interface CustomField {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface WorkflowStage {
  id: string;
  order: number;
  name: string;
  approverRole: string;
  isRequired: boolean;
  canReject: boolean;
}

interface TemplateData {
  name_ar?: string;
  letterhead_url?: string | null;
  header_text?: string | null;
  greeting_text?: string | null;
  body_template?: string | null;
  closing_text?: string | null;
  custom_fields?: CustomField[];
  workflow_stages?: WorkflowStage[];
  show_dates?: boolean;
  show_reason?: boolean;
  show_notes?: boolean;
  header_offset?: number | string | null; // نسبة مئوية (0-50) تحدد منطقة الترويسة/الكليشة
}

interface TemplatePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateData: TemplateData;
}

export function TemplatePreview({ open, onOpenChange, templateData }: TemplatePreviewProps) {
  const letterheadUrl = templateData.letterhead_url || "/letterhead-template.jpg";

  const headerOffsetRaw = templateData.header_offset;
  const headerOffset = Math.min(50, Math.max(5, Number(headerOffsetRaw ?? 25) || 25));

  // ملاحظة: نستخدم ?? بدل || حتى لو المستخدم ترك الحقل فارغاً ("") ما نرجّعه للنص الافتراضي
  const headerText =
    templateData.header_text ?? "صاحب السعادة المدير العام    حفظه الله";
  const greetingText =
    templateData.greeting_text ?? "السلام عليكم ورحمة الله وبركاته، وبعد:";
  const bodyText =
    templateData.body_template ??
    `أتقدم لسعادتكم بطلب الحصول على ${templateData.name_ar || "___"}`;
  const closingText =
    templateData.closing_text ??
    "آمل من سعادتكم التكرم بالموافقة على طلبي.\nوتقبلوا فائق الاحترام والتقدير،،،";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-accent" />
            معاينة قالب: {templateData.name_ar}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* معاينة النموذج */}
          <div>
            <p className="text-sm text-muted-foreground mb-2 text-center">معاينة النموذج الرسمي</p>
            <div 
              className="relative bg-white rounded-lg overflow-hidden shadow-lg border"
              style={{ aspectRatio: "210/297", minHeight: "400px" }}
            >
              <img
                src={letterheadUrl}
                alt="قالب الخطاب"
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              <div
                className="absolute inset-0 px-4 pb-4 flex flex-col"
                style={{
                  paddingTop: `calc(${headerOffset}% + 10px)`,
                  fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif",
                }}
                dir="rtl"
              >
                <div className="flex justify-between items-center mx-2 text-[7px]">
                  <div className="text-right">
                    <span className="text-muted-foreground/70">رقم الطلب: </span>
                    <span className="font-bold text-foreground">HR-2026XX-XXXX</span>
                  </div>
                  <div className="text-left">
                    <span className="text-muted-foreground/70">التاريخ: </span>
                    <span className="font-bold text-foreground">12/01/2026</span>
                  </div>
                </div>

                <div className="mr-4 ml-8 space-y-1.5 text-[9px] leading-relaxed">
                  <h2 className="text-sm font-bold text-center mb-3">
                    طلب {templateData.name_ar || "___________"}
                  </h2>

                  <p className="font-semibold text-[8px]">{headerText}</p>
                  <p className="text-[8px]">{greetingText}</p>
                  
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[8px]">
                      <span className="font-semibold">أنا الموقع أدناه:</span>{" "}
                      <span className="text-muted-foreground">اسم الموظف</span>
                    </p>
                    <p className="text-[8px]">
                      <span className="font-semibold">المسمى الوظيفي:</span>{" "}
                      <span className="text-muted-foreground">المسمى</span>
                    </p>
                  </div>

                  <p className="mt-2 text-[8px]">{bodyText}</p>

                  {templateData.show_dates && (
                    <div className="space-y-0.5">
                      <p className="text-[8px]">
                        <span className="font-semibold">اعتباراً من تاريخ:</span>{" "}
                        <span className="text-muted-foreground">__/__/____</span>
                      </p>
                      <p className="text-[8px]">
                        <span className="font-semibold">وحتى تاريخ:</span>{" "}
                        <span className="text-muted-foreground">__/__/____</span>
                      </p>
                    </div>
                  )}

                  {templateData.show_reason && (
                    <p className="text-[8px]">
                      <span className="font-semibold">السبب:</span>{" "}
                      <span className="text-muted-foreground italic">سيتم إضافة السبب هنا...</span>
                    </p>
                  )}

                  {/* الحقول المخصصة */}
                  {templateData.custom_fields?.map((field) => (
                    <p key={field.id} className="text-[8px]">
                      <span className="font-semibold">{field.label}:</span>{" "}
                      <span className="text-muted-foreground italic">
                        {field.type === "select" ? `[${field.options?.join(" | ")}]` : "___________"}
                      </span>
                    </p>
                  ))}

                  <p className="mt-2 text-[8px] whitespace-pre-line">{closingText}</p>

                  <div className="flex justify-between mt-4 pt-2">
                    <div className="text-center min-w-[80px]">
                      <p className="font-semibold mb-0.5 text-[8px]">مقدم الطلب</p>
                      <p className="text-[8px]">___________</p>
                      <div className="h-6 border-b border-dashed border-muted-foreground/50 mt-1 mx-2" />
                    </div>

                    <div className="text-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-1.5 min-w-[80px]">
                      <p className="font-semibold mb-0.5 text-[8px] text-muted-foreground">اعتماد الإدارة</p>
                      <p className="text-[7px] text-muted-foreground/60 mt-2">في انتظار الموافقة</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute top-2 left-2 bg-accent/90 text-white text-[8px] px-2 py-0.5 rounded-full font-medium">
                معاينة
              </div>
            </div>
          </div>

          {/* ملخص الإعدادات */}
          <div className="space-y-4">
            {/* الحقول */}
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <List className="w-4 h-4" />
                الحقول المطلوبة
              </h4>
              <div className="space-y-2">
                {templateData.show_dates && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>تاريخ البداية والنهاية</span>
                  </div>
                )}
                {templateData.show_reason && (
                  <div className="flex items-center gap-2 text-sm">
                    <Type className="w-4 h-4 text-muted-foreground" />
                    <span>السبب</span>
                  </div>
                )}
                {templateData.show_notes && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span>الملاحظات</span>
                  </div>
                )}
                {templateData.custom_fields?.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 text-sm">
                    <Type className="w-4 h-4 text-muted-foreground" />
                    <span>{field.label}</span>
                    {field.required && (
                      <Badge variant="destructive" className="text-[10px]">مطلوب</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* مسار الموافقات */}
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <Workflow className="w-4 h-4" />
                مسار الموافقات
              </h4>
              {(templateData.workflow_stages?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">موافقة مباشرة من المدير</p>
              ) : (
                <div className="space-y-2">
                  {templateData.workflow_stages?.map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{stage.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stage.approverRole === "admin" && "المدراء"}
                          {stage.approverRole === "moderator" && "المشرفون"}
                          {stage.approverRole === "specific_user" && "موظف محدد"}
                        </p>
                      </div>
                      {index < (templateData.workflow_stages?.length ?? 0) - 1 && (
                        <div className="w-0.5 h-4 bg-accent/30 absolute -bottom-3 left-3" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
