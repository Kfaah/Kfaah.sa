import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TaskMessage {
  id: string;
  task_id: string;
  user_id: string;
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // جلب الرسائل
  useEffect(() => {
    if (!open || !taskId) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("task_messages")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setMessages(data || []);
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

      // إرسال إشعار
      const recipientId = isAdmin ? taskOwnerId : null;
      if (recipientId && recipientId !== currentUserId) {
        await supabase.from("notifications").insert({
          user_id: recipientId,
          title: "رسالة جديدة",
          message: `لديك رسالة جديدة في مهمة "${taskTitle}"`,
          type: "message",
          related_task_id: taskId,
        });
      }

      // إشعار للمدير إذا كان المرسل موظف
      if (!isAdmin) {
        // نحتاج جلب المدراء وإرسال إشعار لهم
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        
        if (admins) {
          for (const admin of admins) {
            if (admin.user_id !== currentUserId) {
              await supabase.from("notifications").insert({
                user_id: admin.user_id,
                title: "رسالة جديدة من موظف",
                message: `لديك رسالة جديدة في مهمة "${taskTitle}"`,
                type: "message",
                related_task_id: taskId,
              });
            }
          }
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
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b bg-gradient-to-l from-[#3d9aa8]/10 to-transparent">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#3d9aa8] flex items-center justify-center">
              <Paperclip className="w-4 h-4 text-white" />
            </div>
            التواصل والمرفقات - {taskTitle}
          </DialogTitle>
        </DialogHeader>

        {/* منطقة الرسائل */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-[#3d9aa8]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              لا توجد رسائل بعد. ابدأ المحادثة!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isOwn = msg.user_id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      isOwn ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg p-3 relative group",
                        isOwn
                          ? "bg-[#3d9aa8] text-white"
                          : "bg-muted"
                      )}
                    >
                      {/* زر الحذف */}
                      {isOwn && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* المرفق */}
                      {msg.attachment_url && (
                        <div className="mb-2">
                          {msg.attachment_type === "image" ? (
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={msg.attachment_url}
                                alt={msg.attachment_name || "مرفق"}
                                className="max-w-full max-h-48 rounded-lg cursor-pointer hover:opacity-90"
                              />
                            </a>
                          ) : msg.attachment_type === "video" ? (
                            <video
                              src={msg.attachment_url}
                              controls
                              className="max-w-full max-h-48 rounded-lg"
                            />
                          ) : (
                            <a
                              href={msg.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg",
                                isOwn ? "bg-white/20" : "bg-background"
                              )}
                            >
                              {getAttachmentIcon(msg.attachment_type)}
                              <span className="text-sm truncate">{msg.attachment_name}</span>
                              <Download className="w-4 h-4 flex-shrink-0" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* نص الرسالة */}
                      {msg.message && (
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      )}

                      {/* الوقت */}
                      <p
                        className={cn(
                          "text-xs mt-1",
                          isOwn ? "text-white/70" : "text-muted-foreground"
                        )}
                      >
                        {new Date(msg.created_at).toLocaleString("ar-SA")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* أزرار الرد السريع للمدير */}
        {isAdmin && (
          <div className="px-4 py-2 border-t flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              onClick={() => sendQuickReply(true)}
            >
              <CheckCircle className="w-4 h-4" />
              مناسب
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => sendQuickReply(false)}
            >
              <XCircle className="w-4 h-4" />
              غير مناسب
            </Button>
          </div>
        )}

        {/* إدخال الرسالة */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2">
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
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </Button>
            <Input
              placeholder="اكتب رسالتك..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={sending || (!newMessage.trim())}
              className="bg-[#3d9aa8] hover:bg-[#3d9aa8]/90"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}