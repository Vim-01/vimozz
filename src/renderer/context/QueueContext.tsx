import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface Track {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  requestedBy: string; // "Streamer" or viewer's name
  isStreamer: boolean;
  thumbnail?: string;
  resumeProgress?: number; // Added to track where to resume
}

interface QueueState {
  streamerPlaylist: Track[];
  requestQueue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // in seconds
  volume: number;
}

interface QueueContextType extends QueueState {
  addRequest: (videoId: string, requestedBy: string, title?: string) => void;
  addStreamerTrack: (videoId: string, title?: string) => void;
  removeRequest: (id: string) => void;
  removeStreamerTrack: (id: string) => void;
  playNext: () => void;
  togglePlayPause: () => void;
  setVolume: (vol: number) => void;
  updateProgress: (prog: number) => void;
  updateDuration: (dur: number) => void;
  skipTrack: () => void;
}

const defaultState: QueueState = {
  streamerPlaylist: [],
  requestQueue: [],
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  volume: 50,
};

const QueueContext = createContext<QueueContextType | undefined>(undefined);

const BROADCAST_CHANNEL_NAME = 'trula_queue_sync';

export const QueueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<QueueState>(() => {
    const saved = localStorage.getItem('queue_state');
    return saved ? JSON.parse(saved) : defaultState;
  });

  const channelRef = React.useRef<BroadcastChannel | null>(null);

  const isRemoteUpdate = React.useRef(false);

  useEffect(() => {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_STATE') {
        isRemoteUpdate.current = true;
        setState(event.data.state);
      }
    };
    
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    localStorage.setItem('queue_state', JSON.stringify(state));
    try {
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'SYNC_STATE', state });
      }
    } catch (e) {
      console.warn('BroadcastChannel postMessage failed:', e);
    }
  }, [state]);

  const fetchYoutubeTitle = async (videoId: string): Promise<string> => {
    if ((window as any).electronAPI) {
      return await (window as any).electronAPI.fetchYoutubeTitle(videoId);
    }
    return 'Unknown Title';
  };

  const addRequest = useCallback(async (videoId: string, requestedBy: string) => {
    const title = await fetchYoutubeTitle(videoId);
    const newTrack: Track = { id: uuidv4(), videoId, requestedBy, title, artist: '', duration: 0, isStreamer: false };
    setState(prev => {
      const newState = { ...prev };
      
      if (!prev.currentTrack) {
        newState.currentTrack = newTrack;
        newState.isPlaying = true;
        newState.progress = 0;
      } else if (prev.currentTrack.isStreamer) {
        // Instant interrupt: save current streamer track to front of streamerPlaylist with current progress
        const interruptedTrack = { ...prev.currentTrack, resumeProgress: prev.progress };
        newState.streamerPlaylist = [interruptedTrack, ...prev.streamerPlaylist];
        newState.currentTrack = newTrack;
        newState.isPlaying = true;
        newState.progress = 0;
      } else {
        // Just add to queue if viewer track is playing
        newState.requestQueue = [...prev.requestQueue, newTrack];
      }
      return newState;
    });
  }, []);

  const addStreamerTrack = useCallback(async (videoId: string) => {
    const title = await fetchYoutubeTitle(videoId);
    const newTrack: Track = { id: uuidv4(), videoId, requestedBy: 'Streamer', title, artist: '', duration: 0, isStreamer: true };
    setState(prev => {
      const newState = { ...prev, streamerPlaylist: [...prev.streamerPlaylist, newTrack] };
      if (!prev.currentTrack && prev.requestQueue.length === 0) {
        newState.currentTrack = newTrack;
        newState.streamerPlaylist = prev.streamerPlaylist;
        newState.isPlaying = true;
        newState.progress = 0;
      }
      return newState;
    });
  }, []);

  const playNext = useCallback(() => {
    setState(prev => {
      const newState = { ...prev };
      if (prev.requestQueue.length > 0) {
        const next = prev.requestQueue[0];
        newState.requestQueue = prev.requestQueue.slice(1);
        newState.currentTrack = next;
        newState.isPlaying = true;
        newState.progress = next.resumeProgress || 0;
      } else if (prev.streamerPlaylist.length > 0) {
        const next = prev.streamerPlaylist[0];
        newState.streamerPlaylist = prev.streamerPlaylist.slice(1);
        newState.currentTrack = next;
        newState.isPlaying = true;
        newState.progress = next.resumeProgress || 0;
      } else {
        newState.currentTrack = null;
        newState.isPlaying = false;
        newState.progress = 0;
      }
      return newState;
    });
  }, []);

  const removeRequest = useCallback((id: string) => {
    setState(prev => {
      if (prev.currentTrack?.id === id) {
        setTimeout(() => playNext(), 0);
      }
      return { ...prev, requestQueue: prev.requestQueue.filter(t => t.id !== id) };
    });
  }, [playNext]);

  const removeStreamerTrack = useCallback((id: string) => {
    setState(prev => {
      if (prev.currentTrack?.id === id) {
        setTimeout(() => playNext(), 0);
      }
      return { ...prev, streamerPlaylist: prev.streamerPlaylist.filter(t => t.id !== id) };
    });
  }, [playNext]);

  const togglePlayPause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    setState(prev => ({ ...prev, volume: vol }));
  }, []);

  const updateProgress = useCallback((prog: number) => {
    setState(prev => ({ ...prev, progress: prog }));
  }, []);

  const updateDuration = useCallback((dur: number) => {
    setState(prev => {
      if (prev.currentTrack && prev.currentTrack.duration !== dur) {
        return {
          ...prev,
          currentTrack: { ...prev.currentTrack, duration: dur }
        };
      }
      return prev;
    });
  }, []);

  const skipTrack = useCallback(() => {
    playNext();
  }, [playNext]);

  // IPC listener for Twitch Redemptions
  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.onRewardRedemption((event: any, redemption: any) => {
        // Attempt to extract videoId from userInput
        const urlMatch = redemption.userInput.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        const videoId = urlMatch ? urlMatch[1] : null;
        if (videoId) {
           addRequest(videoId, redemption.userName);
        }
      });
    }
  }, [addRequest]);

  return (
    <QueueContext.Provider value={{
      ...state,
      addRequest,
      addStreamerTrack,
      removeRequest,
      removeStreamerTrack,
      playNext,
      togglePlayPause,
      setVolume,
      updateProgress,
      updateDuration,
      skipTrack
    }}>
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (context === undefined) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};
