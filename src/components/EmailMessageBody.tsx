import { readableEmail } from "@/lib/emailText";

export function EmailMessageBody({ body }: { body: string | null | undefined }) {
  const { text, quoted } = readableEmail(body);
  return <div className="text-sm text-slate-100 leading-7 break-words" dir="auto">
    <p className="whitespace-pre-wrap">{text || (!quoted ? "(لا يوجد محتوى نصي)" : "")}</p>
    {quoted && <details className="mt-3 border-t border-white/15 pt-3 text-slate-300">
      <summary className="cursor-pointer text-xs">عرض الرسالة السابقة المقتبسة</summary>
      <p className="mt-3 whitespace-pre-wrap">{quoted}</p>
    </details>}
  </div>;
}
