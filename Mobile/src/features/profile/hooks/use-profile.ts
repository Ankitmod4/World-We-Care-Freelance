import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";
import { useSession } from "@/features/auth";
import type { Account } from "@/types/api-types";
import { profileApi } from "../api/profile-api";

/** The signed-in member's profile comes from the session store (loaded at startup). */
export function useMe() {
  return useSession((s) => s.user);
}

export function useJourneyStats() {
  return useQuery({
    queryKey: queryKeys.profile.stats,
    queryFn: async () => (await profileApi.stats()).stats,
  });
}

export function useUpdateProfile() {
  const refresh = useSession((s) => s.refresh);
  return useMutation({
    mutationFn: (body: Account.AccountUpdateProfileRequest) => profileApi.update(body),
    onSuccess: () => refresh(),
  });
}
