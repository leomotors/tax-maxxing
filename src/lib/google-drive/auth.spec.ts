import { describe, expect, it, vi } from "vitest";

import { AuthError, createTokenRequester, DRIVE_SCOPE, isSessionValid } from "./auth";

type Config = Parameters<
  Parameters<typeof createTokenRequester>[0]["initTokenClient"]
>[0];

/** Fake GIS: every initTokenClient call is recorded so tests can answer each popup. */
function fakeGis(grantedAll = true) {
  const clients: Config[] = [];
  const oauth2 = {
    initTokenClient: vi.fn((config: Config) => {
      clients.push(config);
      return { requestAccessToken: vi.fn() };
    }),
    hasGrantedAllScopes: vi.fn(() => grantedAll),
    revoke: vi.fn((_token: string, done?: (res: { successful: boolean }) => void) =>
      done?.({ successful: true }),
    ),
  };
  return { oauth2, clients };
}

describe("createTokenRequester", () => {
  it("resolves a session with expiry from expires_in", async () => {
    const { oauth2, clients } = fakeGis();
    const promise = createTokenRequester(oauth2, "client-id").requestToken();
    expect(clients[0].scope).toBe(DRIVE_SCOPE);
    clients[0].callback({ access_token: "tok", expires_in: 3600 });
    const session = await promise;
    expect(session.token).toBe("tok");
    expect(isSessionValid(session)).toBe(true);
  });

  it("rejects when the popup is closed (never hangs)", async () => {
    const { oauth2, clients } = fakeGis();
    const promise = createTokenRequester(oauth2, "client-id").requestToken();
    clients[0].error_callback?.({ type: "popup_closed" });
    await expect(promise).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects when the Drive scope was not granted", async () => {
    const { oauth2, clients } = fakeGis(false);
    const promise = createTokenRequester(oauth2, "client-id").requestToken();
    clients[0].callback({ access_token: "tok", expires_in: 3600 });
    await expect(promise).rejects.toThrow("Google Drive");
  });

  it("a late reply to an abandoned popup cannot resolve a newer request", async () => {
    const { oauth2, clients } = fakeGis();
    const requester = createTokenRequester(oauth2, "client-id");
    const first = requester.requestToken();
    const second = requester.requestToken();
    await expect(first).rejects.toThrow("ยกเลิกคำขอก่อนหน้า");

    clients[0].callback({ access_token: "old-account-token", expires_in: 3600 });
    clients[1].callback({ access_token: "new-token", expires_in: 3600 });
    expect((await second).token).toBe("new-token");
  });

  it("reports revoke success or failure", async () => {
    const { oauth2 } = fakeGis();
    const requester = createTokenRequester(oauth2, "client-id");
    expect(await requester.revoke("tok")).toBe(true);
    oauth2.revoke.mockImplementationOnce((_t, done) => done?.({ successful: false }));
    expect(await requester.revoke("tok")).toBe(false);
  });
});

describe("isSessionValid", () => {
  it("treats tokens within the safety margin as expired", () => {
    const now = 1_000_000;
    expect(isSessionValid(null, now)).toBe(false);
    expect(isSessionValid({ token: "t", expiresAt: now + 30_000 }, now)).toBe(false);
    expect(isSessionValid({ token: "t", expiresAt: now + 120_000 }, now)).toBe(true);
  });
});
