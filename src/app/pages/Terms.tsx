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
export const TERMS_VERSION = '2026-09-25';

const SECTIONS: { h: string; p: string[] }[] = [
  { h: '1. About these terms', p: [
    'These Terms and Conditions ("Terms") govern your use of Aspire e Learning ("Aspire", "we", "us", "the Service"), an online learning platform for creating classes, exams, reviewers and study tools, available at aspire-e-learning.site.',
    'By creating an account, signing in, or using the Service you agree to these Terms and to the Privacy section below. If you do not agree, do not use the Service.',
    'If you use the Service for a school or organisation, you confirm that you are allowed to accept these Terms on its behalf. If you are under 18, your parent, guardian or school must agree to these Terms with you.',
  ]},
  { h: '2. What Aspire e Learning is responsible for', p: [
    'Aspire e Learning is responsible for operating the Service with reasonable care and skill, keeping it available as far as we reasonably can, and fixing faults we become aware of within a reasonable time.',
    'We are responsible for protecting the personal data we hold using reasonable organisational, physical and technical measures, as required by the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules, and for notifying affected users and the National Privacy Commission of a personal data breach when the law requires it.',
    'We are responsible for keeping sign-in secure: passwords are stored only as salted hashes, sign-in and verification codes expire, repeated failed attempts are limited, and new devices must be confirmed by email.',
    'We are responsible for using your data only to provide the Service as described in these Terms, for not selling personal data, and for answering requests to access, correct or delete your data.',
    'We are responsible for telling you about significant changes to these Terms before they apply to you.',
  ]},
  { h: '3. What you are responsible for', p: [
    'Keeping your password, sign-in codes and devices secure, and signing out of shared computers. Activity under your account is your responsibility unless you tell us promptly that it was compromised.',
    'Giving accurate information, using one account per person, and not sharing your account.',
    'The content you upload or create, including making sure you have the right to share it.',
    'For instructors: reviewing AI-generated questions and materials before using them, checking short-answer and essay responses, and making final grading and academic-integrity decisions.',
    'For students: doing your own work, and following your instructor’s and school’s rules on academic honesty.',
  ]},
  { h: '4. Accounts, devices and the account switcher', p: [
    'You may sign in with Google, with an email and password, or with a one-time email code. The first sign-in on a new device or browser must be confirmed with a code sent to your email.',
    'Accounts you sign in to are remembered on that device so you can switch between them without a new code. Signing out or removing an account from the switcher forgets it on that device. Do not keep accounts saved on a shared or public computer.',
  ]},
  { h: '5. Acceptable use', p: [
    'Do not upload or share content that is unlawful, infringing, harmful, harassing, hateful, sexually explicit, or that contains malware.',
    'Do not try to break, overload, scrape, reverse-engineer or get around the security of the Service, and do not access or try to access other users’ accounts or data.',
    'Do not use the Service to cheat, to impersonate someone, or to collect other users’ personal data.',
  ]},
  { h: '6. Classes, co-instructors and grades', p: [
    'Instructors own the classes they create. A class owner may invite other instructors as co-instructors with an invite link; co-instructors can see the class, its students and its grades. Only the owner can create or share the co-instructor link and remove co-instructors.',
    'Multiple-choice and true/false items are scored automatically. Short-answer and essay items are checked by the instructor, and a final grade appears only after that check. Grades are shown on a 65–100 scale where 75 is passing unless your school sets another rule.',
    'Grades and records in the Service support, but do not replace, your school’s official records.',
  ]},
  { h: '7. Exams and academic integrity', p: [
    'During an exam the Service records the total time and the time spent on each question, and events such as leaving the exam tab or window, copy/paste attempts, right-clicks and screenshot-key presses. Copying, pasting, right-clicking and printing are disabled, and the exam is hidden while the window is not in focus. This record is visible to the class’s instructors.',
    'These measures discourage and record cheating; no website can stop every method (for example, a photo taken with a phone). Decisions about academic integrity are made by the instructor and the school, not by the Service.',
  ]},
  { h: '8. Your content and AI features', p: [
    'You keep ownership of the materials, questions and work you create or upload. You give us the permission needed to store, process, copy and display them to run the Service for you and for the classes you share them with.',
    'AI features (exam, reviewer, flashcard, summary and concept-map generation) send the text you provide to an AI provider to produce the result. AI output can be wrong or incomplete; check it before relying on it.',
  ]},
  { h: '9. Plans and payments', p: [
    'Paid plans are billed through PayMongo. A payment grants the plan for the period shown at checkout and does not renew automatically. Card and e-wallet details are handled by PayMongo and are never stored by us.',
  ]},
  { h: '10. Privacy', p: [
    'What we collect: your name, email address and profile picture; the role and classes you create or join; the content, answers and grades in those classes; exam timing and integrity events; study activity; and security data such as sign-in codes, trusted devices and failed sign-in attempts.',
    'Why: to sign you in, run your classes, grade and give feedback, send notifications, keep accounts secure, and improve the Service. We do not sell personal data or use it for advertising.',
    'Who we share it with: the service providers that run the platform (hosting, database, email delivery, AI generation and payments), only as needed to provide the Service; and the instructors and classmates of the classes you join, as the class features require.',
    'How long: we keep your data while your account is active. When you delete your account we delete your profile and the content you own within a reasonable time, except records a school must keep or that we must keep by law.',
    'Your rights: under the Data Privacy Act you may ask to be informed, to access, correct, object to processing, have your data erased or blocked, receive a copy of it, and file a complaint with the National Privacy Commission.',
  ]},
  { h: '11. Availability and changes to the Service', p: [
    'We may change, add or remove features. We try to keep the Service running, but it may sometimes be unavailable for maintenance or reasons outside our control. Keep your own copies of important materials and grades (for example, the class record sheet download).',
  ]},
  { h: '12. Suspension and termination', p: [
    'We may suspend or close accounts that break these Terms or put other users or the Service at risk. You may stop using the Service and ask us to delete your account at any time.',
  ]},
  { h: '13. Disclaimers and limitation of liability', p: [
    'Apart from the responsibilities in section 2, the Service is provided "as is" and "as available". To the extent the law allows, Aspire e Learning is not liable for indirect or consequential losses, for lost data you could have kept a copy of, or for decisions made from AI-generated content or automatically computed grades.',
    'Nothing in these Terms limits liability that cannot be limited under Philippine law.',
  ]},
  { h: '14. Changes to these terms', p: [
    'We may update these Terms. If a change is significant, we will ask you to accept the new version before you continue using the Service.',
  ]},
  { h: '15. Governing law', p: [
    'These Terms are governed by the laws of the Republic of the Philippines.',
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
