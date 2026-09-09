import { beforeEach, expect, it, vi } from "vitest";
import {
  listOwnerAgreementsForProperty,
  listOwnerAgreementsForOwner,
  listOwnerAgreementVersions,
} from "./ownerAgreementService";
const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: mock }));
beforeEach(() => vi.clearAllMocks());
function setup(rows: Record<string, unknown>[], failure?: unknown) {
  const calls: { filter: unknown[]; orders: unknown[]; ranges: number[][] }[] =
    [];
  mock.from.mockImplementation(() => {
    const call = {
      filter: [] as unknown[],
      orders: [] as unknown[],
      ranges: [] as number[][],
    };
    calls.push(call);
    let ids: readonly string[] | undefined;
    const data = () =>
      ids
        ? rows.filter((r) => ids!.includes(String(r.owner_agreement_id)))
        : rows;
    const q: any = {
      select: vi.fn(() => q),
      eq: vi.fn((...x: unknown[]) => {
        call.filter = x;
        return q;
      }),
      in: vi.fn((key: string, values: string[]) => {
        call.filter = [key, values];
        ids = values;
        return q;
      }),
      order: vi.fn((...x: unknown[]) => {
        call.orders.push(x);
        return q;
      }),
      range: vi.fn(async (from: number, to: number) => {
        call.ranges.push([from, to]);
        return from > 0 && failure
          ? { data: null, error: failure }
          : { data: data().slice(from, to + 1), error: null };
      }),
      then: (resolve: any) =>
        Promise.resolve({ data: data().slice(0, 1000), error: null }).then(
          resolve,
        ),
    };
    return q;
  });
  return calls;
}
it.each([
  ["property_id", listOwnerAgreementsForProperty],
  ["owner_id", listOwnerAgreementsForOwner],
] as const)(
  "reads beyond the server cap with stable %s scope",
  async (key, read) => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ id: String(i) }));
    const calls = setup(rows);
    expect(await read("scope")).toEqual(rows);
    expect(calls.map((c) => c.ranges)).toEqual([[[0, 999]], [[1000, 1999]]]);
    for (const c of calls) {
      expect(c.filter).toEqual([key, "scope"]);
      expect(c.orders).toEqual([
        ["starts_on", { ascending: false }],
        ["id", { ascending: true }],
      ]);
    }
  },
);
it("does not return an apparently complete prefix after a later authorization failure", async () => {
  const error = { code: "42501", message: "permission denied" };
  setup(
    Array.from({ length: 1001 }, (_, i) => ({ id: String(i) })),
    error,
  );
  await expect(listOwnerAgreementsForProperty("scope")).rejects.toBe(error);
});
it("fails closed at the existing read ceiling", async () => {
  setup(Array.from({ length: 20000 }, (_, i) => ({ id: String(i) })));
  await expect(listOwnerAgreementsForOwner("scope")).rejects.toMatchObject({
    name: "PagedReadTruncationError",
  });
});
it("pages and batches version IDs without duplicates or losing global version order", async () => {
  const ids = Array.from({ length: 251 }, (_, i) => `agreement-${i}`);
  const rows = [
    ...Array.from({ length: 1001 }, (_, i) => ({
      id: `v-${String(i).padStart(4, "0")}`,
      version_no: 1001 - i,
      owner_agreement_id: ids[0],
    })),
    { id: "latest", version_no: 2000, owner_agreement_id: ids[250] },
  ];
  const calls = setup(rows);
  const result = await listOwnerAgreementVersions([...ids, ids[0]]);
  expect(result).toHaveLength(1002);
  expect(result[0].id).toBe("latest");
  expect(calls.map((c) => (c.filter[1] as string[]).length)).toEqual([
    250, 250, 1,
  ]);
  expect(calls.every((c) => c.filter[0] === "owner_agreement_id")).toBe(true);
  for (const c of calls)
    expect(c.orders).toEqual([
      ["version_no", { ascending: false }],
      ["id", { ascending: true }],
    ]);
});
it("does not query versions without an agreement scope", async () => {
  expect(await listOwnerAgreementVersions([])).toEqual([]);
  expect(mock.from).not.toHaveBeenCalled();
});
