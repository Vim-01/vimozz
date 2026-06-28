import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Button, Paper, List, ListItem, ListItemText,
  IconButton, Divider, Chip, TextField, Slider, Tabs, Tab, Switch, FormControlLabel,
  Card, CardContent, Select, MenuItem, FormControl, InputLabel,
  Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import {
  PlayArrow, Pause, SkipNext, VolumeUp, Settings, QueueMusic, Link as LinkIcon
} from '@mui/icons-material';
import { useQueue, Track } from '../context/QueueContext';
import { YouTubePlayer } from '../components/YouTubePlayer';

const extractVideoId = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
};

const StreamerPanel: React.FC = () => {
  const [tab, setTab] = useState(0);
  const { 
    requestQueue, streamerPlaylist, currentTrack, isPlaying, 
    progress, volume, addStreamerTrack, removeRequest, 
    removeStreamerTrack, playNext, togglePlayPause, setVolume, skipTrack,
    selectedRewardId, setSelectedRewardId
  } = useQueue();

  const [streamerUrl, setStreamerUrl] = useState('');
  const [vlessUrl, setVlessUrl] = useState('');
  const [useVless, setUseVless] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'info'}>({open: false, message: '', severity: 'info'});
  
  const [authWarningOpen, setAuthWarningOpen] = useState(false);

  const showNotification = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    if ((window as any).electronAPI) {
      // Trigger silent auth on mount
      (window as any).electronAPI.twitchLogin(true);

      (window as any).electronAPI.onTwitchAuthSuccess(async (_event: any, tokens: any) => {
        showNotification('Авторизация успешна! Инициализация EventSub...', 'info');
        const res = await (window as any).electronAPI.initializeEventSub(tokens);
        if (res.success) {
          showNotification('EventSub успешно запущен! Награды можно загружать.', 'success');
        } else {
          showNotification(`Ошибка запуска EventSub: ${res.error}`, 'error');
        }
      });

      (window as any).electronAPI.onTwitchAuthError((_event: any, error: string) => {
        showNotification(`Ошибка авторизации Twitch: ${error}`, 'error');
      });

      (window as any).electronAPI.onTwitchAuthInteractionRequired(() => {
        // Silent auth failed, user must login manually
        console.log('Silent auth failed, user interaction required.');
      });

      (window as any).electronAPI.onRewardRedemption((_event: any, data: any) => {
        if (!selectedRewardId || selectedRewardId === '' || selectedRewardId === data.rewardId) {
          showNotification(`Выкуп награды от ${data.userName}!`, 'info');
        }
      });
    }
  }, [selectedRewardId]);

  const fetchRewards = async () => {
    if ((window as any).electronAPI) {
      const rwds = await (window as any).electronAPI.getCustomRewards();
      if (!rwds.error) {
        setRewards(rwds);
        showNotification('Награды успешно загружены!', 'success');
      } else {
        console.error(rwds.error);
        showNotification(`Ошибка загрузки наград: ${rwds.error}`, 'error');
      }
    }
  };

  const handleAddStreamerTrack = () => {
    const id = extractVideoId(streamerUrl);
    if (id) {
      addStreamerTrack(id, `Streamer Track (${id})`);
      setStreamerUrl('');
    }
  };

  const handleVlessToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setUseVless(checked);
    if (checked && vlessUrl) {
      if ((window as any).electronAPI) {
        const res = await (window as any).electronAPI.startVless(vlessUrl);
        if (res.success) {
          showNotification('VLESS прокси успешно запущен и применен к YouTube!', 'success');
        } else {
          showNotification(`Ошибка запуска VLESS: ${res.error}`, 'error');
          setUseVless(false);
        }
      }
    } else {
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.stopVless();
        showNotification('VLESS прокси отключен', 'info');
      }
    }
  };

  const applyVless = async () => {
    if (!vlessUrl) {
      showNotification('Введите ссылку VLESS', 'error');
      return;
    }
    setUseVless(true);
    if ((window as any).electronAPI) {
      const res = await (window as any).electronAPI.startVless(vlessUrl);
      if (res.success) {
        showNotification('VLESS прокси успешно применен!', 'success');
      } else {
        showNotification(`Ошибка запуска VLESS: ${res.error}`, 'error');
        setUseVless(false);
      }
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const proceedToTwitchLogin = async () => {
    setAuthWarningOpen(false);
    showNotification('Ожидание авторизации...', 'info');
    await (window as any).electronAPI?.twitchLogin(false);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <YouTubePlayer />
      
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold" color="primary">vimozz</Typography>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} textColor="primary" indicatorColor="primary">
          <Tab icon={<QueueMusic />} label="Dashboard" />
          <Tab icon={<Settings />} label="Settings" />
        </Tabs>
      </Box>

      {tab === 0 && (
        <Box flexGrow={1} display="flex" flexDirection="column" gap={3} sx={{ overflowY: 'auto' }}>
          {/* Player Card */}
          <Card elevation={0} sx={{ bgcolor: 'background.paper', borderRadius: 4, p: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                CURRENTLY PLAYING
              </Typography>
              <Typography variant="h5" mb={1} noWrap>
                {currentTrack ? currentTrack.title : 'Nothing playing'}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Chip 
                  label={currentTrack?.isStreamer ? 'Streamer' : currentTrack ? `Requested by ${currentTrack.requestedBy}` : '...'} 
                  color={currentTrack?.isStreamer ? 'default' : 'primary'}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  {formatTime(progress)} / {currentTrack?.duration ? formatTime(currentTrack.duration) : '∞'}
                </Typography>
              </Box>

              <Box display="flex" alignItems="center" gap={2}>
                <IconButton color="primary" onClick={togglePlayPause} size="large" sx={{ bgcolor: 'primary.dark', '&:hover': { bgcolor: 'primary.main' }}}>
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
                <IconButton color="secondary" onClick={skipTrack}>
                  <SkipNext />
                </IconButton>
                <Box display="flex" alignItems="center" gap={1} flexGrow={1} ml={2}>
                  <VolumeUp color="action" />
                  <Slider 
                    value={volume} 
                    onChange={(_, v) => setVolume(v as number)} 
                    aria-label="Volume" 
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Add Streamer Track */}
          <Box display="flex" gap={2}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Paste YouTube URL for Streamer Playlist..."
              value={streamerUrl}
              onChange={(e) => setStreamerUrl(e.target.value)}
              InputProps={{
                startAdornment: <LinkIcon color="action" sx={{ mr: 1 }}/>,
                sx: { borderRadius: 3 }
              }}
            />
            <Button variant="contained" onClick={handleAddStreamerTrack} sx={{ borderRadius: 3 }}>
              Add
            </Button>
          </Box>

          {/* Queues */}
          <Box display="flex" gap={2} flexGrow={1} minHeight={0}>
            {/* User Requests */}
            <Paper elevation={0} sx={{ flex: 1, p: 2, borderRadius: 4, overflowY: 'auto' }}>
              <Typography variant="h6" mb={2}>Viewers Queue</Typography>
              <List>
                {requestQueue.map((track) => (
                  <ListItem key={track.id} sx={{ bgcolor: 'background.default', mb: 1, borderRadius: 2 }}>
                    <ListItemText primary={track.title} secondary={`Req by ${track.requestedBy}`} />
                    <Button size="small" color="error" onClick={() => removeRequest(track.id)}>Remove</Button>
                  </ListItem>
                ))}
                {requestQueue.length === 0 && <Typography color="text.secondary">Empty</Typography>}
              </List>
            </Paper>

            {/* Streamer Playlist */}
            <Paper elevation={0} sx={{ flex: 1, p: 2, borderRadius: 4, overflowY: 'auto' }}>
              <Typography variant="h6" mb={2}>Streamer Playlist</Typography>
              <List>
                {streamerPlaylist.map((track) => (
                  <ListItem key={track.id} sx={{ bgcolor: 'background.default', mb: 1, borderRadius: 2 }}>
                    <ListItemText primary={track.title} />
                    <Button size="small" color="error" onClick={() => removeStreamerTrack(track.id)}>Remove</Button>
                  </ListItem>
                ))}
                {streamerPlaylist.length === 0 && <Typography color="text.secondary">Empty</Typography>}
              </List>
            </Paper>
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4 }}>
          <Typography variant="h6" mb={3}>Network Proxy (VLESS)</Typography>
          <FormControlLabel
            control={<Switch checked={useVless} onChange={handleVlessToggle} color="primary" />}
            label="Enable VLESS Proxy for YouTube"
          />
          {useVless && (
            <TextField
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              label="vless:// URL"
              margin="normal"
              value={vlessUrl}
              onChange={(e) => setVlessUrl(e.target.value)}
              sx={{ mt: 2 }}
            />
          )}
          {useVless && (
            <Button variant="contained" onClick={applyVless} sx={{ mt: 2 }}>
              Apply & Connect
            </Button>
          )}

          <Divider sx={{ my: 4 }} />
          
          <Typography variant="h6" mb={3}>Twitch Settings</Typography>
          <Button variant="outlined" color="primary" onClick={() => setAuthWarningOpen(true)} sx={{ mb: 2, mr: 2 }}>
            Login with Twitch
          </Button>
          <Button variant="outlined" color="secondary" onClick={fetchRewards} sx={{ mb: 2 }}>
            Refresh Rewards
          </Button>
          
          <Box mt={2}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Music Request Reward</InputLabel>
              <Select
                value={selectedRewardId}
                onChange={(e) => setSelectedRewardId(e.target.value as string)}
                label="Music Request Reward"
              >
                <MenuItem value="">
                  <em>Any Reward (Testing)</em>
                </MenuItem>
                {rewards.map(r => (
                  <MenuItem key={r.id} value={r.id}>{r.title} ({r.cost} pts)</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Typography variant="body2" color="text.secondary" mt={2}>
            Twitch Application authorization is fully managed. No Client Secret required.
          </Typography>
        </Paper>
      )}

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar({...snackbar, open: false})}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({...snackbar, open: false})} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog open={authWarningOpen} onClose={() => setAuthWarningOpen(false)}>
        <DialogTitle>Внимание: Политика безопасности</DialogTitle>
        <DialogContent>
          <DialogContentText>
            В целях безопасности ваш токен авторизации сбрасывается каждые 60 дней. Приложение будет пытаться автоматически продлить его при каждом запуске, но иногда может потребоваться повторный ручной вход.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuthWarningOpen(false)}>Отмена</Button>
          <Button onClick={proceedToTwitchLogin} variant="contained" autoFocus>
            Понятно, войти
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StreamerPanel;