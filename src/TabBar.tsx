import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import MuiTab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ContextMenu from './ContextMenu.tsx';
import type { ContextMenuItem } from './context-menu.ts';

export interface TabBarProps {
  tabs: Array<{ id: string; name: string; isActive: boolean }>;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabAdd: () => void;
  onTabDuplicate: (id: string) => void;
  onTabRename: (id: string, newName: string) => void;
  onOpenProjectList: () => void;
}

export default function TabBar({
  tabs,
  onTabClick,
  onTabClose,
  onTabAdd,
  onTabDuplicate,
  onTabRename,
  onOpenProjectList,
}: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [renameAnchorEl, setRenameAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = useCallback((id: string, name: string, e: React.MouseEvent) => {
    setEditingId(id);
    setEditValue(name);
    setRenameAnchorEl(e.currentTarget as HTMLElement);
  }, []);

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onTabRename(editingId, editValue.trim());
    }
    setEditingId(null);
    setRenameAnchorEl(null);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  const activeId: string | false = tabs.find((t) => t.isActive)?.id ?? false;

  const ctxMenuItems: ContextMenuItem[] = useMemo(() => {
    if (!ctxMenu) return [];
    const tabId = ctxMenu.tabId;
    const tabName = tabs.find((t) => t.id === tabId)?.name ?? '';
    const items: ContextMenuItem[] = [
      {
        label: 'プロジェクトを複製',
        action: () => onTabDuplicate(tabId),
      },
      {
        label: '名前を変更',
        action: () => {
          setEditingId(tabId);
          setEditValue(tabName);
          // コンテキストメニュー経由の場合、対象タブのDOM要素をanchorに使う
          const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
          setRenameAnchorEl(tabEl as HTMLElement | null);
        },
      },
    ];
    if (tabs.length > 1) {
      items.push({ separator: true });
      items.push({
        label: 'タブを閉じる',
        action: () => onTabClose(tabId),
      });
    }
    return items;
  }, [ctxMenu, tabs, onTabDuplicate, onTabClose, handleDoubleClick]);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
      <Tabs
        value={activeId}
        onChange={(_e, newValue: string) => onTabClick(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          flex: 1,
          minHeight: 0,
          '& .MuiTabs-indicator': { height: 3 },
          '& .MuiTab-root': {
            minHeight: 40,
            textTransform: 'none',
            fontSize: 13,
            py: 0.5,
          },
        }}
      >
        {tabs.map((tab) => (
          <MuiTab
            key={tab.id}
            value={tab.id}
            data-tab-id={tab.id}
            onDoubleClick={(e) => handleDoubleClick(tab.id, tab.name, e)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            label={
              <Box
                component="span"
                sx={{
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.name}
              </Box>
            }
          />
        ))}
      </Tabs>

      {/* 閉じるボタン: Tabの外に配置してネストしたインタラクティブ要素を回避 */}
      {tabs.length > 1 && (() => {
        const active = tabs.find((t) => t.isActive);
        return active ? (
          <IconButton
            size="small"
            onClick={() => onTabClose(active.id)}
            aria-label="タブを閉じる"
            sx={{
              ml: -1,
              mr: 0.5,
              width: 20,
              height: 20,
              color: '#888',
              '&:hover': { color: '#fff' },
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        ) : null;
      })()}

      {/* リネーム用Popover */}
      <Popover
        open={editingId !== null && renameAnchorEl !== null}
        anchorEl={renameAnchorEl}
        onClose={commitRename}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        disableAutoFocus={false}
        slotProps={{ paper: { sx: { bgcolor: '#222', p: 0.5 } } }}
      >
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setEditingId(null);
              setRenameAnchorEl(null);
            }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#222',
            color: '#fff',
            border: '1px solid #666',
            fontSize: 12,
            padding: '2px 4px',
            width: 120,
            outline: 'none',
          }}
        />
      </Popover>

      <IconButton
        onClick={onTabAdd}
        title="新規プロジェクト"
        aria-label="新規プロジェクト"
        sx={{ color: '#aaa', '&:hover': { color: '#fff' } }}
      >
        <AddIcon />
      </IconButton>
      <IconButton
        onClick={onOpenProjectList}
        title="プロジェクト一覧"
        aria-label="プロジェクト一覧"
        sx={{ color: '#aaa', mr: 0.5, '&:hover': { color: '#fff' } }}
      >
        <MenuIcon />
      </IconButton>

      <ContextMenu
        open={ctxMenu !== null}
        anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}
        items={ctxMenuItems}
        onClose={() => setCtxMenu(null)}
      />
    </Box>
  );
}
