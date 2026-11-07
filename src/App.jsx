import { Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { ToastProvider, ConfirmProvider, SettingsProvider } from './components/ui';
import AdminLayout from './components/AdminLayout';
import SetupNotice from './pages/SetupNotice';
import AdminLogin from './pages/admin/AdminLogin';
import Dashboard from './pages/admin/Dashboard';
import Siswa from './pages/admin/Siswa';
import DataMaster from './pages/admin/DataMaster';
import BankSoal from './pages/admin/BankSoal';
import SoalEditor from './pages/admin/SoalEditor';
import Ujian from './pages/admin/Ujian';
import Monitoring from './pages/admin/Monitoring';
import KartuUjian from './pages/admin/KartuUjian';
import Pengaturan from './pages/admin/Pengaturan';
import SiswaLogin from './pages/siswa/SiswaLogin';
import SiswaHome from './pages/siswa/SiswaHome';
import Exam from './pages/siswa/Exam';

export default function App() {
  if (!isConfigured) return <SetupNotice />;
  return (
    <ToastProvider>
      <ConfirmProvider>
        <SettingsProvider>
          <Routes>
            <Route path="/" element={<SiswaLogin />} />
            <Route path="/siswa" element={<SiswaHome />} />
            <Route path="/ujian/:pesertaId" element={<Exam />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="siswa" element={<Siswa />} />
              <Route path="master" element={<DataMaster />} />
              <Route path="bank" element={<BankSoal />} />
              <Route path="bank/:id" element={<SoalEditor />} />
              <Route path="ujian" element={<Ujian />} />
              <Route path="monitoring" element={<Monitoring />} />
              <Route path="kartu" element={<KartuUjian />} />
              <Route path="pengaturan" element={<Pengaturan />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SettingsProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
