import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import type { MarkerEditData } from './editor.ts';

interface Props {
  open: boolean;
  data: MarkerEditData;
  onClose: (result: { label: string } | null) => void;
}

export default function MarkerDialog({ open, data, onClose }: Props) {
  const [label, setLabel] = useState(data.label);

  useEffect(() => {
    setLabel(data.label);
  }, [data]);

  const handleOk = () => {
    onClose({ label });
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
      <DialogTitle sx={{ fontSize: 14, color: '#eee', pb: 1 }}>マーカーの設定</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="ラベル"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleOk();
          }}
          size="small"
          variant="outlined"
          sx={{ mt: 1 }}
          slotProps={{
            input: { sx: { color: '#eee', fontSize: 13 } },
            inputLabel: { sx: { color: '#aaa', fontSize: 12 } },
          }}
        />
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
