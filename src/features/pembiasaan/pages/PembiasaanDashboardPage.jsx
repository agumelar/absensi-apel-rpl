import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';

import { fetchMyPembiasaanDashboard } from '../../../services/pembiasaanService';
import { PEMBIASAAN_ACTIVITY_ROUTE, PEMBIASAAN_SAPA_ROUTE } from '../../../shared/constants/routes';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const PembiasaanDashboardPage = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchMyPembiasaanDashboard({});
        setSummary(data);
      } catch (error) {
        Swal.fire('Gagal', error.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-24 text-center">
        <Loader2 className="mx-auto animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader className="block">
        <PageTitle className="text-3xl">Dashboard Pembiasaan</PageTitle>
        <PageSubtitle className="mt-2">Ringkasan keikutsertaan pribadi untuk Sapa Pagi dan Pembiasaan.</PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Peserta</p>
          <h2 className="mt-1 text-xl font-black text-slate-800">{user?.nama_lengkap || user?.username || 'Pengguna'}</h2>
          <p className="text-xs text-slate-500">Periode: {summary?.month || '-'}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase text-slate-500">Sapa Pagi</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{summary?.sapa?.ikut || 0} ikut</p>
            <p className="text-sm font-bold text-rose-600">{summary?.sapa?.alpha || 0} alpha</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase text-slate-500">Pembiasaan</p>
            <p className="mt-1 text-2xl font-black text-blue-600">{summary?.pembiasaan?.ikut || 0} ikut</p>
            <p className="text-sm font-bold text-rose-600">{summary?.pembiasaan?.alpha || 0} alpha</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to={PEMBIASAAN_SAPA_ROUTE}>
          <Button>Sapa Pagi</Button>
        </Link>
        <Link to={PEMBIASAAN_ACTIVITY_ROUTE}>
          <Button variant="secondary">Pembiasaan</Button>
        </Link>
      </div>
    </PageContainer>
  );
};

export default PembiasaanDashboardPage;
