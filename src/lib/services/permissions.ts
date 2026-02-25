// Chrome Extension Permission Helper
// Handles dynamic host permission requests for non-localhost Clash API hosts

const LOCALHOST_HOSTS = ['127.0.0.1', 'localhost', '::1'];

/**
 * Check if a host is localhost (already granted in manifest host_permissions)
 */
export function isLocalhostHost(host: string): boolean {
  return LOCALHOST_HOSTS.includes(host.toLowerCase());
}

/**
 * Build a Chrome match pattern origin for a given host.
 * E.g. "192.168.1.100" becomes "http://192.168.1.100:*&#47;*"
 */
function buildOriginPattern(host: string): string {
  return `http://${host}:*/*`;
}

/**
 * Check if the extension already has permission to access a given host.
 * Returns true for localhost hosts (always granted) or if permission was previously granted.
 */
export async function hasHostPermission(host: string): Promise<boolean> {
  if (isLocalhostHost(host)) return true;

  return new Promise((resolve) => {
    chrome.permissions.contains(
      { origins: [buildOriginPattern(host)] },
      (result: boolean) => {
        if (chrome.runtime.lastError) {
          console.warn('Permission check failed:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          resolve(result);
        }
      },
    );
  });
}

/**
 * Request host permission for a non-localhost Clash API host.
 * Must be called from a user gesture context (e.g. button click).
 * Returns true if permission was granted, false if denied or already localhost.
 */
export async function requestHostPermission(host: string): Promise<boolean> {
  if (isLocalhostHost(host)) return true;

  return new Promise((resolve) => {
    chrome.permissions.request(
      { origins: [buildOriginPattern(host)] },
      (granted: boolean) => {
        if (chrome.runtime.lastError) {
          console.warn('Permission request failed:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          resolve(granted);
        }
      },
    );
  });
}

/**
 * Ensure we have permission for a host. If not, request it.
 * Returns true if permission is available (already had or just granted).
 */
export async function ensureHostPermission(host: string): Promise<boolean> {
  if (await hasHostPermission(host)) return true;
  return requestHostPermission(host);
}
