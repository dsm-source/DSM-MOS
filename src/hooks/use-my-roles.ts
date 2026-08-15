import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMyRoles, type AppRole } from "@/lib/roles.functions";

export const myRolesQueryOptions = queryOptions({
  queryKey: ["my-roles"],
  queryFn: () => getMyRoles(),
});

export function useMyRoles() {
  const { data } = useSuspenseQuery(myRolesQueryOptions);
  const roles = data ?? [];
  return {
    roles,
    hasRole: (r: AppRole) => roles.includes(r),
    hasAnyRole: (rs: AppRole[]) => rs.some((r) => roles.includes(r)),
  };
}
