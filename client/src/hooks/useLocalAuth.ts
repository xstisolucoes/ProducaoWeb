import { useCallback } from "react";
import { trpc } from "@/lib/trpc";

export function useLocalAuth() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.localAuth.logout.useMutation({
    onSuccess: async () => {
      utils.localAuth.me.setData(undefined, null);
      await utils.production.invalidate();
    },
  });
  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation]);
  return {
    user: me.data ?? null,
    loading: me.isLoading || logoutMutation.isPending,
    error: me.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(me.data),
    logout,
    refresh: me.refetch,
  };
}
