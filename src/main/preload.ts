const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getObsWindowId: () => ipcRenderer.invoke('get-obs-window-id'),

  twitchLogin: (silent: boolean = false) => ipcRenderer.invoke('twitch-login', silent),
  twitchLogout: () => ipcRenderer.invoke('twitch-logout'),

  initializeEventSub: (tokens: any) => ipcRenderer.invoke('initialize-eventsub', tokens),
  startVless: (url: string) => ipcRenderer.invoke('start-vless', url),
  stopVless: () => ipcRenderer.invoke('stop-vless'),
  fetchYoutubeTitle: (videoId: string) => ipcRenderer.invoke('fetch-youtube-title', videoId),
  getCustomRewards: () => ipcRenderer.invoke('get-custom-rewards'),

  onTwitchAuthSuccess: (callback: any) => {
    ipcRenderer.on('twitch-auth-success', callback);
  },
  onTwitchAuthError: (callback: any) => {
    ipcRenderer.on('twitch-auth-error', callback);
  },
  onTwitchAuthInteractionRequired: (callback: any) => {
    ipcRenderer.on('twitch-auth-interaction-required', callback);
  },
  onRewardRedemption: (callback: any) => {
    ipcRenderer.on('reward-redemption', (event, data) => callback(event, data));
  }
});