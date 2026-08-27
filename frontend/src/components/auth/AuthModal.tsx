import { Modal } from '../ui/Modal';
import { LoginForm, SignupForm } from './AuthForms';

export type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
}

export function AuthModal({ open, mode, onClose, onModeChange }: AuthModalProps) {
  const isLogin = mode === 'login';

  return (
    <Modal open={open} onClose={onClose} title={isLogin ? 'Log in' : 'Create your account'}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
          {isLogin ? 'Welcome back' : 'Join TapTim'}
        </h2>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          {isLogin
            ? 'Log in to pick up your team search where you left off.'
            : 'Tell us your role and skills, and we will start matching you with teammates.'}
        </p>
      </div>

      {isLogin ? (
        <LoginForm onSuccess={onClose} onSwitch={() => onModeChange('signup')} />
      ) : (
        <SignupForm onSuccess={onClose} onSwitch={() => onModeChange('login')} />
      )}
    </Modal>
  );
}
