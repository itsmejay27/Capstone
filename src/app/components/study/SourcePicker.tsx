import { useMemo, useRef, useState } from 'react';
import { Box, TextField, MenuItem, Button, Typography, Chip } from '@mui/material';
import { Upload, School } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { extractFilesContent } from '../../services/ollamaService';

/**
 * What a study tool learns from: a material from one of the student's classes, an uploaded
 * file, and/or a typed topic. `resolve()` turns the choice into { label, text } for the AI.
 */
export interface StudySource { label: string; text: string }

export function useSourcePicker() {
  const { currentUser, classrooms, classroomMaterials } = useAuth();
  const [classroomId, setClassroomId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState('');

  const myClasses = useMemo(
    () => classrooms.filter((c: any) => (c.students || []).includes(currentUser?.id) || c.instructorId === currentUser?.id),
    [classrooms, currentUser?.id]
  );
  const materials = classroomId ? (classroomMaterials[classroomId] || []) : [];
  const material = materials.find((m: any) => m.id === materialId);
  const ready = Boolean(material || file || topic.trim());

  const resolve = async (): Promise<StudySource> => {
    const parts: string[] = [];
    if (material) {
      if (material.content?.trim()) parts.push(material.content);
      else if (material.fileUrl) {
        try {
          const blob = await (await fetch(material.fileUrl)).blob();
          parts.push(await extractFilesContent([new File([blob], material.name || 'material', { type: blob.type })]));
        } catch { /* fall back to the topic */ }
      }
    }
    if (file) parts.push(await extractFilesContent([file]));
    const label = topic.trim() || material?.name?.replace(/\.[^.]+$/, '') || file?.name?.replace(/\.[^.]+$/, '') || 'Study set';
    return { label, text: parts.join('\n\n').slice(0, 24000) };
  };

  return { myClasses, classroomId, setClassroomId, materials, materialId, setMaterialId, file, setFile, topic, setTopic, ready, resolve };
}

export default function SourcePicker({ picker }: { picker: ReturnType<typeof useSourcePicker> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { myClasses, classroomId, setClassroomId, materials, materialId, setMaterialId, file, setFile, topic, setTopic } = picker;
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <TextField select size="small" label="Class" value={classroomId} onChange={(e) => { setClassroomId(e.target.value); setMaterialId(''); }}
        InputProps={{ startAdornment: <School fontSize="small" sx={{ mr: 1, color: 'var(--c-ink-tertiary)' }} /> }}>
        <MenuItem value="">— No class material —</MenuItem>
        {myClasses.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Class material" value={materialId} disabled={!classroomId || materials.length === 0}
        onChange={(e) => setMaterialId(e.target.value)} helperText={classroomId && materials.length === 0 ? 'This class has no materials yet.' : ' '}>
        {materials.map((m: any) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
      </TextField>
      <TextField size="small" label="Topic or instructions (optional)" value={topic} onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Photosynthesis — light-dependent reactions" />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.pptx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button variant="outlined" startIcon={<Upload />} onClick={() => fileRef.current?.click()} sx={{ textTransform: 'none' }}>Upload file</Button>
        {file ? <Chip label={file.name} onDelete={() => setFile(null)} size="small" /> :
          <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>PDF, DOCX, PPTX or TXT</Typography>}
      </Box>
    </Box>
  );
}
