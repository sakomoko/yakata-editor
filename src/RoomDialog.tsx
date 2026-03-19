import LabelFontSizeDialog from './LabelFontSizeDialog.tsx';
import type { RoomEditData } from './editor/index.ts';

interface Props {
  open: boolean;
  data: RoomEditData;
  onClose: (result: { label: string; fontSize?: number } | null) => void;
}

export default function RoomDialog({ open, data, onClose }: Props) {
  return (
    <LabelFontSizeDialog
      open={open}
      title="部屋の設定"
      textFieldLabel="部屋名"
      data={data}
      onClose={onClose}
    />
  );
}
