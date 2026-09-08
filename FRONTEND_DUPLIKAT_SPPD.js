// FRONTEND PATCH
// Jalankan saat Nama Karyawan + Tanggal Mulai sudah dipilih,
// dan ulangi lagi tepat sebelum submit SPPD.

async function isSppdDuplicate(employeeId, tanggalMulai) {
  if (!employeeId || !tanggalMulai) return false;

  const { data, error } = await sb.rpc('check_sppd_duplicate', {
    p_employee_id: employeeId,
    p_tanggal_mulai: tanggalMulai
  });

  if (error) throw error;
  return data === true;
}

async function validateSppdDuplicate(employeeId, tanggalMulai) {
  const duplicate = await isSppdDuplicate(employeeId, tanggalMulai);

  if (duplicate) {
    alert('Karyawan ini sudah memiliki SPPD pada tanggal tersebut.');
    return false;
  }

  return true;
}

/*
CONTOH SEBELUM SUBMIT:

const ok = await validateSppdDuplicate(
  selectedEmployee.id,
  document.getElementById('tanggalMulai').value
);

if (!ok) return;

// lanjut simpan SPPD
*/
