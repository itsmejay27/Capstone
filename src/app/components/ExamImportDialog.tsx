import { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Alert, AlertTitle, Chip, CircularProgress, Divider, List, ListItem,
} from '@mui/material';
import { UploadFile, Description, WarningAmberRounded } from '@mui/icons-material';
import { extractFileText } from '../services/tosParser';
import { parseExamDocument, ImportResult } from '../services/examImporter';
import { palette } from '../theme/tokens';

const TYPE_LABEL: Record<string, string> = {
  'multiple-choice': 'Multiple choice',
  'true-false': 'True / False',
  'short-answer': 'Short answer',
  'essay': 'Essay',
};

/**
 * Imports an existing exam paper (PDF, DOCX or TXT) back into the system as questions.
 *
 * The parse is shown for review before anything is created. An imported paper usually has
 * no answer key — it is the student copy — so the importer's guesses are listed explicitly
 * rather than presented as finished questions.
 */
export default function ExamImportDialog({
  open, onClose, onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (result: ImportResult) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const reset = () => {
    setResult(null); setError(''); setFileName(''); setBusy(false);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    setBusy(true);
    try {
      const text = await extractFileText(file);
      if (!text || text.trim().length < 40) {
        setError('No readable text came out of that file. A scanned or image-only PDF needs OCR first.');
        return;
      }
      setResult(parseExamDocument(text, file.name));
    } catch (err: any) {
      setError(err?.message || 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const counts = (result?.questions || []).reduce<Record<string, number>>((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>Import an existing exam</DialogTitle>
      <Typography variant="body2" sx={{ px: 3, pb: 1.5, color: palette.inkSecondary }}>
        Upload an exam paper and it is converted into editable questions. Works with this
        system's own printouts, and with any paper that numbers its items and letters its
        choices.
      </Typography>

      <DialogContent dividers>
        <Box
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
          sx={{
            p: 4, textAlign: 'center', cursor: 'pointer',
            border: `2px dashed ${palette.border}`, borderRadius: '14px',
            bgcolor: palette.surfaceMuted, transition: 'border-color .2s ease',
            '&:hover': { borderColor: palette.primary },
          }}
        >
          {busy ? (
            <>
              <CircularProgress size={26} />
              <Typography variant="body2" sx={{ mt: 1.5, color: palette.inkSecondary }}>
                Reading {fileName}…
              </Typography>
            </>
          ) : (
            <>
              <UploadFile sx={{ fontSize: 34, color: palette.inkTertiary, mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {fileName || 'Choose a file or drag it here'}
              </Typography>
              <Typography variant="caption" sx={{ color: palette.inkTertiary }}>
                PDF, DOCX or TXT
              </Typography>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            hidden
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2.5 }}>{error}</Alert>}

        {result && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Description fontSize="small" sx={{ color: palette.primary }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {result.questions.length} question{result.questions.length === 1 ? '' : 's'} found
              </Typography>
              {Object.entries(counts).map(([type, n]) => (
                <Chip key={type} size="small" label={`${TYPE_LABEL[type] || type}: ${n}`} />
              ))}
              {result.totalPoints != null && <Chip size="small" variant="outlined" label={`${result.totalPoints} pts`} />}
              {result.durationMinutes != null && <Chip size="small" variant="outlined" label={`${result.durationMinutes} min`} />}
            </Box>

            {result.warnings.length > 0 && (
              <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ mb: 2 }}>
                <AlertTitle sx={{ fontWeight: 800 }}>Check these before using the exam</AlertTitle>
                <List dense disablePadding>
                  {result.warnings.map((w) => (
                    <ListItem key={w} sx={{ display: 'list-item', listStyleType: 'disc', ml: 2.5, py: 0.25 }}>
                      <Typography variant="body2">{w}</Typography>
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}

            <Divider sx={{ mb: 2 }} />
            <Typography variant="caption" sx={{ color: palette.inkTertiary, fontWeight: 700, display: 'block', mb: 1 }}>
              PREVIEW
            </Typography>
            <Box sx={{ maxHeight: 280, overflowY: 'auto', pr: 1 }}>
              {result.questions.map((q) => (
                <Box
                  key={q.itemNumber}
                  sx={{ p: 1.5, mb: 1, borderRadius: '10px', border: `1px solid ${palette.border}`, bgcolor: palette.surface }}
                >
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                    <Chip size="small" label={`#${q.itemNumber}`} sx={{ height: 20, fontSize: '0.65rem' }} />
                    <Chip size="small" label={TYPE_LABEL[q.type] || q.type} color="primary" sx={{ height: 20, fontSize: '0.65rem' }} />
                    <Typography variant="caption" sx={{ color: palette.inkTertiary }}>{q.points} pt</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{q.question}</Typography>
                  {q.options && (
                    <Box sx={{ mt: 0.75, pl: 1 }}>
                      {q.options.map((opt, i) => (
                        <Typography
                          key={opt}
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: q.correctAnswer === i ? palette.primary : palette.inkSecondary,
                            fontWeight: q.correctAnswer === i ? 700 : 400,
                          }}
                        >
                          {String.fromCharCode(65 + i)}. {opt}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }} sx={{ color: palette.inkSecondary }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!result || result.questions.length === 0}
          onClick={() => { if (result) { onImport(result); reset(); } }}
        >
          Import {result ? `${result.questions.length} question${result.questions.length === 1 ? '' : 's'}` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
