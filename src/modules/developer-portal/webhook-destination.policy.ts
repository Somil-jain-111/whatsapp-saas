import { BadRequestException, Injectable } from "@nestjs/common";
import { isIP } from "net";
import { lookup } from "dns/promises";

@Injectable()
export class WebhookDestinationPolicy {
  async assertPublicHttps(value: string) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new BadRequestException(
        "Webhook URL must be an HTTPS URL without credentials",
      );
    if (url.hostname.toLowerCase() === "localhost")
      throw new BadRequestException("Webhook destination is not public");
    const family = isIP(url.hostname);
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = family
        ? [{ address: url.hostname, family }]
        : await lookup(url.hostname, { all: true, verbatim: true });
    } catch {
      throw new BadRequestException(
        "Webhook destination could not be resolved",
      );
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => this.isPrivate(address))
    )
      throw new BadRequestException("Webhook destination is not public");
    return { url, addresses };
  }

  isPrivate(address: string) {
    const value = address.toLowerCase();
    if (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fe80:") ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("ff") ||
      value.startsWith("2001:db8:")
    )
      return true;
    const mapped = value.startsWith("::ffff:") ? value.slice(7) : value;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(mapped)) return false;
    const [a, b] = mapped.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
}
