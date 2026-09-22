import { useRef, useState } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Avatar, Divider, Alert,
  ToggleButtonGroup, ToggleButton, InputAdornment, IconButton, Chip,
} from '@mui/material';
import {
  PhotoCamera, Delete, Visibility, VisibilityOff, LightMode, DarkMode,
  SettingsBrightness, Person, Lock, Palette,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode, ThemePreference } from '../context/ThemeModeContext';
import { PageContainer, PageHeader } from '../components/ui-kit';
import { useToast } from '../components/Toast';
import { palette, radius, shadow, layout } from '../theme/tokens';

/** Avatars are inlined as data URLs, so a large upload would bloat every profile read. */
const MAX_AVATAR_BYTES = 1024 * 1024; // 1 MB
const AVATAR_DIMENSION = 256;

/**
 * Downscales and re-encodes a chosen image to a square thumbnail.
 *
 * Without this a 4 MB phone photo would be stored verbatim in the user row and shipped on
 * every hydrate. Cropping to a centred square also stops the avatar from being letterboxed
 * in the circular frame.
 */
function toSquareThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image.'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_DIMENSION;
        canvas.height = AVATAR_DIMENSION;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Image processing is unavailable in this browser.'));
        ctx.drawImage(
          img,
          (img.width - side) / 2, (img.height - side) / 2, side, side,
          0, 0, AVATAR_DIMENSION, AVATAR_DIMENSION
        );
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function SettingsCard({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, sm: 3 },
        mb: 3,
        borderRadius: '14px',
        border: `1px solid ${palette.border}`,
        bgcolor: palette.surface,
        boxShadow: shadow.xs,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
            bgcolor: palette.primarySoft, color: palette.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: palette.ink }}>{title}</Typography>
          <Typography variant="body2" sx={{ color: palette.inkSecondary }}>{description}</Typography>
        </Box>
      </Box>
      <Divider sx={{ mb: 2.5 }} />
      {children}
    </Paper>
  );
}

