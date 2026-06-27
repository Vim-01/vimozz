import React, { useRef, useEffect } from 'react';
import ReactPlayer from 'react-player/youtube';
import { useQueue } from '../context/QueueContext';

export const YouTubePlayer: React.FC = () => {
  const { currentTrack, isPlaying, volume, playNext, updateProgress, updateDuration } = useQueue();
  const playerRef = useRef<ReactPlayer>(null);

  useEffect(() => {
    // Resume progress if needed
    if (currentTrack?.resumeProgress && playerRef.current) {
      // Small delay to ensure player is ready before seeking
      setTimeout(() => {
        playerRef.current?.seekTo(currentTrack.resumeProgress || 0, 'seconds');
      }, 500);
    }
  }, [currentTrack?.id]);

  const handleProgress = (state: { playedSeconds: number }) => {
    updateProgress(state.playedSeconds);
  };

  const handleEnded = () => {
    playNext();
  };

  if (!currentTrack) return null;

  return (
    <div style={{ position: 'absolute', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
      <ReactPlayer
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${currentTrack.videoId}`}
        playing={isPlaying}
        volume={volume / 100}
        onProgress={handleProgress}
        onDuration={(duration) => updateDuration(duration)}
        onEnded={handleEnded}
        progressInterval={1000}
        config={{
          youtube: {
            playerVars: { showinfo: 1 }
          }
        }}
      />
    </div>
  );
};