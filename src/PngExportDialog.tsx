import { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import type { PngExportOptions } from './editor/context.ts';

interface Props {
  open: boolean;
  defaultFilename: string;
  onClose: () => void;
  onExport: (options: PngExportOptions) => void;
}

export default function PngExportDialog({ open, defaultFilename, onClose, onExport }: Props) {
  const [filename, setFilename] = useState('');
  const [includeStickyNotes, setIncludeStickyNotes] = useState(true);

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename);
    }
  }, [open, defaultFilename]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>PNG出力オプション</DialogTitle>
      <DialogContent>
        <TextField
          label="ファイル名"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          fullWidth
          size="small"
          sx={{ mt: 1 }}
          slotProps={{ input: { endAdornment: <span style={{ color: '#888' }}>.png</span> } }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={includeStickyNotes}
              onChange={(e) => setIncludeStickyNotes(e.target.checked)}
            />
          }
          label="付箋メモを含める"
          sx={{ mt: 1, display: 'block' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={() => {
            const name = filename.trim() || '間取り図';
            onExport({ includeStickyNotes, filename: `${name}.png` });
          }}
          variant="contained"
        >
          出力
        </Button>
      </DialogActions>
    </Dialog>
  );
}
