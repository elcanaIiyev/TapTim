import { Modal } from '../ui/Modal';
import { LoginForm } from './AuthForms';
import { SignupWizard } from './SignupWizard';

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
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          {isLogin
            ? 'Log in to pick up your team search where you left off.'
            : 'Three quick steps, then we build your profile together.'}
        </p>
      </div>

      {isLogin ? (
        <LoginForm onSuccess={onClose} onSwitch={() => onModeChange('signup')} />
      ) : (
        <SignupWizard onSuccess={onClose} onSwitch={() => onModeChange('login')} />
      )}
    </Modal>
  );
}
