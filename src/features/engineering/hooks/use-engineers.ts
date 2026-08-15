import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEngineers } from "@/lib/engineering-users.functions";

export function useEngineers(enabled: boolean) {
  const fn = useServerFn(listEngineers);
  return useQuery({
    enabled,
    queryKey: ["engineers"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
