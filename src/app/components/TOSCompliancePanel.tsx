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
      <Typography variant="caption" sx={{ fontWeight: 900, color: '#475569', display: 'block', mb: 0.75 }}>
        {title}
      </Typography>
      <TableContainer sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Table size="small" sx={{ minWidth: isMobile ? 0 : 420 }}>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800, color: '#334155' }}>
                {title.toLowerCase().includes('topic') ? 'Topic' : 'Cognitive level'}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: '#334155' }}>Required</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: '#334155' }}>Generated</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: '#334155' }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} hover>
                <TableCell sx={{ color: '#0f172a', fontWeight: 600, wordBreak: 'break-word', minWidth: isMobile ? 120 : 180 }}>
                  {r.key || '(unspecified)'}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>{r.expected}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, color: r.ok ? '#166534' : '#b91c1c' }}>{r.actual}</TableCell>
                <TableCell align="center">
                  {r.ok ? (
                    <Chip label="OK" size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 900, height: 20, fontSize: '0.65rem' }} />
                  ) : (
                    <Chip
                      label={r.delta > 0 ? `+${r.delta}` : String(r.delta)}
                      size="small"
                      sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 900, height: 20, fontSize: '0.65rem' }}
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
        border: `2px solid ${report.compliant ? '#86efac' : '#fca5a5'}`,
        bgcolor: report.compliant ? '#f0fdf4' : '#fef2f2',
        overflow: 'hidden',
        mb: 3,
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
          {report.compliant
            ? <CheckCircle sx={{ color: '#16a34a', fontSize: 28, flexShrink: 0 }} />
            : <ErrorOutline sx={{ color: '#dc2626', fontSize: 28, flexShrink: 0 }} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, color: report.compliant ? '#166534' : '#991b1b', fontSize: '1rem' }}>
              {report.compliant ? 'Table of Specifications satisfied' : 'Does not match the Table of Specifications'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', wordBreak: 'break-word' }}>
              {report.summary}
            </Typography>
            {report.blueprintFileName && (
              <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <RuleFolder sx={{ fontSize: 14 }} /> {report.blueprintFileName}
                {report.attemptsUsed > 0 && ` · ${report.attemptsUsed} regeneration attempt(s)`}
              </Typography>
            )}
          </Box>
        </Stack>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569' }}>
              {report.compliantItemCount} of {report.expectedTotal} items compliant
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 900, color: report.compliant ? '#166534' : '#991b1b' }}>
              {pct}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 10, borderRadius: 5, bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': { bgcolor: report.compliant ? '#16a34a' : '#dc2626', borderRadius: 5 },
            }}
          />
        </Box>

        {/* The source document's own internal inconsistencies, surfaced rather than swallowed. */}
        {report.blueprintDiscrepancies.length > 0 && (
          <Alert severity="info" icon={<WarningAmber />} sx={{ mb: 2, borderRadius: 2 }}>
            <AlertTitle sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
              The uploaded TOS is internally inconsistent
            </AlertTitle>
            <Typography variant="caption" component="div" sx={{ color: '#475569' }}>
              Item placements were treated as authoritative, because they are contiguous and sum to
              the document's stated total.
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, m: 0, mt: 0.75 }}>
              {report.blueprintDiscrepancies.map((d, i) => (
                <Typography component="li" variant="caption" key={i} sx={{ color: '#475569' }}>{d}</Typography>
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
              <Typography variant="caption" sx={{ fontWeight: 900, color: '#991b1b' }}>
                {report.violations.length} NON-COMPLIANT ITEM{report.violations.length === 1 ? '' : 'S'}
              </Typography>
              <IconButton size="small" aria-label={showViolations ? 'Hide details' : 'Show details'}>
                {showViolations ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
            <Collapse in={showViolations}>
              <Box sx={{ mt: 1, maxHeight: 280, overflowY: 'auto', pr: 0.5 }}>
                {report.violations.map((v, i) => (
                  <Box key={`${v.itemNumber}-${i}`} sx={{ mb: 1, pb: 1, borderBottom: '1px solid #fecaca' }}>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 0.25 }}>
                      <Chip
                        label={v.itemNumber > 0 ? `Item ${v.itemNumber}` : 'Unplaced'}
                        size="small"
                        sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 900, height: 20, fontSize: '0.65rem' }}
                      />
                      {v.codes.map((c) => (
                        <Chip key={c} label={c.replace(/_/g, ' ').toLowerCase()} size="small"
                          sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, height: 20, fontSize: '0.62rem' }} />
                      ))}
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#475569', display: 'block', wordBreak: 'break-word' }}>
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
            sx={{ mt: 2, bgcolor: '#dc2626', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#b91c1c' } }}
          >
            {busy ? 'Regenerating…' : 'Regenerate non-compliant items'}
          </Button>
        )}
      </Box>
    </Paper>
  );
}
