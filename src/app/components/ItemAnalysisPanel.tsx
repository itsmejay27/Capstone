import { useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, Collapse, IconButton, Alert, Stack, Divider, Tooltip, MenuItem, TextField,
} from '@mui/material';
import {
  ExpandMore, ExpandLess, Timer, TrendingDown, WarningAmber, CheckCircle, InfoOutlined,
} from '@mui/icons-material';
import {
  analyzeExam, BANDS, formatDuration, formatPercent, MIN_N_FOR_DISCRIMINATION,
  type ExamItemAnalysis, type ItemStat, type OptionStat,
} from '../services/itemAnalysis';
import { useIsMobile } from '../hooks/useResponsive';

/**
 * Item analysis for an exam: difficulty index, most-missed ranking, distractor breakdown and
 * time-to-completion. Presentational — all statistics come from the pure analyzeExam module.
 */

function StatTile({ label, value, hint, color = '#0f172a' }: {
  label: string; value: string; hint?: string; color?: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff',
        flex: '1 1 150px', minWidth: 0,
      }}
    >
      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>
        {label}
      </Typography>
      <Typography sx={{ color, fontWeight: 900, fontSize: '1.4rem', lineHeight: 1.2, mt: 0.5 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

function OptionBar({ option, isMobile }: { option: OptionStat; isMobile: boolean }) {
  const color = option.isKey ? '#16a34a' : option.isTopDistractor ? '#dc2626' : '#94a3b8';
  const bg = option.isKey ? '#dcfce7' : option.isTopDistractor ? '#fee2e2' : '#f1f5f9';
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
        {option.canonicalIndex !== null && (
          <Chip
            label={String.fromCharCode(65 + option.canonicalIndex)}
            size="small"
            sx={{ bgcolor: bg, color, fontWeight: 900, height: 20, minWidth: 28, fontSize: '0.7rem' }}
          />
        )}
        <Typography
          variant="body2"
          sx={{
            flex: 1, minWidth: 0, color: option.isOmitted || option.isOther ? '#94a3b8' : '#334155',
            fontStyle: option.isOmitted || option.isOther ? 'italic' : 'normal',
            fontWeight: option.isKey ? 700 : 400,
            wordBreak: 'break-word',
            fontSize: isMobile ? '0.82rem' : '0.875rem',
          }}
        >
          {option.label}
        </Typography>
        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, whiteSpace: 'nowrap' }}>
          {option.count} · {formatPercent(option.share)}
        </Typography>
        {option.isKey && <Chip label="KEY" size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 900, height: 18, fontSize: '0.6rem' }} />}
        {option.isTopDistractor && <Chip label="TOP DISTRACTOR" size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 900, height: 18, fontSize: '0.6rem' }} />}
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, option.share * 100)}
        sx={{
          height: 8, borderRadius: 4, bgcolor: '#f1f5f9',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
        }}
      />
    </Box>
  );
}

