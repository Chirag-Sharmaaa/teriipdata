import { queryOptions } from "@tanstack/react-query";
export function manageableAccountsQueryOptions(fetchAccounts: () => Promise<unknown>) {
  return queryOptions({
    queryKey: ["teriip", "manageable-accounts"],
    queryFn: fetchAccounts,
    staleTime: 30_000,
  });
}
