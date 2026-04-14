export const EXECUTIVE_ROLES = ['kepsek', 'kesiswaan', 'kaprog', 'kurikulum'];
export const MAPEL_ACCESS_ROLES = [];
export const MAPEL_AUDIT_ROLES = ['kepsek', 'kaprog', 'kurikulum'];
export const PEMBIASAAN_PARTICIPANT_ROLES = [
  'guru',
  'guru_mapel',
  'tu',
  'kesiswaan',
  'kaprog',
  'kurikulum',
  'piket',
  'walikelas',
  'walas',
];

export const normalizeRole = (role) => role?.toLowerCase() ?? '';
export const normalizeBooleanFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 't', 'yes', 'y'].includes(normalized);
  }

  return false;
};

export const isExecutiveRole = (role) => EXECUTIVE_ROLES.includes(normalizeRole(role));
export const isMapelAccessRole = (role) => MAPEL_ACCESS_ROLES.includes(normalizeRole(role));
export const isMapelAuditRole = (role) => MAPEL_AUDIT_ROLES.includes(normalizeRole(role));
export const isPembiasaanParticipantRole = (role) => PEMBIASAAN_PARTICIPANT_ROLES.includes(normalizeRole(role));
