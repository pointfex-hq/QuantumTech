import { AdminSession } from '../types';
import { getItem, setItem, removeItem, STORAGE_KEYS } from '../utilities/storage';

const FAILED_ATTEMPTS_KEY = 'qt_admin_failed_attempts';
const LOCKED_UNTIL_KEY = 'qt_admin_locked_until';
const REMEMBERED_EMAIL_KEY = 'qt_admin_remembered_email';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export const authService = {
  getSession(): AdminSession | null {
    const session = getItem<AdminSession | null>(STORAGE_KEYS.ADMIN_SESSION, null);
    if (!session) return null;

    // 30-minute inactivity auto-logout check
    const sessionDuration = 30 * 60 * 1000;
    if (Date.now() - session.loginTime > sessionDuration) {
      this.logout();
      return null;
    }

    return session;
  },

  getLockoutState(): { isLocked: boolean; lockTimeRemaining: number; failedAttempts: number } {
    const now = Date.now();
    const lockedUntil = getItem<number>(LOCKED_UNTIL_KEY, 0);
    const failedAttempts = getItem<number>(FAILED_ATTEMPTS_KEY, 0);
    const isLocked = lockedUntil > now;
    const lockTimeRemaining = isLocked ? Math.ceil((lockedUntil - now) / 1000) : 0;

    return { isLocked, lockTimeRemaining, failedAttempts };
  },

  getRememberedEmail(): string {
    return getItem<string>(REMEMBERED_EMAIL_KEY, 'admin@quantumtech.com');
  },

  setRememberedEmail(email: string): void {
    setItem(REMEMBERED_EMAIL_KEY, email);
  },

  login(
    emailOrPassword: string,
    passwordArg?: string,
    rememberMe: boolean = true
  ): { success: boolean; session?: AdminSession; error?: string; isLocked?: boolean } {
    const now = Date.now();
    const { isLocked, lockTimeRemaining } = this.getLockoutState();

    if (isLocked) {
      const mins = Math.ceil(lockTimeRemaining / 60);
      return {
        success: false,
        isLocked: true,
        error: `Account locked due to multiple failed attempts. Please retry in ${mins} minute(s).`,
      };
    }

    let email = 'admin@quantumtech.com';
    let password = '';

    if (passwordArg !== undefined) {
      email = emailOrPassword.trim();
      password = passwordArg;
    } else {
      password = emailOrPassword;
    }

    if (passwordArg !== undefined && (!email || !email.includes('@'))) {
      return {
        success: false,
        error: 'Please enter a valid administrator email address.',
      };
    }

    // Supported demo passwords
    if (password === 'admin123' || password === 'quantum2026') {
      const session: AdminSession = {
        email: email || 'irfan.shahil@quantumtech.com',
        name: 'Irfan Khan Shahil',
        role: 'Owner',
        loginTime: now,
        rememberMe,
      };

      setItem(STORAGE_KEYS.ADMIN_SESSION, session);
      setItem(FAILED_ATTEMPTS_KEY, 0);
      removeItem(LOCKED_UNTIL_KEY);

      if (rememberMe) {
        this.setRememberedEmail(email);
      }

      window.dispatchEvent(new Event('quantum_auth_updated'));
      return { success: true, session };
    }

    // Handle failed login attempt
    const prevAttempts = getItem<number>(FAILED_ATTEMPTS_KEY, 0);
    const newAttempts = prevAttempts + 1;
    setItem(FAILED_ATTEMPTS_KEY, newAttempts);

    if (newAttempts >= MAX_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_DURATION_MS;
      setItem(LOCKED_UNTIL_KEY, lockedUntil);
      return {
        success: false,
        isLocked: true,
        error: 'Too many incorrect attempts. Admin portal has been locked for 15 minutes.',
      };
    }

    return {
      success: false,
      error: `Invalid credentials. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining before lockout.`,
    };
  },

  logout(): void {
    removeItem(STORAGE_KEYS.ADMIN_SESSION);
    window.dispatchEvent(new Event('quantum_auth_updated'));
  },

  resetLockout(): void {
    setItem(FAILED_ATTEMPTS_KEY, 0);
    removeItem(LOCKED_UNTIL_KEY);
  },
};
