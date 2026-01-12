import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Paperclip,
  Loader2,
  Plus,
  Search,
  Download,
  Image,
  Video,
  FileText,
  File,
  Trash2,
  X,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDateTime } from "@/lib/utils";

interface Conversation {
  id: string;
  updated_at: string;
  participants: {
    user_id: string;
    full_name: string;
  }[];
  lastMessage?: {
    message: string | null;
    created_at: string;
    sender_name: string;
  };
  unreadCount: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
  sender_name?: string;
}

interface Employee {
  user_id: string;
  full_name: string;
  role?: string;
}

interface MessagingSectionProps {
  currentUserId: string;
  isAdmin: boolean;
}

export function MessagingSection({ currentUserId, isAdmin }: MessagingSectionProps) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // جلب المحادثات
  useEffect(() => {
    fetchConversations();

    // الاستماع للتغييرات
    const channel = supabase
      .channel("conversations-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchConversations();
          if (selectedConversation) {
            fetchMessages(selectedConversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const fetchConversations = async () => {
    try {
      // جلب المحادثات (مباشرة) مع الطرف الآخر عبر دالة آمنة في قاعدة البيانات
      const { data: convRows, error: convError } = await supabase.rpc(
        "get_conversations_for_user",
        { _user_id: currentUserId }
      );

      if (convError) throw convError;

      if (!convRows || convRows.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const baseConversations: Conversation[] = (convRows as any[]).map((row) => ({
        id: row.conversation_id,
        updated_at: row.updated_at,
        participants: [
          {
            user_id: row.other_user_id,
            full_name: row.other_full_name || "مستخدم",
          },
        ],
        unreadCount: 0,
      }));

      const conversationIds = baseConversations.map((c) => c.id);

      // جلب آخر رسالة لكل محادثة
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("conversation_id, message, created_at, sender_id")
        .in("conversation_id", conversationIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      // أسماء المرسلين (آخر رسالة)
      const senderIds = [...new Set((lastMessages || []).map((m) => m.sender_id))];
      const { data: sendersData } = await supabase
        .from("employees")
        .select("user_id, full_name")
        .in("user_id", senderIds);

      const senderNameMap = new Map(
        (sendersData || []).map((e) => [e.user_id, e.full_name])
      );

      const lastMessageMap = new Map<string, any>();
      (lastMessages || []).forEach((msg) => {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, {
            message: msg.message,
            created_at: msg.created_at,
            sender_name: senderNameMap.get(msg.sender_id) || "غير معروف",
          });
        }
      });

      // جلب آخر وقت قراءة للمستخدم الحالي
      const { data: myParticipations } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", currentUserId)
        .in("conversation_id", conversationIds);

      const lastReadMap = new Map(
        (myParticipations || []).map((p) => [p.conversation_id, p.last_read_at])
      );

      // تجميع البيانات
      const conversationsWithDetails: Conversation[] = baseConversations.map((conv) => {
        const lastRead = lastReadMap.get(conv.id);
        const lastMsg = lastMessageMap.get(conv.id);
        let unreadCount = 0;

        if (lastMsg && (!lastRead || new Date(lastMsg.created_at) > new Date(lastRead))) {
          const unreadMessages = (lastMessages || []).filter(
            (m) =>
              m.conversation_id === conv.id &&
              m.sender_id !== currentUserId &&
              (!lastRead || new Date(m.created_at) > new Date(lastRead))
          );
          unreadCount = unreadMessages.length;
        }

        return {
          ...conv,
          lastMessage: lastMsg,
          unreadCount,
        };
      });

      setConversations(conversationsWithDetails);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  // جلب الرسائل
  const fetchMessages = async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // جلب أسماء المرسلين
      const senderIds = [...new Set((data || []).map((m) => m.sender_id))];
      const { data: sendersData } = await supabase
        .from("employees")
        .select("user_id, full_name")
        .in("user_id", senderIds);

      const nameMap = new Map(
        (sendersData || []).map((e) => [e.user_id, e.full_name])
      );

      const messagesWithNames = (data || []).map((msg) => ({
        ...msg,
        sender_name: nameMap.get(msg.sender_id) || "مستخدم",
      }));

      setMessages(messagesWithNames);

      // تحديث last_read_at
      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", currentUserId);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setMessagesLoading(false);
    }
  };

  // جلب الموظفين للمحادثة الجديدة مع أدوارهم
  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("user_id, full_name")
        .neq("user_id", currentUserId)
        .order("full_name");

      if (error) throw error;

      // جلب أدوار المستخدمين
      const userIds = (data || []).map((e) => e.user_id).filter(Boolean);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const rolesMap = new Map(
        (rolesData || []).map((r) => [r.user_id, r.role])
      );

      const employeesWithRoles = (data || []).map((emp) => ({
        ...emp,
        role: rolesMap.get(emp.user_id) || "user",
      }));

      setEmployees(employeesWithRoles);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // التمرير للأسفل
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  // فتح محادثة
  const openConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    await fetchMessages(conv.id);
    // تحديث العداد محلياً
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  // إنشاء محادثة جديدة
  const createConversation = async () => {
    if (!selectedEmployee) return;

    try {
      // التحقق من وجود محادثة سابقة محلياً
      const existingConv = conversations.find((c) =>
        c.participants.some((p) => p.user_id === selectedEmployee)
      );

      if (existingConv) {
        setIsNewConversationOpen(false);
        openConversation(existingConv);
        return;
      }

      // إنشاء/إعادة استخدام محادثة مباشرة عبر دالة آمنة (تضيف المشاركين بدون مشاكل RLS)
      const { data: convId, error } = await supabase.rpc(
        "create_direct_conversation",
        { _other_user_id: selectedEmployee }
      );

      if (error) throw error;
      if (!convId) throw new Error("تعذر إنشاء المحادثة");

      const employee = employees.find((e) => e.user_id === selectedEmployee);

      setIsNewConversationOpen(false);
      setSelectedEmployee("");
      await fetchConversations();

      const conv: Conversation = {
        id: convId as any,
        updated_at: new Date().toISOString(),
        participants: [
          {
            user_id: selectedEmployee,
            full_name: employee?.full_name || "مستخدم",
          },
        ],
        unreadCount: 0,
      };

      setSelectedConversation(conv);
      setMessages([]);
      await fetchMessages(conv.id);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // إرسال رسالة
  const sendMessage = async (attachmentData?: { url: string; name: string; type: string }) => {
    if (!selectedConversation || (!newMessage.trim() && !attachmentData)) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation.id,
        sender_id: currentUserId,
        message: newMessage.trim() || null,
        attachment_url: attachmentData?.url || null,
        attachment_name: attachmentData?.name || null,
        attachment_type: attachmentData?.type || null,
      });

      if (error) throw error;

      // تحديث updated_at للمحادثة
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);

      setNewMessage("");
      await fetchMessages(selectedConversation.id);
      fetchConversations();
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

      let attachmentType = "document";
      if (file.type.startsWith("image/")) attachmentType = "image";
      else if (file.type.startsWith("video/")) attachmentType = "video";
      else if (file.type === "application/pdf") attachmentType = "pdf";

      await sendMessage({ url: publicUrl, name: file.name, type: attachmentType });
    } catch (error: any) {
      toast({ title: "خطأ في رفع الملف", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // أيقونة نوع الملف
  const getAttachmentIcon = (type: string | null) => {
    switch (type) {
      case "image": return <Image className="w-4 h-4" />;
      case "video": return <Video className="w-4 h-4" />;
      case "pdf": return <FileText className="w-4 h-4" />;
      default: return <File className="w-4 h-4" />;
    }
  };

  // فلترة المحادثات
  const filteredConversations = conversations.filter((c) =>
    c.participants.some((p) =>
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <Card className="overflow-visible">
      <CardHeader className="bg-gradient-to-l from-[#3d9aa8]/10 to-transparent border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center shadow-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            الرسائل
            {conversations.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
              <Badge className="bg-red-500 text-white">
                {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              fetchEmployees();
              setIsNewConversationOpen(true);
            }}
            className="gap-2 bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] hover:from-[#2d7a85] hover:to-[#1a5a63] shadow-lg"
          >
            <Plus className="w-4 h-4" />
            محادثة جديدة
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex h-[500px]">
          {/* قائمة المحادثات */}
          <div className="w-1/3 border-l bg-slate-50/50">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-white"
                />
              </div>
            </div>
            <ScrollArea className="h-[calc(500px-60px)]">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-[#3d9aa8]" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Users className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">لا توجد محادثات</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv)}
                      className={cn(
                        "w-full py-3 px-4 text-right hover:bg-[#3d9aa8]/5 transition-colors flex items-start gap-3",
                        selectedConversation?.id === conv.id && "bg-[#3d9aa8]/10"
                      )}
                      dir="rtl"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center text-white text-sm font-bold leading-none flex-shrink-0 ring-2 ring-background shadow-card">
                        {conv.participants[0]?.full_name?.[0] || "؟"}
                      </div>

                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="min-w-0 flex-1 font-medium text-sm truncate">
                            {conv.participants.map((p) => p.full_name).join(", ") || "محادثة"}
                          </span>

                          {conv.unreadCount > 0 && (
                            <Badge className="bg-red-500 text-white text-xs px-1.5 min-w-[20px] flex-shrink-0">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>

                        {conv.lastMessage && (
                          <p className="text-xs text-muted-foreground mt-1 truncate" dir="rtl">
                            {conv.lastMessage.message || "مرفق"}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* منطقة الرسائل */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Header المحادثة */}
                <div className="p-4 border-b bg-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center text-white font-bold">
                    {selectedConversation.participants[0]?.full_name?.[0] || "؟"}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {selectedConversation.participants.map((p) => p.full_name).join(", ")}
                    </h3>
                  </div>
                </div>

                {/* الرسائل */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-[#3d9aa8]" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <Send className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">ابدأ المحادثة</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg, index) => {
                        const isOwn = msg.sender_id === currentUserId;
                        const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-3",
                              isOwn ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            <div className={cn("flex-shrink-0", !showAvatar && "invisible")}>
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                isOwn
                                  ? "bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] text-white"
                                  : "bg-slate-200 text-slate-600"
                              )}>
                                {(msg.sender_name || "؟")[0]}
                              </div>
                            </div>
                            <div className={cn("flex flex-col gap-1 max-w-[70%]", isOwn ? "items-end" : "items-start")}>
                              {showAvatar && (
                                <span className="text-xs text-muted-foreground px-1">
                                  {msg.sender_name}
                                </span>
                              )}
                              <div
                                className={cn(
                                  "rounded-2xl p-3 shadow-sm",
                                  isOwn
                                    ? "bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] text-white rounded-tr-md"
                                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-md"
                                )}
                              >
                                {msg.attachment_url && (
                                  <div className="mb-2">
                                    {msg.attachment_type === "image" ? (
                                      <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={msg.attachment_url}
                                          alt={msg.attachment_name || "مرفق"}
                                          className="max-w-full max-h-48 rounded-lg"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={msg.attachment_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                          "flex items-center gap-2 p-2 rounded-lg",
                                          isOwn ? "bg-white/15" : "bg-slate-50"
                                        )}
                                      >
                                        {getAttachmentIcon(msg.attachment_type)}
                                        <span className="text-sm truncate">{msg.attachment_name}</span>
                                        <Download className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                )}
                                {msg.message && (
                                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                )}
                                <p className={cn(
                                  "text-[10px] mt-1",
                                  isOwn ? "text-white/60" : "text-muted-foreground"
                                )}>
                                  <span style={{ fontFamily: "Arial, sans-serif" }}>
                                    {formatDateTime(msg.created_at)}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* إدخال الرسالة */}
                <div className="p-3 border-t bg-white">
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-shrink-0 h-10 w-10 rounded-xl"
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
                      className="flex-1 h-10 rounded-xl"
                    />
                    <Button
                      onClick={() => sendMessage()}
                      disabled={sending || !newMessage.trim()}
                      className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85]"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3d9aa8]/20 to-[#3d9aa8]/5 flex items-center justify-center mb-4">
                  <MessageSquare className="w-10 h-10 text-[#3d9aa8]" />
                </div>
                <p className="font-medium">اختر محادثة للبدء</p>
                <p className="text-sm mt-1">أو أنشئ محادثة جديدة</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* نافذة محادثة جديدة */}
      <Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {/* Header مع زر الإغلاق */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-l from-[#3d9aa8]/10 to-transparent">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              محادثة جديدة
            </DialogTitle>
            <DialogDescription className="sr-only">
              اختر الشخص الذي تريد مراسلته ثم اضغط زر بدء المحادثة.
            </DialogDescription>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewConversationOpen(false)}
              className="h-8 w-8 rounded-full hover:bg-red-100 hover:text-red-600"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* محتوى الحوار */}
          <div className="p-4 space-y-4">
            <label className="text-sm font-medium text-muted-foreground">اختر الشخص للمحادثة</label>
            
            {/* قائمة الموظفين */}
            <ScrollArea className="h-[300px] border rounded-xl">
              <div className="p-2 space-y-1">
                {employees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>لا يوجد موظفين متاحين</p>
                  </div>
                ) : (
                  employees.map((emp) => {
                    const isSelected = selectedEmployee === emp.user_id;
                    const roleLabel = emp.role === "admin" ? "مدير النظام" : 
                                     emp.role === "moderator" ? "مشرف" : 
                                     emp.role === "time_editor" ? "محرر الوقت" : "موظف";
                    const roleColor = emp.role === "admin" ? "bg-red-100 text-red-700" :
                                     emp.role === "moderator" ? "bg-blue-100 text-blue-700" :
                                     emp.role === "time_editor" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";

                    return (
                      <button
                        key={emp.user_id}
                        onClick={() => setSelectedEmployee(emp.user_id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right",
                          isSelected
                            ? "bg-gradient-to-l from-[#3d9aa8]/20 to-[#3d9aa8]/5 border-2 border-[#3d9aa8]"
                            : "hover:bg-slate-50 border-2 border-transparent"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
                          isSelected 
                            ? "bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] text-white"
                            : "bg-slate-200 text-slate-600"
                        )}>
                          {emp.full_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            "font-medium",
                            isSelected ? "text-[#3d9aa8]" : "text-foreground"
                          )}>
                            {emp.full_name}
                          </p>
                          <Badge className={cn("text-xs mt-1", roleColor)}>
                            {roleLabel}
                          </Badge>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#3d9aa8] flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* زر بدء المحادثة */}
            <Button
              onClick={createConversation}
              disabled={!selectedEmployee}
              className="w-full h-12 text-base bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] hover:from-[#2d7a85] hover:to-[#1a5a63] rounded-xl shadow-lg"
            >
              <MessageSquare className="w-5 h-5 ml-2" />
              بدء المحادثة
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
