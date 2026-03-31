import { useState, useEffect, useRef, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { FreeTextEditData } from './types.ts';
import { FONT_SIZE_MIN, FONT_SIZE_MAX } from './interior-object.ts';

interface Props {
  open: boolean;
  data: FreeTextEditData;
  onClose: (result: { label: string; fontSize: number } | null) => void;
}

function useDraggablePaper() {
  const posRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  const paperRef = useRef<HTMLDivElement | null>(null);

  const resetPosition = useCallback(() => {
    posRef.current = { x: 0, y: 0 };
    if (paperRef.current) {
      paperRef.current.style.transform = '';
    }
  }, []);

  const onTitlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
    };
  }, []);

  const onTitlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    posRef.current = { x: dragRef.current.origX + dx, y: dragRef.current.origY + dy };
    if (paperRef.current) {
      paperRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
    }
  }, []);

  const onTitlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onTitlePointerCancel = onTitlePointerUp;

  return { paperRef, resetPosition, onTitlePointerDown, onTitlePointerMove, onTitlePointerUp, onTitlePointerCancel };
}

export default function FreeTextDialog({ open, data, onClose }: Props) {
  const [label, setLabel] = useState(data.label);
  const [fontSize, setFontSize] = useState(data.fontSize);
  const { paperRef, resetPosition, onTitlePointerDown, onTitlePointerMove, onTitlePointerUp, onTitlePointerCancel } =
    useDraggablePaper();

  useEffect(() => {
    setLabel(data.label);
    setFontSize(data.fontSize);
  }, [data]);

  // ダイアログが開くたびに位置をリセット
  useEffect(() => {
    if (open) resetPosition();
  }, [open, resetPosition]);

  const handleSliderChange = (_: Event, value: number | number[]) => {
    const newSize = value as number;
    setFontSize(newSize);
    data.onFontSizePreview?.(newSize);
  };

  const handleOk = () => {
    onClose({ label, fontSize });
  };

  const handleCancel = () => {
    onClose(null);
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      PaperProps={{
        ref: paperRef,
        sx: { bgcolor: '#2a2a2a', color: '#ccc', minWidth: 320 },
      }}
    >
      <DialogTitle
        sx={{ fontSize: 14, color: '#eee', pb: 1, cursor: 'move', userSelect: 'none' }}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerCancel}
      >
        テキストの設定
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="テキスト"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleOk();
          }}
          size="small"
          variant="outlined"
          sx={{ mt: 1, mb: 2 }}
          slotProps={{
            input: { sx: { color: '#eee', fontSize: 13 } },
            inputLabel: { sx: { color: '#aaa', fontSize: 12 } },
          }}
        />
        <Typography variant="caption" sx={{ color: '#aaa', fontSize: 12 }}>
          フォントサイズ
        </Typography>
        <Slider
          value={fontSize}
          onChange={handleSliderChange}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={1}
          valueLabelDisplay="auto"
          sx={{ mt: 1 }}
        />
        <Typography variant="caption" sx={{ color: '#aaa', fontSize: 11 }}>
          {fontSize}px
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} sx={{ color: '#ccc' }}>
          キャンセル
        </Button>
        <Button onClick={handleOk} variant="contained">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
