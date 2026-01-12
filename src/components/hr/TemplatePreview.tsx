import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText, Calendar, Type, List, Workflow } from "lucide-react";
import { LiveRequestPreview } from "./LiveRequestPreview";

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

  const demoStartDate = templateData.show_dates ? new Date() : undefined;
  const demoEndDate = templateData.show_dates ? new Date() : undefined;
  const demoDaysCount = templateData.show_dates ? 1 : 0;

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
            <p className="text-sm text-muted-foreground mb-2 text-center">
              المعاينة الحية للنموذج الرسمي
            </p>

            <LiveRequestPreview
              employeeName="اسم الموظف"
              jobRole="المسمى الوظيفي"
              signatureUrl={null}
              requestTypeName={templateData.name_ar || "طلب"}
              startDate={demoStartDate}
              endDate={demoEndDate}
              daysCount={demoDaysCount}
              reason={templateData.show_reason ? "سبب تجريبي" : ""}
              notes={templateData.show_notes ? "ملاحظات تجريبية" : ""}
              requestNumber="HR-2026XX-XXXX"
              substituteEmployee=""
              substituteSignatureUrl={null}
              substituteApproved={false}
              directManager=""
              directManagerSignatureUrl={null}
              managerApproved={false}
              headerOffset={headerOffset}
              letterheadUrl={letterheadUrl}
            />
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
