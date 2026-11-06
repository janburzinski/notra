export type PostLookupResult =
  | { status: "found"; post: { id: string; title: string } }
  | { status: "ambiguous" }
  | { status: "missing" };
