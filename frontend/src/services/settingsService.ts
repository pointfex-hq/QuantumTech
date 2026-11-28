import { StoreSettings } from '../types';
import { initialStoreSettings } from '../data/mockData';
import { getItem, setItem, STORAGE_KEYS } from '../utilities/storage';
import { syncSettings } from './backend';

export const settingsService = {
  getSettings(): StoreSettings {
    const saved = getItem<StoreSettings>(STORAGE_KEYS.SETTINGS, initialStoreSettings);
    return { ...initialStoreSettings, ...saved };
  },

  saveSettings(newSettings: StoreSettings): StoreSettings {
    setItem(STORAGE_KEYS.SETTINGS, newSettings);
    window.dispatchEvent(new Event('quantum_settings_updated'));
    syncSettings(newSettings);
    return newSettings;
  },
};
