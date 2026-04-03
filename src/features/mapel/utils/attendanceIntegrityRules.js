const toKey = (value) => String(value ?? '').trim();

const toNumericClassId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const buildSessionClassMap = (sessionRows) => {
  const map = new Map();
  const safeRows = Array.isArray(sessionRows) ? sessionRows : [];

  safeRows.forEach((row) => {
    map.set(toKey(row?.id), toNumericClassId(row?.schedule?.kelas_id));
  });

  return map;
};

export const buildStudentClassMap = (studentRows) => {
  const map = new Map();
  const safeRows = Array.isArray(studentRows) ? studentRows : [];

  safeRows.forEach((row) => {
    map.set(toKey(row?.id), toNumericClassId(row?.kelas_id));
  });

  return map;
};

export const findFirstAttendanceClassMismatch = (entries, sessionClassMap, studentClassMap) => {
  const safeEntries = Array.isArray(entries) ? entries : [];

  for (const entry of safeEntries) {
    const sessionKey = toKey(entry?.sessionId);
    const siswaKey = toKey(entry?.siswaId);
    const sessionKelasId = sessionClassMap.get(sessionKey) ?? null;
    const siswaKelasId = studentClassMap.get(siswaKey) ?? null;

    if (!sessionKelasId || !siswaKelasId || sessionKelasId !== siswaKelasId) {
      return {
        sessionId: sessionKey || null,
        siswaId: siswaKey || null,
        sessionKelasId,
        siswaKelasId,
      };
    }
  }

  return null;
};
