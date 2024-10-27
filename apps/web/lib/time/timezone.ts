export function getUserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
