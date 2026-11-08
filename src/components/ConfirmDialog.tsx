import { motion } from 'framer-motion';
import BottomSheet from './BottomSheet';
import { haptic } from '../lib/haptics';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// An iOS-style action sheet: message and the action on top, Cancel on its own below.
export default function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel }: Props) {
  return (
    <BottomSheet open={open} onClose={onCancel} title={title}>
      <p className="muted pb-5 text-center text-sm">{message}</p>
      <div className="space-y-2.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          className={`${danger ? 'btn-danger' : 'btn-primary'} min-h-[52px] w-full text-base`}
          onClick={() => {
            haptic();
            onConfirm();
          }}
        >
          {confirmLabel}
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.96 }} className="btn-secondary min-h-[52px] w-full text-base" onClick={onCancel}>
          Cancel
        </motion.button>
      </div>
    </BottomSheet>
  );
}