function ItemRow({ item, isMobile }: { item: ItemStat; isMobile: boolean }) {
  const [open, setOpen] = useState(false);
  const band = item.band ? BANDS[item.band] : null;

  return (
    <>
      <TableRow hover sx={{ '& > td': { borderBottom: open ? 'none' : undefined } }}>
        <TableCell sx={{ fontWeight: 800, color: '#0f172a', width: 48 }}>{item.order}</TableCell>
        <TableCell sx={{ minWidth: isMobile ? 160 : 260 }}>
          <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 600, wordBreak: 'break-word' }}>
            {item.questionText || '(no question text)'}
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            {item.topic && <Chip label={item.topic} size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }} />}
            {item.cognitiveLevel && <Chip label={item.cognitiveLevel} size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#f5f3ff', color: '#7c3aed', fontWeight: 700 }} />}
            {item.degradedOptionMapping && (
              <Tooltip title="Some attempts had no saved option order, so their choices were matched against the master order. Treat this item's distractor split as approximate.">
                <Chip icon={<WarningAmber sx={{ fontSize: '0.7rem !important' }} />} label="approx." size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} />
              </Tooltip>
            )}
          </Stack>
        </TableCell>
        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
          <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>{formatPercent(item.missRate)}</Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            {item.incorrect}/{item.administered}
          </Typography>
        </TableCell>
        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
          <Typography sx={{ fontWeight: 800, color: '#334155' }}>
            {item.difficultyIndex === null ? '—' : item.difficultyIndex.toFixed(2)}
          </Typography>
          {band && (
            <Chip label={band.short} size="small" sx={{ bgcolor: band.bg, color: band.color, fontWeight: 800, height: 18, fontSize: '0.62rem' }} />
          )}
        </TableCell>
        {!isMobile && (
          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
            <Typography sx={{ fontWeight: 800, color: '#334155' }}>
              {item.discriminationIndex === null ? '—' : item.discriminationIndex.toFixed(2)}
            </Typography>
          </TableCell>
        )}
        <TableCell align="right" sx={{ width: 48 }}>
          {item.hasOptionBreakdown && (
            <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Hide response breakdown' : 'Show response breakdown'}>
              {open ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      {item.hasOptionBreakdown && (
        <TableRow>
          <TableCell colSpan={isMobile ? 5 : 6} sx={{ py: 0, bgcolor: '#f8fafc' }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ py: 2, px: { xs: 0.5, sm: 2 } }}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: '#475569', display: 'block', mb: 1.25 }}>
                  RESPONSE DISTRIBUTION
                </Typography>
                {item.options.map((o) => (
                  <OptionBar key={o.key} option={o} isMobile={isMobile} />
                ))}
                {item.topDistractor && (
                  <Alert severity="warning" icon={<TrendingDown />} sx={{ mt: 1.5, borderRadius: 2, fontSize: '0.8rem' }}>
                    <strong>{formatPercent(item.topDistractor.share)}</strong> of the class chose
                    “{item.topDistractor.label}”. If that is a common misconception, this item is
                    doing its job — if it is ambiguous, the option may need rewording.
                  </Alert>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function ItemAnalysisPanel({ exams, attempts }: { exams: any[]; attempts: any[] }) {
  const isMobile = useIsMobile();
  const [examId, setExamId] = useState<string>(() => (exams.length > 0 ? exams[0].id : ''));

  const exam = exams.find((e) => e.id === examId) || exams[0];
  const analysis: ExamItemAnalysis | null = useMemo(
    () => (exam ? analyzeExam(exam, attempts) : null),
    [exam, attempts]
  );

  if (exams.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: { xs: 3, sm: 6 }, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <InfoOutlined sx={{ fontSize: 44, color: '#94a3b8', mb: 1 }} />
        <Typography variant="h6" fontWeight={800} color="#0f172a">No exams to analyse</Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          Assign an exam to this class and item analysis will appear once students submit.
        </Typography>
      </Paper>
    );
  }

  if (!analysis) return null;

  const noData = analysis.submittedAttempts === 0;

  return (
    <Box>
      {/* Exam picker */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <TextField
          select fullWidth size="small" label="Exam" value={exam.id}
          onChange={(e) => setExamId(e.target.value)}
          sx={{ maxWidth: { xs: '100%', sm: 420 } }}
        >
          {exams.map((e) => (
            <MenuItem key={e.id} value={e.id}>{e.title}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {noData ? (
        <Alert severity="info" sx={{ borderRadius: 2.5 }}>
          No submitted attempts for <strong>{analysis.examTitle}</strong> yet
          {analysis.inProgressAttempts > 0 && ` (${analysis.inProgressAttempts} in progress)`}.
          Item analysis needs at least one submission.
        </Alert>
      ) : (
        <>
          {/* Caveats first — an instructor must not read approximate data as exact. */}
          {analysis.attemptsMissingSnapshot > 0 && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2.5 }}>
              {analysis.attemptsMissingSnapshot} of {analysis.submittedAttempts} submissions were
              recorded before the option order was saved per attempt
              ({formatPercent(analysis.snapshotCoverage)} coverage). Because each student sees a
              shuffled option order, those answers were matched against the master order and the
              distractor split for the affected items is approximate. Attempts submitted from now
              on are exact.
            </Alert>
          )}
          {analysis.orphanAnswerKeys.length > 0 && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2.5 }}>
              {analysis.orphanAnswerKeys.length} stored answer(s) refer to questions that are no
              longer on this exam; they are excluded from the statistics.
            </Alert>
          )}

          {/* Summary tiles */}
          <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
            <StatTile label="Submissions" value={String(analysis.submittedAttempts)} hint={analysis.inProgressAttempts > 0 ? `${analysis.inProgressAttempts} in progress` : undefined} />
            <StatTile label="Mean difficulty" value={analysis.meanDifficulty === null ? '—' : analysis.meanDifficulty.toFixed(2)} hint="p = proportion correct" />
            <StatTile
              label="Avg. time"
              value={formatDuration(analysis.timing.meanSeconds)}
              hint={analysis.timing.allottedMinutes ? `of ${analysis.timing.allottedMinutes} min allotted` : 'no time limit set'}
              color="#1d4ed8"
            />
            <StatTile
              label="Over time"
              value={String(analysis.timing.overTimeCount)}
              hint={analysis.timing.allottedMinutes ? 'exceeded the limit' : 'no limit to exceed'}
              color={analysis.timing.overTimeCount > 0 ? '#b91c1c' : '#0f172a'}
            />
          </Stack>

          {/* Timing detail */}
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
            <Typography sx={{ fontWeight: 900, color: '#0f172a', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timer sx={{ fontSize: 20, color: '#1d4ed8' }} /> Time to completion
            </Typography>
            {analysis.timing.timedAttempts === 0 ? (
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                No usable timing data
                {analysis.timing.untimedAttempts > 0 && ` (${analysis.timing.untimedAttempts} attempt(s) had missing or implausible timestamps)`}.
              </Typography>
            ) : (
              <>
                <Stack direction="row" sx={{ gap: { xs: 2, sm: 4 }, flexWrap: 'wrap', mb: 1.5 }}>
                  {[
                    ['Mean', formatDuration(analysis.timing.meanSeconds)],
                    ['Median', formatDuration(analysis.timing.medianSeconds)],
                    ['Fastest', formatDuration(analysis.timing.fastestSeconds)],
                    ['Slowest', formatDuration(analysis.timing.slowestSeconds)],
                  ].map(([l, v]) => (
                    <Box key={l}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block' }}>{l}</Typography>
                      <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{v}</Typography>
                    </Box>
                  ))}
                </Stack>
                {analysis.timing.utilization !== null && (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>
                        Average use of the allotted {analysis.timing.allottedMinutes} minutes
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800 }}>
                        {formatPercent(analysis.timing.utilization)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, (analysis.timing.utilization || 0) * 100)}
                      sx={{
                        height: 10, borderRadius: 5, bgcolor: '#f1f5f9',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: (analysis.timing.utilization || 0) > 0.95 ? '#dc2626' : '#2563eb',
                          borderRadius: 5,
                        },
                      }}
                    />
                  </>
                )}
                {analysis.timing.untimedAttempts > 0 && (
                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1 }}>
                    {analysis.timing.untimedAttempts} attempt(s) excluded for missing or implausible timestamps.
                  </Typography>
                )}
              </>
            )}
          </Paper>

          {/* Most missed + full item table */}
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', overflow: 'hidden' }}>
            <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingDown sx={{ fontSize: 20, color: '#dc2626' }} /> Most missed questions
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Ranked by failure rate across the cohort. Expand a row for its distractor breakdown.
                {!analysis.discriminationAvailable &&
                  ` Discrimination needs at least ${MIN_N_FOR_DISCRIMINATION} submissions (currently ${analysis.submittedAttempts}).`}
              </Typography>
            </Box>

            {analysis.mostMissed.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CheckCircle sx={{ fontSize: 40, color: '#16a34a', mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#475569', fontWeight: 700 }}>
                  Every analysable item was answered correctly by the whole cohort.
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: isMobile ? 0 : 720 }}>
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, color: '#334155' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#334155' }}>Question</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: '#334155' }}>Missed</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: '#334155' }}>
                        <Tooltip title="Difficulty index p = proportion answering correctly. Higher p means an easier item."><span>p / band</span></Tooltip>
                      </TableCell>
                      {!isMobile && (
                        <TableCell align="center" sx={{ fontWeight: 800, color: '#334155' }}>
                          <Tooltip title={`Discrimination D = (correct in top 27% − correct in bottom 27%) / group size. Requires n ≥ ${MIN_N_FOR_DISCRIMINATION}.`}><span>D</span></Tooltip>
                        </TableCell>
                      )}
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.mostMissed.map((item) => (
                      <ItemRow key={item.questionId} item={item} isMobile={isMobile} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {analysis.excludedItems.length > 0 && (
              <>
                <Divider />
                <Box sx={{ p: { xs: 2, sm: 3 } }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: '#475569', display: 'block', mb: 1 }}>
                    NOT ANALYSABLE ({analysis.excludedItems.length})
                  </Typography>
                  <Stack spacing={0.75}>
                    {analysis.excludedItems.map((i) => (
                      <Box key={i.questionId} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <Chip
                          label={
                            i.exclusionReason === 'ungraded-free-text' ? 'not auto-graded'
                              : i.exclusionReason === 'missing-answer-key' ? 'no answer key'
                                : 'no attempts'
                          }
                          size="small"
                          sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, height: 20, fontSize: '0.65rem' }}
                        />
                        <Typography variant="body2" sx={{ color: '#64748b', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                          {i.order}. {i.questionText || '(no question text)'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1.25 }}>
                    Essay items are awarded a flat credit on submission rather than being graded
                    against a key, so including them would report the answer rate as if it were
                    correctness.
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
