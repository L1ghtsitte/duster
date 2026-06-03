import type { ReactNode } from "react";
import { useAuth } from "./auth";

export function can(user: ReturnType<typeof useAuth>["user"], perm: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions.includes(perm);
}

export function PermGate({
  perm,
  children,
}: {
  perm: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!can(user, perm)) return null;
  return <>{children}</>;
}
