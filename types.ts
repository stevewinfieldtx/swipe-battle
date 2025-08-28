export type GameState = 'start' | 'playing' | 'end' | 'winners';

export type SwipeDirection = 'left' | 'right';

export interface BattleImage {
  url: string;
  name: string;
}
