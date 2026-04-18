import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

import { submitPembiasaanAttendance } from '../../../services/pembiasaanService';
import { ATTENDANCE_DAY_OFF_MESSAGE, getAttendanceDayStatus } from '../../../services/shared/attendanceDayService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const STATUS_OPTIONS = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'izin', label: 'Izin' },
  { value: 'sakit', label: 'Sakit' },
];

const PembiasaanPage = () => {
  const [status, setStatus] = useState('hadir');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAttendanceDayOff, setIsAttendanceDayOff] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const loadDayStatus = async () => {
      try {
        setLoading(true);
        const dayStatus = await getAttendanceDayStatus({});
        if (isCancelled) return;
        setIsAttendanceDayOff(!dayStatus.isActive);
      } catch (error) {
        if (isCancelled) return;
        Swal.fire('Gagal', error.message, 'error');
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadDayStatus();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (isAttendanceDayOff) {
      Swal.fire('Info', ATTENDANCE_DAY_OFF_MESSAGE, 'info');
      return;
    }

    if ((status === 'izin' || status === 'sakit') && !note.trim()) {
      Swal.fire('Validasi', 'Catatan wajib untuk status izin/sakit.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await submitPembiasaanAttendance({ status, note: status === 'hadir' ? '' : note });
      Swal.fire('Berhasil', 'Absensi pembiasaan berhasil disimpan.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-24 text-center">
        <Loader2 className="mx-auto animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-3xl">Pembiasaan</PageTitle>
        <PageSubtitle className="mt-2">
          Cutoff 07:00 WIB, Senin-Jumat. Hadir wajib GPS + foto, izin/sakit cukup catatan.
        </PageSubtitle>
      </PageHeader>

      {isAttendanceDayOff ? (
        <Card>
          <CardContent className="p-5 text-sm font-semibold text-amber-800">{ATTENDANCE_DAY_OFF_MESSAGE}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-5">
            <label className="block text-xs font-bold text-slate-600">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            {(status === 'izin' || status === 'sakit') && (
              <label className="block text-xs font-bold text-slate-600">
                Catatan
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  placeholder="Wajib diisi untuk izin/sakit (tanpa GPS/foto)"
                />
              </label>
            )}

            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Submit Pembiasaan'}
            </Button>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
};

export default PembiasaanPage;
