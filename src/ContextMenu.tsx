import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type { ContextMenuItem } from './context-menu.ts';

interface ContextMenuProps {
  open: boolean;
  anchorPosition: { top: number; left: number } | undefined;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ open, anchorPosition, items, onClose }: ContextMenuProps) {
  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#2a2a2a',
            color: '#ccc',
            border: '1px solid #555',
            minWidth: 140,
          },
        },
      }}
    >
      {items.map((item) => (
        <MenuItem
          key={item.label}
          disabled={item.disabled}
          onClick={() => {
            item.action();
            onClose();
          }}
          sx={{
            fontSize: 13,
            py: 0.75,
            '&:hover': { bgcolor: '#444' },
          }}
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
