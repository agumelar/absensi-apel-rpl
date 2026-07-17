import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import {
  MAX_RANGE_SPAN,
  REQUIRED_COLUMNS,
  parseFlexibleDate,
  enumerateDatesInclusiveWIB,
  isWeekendWIBDate,
  validateRangeRows,
  expandRangesToDailyRecords,
  buildPreviewModel,
  chunkDailyRecords,
  buildUpsertPayload,
} from './calendarUploadRules.js';

const NUM_RUNS = 100;

// ---------------------------------------------------------------------------
// Generator helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Pad number to 2 digits.
const pad2 = (n) => String(n).padStart(2, '0');

// Number of days in a given month (1-12) for a given year (Gregorian).
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

// Generator: valid calendar date as { year, month, day, iso } including
// month/year boundaries. Years chosen to cover a broad, realistic range.
const validDateArb = fc
  .record({
    year: fc.integer({ min: 1970, max: 2100 }),
    month: fc.integer({ min: 1, max: 12 }),
    dayRaw: fc.integer({ min: 1, max: 31 }),
  })
  .map(({ year, month, dayRaw }) => {
    const day = Math.min(dayRaw, daysInMonth(year, month));
    const iso = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
    return { year, month, day, iso };
  });

// Generator that biases toward month/year boundary days (1st, 28-31, Dec/Jan).
const boundaryDateArb = fc
  .record({
    year: fc.integer({ min: 1999, max: 2101 }),
    month: fc.constantFrom(1, 2, 12),
    dayRaw: fc.constantFrom(1, 28, 29, 30, 31),
  })
  .map(({ year, month, dayRaw }) => {
    const day = Math.min(dayRaw, daysInMonth(year, month));
    const iso = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
    return { year, month, day, iso };
  });

const anyValidDateArb = fc.oneof(validDateArb, boundaryDateArb);

