/**
 * Pure launch environment & auto-launch policy helpers shared by the
 * Antigravity phone-screen sidecar and unit tests.
 */

export function sanitizedDesktopLaunchEnv(baseEnv = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    const upper = key.toUpperCase();
    if (upper === 'ELECTRON_RUN_AS_NODE' || upper === 'ELECTRON_NO_ASAR') continue;
    env[key] = value;
  }
  return env;
}

/**
 * Only auto-launch the desktop app in response to an explicit user interaction
 * in the side panel (Refresh/Retry, tap/button action, or explicit device switch).
 * Passive background polling (`screen_frame`, `screen_signal`) or initial mount
 * (`show_screen` without `device_id`) must never resurrect a desktop app the user quit.
 */
export function shouldAutoLaunchForViewerCall(toolName, toolArgs) {
  if (toolName === 'screen_action') return true;
  if (toolName === 'show_screen' && typeof toolArgs?.device_id === 'string' && toolArgs.device_id.trim()) {
    return true;
  }
  return false;
}
