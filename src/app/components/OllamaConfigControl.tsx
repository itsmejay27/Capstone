import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  RadioGroup,
  Radio,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  CircularProgress,
  Paper,
  TextField,
} from '@mui/material';
import {
  SmartToy,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  Computer,
  AutoAwesome,
} from '@mui/icons-material';
import { checkOllamaConnection, OllamaConnectionState } from '../services/ollamaService';
import { GEMINI_MODELS, fetchNvidiaModels, NvidiaModel } from '../services/geminiService';

export type AIEngineType = 'gemini' | 'nvidia' | 'ollama';

interface OllamaConfigControlProps {
  engine: AIEngineType;
  onEngineChange: (engine: AIEngineType) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  ollamaUrl?: string;
  onUrlChange?: (url: string) => void;
  geminiModel?: string;
  onGeminiModelChange?: (model: string) => void;
  nvidiaModel?: string;
  onNvidiaModelChange?: (model: string) => void;
  onConnectionStatusChange?: (connected: boolean) => void;
}

export default function OllamaConfigControl({
  engine,
  onEngineChange,
  selectedModel,
  onModelChange,
  ollamaUrl = '/api/ollama',
  geminiModel = 'gemini-3.5-flash-lite',
  onGeminiModelChange,
  nvidiaModel = 'meta/llama-3.3-70b-instruct',
  onNvidiaModelChange,
  onConnectionStatusChange,
}: OllamaConfigControlProps) {
  const [loading, setLoading] = useState(false);

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

  const [ollamaStatus, setOllamaStatus] = useState<OllamaConnectionState>({
    connected: false,
    models: [],
    activeModel: '',
  });

  const handleCheckConnection = useCallback(async () => {
    setLoading(true);
    const res = await checkOllamaConnection(ollamaUrl);
    setOllamaStatus(res);
    setLoading(false);

    if (res.connected) {
      const active = res.activeModel || res.models[0] || 'llama3.2:latest';
      if (!selectedModel || !res.models.includes(selectedModel)) {
        onModelChange(active);
      }
    }
    if (onConnectionStatusChange) {
      onConnectionStatusChange(res.connected);
    }
  }, [ollamaUrl, selectedModel, onModelChange, onConnectionStatusChange]);

  useEffect(() => {
    handleCheckConnection();
  }, [handleCheckConnection]);

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
          ) : loading ? (
            <Chip
              icon={<CircularProgress size={12} color="inherit" />}
              label="Checking Ollama..."
              size="small"
              variant="outlined"
            />
          ) : ollamaStatus.connected ? (
            <Chip
              icon={<CheckCircle sx={{ color: 'var(--c-green-600) !important' }} />}
              label="Ollama Connected"
              color="success"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          ) : (
            <Chip
              icon={<ErrorIcon sx={{ color: 'var(--c-red-600) !important' }} />}
              label="Ollama Offline"
              color="error"
              variant="outlined"
              size="small"
            />
          )}
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
                    Llama, GLM, Qwen, DeepSeek and more — works on the deployed site
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Local Ollama Option */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper
                variant="outlined"
                onClick={() => onEngineChange('ollama')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  borderWidth: 2,
                  borderColor: engine === 'ollama' ? 'primary.main' : 'var(--c-slate-200)',
                  bgcolor: engine === 'ollama' ? 'rgba(16, 185, 129, 0.04)' : 'inherit',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Radio value="ollama" checked={engine === 'ollama'} size="small" />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <Computer fontSize="small" color="primary" />
                    <Typography variant="body2" fontWeight="bold">Local Ollama AI</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                    Runs locally on your laptop (Offline / Private)
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </RadioGroup>

        {engine === 'nvidia' && (
          <>
            <Autocomplete
              options={nvidiaModels}
              getOptionLabel={(m: any) => m?.name || m?.id || ''}
              isOptionEqualToValue={(a: any, b: any) => a?.id === b?.id}
              value={nvidiaModels.find((m) => m.id === nvidiaModel) || null}
              onChange={(_, picked: any) => onNvidiaModelChange?.(picked?.id || '')}
              disabled={nvidiaLoading || nvidiaModels.length === 0}
              size="small"
              fullWidth
              autoHighlight
              openOnFocus
              // Cap both the rendered list and its height: the catalogue is several hundred
              // entries, which overflowed the viewport and made the popup unusable.
              filterOptions={(opts, state) => {
                const needle = state.inputValue.trim().toLowerCase();
                const matched = needle
                  ? opts.filter((o: any) =>
                      `${o.name || ''} ${o.id || ''}`.toLowerCase().includes(needle))
                  : opts;
                return matched.slice(0, 50);
              }}
              slotProps={{
                listbox: { sx: { maxHeight: 320 } },
                paper: { sx: { borderRadius: '12px' } },
              }}
              renderOption={(optProps, option: any) => (
                <Box component="li" {...optProps} key={option.id} sx={{ display: 'block !important', py: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {option.name || option.id}
                  </Typography>
                  {option.name && option.name !== option.id && (
                    <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }} noWrap>
                      {option.id}
                    </Typography>
                  )}
                </Box>
              )}
              renderInput={(inputProps) => (
                <TextField
                  {...inputProps}
                  label={nvidiaLoading ? 'Loading available models…' : 'Search NVIDIA models'}
                  placeholder="Type to filter, e.g. glm, llama, qwen"
                  helperText={
                    nvidiaModels.length > 0
                      ? `${nvidiaModels.length} models available on your key.`
                      : undefined
                  }
                />
              )}
            />
            {nvidiaError && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                {nvidiaError}
              </Typography>
            )}
          </>
        )}

        {/* Model Selector Dropdown (Gemini or Ollama; NVIDIA has its own above) */}
        {engine === 'nvidia' ? null : engine === 'gemini' ? (
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
        ) : (
          <Grid container spacing={1.5} alignItems="center">
            <Grid size={{ xs: 12, sm: 8 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="ollama-model-label">Select Ollama Model</InputLabel>
                <Select
                  labelId="ollama-model-label"
                  value={selectedModel || (ollamaStatus.models[0] || 'llama3.2:latest')}
                  label="Select Ollama Model"
                  onChange={(e) => onModelChange(e.target.value)}
                  disabled={!ollamaStatus.connected}
                  sx={{ borderRadius: 2, bgcolor: 'var(--c-surface)' }}
                >
                  {ollamaStatus.models.length > 0 ? (
                    ollamaStatus.models.map((m) => (
                      <MenuItem key={m} value={m}>
                        {m} {m.includes('1b') ? '⚡⚡ (Ultra-Fast 1B - Recommended)' : m.includes('3.2') || m.includes('3b') ? '⚡ (Fast 3B)' : m.includes('8b') || m.includes('llama3:latest') ? '🐢 (Slower 8B)' : ''}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="llama3.2:latest">llama3.2:latest ⚡ (Fast 3B)</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
                onClick={handleCheckConnection}
                disabled={loading}
                sx={{ borderRadius: 2, textTransform: 'none', height: 40 }}
              >
                {loading ? 'Testing...' : 'Test Connection'}
              </Button>
            </Grid>
          </Grid>
        )}

        {/* Speed Tip Banner for Local Ollama */}
        {engine === 'ollama' && (
          <Box sx={{ mt: 1.5, p: 1.2, bgcolor: 'var(--c-slate-50)', borderRadius: 2, border: '1px dashed var(--c-slate-300)' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Box component="span" sx={{ fontWeight: 'bold', color: 'var(--c-green-600)' }}>⚡ Laptop Speed Tip:</Box>
              Select <strong>llama3.2:latest</strong> (3B) or 1B models for 3x–5x faster execution. (Run <code>ollama pull llama3.2:1b</code> in terminal for ultra-fast 1B generation).
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
