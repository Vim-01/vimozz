import { StaticAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import axios from 'axios';

export interface RewardRedemption {
  id: string;
  userId: string;
  userName: string;
  rewardId: string;
  rewardTitle: string;
  userInput: string;
  status: string;
}

export class EventSubService {
  private authProvider: StaticAuthProvider | null = null;
  private apiClient: ApiClient | null = null;
  private eventSubListener: EventSubWsListener | null = null;
  private onRewardRedemption: ((redemption: RewardRedemption) => void) | null = null;
  private userId: string | null = null;

  constructor() {
    console.log('EventSubService initialized');
  }

  async initialize(accessToken: string, clientId: string): Promise<string> {
    try {
      console.log('Initializing EventSub with token...');

      this.authProvider = new StaticAuthProvider(clientId, accessToken);

      this.apiClient = new ApiClient({ authProvider: this.authProvider });

      // Get userId through Twitch API request
      const response = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': clientId
        }
      });

      if (response.data.data && response.data.data.length > 0) {
        this.userId = response.data.data[0].id;
        console.log('Authenticated as:', response.data.data[0].login, 'ID:', this.userId);
      } else {
        throw new Error('Could not get user info from Twitch API');
      }

      // Create EventSub WebSocket listener
      this.eventSubListener = new EventSubWsListener({ apiClient: this.apiClient });
      this.eventSubListener.start();

      console.log('EventSub initialized successfully');
      
      return this.userId!;
    } catch (error) {
      console.error('Error initializing EventSub:', error);
      throw error;
    }
  }

  setRewardRedemptionCallback(callback: (redemption: RewardRedemption) => void): void {
    this.onRewardRedemption = callback;
  }

  async listenToChannelPoints(): Promise<void> {
    if (!this.eventSubListener || !this.userId) {
      throw new Error('EventSub listener or userId not initialized');
    }

    try {
      console.log('Listening to channel point redemptions for user:', this.userId);

      // Listen to channel point rewards
      this.eventSubListener.onChannelRedemptionAdd(this.userId, (redemption) => {
        console.log('Reward redeemed:', redemption.rewardTitle, 'by', redemption.userName);

        const redemptionData: RewardRedemption = {
          id: redemption.id,
          userId: redemption.userId,
          userName: redemption.userName,
          rewardId: redemption.rewardId,
          rewardTitle: redemption.rewardTitle,
          userInput: redemption.input,
          status: redemption.status
        };

        if (this.onRewardRedemption) {
          this.onRewardRedemption(redemptionData);
        }
      });

      console.log('Successfully listening to channel point redemptions');
    } catch (error) {
      console.error('Error listening to channel points:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (this.eventSubListener) {
      this.eventSubListener.stop();
      console.log('Stopped listening to channel points');
    }
  }

  getUserId(): string | null {
    return this.userId;
  }

  async getCustomRewards(): Promise<any[]> {
    if (!this.userId || !this.authProvider) {
      throw new Error('Not initialized');
    }
    
    try {
      const rewards = await this.apiClient?.channelPoints.getCustomRewards(this.userId);
      return rewards ? rewards.map(r => ({
        id: r.id,
        title: r.title,
        prompt: r.prompt,
        cost: r.cost,
        isEnabled: r.isEnabled,
        isUserInputRequired: r.userInputRequired
      })) : [];
    } catch (e) {
      console.error('Error fetching custom rewards via twurple API Client:', e);
      return [];
    }
  }
}