export default function Settings() {
  const { currentUser, updateProfile, changePassword } = useAuth();
  const { preference, mode, setPreference } = useThemeMode();
  const { toast, ToastHost } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(currentUser?.name ?? '');
  const [avatar, setAvatar] = useState<string | undefined>(currentUser?.avatar);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  if (!currentUser) return null;

  const isGoogleAccount = !currentUser.password;
  const profileDirty = name.trim() !== currentUser.name || avatar !== currentUser.avatar;

  const handlePickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Choose an image file (JPG, PNG or WebP).', 'error');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES * 8) {
      toast('That image is very large. Pick one under 8 MB.', 'error');
      return;
    }
    try {
      setAvatar(await toSquareThumbnail(file));
    } catch (err: any) {
      toast(err?.message || 'Could not read that image.', 'error');
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast('Name cannot be empty.', 'error');
      return;
    }
    setSavingProfile(true);
    const result = await updateProfile({ name: name.trim(), avatar });
    setSavingProfile(false);
    if (result.ok) toast('Profile updated.');
    else toast(result.error || 'Could not update your profile.', 'error');
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setSavingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    setSavingPassword(false);
    if (result.ok) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password changed.');
    } else {
      setPasswordError(result.error || 'Could not change your password.');
    }
  };

  const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <LightMode fontSize="small" /> },
    { value: 'dark', label: 'Dark', icon: <DarkMode fontSize="small" /> },
    { value: 'system', label: 'System', icon: <SettingsBrightness fontSize="small" /> },
  ];

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Your profile, password and appearance." />

      {/* ── Profile ── */}
      <SettingsCard
        icon={<Person fontSize="small" />}
        title="Profile"
        description="How your name and picture appear to your classes."
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2.5, mb: 3 }}>
          <Avatar
            src={avatar}
            sx={{
              width: 84, height: 84, fontSize: '2rem', fontWeight: 800,
              bgcolor: palette.primarySoft, color: palette.primary,
              border: `1px solid ${palette.border}`,
            }}
          >
            {currentUser.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose picture
              </Button>
              {avatar && (
                <Button
                  variant="outlined"
                  startIcon={<Delete />}
                  onClick={() => setAvatar(undefined)}
                  sx={{ color: palette.danger }}
                >
                  Remove
                </Button>
              )}
            </Box>
            <Typography variant="caption" sx={{ color: palette.inkTertiary }}>
              Square crop, resized to {AVATAR_DIMENSION}×{AVATAR_DIMENSION}. JPG, PNG or WebP.
            </Typography>
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              handlePickAvatar(e.target.files?.[0]);
              // Reset so picking the same file twice still fires a change event.
              e.target.value = '';
            }}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
          <TextField
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 80 }}
          />
          <TextField
            label="Email"
            value={currentUser.email}
            disabled
            helperText="Your email identifies your account and cannot be changed here."
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={!profileDirty || savingProfile}
          >
            {savingProfile ? 'Saving…' : 'Save changes'}
          </Button>
          {profileDirty && !savingProfile && (
            <Button
              variant="text"
              onClick={() => { setName(currentUser.name); setAvatar(currentUser.avatar); }}
              sx={{ color: palette.inkSecondary }}
            >
              Discard
            </Button>
          )}
          <Chip
            label={currentUser.role === 'instructor' ? 'Instructor' : 'Student'}
            size="small"
            sx={{ ml: 'auto', bgcolor: palette.primarySoft, color: palette.primary, fontWeight: 700 }}
          />
        </Box>
      </SettingsCard>

      {/* ── Password ── */}
      <SettingsCard
        icon={<Lock fontSize="small" />}
        title="Password"
        description="Change the password you use to sign in."
      >
        {isGoogleAccount ? (
          <Alert severity="info">
            This account signs in with Google, so there is no password to change here. Manage
            it from your Google account instead.
          </Alert>
        ) : (
          <>
            {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
              <TextField
                label="Current password"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPasswords((v) => !v)}
                        aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                      >
                        {showPasswords ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="New password"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                helperText="At least 8 characters."
              />
              <TextField
                label="Confirm new password"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                error={Boolean(confirmPassword) && confirmPassword !== newPassword}
                helperText={
                  confirmPassword && confirmPassword !== newPassword ? 'Does not match.' : ' '
                }
              />
            </Box>
            <Button
              variant="contained"
              onClick={handleChangePassword}
              disabled={
                savingPassword || !currentPassword || newPassword.length < 8
                || newPassword !== confirmPassword
              }
            >
              {savingPassword ? 'Changing…' : 'Change password'}
            </Button>
          </>
        )}
      </SettingsCard>

      {/* ── Appearance ── */}
      <SettingsCard
        icon={<Palette fontSize="small" />}
        title="Appearance"
        description="Choose a light or dark interface, or follow your device."
      >
        <ToggleButtonGroup
          value={preference}
          exclusive
          onChange={(_, next) => { if (next) setPreference(next); }}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 1.5,
            width: '100%',
            '& .MuiToggleButton-root': {
              flexDirection: 'column',
              gap: 0.75,
              py: 2,
              borderRadius: '10px !important',
              border: `1px solid ${palette.border} !important`,
              color: palette.inkSecondary,
            },
            // MUI's default selected fill is a grey overlay, which loses the brand entirely.
            '& .MuiToggleButton-root.Mui-selected': {
              backgroundColor: palette.primarySoft,
              color: palette.primary,
              borderColor: `${palette.primaryBorder} !important`,
              '&:hover': { backgroundColor: palette.primarySoft },
            },
          }}
        >
          {themeOptions.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.icon}
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ color: palette.inkTertiary, display: 'block', mt: 1.5 }}>
          {preference === 'system'
            ? `Following your device, which is currently ${mode}.`
            : `Always ${preference}.`}
          {' '}This preference is saved on this device.
        </Typography>
      </SettingsCard>

      {ToastHost}
    </PageContainer>
  );
}
