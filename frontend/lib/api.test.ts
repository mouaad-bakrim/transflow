import { afterEach, describe, expect, it, vi } from "vitest";
import { api, login } from "./api";

describe("API authentication", () => {
  afterEach(() => vi.restoreAllMocks());
  it("returns tokens after a successful login", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ access: "access", refresh: "refresh" }),
        }),
    );
    await expect(login("admin", "secret")).resolves.toEqual({
      access: "access",
      refresh: "refresh",
    });
  });
  it("does not silently accept invalid credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(login("bad", "bad")).rejects.toThrow(
      "Identifiants incorrects",
    );
  });
  it("renews an expired access token and retries the request", async () => {
    const values = new Map([["refresh_token", "refresh-old"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal(
      "CustomEvent",
      class {
        constructor(
          public type: string,
          public init: unknown,
        ) {}
      },
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access: "access-new", refresh: "refresh-new" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 1 }),
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      api<{ id: number }>("/auth/me/", "access-old"),
    ).resolves.toEqual({ id: 1 });
    expect(values.get("access_token")).toBe("access-new");
    expect(values.get("refresh_token")).toBe("refresh-new");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
