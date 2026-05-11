import { Badge } from "@/components/ui/badge";
import { FileText, Phone, MessageSquare, Mail, MapPin, Gift, Video, FileImage, Award } from "lucide-react";

/** Aggregated counts of completed actions per donor/campaign target */
export interface ActionCounts {
  letter?: number;
  call?: number;
  whatsapp?: number;
  sms?: number;
  email?: number;
  visit?: number;
  gift?: number;
  video?: number;
  pdf?: number;
  design?: number;
  thank_you?: number;
  report?: number;
  other?: number;
}

const SPECS: { key: keyof ActionCounts; label: string; icon: any; color: string }[] = [
  { key: "letter", label: "خطاب", icon: FileText, color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "thank_you", label: "شكر", icon: Award, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "report", label: "تقرير", icon: FileText, color: "bg-violet-50 text-violet-700 border-violet-200" },
  { key: "call", label: "اتصال", icon: Phone, color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "whatsapp", label: "واتساب", icon: MessageSquare, color: "bg-green-50 text-green-700 border-green-200" },
  { key: "sms", label: "SMS", icon: MessageSquare, color: "bg-sky-50 text-sky-700 border-sky-200" },
  { key: "email", label: "إيميل", icon: Mail, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "visit", label: "زيارة", icon: MapPin, color: "bg-rose-50 text-rose-700 border-rose-200" },
  { key: "gift", label: "إهداء", icon: Gift, color: "bg-pink-50 text-pink-700 border-pink-200" },
  { key: "video", label: "فيديو", icon: Video, color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  { key: "pdf", label: "PDF", icon: FileText, color: "bg-orange-50 text-orange-700 border-orange-200" },
  { key: "design", label: "تصميم", icon: FileImage, color: "bg-teal-50 text-teal-700 border-teal-200" },
];

export function DonorActionsCell({ counts }: { counts?: ActionCounts }) {
  if (!counts) return <span className="text-xs text-muted-foreground">—</span>;
  const items = SPECS.filter((s) => (counts[s.key] || 0) > 0);
  if (!items.length) return <span className="text-xs text-muted-foreground">لم تُنفَّذ إجراءات</span>;
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {items.map((s) => {
        const Icon = s.icon;
        return (
          <Badge key={s.key} variant="outline" className={`${s.color} gap-1 font-normal`}>
            <Icon className="h-3 w-3" />
            {s.label}
            <span className="font-bold">{counts[s.key]}</span>
          </Badge>
        );
      })}
    </div>
  );
}

/** Build counts map from raw tasks list, key = donor_id or campaign_id */
export function buildActionsIndex(
  tasks: Array<{ status?: string | null; metadata?: any; category?: string | null; title?: string | null }>,
  keyField: "donor_id" | "campaign_id" | "donor_phone" | "donor_name",
): Map<string, ActionCounts> {
  const idx = new Map<string, ActionCounts>();
  for (const t of tasks) {
    if (t.status !== "completed" && t.status !== "executed") continue;
    const m = (t.metadata || {}) as any;
    const key = m[keyField];
    if (!key) continue;
    const bucket = idx.get(String(key)) || {};
    const ch = (m.channel || "").toLowerCase();
    const cat = (t.category || "").toLowerCase();
    const title = (t.title || "").toLowerCase();
    const inc = (k: keyof ActionCounts) => { bucket[k] = (bucket[k] || 0) + 1; };

    if (ch === "letter") inc("letter");
    else if (ch === "call") inc("call");
    else if (ch === "whatsapp") inc("whatsapp");
    else if (ch === "sms") inc("sms");
    else if (ch === "email") inc("email");
    else if (ch === "visit") inc("visit");
    else if (ch === "thank_you") inc("thank_you");

    if (title.includes("شكر") || cat.includes("شكر")) inc("thank_you");
    if (title.includes("تقرير") || cat.includes("تقرير")) inc("report");
    if (title.includes("إهداء") || title.includes("هدية")) inc("gift");
    if (title.includes("فيديو")) inc("video");
    if (title.includes("pdf")) inc("pdf");
    if (title.includes("تصميم") || title.includes("بروشور")) inc("design");

    idx.set(String(key), bucket);
  }
  return idx;
}