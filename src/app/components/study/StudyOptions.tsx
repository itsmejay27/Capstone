import { useState } from 'react';
import { Box, TextField, MenuItem, Typography } from '@mui/material';

/**
 * Generation settings shown above each Study Hub generator: how many items, how hard,
 * what style and which language. `describe()` turns them into prompt instructions and
 * `label()` into a short line saved with the result.
 */

export type OptionField = { key: string; label: string; choices: { value: string; label: string }[]; help?: string };

export function useStudyOptions(fields: OptionField[], defaults: Record<string, string>) {
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const label = () => fields.map((f) => f.choices.find((c) => c.value === values[f.key])?.label).filter(Boolean).join(' · ');
  return { fields, values, set, label };
}

export const DIFFICULTY: OptionField = {
  key: 'difficulty', label: 'Difficulty',
  choices: [
    { value: 'easy', label: 'Easy — recall basic facts' },
    { value: 'medium', label: 'Medium — understand and explain' },
    { value: 'hard', label: 'Hard — apply and analyse' },
    { value: 'mixed', label: 'Mixed' },
  ],
};
export const LANGUAGE: OptionField = {
  key: 'language', label: 'Language',
  choices: [{ value: 'English', label: 'English' }, { value: 'Filipino', label: 'Filipino' }, { value: 'Taglish', label: 'Taglish (mixed)' }],
};
export const countField = (label: string, values: number[]): OptionField => ({
  key: 'count', label, choices: values.map((n) => ({ value: String(n), label: `${n}` })),
});

export function difficultyRule(d?: string) {
  return ({
    easy: 'Difficulty: EASY — definitions and direct recall only.',
    medium: 'Difficulty: MEDIUM — require understanding: explain, compare, give examples.',
    hard: 'Difficulty: HARD — require application and analysis: scenarios, problem solving, "why" questions.',
    mixed: 'Difficulty: MIXED — about 30% easy, 40% medium, 30% hard.',
  } as Record<string, string>)[d || 'medium'] || '';
}

export default function StudyOptions({ opts }: { opts: ReturnType<typeof useStudyOptions> }) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-ink-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Settings</Typography>
      <Box sx={{ display: 'grid', gap: 1.5, mt: 0.75, gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${Math.min(4, opts.fields.length)}, 1fr)` } }}>
        {opts.fields.map((f) => (
          <TextField key={f.key} select size="small" label={f.label} value={opts.values[f.key] || ''} helperText={f.help}
            onChange={(e) => opts.set(f.key, e.target.value)}>
            {f.choices.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
        ))}
      </Box>
    </Box>
  );
}
