export type StatusTransitions<Status extends string> = Readonly<
  Record<Status, readonly Status[]>
>;

export type StatusSources<Table, To> = {
  [From in keyof Table]: Table[From] extends readonly (infer Target)[]
    ? [To] extends [Target]
      ? From
      : never
    : never;
}[keyof Table];
