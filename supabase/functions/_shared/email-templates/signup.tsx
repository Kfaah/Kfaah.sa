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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://jopvcsrmccoulujeyjvw.supabase.co/storage/v1/object/public/email-assets/kafaa-logo-v2.png'
const BRAND_NAME = 'منصة كفاءة'
const TAGLINE = 'منصة إدارة التسويق الإلكتروني للجمعيات بكفاءة'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تأكيد بريدك الإلكتروني في {BRAND_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt={BRAND_NAME} width="120" style={logo} />
          <Text style={tagline}>{TAGLINE}</Text>
        </Section>
        <Heading style={h1}>أهلاً بك في {BRAND_NAME}</Heading>
        <Text style={text}>
          شكراً لانضمامك إلى{' '}
          <Link href={siteUrl} style={link}><strong>{BRAND_NAME}</strong></Link>
          {' '}— منصة إدارة التسويق الإلكتروني للجمعيات بكفاءة.
        </Text>
        <Text style={text}>
          لتأكيد بريدك الإلكتروني (
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
          ) اضغط على الزر أدناه:
        </Text>
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>تأكيد البريد الإلكتروني</Button>
        </Section>
        <Text style={footer}>
          إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذه الرسالة بأمان.
        </Text>
        <Text style={signature}>فريق {BRAND_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif', direction: 'rtl' as const, textAlign: 'right' as const }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logo = { margin: '0 auto', display: 'block' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1d4a73',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const text = {
  fontSize: '15px',
  color: '#3a4a5c',
  lineHeight: '1.8',
  margin: '0 0 25px',
}
const link = { color: '#3da6a8', textDecoration: 'underline' }
const buttonSection = { textAlign: 'center' as const, margin: '32px 0' }
const button = {
  backgroundColor: '#1d4a73',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '16px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '13px', color: '#8a9aaa', margin: '30px 0 12px', lineHeight: '1.7' }
const signature = { fontSize: '13px', color: '#1d4a73', fontWeight: 'bold' as const, margin: '0', textAlign: 'center' as const }
const tagline = { fontSize: '12px', color: '#3da6a8', textAlign: 'center' as const, margin: '8px 0 0', fontWeight: 'bold' as const, letterSpacing: '0.3px' }
