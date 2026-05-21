import { AuthInfo, MyDomainResolver, SfError } from "@salesforce/core";
import { Duration } from "@salesforce/kit";
import { setTimeout } from "node:timers/promises";
import type { CompletedSignupRequest } from "./signup-request.js";

export async function resolveMyDomain(subdomain: string): Promise<void> {
  const loginUrl = `https://${subdomain}.my.salesforce.com`;
  const resolver = await MyDomainResolver.create({
    url: new URL(loginUrl),
    timeout: Duration.minutes(5),
    frequency: Duration.seconds(10),
  });
  await resolver.resolve();
}

export async function waitForOrgReady(subdomain: string): Promise<void> {
  const loginUrl = `https://${subdomain}.my.salesforce.com`;
  const timeout = Duration.minutes(10);
  const frequency = Duration.seconds(30);
  const deadline = Date.now() + timeout.milliseconds;
  while (true) {
    // POST with a dummy code mirrors what exchangeAuthCode will do.
    // A loading org returns 420 + HTML; a ready org returns JSON (even for an invalid code).
    const response = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code&code=probe&client_id=PlatformCLI",
    }).catch(() => null);
    if (response?.headers.get("content-type")?.includes("application/json")) {
      return;
    }
    if (Date.now() + frequency.milliseconds > deadline) {
      throw new SfError(
        `Org at ${loginUrl} did not become ready within ${timeout.minutes} minutes`,
      );
    }
    await setTimeout(frequency.milliseconds);
  }
}

export async function exchangeAuthCode(completed: CompletedSignupRequest): Promise<AuthInfo> {
  const loginUrl = `https://${completed.Subdomain}.my.salesforce.com`;
  const authInfo = await AuthInfo.create({
    username: completed.Username,
    oauth2Options: {
      loginUrl,
      authCode: completed.AuthCode,
      clientId: "PlatformCLI",
    },
  });
  await authInfo.save();
  return authInfo;
}
