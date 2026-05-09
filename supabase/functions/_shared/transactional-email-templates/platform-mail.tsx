import * as React from 'npm:react@18.3.1'
import {
  Html, Head, Body, Container, Section, Text, Heading, Hr, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  subject?: string
  body?: string
  recipientName?: string
}

function PlatformMailEmail({
  subject = 'رسالة من كفاءة',
  body = '',
  recipientName = 'عميلنا الكريم',
}: Props) {
  return (
    <Html dir="rtl" lang="ar">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ fontFamily: 'Tahoma, Arial, sans-serif', background: '#f6f8f7', margin: 0, padding: '24px' }}>
        <Container style={{ background: '#ffffff', borderRadius: 16, padding: 28, maxWidth: 620, margin: '0 auto', border: '1px solid #e6ebe9' }}>
          <Section>
            <Heading style={{ color: '#0f5132', fontSize: 22, margin: 0, textAlign: 'right' }}>
              مرحباً {recipientName}،
            </Heading>
            <Section style={{ background: '#f0f9f4', borderRight: '4px solid #16a34a', padding: 16, borderRadius: 8, margin: '18px 0' }}>
              <Text style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: 15, lineHeight: 1.9, margin: 0, textAlign: 'right' }}>
                {body}
              </Text>
            </Section>
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
  component: PlatformMailEmail,
  displayName: 'رسالة مباشرة من كفاءة',
  subject: (d: Props) => d?.subject || 'رسالة من كفاءة',
  previewData: {
    subject: 'رسالة من كفاءة',
    recipientName: 'محمد',
    body: 'نص الرسالة يظهر هنا كما كُتب داخل المنصة.',
  },
} satisfies TemplateEntry