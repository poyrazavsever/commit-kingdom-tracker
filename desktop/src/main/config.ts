/** Tudi Daily's addresses; TUDI_API_URL and TUDI_APP_URL point a development build at a local API and web app. */
export const DEFAULT_API_URL = 'https://api.tudidaily.com';

export const apiUrl = trim(process.env.TUDI_API_URL || DEFAULT_API_URL);
export const appUrl = trim(process.env.TUDI_APP_URL || 'https://app.tudidaily.com');

/** What tudi-cli calls its api_url: the WakaTime-shaped heartbeat API. */
export const heartbeatApiUrl = (api: string) => `${trim(api)}/api/tracker/v1`;

function trim(url: string): string {
  return url.replace(/\/+$/, '');
}
