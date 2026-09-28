import * as React from 'npm:react@18.3.1'
import {
  Html, Head, Body, Container, Text, Preview, Section, Img, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const LOGO_URL = 'https://kfaah.sa/storage/v1/object/public/email-assets/kafaa-logo-v2.png'
const BRAND_NAME = 'منصة كفاءة'
const TAGLINE = 'منصة إدارة التسويق الإلكتروني للجمعيات بكفاءة'

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
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img src={LOGO_URL} alt={BRAND_NAME} width="120" style={logo} />
            <Text style={tagline}>{TAGLINE}</Text>
          </Section>
          <Hr style={hr} />
          <Text style={bodyText}>{body}</Text>
          <Hr style={hr} />
          <Text style={signature}>فريق {BRAND_NAME}</Text>
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

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif', direction: 'rtl' as const, textAlign: 'right' as const, margin: 0, padding: '16px' }
const container = { padding: '32px 28px', maxWidth: '620px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '20px' }
const logo = { margin: '0 auto', display: 'block' }
const tagline = { fontSize: '12px', color: '#3da6a8', textAlign: 'center' as const, margin: '8px 0 0', fontWeight: 'bold' as const, letterSpacing: '0.3px' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const bodyText = { whiteSpace: 'pre-wrap' as const, color: '#111827', fontSize: 15, lineHeight: 1.9, margin: 0, textAlign: 'right' as const }
const signature = { fontSize: '13px', color: '#1d4a73', fontWeight: 'bold' as const, margin: '0', textAlign: 'center' as const }