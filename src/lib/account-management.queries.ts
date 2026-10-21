import { queryOptions } from "@tanstack/react-query";

export function manageableAccountsQueryOptions<T>(fetchAccounts: () => Promise<T>) {
  return queryOptions({
    queryKey: ["teriip", "manageable-accounts"],
    queryFn: fetchAccounts,
    staleTime: 30_000,
  });
}
