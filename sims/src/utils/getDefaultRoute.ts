import { UserRole } from "../../convex/lib/aggregates/types";

export function getDefaultRoute(roles: UserRole[]): string {
  // Priority order: admin > instructor > student > others
  if (roles.includes("admin")) {
    return "/account-settings"; // TODO: Change to "/dashboard/admin" when dashboard is created
  }
  
  if (roles.includes("instructor")) {
    return "/account-settings"; // TODO: Change to "/dashboard/instructor" when dashboard is created
  }
  
  if (roles.includes("student")) {
    return "/account-settings"; // TODO: Change to "/dashboard/student" when dashboard is created
  }
  
  // Default fallback
  return "/account-settings";
}

