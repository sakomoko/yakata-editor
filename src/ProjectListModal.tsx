import { useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import type { ProjectMeta } from './types.ts';

interface ProjectListModalProps {
  open: boolean;
  projects: ProjectMeta[];
  openTabIds: string[];
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ProjectListModal({
  open,
  projects,
  openTabIds,
  onOpen,
  onDuplicate,
  onDelete,
  onClose,
}: ProjectListModalProps) {
  const sorted = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt), [projects]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>プロジェクト一覧</DialogTitle>
      <DialogContent>
        <List dense>
          {sorted.map((p) => {
            const isOpen = openTabIds.includes(p.id);
            return (
              <ListItem
                key={p.id}
                secondaryAction={
                  <>
                    <Button size="small" onClick={() => onOpen(p.id)} sx={{ mr: 0.5 }}>
                      開く
                    </Button>
                    <Button size="small" onClick={() => onDuplicate(p.id)} sx={{ mr: 0.5 }}>
                      複製
                    </Button>
                    {projects.length > 1 && (
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => onDelete(p.id)}
                        title="削除"
                        aria-label="プロジェクトを削除"
                        sx={{ color: '#999' }}
                      >
                        🗑
                      </IconButton>
                    )}
                  </>
                }
              >
                <ListItemText
                  primary={
                    <>
                      {p.name}
                      {isOpen && (
                        <Chip
                          label="開いている"
                          size="small"
                          sx={{ ml: 1, height: 18, fontSize: 10 }}
                        />
                      )}
                    </>
                  }
                  secondary={`更新: ${formatDate(p.updatedAt)}`}
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
}
