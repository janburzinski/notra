import { AUTOPILOT_MANAGER_ROLES } from "@/constants/autopilot";

export function canManageAutopilot(role: string) {
  return AUTOPILOT_MANAGER_ROLES.has(role);
}
