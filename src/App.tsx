import { useRef, useEffect, useCallback, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import {
  initEditor,
  type EditorAPI,
  type RoomEditData,
  type MarkerEditData,
  type ContextMenuRequest,
} from './editor/index.ts';
import { loadFromFile } from './persistence.ts';
import RoomDialog from './RoomDialog.tsx';
import MarkerDialog from './MarkerDialog.tsx';
import type { FreeTextEditData } from './types.ts';
import FreeTextDialog from './FreeTextDialog.tsx';
import ContextMenu from './ContextMenu.tsx';
import type { ContextMenuItem } from './context-menu.ts';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#888', paper: '#2a2a2a' },
  },
  typography: { fontFamily: '-apple-system, system-ui, sans-serif' },
});

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorAPI | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roomEditResolveRef = useRef<
    ((v: { label: string; fontSize?: number } | null) => void) | null
  >(null);
  const markerEditResolveRef = useRef<((v: { label: string } | null) => void) | null>(null);
  const freeTextEditResolveRef = useRef<
    ((v: { label: string; fontSize: number } | null) => void) | null
  >(null);

  const [status, setStatus] = useState('準備完了');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<RoomEditData | null>(null);
  const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
  const [markerDialogData, setMarkerDialogData] = useState<MarkerEditData | null>(null);
  const [freeTextDialogOpen, setFreeTextDialogOpen] = useState(false);
  const [freeTextDialogData, setFreeTextDialogData] = useState<FreeTextEditData | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(
    null,
  );

  const handleRoomEdit = useCallback(
    (data: RoomEditData): Promise<{ label: string; fontSize?: number } | null> => {
      setDialogData(data);
      setDialogOpen(true);
      return new Promise((resolve) => {
        roomEditResolveRef.current = resolve;
      });
    },
    [],
  );

  const handleDialogClose = useCallback((result: { label: string; fontSize?: number } | null) => {
    setDialogOpen(false);
    roomEditResolveRef.current?.(result);
    roomEditResolveRef.current = null;
  }, []);

  const handleMarkerEdit = useCallback(
    (data: MarkerEditData): Promise<{ label: string } | null> => {
      setMarkerDialogData(data);
      setMarkerDialogOpen(true);
      return new Promise((resolve) => {
        markerEditResolveRef.current = resolve;
      });
    },
    [],
  );

  const handleMarkerDialogClose = useCallback((result: { label: string } | null) => {
    setMarkerDialogOpen(false);
    markerEditResolveRef.current?.(result);
    markerEditResolveRef.current = null;
  }, []);

  const handleFreeTextEdit = useCallback(
    (data: FreeTextEditData): Promise<{ label: string; fontSize: number } | null> => {
      setFreeTextDialogData(data);
      setFreeTextDialogOpen(true);
      return new Promise((resolve) => {
        freeTextEditResolveRef.current = resolve;
      });
    },
    [],
  );

  const handleFreeTextDialogClose = useCallback(
    (result: { label: string; fontSize: number } | null) => {
      setFreeTextDialogOpen(false);
      freeTextEditResolveRef.current?.(result);
      freeTextEditResolveRef.current = null;
    },
    [],
  );

  const handleContextMenu = useCallback((request: ContextMenuRequest) => {
    setCtxMenu({ x: request.screenX, y: request.screenY, items: request.items });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;

    const api = initEditor(canvas, container, {
      onStatusChange: setStatus,
      onRoomEdit: handleRoomEdit,
      onMarkerEdit: handleMarkerEdit,
      onFreeTextEdit: handleFreeTextEdit,
      onContextMenu: handleContextMenu,
    });
    editorRef.current = api;

    const onResize = () => api.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      api.destroy();
    };
  }, [handleRoomEdit, handleMarkerEdit, handleFreeTextEdit, handleContextMenu]);

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await loadFromFile(file);
      if (data.warning) {
        alert(data.warning);
        return;
      }
      editorRef.current?.loadProject(data);
    } catch (err) {
      console.error('loadFromFile error:', err);
      alert('ファイルを読み込めませんでした');
    }
    e.target.value = '';
  };

  /* eslint-disable no-irregular-whitespace */
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      {/* Toolbar */}
      <Box
        sx={{
          height: 36,
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          px: 1,
          gap: 0.75,
          borderBottom: '1px solid #444',
        }}
      >
        <Button
          size="small"
          variant="contained"
          color="inherit"
          sx={toolbarButtonSx}
          onClick={() => editorRef.current?.newProject()}
        >
          新規
        </Button>
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#555', mx: 0.5 }} />
        <Button
          size="small"
          variant="contained"
          color="inherit"
          sx={toolbarButtonSx}
          onClick={() => editorRef.current?.saveProject().catch(console.error)}
        >
          保存
        </Button>
        <Button
          size="small"
          variant="contained"
          color="inherit"
          sx={toolbarButtonSx}
          onClick={() => fileInputRef.current?.click()}
        >
          開く
        </Button>
        <Button
          size="small"
          variant="contained"
          color="inherit"
          sx={toolbarButtonSx}
          onClick={() => editorRef.current?.exportAsPng()}
        >
          PNG出力
        </Button>
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#555', mx: 0.5 }} />
        <Button
          size="small"
          variant="contained"
          color="inherit"
          sx={toolbarButtonSx}
          onClick={() => editorRef.current?.undo()}
        >
          戻す (⌘Z)
        </Button>
        <Typography
          variant="caption"
          sx={{ color: '#ddd', ml: 'auto', whiteSpace: 'nowrap', fontSize: 13 }}
        >
          ドラッグ→部屋作成　クリック→選択　Shift+クリック→複数選択　ダブルクリック→名前　Delete→削除　ホイール→ズーム　Space+ドラッグ→移動　⌘0→リセット
        </Typography>
      </Box>

      {/* Canvas */}
      <div id="container" ref={containerRef}>
        <canvas ref={canvasRef} />
      </div>

      {/* Status bar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 24,
          bgcolor: 'background.paper',
          color: '#999',
          fontSize: 11,
          lineHeight: '24px',
          px: '10px',
          borderTop: '1px solid #444',
        }}
      >
        {status}
      </Box>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoad}
      />

      {/* Room dialog */}
      {dialogData && <RoomDialog open={dialogOpen} data={dialogData} onClose={handleDialogClose} />}

      {/* Marker dialog */}
      {markerDialogData && (
        <MarkerDialog
          open={markerDialogOpen}
          data={markerDialogData}
          onClose={handleMarkerDialogClose}
        />
      )}

      {/* FreeText dialog */}
      {freeTextDialogData && (
        <FreeTextDialog
          open={freeTextDialogOpen}
          data={freeTextDialogData}
          onClose={handleFreeTextDialogClose}
        />
      )}

      {/* Context menu */}
      <ContextMenu
        open={ctxMenu !== null}
        anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}
        items={ctxMenu?.items ?? []}
        onClose={() => setCtxMenu(null)}
      />
    </ThemeProvider>
  );
  /* eslint-enable no-irregular-whitespace */
}

const toolbarButtonSx = {
  bgcolor: '#444',
  color: '#ccc',
  border: '1px solid #555',
  borderRadius: '3px',
  fontSize: 12,
  textTransform: 'none',
  px: '10px',
  py: '2px',
  minWidth: 0,
  lineHeight: 1.6,
  boxShadow: 'none',
  '&:hover': { bgcolor: '#555', color: '#fff', boxShadow: 'none' },
} as const;
