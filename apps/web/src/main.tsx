import type { ApiResponseMeta } from '@placement-platform/contracts';

export interface WebClientState {
  app: string;
  status: 'ready' | 'loading';
  lastPing?: ApiResponseMeta;
}

export function getInitialClientState(): WebClientState {
  return {
    app: 'placement-platform-web',
    status: 'ready',
  };
}
