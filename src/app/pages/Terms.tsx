import { Box, Typography, Container, Divider, Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

/**
 * Terms of Service and Privacy summary. Public (outside the app layout) so it can be read
 * before an account exists.
 *
 * NOTE FOR THE OWNER: this is a sensible starting template, not legal advice. Have it
 * reviewed before launch — in the Philippines, the Data Privacy Act of 2012 (RA 10173)
 * applies to the personal data this platform processes.
 */
export const TERMS_VERSION = '2026-09-24';

const SECTIONS: { h: string; p: string[] }[] = [
  { h: '1. Accepting these terms', p: [
    'By creating an account or using Aspire e Learning ("the Service") you agree to these Terms of Service and to the Privacy section below. If you use the Service for a school or organisation, you confirm you may accept on its behalf.',
    'If you are under 18, your parent, guardian or school must agree to these terms with you.',
  ]},
  { h: '2. Your account', p: [
    'Keep your password and sign-in codes private. You are responsible for activity on your account. Tell us promptly if you suspect unauthorised access.',
    'Provide accurate information. One person per account; do not share accounts.',
  ]},
  { h: '3. Acceptable use', p: [
    'Do not upload content you do not have the right to share, or that is unlawful, harmful, harassing or discriminatory.',
    'Do not attempt to break, overload, reverse-engineer or bypass the security of the Service, or access other users’ data.',
    'Do not use the Service to cheat. Instructors may enable exam integrity measures (see section 5).',
  ]},
  { h: '4. Content and AI', p: [
    'You keep ownership of the materials, questions and work you create or upload. You grant us the permission needed to store, process and display them to provide the Service to you and the classes you share them with.',
    'AI-generated exams, reviewers, flashcards and summaries can contain mistakes. Instructors must review AI output before using it for assessment; students should verify it against class materials.',
  ]},
  { h: '5. Exams and academic integrity', p: [
    'While a student takes an exam, the Service records the time spent overall and per question, and events such as leaving the exam tab, copy/paste attempts and screenshot-key presses. Copy, paste, right-click and printing are disabled during exams. This record is shared with the instructor of that class.',
    'These measures deter and record; they cannot prevent every form of cheating. Decisions about academic integrity are made by the instructor and school, not by the Service.',
  ]},
  { h: '6. Plans and payments', p: [
    'Paid plans are billed through PayMongo. A payment grants the plan for the period shown at checkout and does not renew automatically. Card and wallet details are handled by PayMongo and never stored by us.',
  ]},
  { h: '7. Privacy', p: [
    'We collect: your name, email and profile picture; the classes you create or join; the content and work you create; exam timing and integrity events; and basic security data such as sign-in codes and failed sign-in attempts.',
    'We use it only to run the Service: signing you in, showing your classes, grading, notifications and security. We do not sell personal data.',
    'We share it with the service providers that run the platform (hosting, database, email delivery, AI generation and payments) only as needed to provide the Service, and with the instructors and classmates of the classes you join as the class features require.',
    'You may ask to see, correct or delete your personal data. Deleting your account removes your profile and the content you own, except where a school must keep academic records.',
  ]},
  { h: '8. Suspension and termination', p: [
    'We may suspend accounts that break these terms or put other users at risk. You may stop using the Service and request deletion at any time.',
  ]},
  { h: '9. Disclaimers and liability', p: [
    'The Service is provided "as is". To the extent the law allows, we are not liable for indirect or consequential losses, or for decisions made from AI-generated content.',
  ]},
  { h: '10. Changes', p: [
    'We may update these terms. If the change is significant we will ask you to accept the new version before continuing to use the Service.',
  ]},
];

export default function Terms() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--c-canvas)', color: 'var(--c-ink)', py: 6 }}>
      <Container maxWidth="md">
        <Button startIcon={<ArrowBack />} onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))} sx={{ mb: 3, textTransform: 'none' }}>
          Back
        </Button>
        <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
          Terms of Service &amp;{' '}
          <Box component="span" sx={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic', fontWeight: 400, color: 'var(--c-emerald-600)' }}>Privacy</Box>
        </Typography>
        <Typography sx={{ color: 'var(--c-ink-secondary)', mt: 1 }}>Aspire e Learning · Version {TERMS_VERSION}</Typography>
        <Divider sx={{ my: 3 }} />
        {SECTIONS.map((s) => (
          <Box key={s.h} sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{s.h}</Typography>
            {s.p.map((t, i) => <Typography key={i} sx={{ color: 'var(--c-ink-secondary)', lineHeight: 1.75, mb: 1 }}>{t}</Typography>)}
          </Box>
        ))}
        <Divider sx={{ my: 3 }} />
        <Typography variant="body2" sx={{ color: 'var(--c-ink-tertiary)' }}>
          Questions about these terms or your data: contact your school administrator or the Aspire e Learning team through the website.
        </Typography>
      </Container>
    </Box>
  );
}
