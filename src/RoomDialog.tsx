import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { RoomEditData } from './editor.ts';

interface Props {
  open: boolean;
  data: RoomEditData;
  onClose: (result: { label: string; fontSize?: number } | null) => void;
}

export default function RoomDialog({ open, data, onClose }: Props) {
  const [label, setLabel] = useState(data.label);
  const [fontSize, setFontSize] = useState<number>(data.fontSize ?? data.autoFontSize);
  const [isCustom, setIsCustom] = useState(data.fontSize !== undefined);

  useEffect(() => {
    setLabel(data.label);
    setFontSize(data.fontSize ?? data.autoFontSize);
    setIsCustom(data.fontSize !== undefined);
  }, [data]);

  const handleReset = () => {
    setFontSize(data.autoFontSize);
    setIsCustom(false);
  };

  const handleSliderChange = (_: Event, value: number | number[]) => {
    setFontSize(value as number);
    setIsCustom(true);
  };

  const handleOk = () => {
    onClose({ label, fontSize: isCustom ? fontSize : undefined });
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
      <DialogTitle sx={{ fontSize: 14, color: '#eee', pb: 1 }}>部屋の設定</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="部屋名"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#aaa', fontSize: 11 }}>
            {isCustom ? `${fontSize}px` : `${data.autoFontSize}px (自動)`}
          </Typography>
          <Button
            size="small"
            onClick={handleReset}
            sx={{ fontSize: 10, color: '#aaa', minWidth: 0, px: 1 }}
          >
            リセット
          </Button>
        </Box>
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
