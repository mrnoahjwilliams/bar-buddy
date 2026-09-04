export interface ApiAuthBridge {
  getAccessToken(forceRefresh: boolean): Promise<string | undefined>;
  handleUnauthorized(): Promise<void>;
}

let authBridge: ApiAuthBridge | undefined;

export function setApiAuthBridge(bridge: ApiAuthBridge | undefined) {
  authBridge = bridge;
}

export function getApiAuthBridge() {
  return authBridge;
}
