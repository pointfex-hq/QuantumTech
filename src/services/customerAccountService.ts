import { DeliveryArea } from '../types';

export interface CustomerProfile {
  name: string;
  email: string;
  phone: string;
  address?: string;
  area?: DeliveryArea;
}

export type CustomerStatus = 'Active' | 'Blocked';

export interface ManagedCustomer extends CustomerProfile {
  createdAt: string;
  status: CustomerStatus;
}

interface CustomerAccount extends CustomerProfile {
  passwordHash: string;
  createdAt: string;
  status?: CustomerStatus;
}

const ACCOUNTS_KEY = 'qt_customer_accounts';
const SESSION_KEY = 'qt_customer_session';

const readAccounts = (): CustomerAccount[] => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') as CustomerAccount[];
  } catch {
    return [];
  }
};

const writeAccounts = (accounts: CustomerAccount[]) => {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const customerAccountService = {
  getCustomers(): ManagedCustomer[] {
    return readAccounts().map(({ passwordHash: _passwordHash, ...account }) => ({
      ...account,
      status: account.status || 'Active',
    }));
  },

  setCustomerStatus(email: string, status: CustomerStatus): void {
    const accounts = readAccounts().map((account) =>
      account.email.toLowerCase() === email.toLowerCase()
        ? { ...account, status }
        : account
    );
    writeAccounts(accounts);
    window.dispatchEvent(new Event('quantum_customer_updated'));
  },

  getSession(): CustomerProfile | null {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as CustomerProfile | null;
      if (!session) return null;
      const account = readAccounts().find((item) => item.email.toLowerCase() === session.email.toLowerCase());
      if (account?.status === 'Blocked') {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  async hashPassword(password: string): Promise<string> {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  },

  async register(profile: CustomerProfile, password: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = profile.email.trim().toLowerCase();
    const accounts = readAccounts();
    if (accounts.some((account) => account.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email already exists.' };
    }
    if (accounts.some((account) => account.phone.replace(/[\s-]/g, '') === profile.phone.replace(/[\s-]/g, ''))) {
      return { success: false, error: 'An account with this phone number already exists.' };
    }

    const account: CustomerAccount = {
      ...profile,
      email: cleanEmail,
      phone: profile.phone.replace(/[\s-]/g, ''),
      passwordHash: await this.hashPassword(password),
      createdAt: new Date().toISOString(),
      status: 'Active',
    };
    writeAccounts([...accounts, account]);
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      name: account.name,
      email: account.email,
      phone: account.phone,
      address: account.address,
      area: account.area,
    }));
    window.dispatchEvent(new Event('quantum_customer_updated'));
    return { success: true };
  },

  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const account = readAccounts().find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!account || account.passwordHash !== await this.hashPassword(password)) {
      return { success: false, error: 'Invalid email or password.' };
    }
    if (account.status === 'Blocked') {
      return { success: false, error: 'This account has been disabled. Please contact customer support.' };
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      name: account.name,
      email: account.email,
      phone: account.phone,
      address: account.address,
      area: account.area,
    }));
    window.dispatchEvent(new Event('quantum_customer_updated'));
    return { success: true };
  },

  updateProfile(profile: CustomerProfile): void {
    const session = this.getSession();
    if (!session) return;
    const accounts = readAccounts();
    const updatedAccounts = accounts.map((account) =>
      account.email.toLowerCase() === session.email.toLowerCase()
        ? { ...account, ...profile, email: profile.email.trim().toLowerCase(), phone: profile.phone.replace(/[\s-]/g, '') }
        : account
    );
    writeAccounts(updatedAccounts);
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      name: profile.name,
      email: profile.email.trim().toLowerCase(),
      phone: profile.phone.replace(/[\s-]/g, ''),
      address: profile.address,
      area: profile.area,
    }));
    window.dispatchEvent(new Event('quantum_customer_updated'));
  },

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event('quantum_customer_updated'));
  },
};
