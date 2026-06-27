import React from 'react';
import { Box, Typography, LinearProgress, Fade } from '@mui/material';
import { useQueue } from '../context/QueueContext';

const OBSOverlay: React.FC = () => {
  const { currentTrack, progress, requestQueue, streamerPlaylist } = useQueue();

  // Combine queues to show the next 3 tracks
  const upcomingQueue = [...requestQueue, ...streamerPlaylist].slice(0, 3);

  // We don't have exact duration from standard yt without fetching it, 
  // but if we don't have it, we just show indeterminate or just the elapsed time.
  // For now, we'll just show the elapsed time in a nice format and an indeterminate progress bar
  // if duration is not available, or just a static bar.
  
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'flex-end',
      p: 3,
      background: 'transparent'
    }}>
      <Fade in={!!currentTrack}>
        <Box sx={{ 
          bgcolor: 'rgba(30, 31, 34, 0.85)', // Discord/modern dark with opacity
          backdropFilter: 'blur(10px)',
          borderRadius: 4, 
          p: 2, 
          width: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {currentTrack && (
            <>
              <Typography variant="overline" color="primary" fontWeight="bold">
                {currentTrack.isStreamer ? 'СЕЙЧАС ИГРАЕТ' : `ЗАКАЗАЛ ${currentTrack.requestedBy.toUpperCase()}`}
              </Typography>
              <Typography variant="h6" sx={{ color: '#fff', mb: 1, fontWeight: 600, lineHeight: 1.2 }} noWrap>
                {currentTrack.title}
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <LinearProgress 
                  variant="determinate" 
                  value={currentTrack.duration ? Math.min((progress / currentTrack.duration) * 100, 100) : 0}
                  sx={{ flexGrow: 1, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)' }} 
                />
                <Typography variant="caption" sx={{ color: '#ccc', fontWeight: 500 }}>
                  {formatTime(progress)} / {currentTrack.duration ? formatTime(currentTrack.duration) : '∞'}
                </Typography>
              </Box>

              {upcomingQueue.length > 0 && (
                <Box mt={2} pt={2} sx={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1}>
                    СЛЕДУЮЩИЙ ТРЕК
                  </Typography>
                  {upcomingQueue.map((track, i) => (
                    <Box key={track.id} display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', width: 16 }}>
                        {i + 1}.
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#ccc' }} noWrap>
                        {track.title} {track.isStreamer ? '' : `(${track.requestedBy})`}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      </Fade>
    </Box>
  );
};

export default OBSOverlay;