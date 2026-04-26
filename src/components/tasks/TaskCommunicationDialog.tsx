import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Paperclip,
  Image,
  FileText,
  Video,
  File,
  Loader2,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDateTime } from "@/lib/utils";

interface TaskMessage {
  id: string;
  task_id: string;
  user_id: string;
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
  sender_name?: string;
  is_admin?: boolean;
}

interface AdminUser {
  user_id: string;
  full_name: string;
}

interface TaskCommunicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  currentUserId: string;
  isAdmin: boolean;
  taskOwnerId: string;
}

export function TaskCommunicationDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  currentUserId,
  isAdmin,
  taskOwnerId,
}: TaskCommunicationDialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // جلب قائمة المدراء للموظفين
  useEffect(() => {
    if (!open || isAdmin) return;

    const fetchAdmins = async () => {
      try {
        // جلب المستخدمين الذين لديهم صلاحية admin
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (adminRoles && adminRoles.length > 0) {
          const adminIds = adminRoles.map((r) => r.user_id);

          // محاولة جلب أسماء المدراء من سجل الموظفين (قد لا يوجد سجل للمدير)
          const { data: adminEmployees } = await supabase
            .from("employees")
            .select("user_id, full_name")
            .in("user_id", adminIds);

          const nameById = new Map(
            (adminEmployees || []).map((e) => [e.user_id, e.full_name] as const)
          );

          const recipients: AdminUser[] = adminIds.map((id, idx) => ({
            user_id: id,
            full_name:
              nameById.get(id) ||
              (adminIds.length > 1 ? `مدير النظام (${idx + 1})` : "مدير النظام"),
          }));

          setAdmins(recipients);

          // اختيار أول مدير افتراضياً
          if (recipients.length > 0) {
            setSelectedRecipient((prev) => prev || recipients[0].user_id);
          }
        } else {
          setAdmins([]);
          setSelectedRecipient("");
        }
      } catch (error) {
        console.error("Error fetching admins:", error);
      }
    };

    fetchAdmins();
  }, [open, isAdmin]);

  // جلب الرسائل
  useEffect(() => {
    if (!open || !taskId) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        // جلب الرسائل
        const { data: messagesData, error } = await supabase
          .from("task_messages")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        // جلب أسماء المرسلين من جدول الموظفين
        const userIds = [...new Set((messagesData || []).map(m => m.user_id))];
        const { data: employeesData } = await supabase
          .from("employees")
          .select("user_id, full_name")
          .in("user_id", userIds);

        // جلب المستخدمين المدراء
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        
        const adminUserIds = new Set((adminRoles || []).map(r => r.user_id));

        // دمج أسماء المرسلين مع الرسائل
        const messagesWithNames = (messagesData || []).map(msg => {
          const employee = employeesData?.find(e => e.user_id === msg.user_id);
          const isAdmin = adminUserIds.has(msg.user_id);
          return {
            ...msg,
            sender_name: employee?.full_name || "مدير النظام",
            is_admin: isAdmin
          };
        });

        setMessages(messagesWithNames);
        
        // تحديد إشعارات رسائل المهمة كمقروءة
        // ملاحظة: إشعارات رسائل المهام تُحفظ حالياً بنوع (message) مع related_task_id
        const { error: markReadError } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", currentUserId)
          .eq("related_task_id", taskId)
          .eq("type", "message")
          .eq("is_read", false);

        if (markReadError) {
          console.error("Error marking task message notifications as read:", markReadError);
        }
      } catch (error: any) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // الاستماع للرسائل الجديدة في الوقت الفعلي
    const channel = supabase
      .channel(`task-messages-${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_messages",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as TaskMessage]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "task_messages",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, taskId]);

  // هل هذه أول رسالة من الموظف؟
  const isFirstEmployeeMessage = !isAdmin && messages.length === 0;

  // التمرير للأسفل عند وصول رسائل جديدة
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // إرسال رسالة
  const sendMessage = async (attachmentData?: { url: string; name: string; type: string }) => {
    if (!newMessage.trim() && !attachmentData) return;

    setSending(true);
    try {
      const { error } = await supabase.from("task_messages").insert({
        task_id: taskId,
        user_id: currentUserId,
        message: newMessage.trim() || null,
        attachment_url: attachmentData?.url || null,
        attachment_name: attachmentData?.name || null,
        attachment_type: attachmentData?.type || null,
      });

      if (error) throw error;

      // إرسال إشعار (عن طريق وظيفة خلفية لأن الموظف لا يملك صلاحية إنشاء إشعارات مباشرة)
      const recipientId = isAdmin ? taskOwnerId : selectedRecipient;
      if (recipientId && recipientId !== currentUserId) {
        const { data, error: notifyError } = await supabase.functions.invoke(
          "notify-task-message",
          {
            body: {
              taskId,
              recipientId,
              taskTitle,
            },
          }
        );

        if (notifyError || data?.success === false) {
          console.error("Notify error:", notifyError || data);
          // لا نمنع إرسال الرسالة، فقط تنبيه خفيف
          toast({
            title: "تنبيه",
            description: "تم إرسال الرسالة لكن لم يتم إرسال الإشعار",
            variant: "destructive",
          });
        }
      }

      setNewMessage("");
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // رفع ملف
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // التحقق من حجم الملف (20 ميجا)
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "خطأ", description: "حجم الملف يتجاوز 20 ميجابايت", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("task-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("task-attachments")
        .getPublicUrl(fileName);

      // تحديد نوع الملف
      let attachmentType = "document";
      if (file.type.startsWith("image/")) attachmentType = "image";
      else if (file.type.startsWith("video/")) attachmentType = "video";
      else if (file.type === "application/pdf") attachmentType = "pdf";

      await sendMessage({
        url: publicUrl,
        name: file.name,
        type: attachmentType,
      });

      toast({ title: "تم رفع الملف بنجاح" });
    } catch (error: any) {
      toast({ title: "خطأ في رفع الملف", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // حذف رسالة
  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("task_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
      toast({ title: "تم حذف الرسالة" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // الحصول على أيقونة نوع الملف
  const getAttachmentIcon = (type: string | null) => {
    switch (type) {
      case "image":
        return <Image className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "pdf":
        return <FileText className="w-4 h-4" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  // إرسال رد سريع (مناسب/غير مناسب)
  const sendQuickReply = async (approved: boolean) => {
    const message = approved ? "✅ تمت الموافقة - المرفق مناسب" : "❌ غير مناسب - يرجى التعديل";
    setNewMessage(message);
    setTimeout(() => sendMessage(), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 [&>button]:hidden overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        {/* Header مودرن */}
        <DialogHeader className="p-5 border-b bg-gradient-to-l from-[hsl(var(--primary)/<alpha-value>)] via-[hsl(var(--primary)/<alpha-value>)]/90 to-[hsl(var(--primary)/<alpha-value>)] relative">
          <DialogClose className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-all backdrop-blur-sm">
            <X className="h-5 w-5" />
            <span className="sr-only">إغلاق</span>
          </DialogClose>
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Paperclip className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold">التواصل والمرفقات</span>
              <span className="text-xs text-white/80 font-normal truncate max-w-[300px]">{taskTitle}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* اختيار المستلم للموظف */}
        {!isAdmin && admins.length > 0 && (
          <div className="px-5 py-4 border-b bg-gradient-to-l from-[hsl(var(--primary)/<alpha-value>)]/5 to-transparent">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--primary)/<alpha-value>)] font-medium">
                <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary)/<alpha-value>)]/10 flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-[hsl(var(--primary)/<alpha-value>)]" />
                </div>
                <span>إرسال إلى:</span>
              </div>
              <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                <SelectTrigger className="w-[200px] bg-white border-[hsl(var(--primary)/<alpha-value>)]/20 shadow-sm hover:border-[hsl(var(--primary)/<alpha-value>)]/40 transition-colors">
                  <SelectValue placeholder="اختر المستلم" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 shadow-xl border-[hsl(var(--primary)/<alpha-value>)]/20">
                  {admins.map((admin) => (
                    <SelectItem key={admin.user_id} value={admin.user_id} className="hover:bg-[hsl(var(--primary)/<alpha-value>)]/10">
                      {admin.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* منطقة الرسائل */}
        <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--primary)/<alpha-value>)]/10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary)/<alpha-value>)]" />
              </div>
              <span className="text-sm text-muted-foreground">جاري تحميل الرسائل...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary)/<alpha-value>)]/20 to-[hsl(var(--primary)/<alpha-value>)]/5 flex items-center justify-center">
                <Send className="w-7 h-7 text-[hsl(var(--primary)/<alpha-value>)]" />
              </div>
              <div>
                <p className="text-muted-foreground font-medium">لا توجد رسائل بعد</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {isAdmin ? "ابدأ المحادثة مع الموظف" : "اختر المستلم وابدأ المحادثة"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg, index) => {
                const isOwn = msg.user_id === currentUserId;
                const isFromAdmin = msg.user_id !== taskOwnerId;
                const showAvatar = index === 0 || messages[index - 1].user_id !== msg.user_id;
                
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3 animate-fade-in",
                      isOwn ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* الصورة الرمزية */}
                    <div className={cn("flex-shrink-0", !showAvatar && "invisible")}>
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-md",
                        isOwn 
                          ? "bg-gradient-to-br from-[hsl(var(--primary)/<alpha-value>)] to-[hsl(var(--primary)/<alpha-value>)] text-white"
                          : isFromAdmin 
                            ? "bg-gradient-to-br from-[hsl(var(--primary)/<alpha-value>)] to-[#1a5a63] text-white"
                            : "bg-gradient-to-br from-slate-400 to-slate-500 text-white"
                      )}>
                        {(msg.sender_name || "؟")[0]}
                      </div>
                    </div>

                    {/* محتوى الرسالة */}
                    <div className={cn("flex flex-col gap-1 max-w-[75%]", isOwn ? "items-end" : "items-start")}>
                      {/* اسم المرسل */}
                      {showAvatar && (
                        <div className={cn(
                          "flex items-center gap-2 px-1",
                          isOwn ? "flex-row-reverse" : "flex-row"
                        )}>
                          <span className={cn(
                            "text-xs font-semibold",
                            isOwn ? "text-[hsl(var(--primary)/<alpha-value>)]" : isFromAdmin ? "text-[hsl(var(--primary)/<alpha-value>)]" : "text-slate-600"
                          )}>
                            {msg.sender_name || "غير معروف"}
                          </span>
                          {msg.is_admin && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[hsl(var(--primary)/<alpha-value>)]/10 text-[hsl(var(--primary)/<alpha-value>)] border-0">
                              مدير النظام
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* فقاعة الرسالة */}
                      <div
                        className={cn(
                          "relative group rounded-2xl p-4 shadow-sm transition-all hover:shadow-md",
                          isOwn
                            ? "bg-gradient-to-br from-[hsl(var(--primary)/<alpha-value>)] to-[hsl(var(--primary)/<alpha-value>)] text-white rounded-tr-md"
                            : isFromAdmin
                              ? "bg-white border border-[hsl(var(--primary)/<alpha-value>)]/20 text-slate-800 rounded-tl-md shadow-[0_2px_8px_rgba(61,154,168,0.08)]"
                              : "bg-white border border-slate-200 text-slate-800 rounded-tl-md"
                        )}
                      >
                        {/* زر الحذف */}
                        {(isAdmin || isOwn) && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className={cn(
                              "absolute -top-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600 hover:scale-110",
                              isOwn ? "-left-2" : "-right-2"
                            )}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* المرفق */}
                        {msg.attachment_url && (
                          <div className="mb-3">
                            {msg.attachment_type === "image" ? (
                              <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block">
                                <img
                                  src={msg.attachment_url}
                                  alt={msg.attachment_name || "مرفق"}
                                  className="max-w-full max-h-52 rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                                />
                              </a>
                            ) : msg.attachment_type === "video" ? (
                              <video
                                src={msg.attachment_url}
                                controls
                                className="max-w-full max-h-52 rounded-xl shadow-sm"
                              />
                            ) : (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl transition-colors",
                                  isOwn 
                                    ? "bg-white/15 hover:bg-white/25" 
                                    : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                                )}
                              >
                                <div className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center",
                                  isOwn ? "bg-white/20" : "bg-[hsl(var(--primary)/<alpha-value>)]/10"
                                )}>
                                  {getAttachmentIcon(msg.attachment_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium truncate block">{msg.attachment_name}</span>
                                  <span className={cn("text-xs", isOwn ? "text-white/60" : "text-muted-foreground")}>
                                    انقر للتحميل
                                  </span>
                                </div>
                                <Download className="w-5 h-5 flex-shrink-0 opacity-60" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* نص الرسالة */}
                        {msg.message && (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        )}

                        {/* الوقت */}
                        <p className={cn(
                          "text-[11px] mt-2 flex items-center gap-1",
                          isOwn ? "text-white/60" : "text-muted-foreground"
                        )}>
                          <span style={{ fontFamily: 'Arial, sans-serif' }}>{formatDateTime(msg.created_at)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* أزرار الرد السريع للمدير */}
        {isAdmin && (
          <div className="px-5 py-3 border-t bg-gradient-to-l from-slate-50 to-white flex gap-3">
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 shadow-sm"
              onClick={() => sendQuickReply(true)}
            >
              <CheckCircle className="w-4 h-4" />
              مناسب
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 shadow-sm"
              onClick={() => sendQuickReply(false)}
            >
              <XCircle className="w-4 h-4" />
              غير مناسب
            </Button>
          </div>
        )}

        {/* إدخال الرسالة */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-3 items-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-shrink-0 h-11 w-11 rounded-xl border-slate-200 hover:border-[hsl(var(--primary)/<alpha-value>)] hover:bg-[hsl(var(--primary)/<alpha-value>)]/5 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--primary)/<alpha-value>)]" />
              ) : (
                <Paperclip className="w-5 h-5 text-slate-500" />
              )}
            </Button>
            <div className="flex-1 relative">
              <Input
                placeholder="اكتب رسالتك هنا..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="h-11 rounded-xl border-slate-200 focus:border-[hsl(var(--primary)/<alpha-value>)] focus:ring-[hsl(var(--primary)/<alpha-value>)]/20 pr-4 pl-4 text-sm"
              />
            </div>
            <Button
              onClick={() => sendMessage()}
              disabled={sending || (!newMessage.trim())}
              className="flex-shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-[hsl(var(--primary)/<alpha-value>)] to-[hsl(var(--primary)/<alpha-value>)] hover:from-[hsl(var(--primary)/<alpha-value>)] hover:to-[#1a5a63] shadow-lg shadow-[hsl(var(--primary)/<alpha-value>)]/25 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}