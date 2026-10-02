import { fetchAllReportRows } from "@/lib/fetchAllReportRows";
import { ReportDataState } from "@/components/admin/ReportDataState";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ListChecks, Loader2, Sparkles, Plus, Calendar, Users, ArrowLeftCircle, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";

interface OrgRow { id: string; name: string; slug?: string | null; }
interface PlanRow {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  created_at: string;
  org_name?: string;
  tasks_count?: number;
  tasks_done?: number;
}

export default function AdminActionPlans({ orgIdProp }: { orgIdProp?: string } = {}) {
  const navigate = useNavigate();
  const { slug } = useParams();
  const location = useLocation();
  const organizationView = !location.pathname.startsWith("/admin/");
  const planPath = (id: string) => organizationView
    ? `${slug ? `/${slug}` : ""}/action-plans/${id}` : `/admin/action-plans/${id}`;
  const _params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEmbedded = !!orgIdProp || _params.get("embedded") === "1";
  const lockedSlug = slug || _params.get("org") || "";
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const generationLock = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [duration, setDuration] = useState<number>(30);
  const [planTitle, setPlanTitle] = useState("");
  const [generating, setGenerating] = useState(false);

  // Auto-select the locked org in embedded mode
  useEffect(() => {
    if (isEmbedded && orgs.length === 1 && selectedOrg !== orgs[0].id) {
      setSelectedOrg(orgs[0].id);
    }
  }, [isEmbedded, orgs, selectedOrg]);

  const fetchAll = async () => {
    const version = ++loadVersion.current;
    setLoading(true); setLoadError(null);
    try {
      let orgQuery = supabase.from("organizations").select("id, name, slug").order("name").order("id");
      if (orgIdProp) orgQuery = orgQuery.eq("id", orgIdProp);
      if (isEmbedded && lockedSlug) orgQuery = orgQuery.eq("slug", lockedSlug);
      const orgList = await fetchAllReportRows(orgQuery);
      const ids = orgList.map(o => o.id);
      // Fetch compact counts in one paginated pass instead of two requests per plan.
      const [planRows, taskRows] = ids.length ? await Promise.all([
        fetchAllReportRows(supabase.from("action_plans").select("*, organizations(name)").in("organization_id", ids).order("created_at", { ascending: false }).order("id")),
        fetchAllReportRows(supabase.from("action_plan_tasks").select("id, action_plan_id, status").in("organization_id", ids).order("id")),
      ]) : [[], []];
      const counts = new Map<string, { total: number; done: number }>();
      for (const task of taskRows) {
        const count = counts.get(task.action_plan_id) || { total: 0, done: 0 };
        count.total++; if (task.status === "completed") count.done++;
        counts.set(task.action_plan_id, count);
      }
      if (version !== loadVersion.current) return;
      setOrgs(orgList);
      setPlans(planRows.map(p => ({ ...p, org_name: p.organizations?.name,
        tasks_count: counts.get(p.id)?.total || 0, tasks_done: counts.get(p.id)?.done || 0 })));
    } catch {
      if (version === loadVersion.current) { setPlans([]); setOrgs([]); setLoadError("تعذّر تحميل الخطط. أعد المحاولة."); }
    } finally { if (version === loadVersion.current) setLoading(false); }
  };
  useEffect(() => { void fetchAll(); return () => { loadVersion.current++; }; }, [isEmbedded, lockedSlug, orgIdProp]);

  const handleGenerate = async () => {
    if (generationLock.current) return;
    if (!selectedOrg || !orgs.some(o => o.id === selectedOrg)) { toast.error("اختر جمعية"); return; }
    if (!Number.isInteger(duration) || duration < 7 || duration > 365) { toast.error("مدة الخطة من 7 إلى 365 يوماً"); return; }
    generationLock.current = true;
    setGenerating(true);
    try {
      // Use direct fetch so we can read the JSON body even on non-2xx responses
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("انتهت الجلسة. سجّل الدخول مجدداً.");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/generate-action-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            organization_id: selectedOrg,
            duration_days: duration,
            plan_title: planTitle || undefined,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(
          data?.error ||
            "لم يتم توليد تحليل ذكي بعد لهذه الجمعية. شغّل التحليل الذكي أولاً ثم أعد المحاولة."
        );
      }
      toast.success(`تم توليد خطة من ${data.tasks_count} مهمة`);
      setDialogOpen(false);
      setPlanTitle("");
      await fetchAll();
      if (data?.plan_id) navigate(planPath(data.plan_id));
    } catch (e: any) {
      toast.error(e.message || "تعذّر توليد الخطة. تأكد من وجود تحليل ذكي مسبق لهذه الجمعية.");
    } finally {
      generationLock.current = false;
      setGenerating(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, PlanRow[]>();
    plans.forEach(p => {
      const arr = map.get(p.organization_id) || [];
      arr.push(p);
      map.set(p.organization_id, arr);
    });
    return map;
  }, [plans]);

  return (
    <div className={`${isEmbedded ? "" : "mx-auto max-w-[1280px] p-6"} w-full space-y-6`}>
      <PageHeader
        icon={<ListChecks className="w-6 h-6" />}
        title="الخطط من التوصيات"
        subtitle="حوّل توصيات التحليل الذكي إلى خطة عمل مزمنة، مكلَّفة، وقابلة للمتابعة"
        actions={
          <Button onClick={() => setDialogOpen(true)} disabled={loading || !!loadError || !orgs.length} className="gap-2 bg-white text-primary hover:bg-white/90">
            <Sparkles className="w-4 h-4" />
            توليد خطة جديدة من آخر تحليل
          </Button>
        }
      />

      {loadError ? (
        <ReportDataState error={loadError} retry={fetchAll} />
      ) : loading ? (
        <Card className="p-12 text-center bg-card border-border text-muted-foreground">جاري التحميل...</Card>
      ) : plans.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border">
          <ListChecks className="w-14 h-14 mx-auto text-muted-foreground mb-3" />
          <p className="text-foreground font-bold mb-1">لا توجد خطط بعد</p>
          <p className="text-muted-foreground text-sm mb-4">
            ابدأ بتشغيل "تحليل ذكي بالـ AI" في صفحة التحليل الذكي، ثم ولّد خطة منه هنا.
          </p>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> توليد خطة
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([orgId, orgPlans]) => {
            const orgName = orgPlans[0].org_name || "—";
            return (
              <div key={orgId} className="space-y-3">
                <div className="flex items-center gap-2 text-foreground">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">{orgName}</h2>
                  <Badge variant="secondary">{orgPlans.length} خطة</Badge>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orgPlans.map(p => (
                    <Card
                      key={p.id}
                      className="bg-card border-border p-5 shadow-sm hover:shadow-md transition cursor-pointer"
                      onClick={() => navigate(planPath(p.id))}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-foreground line-clamp-2">{p.title}</h3>
                        <Badge
                          variant={p.status === "active" ? "default" : "secondary"}
                          className={p.status === "active" ? "bg-accent text-accent-foreground hover:bg-accent/90 border-transparent" : ""}
                        >
                          {p.status === "active" ? "نشطة" : p.status === "completed" ? "منجزة" : p.status}
                        </Badge>
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                          {p.start_date} → {p.end_date}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">التقدّم</span>
                          <span className="font-bold text-foreground">{p.tasks_done}/{p.tasks_count}</span>
                        </div>
                        <Progress value={p.tasks_count ? (p.tasks_done! / p.tasks_count!) * 100 : 0} />
                      </div>
                      <Button variant="ghost" size="sm" className="w-full mt-3 gap-1 text-accent hover:text-accent">
                        فتح الخطة <ArrowLeftCircle className="w-3.5 h-3.5" />
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={open => { if (!generating) setDialogOpen(open); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              توليد خطة من التحليل الذكي
            </DialogTitle>
            <DialogDescription>
              سيتم تحويل توصيات آخر تحليل ذكي إلى مهام، مع اقتراح موظف لكل مهمة بناءً على القسم والدور.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>الجمعية</Label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg} disabled={generating}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>
                  {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عنوان الخطة (اختياري)</Label>
              <Input disabled={generating} value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="مثلاً: خطة Q2 لتطوير التبرعات" />
            </div>
            <div className="space-y-2">
              <Label>المدة (أيام)</Label>
              <Input disabled={generating} type="number" min={7} max={365} value={duration}
                onChange={e => setDuration(Math.max(7, Math.min(365, Number(e.target.value) || 30)))} />
              <p className="text-xs text-muted-foreground">تُوزَّع المهام تلقائيًا على المدة (الأعلى تأثيرًا أولًا).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={generating}>إلغاء</Button>
            <Button onClick={handleGenerate} disabled={generating || !selectedOrg} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              توليد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
