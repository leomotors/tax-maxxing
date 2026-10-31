export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const GIS_SRC = "https://accounts.google.com/gsi/client";
/** Treat tokens as expired this long before Google does. */
const EXPIRY_MARGIN_MS = 60_000;

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (res: TokenResponse) => void;
    error_callback?: (err: { type: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(res: TokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: (res: { successful: boolean }) => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

export class AuthError extends Error {}

let scriptPromise: Promise<GoogleOAuth2> | null = null;

/** Load GIS ahead of the click: awaiting it inside the click loses the popup gesture. */
export function loadGis(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google.accounts.oauth2);
  }
  scriptPromise ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) return resolve(oauth2);
      scriptPromise = null;
      reject(new AuthError("โหลด Google Sign-In ไม่สำเร็จ"));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new AuthError("โหลด Google Sign-In ไม่สำเร็จ (ตรวจสอบการเชื่อมต่อ/ตัวบล็อกโฆษณา)"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface DriveSession {
  token: string;
  expiresAt: number;
}

export function isSessionValid(session: DriveSession | null, now = Date.now()) {
  return Boolean(session && session.expiresAt - EXPIRY_MARGIN_MS > now);
}

/**
 * Wraps GIS token requests. `requestToken` must be called synchronously from a
 * click handler (no `await` before it) or browsers block the popup.
 */
export function createTokenRequester(oauth2: GoogleOAuth2, clientId: string) {
  let cancelPrevious: (() => void) | null = null;

  return {
    requestToken(): Promise<DriveSession> {
      cancelPrevious?.();
      return new Promise<DriveSession>((resolve, reject) => {
        let done = false;
        const settle = (fn: () => void) => {
          if (done) return;
          done = true;
          fn();
        };
        cancelPrevious = () => settle(() => reject(new AuthError("ยกเลิกคำขอก่อนหน้า")));
        // A client per request: GIS has one callback per client, so a late reply to an
        // abandoned popup must not resolve a newer request (possibly another account).
        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (res) =>
            settle(() => {
              if (res.error || !res.access_token) {
                reject(new AuthError(res.error_description || "ไม่ได้รับอนุญาตจาก Google"));
              } else if (!oauth2.hasGrantedAllScopes(res, DRIVE_SCOPE)) {
                reject(new AuthError("ต้องอนุญาตสิทธิ์เข้าถึงไฟล์ Google Drive"));
              } else {
                resolve({
                  token: res.access_token,
                  expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000,
                });
              }
            }),
          // Popup closed / blocked: without this the UI would wait forever.
          error_callback: (err) =>
            settle(() =>
              reject(
                new AuthError(
                  err.type === "popup_closed"
                    ? "ยกเลิกการเข้าสู่ระบบ"
                    : "เปิดหน้าต่าง Google ไม่ได้ (ป๊อปอัปถูกบล็อก?)",
                ),
              ),
            ),
        });
        client.requestAccessToken({ prompt: "" });
      });
    },
    revoke(token: string): Promise<boolean> {
      return new Promise((resolve) => oauth2.revoke(token, (res) => resolve(Boolean(res?.successful))));
    },
  };
}
