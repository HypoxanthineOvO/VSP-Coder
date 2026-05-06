import { resolve } from "node:path";
import type { AutomationProfile } from "@vsp-coder/protocol";

export function profileForCwd(profile: AutomationProfile | undefined, cwd: string | undefined, serverRoot: string): AutomationProfile | undefined {
  if (!profile || profile.id !== "full_auto" || !isServerRootCwd(cwd, serverRoot)) return profile;
  return { ...profile, sandbox: "workspace-write" };
}

export function selfProtectionOverrides(cwd: string | undefined, serverRoot: string, port: number) {
  if (!isServerRootCwd(cwd, serverRoot)) return {};
  return {
    developerInstructions: [
      "VSP-Coder self-protection is active for this thread.",
      `Do not stop, kill, restart, or replace the VSP-Coder HTTP server process on port ${port}.`,
      "Do not run commands that target the VSP-Coder server process, its parent process, or its Codex app-server child process.",
      "If a server restart is needed, explain the exact safe restart steps to the user instead of executing them from inside this thread."
    ].join("\n")
  };
}

function isServerRootCwd(cwd: string | undefined, serverRoot: string) {
  if (!cwd) return false;
  return resolve(cwd) === resolve(serverRoot);
}
