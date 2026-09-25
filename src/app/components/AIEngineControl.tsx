import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  RadioGroup,
  Radio,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
} from '@mui/material';
import { SmartToy, AutoAwesome } from '@mui/icons-material';
import { GEMINI_MODELS, fetchNvidiaModels, NvidiaModel } from '../services/geminiService';

export type AIEngineType = 'gemini' | 'nvidia';

interface AIEngineControlProps {
  engine: AIEngineType;
  onEngineChange: (engine: AIEngineType) => void;
  geminiModel?: string;
  onGeminiModelChange?: (model: string) => void;
  nvidiaModel?: string;
  onNvidiaModelChange?: (model: string) => void;
  /** Engines to offer; the reviewer generator only supports Gemini. */
  engines?: AIEngineType[];
}

/** Picks the AI engine (Google Gemini or NVIDIA cloud) and its model. */
export default function AIEngineControl({
  engine,
  onEngineChange,
  geminiModel = 'gemini-3.5-flash-lite',
  onGeminiModelChange,
  nvidiaModel = 'meta/llama-3.3-70b-instruct',
  onNvidiaModelChange,
  engines = ['gemini', 'nvidia'],
}: AIEngineControlProps) {
  // The NVIDIA catalogue changes over time, so it is read when that engine is selected
  // rather than shipped as a fixed list that eventually 410s.
  const [nvidiaModels, setNvidiaModels] = useState<NvidiaModel[]>([]);
  const [nvidiaLoading, setNvidiaLoading] = useState(false);
  const [nvidiaError, setNvidiaError] = useState('');

  useEffect(() => {
    if (engine !== 'nvidia' || nvidiaModels.length > 0) return;
    let cancelled = false;
    setNvidiaLoading(true);
    setNvidiaError('');
    fetchNvidiaModels()
      .then((models) => {
        if (cancelled) return;
        setNvidiaModels(models);
        if (models.length === 0) {
          setNvidiaError('Could not load the NVIDIA model list. Check NVIDIA_API_KEY in the Vercel project settings.');
        } else if (!models.some((m) => m.id === nvidiaModel)) {
          onNvidiaModelChange?.(models[0].id);
        }
      })
      .finally(() => { if (!cancelled) setNvidiaLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: engine === 'gemini' ? 'secondary.main' : 'primary.main', p: 0.5 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToy color={engine === 'gemini' ? 'secondary' : 'primary'} sx={{ fontSize: 24 }} />
            <Typography variant="subtitle1" fontWeight="bold">
              AI Generation Engine & Model
            </Typography>
          </Box>

          {/* Engine Status Badge */}
          {engine === 'gemini' ? (
            <Chip
              icon={<AutoAwesome sx={{ color: 'var(--c-emerald-600) !important' }} />}
              label="Google Gemini Cloud AI"
              color="secondary"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          ) : engine === 'nvidia' ? (
            <Chip
              icon={<AutoAwesome sx={{ color: 'var(--c-green-600) !important' }} />}
              label="NVIDIA Cloud (NIM)"
              color="success"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          ) : null}
        </Box>

        {/* Engine Selection Radios */}
        <RadioGroup
          row
          value={engine}
          onChange={(e) => onEngineChange(e.target.value as AIEngineType)}
          sx={{ mb: 2 }}
        >
          <Grid container spacing={1.5}>
            {/* Google Gemini Option */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper
                variant="outlined"
                onClick={() => onEngineChange('gemini')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  borderWidth: 2,
                  borderColor: engine === 'gemini' ? 'secondary.main' : 'var(--c-slate-200)',
                  bgcolor: engine === 'gemini' ? 'rgba(5, 150, 105, 0.04)' : 'inherit',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Radio value="gemini" checked={engine === 'gemini'} color="secondary" size="small" />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <AutoAwesome fontSize="small" color="secondary" />
                    <Typography variant="body2" fontWeight="bold" color="var(--c-purple-800)">Google Gemini AI</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                    Ultra fast cloud model (1-2s response time)
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* NVIDIA NIM (cloud Llama) Option */}
            {engines.includes('nvidia') && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper
                variant="outlined"
                onClick={() => onEngineChange('nvidia')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  borderWidth: 2,
                  borderColor: engine === 'nvidia' ? 'success.main' : 'var(--c-slate-200)',
                  bgcolor: engine === 'nvidia' ? 'rgba(22, 163, 74, 0.04)' : 'inherit',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Radio value="nvidia" checked={engine === 'nvidia'} color="success" size="small" />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <AutoAwesome fontSize="small" color="success" />
                    <Typography variant="body2" fontWeight="bold" color="var(--c-green-700)">NVIDIA Cloud (NIM)</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                    Labelled by speed and what each model is best at
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            )}

          </Grid>
        </RadioGroup>

        {engine === 'nvidia' && (
          <>
            <FormControl fullWidth size="small" disabled={nvidiaLoading || nvidiaModels.length === 0}>
              <InputLabel id="nvidia-model-label">{nvidiaLoading ? 'Loading models…' : 'Select NVIDIA Model'}</InputLabel>
              <Select
                labelId="nvidia-model-label"
                value={nvidiaModels.some((m) => m.id === nvidiaModel) ? nvidiaModel : ''}
                label={nvidiaLoading ? 'Loading models…' : 'Select NVIDIA Model'}
                onChange={(e) => onNvidiaModelChange?.(String(e.target.value))}
                sx={{ borderRadius: 2, bgcolor: 'var(--c-surface)' }}
              >
                {nvidiaModels.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {nvidiaError && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                {nvidiaError}
              </Typography>
            )}
          </>
        )}

        {/* Gemini model selector (NVIDIA has its own above) */}
        {engine === 'gemini' && (
          <FormControl fullWidth size="small">
            <InputLabel id="gemini-model-label">Select Gemini Model</InputLabel>
            <Select
              labelId="gemini-model-label"
              value={geminiModel}
              label="Select Gemini Model"
              onChange={(e) => onGeminiModelChange && onGeminiModelChange(e.target.value)}
              sx={{ borderRadius: 2, bgcolor: 'var(--c-surface)' }}
            >
              {GEMINI_MODELS.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </CardContent>
    </Card>
  );
}
