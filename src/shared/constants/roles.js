export const EXECUTIVE_ROLES = ['kepsek', 'kesiswaan', 'kaprog'];

export const normalizeRole = (role) => role?.toLowerCase() ?? '';

export const isExecutiveRole = (role) => EXECUTIVE_ROLES.includes(normalizeRole(role));
