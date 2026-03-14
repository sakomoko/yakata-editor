export type ContextMenuItem =
  | { separator: true }
  | { label: string; action: () => void; disabled?: boolean; separator?: false };
