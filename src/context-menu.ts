export type ContextMenuItem =
  | { separator: true }
  | { label: string; action: () => void | Promise<void>; disabled?: boolean; separator?: false };
