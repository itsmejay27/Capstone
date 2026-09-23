import { useState } from 'react';
import { Box, Typography, Checkbox, FormControlLabel, Button, Link } from '@mui/material';
import { Gavel } from '@mui/icons-material';
import { palette } from '../theme/tokens';

/** Required once per account before the app opens: read and accept the Terms of Service. */
export default function TermsAccept({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <Box>
      <Box sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: palette.primarySoft, color: palette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
        <Gavel />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.75 }}>Terms &amp; Privacy</Typography>
      <Typography variant="body2" sx={{ color: palette.inkSecondary, mb: 2 }}>
        Before you start, please read and accept how Aspire e Learning works — including what is recorded
        during exams (time per question, tab switches, copy/paste and screenshot attempts) and how your data is used.
      </Typography>
      <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, border: `1px solid ${palette.border}`, bgcolor: palette.surfaceMuted, fontSize: '0.82rem', color: palette.inkSecondary, lineHeight: 1.6 }}>
        • Keep your sign-in private; one person per account.<br />
        • You own what you create; AI output can be wrong — review it.<br />
        • Exam integrity measures are shared with your instructor.<br />
        • We don’t sell personal data; you can ask to see or delete it.
      </Box>
      <FormControlLabel
        control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
        label={
          <Typography variant="body2">
            I have read and agree to the{' '}
            <Link href="/terms" target="_blank" rel="noopener" underline="hover" sx={{ fontWeight: 700 }}>Terms of Service and Privacy Policy</Link>.
          </Typography>
        }
        sx={{ mb: 2, alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.25 } }}
      />
      <Button variant="contained" fullWidth disabled={!agreed} onClick={onAccept} sx={{ py: 1.2, fontWeight: 800 }}>
        Accept and continue
      </Button>
      <Button size="small" fullWidth onClick={onCancel} sx={{ mt: 1, textTransform: 'none' }}>Decline and sign out</Button>
    </Box>
  );
}