// Render a valid date object as YYYY-MM-DD.
const renderIso = ({ year, month, day }) =>
  `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;

// Render a valid date object as DD/MM/YYYY.
const renderDmy = ({ year, month, day }) => `${pad2(day)}/${pad2(month)}/${year}`;

// Add N days (inclusive-span semantics elsewhere) to an ISO date via UTC noon.
const isoPlusDays = (iso, days) => {
  const base = new Date(`${iso}T12:00:00Z`);
  const next = new Date(base.getTime() + days * MS_PER_DAY);
  const y = next.getUTCFullYear();
  const m = next.getUTCMonth() + 1;
  const d = next.getUTCDate();
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
};

// Reference enumeration of inclusive weekday (Mon-Fri) ISO dates using UTC noon.
const refWeekdaysInclusive = (startIso, endIso) => {
  const out = [];
  let cursor = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    const dow = cursor.getUTCDay(); // 0=Sun..6=Sat
    if (dow !== 0 && dow !== 6) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth() + 1;
      const d = cursor.getUTCDate();
      out.push(`${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`);
    }
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }
  return out;
};

// Generator: a valid Range_Row (already-validated shape) with a bounded span.
// maxSpan controls the largest inclusive span (in days).
const validRangeRowArb = (maxSpan = 30) =>
  fc
    .record({
      start: anyValidDateArb,
      spanMinus1: fc.integer({ min: 0, max: maxSpan - 1 }),
      keterangan: fc.option(fc.string(), { nil: null }),
    })
    .map(({ start, spanMinus1, keterangan }) => {
      const tanggalMulai = start.iso;
      const tanggalSelesai = isoPlusDays(tanggalMulai, spanMinus1);
      return { tanggalMulai, tanggalSelesai, keterangan };
    });

// Generator: raw row object (as parsed from a file) with valid dates.
const validRawRowArb = fc
  .record({
    start: anyValidDateArb,
    spanMinus1: fc.integer({ min: 0, max: 30 }),
    keterangan: fc.string(),
    useDmy: fc.boolean(),
  })
  .map(({ start, spanMinus1, keterangan, useDmy }) => {
    const startIso = start.iso;
    const endIso = isoPlusDays(startIso, spanMinus1);
    const endObj = {
      year: Number(endIso.slice(0, 4)),
      month: Number(endIso.slice(5, 7)),
      day: Number(endIso.slice(8, 10)),
    };
    return {
      tanggal_mulai: useDmy ? renderDmy(start) : renderIso(start),
      tanggal_selesai: useDmy ? renderDmy(endObj) : endIso,
      keterangan,
    };
  });

// Generator: a malformed date string that parseFlexibleDate must reject.
const malformedDateStringArb = fc.oneof(
  fc.constantFrom(
    '31/02/2026',
    '30/02/2024',
    '00/01/2026',
    '13/13/2026',
    '2026-02-31',
    '2026-13-01',
    '2026-00-10',
    'bukan-tanggal',
    'abc',
    '2026/01/01x',
    '1-1-2026',
    '2026.01.01',
  ),
  // structurally-wrong strings
  fc.string({ minLength: 1, maxLength: 8 }).filter((s) => !/^\d/.test(s)),
);

// ---------------------------------------------------------------------------
// Property 1: Round-trip parsing tanggal fleksibel tanpa geser hari
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 1: round-trip parseFlexibleDate (YYYY-MM-DD & DD/MM/YYYY) == ISO asli tanpa geser hari
test('Property 1: parseFlexibleDate round-trips valid dates in both formats without day shift', () => {
  fc.assert(
    fc.property(anyValidDateArb, (dateObj) => {
      const expectedIso = dateObj.iso;

      const fromIso = parseFlexibleDate(renderIso(dateObj));
      assert.equal(fromIso.error, null);
      assert.equal(fromIso.iso, expectedIso);

      const fromDmy = parseFlexibleDate(renderDmy(dateObj));
      assert.equal(fromDmy.error, null);
      assert.equal(fromDmy.iso, expectedIso);
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 2: Kolom wajib hilang selalu ditolak
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 2: header tanpa kolom wajib → errors non-kosong (sebut kolom hilang) & rows kosong
test('Property 2: validateRangeRows rejects rows missing required columns', () => {
  fc.assert(
    fc.property(
      // Choose a non-empty subset of required columns to drop.
      fc
        .subarray(REQUIRED_COLUMNS, { minLength: 1 })
        .chain((toDrop) =>
          fc
            .array(
              fc.record({
                tanggal_mulai: fc.string(),
                tanggal_selesai: fc.string(),
                keterangan: fc.string(),
              }),
              { minLength: 1, maxLength: 10 },
            )
            .map((rows) => ({ toDrop, rows })),
        ),
      ({ toDrop, rows }) => {
        // Build rows that omit the dropped required columns entirely.
        const mutated = rows.map((r) => {
          const copy = { ...r };
          toDrop.forEach((col) => delete copy[col]);
          // Ensure at least one key remains so the row is "non-empty".
          if (Object.keys(copy).length === 0) copy.keterangan = 'x';
          return copy;
        });

        const { rows: outRows, errors } = validateRangeRows(mutated);
        assert.equal(outRows.length, 0);
        assert.ok(errors.length > 0);
        // The error message must mention every missing required column.
        const joined = errors.join(' ');
        toDrop.forEach((col) => {
          assert.ok(joined.includes(col), `error should mention missing column ${col}`);
        });
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 3: Baris tak valid selalu ditandai galat beserta nomor baris
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 3: baris cacat (tanggal tak dikenal / selesai<mulai / span>400) → error memuat nomor baris, baris tak masuk rows; ≥1 cacat → errors non-kosong
test('Property 3: validateRangeRows flags each malformed row with its line number and excludes it', () => {
  const badRowArb = fc.oneof(
    // (a) unrecognizable date
    fc.record({
      kind: fc.constant('bad-date'),
      tanggal_mulai: malformedDateStringArb,
      tanggal_selesai: anyValidDateArb.map(renderIso),
    }),
    // (b) selesai earlier than mulai
    anyValidDateArb
      .chain((start) =>
        fc
          .integer({ min: 1, max: 40 })
          .map((back) => ({
            kind: 'reversed',
            tanggal_mulai: start.iso,
            tanggal_selesai: isoPlusDays(start.iso, -back),
          })),
      ),
    // (c) span over the max (401..430)
    anyValidDateArb.chain((start) =>
      fc.integer({ min: MAX_RANGE_SPAN, max: MAX_RANGE_SPAN + 30 }).map((extra) => ({
        kind: 'too-long',
        tanggal_mulai: start.iso,
        tanggal_selesai: isoPlusDays(start.iso, extra), // inclusive span = extra+1 > 400
      })),
    ),
  );

  fc.assert(
    fc.property(
      fc.array(fc.oneof(validRawRowArb, badRowArb), { minLength: 1, maxLength: 12 }),
      (rawRows) => {
        const { rows, errors } = validateRangeRows(rawRows);

        const badLineNos = [];
        rawRows.forEach((r, index) => {
          if (r.kind) badLineNos.push(index + 2);
        });

        if (badLineNos.length > 0) {
          // At least one bad row => errors must be non-empty (write blocked).
          assert.ok(errors.length > 0);
          const joined = errors.join('\n');
          badLineNos.forEach((lineNo) => {
            assert.ok(
              joined.includes(`Baris ${lineNo}`),
              `errors should reference line ${lineNo}`,
            );
          });
          // No bad row should appear in accepted rows.
          rows.forEach((row) => {
            assert.ok(!badLineNos.includes(row.lineNo));
          });
        }
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 4: Keterangan kosong diterima sebagai null
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 4: keterangan kosong/whitespace pada baris valid → diterima, keterangan null
test('Property 4: validateRangeRows accepts blank keterangan and stores null', () => {
  const blankArb = fc
    .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 6 })
    .map((chars) => chars.join(''));

  fc.assert(
    fc.property(validRangeRowArb(30), blankArb, (range, blank) => {
      const rawRow = {
        tanggal_mulai: range.tanggalMulai,
        tanggal_selesai: range.tanggalSelesai,
        keterangan: blank,
      };
      const { rows, errors } = validateRangeRows([rawRow]);
      assert.equal(errors.length, 0);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].keterangan, null);
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 5: Kebenaran & invarian expand rentang
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 5: himpunan tanggal keluaran == gabungan hari kerja Sen-Jum WIB inklusif; semua is_libur true; tanpa weekend
test('Property 5: expandRangesToDailyRecords equals union of inclusive weekdays, all is_libur, no weekend', () => {
  fc.assert(
    fc.property(
      fc.array(validRangeRowArb(30), { minLength: 0, maxLength: 8 }),
      (rows) => {
        const { records } = expandRangesToDailyRecords(rows);

        // Reference expected set: union of Mon-Fri inclusive dates.
        const expected = new Set();
        rows.forEach((row) => {
          refWeekdaysInclusive(row.tanggalMulai, row.tanggalSelesai).forEach((iso) =>
            expected.add(iso),
          );
        });

        const actual = new Set(records.map((r) => r.tanggal));
        assert.deepEqual([...actual].sort(), [...expected].sort());

        // Invariants: is_libur true, no weekend.
        records.forEach((r) => {
          assert.equal(r.is_libur, true);
          assert.equal(isWeekendWIBDate(r.tanggal), false);
        });
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 6: Dedup tanggal dengan aturan "keterangan terakhir menang"
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 6: rentang beririsan → 1 record/tanggal, keterangan == Range_Row terakhir (urutan input) yang mencakup tanggal
test('Property 6: overlapping ranges dedup to one record per date with last-writer-wins keterangan', () => {
  // Build overlapping ranges around a shared base date with distinct keterangan.
  const overlappingRowsArb = anyValidDateArb.chain((base) =>
    fc
      .array(
        fc.record({
          offset: fc.integer({ min: -10, max: 10 }),
          spanMinus1: fc.integer({ min: 0, max: 20 }),
          tag: fc.integer({ min: 0, max: 100000 }),
        }),
        { minLength: 2, maxLength: 6 },
      )
      .map((specs) =>
        specs.map((spec, i) => {
          const start = isoPlusDays(base.iso, spec.offset);
          const end = isoPlusDays(start, spec.spanMinus1);
          return {
            tanggalMulai: start,
            tanggalSelesai: end,
            keterangan: `ket-${i}-${spec.tag}`,
          };
        }),
      ),
  );

  fc.assert(
    fc.property(overlappingRowsArb, (rows) => {
      const { records } = expandRangesToDailyRecords(rows);

      // One record per date.
      const seen = new Set();
      records.forEach((r) => {
        assert.ok(!seen.has(r.tanggal), `duplicate date ${r.tanggal}`);
        seen.add(r.tanggal);
      });

      // For each output date, keterangan == last input row covering it.
      records.forEach((r) => {
        let expectedKet = null;
        rows.forEach((row) => {
          const covers =
            r.tanggal >= row.tanggalMulai && r.tanggal <= row.tanggalSelesai;
          if (covers) expectedKet = row.keterangan ?? null;
        });
        assert.equal(r.keterangan, expectedKet);
      });
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 7: Klasifikasi pratinjau dan konsistensi jumlah
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 7: item overwrite iff tanggal ∈ existing; totalCount == jumlah records; newCount + overwriteCount == totalCount
test('Property 7: buildPreviewModel classifies overwrite iff existing and counts are consistent', () => {
  const dailyRecordsArb = fc.uniqueArray(anyValidDateArb.map((d) => d.iso), {
    minLength: 0,
    maxLength: 30,
  }).map((isos) =>
    isos.map((iso, i) => ({ tanggal: iso, is_libur: true, keterangan: `k${i}` })),
  );

  fc.assert(
    fc.property(
      dailyRecordsArb,
      fc.double({ min: 0, max: 1, noNaN: true }),
      (records, fraction) => {
        // existing set = a subset of the record dates chosen by fraction.
        const existing = new Set(
          records.filter((_, i) => i / Math.max(records.length, 1) < fraction).map((r) => r.tanggal),
        );

        const model = buildPreviewModel(records, existing);

        assert.equal(model.totalCount, records.length);
        assert.equal(model.newCount + model.overwriteCount, model.totalCount);

        model.items.forEach((item) => {
          const shouldOverwrite = existing.has(item.tanggal);
          assert.equal(item.status, shouldOverwrite ? 'overwrite' : 'new');
        });
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 8: Pembagian batch mempertahankan isi dan membatasi ukuran
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 8: tiap batch ≤ size (positif), gabungan berurutan == input; termasuk single-day & size > panjang
test('Property 8: chunkDailyRecords bounds batch size and concatenation reconstructs input', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ tanggal: fc.string(), is_libur: fc.constant(true) }), {
        minLength: 0,
        maxLength: 60,
      }),
      fc.integer({ min: 1, max: 70 }),
      (records, size) => {
        const batches = chunkDailyRecords(records, size);

        // Each batch length <= size.
        batches.forEach((batch) => {
          assert.ok(batch.length <= size);
        });

        // Concatenation reconstructs input exactly (content and order).
        const flat = batches.flat();
        assert.deepEqual(flat, records);

        // No empty batches except when input is empty.
        if (records.length > 0) {
          batches.forEach((b) => assert.ok(b.length > 0));
        }
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 9: Payload penulisan selalu bersih sesuai skema
// ---------------------------------------------------------------------------
// Feature: kalender-pendidikan-upload, Property 9: tiap payload punya tanggal(ISO), is_libur true, keterangan(string|null), updated_at terisi; tanpa hari aktif
test('Property 9: buildUpsertPayload produces schema-clean rows with is_libur true', () => {
  const recordsArb = fc.array(
    fc.record({
      tanggal: anyValidDateArb.map((d) => d.iso),
      keterangan: fc.option(fc.string(), { nil: null }),
    }),
    { minLength: 0, maxLength: 30 },
  );

  fc.assert(
    fc.property(recordsArb, (records) => {
      const nowIso = new Date().toISOString();
      const payload = buildUpsertPayload(records, nowIso);

      assert.equal(payload.length, records.length);
      payload.forEach((row, i) => {
        // tanggal is ISO_Date
        assert.match(row.tanggal, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(row.tanggal, records[i].tanggal);
        // is_libur always true (no active-day rows)
        assert.equal(row.is_libur, true);
        // keterangan is string or null
        assert.ok(row.keterangan === null || typeof row.keterangan === 'string');
        // updated_at is filled
        assert.ok(typeof row.updated_at === 'string' && row.updated_at.length > 0);
      });
    }),
    { numRuns: NUM_RUNS },
  );
});
