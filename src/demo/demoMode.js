/**
 * Utilitas untuk manajemen Demo Mode.
 *
 * Demo Mode disimpan di localStorage agar persist di antara navigasi,
 * namun TIDAK mempengaruhi session sungguhan.
 */

const DEMO_KEY = 'jingga_demo_mode';

export const isDemoMode = () => {
  try {
    return localStorage.getItem(DEMO_KEY) === 'true';
  } catch {
    return false;
  }
};

export const enableDemoMode = () => {
  try {
    localStorage.setItem(DEMO_KEY, 'true');
  } catch { /* ignore */ }
};

export const disableDemoMode = () => {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch { /* ignore */ }
};
