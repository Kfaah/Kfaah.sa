import * as React from 'npm:react@18.3.1'
import {
  Html, Head, Body, Container, Text, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  senderName?: string
  originalSubject?: string
  originalMessage?: string
  replyBody?: string
}

function SupportReplyEmail({
  replyBody = '',
}: Props) {
  return (
    <Html dir="rtl" lang="ar">
      <Head />
      <Preview>{replyBody.slice(0, 120)}</Preview>
      <Body style={{ fontFamily: 'Tahoma, Arial, sans-serif', background: '#ffffff', margin: 0, padding: '16px' }}>
        <Container style={{ maxWidth: 620, margin: '0 auto' }}>
          <Text style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: 15, lineHeight: 1.9, margin: 0, textAlign: 'right' }}>
            {replyBody}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SupportReplyEmail,
  displayName: 'رد على رسالة دعم',
  subject: (d: Props) => d?.originalSubject ? (d.originalSubject.startsWith('Re:') ? d.originalSubject : `Re: ${d.originalSubject}`) : 'رسالة من كفاءة',
  previewData: {
    senderName: 'محمد',
    originalSubject: 'استفسار عن الباقات',
    originalMessage: 'أرغب بمعرفة تفاصيل باقة الجمعيات.',
    replyBody: 'يسعدنا تواصلك. تجد تفاصيل الباقات في صفحة الباقات...',
  },
} satisfies TemplateEntry