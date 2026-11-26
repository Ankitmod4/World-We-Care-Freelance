/**
 * Session state machine. The root layout routes on `status`:
 *
 *   loading     → splash screen stays up
 *   signedOut   → (auth) stack: login / signup / forgot password
 *   unverified  → verify-email gate (backend middleware blocks most APIs with 403)
 *   signedIn    → (app) stack: tabs and everything else
 *
 * The session itself lives in HttpOnly cookies held by the native networking
 * layer, so this store only keeps what the UI needs: the status and the profile.
 */
import { create } from "zustand";
import { isApiError, queryClient, setUnauthorizedHandler } from "@/lib/api";
import type { Account } from "@/types/api-types";
import { authApi } from "../api/auth-api";

export type SessionStatus = "loading" | "signedOut" | "unverified" | "signedIn";

interface SessionState {
  status: SessionStatus;
  user: Account.AccountMyProfile | null;
  /** Asks the backend who we are and sets the status. Safe to call any time. */
  refresh: () => Promise<SessionStatus>;
  /** Call after a successful login or signup. */
  afterSignIn: () => Promise<SessionStatus>;
  /** Signs out on the server (best effort) and wipes local state. */
  signOut: () => Promise<void>;
  /** Wipes local state only (used when the server already said 401). */
  clearLocal: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  status: "loading",
  user: null,

  refresh: async () => {
    try {
      const { profile } = await authApi.me();
      const status: SessionStatus = profile ? "signedIn" : "signedOut";
      set({ status, user: profile });
      return status;
    } catch (e) {
      const status: SessionStatus = isApiError(e) && e.needsVerification ? "unverified" : "signedOut";
      set({ status, user: null });
      return status;
    }
  },

  afterSignIn: async () => {
    try {
      // Mints the wwc-user-verified cookie if the email is already confirmed.
      await authApi.refreshVerified();
    } catch {
      // The profile call below decides the final status either way.
    }
    return get().refresh();
  },

  signOut: async () => {
    try {
      await authApi.logout();
    } catch {
      // Offline: still sign out locally. The cookie expires on its own.
    }
    get().clearLocal();
  },

  clearLocal: () => {
    queryClient.clear();
    set({ status: "signedOut", user: null });
  },
}));

// Any 401 from any endpoint means the session is gone (expired, revoked, banned).
setUnauthorizedHandler(() => {
  if (useSession.getState().status === "signedIn") useSession.getState().clearLocal();
});
