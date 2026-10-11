import type { ApiResponseMeta } from '@placement-platform/contracts';

export interface ApiServerStatus {
  service: string;
  version: string;
  meta: ApiResponseMeta;
}

export function getInitialServerStatus(): ApiServerStatus {
  return {
    service: 'placement-platform-api',
    version: '0.1.0',
    meta: {
      requestId: 'bootstrap-init',
      timestamp: new Date().toISOString(),
    },
  };
}
