import * as React from 'npm:react@18.3.1'
import {
  Html, Head, Body, Container, Text, Preview,
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
}: Props) {
  return (
    <Html dir="rtl" lang="ar">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ fontFamily: 'Tahoma, Arial, sans-serif', background: '#ffffff', margin: 0, padding: '16px' }}>
        <Container style={{ maxWidth: 620, margin: '0 auto' }}>
          <Text style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: 15, lineHeight: 1.9, margin: 0, textAlign: 'right' }}>
            {body}
          </Text>
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