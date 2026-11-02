import { useQuery } from "@tanstack/react-query";
import { loadSession } from "@/features/auth/session";

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: loadSession, staleTime: 15_000, retry: false });
}
