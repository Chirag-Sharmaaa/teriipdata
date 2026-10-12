import { queryOptions } from "@tanstack/react-query";
import { listManageableAccounts } from "@/lib/account-management.functions";

export const manageableAccountsQueryOptions = queryOptions({
  queryKey: ["teriip", "manageable-accounts"],
  queryFn: () => listManageableAccounts(),
  staleTime: 30_000,
});