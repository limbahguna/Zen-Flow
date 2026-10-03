import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";
import { t, type LanguageCode } from "@/lib/translations";
import { SoftLaunchNotice, softLaunchNoticeKey } from "./SoftLaunchNotice";

function renderNotice(userId: string, language: LanguageCode = "en") {
  localStorage.setItem("mindful_language", language);
  return render(
    <LanguageProvider>
      <SoftLaunchNotice userId={userId} />
    </LanguageProvider>,
  );
}

describe("soft-launch welcome notice", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows the notice after the first sign-in", async () => {
    renderNotice("user-1");
    expect(await screen.findByTestId("soft-launch-notice")).toBeTruthy();
    expect(screen.getByTestId("soft-launch-notice").textContent).toContain(
      "Enjoy 30 days of free access",
    );
  });

  it("does not show a dismissed notice again", async () => {
    const view = renderNotice("user-1");
    await userEvent.click(await screen.findByTestId("soft-launch-dismiss"));
    expect(screen.queryByTestId("soft-launch-notice")).toBeNull();
    expect(localStorage.getItem(softLaunchNoticeKey("user-1"))).toBe("1");

    view.unmount();
    renderNotice("user-1");
    expect(screen.queryByTestId("soft-launch-notice")).toBeNull();
  });

  it("still shows the notice for a different account", async () => {
    localStorage.setItem(softLaunchNoticeKey("user-1"), "1");
    renderNotice("user-2");
    expect(await screen.findByTestId("soft-launch-notice")).toBeTruthy();
  });

  it.each([
    ["en", "Enjoy 30 days of free access. AI Coach includes up to 10 messages per month. No payment is required."],
    ["id", "Nikmati 30 hari akses gratis. AI Coach mencakup hingga 10 pesan per bulan. Tidak perlu pembayaran."],
    ["ja", "30日間無料でご利用いただけます。AIコーチは月10件までです。お支払いは不要です。"],
  ] as const)("uses the %s welcome copy", async (language, notice) => {
    renderNotice("user-1", language);
    expect((await screen.findByTestId("soft-launch-notice")).textContent).toContain(notice);
    expect(t(language, "coach.error.limit")).not.toBe("coach.error.limit");
    expect(t(language, "coach.remaining.month")).toContain("{remaining}");
  });
});
