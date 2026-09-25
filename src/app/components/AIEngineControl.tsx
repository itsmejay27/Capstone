import { Box, Typography, Card, CardContent, Chip, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { SmartToy, AutoAwesome } from '@mui/icons-material';
import { GEMINI_MODELS } from '../services/geminiService';

export type AIEngineType = 'gemini';

interface AIEngineControlProps {
  engine?: AIEngineType;
  onEngineChange?: (engine: AIEngineType) => void;
  geminiModel?: string;
  onGeminiModelChange?: (model: string) => void;
  engines?: AIEngineType[];
}

/** Picks the Google Gemini model used for generation. */
export default function AIEngineControl({
  geminiModel = 'gemini-3.5-flash-lite',
  onGeminiModelChange,
}: AIEngineControlProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'secondary.main', p: 0.5 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToy color="secondary" sx={{ fontSize: 24 }} />
            <Typography variant="subtitle1" fontWeight="bold">AI Model</Typography>
          </Box>
          <Chip
            icon={<AutoAwesome sx={{ color: 'var(--c-emerald-600) !important' }} />}
            label="Google Gemini"
            color="secondary"
            variant="outlined"
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
        <FormControl fullWidth size="small">
          <InputLabel id="gemini-model-label">Select Gemini Model</InputLabel>
          <Select
            labelId="gemini-model-label"
            value={geminiModel}
            label="Select Gemini Model"
            onChange={(e) => onGeminiModelChange?.(e.target.value)}
            sx={{ borderRadius: 2, bgcolor: 'var(--c-surface)' }}
          >
            {GEMINI_MODELS.map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </CardContent>
    </Card>
  );
}
