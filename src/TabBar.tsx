import { useState, useRef, useEffect } from 'react';

export interface TabBarProps {
  tabs: Array<{ id: string; name: string; isActive: boolean }>;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabAdd: () => void;
  onTabRename: (id: string, newName: string) => void;
  onOpenProjectList: () => void;
}

export default function TabBar({
  tabs,
  onTabClick,
  onTabClose,
  onTabAdd,
  onTabRename,
  onOpenProjectList,
}: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onTabRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div style={barStyle}>
      <div className="tab-bar-tabs" style={tabsContainerStyle}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              ...tabStyle,
              ...(tab.isActive ? activeTabStyle : inactiveTabStyle),
            }}
            onClick={() => onTabClick(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab.id, tab.name)}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                style={inputStyle}
              />
            ) : (
              <span style={tabLabelStyle}>{tab.name}</span>
            )}
            {tabs.length > 1 && (
              <button
                style={closeStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                title="タブを閉じる"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        style={addButtonStyle}
        onClick={onTabAdd}
        title="新規プロジェクト"
        aria-label="新規プロジェクト"
      >
        +
      </button>
      <button
        style={listButtonStyle}
        onClick={onOpenProjectList}
        title="プロジェクト一覧"
        aria-label="プロジェクト一覧"
      >
        ☰
      </button>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  height: 32,
  backgroundColor: '#2a2a2a',
  display: 'flex',
  alignItems: 'flex-end',
  paddingLeft: 4,
  overflow: 'hidden',
};

const tabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  alignItems: 'flex-end',
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollbarWidth: 'none',
  gap: 2,
};

const tabStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 12px',
  width: 160,
  minWidth: 100,
  height: 26,
  cursor: 'pointer',
  color: '#aaa',
  fontSize: 12,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  flexShrink: 0,
  borderRadius: '6px 6px 0 0',
  transition: 'background-color 0.1s',
};

const activeTabStyle: React.CSSProperties = {
  backgroundColor: '#555',
  color: '#eee',
  height: 28,
};

const inactiveTabStyle: React.CSSProperties = {
  backgroundColor: '#383838',
};

const tabLabelStyle: React.CSSProperties = {
  maxWidth: 120,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const closeStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 14,
  lineHeight: '14px',
  color: '#888',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: 0,
};

const inputStyle: React.CSSProperties = {
  background: '#222',
  color: '#fff',
  border: '1px solid #666',
  fontSize: 12,
  padding: '0 4px',
  width: 100,
  outline: 'none',
};

const addButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#aaa',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 8px',
  height: 32,
  lineHeight: '32px',
};

const listButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#aaa',
  fontSize: 14,
  cursor: 'pointer',
  padding: '0 8px',
  height: 32,
  lineHeight: '32px',
};
