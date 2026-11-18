/**
 * Who is logged in. The server tells us how (GET api/config):
 * - no server reachable: local-only mode (plans stay on this device);
 * - auth enabled: OpenID Connect, Authorization Code + PKCE, with the
 *   provider from the server's settings (no secrets in the app);
 * - auth disabled (development only): pick a dev user, sent as X-Dev-User.
 */
import { reactive } from 'vue';
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

export interface ServerConfig {
  authEnabled: boolean;
  authority: string | null;
  clientId: string | null;
  scopes: string;
  devUsers?: string[];
}

export interface Me {
  id: string;
  name: string;
  email: string;
}

export const apiUrl = (path: string) => new URL(`api/${path}`, document.baseURI).toString();

const DEV_KEY = 'fp.devUser';

export const auth = reactive({
  /** False until init() has finished. */
  ready: false,
  /** A server answered api/config. */
  server: false,
  config: null as ServerConfig | null,
  me: null as Me | null,
  devUser: null as string | null,
  error: '',
});

let manager: UserManager | null = null;
let token: string | null = null;

/** The address the provider sends you back to: the app itself. */
const redirectUri = () => new URL('./', document.baseURI).toString();

/** Headers for an API call as the current user. */
export function authHeaders(): Record<string, string> {
  if (token) return { Authorization: `Bearer ${token}` };
  if (auth.devUser) return { 'X-Dev-User': auth.devUser };
  return {};
}

async function loadMe() {
  const res = await fetch(apiUrl('me'), { headers: authHeaders() });
  auth.me = res.ok ? ((await res.json()) as Me) : null;
}

export async function initAuth(): Promise<void> {
  try {
    const res = await fetch(apiUrl('config'));
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(`HTTP ${res.status}`);
    auth.config = (await res.json()) as ServerConfig;
    auth.server = true;
  } catch {
    auth.server = false; // no backend: local-only
    auth.ready = true;
    return;
  }

  const cfg = auth.config!;
  try {
    if (!cfg.authEnabled) {
      try {
        auth.devUser = localStorage.getItem(DEV_KEY);
      } catch {
        // storage unavailable
      }
      if (auth.devUser) await loadMe();
    } else if (cfg.authority && cfg.clientId) {
      manager = new UserManager({
        authority: cfg.authority,
        client_id: cfg.clientId,
        redirect_uri: redirectUri(),
        post_logout_redirect_uri: redirectUri(),
        response_type: 'code',
        scope: cfg.scopes || 'openid profile email',
        automaticSilentRenew: true,
        userStore: new WebStorageStateStore({ store: window.localStorage }),
      });
      manager.events.addUserLoaded((u) => {
        token = u.access_token;
      });
      manager.events.addUserUnloaded(() => {
        token = null;
        auth.me = null;
      });
      const q = new URLSearchParams(location.search);
      if (q.has('code') && q.has('state')) {
        // Back from the provider: finish signing in and clean the address bar.
        const u = await manager.signinRedirectCallback();
        token = u.access_token;
        const back = (u.state as string | undefined) ?? '';
        history.replaceState(null, '', redirectUri() + back);
      } else {
        const u = await manager.getUser();
        if (u && !u.expired) token = u.access_token;
      }
      if (token) await loadMe();
    }
  } catch (e) {
    auth.error = `Sign-in failed: ${e instanceof Error ? e.message : e}`;
  }
  auth.ready = true;
}

export async function login(devUser?: string) {
  if (auth.config && !auth.config.authEnabled) {
    auth.devUser = devUser ?? auth.config.devUsers?.[0] ?? 'dev';
    try {
      localStorage.setItem(DEV_KEY, auth.devUser);
    } catch {
      // storage unavailable
    }
    await loadMe();
    return;
  }
  await manager?.signinRedirect({ state: location.hash });
}

export async function logout() {
  if (auth.config && !auth.config.authEnabled) {
    auth.devUser = null;
    auth.me = null;
    try {
      localStorage.removeItem(DEV_KEY);
    } catch {
      // storage unavailable
    }
    return;
  }
  token = null;
  auth.me = null;
  await manager?.signoutRedirect().catch(() => manager?.removeUser());
}
