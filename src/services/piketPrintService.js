const openPrintWindow = (content) => {
  const printWindow = window.open('about:blank', '_blank');
  if (!printWindow) return;
  printWindow.document.write(content);
  printWindow.document.close();
};

const buildPiketReceiptHtml = ({
  tanggal,
  jam,
  namaSiswa,
  kelas,
  jenis,
  alasan,
  piket,
  isDuplicate,
}) => {
  const subtitle = isDuplicate ? 'Salinan Surat Izin' : 'Sistem Layanan Terpadu';
  const buttonText = isDuplicate ? 'CETAK ULANG STRUK' : 'CETAK STRUK SEKARANG';
  const duplicateBadge = isDuplicate
    ? '<div style="font-size: 9px; margin-top: 10px;">DUPLIKAT STRUK</div>'
    : '';

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; font-family: monospace; width: 100%; background: #fff; color: #000; }
          .wrapper { width: 85%; margin: 0 auto; padding: 10px 0; }
          #btnCetak { width: 90%; margin: 15px auto; display: block; padding: 15px; background: #000; color: #fff; border: none; font-weight: bold; border-radius: 10px; font-size: 14px; cursor: pointer; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 15px; }
          .info-box { font-size: 13px; margin-bottom: 10px; }
          .label { font-size: 10px; color: #666; text-transform: uppercase; margin-top: 8px; }
          .val { font-weight: 900; font-size: 16px; display: block; text-transform: uppercase; }
          .footer { margin-top: 25px; text-align: center; border-top: 1px dashed #000; padding-top: 15px; }
          .ttd-box { margin-top: 10px; height: 60px; border-bottom: 1px dotted #000; width: 140px; margin-left: auto; margin-right: auto; }
        </style>
      </head>
      <body>
        <button id="btnCetak" onclick="mulaiPrint()">${buttonText}</button>
        <div class="wrapper">
          <div class="header">
            <div style="font-size: 18px; font-weight: 900;">SMK N 1 RONGGA</div>
            <div style="font-size: 10px;">${subtitle}</div>
          </div>
          <div class="info-box">
            <div style="text-align: center; font-weight: 900; font-size: 14px; text-decoration: underline; margin-bottom: 15px;">SURAT IZIN SISWA</div>
            <div style="font-weight: bold; margin-bottom: 10px;">
              TANGGAL: ${tanggal}<br>
              WAKTU  : ${jam} WIB
            </div>
            <div class="label">Nama Siswa:</div><span class="val">${namaSiswa}</span>
            <div class="label">Kelas:</div><span class="val">${kelas}</span>
            <div class="label">Layanan:</div><span class="val">${jenis}</span>
            <div class="label">Keterangan:</div><div style="font-weight: bold; font-style: italic; font-size: 13px; margin-top: 5px;">"${alasan}"</div>
          </div>
          <div class="footer">
            <div style="font-size: 11px;">Petugas Piket,</div>
            <div class="ttd-box"></div>
            <div style="font-weight: 900; font-size: 14px; margin-top: 8px;">( ${piket} )</div>
            ${duplicateBadge}
          </div>
        </div>
        <script>
          function mulaiPrint() {
            const btn = document.getElementById('btnCetak');
            btn.style.display = 'none';
            window.print();
            setTimeout(() => {
              btn.style.display = 'block';
            }, 1000);
          }
        </script>
      </body>
    </html>
  `;
};

export const printPiketReceipt = ({
  createdAt = new Date(),
  namaSiswa,
  kelas,
  jenis,
  alasan,
  namaPiket,
  isDuplicate = false,
}) => {
  const dateObj = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const tanggal = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const jam = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const content = buildPiketReceiptHtml({
    tanggal,
    jam,
    namaSiswa,
    kelas,
    jenis,
    alasan,
    piket: (namaPiket || '-').toUpperCase(),
    isDuplicate,
  });

  openPrintWindow(content);
};
