/** What Tudi Desktop reads with its device key (`GET /api/tracker/desktop/summary`). */
export type TrackerToday = {
  date: string;
  rawMinutes: number;
  humanMinutes: number;
  aiMinutes: number;
  weightedMinutes: number;
  rewardedMinutes: number;
  dailyCap: number;
  languages: Record<string, number>;
};

export type Summary = {
  deviceId: string;
  deviceName: string;
  today: TrackerToday;
  week: { date: string; weightedMinutes: number; rewardedMinutes: number }[];
  lastHeartbeatAt: string | null;
};

/** The key was removed (from the app's Code Tower, or the account is gone): Tudi Desktop asks to sign in again. */
export class KeyRevoked extends Error {
  constructor() {
    super('This computer was removed from the account.');
  }
}

export class DesktopApi {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async summary(): Promise<Summary> {
    return (await this.send('GET', '/summary')).json() as Promise<Summary>;
  }

  async rename(name: string): Promise<void> {
    await this.send('PATCH', '/device', { name });
  }

  /** Removes this computer from the account; an already removed key counts as signed out. */
  async signOut(): Promise<void> {
    try {
      await this.send('DELETE', '/device');
    } catch (error) {
      if (!(error instanceof KeyRevoked)) throw error;
    }
  }

  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    const response = await this.fetchImpl(`${this.apiUrl}/api/tracker/desktop${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401) throw new KeyRevoked();
    if (!response.ok) throw new Error(`Tudi Daily answered ${response.status}.`);
    return response;
  }
}
