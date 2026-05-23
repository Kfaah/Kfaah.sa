/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://jopvcsrmccoulujeyjvw.supabase.co/storage/v1/object/public/email-assets/kafaa-logo-v2.png'
const BRAND_NAME = 'منصة كفاءة'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>إعادة تعيين كلمة المرور في {BRAND_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt={BRAND_NAME} width="120" style={logo} />
        </Section>
        <Heading style={h1}>إعادة تعيين كلمة المرور</Heading>
        <Text style={text}>
          استلمنا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في {BRAND_NAME}.
          اضغط على الزر أدناه لاختيار كلمة مرور جديدة.
        </Text>
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>إعادة تعيين كلمة المرور</Button>
        </Section>
        <Text style={footer}>
          إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة بأمان ولن يتم تغيير كلمة المرور.
        </Text>
        <Text style={signature}>فريق {BRAND_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif', direction: 'rtl' as const, textAlign: 'right' as const }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logo = { margin: '0 auto', display: 'block' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1d4a73', margin: '0 0 20px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#3a4a5c', lineHeight: '1.8', margin: '0 0 25px' }
const buttonSection = { textAlign: 'center' as const, margin: '32px 0' }
const button = { backgroundColor: '#1d4a73', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '16px', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#8a9aaa', margin: '30px 0 12px', lineHeight: '1.7' }
const signature = { fontSize: '13px', color: '#1d4a73', fontWeight: 'bold' as const, margin: '0', textAlign: 'center' as const }
