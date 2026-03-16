import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
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
import type { ProjectMeta, ProjectData, TabState, FreeTextEditData } from './types.ts';
import {
  migrateIfNeeded,
  loadProjectIndex,
  loadProjectData,
  saveProjectData,
  touchProjectUpdatedAt,
  deleteProject,
  loadTabState,
  saveTabState,
  createNewProject,
  saveProjectIndex,
} from './project-store.ts';
import RoomDialog from './RoomDialog.tsx';
import MarkerDialog from './MarkerDialog.tsx';
import FreeTextDialog from './FreeTextDialog.tsx';
import ContextMenu from './ContextMenu.tsx';
import type { ContextMenuItem } from './context-menu.ts';
import TabBar from './TabBar.tsx';
import ProjectListModal from './ProjectListModal.tsx';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#888', paper: '#2a2a2a' },
  },
  typography: { fontFamily: '-apple-system, system-ui, sans-serif' },
});

/** debounce付きの updatedAt 更新。高頻度の保存でindex読み書きが毎回走るのを防ぐ */
function createDebouncedTouchUpdatedAt(delayMs: number): (id: string) => void {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let pendingId: string | undefined;
  return (id: string) => {
    pendingId = id;
    if (timerId !== undefined) clearTimeout(timerId);
    timerId = setTimeout(() => {
      if (pendingId) touchProjectUpdatedAt(pendingId);
      timerId = undefined;
      pendingId = undefined;
    }, delayMs);
  };
}

const debouncedTouchUpdatedAt = createDebouncedTouchUpdatedAt(2000);

