import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for `callWebhook`: rejects a target whose hostname resolves (or
 * literally is) a private, loopback, link-local, or otherwise non-public IP
 * address — including the common cloud-metadata endpoint (169.254.169.254)
 * and IPv6 equivalents — before the request is ever made.
 *
 * Checked against the RESOLVED address, not just the hostname string, so
 * this isn't bypassable by pointing a public-looking domain's DNS at an
 * internal IP. Also restricts the scheme to http(s) — `callWebhookConfigSchema`
 * (workflow.schemas.ts) only validates URL *syntax*, not protocol, so
 * `file:`/`gopher:`/etc. would otherwise pass through to `fetch` unchecked.
 *
 * Anyone holding `admin:workflow.manage` can configure this action's target
 * URL; without this guard they could use the API server as a proxy to probe
 * or reach internal-network services and cloud metadata endpoints.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`callWebhook: "${rawUrl}" is not a valid URL`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`callWebhook: protocol "${url.protocol}" is not allowed (only http/https)`);
  }

  const hostname = url.hostname;
  const literalIp = isIP(hostname) ? hostname : null;
  const address = literalIp ?? (await lookup(hostname)).address;

  if (isPrivateOrReservedIp(address)) {
    throw new Error(
      `callWebhook: target "${hostname}" resolves to a private/reserved address (${address}), not allowed`,
    );
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' || // loopback
      lower.startsWith('fe80:') || // link-local
      lower.startsWith('fc') || // unique local (fc00::/7)
      lower.startsWith('fd') ||
      lower.startsWith('::ffff:127.') // IPv4-mapped loopback
    );
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    // Malformed/unresolvable — fail closed.
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 127 || // loopback (127.0.0.0/8)
    a === 10 || // private (10.0.0.0/8)
    (a === 172 && b >= 16 && b <= 31) || // private (172.16.0.0/12)
    (a === 192 && b === 168) || // private (192.168.0.0/16)
    (a === 169 && b === 254) || // link-local, incl. cloud metadata (169.254.0.0/16)
    a === 0 || // "this network" (0.0.0.0/8)
    a >= 224 // multicast + reserved (224.0.0.0/4, 240.0.0.0/4)
  );
}
