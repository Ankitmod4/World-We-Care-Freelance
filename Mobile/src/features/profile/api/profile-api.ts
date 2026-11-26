/**
 * Profile endpoints. Contract: worldwecare.com/docs/features/account.md (Profile section).
 */
import { api } from "@/lib/api";
import type { Account } from "@/types/api-types";

export const profileApi = {
  /** GET /api/user/profile/stats */
  stats: () => api.get<Account.AccountJourneyStatsResponse>("/api/user/profile/stats"),
  /** PATCH /api/user/profile */
  update: (body: Account.AccountUpdateProfileRequest) => api.patch<{ ok: true }>("/api/user/profile", body),
};
