import LabelFontSizeDialog from './LabelFontSizeDialog.tsx';
import type { MarkerEditData } from './editor/index.ts';

interface Props {
  open: boolean;
  data: MarkerEditData;
  onClose: (result: { label: string; fontSize?: number } | null) => void;
}

export default function MarkerDialog({ open, data, onClose }: Props) {
  return (
    <LabelFontSizeDialog
      open={open}
      title="マーカーの設定"
      textFieldLabel="ラベル"
      data={data}
      onClose={onClose}
    />
  );
}
