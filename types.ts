export type GameState = 'start' | 'playing' | 'end' | 'winners' | 'chat';

export type SwipeDirection = 'left' | 'right';

export interface BattleImage {
  url: string;
  name: string;
}

export interface ModelProfile {
  name: string;
  profileImage: string;
  backgroundStory: string;
  sfwImages: string[];
  nsfwImages: string[];
}

export interface CustomPhotoRequest {
  id: string;
  modelName: string;
  requestText: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  createdAt: string;
}
