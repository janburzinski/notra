const IPV6_GROUPS = 8;
const IPV6_PREFIX_GROUPS = 4;

/**
 * Rate-limit key for a client address. IPv6 clients usually control a whole
 * /64, so they're keyed by that prefix instead of the full address.
 */
export function rateLimitClientKey(ip: string): string {
  if (!ip.includes(":")) {
    return ip;
  }
  // IPv4-mapped (`::ffff:192.0.2.1`): key by the IPv4 address.
  if (ip.includes(".")) {
    return ip.slice(ip.lastIndexOf(":") + 1);
  }
  const [head = "", tail, ...extra] = ip.toLowerCase().split("::");
  if (extra.length > 0) {
    return ip;
  }
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = IPV6_GROUPS - headGroups.length - tailGroups.length;
  if (missing < 0 || (tail === undefined && missing !== 0)) {
    return ip;
  }
  const groups = [
    ...headGroups,
    ...Array.from({ length: missing }, () => "0"),
    ...tailGroups,
  ];
  return `${groups
    .slice(0, IPV6_PREFIX_GROUPS)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