/** debounce付きの関数生成ユーティリティ */
function createDebouncedFn(fn: () => void, delayMs: number): () => void {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timerId !== undefined) clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn();
      timerId = undefined;
    }, delayMs);
  };
}

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

  // Multi-project state
  const [projectIndex, setProjectIndex] = useState<ProjectMeta[]>([]);
  const [tabState, setTabState] = useState<TabState>({ openTabs: [], activeTabId: '' });
  const tabStateRef = useRef<TabState>({ openTabs: [], activeTabId: '' });
  const [projectListOpen, setProjectListOpen] = useState(false);

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

  // Save current project to storage (unified save logic)
  const saveCurrentProject = useCallback(() => {
    const editor = editorRef.current;
    const activeId = tabStateRef.current.activeTabId;
    if (!editor || !activeId) return;
    const { rooms, freeTexts, history } = editor.getState();
    const viewport = editor.getViewport();
    saveProjectData(activeId, { rooms, freeTexts, viewport, history } satisfies ProjectData);
    debouncedTouchUpdatedAt(activeId);
  }, []);

  // Debounced version for high-frequency events (wheel scroll etc.)
  // useMemo ensures stable reference across re-renders
  const debouncedSaveCurrentProject = useMemo(
    () => createDebouncedFn(() => saveCurrentProject(), 300),
    [saveCurrentProject],
  );

  // Update tabState in both state and ref
  const updateTabState = useCallback((newState: TabState) => {
    tabStateRef.current = newState;
    setTabState(newState);
    saveTabState(newState);
  }, []);

  // Load project into editor with fallback for missing data
  const loadProjectIntoEditor = useCallback((id: string) => {
    const result = loadProjectData(id);
    if (result?.warning) {
      alert(result.warning);
    }
    const editor = editorRef.current;
    if (editor) {
      editor.loadProjectState(
        result?.data ?? {
          rooms: [],
          freeTexts: [],
          viewport: { zoom: 1, panX: 0, panY: 0 },
          history: [],
        },
      );
    }
  }, []);

  // Close a tab from openTabs and switch if needed (shared by handleTabClose & handleDeleteProject)
  const removeTabAndSwitch = useCallback(
    (id: string, openTabs: string[]) => {
      const newTabs = openTabs.filter((t) => t !== id);
      let newActiveId = tabStateRef.current.activeTabId;

      if (id === tabStateRef.current.activeTabId) {
        saveCurrentProject();
        if (newTabs.length > 0) {
          const oldIdx = openTabs.indexOf(id);
          const newIdx = Math.min(oldIdx, newTabs.length - 1);
          newActiveId = newTabs[newIdx];
          loadProjectIntoEditor(newActiveId);
        }
      }

      return { newTabs, newActiveId };
    },
    [saveCurrentProject, loadProjectIntoEditor],
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;

    // Migration & initial load
    migrateIfNeeded();
    let index = loadProjectIndex();
    setProjectIndex(index);

    let ts = loadTabState();
    if (!ts || ts.openTabs.length === 0) {
      if (index.length > 0) {
        ts = { openTabs: [index[0].id], activeTabId: index[0].id };
      } else {
        const { meta } = createNewProject();
        // Re-read index to include the newly created project
        index = loadProjectIndex();
        setProjectIndex(index);
        ts = { openTabs: [meta.id], activeTabId: meta.id };
      }
      saveTabState(ts);
    }

    // Validate tab state against existing projects
    const validIds = new Set(index.map((m) => m.id));
    ts.openTabs = ts.openTabs.filter((id) => validIds.has(id));
    if (ts.openTabs.length === 0 && index.length > 0) {
      ts.openTabs = [index[0].id];
    }
    if (!ts.openTabs.includes(ts.activeTabId)) {
      ts.activeTabId = ts.openTabs[0] ?? '';
    }

    tabStateRef.current = ts;
    setTabState(ts);
    saveTabState(ts);

    // Load active project data
    const activeResult = ts.activeTabId ? loadProjectData(ts.activeTabId) : null;
    if (activeResult?.warning) {
      setTimeout(() => alert(activeResult.warning), 0);
    }

    const api = initEditor(
      canvas,
      container,
      {
        onStatusChange: setStatus,
        onRoomEdit: handleRoomEdit,
        onMarkerEdit: handleMarkerEdit,
        onFreeTextEdit: handleFreeTextEdit,
        onContextMenu: handleContextMenu,
        // editorRef は init 完了後にセットされるが、コールバックはユーザー操作時のみ呼ばれるので問題ない
        onAutoSave: () => saveCurrentProject(),
        // onViewportChange はホイール等で高頻度に呼ばれるため、debounce で全データシリアライズの頻度を抑制
        onViewportChange: () => debouncedSaveCurrentProject(),
      },
      activeResult?.data ?? undefined,
    );
    editorRef.current = api;

    const onResize = () => api.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      api.destroy();
    };
  }, [handleRoomEdit, handleMarkerEdit, handleFreeTextEdit, handleContextMenu]);

  // --- Tab handlers ---

  const handleTabClick = useCallback(
    (id: string) => {
      if (id === tabStateRef.current.activeTabId) return;
      saveCurrentProject();
      loadProjectIntoEditor(id);
      const newTs = { ...tabStateRef.current, activeTabId: id };
      updateTabState(newTs);
    },
    [saveCurrentProject, loadProjectIntoEditor, updateTabState],
  );

  const handleTabAdd = useCallback(() => {
    saveCurrentProject();
    const index = loadProjectIndex();
    const { meta, data } = createNewProject();
    setProjectIndex([...index, meta]);
    const newTs = {
      openTabs: [...tabStateRef.current.openTabs, meta.id],
      activeTabId: meta.id,
    };
    updateTabState(newTs);
    editorRef.current?.loadProjectState(data);
  }, [saveCurrentProject, updateTabState]);

  const handleTabClose = useCallback(
    (id: string) => {
      const ts = tabStateRef.current;
      if (ts.openTabs.length <= 1) return;
      const { newTabs, newActiveId } = removeTabAndSwitch(id, ts.openTabs);
      updateTabState({ openTabs: newTabs, activeTabId: newActiveId });
    },
    [removeTabAndSwitch, updateTabState],
  );

  const handleTabRename = useCallback((id: string, newName: string) => {
    const index = loadProjectIndex();
    const newIndex = index.map((m) =>
      m.id === id ? { ...m, name: newName, updatedAt: Date.now() } : m,
    );
    saveProjectIndex(newIndex);
    setProjectIndex(newIndex);
  }, []);

  // --- Project list modal handlers ---

  const handleOpenProject = useCallback(
    (id: string) => {
      const ts = tabStateRef.current;
      if (ts.openTabs.includes(id)) {
        handleTabClick(id);
      } else {
        saveCurrentProject();
        const newTabs = [...ts.openTabs, id];
        const newTs = { openTabs: newTabs, activeTabId: id };
        updateTabState(newTs);
        loadProjectIntoEditor(id);
      }
      setProjectListOpen(false);
    },
    [handleTabClick, saveCurrentProject, updateTabState, loadProjectIntoEditor],
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      const index = loadProjectIndex();
      if (index.length <= 1) return;

      if (!confirm('このプロジェクトを削除しますか？')) return;

      deleteProject(id);
      const newIndex = index.filter((m) => m.id !== id);
      setProjectIndex(newIndex);

      const ts = tabStateRef.current;
      if (ts.openTabs.includes(id)) {
        const { newTabs, newActiveId } = removeTabAndSwitch(id, ts.openTabs);
        if (newTabs.length === 0) {
          // All tabs closed — create a new project
          const { meta, data } = createNewProject();
          setProjectIndex([...newIndex, meta]);
          updateTabState({ openTabs: [meta.id], activeTabId: meta.id });
          editorRef.current?.loadProjectState(data);
        } else {
          updateTabState({ openTabs: newTabs, activeTabId: newActiveId });
        }
      }
    },
    [removeTabAndSwitch, updateTabState],
  );

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
      // インポート後に即保存してプロジェクトデータに反映
      saveCurrentProject();
    } catch (err) {
      console.error('loadFromFile error:', err);
      alert('ファイルを読み込めませんでした');
    }
    e.target.value = '';
  };

  // Build tabs array for TabBar (memoized)
  const tabs = useMemo(
    () =>
      tabState.openTabs
        .map((id) => {
          const meta = projectIndex.find((m) => m.id === id);
          if (!meta) return null;
          return { id, name: meta.name, isActive: id === tabState.activeTabId };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null),
    [tabState, projectIndex],
  );

  /* eslint-disable no-irregular-whitespace */
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      {/* Header */}
      <Box
        sx={{
          height: 28,
          bgcolor: '#1e1e1e',
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          gap: 1,
          borderBottom: '1px solid #333',
        }}
      >
        {/* TODO: アイコン画像に差し替え */}
        <Box
          component="span"
          sx={{ fontSize: 14, lineHeight: 1 }}
        >
          🏚
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: '#bbb',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          館エディタ
        </Typography>
      </Box>

      {/* Tab Bar */}
      <TabBar
        tabs={tabs}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onTabAdd={handleTabAdd}
        onTabRename={handleTabRename}
        onOpenProjectList={() => setProjectListOpen(true)}
      />

      {/* Canvas */}
      <div id="container" ref={containerRef}>
        <canvas ref={canvasRef} />
      </div>

      {/* Toolbar (bottom) */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 36,
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          px: 1,
          gap: 0.75,
          borderTop: '1px solid #444',
        }}
      >
        <Button
          size="small"
          variant="contained"
          color="inherit"
          sx={toolbarButtonSx}
          onClick={handleTabAdd}
        >
          新規プロジェクト
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

      {/* Status bar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 36,
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

      {/* Project list modal */}
      <ProjectListModal
        open={projectListOpen}
        projects={projectIndex}
        openTabIds={tabState.openTabs}
        onOpen={handleOpenProject}
        onDelete={handleDeleteProject}
        onClose={() => setProjectListOpen(false)}
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
