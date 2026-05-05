import * as React from 'npm:react@18.3.1'
import {
  Html, Head, Body, Container, Section, Text, Heading, Hr, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  senderName?: string
  originalSubject?: string
  originalMessage?: string
  replyBody?: string
}

function SupportReplyEmail({
  senderName = 'عميلنا الكريم',
  originalSubject = '',
  originalMessage = '',
  replyBody = '',
}: Props) {
  return (
    <Html dir="rtl" lang="ar">
      <Head />
      <Preview>رد من فريق كفاءة على رسالتك</Preview>
      <Body style={{ fontFamily: 'Tahoma, Arial, sans-serif', background: '#f6f8f7', margin: 0, padding: '24px' }}>
        <Container style={{ background: '#ffffff', borderRadius: 16, padding: 28, maxWidth: 620, margin: '0 auto', border: '1px solid #e6ebe9' }}>
          <Section>
            <Heading style={{ color: '#0f5132', fontSize: 22, margin: 0, textAlign: 'right' }}>
              مرحباً {senderName}،
            </Heading>
            <Text style={{ color: '#374151', fontSize: 15, lineHeight: 1.8, textAlign: 'right' }}>
              شكراً لتواصلك مع منصة <strong>كفاءة</strong>. فيما يلي ردّ فريقنا على رسالتك:
            </Text>
            <Section style={{ background: '#f0f9f4', borderRight: '4px solid #16a34a', padding: 16, borderRadius: 8, margin: '16px 0' }}>
              <Text style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: 15, lineHeight: 1.9, margin: 0, textAlign: 'right' }}>
                {replyBody}
              </Text>
            </Section>
            {originalSubject && (
              <>
                <Hr style={{ borderColor: '#e5e7eb' }} />
                <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'right', margin: '8px 0 4px' }}>
                  بخصوص رسالتك: <strong>{originalSubject}</strong>
                </Text>
                {originalMessage && (
                  <Text style={{ color: '#9ca3af', fontSize: 12, whiteSpace: 'pre-wrap', textAlign: 'right', margin: 0 }}>
                    {originalMessage}
                  </Text>
                )}
              </>
            )}
            <Hr style={{ borderColor: '#e5e7eb', marginTop: 20 }} />
            <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'right' }}>
              مع تحيات فريق كفاءة — kfaah.org
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SupportReplyEmail,
  displayName: 'رد على رسالة دعم',
  subject: (d: Props) => `رد من كفاءة: ${d?.originalSubject || 'رسالتك'}`,
  previewData: {
    senderName: 'محمد',
    originalSubject: 'استفسار عن الباقات',
    originalMessage: 'أرغب بمعرفة تفاصيل باقة الجمعيات.',
    replyBody: 'يسعدنا تواصلك. تجد تفاصيل الباقات في صفحة الباقات...',
  },
} satisfies TemplateEntry