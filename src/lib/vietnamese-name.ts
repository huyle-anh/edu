function splitVietnameseName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const givenName = parts.pop() ?? "";
  return { givenName, rest: parts.join(" ") };
}

// Vietnamese roster order: given name (last word) first, then family and middle names.
export function compareVietnameseNames(left: string, right: string) {
  const a = splitVietnameseName(left);
  const b = splitVietnameseName(right);
  return (
    a.givenName.localeCompare(b.givenName, "vi") ||
    a.rest.localeCompare(b.rest, "vi")
  );
}
