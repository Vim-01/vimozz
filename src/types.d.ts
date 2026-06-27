export {};

declare global {
  interface Window {
    electronAPI: {
      getObsWindowId: () => Promise<number>;
      twitchLogin: () => Promise<void>;
      twitchLogout: () => Promise<void>;
      initializeEventSub: (tokens: { accessToken: string; refreshToken: string }) => Promise<{
        success: boolean;
        userId?: string;
        error?: string;
      }>;
      onTwitchAuthSuccess: (callback: (event: any, tokens: any) => void) => void;
      onTwitchAuthError: (callback: (event: any, error: string) => void) => void;
      onRewardRedemption: (callback: (event: any, redemption: any) => void) => void;
    };
  }
}