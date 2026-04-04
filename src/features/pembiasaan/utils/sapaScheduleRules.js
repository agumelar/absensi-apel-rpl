const normalizeText = (value) => String(value || '').trim().toLowerCase();

export const buildHighlightParts = (text, keyword) => {
  const source = String(text || '');
  const needle = String(keyword || '').trim();
  if (!needle) return [{ text: source, match: false }];

  const lowerSource = source.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const start = lowerSource.indexOf(lowerNeedle);

  if (start < 0) return [{ text: source, match: false }];

  const end = start + needle.length;
  const parts = [];
  if (start > 0) parts.push({ text: source.slice(0, start), match: false });
  parts.push({ text: source.slice(start, end), match: true });
  if (end < source.length) parts.push({ text: source.slice(end), match: false });
  return parts;
};

export const filterParticipantsByKeyword = (participants = [], keyword = '') => {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return participants;

  return participants.filter((item) => {
    const name = normalizeText(item?.nama_lengkap);
    const role = normalizeText(item?.role);
    return name.includes(normalizedKeyword) || role.includes(normalizedKeyword);
  });
};

export const sortParticipantsBySelection = (participants = [], selectedUserIds = []) => {
  const selectedSet = new Set((selectedUserIds || []).map((item) => String(item)));
  return [...participants].sort((a, b) => {
    const aSelected = selectedSet.has(String(a?.id || ''));
    const bSelected = selectedSet.has(String(b?.id || ''));
    if (aSelected !== bSelected) return aSelected ? -1 : 1;

    const aName = normalizeText(a?.nama_lengkap);
    const bName = normalizeText(b?.nama_lengkap);
    return aName.localeCompare(bName);
  });
};
