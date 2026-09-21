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
  CircularProgress,
  Paper,
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
import { GEMINI_MODELS } from '../services/geminiService';

export type AIEngineType = 'gemini' | 'ollama';

interface OllamaConfigControlProps {
  engine: AIEngineType;
  onEngineChange: (engine: AIEngineType) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  ollamaUrl?: string;
  onUrlChange?: (url: string) => void;
  geminiModel?: string;
  onGeminiModelChange?: (model: string) => void;
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
  onConnectionStatusChange,
}: OllamaConfigControlProps) {
  const [loading, setLoading] = useState(false);

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
              icon={<AutoAwesome sx={{ color: '#9333ea !important' }} />}
              label="Google Gemini Cloud AI"
              color="secondary"
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
              icon={<CheckCircle sx={{ color: '#16a34a !important' }} />}
              label="Ollama Connected"
              color="success"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          ) : (
            <Chip
              icon={<ErrorIcon sx={{ color: '#dc2626 !important' }} />}
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
                  borderColor: engine === 'gemini' ? 'secondary.main' : '#e2e8f0',
                  bgcolor: engine === 'gemini' ? 'rgba(147, 51, 234, 0.04)' : 'inherit',
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
                    <Typography variant="body2" fontWeight="bold" color="#6b21a8">Google Gemini AI</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                    Ultra fast cloud model (1-2s response time)
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
                  borderColor: engine === 'ollama' ? 'primary.main' : '#e2e8f0',
                  bgcolor: engine === 'ollama' ? 'rgba(99, 102, 241, 0.04)' : 'inherit',
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

        {/* Model Selector Dropdown (Gemini or Ollama) */}
        {engine === 'gemini' ? (
          <FormControl fullWidth size="small">
            <InputLabel id="gemini-model-label">Select Gemini Model</InputLabel>
            <Select
              labelId="gemini-model-label"
              value={geminiModel}
              label="Select Gemini Model"
              onChange={(e) => onGeminiModelChange && onGeminiModelChange(e.target.value)}
              sx={{ borderRadius: 2, bgcolor: '#fff' }}
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
                  sx={{ borderRadius: 2, bgcolor: '#fff' }}
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
          <Box sx={{ mt: 1.5, p: 1.2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Box component="span" sx={{ fontWeight: 'bold', color: '#16a34a' }}>⚡ Laptop Speed Tip:</Box>
              Select <strong>llama3.2:latest</strong> (3B) or 1B models for 3x–5x faster execution. (Run <code>ollama pull llama3.2:1b</code> in terminal for ultra-fast 1B generation).
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
