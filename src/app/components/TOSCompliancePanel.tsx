import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Alert, AlertTitle, Button, Stack, Collapse, IconButton, LinearProgress, Divider,
} from '@mui/material';
import { useState } from 'react';
import {
  CheckCircle, ErrorOutline, ExpandMore, ExpandLess, Autorenew, RuleFolder, WarningAmber,
} from '@mui/icons-material';
import type { TOSComplianceReport, TOSCountRow } from '../services/tosValidator';
import type { TOSData } from '../services/tosParser';
import { useIsMobile } from '../hooks/useResponsive';

/**
 * Shows the instructor exactly how the generated exam measures up against the uploaded Table
 * of Specifications, before they save it. Presentational only.
 */

function CountTable({ title, rows, isMobile }: { title: string; rows: TOSCountRow[]; isMobile: boolean }) {
  if (rows.length === 0) return null;
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 900, color: 'var(--c-slate-600)', display: 'block', mb: 0.75 }}>
        {title}
      </Typography>
      <TableContainer sx={{ overflowX: 'auto', border: '1px solid var(--c-slate-200)', borderRadius: 2 }}>
        <Table size="small" sx={{ minWidth: isMobile ? 0 : 420 }}>
          <TableHead sx={{ bgcolor: 'var(--c-slate-50)' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>
                {title.toLowerCase().includes('topic') ? 'Topic' : 'Cognitive level'}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>Required</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>Generated</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} hover>
                <TableCell sx={{ color: 'var(--c-slate-900)', fontWeight: 600, wordBreak: 'break-word', minWidth: isMobile ? 120 : 180 }}>
                  {r.key || '(unspecified)'}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>{r.expected}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, color: r.ok ? 'var(--c-green-800)' : 'var(--c-red-700)' }}>{r.actual}</TableCell>
                <TableCell align="center">
                  {r.ok ? (
                    <Chip label="OK" size="small" sx={{ bgcolor: 'var(--c-green-100)', color: 'var(--c-green-800)', fontWeight: 900, height: 20, fontSize: '0.65rem' }} />
                  ) : (
                    <Chip
                      label={r.delta > 0 ? `+${r.delta}` : String(r.delta)}
                      size="small"
                      sx={{ bgcolor: 'var(--c-red-100)', color: 'var(--c-red-800)', fontWeight: 900, height: 20, fontSize: '0.65rem' }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default function TOSCompliancePanel({
  report,
  tosData,
  onRegenerate,
  busy = false,
}: {
  report: TOSComplianceReport | null;
  tosData?: TOSData | null;
  onRegenerate?: () => void;
  busy?: boolean;
}) {
  const isMobile = useIsMobile();
  const [showViolations, setShowViolations] = useState(false);

  if (!report) return null;

  const pct = report.expectedTotal > 0
    ? Math.round((report.compliantItemCount / report.expectedTotal) * 100)
    : 100;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: `2px solid ${report.compliant ? 'var(--c-green-300)' : 'var(--c-red-300)'}`,
        bgcolor: report.compliant ? 'var(--c-green-50)' : 'var(--c-red-50)',
        overflow: 'hidden',
        mb: 3,
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
          {report.compliant
            ? <CheckCircle sx={{ color: 'var(--c-green-600)', fontSize: 28, flexShrink: 0 }} />
            : <ErrorOutline sx={{ color: 'var(--c-red-600)', fontSize: 28, flexShrink: 0 }} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, color: report.compliant ? 'var(--c-green-800)' : 'var(--c-red-800)', fontSize: '1rem' }}>
              {report.compliant ? 'Table of Specifications satisfied' : 'Does not match the Table of Specifications'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--c-slate-600)', wordBreak: 'break-word' }}>
              {report.summary}
            </Typography>
            {report.blueprintFileName && (
              <Typography variant="caption" sx={{ color: 'var(--c-slate-500)', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <RuleFolder sx={{ fontSize: 14 }} /> {report.blueprintFileName}
                {report.attemptsUsed > 0 && ` · ${report.attemptsUsed} regeneration attempt(s)`}
              </Typography>
            )}
          </Box>
        </Stack>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-slate-600)' }}>
              {report.compliantItemCount} of {report.expectedTotal} items compliant
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 900, color: report.compliant ? 'var(--c-green-800)' : 'var(--c-red-800)' }}>
              {pct}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 10, borderRadius: 5, bgcolor: 'var(--c-slate-200)',
              '& .MuiLinearProgress-bar': { bgcolor: report.compliant ? 'var(--c-green-600)' : 'var(--c-red-600)', borderRadius: 5 },
            }}
          />
        </Box>

        {/* The source document's own internal inconsistencies, surfaced rather than swallowed. */}
        {report.blueprintDiscrepancies.length > 0 && (
          <Alert severity="info" icon={<WarningAmber />} sx={{ mb: 2, borderRadius: 2 }}>
            <AlertTitle sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
              The uploaded TOS is internally inconsistent
            </AlertTitle>
            <Typography variant="caption" component="div" sx={{ color: 'var(--c-slate-600)' }}>
              Item placements were treated as authoritative, because they are contiguous and sum to
              the document's stated total.
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, m: 0, mt: 0.75 }}>
              {report.blueprintDiscrepancies.map((d, i) => (
                <Typography component="li" variant="caption" key={i} sx={{ color: 'var(--c-slate-600)' }}>{d}</Typography>
              ))}
            </Box>
          </Alert>
        )}

        <CountTable title="Items per topic" rows={report.byTopic} isMobile={isMobile} />
        <CountTable title="Items per cognitive level" rows={report.byCognitiveLevel} isMobile={isMobile} />

        {report.violations.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setShowViolations((v) => !v)}
            >
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'var(--c-red-800)' }}>
                {report.violations.length} NON-COMPLIANT ITEM{report.violations.length === 1 ? '' : 'S'}
              </Typography>
              <IconButton size="small" aria-label={showViolations ? 'Hide details' : 'Show details'}>
                {showViolations ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
            <Collapse in={showViolations}>
              <Box sx={{ mt: 1, maxHeight: 280, overflowY: 'auto', pr: 0.5 }}>
                {report.violations.map((v, i) => (
                  <Box key={`${v.itemNumber}-${i}`} sx={{ mb: 1, pb: 1, borderBottom: '1px solid var(--c-red-200)' }}>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 0.25 }}>
                      <Chip
                        label={v.itemNumber > 0 ? `Item ${v.itemNumber}` : 'Unplaced'}
                        size="small"
                        sx={{ bgcolor: 'var(--c-red-100)', color: 'var(--c-red-800)', fontWeight: 900, height: 20, fontSize: '0.65rem' }}
                      />
                      {v.codes.map((c) => (
                        <Chip key={c} label={c.replace(/_/g, ' ').toLowerCase()} size="small"
                          sx={{ bgcolor: 'var(--c-slate-100)', color: 'var(--c-slate-600)', fontWeight: 700, height: 20, fontSize: '0.62rem' }} />
                      ))}
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'var(--c-slate-600)', display: 'block', wordBreak: 'break-word' }}>
                      {v.detail}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Collapse>
          </>
        )}

        {!report.compliant && onRegenerate && (
          <Button
            variant="contained"
            startIcon={<Autorenew />}
            onClick={onRegenerate}
            disabled={busy}
            fullWidth={isMobile}
            sx={{ mt: 2, bgcolor: 'var(--c-red-600)', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: 'var(--c-red-700)' } }}
          >
            {busy ? 'Regenerating…' : 'Regenerate non-compliant items'}
          </Button>
        )}
      </Box>
    </Paper>
  );
}
