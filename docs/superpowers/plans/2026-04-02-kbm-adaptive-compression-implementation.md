# KBM Adaptive Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat alur check-in/check-out KBM yang tetap andal di berbagai perangkat dengan adaptive compression (target 10KB, normal sampai 30KB, emergency sampai 50KB) tanpa mengorbankan operasional harian guru.

**Architecture:** Kompresi dipisah menjadi policy layer (pure function, mudah dites) dan engine layer (canvas/image processing). UI `MapelSessionPage` tetap capture-first, lalu menampilkan outcome `normal` vs `emergency` secara jujur. Metadata kompresi diteruskan ke storage upload untuk observability dan audit biaya storage free-tier.

**Tech Stack:** React 19, Vite 7, Supabase JS, SweetAlert2, utilitas kompresi berbasis Canvas API.

---

## File Structure (Locked)

- Create: `src/shared/utils/compressionPolicy.js`
  - Tanggung jawab: definisi ladder target ukuran dan helper klasifikasi mode (`normal`, `emergency`, `failed`).
- Create: `src/shared/utils/compressionPolicy.test.mjs`
  - Tanggung jawab: unit test pure policy tanpa DOM.
- Modify: `package.json`
  - Tanggung jawab: menambah script unit test (`test:unit`) berbasis `node --test`.
- Modify: `src/shared/utils/compressor.js`
  - Tanggung jawab: implementasi adaptive ladder engine + metadata terstruktur.
- Modify: `src/services/supabase/storageService.js`
  - Tanggung jawab: normalisasi metadata upload foto mapel (termasuk `oversize_emergency`).
- Modify: `src/features/mapel/pages/MapelSessionPage.jsx`
  - Tanggung jawab: wiring flow check-in/out baru, retry upload, dan feedback UX normal/emergency.
- Modify: `v2-log.md`
  - Tanggung jawab: catatan hasil implementasi Sprint 54 saat selesai.

### Task 1: Bangun Compression Policy + Unit Test

**Files:**
- Create: `src/shared/utils/compressionPolicy.js`
- Create: `src/shared/utils/compressionPolicy.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Tulis failing test untuk ladder dan klasifikasi mode**

```js
// src/shared/utils/compressionPolicy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NORMAL_TARGETS_KB,
  EMERGENCY_TARGETS_KB,
  buildAdaptiveTargetLadder,
  resolveCompressionMode,
} from './compressionPolicy.js';

test('buildAdaptiveTargetLadder menggabungkan normal + emergency tanpa duplikasi', () => {
  assert.deepEqual(buildAdaptiveTargetLadder(), [10, 15, 20, 25, 30, 40, 50]);
});

test('resolveCompressionMode mengembalikan normal untuk <=30KB', () => {
  assert.equal(resolveCompressionMode({ finalSizeBytes: 30 * 1024 }), 'normal');
});

test('resolveCompressionMode mengembalikan emergency untuk >30KB sampai 50KB', () => {
  assert.equal(resolveCompressionMode({ finalSizeBytes: 45 * 1024 }), 'emergency');
});
```

- [ ] **Step 2: Jalankan test dan verifikasi gagal**

Run: `node --test src/shared/utils/compressionPolicy.test.mjs`
Expected: FAIL dengan error `Cannot find module './compressionPolicy.js'`.

- [ ] **Step 3: Implementasi minimal policy**

```js
// src/shared/utils/compressionPolicy.js
export const NORMAL_TARGETS_KB = [10, 15, 20, 25, 30];
export const EMERGENCY_TARGETS_KB = [40, 50];

export const buildAdaptiveTargetLadder = () =>
  [...new Set([...NORMAL_TARGETS_KB, ...EMERGENCY_TARGETS_KB])];

export const resolveCompressionMode = ({ finalSizeBytes }) => {
  const kb = finalSizeBytes / 1024;
  if (kb <= 30) return 'normal';
  if (kb <= 50) return 'emergency';
  return 'failed';
};
```

- [ ] **Step 4: Tambah script test unit**

```json
{
  "scripts": {
    "test:unit": "node --test src/shared/utils/compressionPolicy.test.mjs"
  }
}
```

- [ ] **Step 5: Jalankan test dan verifikasi lulus**

Run: `npm run test:unit`
Expected: PASS (`3 passed`).

- [ ] **Step 6: Commit task 1**

```bash
git add src/shared/utils/compressionPolicy.js src/shared/utils/compressionPolicy.test.mjs package.json
git commit -m "test: add adaptive compression policy unit coverage"
```

### Task 2: Refactor Compressor ke Adaptive Ladder Engine

**Files:**
- Modify: `src/shared/utils/compressor.js`
- Test: `src/shared/utils/compressionPolicy.test.mjs`

- [ ] **Step 1: Tulis failing test untuk contract metadata mode**

```js
test('resolveCompressionMode mengembalikan failed untuk ukuran > 50KB', () => {
  assert.equal(resolveCompressionMode({ finalSizeBytes: 52 * 1024 }), 'failed');
});
```

- [ ] **Step 2: Jalankan test dan verifikasi gagal**

Run: `npm run test:unit`
Expected: FAIL karena kasus `>50KB` belum di-cover.

- [ ] **Step 3: Implementasi engine adaptive di compressor**

```js
import {
  buildAdaptiveTargetLadder,
  resolveCompressionMode,
} from './compressionPolicy';

