import Divider from '@mui/material/Divider';
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
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: 1,
            borderColor: 'divider',
            minWidth: 140,
          },
        },
      }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <Divider key={`sep-${i}`} />;
        }
        return (
          <MenuItem
            key={`${i}-${item.label}`}
            disabled={item.disabled}
            onClick={async () => {
              try {
                await item.action();
              } finally {
                onClose();
              }
            }}
            sx={{
              fontSize: 13,
              py: 0.75,
            }}
          >
            {item.label}
          </MenuItem>
        );
      })}
    </Menu>
  );
}
