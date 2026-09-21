export async function shareOrCopySummary(title: string, text: string): Promise<"shared" | "copied"> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  if (nav && typeof nav.share === "function") {
    await nav.share({ title, text });
    return "shared";
  }
  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(text);
    return "copied";
  }
  throw new Error("share_unavailable");
}
