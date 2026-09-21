import { describe, expect, it } from "vitest";
import { listenHost } from "./listenHost";

describe("listenHost", () => {
  it("binds production to 0.0.0.0", () => {
    expect(listenHost("production")).toBe("0.0.0.0");
  });

  it("leaves development host unspecified", () => {
    expect(listenHost("development")).toBeUndefined();
    expect(listenHost(undefined)).toBeUndefined();
  });
});
