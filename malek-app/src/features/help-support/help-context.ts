const uuidSegmentPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const opaqueSegmentPattern = /^[0-9a-z_-]{20,}$/i;
const longNumericSegmentPattern = /^\d{6,}$/;

/**
 * Keeps route-level diagnostics while removing record identifiers, query
 * strings and fragments before the value reaches Help or support storage.
 */
export function sanitizeSupportRoute(value: string | null | undefined): string {
  const pathname = (value ?? "").split(/[?#]/, 1)[0]?.trim() ?? "";
  if (!pathname.startsWith("/")) return "/unknown";
  const sanitized = pathname
    .split("/")
    .map((segment) =>
      uuidSegmentPattern.test(segment) ||
      opaqueSegmentPattern.test(segment) ||
      longNumericSegmentPattern.test(segment)
        ? ":id"
        : segment,
    )
    .join("/");
  return sanitized.slice(0, 300) || "/unknown";
}
