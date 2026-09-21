export function listenHost(nodeEnv: string | undefined): string | undefined {
  return nodeEnv === "production" ? "0.0.0.0" : undefined;
}
