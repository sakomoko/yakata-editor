import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { modKey as mod } from './platform.ts';

const shortcuts: { category: string; items: { keys: string; description: string }[] }[] = [
  {
    category: '基本操作',
    items: [
      { keys: 'ドラッグ', description: '部屋を作成' },
      { keys: 'クリック', description: '選択' },
      { keys: 'Shift+クリック', description: '複数選択' },
      { keys: 'ダブルクリック', description: '名前を編集' },
      { keys: 'Delete / Backspace', description: '削除' },
      { keys: `${mod}+Z`, description: '元に戻す' },
    ],
  },
  {
    category: 'ビューポート',
    items: [
      { keys: 'ホイール', description: 'ズーム' },
      { keys: `${mod}+= / ${mod}+-`, description: 'ズームイン / アウト' },
      { keys: `${mod}+0`, description: 'ズームリセット' },
      { keys: 'Space+ドラッグ', description: 'パン（移動）' },
    ],
  },
  {
    category: 'レイヤー',
    items: [
      { keys: `${mod}+]`, description: '一つ前面に移動' },
      { keys: `${mod}+[`, description: '一つ背面に移動' },
      { keys: `${mod}+Shift+]`, description: '最前面に移動' },
      { keys: `${mod}+Shift+[`, description: '最背面に移動' },
    ],
  },
  {
    category: 'モード',
    items: [
      { keys: 'P', description: 'ペイントモード切替' },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutHelpDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        ショートカットキー一覧
        <IconButton onClick={onClose} size="small" sx={{ color: '#999' }}>
          ✕
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {shortcuts.map((section) => (
          <Box key={section.category} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ color: '#aaa', mb: 1 }}>
              {section.category}
            </Typography>
            {section.items.map((item) => (
              <Box
                key={item.keys}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 0.5,
                  px: 1,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  {item.description}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#999',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    ml: 2,
                  }}
                >
                  {item.keys}
                </Typography>
              </Box>
            ))}
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1 }}>
          ? キーでこのダイアログを開閉できます
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
