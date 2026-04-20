const normalizeRole = (role) => String(role || '').trim().toLowerCase();

export const isJurusanScopedExecutiveReportRole = (role) => {
  const normalized = normalizeRole(role);

  if (!normalized) return false;

  return false;
};
