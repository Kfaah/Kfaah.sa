import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Image, 
  MessageSquareQuote, 
  Plus, 
  Trash2, 
  Upload,
  Loader2,
  Settings2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Background {
  id: string;
  image_url: string;
  name: string | null;
  is_active: boolean;
  display_order: number;
}

interface Quote {
  id: string;
  quote: string;
  emoji: string;
  is_active: boolean;
  display_order: number;
}

export function WelcomeContentManager() {
  const [open, setOpen] = useState(false);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // New quote form
  const [newQuote, setNewQuote] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bgResult, quoteResult] = await Promise.all([
        supabase
          .from("welcome_backgrounds")
          .select("*")
          .order("display_order", { ascending: true }),
        supabase
          .from("welcome_quotes")
          .select("*")
          .order("display_order", { ascending: true }),
      ]);

      if (bgResult.data) setBackgrounds(bgResult.data);
      if (quoteResult.data) setQuotes(quoteResult.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("welcome-backgrounds")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("welcome-backgrounds")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("welcome_backgrounds")
        .insert({
          image_url: publicUrl,
          name: file.name,
          display_order: backgrounds.length,
        });

      if (insertError) throw insertError;

      toast.success("تم رفع الخلفية بنجاح");
      fetchData();
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("حدث خطأ أثناء رفع الخلفية");
    } finally {
      setUploading(false);
    }
  };

  const toggleBackgroundActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("welcome_backgrounds")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      
      setBackgrounds(prev => 
        prev.map(bg => bg.id === id ? { ...bg, is_active: !isActive } : bg)
      );
      toast.success(isActive ? "تم إلغاء تفعيل الخلفية" : "تم تفعيل الخلفية");
    } catch (error) {
      toast.error("حدث خطأ");
    }
  };

  const deleteBackground = async (id: string, imageUrl: string) => {
    try {
      // Extract file name from URL
      const fileName = imageUrl.split("/").pop();
      
      if (fileName) {
        await supabase.storage
          .from("welcome-backgrounds")
          .remove([fileName]);
      }

      const { error } = await supabase
        .from("welcome_backgrounds")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setBackgrounds(prev => prev.filter(bg => bg.id !== id));
      toast.success("تم حذف الخلفية");
    } catch (error) {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const addQuote = async () => {
    if (!newQuote.trim()) {
      toast.error("يرجى إدخال العبارة");
      return;
    }

    try {
      const { error } = await supabase
        .from("welcome_quotes")
        .insert({
          quote: newQuote.trim(),
          emoji: newEmoji || "✨",
          display_order: quotes.length,
        });

      if (error) throw error;

      toast.success("تم إضافة العبارة بنجاح");
      setNewQuote("");
      setNewEmoji("✨");
      fetchData();
    } catch (error) {
      toast.error("حدث خطأ أثناء الإضافة");
    }
  };

  const toggleQuoteActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("welcome_quotes")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      
      setQuotes(prev => 
        prev.map(q => q.id === id ? { ...q, is_active: !isActive } : q)
      );
      toast.success(isActive ? "تم إلغاء تفعيل العبارة" : "تم تفعيل العبارة");
    } catch (error) {
      toast.error("حدث خطأ");
    }
  };

  const deleteQuote = async (id: string) => {
    try {
      const { error } = await supabase
        .from("welcome_quotes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setQuotes(prev => prev.filter(q => q.id !== id));
      toast.success("تم حذف العبارة");
    } catch (error) {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" />
          إدارة شاشة الترحيب
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings2 className="h-5 w-5 text-primary" />
            إدارة محتوى شاشة الترحيب
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="backgrounds" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="backgrounds" className="gap-2">
              <Image className="h-4 w-4" />
              الخلفيات ({backgrounds.filter(b => b.is_active).length})
            </TabsTrigger>
            <TabsTrigger value="quotes" className="gap-2">
              <MessageSquareQuote className="h-4 w-4" />
              العبارات ({quotes.filter(q => q.is_active).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backgrounds" className="mt-4">
            {/* Upload button */}
            <div className="mb-4">
              <Label 
                htmlFor="bg-upload" 
                className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5 text-primary" />
                )}
                <span className="font-medium">
                  {uploading ? "جاري الرفع..." : "رفع خلفية جديدة"}
                </span>
              </Label>
              <input
                id="bg-upload"
                type="file"
                accept="image/*"
                onChange={handleUploadBackground}
                className="hidden"
                disabled={uploading}
              />
            </div>

            {/* Backgrounds grid */}
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : backgrounds.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  لا توجد خلفيات. قم برفع خلفيات جديدة.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {backgrounds.map((bg) => (
                    <Card 
                      key={bg.id} 
                      className={`overflow-hidden transition-all ${!bg.is_active ? "opacity-50" : ""}`}
                    >
                      <div className="relative aspect-video">
                        <img 
                          src={bg.image_url} 
                          alt={bg.name || "خلفية"}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-2 right-2 left-2 flex items-center justify-between">
                          <Switch
                            checked={bg.is_active}
                            onCheckedChange={() => toggleBackgroundActive(bg.id, bg.is_active)}
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteBackground(bg.id, bg.image_url)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {bg.name && (
                        <CardContent className="p-2">
                          <p className="text-xs text-muted-foreground truncate">
                            {bg.name}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            {/* Add quote form */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="الرمز التعبيري"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                className="w-20 text-center text-xl"
                maxLength={2}
              />
              <Textarea
                placeholder="اكتب العبارة التحفيزية هنا..."
                value={newQuote}
                onChange={(e) => setNewQuote(e.target.value)}
                className="flex-1 min-h-[60px]"
              />
              <Button onClick={addQuote} className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة
              </Button>
            </div>

            {/* Quotes list */}
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : quotes.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  لا توجد عبارات. قم بإضافة عبارات جديدة.
                </div>
              ) : (
                <div className="space-y-2">
                  {quotes.map((quote, index) => (
                    <Card 
                      key={quote.id} 
                      className={`transition-all ${!quote.is_active ? "opacity-50" : ""}`}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <span className="text-2xl">{quote.emoji}</span>
                        <p className="flex-1 text-sm">{quote.quote}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            #{index + 1}
                          </span>
                          <Switch
                            checked={quote.is_active}
                            onCheckedChange={() => toggleQuoteActive(quote.id, quote.is_active)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteQuote(quote.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
