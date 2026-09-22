import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Autocomplete, TextField, InputAdornment, Box, Typography, Chip,
} from '@mui/material';
import { Search as SearchIcon, School, Quiz, Inventory2, MenuBook } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { palette, layout } from '../../theme/tokens';

type ResultKind = 'Classes' | 'Exam templates' | 'Question bank' | 'Reviewers';

interface SearchResult {
  id: string;
  kind: ResultKind;
  label: string;
  detail?: string;
  path: string;
}

const KIND_ICON: Record<ResultKind, React.ReactNode> = {
  'Classes': <School sx={{ fontSize: 17 }} />,
  'Exam templates': <Quiz sx={{ fontSize: 17 }} />,
  'Question bank': <Inventory2 sx={{ fontSize: 17 }} />,
  'Reviewers': <MenuBook sx={{ fontSize: 17 }} />,
};

/** Caps each group so one large collection cannot crowd out the others. */
const PER_GROUP_LIMIT = 5;

/**
 * Global search for the top bar.
 *
 * The bar previously rendered a text field whose value nothing read — typing in it did
 * nothing at all, and the ⌘K badge had no handler behind it. It now searches the
 * collections the signed-in user can actually reach and navigates to the match.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const { currentUser, classrooms, savedExams, questionBank, reviewers } = useAuth();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isInstructor = currentUser?.role === 'instructor';

  // ⌘K / Ctrl+K focuses the field, which is what the badge has always promised.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];

    const matches = (...fields: (string | undefined)[]) =>
      fields.filter(Boolean).some((f) => String(f).toLowerCase().includes(needle));

    const out: SearchResult[] = [];

    // Only the classes this user belongs to — search must not leak another section's work.
    const myClassrooms = (classrooms || []).filter((c: any) =>
      isInstructor ? c.instructorId === currentUser?.id : c.students?.includes(currentUser?.id)
    );
    for (const c of myClassrooms) {
      if (matches(c.name, c.subject, c.section, c.classCode)) {
        out.push({
          id: `class-${c.id}`, kind: 'Classes', label: c.name,
          detail: [c.subject, c.section].filter(Boolean).join(' · '),
          path: `/classroom/${c.id}`,
        });
      }
    }

    if (isInstructor) {
      for (const e of savedExams || []) {
        if (matches(e.title, e.description)) {
          out.push({
            id: `exam-${e.id}`, kind: 'Exam templates', label: e.title,
            detail: `${e.questions?.length ?? 0} items`, path: '/exam-repository',
          });
        }
      }
      for (const q of questionBank || []) {
        if (matches(q.question, q.topic)) {
          out.push({
            id: `qb-${q.id}`, kind: 'Question bank', label: q.question,
            detail: q.topic, path: '/question-bank',
          });
        }
      }
    } else {
      for (const r of reviewers || []) {
        if (matches(r.title, r.topic)) {
          out.push({
            id: `rev-${r.id}`, kind: 'Reviewers', label: r.title,
            detail: r.topic, path: '/reviewer',
          });
        }
      }
    }

    const perGroup: Record<string, number> = {};
    return out.filter((r) => {
      perGroup[r.kind] = (perGroup[r.kind] || 0) + 1;
      return perGroup[r.kind] <= PER_GROUP_LIMIT;
    });
  }, [query, classrooms, savedExams, questionBank, reviewers, currentUser, isInstructor]);

  return (
    <Autocomplete
      freeSolo
      options={results}
      groupBy={(o: any) => o.kind}
      getOptionLabel={(o: any) => (typeof o === 'string' ? o : o.label)}
      // The list is already filtered above; MUI must not filter it a second time.
      filterOptions={(x) => x}
      inputValue={query}
      onInputChange={(_, v) => setQuery(v)}
      onChange={(_, picked: any) => {
        if (picked && typeof picked !== 'string') {
          navigate(picked.path);
          setQuery('');
        }
      }}
      noOptionsText={query.trim().length < 2 ? 'Keep typing…' : 'Nothing matches that.'}
      sx={{ flex: 1, maxWidth: 380 }}
      renderOption={(props, option: any) => (
        <Box component="li" {...props} key={option.id} sx={{ gap: 1.25 }}>
          <Box sx={{ color: palette.inkTertiary, display: 'flex', flexShrink: 0 }}>
            {KIND_ICON[option.kind as ResultKind]}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{option.label}</Typography>
            {option.detail && (
              <Typography variant="caption" noWrap sx={{ color: palette.inkTertiary, display: 'block' }}>
                {option.detail}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          placeholder="Search classes, exams, questions…"
          size="small"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: palette.inkTertiary }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Chip
                  label="⌘K"
                  size="small"
                  sx={{
                    height: 20, fontSize: '0.65rem', fontWeight: 700,
                    bgcolor: palette.surfaceSunken, color: palette.inkTertiary,
                  }}
                />
              </InputAdornment>
            ),
            sx: { minHeight: layout.controlHeightSmall },
          }}
        />
      )}
    />
  );
}
