import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
  const [dataDir, setDataDir] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  // ダイアログが閉じられた後の非同期処理による stale setState を防ぐ
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      mountedRef.current = false;
      setBrowsing(false);
      return;
    }
    mountedRef.current = true;
    setError('');
    setSaving(false);
    const ac = new AbortController();
    fetch('/api/settings', { signal: ac.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load settings');
        return res.json();
      })
      .then((json: { dataDir: string }) => setDataDir(json.dataDir))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError('設定の読み込みに失敗しました');
      });
    return () => ac.abort();
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataDir }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? '保存に失敗しました');
        setSaving(false);
        return;
      }
      window.location.reload();
    } catch {
      setError('サーバーとの通信に失敗しました');
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        設定
        <IconButton onClick={onClose} size="small" sx={{ color: '#999' }} aria-label="閉じる">
          ✕
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="subtitle2" sx={{ color: '#aaa', mb: 1 }}>
          データ保存先ディレクトリ
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={dataDir}
            onChange={(e) => setDataDir(e.target.value)}
            placeholder="/path/to/data"
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<FolderOpenIcon />}
            disabled={browsing}
            onClick={async () => {
              setBrowsing(true);
              setError('');
              try {
                const res = await fetch('/api/settings', { method: 'POST' });
                if (!mountedRef.current) return;
                if (!res.ok) {
                  setError('フォルダ選択に失敗しました');
                  setBrowsing(false);
                  return;
                }
                const json = (await res.json()) as { path?: string; cancelled?: boolean };
                if (!mountedRef.current) return;
                if (json.path) setDataDir(json.path);
              } catch {
                if (!mountedRef.current) return;
                setError('フォルダ選択に失敗しました');
              }
              setBrowsing(false);
            }}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {browsing ? '選択中…' : '参照'}
          </Button>
        </Box>
        {error && (
          <Typography variant="body2" sx={{ color: '#f44336', mb: 1 }}>
            {error}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 0.5 }}>
          例: ~/Library/Mobile Documents/com~apple~CloudDocs/yakata-data
        </Typography>
        <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>
          ※ 既存データは自動的には移動されません。必要に応じて手動でコピーしてください。
        </Typography>
        <Typography variant="caption" sx={{ color: '#f9a825', display: 'block', mt: 0.5 }}>
          ※ 保存するとページがリロードされます。未保存の編集内容は失われます。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">
          キャンセル
        </Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