export const compressImageAdaptiveForSession = async (file, options = {}) => {
  const ladder = buildAdaptiveTargetLadder();
  let lastAttempt = null;

  for (const targetKB of ladder) {
    const attempt = await compressImageWithMeta(file, {
      targetKB,
      strict: false,
      maxWidthOrHeight: 960,
      grayscale: false,
      ...options,
    });
    lastAttempt = attempt;
    if (attempt.metadata.compressedSizeBytes <= targetKB * 1024) {
      const mode = resolveCompressionMode({ finalSizeBytes: attempt.metadata.compressedSizeBytes });
      return {
        file: attempt.file,
        metadata: {
          ...attempt.metadata,
          mode,
          attemptTargetKB: targetKB,
          oversizeEmergency: mode === 'emergency',
        },
      };
    }
  }

  const finalMode = resolveCompressionMode({ finalSizeBytes: lastAttempt?.metadata?.compressedSizeBytes ?? Number.MAX_SAFE_INTEGER });
  if (finalMode === 'failed') {
    throw new Error('Foto tidak dapat dioptimalkan ke batas maksimal 50KB di perangkat ini.');
  }
  return {
    file: lastAttempt.file,
    metadata: {
      ...lastAttempt.metadata,
      mode: finalMode,
      attemptTargetKB: 50,
      oversizeEmergency: true,
    },
  };
};
```

- [ ] **Step 4: Lengkapi test edge case >50KB**

```js
test('resolveCompressionMode mengembalikan failed untuk ukuran > 50KB', () => {
  assert.equal(resolveCompressionMode({ finalSizeBytes: 52 * 1024 }), 'failed');
});
```

- [ ] **Step 5: Jalankan test unit**

Run: `npm run test:unit`
Expected: PASS (`4 passed`).

- [ ] **Step 6: Commit task 2**

```bash
git add src/shared/utils/compressor.js src/shared/utils/compressionPolicy.test.mjs
git commit -m "feat: add adaptive ladder compressor for kbm photo flow"
```

### Task 3: Integrasi UI Check-in/Check-out + Retry Upload

**Files:**
- Modify: `src/features/mapel/pages/MapelSessionPage.jsx`
- Modify: `src/services/supabase/storageService.js`

- [ ] **Step 1: Tulis failing test kecil untuk retry helper (pure function)**

```js
// Tambah di compressionPolicy.test.mjs
import { retryAsync } from './compressionPolicy.js';

test('retryAsync mencoba ulang hingga sukses', async () => {
  let hit = 0;
  const value = await retryAsync(async () => {
    hit += 1;
    if (hit < 2) throw new Error('temporary');
    return 'ok';
  }, { retries: 2 });
  assert.equal(value, 'ok');
});
```

- [ ] **Step 2: Jalankan test dan verifikasi gagal**

Run: `npm run test:unit`
Expected: FAIL karena `retryAsync` belum ada.

- [ ] **Step 3: Implementasi `retryAsync` dan pakai di upload flow**

```js
// compressionPolicy.js
export const retryAsync = async (fn, { retries = 1, delayMs = 400 } = {}) => {
  let lastError;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === retries) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
};
```

```jsx
// MapelSessionPage.jsx (di handlePhotoAction)
const compressed = await compressImageAdaptiveForSession(file);
const upload = await retryAsync(
  () => uploadMapelSessionPhoto({ sessionId: session.id, phase, file: compressed.file, metadata: compressed.metadata }),
  { retries: 2, delayMs: 500 },
);

const isEmergency = compressed.metadata.mode === 'emergency';
Swal.fire(
  'Berhasil',
  isEmergency
    ? `Foto tersimpan mode darurat (${(compressed.metadata.compressedSizeBytes / 1024).toFixed(1)}KB).`
    : `Foto tersimpan optimal (${(compressed.metadata.compressedSizeBytes / 1024).toFixed(1)}KB).`,
  'success',
);
```

```js
// storageService.js (metadata normalization)
return {
  publicUrl,
  filePath,
  metadata: {
    ...(metadata ?? {}),
    oversizeEmergency: Boolean(metadata?.oversizeEmergency),
    compressionMode: metadata?.mode ?? null,
  },
};
```

- [ ] **Step 4: Jalankan test unit + lint**

Run: `npm run test:unit && npm run lint`
Expected: PASS untuk unit test, lint tanpa error baru.

- [ ] **Step 5: Commit task 3**

```bash
git add src/shared/utils/compressionPolicy.js src/features/mapel/pages/MapelSessionPage.jsx src/services/supabase/storageService.js src/shared/utils/compressionPolicy.test.mjs
git commit -m "feat: harden kbm checkin checkout with adaptive compression and retry"
```

### Task 4: Verifikasi End-to-End + Dokumentasi Log

**Files:**
- Modify: `v2-log.md`

- [ ] **Step 1: Jalankan quality gate project**

Run: `npm test`
Expected: PASS (`npm run lint && npm run build`).

- [ ] **Step 2: Verifikasi manual skenario utama**

Run manual di UI:
1. Check-in pada foto besar -> tersimpan normal <=30KB.
2. Simulasi device sulit kompres -> tersimpan emergency <=50KB.
3. Pastikan check-out memakai behavior yang sama.

Expected: Tidak ada blokir karena hard 10KB, dan notifikasi normal/emergency tampil benar.

- [ ] **Step 3: Update `v2-log.md` sebagai implemented**

```md
## 65) Sprint 54 - Adaptive Compression Ladder for Check-in/Check-out (Implemented)
- Implementasi adaptive ladder selesai sesuai design lock.
- Validasi: `npm test` lulus.
```

- [ ] **Step 4: Commit task 4**

```bash
git add v2-log.md
git commit -m "docs: record sprint 54 adaptive compression implementation"
```

## Final Verification Checklist

- [ ] `npm run test:unit`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] Manual smoke di `MapelSessionPage` untuk check-in/check-out normal + emergency
