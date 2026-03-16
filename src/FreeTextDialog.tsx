import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { FreeTextEditData } from './types.ts';

interface Props {
  open: boolean;
  data: FreeTextEditData;
  onClose: (result: { label: string; fontSize: number } | null) => void;
}

export default function FreeTextDialog({ open, data, onClose }: Props) {
  const [label, setLabel] = useState(data.label);
  const [fontSize, setFontSize] = useState(data.fontSize);

  useEffect(() => {
    setLabel(data.label);
    setFontSize(data.fontSize);
  }, [data]);

  const handleSliderChange = (_: Event, value: number | number[]) => {
    setFontSize(value as number);
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
      PaperProps={{ sx: { bgcolor: '#2a2a2a', color: '#ccc', minWidth: 320 } }}
    >
      <DialogTitle sx={{ fontSize: 14, color: '#eee', pb: 1 }}>テキストの設定</DialogTitle>
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
          min={4}
          max={80}
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
