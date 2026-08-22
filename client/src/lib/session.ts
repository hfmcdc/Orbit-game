const KEY = "orbit_session";

export interface StoredSession {
  roomCode: string;
  playerId: string;
  nickname: string;
}

export function saveSession(session: StoredSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors (private browsing, etc.)
  }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
