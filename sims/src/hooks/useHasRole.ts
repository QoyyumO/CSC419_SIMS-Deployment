import { useAuth } from "./useAuth";
import { UserRole } from "../../convex/lib/aggregates/types";


export function useHasRole(role: UserRole): boolean {
  const { hasRole } = useAuth();
  return hasRole(role);
}

export function useHasAnyRole(roles: UserRole[]): boolean {
  const { hasAnyRole } = useAuth();
  return hasAnyRole(roles);
}

export function useHasAllRoles(roles: UserRole[]): boolean {
  const { hasAllRoles } = useAuth();
  return hasAllRoles(roles);
}


export function usePermissions(permission: UserRole): boolean {
  return useHasRole(permission);
}

