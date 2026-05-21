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
  const timeout = Duration.minutes(5);
  const frequency = Duration.seconds(10);
  const deadline = Date.now() + timeout.milliseconds;
  while (true) {
    const response = await fetch(`${loginUrl}/services/oauth2/token`).catch(() => null);
    if (response && response.status !== 420) {
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
