import { useCallback, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography } from '@mui/material';
import { Link as LinkIcon, EditOutlined } from '@mui/icons-material';
import { palette } from '../theme/tokens';

export interface PromptOptions {
  title: string;
  label?: string;
  message?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** 'link' checks for an http(s) address and shows a link icon. */
  kind?: 'link' | 'text';
}

/**
 * In-app replacement for window.prompt(): a themed modal with a text field.
 *   const { prompt, PromptHost } = usePrompt();
 *   const url = await prompt({ title: 'Add link', kind: 'link' });   // string or null
 */
export function usePrompt() {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const prompt = useCallback((opts: PromptOptions) => {
    setOptions(opts);
    setValue(opts.initial || '');
    setError('');
    return new Promise<string | null>((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = (v: string | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setOptions(null);
  };

  const submit = () => {
    const v = value.trim();
    if (!v) { setError('This cannot be empty.'); return; }
    if (options?.kind === 'link' && !/^https?:\/\/\S+\.\S+/i.test(v)) {
      setError('Enter a full link that starts with http:// or https://');
      return;
    }
    settle(v);
  };

  const isLink = options?.kind === 'link';
  const PromptHost = (
    <Dialog open={Boolean(options)} onClose={() => settle(null)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '9px', display: 'grid', placeItems: 'center', bgcolor: palette.primarySoft, color: palette.primary }}>
          {isLink ? <LinkIcon fontSize="small" /> : <EditOutlined fontSize="small" />}
        </Box>
        {options?.title}
      </DialogTitle>
      <DialogContent>
        {options?.message && <Typography variant="body2" sx={{ color: palette.inkSecondary, mb: 1.5 }}>{options.message}</Typography>}
        <TextField
          autoFocus fullWidth size="small" sx={{ mt: 1 }}
          label={options?.label || (isLink ? 'Link' : 'Name')}
          placeholder={options?.placeholder || (isLink ? 'https://…' : '')}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          error={Boolean(error)}
          helperText={error || ' '}
          inputProps={{ autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false, inputMode: isLink ? 'url' : 'text' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => settle(null)} sx={{ color: palette.inkSecondary }}>Cancel</Button>
        <Button variant="contained" onClick={submit}>{options?.confirmLabel || (isLink ? 'Add link' : 'Save')}</Button>
      </DialogActions>
    </Dialog>
  );
  return { prompt, PromptHost };
}
