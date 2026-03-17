import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
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
  syncWithServer,
  duplicateProject,
} from './project-store.ts';
import RoomDialog from './RoomDialog.tsx';
import MarkerDialog from './MarkerDialog.tsx';
import FreeTextDialog from './FreeTextDialog.tsx';
import ContextMenu from './ContextMenu.tsx';
import type { ContextMenuItem } from './context-menu.ts';
import TabBar from './TabBar.tsx';
import ProjectListModal from './ProjectListModal.tsx';
import ShortcutHelpDialog from './ShortcutHelpDialog.tsx';
import { modKeyCombo } from './platform.ts';

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
  const [paintMode, setPaintMode] = useState(false);
  const [paintColor, setPaintColor] = useState('#ff0000');
  const [paintLineWidth, setPaintLineWidth] = useState(3);
  const [paintOpacity, setPaintOpacity] = useState(1);

  // Multi-project state
  // tabState: React state (レンダリング用), tabStateRef: ref (コールバック内での最新値参照用)
  // 状態変更は必ず updateTabState() を通すこと（両方を同期更新する）
  const [projectIndex, setProjectIndex] = useState<ProjectMeta[]>([]);
  const [tabState, setTabState] = useState<TabState>({ openTabs: [], activeTabId: '' });
  const tabStateRef = useRef<TabState>({ openTabs: [], activeTabId: '' });
  const [projectListOpen, setProjectListOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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
    const { rooms, freeTexts, freeStrokes, history } = editor.getState();
    const viewport = editor.getViewport();
    saveProjectData(activeId, {
      rooms,
      freeTexts,
      freeStrokes,
      viewport,
      history,
    } satisfies ProjectData);
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
          freeStrokes: [],
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

  // ? key to toggle shortcut help dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === '?' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        setShortcutHelpOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;

    // Migration & initial load
    migrateIfNeeded();
    const preSyncCount = loadProjectIndex().length;
    syncWithServer()
      .then(() => {
        const postSyncIndex = loadProjectIndex();
        if (postSyncIndex.length !== preSyncCount) {
          setProjectIndex(postSyncIndex);
        }
      })
      .catch(() => {
        // dev server not available
      });
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
        onPaintModeChange: (mode: boolean) => setPaintMode(mode),
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

  // Open a newly created/duplicated project in a new tab
  const openProjectInNewTab = useCallback(
    (meta: ProjectMeta, data: ProjectData) => {
      setProjectIndex((prev) => [...prev, meta]);
      updateTabState({
        openTabs: [...tabStateRef.current.openTabs, meta.id],
        activeTabId: meta.id,
      });
      editorRef.current?.loadProjectState(data);
    },
    [updateTabState],
  );

  const handleTabAdd = useCallback(() => {
    saveCurrentProject();
    const { meta, data } = createNewProject();
    openProjectInNewTab(meta, data);
  }, [saveCurrentProject, openProjectInNewTab]);

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
      setDeleteTargetId(id);
      setDeleteConfirmOpen(true);
    },
    [],
  );

  const executeDeleteProject = useCallback(
    (id: string) => {
      deleteProject(id);
      const index = loadProjectIndex();
      setProjectIndex(index);

      const ts = tabStateRef.current;
      if (ts.openTabs.includes(id)) {
        const { newTabs, newActiveId } = removeTabAndSwitch(id, ts.openTabs);
        if (newTabs.length === 0) {
          const { meta, data } = createNewProject();
          openProjectInNewTab(meta, data);
        } else {
          updateTabState({ openTabs: newTabs, activeTabId: newActiveId });
        }
      }
    },
    [removeTabAndSwitch, updateTabState, openProjectInNewTab],
  );

  const handleDeleteConfirmClose = useCallback(
    (confirmed: boolean) => {
      setDeleteConfirmOpen(false);
      if (confirmed && deleteTargetId) {
        executeDeleteProject(deleteTargetId);
      }
      setDeleteTargetId(null);
    },
    [deleteTargetId, executeDeleteProject],
  );

  const handleDuplicateProject = useCallback(
    (id: string) => {
      if (id === tabStateRef.current.activeTabId) {
        saveCurrentProject();
      }
      const result = duplicateProject(id);
      if (!result) return;
      openProjectInNewTab(result.meta, result.data);
    },
    [saveCurrentProject, openProjectInNewTab],
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
        <Box component="span" sx={{ fontSize: 14, lineHeight: 1 }} aria-hidden="true">
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
        onTabDuplicate={handleDuplicateProject}
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
          戻す ({modKeyCombo('Z')})
        </Button>
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#555', mx: 0.5 }} />
        <Button
          size="small"
          variant="contained"
          color="inherit"
          sx={{
            ...toolbarButtonSx,
            ...(paintMode && {
              bgcolor: '#1976d2',
              color: '#fff',
              borderColor: '#1976d2',
              '&:hover': { bgcolor: '#1565c0', color: '#fff', boxShadow: 'none' },
            }),
          }}
          onClick={() => {
            editorRef.current?.setPaintMode(!paintMode);
          }}
        >
          ペン (P)
        </Button>
        {paintMode && (
          <>
            <input
              type="color"
              value={paintColor}
              onChange={(e) => {
                setPaintColor(e.target.value);
                editorRef.current?.setPaintColor(e.target.value);
              }}
              style={{ width: 28, height: 24, border: 'none', padding: 0, cursor: 'pointer' }}
              title="ペン色"
            />
            <select
              value={paintLineWidth}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPaintLineWidth(v);
                editorRef.current?.setPaintLineWidth(v);
              }}
              style={{
                height: 24,
                fontSize: 11,
                background: '#444',
                color: '#ccc',
                border: '1px solid #555',
                borderRadius: 3,
              }}
              title="ペン太さ"
            >
              <option value={1}>1px</option>
              <option value={2}>2px</option>
              <option value={3}>3px</option>
              <option value={6}>6px</option>
              <option value={10}>10px</option>
            </select>
            <select
              value={paintOpacity}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPaintOpacity(v);
                editorRef.current?.setPaintOpacity(v);
              }}
              style={{
                height: 24,
                fontSize: 11,
                background: '#444',
                color: '#ccc',
                border: '1px solid #555',
                borderRadius: 3,
              }}
              title="不透明度"
            >
              <option value={1}>100%</option>
              <option value={0.8}>80%</option>
              <option value={0.5}>50%</option>
              <option value={0.3}>30%</option>
            </select>
          </>
        )}
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShortcutHelpOpen(true)}
          sx={{
            ml: 'auto',
            minWidth: 32,
            px: 1,
            fontSize: 14,
            color: '#ccc',
            borderColor: '#555',
            '&:hover': { borderColor: '#888', bgcolor: 'rgba(255,255,255,0.08)' },
          }}
          title="ショートカットキー一覧 (?)"
        >
          ?
        </Button>
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
        onDuplicate={handleDuplicateProject}
        onDelete={handleDeleteProject}
        onClose={() => setProjectListOpen(false)}
      />

      {/* Shortcut help dialog */}
      <ShortcutHelpDialog open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => handleDeleteConfirmClose(false)}>
        <DialogTitle>プロジェクトの削除</DialogTitle>
        <DialogContent>
          <DialogContentText>このプロジェクトを削除しますか？</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDeleteConfirmClose(false)}>キャンセル</Button>
          <Button onClick={() => handleDeleteConfirmClose(true)} color="error" autoFocus>
            削除
          </Button>
        </DialogActions>
      </Dialog>
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
