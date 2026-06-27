import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface VideoInfo {
  title: string;
  artist: string;
  duration: number;
  audioUrl: string;
  thumbnail: string;
}

export class YouTubeService {
  async getVideoInfo(videoId: string): Promise<VideoInfo> {
    try {
      const { stdout } = await execPromise(
        `yt-dlp --dump-json --format bestaudio "https://youtube.com/watch?v=${videoId}"`
      );
      
      const info = JSON.parse(stdout);
      
      return {
        title: info.title,
        artist: info.uploader,
        duration: info.duration,
        audioUrl: info.url,
        thumbnail: info.thumbnail
      };
    } catch (error) {
      console.error('Error getting video info:', error);
      throw error;
    }
  }
}