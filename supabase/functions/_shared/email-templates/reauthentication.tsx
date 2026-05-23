/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://jopvcsrmccoulujeyjvw.supabase.co/storage/v1/object/public/email-assets/kafaa-logo.png'
const BRAND_NAME = 'منصة كفاء'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رمز التحقق الخاص بك</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt={BRAND_NAME} width="120" style={logo} />
        </Section>
        <Heading style={h1}>تأكيد الهوية</Heading>
        <Text style={text}>استخدم الرمز التالي لتأكيد هويتك في {BRAND_NAME}:</Text>
        <Section style={codeWrap}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={footer}>
          هذا الرمز صالح لفترة محدودة. إذا لم تطلبه، يمكنك تجاهل هذه الرسالة بأمان.
        </Text>
        <Text style={signature}>فريق {BRAND_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif', direction: 'rtl' as const, textAlign: 'right' as const }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logo = { margin: '0 auto', display: 'block' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1d4a73', margin: '0 0 20px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#3a4a5c', lineHeight: '1.8', margin: '0 0 16px', textAlign: 'center' as const }
const codeWrap = { textAlign: 'center' as const, margin: '24px 0 32px', backgroundColor: '#f0f7f8', borderRadius: '16px', padding: '20px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '32px', fontWeight: 'bold' as const, color: '#1d4a73', margin: '0', letterSpacing: '8px' }
const footer = { fontSize: '13px', color: '#8a9aaa', margin: '30px 0 12px', lineHeight: '1.7', textAlign: 'center' as const }
const signature = { fontSize: '13px', color: '#1d4a73', fontWeight: 'bold' as const, margin: '0', textAlign: 'center' as const }