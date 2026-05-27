import React, { useState, useEffect } from 'react';
import { 
  Users, Map, BookOpen, Truck, MessageSquare, BarChart3, Plus, Search, 
  MapPin, Award, Settings, ListCollapse, LogOut, Lock, Mail, Wallet, Coins,
  Upload, Shield, RefreshCw, Send, Trash2, GitFork, ChevronDown, ChevronRight as ChevronRightIcon, Eye
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import type { Member, LogisticsItem, LogisticsOrder, Aspiration, QuickCountResult, MemberReport, PrivateMessage, RantingProposal, OperationalFund, LogisticsStockHistory } from './types';
import { 
  BANJARNEGARA_REGIONS, KECAMATAN_COORDS, INITIAL_MEMBERS, 
  INITIAL_LOGISTICS, INITIAL_ORDERS, INITIAL_ASPIRATIONS, 
  QUIZ_QUESTIONS, INITIAL_QUICK_COUNT, INITIAL_REPORTS, INITIAL_MESSAGES,
  INITIAL_FUNDS, INITIAL_STOCK_HISTORY
} from './mockData';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, LineChart, Line, PieChart, Pie } from 'recharts';

// Fix leaflet icon issue using divIcon with custom SVG
const createCustomMarker = (role: string) => {
  let color = '#D32F2F'; // Red for regular members
  if (role === 'super_admin') color = '#9C27B0'; // Purple for super admin
  else if (role === 'pimpinan_dpc') color = '#FFD700'; // Gold for leader
  else if (role === 'anggota_dewan') color = '#E53935'; // Bright Red for dewan
  else if (role === 'korcam' || role === 'bapilu') color = '#111111'; // Dark for korcam/bapilu
  
  return L.divIcon({
    html: `
      <div class="relative w-8 h-8 flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full opacity-40 animate-ping" style="background-color: ${color};"></div>
        <div class="relative w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center" style="background-color: ${color};">
          <span class="w-2 h-2 bg-white rounded-full"></span>
        </div>
      </div>
    `,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Helper component to center map on coordinates
function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 12);
  }, [center, map]);
  return null;
}

// Helper to check if a member is a descendant (downline) of a specific parent
const isDescendant = (member: Member, targetParentId: string, list: Member[]): boolean => {
  let current = member;
  let depth = 0; // Avoid infinite loops if data is corrupted
  while (current.parentId && depth < 20) {
    if (current.parentId === targetParentId) return true;
    const parent = list.find(m => m.id === current.parentId);
    if (!parent) break;
    current = parent;
    depth++;
  }
  return false;
};

// Count downline members recursively
const countDownline = (memberId: string, list: Member[]): number => {
  let count = 0;
  list.forEach(m => {
    if (m.parentId === memberId) {
      count += 1 + countDownline(m.id, list);
    }
  });
  return count;
};

// Helper component for Kecamatan-specific statistical analytics & charts
// Helper component for Kecamatan-specific statistical analytics & charts
function KecamatanAnalyticsSection({ 
  members, 
  setMembers,
  pushAuditLog,
  rantingProposals,
  setRantingProposals,
  currentUser,
  quickCounts,
  candidateNames,
  isDbConnected
}: { 
  members: Member[]; 
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  pushAuditLog: (action: string) => void;
  rantingProposals: RantingProposal[];
  setRantingProposals: React.Dispatch<React.SetStateAction<RantingProposal[]>>;
  currentUser: Member;
  quickCounts: QuickCountResult[];
  candidateNames: { c1: string; c2: string; c3: string };
  isDbConnected: boolean;
}) {
  const [selectedKec, setSelectedKec] = useState('Banjarnegara');

  // Modal states for Usulkan Ranting
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposingDesa, setProposingDesa] = useState('');
  const [proposalMode, setProposalMode] = useState<'existing' | 'new'>('existing');
  const [selectedCadreId, setSelectedCadreId] = useState('');
  const [newCadreForm, setNewCadreForm] = useState({ name: '', nik: '', phone: '', tps: 'TPS 01' });
  const [proposalDescription, setProposalDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // List of all Kecamatan from coordinators coords keys
  const kecamatanList = Object.keys(KECAMATAN_COORDS);

  // Compute stats for selected Kecamatan
  const kecMembers = members.filter(m => m.kecamatan === selectedKec);
  const totalKader = kecMembers.length;
  const activeKader = kecMembers.filter(m => m.status === 'ACTIVE').length;

  // Roles distribution
  const rolesDistribution = kecMembers.reduce((acc, curr) => {
    acc[curr.role] = (acc[curr.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartRolesData = Object.entries(rolesDistribution).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    value
  }));

  // Quick Count Summary for selected Kecamatan
  const kecQCList = quickCounts.filter(q => q.kecamatan === selectedKec);
  const totalTpsRegistered = kecQCList.length;
  const qcTotals = kecQCList.reduce((acc, curr) => {
    acc.c1 += curr.candidate1Votes;
    acc.c2 += curr.candidate2Votes; // PDIP
    acc.c3 += curr.candidate3Votes;
    acc.tidakSah += curr.tidakSah;
    acc.totalSah += (curr.candidate1Votes + curr.candidate2Votes + curr.candidate3Votes);
    return acc;
  }, { c1: 0, c2: 0, c3: 0, tidakSah: 0, totalSah: 0 });

  const totalSuara = qcTotals.totalSah;
  const pdipPercentage = totalSuara > 0 ? ((qcTotals.c2 / totalSuara) * 100).toFixed(1) : '0';

  // KPI Targets (Simulated targets per kecamatan)
  const targetKader = 35; 
  const kaderProgress = Math.min(100, Math.round((totalKader / targetKader) * 100));

  // Quick count charts
  const qcChartData = [
    { name: candidateNames.c1, suara: qcTotals.c1 },
    { name: candidateNames.c2, suara: qcTotals.c2 },
    { name: candidateNames.c3, suara: qcTotals.c3 }
  ];

  const handleProposeRanting = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    let name = '';
    let nik = '';
    let phone = '';
    let tps = 'TPS 01';
    let targetMemberId = '';

    if (proposalMode === 'existing') {
      if (!selectedCadreId) {
        setErrorMsg('Silakan pilih kader yang terdaftar.');
        return;
      }
      const cadre = members.find(m => m.id === selectedCadreId);
      if (!cadre) return;
      name = cadre.name;
      nik = cadre.nik;
      phone = cadre.phone;
      tps = cadre.tps;
      targetMemberId = cadre.id;
    } else {
      if (!newCadreForm.name || !newCadreForm.nik || !newCadreForm.phone) {
        setErrorMsg('Silakan lengkapi data calon Ketua Ranting baru.');
        return;
      }
      if (newCadreForm.nik.length !== 16) {
        setErrorMsg('NIK harus terdiri dari 16 digit.');
        return;
      }
      name = newCadreForm.name;
      nik = newCadreForm.nik;
      phone = newCadreForm.phone;
      tps = newCadreForm.tps;
    }

    // Check if NIK already exists in members database (only for new candidates)
    if (proposalMode === 'new' && members.some(m => m.nik === nik)) {
      setErrorMsg('NIK sudah terdaftar di database anggota.');
      return;
    }

    const isDpcAdmin = currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc';
    const status = isDpcAdmin ? 'APPROVED' : 'PENDING';

    const newProposal: RantingProposal = {
      id: 'prop-' + Date.now(),
      kecamatan: selectedKec,
      desa: proposingDesa,
      proposedKetuaName: name,
      proposedKetuaNik: nik,
      proposedKetuaPhone: phone,
      description: proposalDescription || 'Pembentukan Pengurus Ranting baru.',
      status: status,
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (isDbConnected) {
      fetch('/api/ranting-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProposal)
      }).catch(err => console.error('Error saving proposal to database:', err));
    }

    setRantingProposals(prev => [newProposal, ...prev]);

    if (status === 'APPROVED') {
      if (proposalMode === 'existing' && targetMemberId) {
        const existingMember = members.find(m => m.id === targetMemberId);
        if (existingMember) {
          const updatedMember = { ...existingMember, role: 'ketua_ranting' as Member['role'] };
          if (isDbConnected) {
            fetch('/api/members', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedMember)
            }).catch(err => console.error('Error updating member role in database:', err));
          }
        }
        setMembers(prev => prev.map(m => m.id === targetMemberId ? { ...m, role: 'ketua_ranting' } : m));
        pushAuditLog(`Membentuk Ranting Desa ${proposingDesa}: Mengangkat ${name} sebagai Ketua Ranting`);
      } else {
        const newMemberObj: Member = {
          id: 'm-' + Date.now(),
          name: name,
          ktaNumber: 'KTA-3304-' + Math.floor(100000 + Math.random() * 900000),
          nik: nik,
          role: 'ketua_ranting',
          kecamatan: selectedKec,
          desa: proposingDesa,
          tps: tps,
          photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
          lat: KECAMATAN_COORDS[selectedKec]?.lat || -7.3996,
          lng: KECAMATAN_COORDS[selectedKec]?.lng || 109.6976,
          phone: phone,
          status: 'ACTIVE',
          joinDate: new Date().toISOString().split('T')[0],
          parentId: currentUser.id
        };
        if (isDbConnected) {
          fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMemberObj)
          }).catch(err => console.error('Error saving new member to database:', err));
        }
        setMembers(prev => [newMemberObj, ...prev]);
        pushAuditLog(`Membentuk Ranting Desa ${proposingDesa}: Mendaftarkan & Mengangkat ${name} sebagai Ketua Ranting`);
      }
      confetti();
    } else {
      pushAuditLog(`Mengusulkan pembentukan Ranting Desa ${proposingDesa} dengan calon Ketua: ${name}`);
    }

    setShowProposeModal(false);
    setProposingDesa('');
    setSelectedCadreId('');
    setNewCadreForm({ name: '', nik: '', phone: '', tps: 'TPS 01' });
    setProposalDescription('');
  };

  const handleApproveProposal = (proposal: RantingProposal) => {
    if (isDbConnected) {
      fetch(`/api/ranting-proposals/${proposal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      }).catch(err => console.error('Error approving proposal in database:', err));
    }

    setRantingProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'APPROVED' } : p));
    
    const existingMember = members.find(m => m.nik === proposal.proposedKetuaNik);
    if (existingMember) {
      const updatedMember = { ...existingMember, role: 'ketua_ranting' as Member['role'], kecamatan: proposal.kecamatan, desa: proposal.desa };
      if (isDbConnected) {
        fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedMember)
        }).catch(err => console.error('Error updating member role in database:', err));
      }
      setMembers(prev => prev.map(m => m.id === existingMember.id ? { ...m, role: 'ketua_ranting', kecamatan: proposal.kecamatan, desa: proposal.desa } : m));
      pushAuditLog(`Menyetujui Usulan Ranting Desa ${proposal.desa}: Mengangkat ${proposal.proposedKetuaName} sebagai Ketua Ranting`);
    } else {
      const newMemberObj: Member = {
        id: 'm-' + Date.now(),
        name: proposal.proposedKetuaName,
        ktaNumber: 'KTA-3304-' + Math.floor(100000 + Math.random() * 900000),
        nik: proposal.proposedKetuaNik,
        role: 'ketua_ranting',
        kecamatan: proposal.kecamatan,
        desa: proposal.desa,
        tps: 'TPS 01',
        photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
        lat: KECAMATAN_COORDS[proposal.kecamatan]?.lat || -7.3996,
        lng: KECAMATAN_COORDS[proposal.kecamatan]?.lng || 109.6976,
        phone: proposal.proposedKetuaPhone,
        status: 'ACTIVE',
        joinDate: new Date().toISOString().split('T')[0],
        parentId: currentUser.id
      };
      if (isDbConnected) {
        fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMemberObj)
        }).catch(err => console.error('Error saving new member in database:', err));
      }
      setMembers(prev => [newMemberObj, ...prev]);
      pushAuditLog(`Menyetujui Usulan Ranting Desa ${proposal.desa}: Mendaftarkan & Mengangkat ${proposal.proposedKetuaName} sebagai Ketua Ranting`);
    }
    confetti();
  };

  const handleRejectProposal = (proposalId: string, name: string, desa: string) => {
    if (isDbConnected) {
      fetch(`/api/ranting-proposals/${proposalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' })
      }).catch(err => console.error('Error rejecting proposal in database:', err));
    }
    setRantingProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'REJECTED' } : p));
    pushAuditLog(`Menolak Usulan Ranting Desa ${desa} dengan calon Ketua: ${name}`);
  };

  return (
    <div className="space-y-6">
      {/* Kecamatan Selector */}
      <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <label className="text-xs text-gray-400 block font-bold mb-1.5 uppercase font-sans">Pilih Kecamatan Analisis:</label>
          <select
            value={selectedKec}
            onChange={(e) => setSelectedKec(e.target.value)}
            className="bg-pdip-black border border-red-900/35 rounded-lg px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-pdip-red min-w-[240px]"
          >
            {kecamatanList.map((kec) => (
              <option key={kec} value={kec}>{kec}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <span className="text-[10px] text-gray-500 block uppercase font-bold">Kecamatan Aktif</span>
            <span className="text-lg font-black text-white font-serif">{selectedKec}</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Kader */}
        <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md space-y-2 relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10 text-white font-black text-4xl">🐂</div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Kader Terdaftar</span>
          <h4 className="text-2xl font-black text-white font-serif">{totalKader} <span className="text-xs font-normal text-gray-500">anggota</span></h4>
          <div className="pt-2 border-t border-gray-850 flex justify-between text-[10px] text-gray-400">
            <span>Aktif: <strong className="text-emerald-400">{activeKader}</strong></span>
            <span>Target: <strong>{targetKader}</strong></span>
          </div>
        </div>

        {/* Target Progress Bar */}
        <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md space-y-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pencapaian Target Anggota</span>
          <h4 className="text-2xl font-black text-white font-serif">{kaderProgress}%</h4>
          <div className="w-full bg-pdip-black rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-pdip-red to-pdip-gold h-2 rounded-full transition-all duration-500" 
              style={{ width: `${kaderProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Saksi TPS Ratio */}
        <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md space-y-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cakupan Rekap TPS</span>
          <h4 className="text-2xl font-black text-white font-serif">{totalTpsRegistered} <span className="text-xs font-normal text-gray-500">TPS</span></h4>
          <div className="pt-2 border-t border-gray-850 text-[10px] text-gray-400 flex justify-between">
            <span>Total Suara Masuk: <strong className="text-pdip-gold">{totalSuara.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* PDIP Vote Share percentage */}
        <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md space-y-2 relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10 text-pdip-gold font-black text-4xl">★</div>
          <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Rasio Suara PDIP (C1)</span>
          <h4 className="text-2xl font-black text-pdip-gold font-serif">{pdipPercentage}%</h4>
          <div className="pt-2 border-t border-gray-850 text-[10px] text-gray-400">
            <span>Suara Banteng: <strong>{qcTotals.c2.toLocaleString()}</strong> dari {totalSuara.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Graphs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Count Share Chart */}
        <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 shadow-md space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 border-b border-red-950/20 pb-2">
            Perolehan Suara Pilkada / Pemilu di {selectedKec}
          </h3>
          <div className="h-64">
            {totalSuara > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qcChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d1d1f" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} />
                  <YAxis stroke="#a1a1aa" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#D32F2F', color: '#fff' }} />
                  <Bar dataKey="suara" fill="#D32F2F">
                    {qcChartData.map((_entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={idx === 1 ? '#D32F2F' : '#333333'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Belum ada data C1 masuk dari TPS di kecamatan ini.
              </div>
            )}
          </div>
        </div>

        {/* DPRD Banjarnegara Party Seats Chart */}
        <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 shadow-md space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 border-b border-red-950/20 pb-2">
            Perolehan Kursi DPRD Kab. Banjarnegara Periode 2024-2029 (Total 50 Kursi)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Demokrat', Kursi: 8 },
                { name: 'PDI-P', Kursi: 7 },
                { name: 'PKB', Kursi: 7 },
                { name: 'Golkar', Kursi: 7 },
                { name: 'PKS', Kursi: 5 },
                { name: 'Gerindra', Kursi: 4 },
                { name: 'PAN', Kursi: 4 },
                { name: 'NasDem', Kursi: 3 },
                { name: 'PPP', Kursi: 3 },
                { name: 'Hanura', Kursi: 2 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d1d1f" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={9} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis stroke="#a1a1aa" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#D32F2F', color: '#fff' }} />
                <Bar dataKey="Kursi" fill="#333333">
                  {[8, 7, 7, 7, 5, 4, 4, 3, 3, 2].map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={idx === 1 ? '#D32F2F' : '#333333'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Roles Distribution Chart */}
        <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 shadow-md space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 border-b border-red-950/20 pb-2">
            Komposisi Pengurus & Kader di {selectedKec}
          </h3>
          <div className="h-64">
            {totalKader > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRolesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d1d1f" />
                  <XAxis type="number" stroke="#a1a1aa" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#D32F2F', color: '#fff' }} />
                  <Bar dataKey="value" fill="#FFD700" barSize={12}>
                    {chartRolesData.map((_entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={_entry.name.includes('ANGGOTA') ? '#D32F2F' : '#FFD700'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Belum ada kader terdaftar di kecamatan ini.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ranting / Desa Breakdown Table */}
      <div className="bg-pdip-metal rounded-xl border border-red-950/20 shadow-md overflow-hidden">
        <div className="p-5 border-b border-red-950/20 flex justify-between items-center">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">Daftar Sebaran Desa & Kaderisasi Ranting</h3>
          <span className="text-[10px] text-gray-500 font-mono font-bold">Wilayah Kecamatan: {selectedKec}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-pdip-darkgray text-gray-400 font-bold uppercase border-b border-red-950/20">
                <th className="px-6 py-3.5">Nama Desa</th>
                <th className="px-6 py-3.5">Jumlah Kader</th>
                <th className="px-6 py-3.5">Ketua Ranting</th>
                <th className="px-6 py-3.5">Status Pengurus Ranting</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-950/10 text-sm">
              {(BANJARNEGARA_REGIONS[selectedKec] || []).map((desaName) => {
                const desaKader = kecMembers.filter(m => m.desa === desaName);
                const ketuaRanting = desaKader.find(m => m.role === 'ketua_ranting');
                const proposal = rantingProposals.find(p => p.kecamatan === selectedKec && p.desa === desaName && p.status === 'PENDING');
                
                return (
                  <tr key={desaName} className="hover:bg-pdip-darkgray/30 transition text-xs">
                    <td className="px-6 py-4 font-bold text-white">{desaName}</td>
                    <td className="px-6 py-4 font-semibold text-red-400">{desaKader.length} Anggota</td>
                    <td className="px-6 py-4 text-gray-300">
                      {ketuaRanting ? (
                        <div className="flex items-center gap-2">
                          <img src={ketuaRanting.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-red-900/30" />
                          <span>{ketuaRanting.name}</span>
                        </div>
                      ) : proposal ? (
                        <span className="text-amber-400 font-medium italic">Calon: {proposal.proposedKetuaName} (Diusulkan)</span>
                      ) : (
                        <span className="text-gray-600 italic">Belum Terbentuk</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {ketuaRanting ? (
                        <span className="bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider text-[9px]">AKTIF</span>
                      ) : proposal ? (
                        <span className="bg-yellow-950/70 text-yellow-400 border border-yellow-800/30 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider text-[9px]">DIUSULKAN</span>
                      ) : (
                        <span className="bg-amber-950 text-amber-500 border border-amber-900/30 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider text-[9px]">KONSOLIDASI</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {ketuaRanting ? (
                        <span className="text-gray-500 text-xs italic">Sudah Aktif</span>
                      ) : proposal ? (
                        (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') ? (
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleApproveProposal(proposal)}
                              className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold px-2 py-1 rounded text-[10px] transition"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleRejectProposal(proposal.id, proposal.proposedKetuaName, proposal.desa)}
                              className="bg-red-950 hover:bg-red-900 text-red-400 font-bold px-2 py-1 rounded border border-red-900/30 text-[10px] transition"
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-[10px] italic font-medium">Menunggu DPC</span>
                        )
                      ) : (
                        <button
                          onClick={() => {
                            setProposingDesa(desaName);
                            setShowProposeModal(true);
                          }}
                          className="bg-pdip-red hover:bg-pdip-brightred text-white font-bold px-3 py-1 rounded text-[10px] transition"
                        >
                          Usulkan Ranting
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranting Proposals List */}
      {rantingProposals.length > 0 && (
        <div className="bg-pdip-metal rounded-xl border border-red-950/20 shadow-md overflow-hidden animate-fadeIn">
          <div className="p-5 border-b border-red-950/20 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">
              Monitoring & Pengajuan Ranting ({rantingProposals.filter(p => p.status === 'PENDING').length} Usulan Baru)
            </h3>
            <span className="text-[10px] text-gray-500 font-mono">DPC Admin Review Panel</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-pdip-darkgray text-gray-400 font-bold uppercase border-b border-red-950/20">
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5">Wilayah (Kec ➔ Desa)</th>
                  <th className="px-6 py-3.5">Calon Ketua Ranting (NIK)</th>
                  <th className="px-6 py-3.5">No. Telpon</th>
                  <th className="px-6 py-3.5">Catatan Usulan</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-950/10 text-sm">
                {rantingProposals.map((proposal) => (
                  <tr key={proposal.id} className="hover:bg-pdip-darkgray/30 transition text-xs">
                    <td className="px-6 py-4 font-mono text-gray-400">{proposal.createdAt}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-white block">{proposal.desa}</span>
                      <span className="text-gray-500 text-[10px]">{proposal.kecamatan}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-red-400 block">{proposal.proposedKetuaName}</span>
                      <span className="text-gray-500 font-mono text-[10px]">{proposal.proposedKetuaNik}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-300 font-mono">{proposal.proposedKetuaPhone}</td>
                    <td className="px-6 py-4 text-gray-400 max-w-xs truncate" title={proposal.description}>
                      {proposal.description}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                        proposal.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' :
                        proposal.status === 'REJECTED' ? 'bg-red-950 text-red-400 border border-red-900/30' :
                        'bg-yellow-950/70 text-yellow-400 border border-yellow-800/30'
                      }`}>
                        {proposal.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {proposal.status === 'PENDING' ? (
                        (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveProposal(proposal)}
                              className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold px-2 py-1 rounded text-[10px] transition"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleRejectProposal(proposal.id, proposal.proposedKetuaName, proposal.desa)}
                              className="bg-red-950 hover:bg-red-900 text-red-400 font-bold px-2 py-1 rounded border border-red-900/30 text-[10px] transition"
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-[10px] italic">Menunggu DPC</span>
                        )
                      ) : (
                        <span className="text-gray-600 text-[10px] italic text-zinc-500">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Usulkan Ranting */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-pdip-metal border border-red-900/30 rounded-xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-5 border-b border-red-950/20 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-white">Usulkan Pembentukan Ranting</h3>
                <p className="text-[11px] text-gray-400">Kecamatan {selectedKec} ➔ Desa {proposingDesa}</p>
              </div>
              <button 
                onClick={() => {
                  setShowProposeModal(false);
                  setProposingDesa('');
                  setErrorMsg('');
                }}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleProposeRanting} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-900/35 text-red-400 rounded-lg text-xs font-semibold">
                  {errorMsg}
                </div>
              )}
              
              {/* Proposal Mode Tabs */}
              <div className="bg-pdip-black/50 p-1 rounded-lg border border-red-900/10 flex">
                <button
                  type="button"
                  onClick={() => {
                    setProposalMode('existing');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
                    proposalMode === 'existing' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Pilih Anggota Terdaftar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProposalMode('new');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
                    proposalMode === 'new' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Daftar Calon Baru
                </button>
              </div>

              {proposalMode === 'existing' ? (
                <div>
                  <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Pilih Kader</label>
                  <select
                    value={selectedCadreId}
                    onChange={(e) => setSelectedCadreId(e.target.value)}
                    className="w-full bg-pdip-black text-sm text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                  >
                    <option value="">-- Pilih Kader Desa {proposingDesa} --</option>
                    {members
                      .filter(m => m.kecamatan === selectedKec && m.desa === proposingDesa && m.role === 'anggota')
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.ktaNumber})</option>
                      ))
                    }
                  </select>
                  {members.filter(m => m.kecamatan === selectedKec && m.desa === proposingDesa && m.role === 'anggota').length === 0 && (
                    <p className="text-[10px] text-amber-500 font-medium mt-1">
                      * Tidak ada anggota biasa di Desa {proposingDesa}. Silakan pilih "Daftar Calon Baru".
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      placeholder="Masukkan nama lengkap calon..."
                      value={newCadreForm.name}
                      onChange={(e) => setNewCadreForm({ ...newCadreForm, name: e.target.value })}
                      className="w-full bg-pdip-black text-xs text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">NIK (KTP)</label>
                      <input
                        type="text"
                        maxLength={16}
                        placeholder="16 digit NIK..."
                        value={newCadreForm.nik}
                        onChange={(e) => setNewCadreForm({ ...newCadreForm, nik: e.target.value.replace(/\D/g, '') })}
                        className="w-full bg-pdip-black font-mono text-xs text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">No. Telpon / WA</label>
                      <input
                        type="text"
                        placeholder="08xxxxxxxx..."
                        value={newCadreForm.phone}
                        onChange={(e) => setNewCadreForm({ ...newCadreForm, phone: e.target.value.replace(/\D/g, '') })}
                        className="w-full bg-pdip-black text-xs text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">TPS Tugas Nyoblos</label>
                    <input
                      type="text"
                      placeholder="Contoh: TPS 03"
                      value={newCadreForm.tps}
                      onChange={(e) => setNewCadreForm({ ...newCadreForm, tps: e.target.value })}
                      className="w-full bg-pdip-black text-xs text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                    />
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Keterangan Tambahan / Alasan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan pengusulan kepengurusan..."
                  value={proposalDescription}
                  onChange={(e) => setProposalDescription(e.target.value)}
                  className="w-full bg-pdip-black text-xs text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProposeModal(false);
                    setProposingDesa('');
                    setErrorMsg('');
                  }}
                  className="flex-1 bg-pdip-darkgray text-gray-400 hover:text-white border border-red-900/10 hover:border-red-900/30 font-semibold py-2 rounded-lg text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-pdip-red hover:bg-pdip-brightred text-white font-semibold py-2 rounded-lg text-xs transition"
                >
                  {currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' ? 'Bentuk Langsung' : 'Kirim Usulan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Login Authentication States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('pdip_logged_in') === 'true';
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('pdip_current_user_id') || 'm-0';
  });

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'keanggotaan' | 'gis' | 'kaderisasi' | 'logistik' | 'aspirasi' | 'quickcount' | 'analitik' | 'dpt' | 'laporan' | 'perpesanan' | 'pengaturan' | 'pendanaan'>('dashboard');

  // Keanggotaan sub-tab: list vs tree viewer
  const [memberViewMode, setMemberViewMode] = useState<'list' | 'tree'>('list');
  const [treePage, setTreePage] = useState<number>(1);
  const [listPage, setListPage] = useState<number>(1);

  // MySQL Database connectivity state
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  // GeoJSON data for GIS sebaran desa
  const [geojsonData, setGeojsonData] = useState<any>(null);

  useEffect(() => {
    fetch('/peta/peta_desa.geojson')
      .then(res => {
        if (!res.ok) throw new Error('Gagal memuat data peta');
        return res.json();
      })
      .then(data => setGeojsonData(data))
      .catch(err => console.error('Error loading geojson:', err));
  }, []);

  // Database initialization, auto-seeding, and table loading
  useEffect(() => {
    const initDatabase = async () => {
      try {
        const statusRes = await fetch('/api/status');
        if (!statusRes.ok) throw new Error('API server status check failed');
        const status = await statusRes.json();
        
        if (status.connected) {
          setIsDbConnected(true);
          console.log('MySQL Database connected successfully!');

          if (status.needsSeeding) {
            console.log('Database empty. Seeding database with initial data...');
            const seedRes = await fetch('/api/seed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                members: INITIAL_MEMBERS,
                logisticsItems: INITIAL_LOGISTICS,
                logisticsOrders: INITIAL_ORDERS,
                aspirations: INITIAL_ASPIRATIONS,
                quickCounts: INITIAL_QUICK_COUNT,
                memberReports: INITIAL_REPORTS,
                privateMessages: INITIAL_MESSAGES,
                operationalFunds: INITIAL_FUNDS,
                logisticsStockHistory: INITIAL_STOCK_HISTORY
              })
            });
            if (!seedRes.ok) throw new Error('Seeding failed');
            console.log('Database seeded successfully.');
            // Reload the page to trigger state updates from seeded DB
            window.location.reload();
          } else {
            console.log('Loading database records into state...');
            const [
              dbMembers,
              dbLogistics,
              dbOrders,
              dbAspirations,
              dbQuickCounts,
              dbReports,
              dbMessages,
              dbProposals,
              dbLogs,
              dbFunds,
              dbStockHistory
            ] = await Promise.all([
              fetch('/api/members').then(r => r.json()),
              fetch('/api/logistics').then(r => r.json()),
              fetch('/api/logistics/orders').then(r => r.json()),
              fetch('/api/aspirations').then(r => r.json()),
              fetch('/api/quickcount').then(r => r.json()),
              fetch('/api/reports').then(r => r.json()),
              fetch('/api/messages').then(r => r.json()),
              fetch('/api/ranting-proposals').then(r => r.json()),
              fetch('/api/audit-logs').then(r => r.json()),
              fetch('/api/funds').then(r => r.json()).catch(() => []),
              fetch('/api/logistics/history').then(r => r.json()).catch(() => [])
            ]);

            if (dbMembers) setMembers(dbMembers);
            if (dbLogistics) setLogistics(dbLogistics);
            if (dbOrders) setOrders(dbOrders);
            if (dbAspirations) setAspirations(dbAspirations);
            if (dbQuickCounts) setQuickCounts(dbQuickCounts);
            if (dbReports) setReports(dbReports);
            if (dbMessages) setMessages(dbMessages);
            if (dbProposals) setRantingProposals(dbProposals);
            if (dbLogs) setAuditLogs(dbLogs);
            if (dbFunds) setFunds(dbFunds);
            if (dbStockHistory) setStockHistory(dbStockHistory);
          }
        }
      } catch (error) {
        console.warn('Backend API / MySQL Database offline. Operating in client-only mode.', error);
        setIsDbConnected(false);
      }
    };

    initDatabase();
  }, []);

  // Application Data States (synced with localStorage)
  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem('pdip_members');
    let list = saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    
    // Programmatically distribute mock members across all available villages in their kecamatan
    list = list.map((m: Member) => {
      // Keep leaders and DPC/PAC officials at their designated positions
      if (m.role === 'super_admin' || m.role === 'pimpinan_dpc' || m.role === 'korcam' || m.role === 'ketua_ranting') {
        return m;
      }
      
      const isMockMember = m.id.startsWith('dpt-') || (m.id.startsWith('m-') && m.id.length < 6) || m.id.startsWith('dewan-');
      if (!isMockMember) return m;

      const villages = BANJARNEGARA_REGIONS[m.kecamatan];
      if (villages && villages.length > 0) {
        const charSum = m.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const desaIndex = charSum % villages.length;
        const newDesa = villages[desaIndex];
        
        const coords = KECAMATAN_COORDS[m.kecamatan];
        let lat = m.lat;
        let lng = m.lng;
        if (coords) {
          const offsetLat = ((desaIndex - (villages.length / 2)) * 0.002) + (((charSum % 10) - 5) * 0.0003);
          const offsetLng = ((((charSum * 7) % villages.length) - (villages.length / 2)) * 0.002) + (((charSum % 10) - 5) * 0.0003);
          lat = coords.lat + offsetLat;
          lng = coords.lng + offsetLng;
        }

        return {
          ...m,
          desa: newDesa,
          lat,
          lng
        };
      }
      return m;
    });

    // Guarantee that Super Admin (m-0) exists in the list
    if (!list.some((m: Member) => m.id === 'm-0')) {
      const superAdmin = INITIAL_MEMBERS.find(m => m.id === 'm-0');
      if (superAdmin) {
        return [superAdmin, ...list];
      }
    }
    return list;
  });

  const [logistics, setLogistics] = useState<LogisticsItem[]>(() => {
    const saved = localStorage.getItem('pdip_logistics');
    return saved ? JSON.parse(saved) : INITIAL_LOGISTICS;
  });

  const [orders, setOrders] = useState<LogisticsOrder[]>(() => {
    const saved = localStorage.getItem('pdip_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [aspirations, setAspirations] = useState<Aspiration[]>(() => {
    const saved = localStorage.getItem('pdip_aspirations');
    return saved ? JSON.parse(saved) : INITIAL_ASPIRATIONS;
  });

  const [quickCounts, setQuickCounts] = useState<QuickCountResult[]>(() => {
    const saved = localStorage.getItem('pdip_quickcount');
    return saved ? JSON.parse(saved) : INITIAL_QUICK_COUNT;
  });

  // Candidate Names Configuration
  const [candidateNames, setCandidateNames] = useState(() => {
    const saved = localStorage.getItem('pdip_candidate_names');
    return saved ? JSON.parse(saved) : {
      c1: "Paslon 1 (Koalisi A)",
      c2: "Paslon 2 (PDI Perjuangan)",
      c3: "Paslon 3 (Koalisi C)"
    };
  });

  // OpenSID Whitelist Settings
  const [opensidIP, setOpensidIP] = useState(() => {
    return localStorage.getItem('pdip_opensid_ip') || "182.253.140.12";
  });

  // Toggle Maintenance mode
  const [maintenanceMode, setMaintenanceMode] = useState(() => {
    return localStorage.getItem('pdip_maintenance') === 'true';
  });

  // System Logs/Audit Trails (Simulated)
  const [auditLogs, setAuditLogs] = useState<Array<{ time: string; user: string; action: string }>>(() => {
    const saved = localStorage.getItem('pdip_audit_logs');
    return saved ? JSON.parse(saved) : [
      { time: "2026-05-27 07:15", user: "Admin DPC", action: "Sinkronisasi database dengan OpenSID Banjarnegara" },
      { time: "2026-05-27 07:22", user: "Budi Santoso", action: "Menambahkan anggota baru: Sri Rahayu" },
      { time: "2026-05-27 07:35", user: "Sugeng Wiyono", action: "Mengajukan distribusi 500 pcs Kaos Banteng" }
    ];
  });

  // Reports and PrivateMessages States
  const [reports, setReports] = useState<MemberReport[]>(() => {
    const saved = localStorage.getItem('pdip_reports');
    return saved ? JSON.parse(saved) : INITIAL_REPORTS;
  });

  const [messages, setMessages] = useState<PrivateMessage[]>(() => {
    const saved = localStorage.getItem('pdip_messages');
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });

  const [rantingProposals, setRantingProposals] = useState<RantingProposal[]>(() => {
    const saved = localStorage.getItem('pdip_ranting_proposals');
    return saved ? JSON.parse(saved) : [];
  });

  const [funds, setFunds] = useState<OperationalFund[]>(() => {
    const saved = localStorage.getItem('pdip_funds');
    return saved ? JSON.parse(saved) : INITIAL_FUNDS;
  });

  const [stockHistory, setStockHistory] = useState<LogisticsStockHistory[]>(() => {
    const saved = localStorage.getItem('pdip_stock_history');
    return saved ? JSON.parse(saved) : INITIAL_STOCK_HISTORY;
  });

  // Funds and Stock Mutation Forms states
  const [fundType, setFundType] = useState<'income' | 'expense'>('expense');
  const [fundAmount, setFundAmount] = useState<number>(0);
  const [fundCategory, setFundCategory] = useState<'Kegiatan' | 'Sosialisasi' | 'Pembuatan Media' | 'Logistik' | 'Lainnya'>('Kegiatan');
  const [fundTitle, setFundTitle] = useState('');
  const [fundDescription, setFundDescription] = useState('');

  const [stockItemId, setStockItemId] = useState('');
  const [stockMutationType, setStockMutationType] = useState<'stock_in' | 'stock_out'>('stock_in');
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [stockNotes, setStockNotes] = useState('');

  const [showStockMutationModal, setShowStockMutationModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  
  // Find current active user profile
  const currentUser = members.find(m => m.id === currentUserId) || members[0];

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('pdip_logged_in', String(isLoggedIn));
    localStorage.setItem('pdip_current_user_id', currentUserId);
  }, [isLoggedIn, currentUserId]);

  useEffect(() => {
    localStorage.setItem('pdip_members', JSON.stringify(members));
  }, [members]);
  useEffect(() => {
    localStorage.setItem('pdip_logistics', JSON.stringify(logistics));
  }, [logistics]);
  useEffect(() => {
    localStorage.setItem('pdip_orders', JSON.stringify(orders));
  }, [orders]);
  useEffect(() => {
    localStorage.setItem('pdip_aspirations', JSON.stringify(aspirations));
  }, [aspirations]);
  useEffect(() => {
    localStorage.setItem('pdip_quickcount', JSON.stringify(quickCounts));
  }, [quickCounts]);
  useEffect(() => {
    localStorage.setItem('pdip_candidate_names', JSON.stringify(candidateNames));
  }, [candidateNames]);
  useEffect(() => {
    localStorage.setItem('pdip_opensid_ip', opensidIP);
  }, [opensidIP]);
  useEffect(() => {
    localStorage.setItem('pdip_maintenance', String(maintenanceMode));
  }, [maintenanceMode]);
  useEffect(() => {
    localStorage.setItem('pdip_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);
  useEffect(() => {
    localStorage.setItem('pdip_reports', JSON.stringify(reports));
  }, [reports]);
  useEffect(() => {
    localStorage.setItem('pdip_messages', JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    localStorage.setItem('pdip_ranting_proposals', JSON.stringify(rantingProposals));
  }, [rantingProposals]);
  useEffect(() => {
    localStorage.setItem('pdip_funds', JSON.stringify(funds));
  }, [funds]);
  useEffect(() => {
    localStorage.setItem('pdip_stock_history', JSON.stringify(stockHistory));
  }, [stockHistory]);



  // Keanggotaan Filters & Form States
  const [memberSearch, setMemberSearch] = useState('');
  const [filterKecamatan, setFilterKecamatan] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  
  // DPT Pagination state
  const [dptCurrentPage, setDptCurrentPage] = useState(1);
  const dptItemsPerPage = 50;

  // Reset pagination on filter change
  useEffect(() => {
    setDptCurrentPage(1);
    setListPage(1);
  }, [memberSearch, filterKecamatan, filterDesa, activeTab]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    nik: '',
    role: 'anggota',
    kecamatan: 'Banjarnegara',
    desa: 'Semarang',
    tps: 'TPS 01',
    phone: '',
    photoUrl: '',
    lat: -7.3996,
    lng: 109.6976,
    parentId: ''
  });

  // Geolocation trigger state
  const [gpsLoading, setGpsLoading] = useState(false);

  // E-Learning Quiz States
  const [selectedModule, setSelectedModule] = useState<'marhaenisme' | 'rekrutmen' | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [candidateName, setCandidateName] = useState('');

  // Logistics Form States
  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    requesterName: '',
    kecamatan: 'Banjarnegara',
    desa: 'Semarang',
    itemId: '',
    quantity: 10
  });

  // Aspiration Form & Action States
  const [showAspirationModal, setShowAspirationModal] = useState(false);
  const [newAspiration, setNewAspiration] = useState({
    reporterName: '',
    kecamatan: 'Banjarnegara',
    desa: 'Semarang',
    phone: '',
    title: '',
    description: ''
  });
  const [dewanResponseText, setDewanResponseText] = useState('');
  const [respondingAspirationId, setRespondingAspirationId] = useState<string | null>(null);

  // Quick Count Form States
  const [showReportModal, setShowReportModal] = useState(false);
  const [newReportState, setNewReportState] = useState({
    title: '',
    category: 'Kegiatan Rutin' as MemberReport['category'],
    details: '',
    photoUrl: '',
    targetMemberId: ''
  });

  // Messaging States
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [newMsgContent, setNewMsgContent] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactFilterRole, setContactFilterRole] = useState('');
  const [contactFilterKecamatan, setContactFilterKecamatan] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);

  // Mark selected chat messages as read
  useEffect(() => {
    if (activeTab === 'perpesanan' && activeChatUserId) {
      const hasUnread = messages.some(msg => msg.senderId === activeChatUserId && msg.receiverId === currentUser.id && !msg.read);
      if (hasUnread) {
        setMessages(prev => 
          prev.map(msg => 
            msg.senderId === activeChatUserId && msg.receiverId === currentUser.id && !msg.read
              ? { ...msg, read: true }
              : msg
          )
        );
      }
    }
  }, [activeChatUserId, activeTab, currentUser.id, messages]);

  // Quick Count Form States
  const [showC1Modal, setShowC1Modal] = useState(false);
  const [newC1, setNewC1] = useState({
    kecamatan: 'Banjarnegara',
    tps: 'TPS 01',
    candidate1Votes: 0,
    candidate2Votes: 0,
    candidate3Votes: 0,
    tidakSah: 0,
    c1PhotoUrl: ''
  });

  // Member Detail Modal State
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Strategic Book & Anti-Broker Modal State
  const [showStrategicModal, setShowStrategicModal] = useState(false);

  // Leaflet Map Center State
  const [mapCenter, setMapCenter] = useState<[number, number]>([-7.3996, 109.6976]);

  // Handle Login Submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    // Find member by KTA or NIK
    const foundUser = members.find(m => 
      m.ktaNumber === loginIdentifier.trim() || 
      m.nik === loginIdentifier.trim()
    );

    if (foundUser) {
      if (loginPassword === '123456') { // Mock global password for all accounts
        setCurrentUserId(foundUser.id);
        setIsLoggedIn(true);
        setActiveTab('dashboard');
        // Push login activity to audit log
        const log = {
          time: new Date().toISOString().slice(0, 16).replace('T', ' '),
          user: foundUser.name,
          action: `Melakukan login ke dalam sistem (${foundUser.role.replace('_', ' ').toUpperCase()})`
        };
        setAuditLogs([log, ...auditLogs]);
      } else {
        setLoginError('Password salah! (Gunakan password demo: 123456)');
      }
    } else {
      setLoginError('ID Anggota / KTA / NIK tidak terdaftar di database.');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    pushAuditLog("Melakukan logout dari sistem");
    setIsLoggedIn(false);
    setLoginIdentifier('');
    setLoginPassword('');
  };

  // ------------------ MISSING HELPERS & HANDLERS ------------------

  // E-Learning Quiz Handlers
  const handleAnswerSelect = (questionId: number, answerIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  };

  const submitQuiz = () => {
    let correctCount = 0;
    QUIZ_QUESTIONS.forEach(q => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });
    const score = Math.round((correctCount / QUIZ_QUESTIONS.length) * 100);
    setQuizScore(score);
    pushAuditLog(`Menyelesaikan Kuis Ideologi dengan skor ${score}%`);
    
    if (score === 100) {
      // Trigger confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D32F2F', '#FFD700', '#111111']
      });
    }
  };

  const resetQuiz = () => {
    setQuizStarted(false);
    setCurrentQuestionIdx(0);
    setSelectedAnswers({});
    setQuizScore(null);
    setShowCertificate(false);
  };

  // Logistics Handlers
  const handleUpdateOrderStatus = (orderId: string, nextStatus: LogisticsOrder['status']) => {
    if (isDbConnected) {
      fetch(`/api/logistics/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      }).catch(err => console.error('Error updating order status in database:', err));
    }

    setOrders(prevOrders => 
      prevOrders.map(o => {
        if (o.id === orderId) {
          // Adjust stock if transitioning to approved
          if (nextStatus === 'approved' && o.status === 'draft') {
            setLogistics(prevLog => 
              prevLog.map(item => {
                if (item.name === o.itemName) {
                  return { ...item, stock: Math.max(0, item.stock - o.quantity) };
                }
                return item;
              })
            );
          }
          return { ...o, status: nextStatus };
        }
        return o;
      })
    );
    pushAuditLog(`Mengubah status pesanan logistik ${orderId} menjadi ${nextStatus.toUpperCase()}`);
  };

  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = logistics.find(l => l.id === newOrder.itemId);
    if (!targetItem) return;

    const newOrd: LogisticsOrder = {
      id: `ord-${Date.now()}`,
      requesterName: newOrder.requesterName || currentUser.name,
      requesterRole: currentUser.role.replace('_', ' ').toUpperCase(),
      kecamatan: newOrder.kecamatan,
      desa: newOrder.desa,
      itemName: targetItem.name,
      quantity: newOrder.quantity,
      status: (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') ? 'approved' : 'draft',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };

    if (isDbConnected) {
      fetch('/api/logistics/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrd)
      }).catch(err => console.error('Error saving order to database:', err));
    }

    // If auto-approved, deduct stock directly
    if (newOrd.status === 'approved') {
      setLogistics(prev => 
        prev.map(l => l.id === targetItem.id ? { ...l, stock: Math.max(0, l.stock - newOrder.quantity) } : l)
      );
    }

    setOrders([newOrd, ...orders]);
    setShowLogisticsModal(false);
    setNewOrder({
      requesterName: '',
      kecamatan: currentUser.kecamatan || 'Banjarnegara',
      desa: currentUser.desa || 'Semarang',
      itemId: '',
      quantity: 10
    });
    pushAuditLog(`Mengajukan logistik: ${targetItem.name} (${newOrder.quantity} Pcs)`);
  };

  // Operational Funds Handlers
  const handleAddFund = (e: React.FormEvent) => {
    e.preventDefault();
    if (fundAmount <= 0 || !fundTitle.trim()) return;

    const newFund: OperationalFund = {
      id: `f-${Date.now()}`,
      type: fundType,
      amount: fundAmount,
      category: fundCategory,
      title: fundTitle,
      description: fundDescription,
      date: new Date().toISOString().slice(0, 10),
      submitterId: currentUser.id,
      submitterName: currentUser.name
    };

    if (isDbConnected) {
      fetch('/api/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFund)
      }).catch(err => console.error('Error saving transaction to database:', err));
    }

    setFunds(prev => [newFund, ...prev]);
    setShowFundModal(false);
    
    // Reset form
    setFundAmount(0);
    setFundTitle('');
    setFundDescription('');
    setFundCategory('Kegiatan');
    pushAuditLog(`Mencatat dana operasional: ${fundType === 'income' ? 'Pemasukan' : 'Pengeluaran'} - Rp ${fundAmount.toLocaleString()} (${fundTitle})`);
  };

  const handleDeleteFund = (id: string) => {
    const target = funds.find(f => f.id === id);
    if (!target) return;

    if (confirm("Apakah Anda yakin ingin menghapus catatan transaksi ini?")) {
      if (isDbConnected) {
        fetch(`/api/funds/${id}`, { method: 'DELETE' })
          .catch(err => console.error('Error deleting transaction from database:', err));
      }

      setFunds(prev => prev.filter(f => f.id !== id));
      pushAuditLog(`Menghapus catatan dana operasional: ${target.title}`);
    }
  };

  // Stock Mutation Handlers
  const handleAddStockMutation = (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = logistics.find(l => l.id === stockItemId);
    if (!targetItem || stockQuantity <= 0) return;

    const newMutation: LogisticsStockHistory = {
      id: `sh-${Date.now()}`,
      itemId: stockItemId,
      itemName: targetItem.name,
      type: stockMutationType,
      quantity: stockQuantity,
      notes: stockNotes,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      submitterName: currentUser.name
    };

    if (isDbConnected) {
      fetch('/api/logistics/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMutation)
      }).catch(err => console.error('Error saving stock mutation to database:', err));
    }

    // Update stock history state
    setStockHistory(prev => [newMutation, ...prev]);

    // Update logistics item stock state
    setLogistics(prevItems => 
      prevItems.map(item => {
        if (item.id === stockItemId) {
          const newStock = stockMutationType === 'stock_in' 
            ? item.stock + stockQuantity 
            : Math.max(0, item.stock - stockQuantity);
          return { ...item, stock: newStock };
        }
        return item;
      })
    );

    setShowStockMutationModal(false);
    
    // Reset form
    setStockItemId('');
    setStockQuantity(0);
    setStockNotes('');
    pushAuditLog(`Mencatat mutasi stok ${targetItem.name}: ${stockMutationType === 'stock_in' ? 'Masuk' : 'Keluar'} (${stockQuantity} Pcs)`);
  };

  // Photo / File Upload to Base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        callback(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // GPS Coordinates Fetching
  const fetchGPS = () => {
    setGpsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewMember(prev => ({
            ...prev,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }));
          setGpsLoading(false);
          alert(`Koordinat GPS Berhasil Diambil: ${position.coords.latitude}, ${position.coords.longitude}`);
        },
        (error) => {
          console.error(error);
          // Fallback to random offset near Kecamatan center
          const coords = KECAMATAN_COORDS[newMember.kecamatan] || KECAMATAN_COORDS['Banjarnegara'];
          const offsetLat = coords.lat + (Math.random() - 0.5) * 0.01;
          const offsetLng = coords.lng + (Math.random() - 0.5) * 0.01;
          setNewMember(prev => ({
            ...prev,
            lat: offsetLat,
            lng: offsetLng
          }));
          setGpsLoading(false);
          alert("Gagal mengakses GPS. Menggunakan simulasi koordinat presisi wilayah.");
        }
      );
    } else {
      const coords = KECAMATAN_COORDS[newMember.kecamatan] || KECAMATAN_COORDS['Banjarnegara'];
      setNewMember(prev => ({
        ...prev,
        lat: coords.lat + (Math.random() - 0.5) * 0.01,
        lng: coords.lng + (Math.random() - 0.5) * 0.01
      }));
      setGpsLoading(false);
      alert("Browser tidak mendukung GPS. Menggunakan simulasi koordinat wilayah.");
    }
  };

  // Membership Handlers
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.nik) {
      alert("Nama dan NIK wajib diisi!");
      return;
    }

    const nextId = `m-${Date.now()}`;
    const ktaPrefix = newMember.role === 'super_admin' ? 'ADMIN-3304' : 'KTA-3304';
    const nextKta = `${ktaPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const memberToAdd: Member = {
      id: nextId,
      name: newMember.name,
      nik: newMember.nik,
      ktaNumber: nextKta,
      role: newMember.role as Member['role'],
      kecamatan: newMember.kecamatan,
      desa: newMember.desa,
      tps: newMember.tps,
      phone: newMember.phone || '-',
      photoUrl: newMember.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
      lat: newMember.lat,
      lng: newMember.lng,
      status: 'ACTIVE',
      joinDate: new Date().toISOString().split('T')[0],
      parentId: currentUser.id // Recruited by current user (downline tree branch)
    };

    if (isDbConnected) {
      fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberToAdd)
      }).catch(err => console.error('Error saving member to database:', err));
    }

    setMembers([...members, memberToAdd]);
    setShowAddMemberModal(false);
    // Reset form
    setNewMember({
      name: '',
      nik: '',
      role: 'anggota',
      kecamatan: currentUser.kecamatan || 'Banjarnegara',
      desa: currentUser.desa || 'Semarang',
      tps: 'TPS 01',
      phone: '',
      photoUrl: '',
      lat: -7.3996,
      lng: 109.6976,
      parentId: ''
    });
    pushAuditLog(`Mendaftarkan anggota baru: ${memberToAdd.name} (${memberToAdd.ktaNumber})`);
  };

  // Aspirasi Handlers
  const handleAddAspiration = (e: React.FormEvent) => {
    e.preventDefault();
    const newAsp: Aspiration = {
      id: `asp-${Date.now()}`,
      reporterName: newAspiration.reporterName || currentUser.name,
      kecamatan: newAspiration.kecamatan,
      desa: newAspiration.desa,
      phone: newAspiration.phone || '-',
      title: newAspiration.title,
      description: newAspiration.description,
      status: 'pending',
      date: new Date().toISOString().split('T')[0]
    };

    if (isDbConnected) {
      fetch('/api/aspirations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAsp)
      }).catch(err => console.error('Error saving aspiration to database:', err));
    }

    setAspirations([newAsp, ...aspirations]);
    setShowAspirationModal(false);
    setNewAspiration({
      reporterName: '',
      kecamatan: currentUser.kecamatan || 'Banjarnegara',
      desa: currentUser.desa || 'Semarang',
      phone: '',
      title: '',
      description: ''
    });
    pushAuditLog(`Melaporkan aspirasi baru: "${newAsp.title}"`);
  };

  const handleRespondAspiration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingAspirationId || !dewanResponseText.trim()) return;

    if (isDbConnected) {
      fetch(`/api/aspirations/${respondingAspirationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', dewanResponse: dewanResponseText })
      }).catch(err => console.error('Error responding aspiration in database:', err));
    }

    setAspirations(prev => 
      prev.map(asp => {
        if (asp.id === respondingAspirationId) {
          return {
            ...asp,
            status: 'resolved',
            dewanResponse: dewanResponseText
          };
        }
        return asp;
      })
    );
    pushAuditLog(`Menanggapi aspirasi ${respondingAspirationId}: "${dewanResponseText.slice(0, 30)}..."`);
    setRespondingAspirationId(null);
    setDewanResponseText('');
  };

  // Quick Count Handlers
  const handleAddC1 = (e: React.FormEvent) => {
    e.preventDefault();
    const totalVotes = newC1.candidate1Votes + newC1.candidate2Votes + newC1.candidate3Votes;
    const computedSah = totalVotes; // Mock total sah is sum of all candidate votes

    const newQC: QuickCountResult = {
      kecamatan: newC1.kecamatan,
      tps: newC1.tps,
      candidate1Votes: newC1.candidate1Votes,
      candidate2Votes: newC1.candidate2Votes,
      candidate3Votes: newC1.candidate3Votes,
      sah: computedSah,
      tidakSah: newC1.tidakSah,
      c1PhotoUrl: newC1.c1PhotoUrl || "/tps.png",
      submittedBy: currentUser.name,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };

    if (isDbConnected) {
      fetch('/api/quickcount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQC)
      }).catch(err => console.error('Error saving quick count to database:', err));
    }

    setQuickCounts([newQC, ...quickCounts]);
    setShowC1Modal(false);
    // Reset Form
    setNewC1({
      kecamatan: currentUser.kecamatan || 'Banjarnegara',
      tps: 'TPS 01',
      candidate1Votes: 0,
      candidate2Votes: 0,
      candidate3Votes: 0,
      tidakSah: 0,
      c1PhotoUrl: ''
    });
    pushAuditLog(`Mengirimkan rekap hasil TPS: ${newQC.tps} Kecamatan ${newQC.kecamatan}`);
  };

  // Member Reports Handlers
  const handleAddReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportState.title || !newReportState.details) {
      alert("Judul dan detail laporan wajib diisi!");
      return;
    }

    let targetName = undefined;
    if (newReportState.targetMemberId) {
      const tgt = members.find(m => m.id === newReportState.targetMemberId);
      if (tgt) targetName = tgt.name;
    }

    const newReport: MemberReport = {
      id: `rep-${Date.now()}`,
      title: newReportState.title,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      category: newReportState.category,
      details: newReportState.details,
      photoUrl: newReportState.photoUrl || "/tps.png",
      submittedBy: currentUser.name,
      submitterId: currentUser.id,
      kecamatan: currentUser.kecamatan || 'Banjarnegara',
      targetMemberId: newReportState.targetMemberId || undefined,
      targetMemberName: targetName
    };

    if (isDbConnected) {
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport)
      }).catch(err => console.error('Error saving report to database:', err));
    }

    setReports([newReport, ...reports]);
    setShowReportModal(false);
    setNewReportState({
      title: '',
      category: 'Kegiatan Rutin',
      details: '',
      photoUrl: '',
      targetMemberId: ''
    });
    
    const auditMsg = targetName 
      ? `Mengirimkan laporan ditujukan ke ${targetName}: "${newReport.title}"`
      : `Mengirimkan laporan: "${newReport.title}" (${newReport.category})`;
    pushAuditLog(auditMsg);
  };

  // Messaging Handlers
  const handleSendMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatUserId || !newMsgContent.trim()) return;

    const receiver = members.find(m => m.id === activeChatUserId);
    if (!receiver) return;

    const userMessageContent = newMsgContent.trim();

    const newMsg: PrivateMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      receiverId: receiver.id,
      receiverName: receiver.name,
      content: userMessageContent,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      read: true
    };

    if (isDbConnected) {
      fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg)
      }).catch(err => console.error('Error saving message to database:', err));
    }

    setMessages(prev => [...prev, newMsg]);
    setNewMsgContent('');
    pushAuditLog(`Mengirim pesan ke ${receiver.name}`);

    // Simulated Auto-Reply
    setIsTyping(true);
    setTypingUserId(receiver.id);

    setTimeout(() => {
      setIsTyping(false);
      setTypingUserId(null);

      // Contextual auto reply content
      let replyContent = `Halo ${currentUser.name}, terima kasih pesannya. Ada yang bisa saya bantu untuk pemenangan di wilayah kita?`;
      const lowerMsg = userMessageContent.toLowerCase();

      if (lowerMsg.includes('merdeka') || lowerMsg.includes('banteng')) {
        replyContent = "Merdeka!!! Selalu solid bergerak satu barisan untuk pemenangan PDI Perjuangan di Banjarnegara!";
      } else if (lowerMsg.includes('logistik') || lowerMsg.includes('bendera') || lowerMsg.includes('kaos') || lowerMsg.includes('apk')) {
        replyContent = `Baik rekan. Terkait logistik/APK silakan buat pengajuan resmi di tab 'Logistik & Distribusi'. Nanti DPC akan verifikasi kuota per ranting.`;
      } else if (lowerMsg.includes('tps') || lowerMsg.includes('c1') || lowerMsg.includes('suara') || lowerMsg.includes('quickcount')) {
        replyContent = `Untuk input C1 & Saksi TPS, pastikan data diunggah dengan foto form C1 plano yang jelas di tab 'Quick Count' ya.`;
      } else if (lowerMsg.includes('laporan') || lowerMsg.includes('kejadian') || lowerMsg.includes('masalah')) {
        replyContent = `Terima kasih infonya. Tolong buat laporan tertarget di tab 'Laporan & Peristiwa' agar bisa segera dipantau oleh Korcam dan Pimpinan DPC.`;
      } else if (lowerMsg.includes('halo') || lowerMsg.includes('hai') || lowerMsg.includes('pagi') || lowerMsg.includes('siang') || lowerMsg.includes('sore') || lowerMsg.includes('malam') || lowerMsg.includes('assalamualaikum')) {
        replyContent = `Halo rekan ${currentUser.name}! Salam perjuangan. Ada kabar perkembangan apa di wilayah ${currentUser.kecamatan}?`;
      }

      const replyMsg: PrivateMessage = {
        id: `msg-${Date.now() + 1}`,
        senderId: receiver.id,
        senderName: receiver.name,
        receiverId: currentUser.id,
        receiverName: currentUser.name,
        content: replyContent,
        timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        read: false
      };

      if (isDbConnected) {
        fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(replyMsg)
        }).catch(err => console.error('Error saving reply message to database:', err));
      }

      setMessages(prev => [...prev, replyMsg]);
    }, 1800);
  };

  // Helper to append a new audit log entry
  const pushAuditLog = (action: string) => {
    const log = {
      time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      user: currentUser.name,
      action
    };
    if (isDbConnected) {
      fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser.name, action })
      }).catch(err => console.error('Error saving audit log to database:', err));
    }
    setAuditLogs([log, ...auditLogs].slice(0, 50));
  };

  // Determine what members the currently logged-in user can SEE & MANAGE
  const getVisibleMembers = (): Member[] => {
    if (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') {
      return members;
    }
    
    return members.filter(m => {
      if (m.id === currentUser.id) return true;
      if (isDescendant(m, currentUser.id, members)) return true;
      
      if (currentUser.role === 'korcam' && m.kecamatan === currentUser.kecamatan) {
        if (m.role === 'pimpinan_dpc' || m.role === 'super_admin') return false;
        return true;
      }
      
      if (currentUser.role === 'ketua_ranting' && m.kecamatan === currentUser.kecamatan && m.desa === currentUser.desa) {
        if (m.role === 'pimpinan_dpc' || m.role === 'super_admin' || m.role === 'korcam') return false;
        return true;
      }

      return false;
    });
  };

  const visibleMembersList = getVisibleMembers();

  // Filter visible members by search query
  const filteredVisibleMembers = visibleMembersList.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
                          m.ktaNumber.toLowerCase().includes(memberSearch.toLowerCase()) ||
                          m.nik.includes(memberSearch);
    const matchesKecamatan = filterKecamatan ? m.kecamatan === filterKecamatan : true;
    const matchesDesa = filterDesa ? m.desa === filterDesa : true;
    return matchesSearch && matchesKecamatan && matchesDesa;
  });

  const listItemsPerPage = 10;
  const totalListPages = Math.ceil(filteredVisibleMembers.length / listItemsPerPage) || 1;
  const activeListPage = Math.min(listPage, totalListPages);
  const paginatedVisibleMembers = filteredVisibleMembers.slice(
    (activeListPage - 1) * listItemsPerPage,
    activeListPage * listItemsPerPage
  );

  // Role-customized dashboard aggregates
  const dashboardStats = (() => {
    const filterByScope = <T extends { kecamatan: string; desa?: string }>(item: T): boolean => {
      if (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') return true;
      if (currentUser.role === 'korcam') return item.kecamatan === currentUser.kecamatan;
      if (currentUser.role === 'ketua_ranting') return item.kecamatan === currentUser.kecamatan && item.desa === currentUser.desa;
      return false;
    };

    const dashboardMembers = currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc'
      ? members 
      : members.filter(m => m.id === currentUser.id || isDescendant(m, currentUser.id, members));

    const dashboardAspirations = aspirations.filter(filterByScope);
    const dashboardQC = quickCounts.filter(filterByScope);

    return {
      memberCount: dashboardMembers.length,
      aspirationCount: dashboardAspirations.length,
      qcCount: dashboardQC.length,
      downlineCount: countDownline(currentUser.id, members)
    };
  })();

  const filterByScope = <T extends { kecamatan: string; desa?: string }>(item: T): boolean => {
    if (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') return true;
    if (currentUser.role === 'korcam') return item.kecamatan === currentUser.kecamatan;
    if (currentUser.role === 'ketua_ranting') return item.kecamatan === currentUser.kecamatan;
    return false;
  };

  const scopeQCList = quickCounts.filter(filterByScope);

  const qcTotals = scopeQCList.reduce((acc, curr) => {
    acc.c1 += curr.candidate1Votes;
    acc.c2 += curr.candidate2Votes; // PDIP
    acc.c3 += curr.candidate3Votes;
    acc.sah += curr.sah;
    acc.tidakSah += curr.tidakSah;
    return acc;
  }, { c1: 0, c2: 0, c3: 0, sah: 0, tidakSah: 0 });

  const totalQC = qcTotals.c1 + qcTotals.c2 + qcTotals.c3;

  // Group visible members by month for line chart growth
  const growthData = (() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const counts = Array(12).fill(0);
    visibleMembersList.forEach(m => {
      if (m.joinDate) {
        const monthIdx = new Date(m.joinDate).getMonth();
        if (monthIdx >= 0 && monthIdx < 12) {
          counts[monthIdx]++;
        }
      }
    });
    
    let runningTotal = 0;
    return months.map((name, idx) => {
      runningTotal += counts[idx];
      return { name, Anggota: runningTotal };
    }).filter((_, idx) => idx <= new Date().getMonth());
  })();

  // Recursive component for structural Tree Viewer
  const MemberTreeNodeComponent = ({ member }: { member: Member }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [childrenPage, setChildrenPage] = useState(1);
    const directChildren = members.filter(m => m.parentId === member.id);
    const totalRecruits = countDownline(member.id, members);

    const childrenPerPage = 3;
    const totalChildrenPages = Math.ceil(directChildren.length / childrenPerPage);
    const paginatedChildren = directChildren.slice(
      (childrenPage - 1) * childrenPerPage,
      childrenPage * childrenPerPage
    );

    return (
      <div className="pl-6 border-l border-red-900/30 my-2 animate-fadeIn">
        <div 
          onClick={() => setSelectedMemberId(member.id)}
          className="flex items-center gap-3 bg-pdip-metal/80 border border-red-950/20 p-3 rounded-lg shadow-sm hover:border-red-500/40 transition cursor-pointer max-w-md"
        >
          {directChildren.length > 0 && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-gray-400 hover:text-white"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
            </button>
          )}
          <img 
            src={member.photoUrl} 
            alt={member.name}
            className="w-8 h-8 rounded-full object-cover border border-red-900/30"
          />
          <div className="flex-1 min-w-0">
            <span className="font-bold text-xs text-white block truncate">{member.name}</span>
            <span className="text-[10px] text-red-500 font-mono font-bold block">{member.ktaNumber}</span>
            <span className="text-[9px] text-gray-400 block uppercase">{member.role.replace('_', ' ')}</span>
          </div>
          <div className="text-right flex flex-col items-end justify-between shrink-0">
            <div>
              <span className="text-[10px] bg-red-950/50 text-red-400 border border-red-900/30 px-2 py-0.5 rounded-full font-bold block">
                {totalRecruits} Downline
              </span>
              <span className="text-[9px] text-gray-500 block mt-0.5">{member.kecamatan}</span>
            </div>
            {member.id !== currentUser.id && (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveChatUserId(member.id);
                    setActiveTab('perpesanan');
                  }}
                  className="text-gray-400 hover:text-white transition"
                  title="Kirim Pesan"
                >
                  <Mail size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewReportState({
                      title: '',
                      category: 'Kegiatan Rutin',
                      details: '',
                      photoUrl: '',
                      targetMemberId: member.id
                    });
                    setShowReportModal(true);
                  }}
                  className="text-gray-400 hover:text-white transition"
                  title="Kirim Laporan Khusus"
                >
                  <Award size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {isExpanded && directChildren.length > 0 && (
          <div className="mt-1 space-y-1">
            {paginatedChildren.map(child => (
              <MemberTreeNodeComponent key={child.id} member={child} />
            ))}
            
            {/* Pagination Controls for Child Nodes */}
            {totalChildrenPages > 1 && (
              <div 
                className="flex items-center gap-2 pl-6 py-1 select-none" 
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  disabled={childrenPage === 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setChildrenPage(prev => Math.max(prev - 1, 1));
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded bg-pdip-darkgray border border-red-900/20 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-red-900/10 transition text-[9px] font-bold"
                  title="Halaman Sebelumnya"
                >
                  ◀
                </button>
                <span className="text-[9px] text-gray-400 font-mono">
                  Hal {childrenPage}/{totalChildrenPages}
                </span>
                <button
                  disabled={childrenPage === totalChildrenPages}
                  onClick={(e) => {
                    e.stopPropagation();
                    setChildrenPage(prev => Math.min(prev + 1, totalChildrenPages));
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded bg-pdip-darkgray border border-red-900/20 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-red-900/10 transition text-[9px] font-bold"
                  title="Halaman Berikutnya"
                >
                  ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Login Page if not logged in
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pdip-black via-red-950/25 to-pdip-black flex flex-col justify-center items-center p-6 font-sans">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-8 animate-fadeIn">
          <img 
            src="/logo.png" 
            alt="PDI Perjuangan" 
            className="w-16 h-16 object-contain filter drop-shadow-2xl"
          />
          <div>
            <h1 className="font-serif font-black text-2xl tracking-widest text-white leading-tight">PDI PERJUANGAN</h1>
            <p className="text-xs text-red-500 uppercase tracking-widest font-semibold mt-0.5">DPC KAB. BANJARNEGARA</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md bg-pdip-metal border border-red-900/20 rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden animate-scaleUp">
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-bold text-white tracking-wide">Masuk Portal Pemenangan</h2>
            <p className="text-xs text-gray-400">Silakan gunakan KTA atau NIK Anda untuk mengakses dasbor.</p>
          </div>

          {loginError && (
            <div className="p-3.5 bg-red-950/50 border border-red-900/40 rounded-lg text-xs text-red-400 font-medium">
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-semibold block">No. KTA atau NIK:</label>
              <input
                type="text"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Contoh: ADMIN-3304-001 / 3304..."
                className="w-full bg-pdip-black border border-red-900/35 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-pdip-red transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-semibold block flex justify-between">
                <span>Password Sandi:</span>
                <span className="text-[10px] text-gray-500 font-normal italic">Demo: 123456</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Masukkan password Anda..."
                  className="w-full bg-pdip-black border border-red-900/35 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-pdip-red transition"
                />
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-500">
                  <Lock size={15} />
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-pdip-red to-pdip-darkred hover:from-pdip-brightred hover:to-pdip-red text-white py-3 rounded-lg text-sm font-bold shadow-lg shadow-red-950/30 transition duration-200"
            >
              Sign In / Masuk
            </button>
          </form>

          {/* Demo account helper panel */}
          <div className="pt-4 border-t border-red-950/20">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wide mb-2.5">
              <Shield size={12} /> Akun Demo Uji Coba:
            </div>
            <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
              {[
                { name: "Super Admin", role: "SUPER ADMIN", id: "ADMIN-3304-001" },
                { name: "H. Nuryanto, S.Sos.", role: "PIMPINAN DPC", id: "KTA-3304-0001" },
                { name: "Adi Wijaya", role: "ADMIN LOGISTIK", id: "KTA-3304-9999" },
                { name: "Budi Santoso", role: "KORCAM BAWANG", id: "KTA-3304-0105" },
                { name: "Sri Rahayu", role: "KETUA RANTING", id: "KTA-3304-0320" },
                { name: "Joko Susilo", role: "RELAWAN TPS", id: "KTA-3304-0982" },
              ].map((acc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setLoginIdentifier(acc.id);
                    setLoginPassword('123456');
                  }}
                  className="w-full text-left p-2 bg-pdip-black/50 hover:bg-red-950/15 border border-red-900/10 hover:border-red-900/35 rounded-lg flex justify-between items-center text-[10px] transition"
                >
                  <div>
                    <span className="font-bold text-white block">{acc.name}</span>
                    <span className="text-gray-500 font-mono">{acc.id}</span>
                  </div>
                  <span className="bg-red-950 text-red-400 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wider border border-red-900/25">
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pdip-black text-gray-100 flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-80 bg-pdip-metal border-b md:border-r border-red-900/30 p-6 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Header */}
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-red-900/20">
            <img 
              src="/logo.png" 
              alt="PDI Perjuangan" 
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-wider text-red-500 font-serif">PDI PERJUANGAN</h1>
              <p className="text-xs text-gray-400">DPC Kab. Banjarnegara</p>
            </div>
          </div>

          {/* Active User Information widget */}
          <div className="mb-6 p-4 bg-pdip-darkgray rounded-xl border border-red-900/20 flex gap-3 items-center">
            <img 
              src={currentUser.photoUrl} 
              alt={currentUser.name} 
              className="w-10 h-10 rounded-full object-cover border border-red-500"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-white truncate">{currentUser.name}</h4>
              <span className="text-[9px] bg-red-950 text-red-400 border border-red-900/20 px-1.5 py-0.5 rounded-full font-bold block mt-1 w-max">
                {currentUser.role.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex flex-col gap-1.5">
            {[
              { id: 'dashboard', label: 'Dasbor Peran', icon: Shield },
              { id: 'keanggotaan', label: 'Struktur & Downline', icon: Users },
              { id: 'dpt', label: 'Daftar DPT Wilayah', icon: ListCollapse },
              { id: 'laporan', label: 'Laporan & Peristiwa', icon: Award },
              { id: 'perpesanan', label: 'Perpesanan Private', icon: Mail },
              { id: 'gis', label: 'GIS & Peta Sebaran', icon: Map },
              { id: 'kaderisasi', label: 'Kaderisasi E-Learning', icon: BookOpen },
              { id: 'logistik', label: 'Logistik & Distribusi', icon: Truck },
              { id: 'aspirasi', label: 'Aspirasi & DPRD', icon: MessageSquare },
              { id: 'quickcount', label: 'TPS & Quick Count C1', icon: RefreshCw },
              ...((currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik') ? [
                { id: 'pendanaan', label: 'Dana Operasional', icon: Wallet }
              ] : []),
              { id: 'analitik', label: 'Statistik & Analitik', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isMessageTab = tab.id === 'perpesanan';
              const totalUnreadMessages = messages.filter(m => m.receiverId === currentUser.id && !m.read).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-pdip-red to-pdip-darkred text-white shadow-md border-l-4 border-pdip-gold' 
                      : 'text-gray-400 hover:bg-pdip-darkgray hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                    <span>{tab.label}</span>
                  </div>
                  {isMessageTab && totalUnreadMessages > 0 && (
                    <span className="bg-pdip-red text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-red-950 animate-pulse">
                      {totalUnreadMessages}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Super Admin specific tab */}
            {currentUser.role === 'super_admin' && (
              <button
                onClick={() => setActiveTab('pengaturan')}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'pengaturan' 
                    ? 'bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-md border-l-4 border-pdip-gold' 
                    : 'text-purple-400 hover:bg-pdip-darkgray hover:text-white'
                }`}
              >
                <Settings size={18} />
                <span>Pengaturan Sistem</span>
              </button>
            )}
          </nav>
        </div>

        {/* Logout Button */}
        <div className="mt-8 pt-4 border-t border-red-900/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition duration-200"
          >
            <LogOut size={16} />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* ==================== DASHBOARD VIEW ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header Banner */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-pdip-black via-pdip-darkred/30 to-pdip-black border border-red-900/30 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/50 border border-pdip-red text-red-400 text-xs font-semibold">
                  <span>✊ Merdeka! Solid Bergerak</span>
                </div>
                <h2 className="text-3xl font-extrabold font-serif text-white tracking-wide">
                  Dasbor {currentUser.role.replace('_', ' ').toUpperCase()}
                </h2>
                <p className="text-gray-300 font-medium text-sm">
                  Selamat Datang, rekan juang <span className="text-red-500 font-bold">{currentUser.name}</span>.
                </p>
                <p className="text-gray-400 max-w-xl text-xs leading-relaxed">
                  {currentUser.role === 'super_admin' && "Akses Administrasi Sistem: Anda memiliki otorisasi tertinggi untuk memodifikasi pengaturan global, memeriksa audit trail, dan mengelola alur aplikasi."}
                  {currentUser.role === 'pimpinan_dpc' && "Akses DPC: Anda memiliki kendali penuh atas pemantauan cabang, pergerakan kader, logistik nasional/daerah, dan seluruh rekapitulasi tingkat kabupaten."}
                  {currentUser.role === 'korcam' && `Akses Kecamatan: Memantau dan mengelola kader tingkat desa di Kecamatan ${currentUser.kecamatan}, serta mendistribusikan logistik pemenangan.`}
                  {currentUser.role === 'ketua_ranting' && `Akses Desa/Ranting: Mengelola database anggota di Desa ${currentUser.desa}, dan mengawasi koordinat rumah anggota.`}
                  {currentUser.role === 'anggota' || currentUser.role === 'relawan_terdaftar' || currentUser.role === 'bapilu' || currentUser.role === 'anggota_dewan' ? `Akses Personal: Anda memiliki downline sebanyak ${dashboardStats.downlineCount} orang di bawah cabang keanggotaan Anda.` : ''}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setActiveTab('keanggotaan')}
                  className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs md:text-sm font-semibold px-5 py-3 rounded-lg shadow-lg shadow-red-950/50 transition duration-200 flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Rekrut Anggota
                </button>
                <button 
                  onClick={() => setShowStrategicModal(true)}
                  className="bg-transparent border border-pdip-gold text-pdip-gold hover:bg-pdip-gold/10 text-xs md:text-sm font-semibold px-5 py-3 rounded-lg shadow-lg transition duration-200 flex items-center justify-center gap-2"
                >
                  <Shield size={16} /> Panduan Anti-Broker & Manfaat
                </button>
              </div>
            </div>

            {/* Strategic Value Preview Card */}
            <div className="bg-pdip-metal/90 border border-red-950/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-900/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-red-950/60 rounded-lg text-pdip-gold border border-red-900/30">
                      <Shield size={20} />
                    </span>
                    <h3 className="text-lg font-bold font-serif text-white tracking-wide">
                      Doktrin Strategis: Sistem Anti-Broker Suara & Kekuatan Pemilu Riil
                    </h3>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Aplikasi ini dirancang sebagai mesin pemenangan yang presisi dengan verifikasi data berlapis. 
                    Sistem memotong jalur spekulan pemilu dan makelar politik (broker suara) yang sering memanipulasi klaim suara fiktif. 
                    Melalui pemetaan NIK valid, koordinat GIS, dan akuntabilitas rekrutmen berjenjang, partai menyusun taktik pemenangan berbasis data riil di akar rumput.
                  </p>
                  
                  {/* Quick Feature Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="bg-pdip-black/40 border border-red-950/20 p-3 rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Anti-Broker & Tim Sukses Palsu
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Verifikasi NIK tunggal dan koordinat GPS meniadakan klaim basis massa fiktif dari oportunis kampanye.
                      </p>
                    </div>
                    <div className="bg-pdip-black/40 border border-red-950/20 p-3 rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        Transparansi MLM Organisasi
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Sistem perekrutan berjenjang (downline) yang melacak tanggung jawab upline untuk menjamin integritas data.
                      </p>
                    </div>
                    <div className="bg-pdip-black/40 border border-red-950/20 p-3 rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Pemetaan GIS & Blank Spot
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Visualisasi peta batas desa mendeteksi wilayah kosong kader secara instan untuk efisiensi logistik.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex lg:flex-col gap-2 shrink-0">
                  <button 
                    onClick={() => setShowStrategicModal(true)}
                    className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-bold px-4 py-3 rounded-lg shadow-md transition duration-200 flex items-center justify-center gap-2 whitespace-nowrap animate-pulse"
                  >
                    Selengkapnya <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Anggota yang Dikelola', value: dashboardStats.memberCount, unit: 'Orang', color: 'border-l-4 border-pdip-red', icon: Users },
                { label: 'Downline Langsung & Cabang', value: dashboardStats.downlineCount, unit: 'Jaringan', color: 'border-l-4 border-indigo-500', icon: GitFork },
                { label: 'Aspirasi Wilayah Kerja', value: dashboardStats.aspirationCount, unit: 'Aduan', color: 'border-l-4 border-blue-500', icon: MessageSquare },
                { label: 'Suara Quick Count Wilayah', value: dashboardStats.qcCount, unit: 'TPS', color: 'border-l-4 border-emerald-500', icon: RefreshCw },
              ].map((m, i) => {
                const Icon = m.icon;
                return (
                  <div key={i} className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 flex justify-between items-center shadow-md">
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{m.label}</p>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold text-white">{m.value}</span>
                        <span className="text-xs text-gray-500">{m.unit}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-pdip-darkgray rounded-lg text-gray-400">
                      <Icon size={20} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart 1: Member growth */}
              <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-6 flex items-center gap-2">
                  <BarChart3 size={16} className="text-pdip-red" /> Tren Pertumbuhan Anggota Jaringan Anda
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="name" stroke="#666" fontSize={12} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#d32f2f' }} />
                      <Line type="monotone" dataKey="Anggota" stroke="#D32F2F" strokeWidth={3} dot={{ fill: '#FFD700', r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Quick count distribution */}
              <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-6 flex items-center gap-2">
                  <BarChart3 size={16} className="text-pdip-red" /> Persentase Suara Quick Count Wilayah Kerja
                </h3>
                {totalQC > 0 ? (
                  <div className="h-72 flex flex-col md:flex-row items-center justify-around">
                    <div className="w-48 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: candidateNames.c1, value: qcTotals.c1 },
                              { name: candidateNames.c2, value: qcTotals.c2 },
                              { name: candidateNames.c3, value: qcTotals.c3 }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#666666" />
                            <Cell fill="#D32F2F" />
                            <Cell fill="#FFD700" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3.5 h-3.5 bg-gray-500 rounded"></div>
                        <span className="text-xs">{candidateNames.c1}: <strong className="text-white">{((qcTotals.c1 / totalQC) * 100).toFixed(1)}%</strong></span>
                      </div>
                      <div className="flex items-center gap-3 font-semibold">
                        <div className="w-3.5 h-3.5 bg-pdip-red rounded"></div>
                        <span className="text-xs text-red-500">{candidateNames.c2}: <strong className="text-red-400">{((qcTotals.c2 / totalQC) * 100).toFixed(1)}%</strong></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3.5 h-3.5 bg-yellow-500 rounded"></div>
                        <span className="text-xs">{candidateNames.c3}: <strong className="text-white">{((qcTotals.c3 / totalQC) * 100).toFixed(1)}%</strong></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-gray-500 text-sm">
                    Belum ada data quick count masuk di wilayah tugas ini.
                  </div>
                )}
              </div>
            </div>

            {/* Downline Recruiting Target & Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Downline Tree Performance Chart */}
              <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 mb-6 flex items-center gap-2">
                  <BarChart3 size={16} className="text-pdip-red" /> Jaringan downline (MLM) Terbanyak di Bawah Anda
                </h3>
                {dashboardStats.downlineCount > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={members.filter(m => m.parentId === currentUser.id).map(m => ({
                        name: m.name,
                        Jaringan: 1 + countDownline(m.id, members)
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" stroke="#666" fontSize={10} />
                        <YAxis stroke="#666" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#d32f2f' }} />
                        <Bar dataKey="Jaringan" fill="#D32F2F">
                          {members.filter(m => m.parentId === currentUser.id).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#D32F2F' : '#FFD700'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex flex-col items-center justify-center text-gray-500 text-sm space-y-3">
                    <span>Anda belum memiliki downline (anggota yang direkrut).</span>
                    <button 
                      onClick={() => setActiveTab('keanggotaan')}
                      className="bg-pdip-darkgray border border-red-900/30 text-white px-4 py-2 rounded text-xs hover:bg-gray-800 transition"
                    >
                      Mulai Perekrutan Sekarang
                    </button>
                  </div>
                )}
              </div>

              {/* Geographic Scope summary */}
              <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 border-b border-red-950/20 pb-3">
                  Informasi Wilayah Tugas Anda
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center bg-pdip-black/40 p-3 rounded">
                    <span className="text-gray-400">Kecamatan Tugas:</span>
                    <span className="font-bold text-white">{currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' ? 'Seluruh Banjarnegara' : currentUser.kecamatan}</span>
                  </div>
                  <div className="flex justify-between items-center bg-pdip-black/40 p-3 rounded">
                    <span className="text-gray-400">Desa/Ranting Tugas:</span>
                    <span className="font-bold text-white">{currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'korcam' ? 'Semua Desa' : currentUser.desa}</span>
                  </div>
                  <div className="flex justify-between items-center bg-pdip-black/40 p-3 rounded">
                    <span className="text-gray-400">TPS Saksi Utama:</span>
                    <span className="font-bold text-red-500">{currentUser.tps}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== KEANGGOTAAN VIEW ==================== */}
        {activeTab === 'keanggotaan' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/20 pb-6">
              <div>
                <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                  <Users className="text-pdip-red" /> Database & Struktur Keanggotaan
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Menampilkan kader di bawah naungan Anda. Anda dapat merekrut anggota baru untuk menjadi cabang downline Anda.
                </p>
              </div>
              
              <div className="flex gap-3">
                {/* View switcher */}
                <div className="bg-pdip-darkgray p-1 rounded-lg border border-red-900/20 flex">
                  <button
                    onClick={() => setMemberViewMode('list')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      memberViewMode === 'list' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Daftar Tabel
                  </button>
                  <button
                    onClick={() => {
                      setMemberViewMode('tree');
                      setTreePage(1);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      memberViewMode === 'tree' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Bagan Anggota
                  </button>
                </div>
                
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="bg-pdip-red hover:bg-pdip-brightred text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
                >
                  <Plus size={16} /> Rekrut Anggota
                </button>
              </div>
            </div>

            {/* Tree View (Bagan Anggota) */}
            {memberViewMode === 'tree' ? (
              <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 shadow-md space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 border-b border-red-950/20 pb-3 flex items-center gap-2">
                  <GitFork size={16} className="text-pdip-red" /> Bagan Alur Cabang Perekrutan (Kaderisasi Turun)
                </h3>
                <div className="p-4 bg-pdip-black/30 rounded-xl overflow-x-auto min-h-[400px]">
                  {currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' ? (
                    (() => {
                      const rootMembers = members.filter(m => !m.parentId);
                      const rootItemsPerPage = 5;
                      const totalRootPages = Math.ceil(rootMembers.length / rootItemsPerPage) || 1;
                      const activeTreePage = Math.min(treePage, totalRootPages);
                      const paginatedRootMembers = rootMembers.slice(
                        (activeTreePage - 1) * rootItemsPerPage,
                        activeTreePage * rootItemsPerPage
                      );
                      return (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            {paginatedRootMembers.map(rootMember => (
                              <MemberTreeNodeComponent key={rootMember.id} member={rootMember} />
                            ))}
                          </div>
                          {totalRootPages > 1 && (
                            <div className="flex items-center justify-between mt-6 border-t border-red-950/20 pt-4">
                              <button
                                disabled={activeTreePage === 1}
                                onClick={() => setTreePage(prev => Math.max(prev - 1, 1))}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pdip-darkgray border border-red-900/20 text-gray-400 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition flex items-center gap-1"
                              >
                                Sebelumnya
                              </button>
                              <span className="text-xs text-gray-400 font-medium font-mono">
                                Halaman {activeTreePage} dari {totalRootPages} ({rootMembers.length} Root)
                              </span>
                              <button
                                disabled={activeTreePage === totalRootPages}
                                onClick={() => setTreePage(prev => Math.min(prev + 1, totalRootPages))}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pdip-darkgray border border-red-900/20 text-gray-400 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition flex items-center gap-1"
                              >
                                Berikutnya
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <MemberTreeNodeComponent member={currentUser} />
                  )}
                </div>
              </div>
            ) : (
              // List View (Daftar Tabel)
              <>
                {/* Search & Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
                  <div className="relative md:col-span-2">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="Cari berdasarkan nama, KTA, atau NIK..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full bg-pdip-black text-sm text-white pl-10 pr-4 py-2.5 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                    />
                  </div>
                  
                  <div>
                    <select
                      value={filterKecamatan}
                      onChange={(e) => {
                        setFilterKecamatan(e.target.value);
                        setFilterDesa('');
                      }}
                      className="w-full bg-pdip-black text-sm text-white px-3 py-2.5 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                    >
                      <option value="">Semua Kecamatan</option>
                      {Object.keys(BANJARNEGARA_REGIONS).map((kec) => (
                        <option key={kec} value={kec}>{kec}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={filterDesa}
                      onChange={(e) => setFilterDesa(e.target.value)}
                      disabled={!filterKecamatan}
                      className="w-full bg-pdip-black text-sm text-white px-3 py-2.5 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red disabled:opacity-50"
                    >
                      <option value="">Semua Desa</option>
                      {filterKecamatan && BANJARNEGARA_REGIONS[filterKecamatan].map((des) => (
                        <option key={des} value={des}>{des}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Member Table */}
                <div className="bg-pdip-metal rounded-xl border border-red-950/20 overflow-hidden shadow-md">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-pdip-darkgray text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-red-950/20">
                          <th className="px-6 py-4">Foto / Nama</th>
                          <th className="px-6 py-4">No. KTA / NIK</th>
                          <th className="px-6 py-4">Pengajak (Parent)</th>
                          <th className="px-6 py-4">Tingkat / Jabatan</th>
                          <th className="px-6 py-4">Kecamatan ➔ Desa ➔ TPS</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-950/10 text-sm">
                        {paginatedVisibleMembers.length > 0 ? (
                          paginatedVisibleMembers.map((m) => {
                            const parent = members.find(p => p.id === m.parentId);
                            return (
                              <tr key={m.id} className="hover:bg-pdip-darkgray/30 transition animate-fadeIn">
                                <td 
                                  className="px-6 py-4 cursor-pointer"
                                  onClick={() => setSelectedMemberId(m.id)}
                                >
                                  <div className="flex items-center gap-3 group">
                                    <img 
                                      src={m.photoUrl} 
                                      alt={m.name} 
                                      className="w-10 h-10 rounded-full object-cover border border-red-900/30 group-hover:border-pdip-red transition"
                                    />
                                    <div>
                                      <span className="font-bold text-white block group-hover:text-red-400 transition">{m.name}</span>
                                      <span className="text-xs text-gray-400">{m.phone}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-gray-400">
                                  <span className="text-red-400 font-bold block">{m.ktaNumber}</span>
                                  <span className="text-gray-500">{m.nik}</span>
                                </td>
                                <td className="px-6 py-4 text-xs">
                                  {parent ? (
                                    <div 
                                      className="flex items-center gap-2 cursor-pointer group"
                                      onClick={() => setSelectedMemberId(parent.id)}
                                    >
                                      <img src={parent.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover group-hover:border border-pdip-red transition" />
                                      <span className="text-gray-300 font-medium group-hover:text-red-400 transition">{parent.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 italic">Pusat/Root</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                      m.role === 'super_admin' ? 'bg-purple-950 text-purple-400 border border-purple-800/40' :
                                      m.role === 'pimpinan_dpc' ? 'bg-amber-950 text-amber-400 border border-amber-800/40' :
                                      m.role === 'anggota_dewan' ? 'bg-red-950 text-red-400 border border-red-900/40' :
                                      m.role === 'korcam' ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-900 text-gray-400'
                                    }`}>
                                      {m.role.replace('_', ' ').toUpperCase()}
                                    </span>
                                    {m.role === 'anggota_dewan' && m.dapil && (
                                      <span className="text-[10px] bg-red-950 text-pdip-gold font-bold px-2 py-0.5 rounded border border-red-900/40">
                                        {m.dapil}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-300">
                                  <div>{m.kecamatan} ➔ {m.desa}</div>
                                  <div className="text-[10px] text-gray-500 font-bold uppercase">{m.tps}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    onClick={() => {
                                      if (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || isDescendant(m, currentUser.id, members)) {
                                        setMembers(members.map(member => 
                                          member.id === m.id 
                                            ? { ...member, status: member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } 
                                            : member
                                        ));
                                      }
                                    }}
                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition ${
                                      m.status === 'ACTIVE' 
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' 
                                        : 'bg-red-950 text-red-400 border-red-900/30'
                                    }`}
                                  >
                                    {m.status}
                                  </button>
                                </td>
                                <td className="px-6 py-4 text-right text-xs">
                                  <div className="flex justify-end items-center gap-2">
                                    {/* View Profile Detail Shortcut */}
                                    <button
                                      onClick={() => setSelectedMemberId(m.id)}
                                      className="text-gray-400 hover:text-white bg-pdip-black/50 hover:bg-pdip-darkgray p-1.5 rounded border border-red-900/10 hover:border-red-900/35 transition"
                                      title="Lihat Detail Anggota"
                                    >
                                      <Eye size={14} />
                                    </button>

                                    {/* Direct Message Shortcut */}
                                    <button
                                      onClick={() => {
                                        setActiveChatUserId(m.id);
                                        setActiveTab('perpesanan');
                                      }}
                                      className="text-gray-400 hover:text-white bg-pdip-black/50 hover:bg-pdip-darkgray p-1.5 rounded border border-red-900/10 hover:border-red-900/35 transition"
                                      title="Kirim Pesan"
                                    >
                                      <Mail size={14} />
                                    </button>

                                    {/* Direct Report Shortcut */}
                                    <button
                                      onClick={() => {
                                        setNewReportState({
                                          title: '',
                                          category: 'Kegiatan Rutin',
                                          details: '',
                                          photoUrl: '',
                                          targetMemberId: m.id
                                        });
                                        setShowReportModal(true);
                                      }}
                                      className="text-gray-400 hover:text-white bg-pdip-black/50 hover:bg-pdip-darkgray p-1.5 rounded border border-red-900/10 hover:border-red-900/35 transition"
                                      title="Kirim Laporan Khusus"
                                    >
                                      <Award size={14} />
                                    </button>

                                    {/* Existing Delete Member Action */}
                                    {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || isDescendant(m, currentUser.id, members)) && m.id !== currentUser.id ? (
                                      <button
                                        onClick={() => {
                                          if (confirm(`Apakah Anda yakin ingin menghapus ${m.name} dari database?`)) {
                                            if (isDbConnected) {
                                              fetch(`/api/members/${m.id}`, { method: 'DELETE' })
                                                .catch(err => console.error('Error deleting member from database:', err));
                                            }
                                            setMembers(members.filter(member => member.id !== m.id));
                                            pushAuditLog(`Menghapus anggota: ${m.name} (${m.ktaNumber})`);
                                          }
                                        }}
                                        className="text-gray-500 hover:text-red-500 p-1.5 transition"
                                        title="Hapus Anggota"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    ) : (
                                      <span className="text-gray-600 italic">Terkunci</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                              Tidak ada data anggota ditemukan dalam jaringan Anda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Table Pagination Controls */}
                  {totalListPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-red-950/20 bg-pdip-darkgray/25">
                      <button
                        disabled={activeListPage === 1}
                        onClick={() => setListPage(prev => Math.max(prev - 1, 1))}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pdip-darkgray border border-red-900/20 text-gray-400 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition flex items-center gap-1"
                      >
                        Sebelumnya
                      </button>
                      <span className="text-xs text-gray-400 font-medium font-mono">
                        Halaman {activeListPage} dari {totalListPages} ({filteredVisibleMembers.length} Anggota)
                      </span>
                      <button
                        disabled={activeListPage === totalListPages}
                        onClick={() => setListPage(prev => Math.min(prev + 1, totalListPages))}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pdip-darkgray border border-red-900/20 text-gray-400 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition flex items-center gap-1"
                      >
                        Berikutnya
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================== GIS & MAPS VIEW ==================== */}
        {activeTab === 'gis' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="border-b border-red-950/20 pb-6">
              <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                <Map className="text-pdip-red" /> GIS & Pemetaan Spasial Sebaran Kader
              </h2>
              <p className="text-xs text-gray-400 mt-1">Pemetaan presisi berbasis koordinat GPS rumah anggota hasil rekrutan di Kabupaten Banjarnegara</p>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-4 items-center bg-pdip-metal p-4 rounded-xl border border-red-950/20 shadow-md text-xs">
              <span className="font-bold uppercase tracking-wider text-gray-400">Filter Peta Sebaran:</span>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-purple-600 rounded-full border border-white"></span>
                <span>Super Admin</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-amber-500 rounded-full border border-white"></span>
                <span>Pimpinan DPC</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-red-600 rounded-full border border-white"></span>
                <span>Anggota Dewan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-red-400 rounded-full border border-white"></span>
                <span>Kader / Downline</span>
              </div>
              <button 
                onClick={() => setMapCenter([-7.3996, 109.6976])}
                className="ml-auto bg-pdip-darkgray hover:bg-gray-800 text-white font-semibold px-3 py-1.5 rounded border border-red-900/20 transition flex items-center gap-1"
              >
                <RefreshCw size={12} /> Reset Pusat Peta
              </button>
            </div>

            {/* Map Container */}
            <div className="h-[600px] w-full rounded-xl overflow-hidden shadow-2xl border border-red-900/30">
              <MapContainer 
                center={mapCenter} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {geojsonData && (
                  <GeoJSON 
                    data={geojsonData} 
                    style={{
                      color: '#991B1B', // Border color (Red-800)
                      weight: 1.5,
                      fillColor: '#EF4444', // Fill color (Red-500)
                      fillOpacity: 0.12,
                    }}
                    onEachFeature={(feature, layer) => {
                      const desaName = feature.properties?.Nama_Desa_ || feature.properties?.DESA || feature.properties?.Nama_Desa || '';
                      const kecName = feature.properties?.Kecamatan || feature.properties?.KECAMATAN || '';
                      if (desaName) {
                        layer.bindPopup(`
                          <div class="font-sans text-xs p-1 text-white">
                            <strong class="text-red-400 font-bold block mb-1">${desaName}</strong>
                            <span class="text-gray-400 block">${kecName}</span>
                          </div>
                        `);
                      }
                      
                      // Highlight on hover
                      layer.on({
                        mouseover: (e) => {
                          const l = e.target;
                          l.setStyle({
                            fillColor: '#F59E0B', // Amber-500 highlight
                            fillOpacity: 0.35,
                            weight: 2
                          });
                        },
                        mouseout: (e) => {
                          const l = e.target;
                          l.setStyle({
                            fillColor: '#EF4444',
                            fillOpacity: 0.12,
                            weight: 1.5
                          });
                        }
                      });
                    }}
                  />
                )}
                <MapCenterController center={mapCenter} />
                {visibleMembersList.map((m) => {
                  let jitterLat = 0;
                  let jitterLng = 0;
                  if (m.id.startsWith('dpt-') || m.role === 'anggota') {
                    // Deterministic offset based on ID character values
                    const charSum = m.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + m.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    jitterLat = (((charSum % 40) - 20) * 0.0006); // range between -0.012 and +0.012 degrees
                    jitterLng = ((((charSum * 3) % 40) - 20) * 0.0006);
                  }

                  return (
                    <Marker 
                      key={m.id} 
                      position={[m.lat + jitterLat, m.lng + jitterLng]} 
                      icon={createCustomMarker(m.role)}
                    >
                      <Popup>
                        <div className="w-56 font-sans">
                          <div className="flex items-center gap-2 mb-2 border-b border-red-900/10 pb-2">
                            <img 
                              src={m.photoUrl} 
                              alt={m.name} 
                              className="w-10 h-10 rounded-full object-cover border border-red-900/20"
                            />
                            <div>
                              <h4 className="font-bold text-sm text-white leading-tight">{m.name}</h4>
                              <span className="text-[10px] text-red-500 font-mono font-bold block">{m.ktaNumber}</span>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs text-gray-300">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Jabatan:</span>
                              <span className="font-semibold text-white">{m.role.toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Kecamatan:</span>
                              <span className="font-semibold text-white">{m.kecamatan}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Desa:</span>
                              <span className="font-semibold text-white">{m.desa}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">TPS:</span>
                              <span className="font-semibold text-red-400">{m.tps}</span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        )}

        {/* ==================== KADERISASI & E-LEARNING ==================== */}
        {activeTab === 'kaderisasi' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="border-b border-red-950/20 pb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                  <BookOpen className="text-pdip-red" /> Kaderisasi & E-Learning Marhaenisme
                </h2>
                <p className="text-xs text-gray-400 mt-1">Materi dasar pemahaman ideologi partai dan strategi rekrutmen jaringan</p>
              </div>
            </div>
                {!quizStarted && !showCertificate ? (
               selectedModule ? (
                 /* Module Detail View */
                 <div className="bg-pdip-metal p-8 rounded-xl border border-red-900/35 space-y-6 shadow-xl animate-fadeIn max-w-4xl mx-auto">
                   <div className="flex justify-between items-center border-b border-red-950/20 pb-4">
                     <span className="text-xs bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded border border-red-900/50 uppercase">
                       {selectedModule === 'marhaenisme' ? 'Ideologi Partai' : 'Strategi Pemenangan'}
                     </span>
                     <button
                       onClick={() => setSelectedModule(null)}
                       className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded bg-pdip-darkgray hover:bg-gray-800 transition"
                     >
                       ← Kembali ke Kelas
                     </button>
                   </div>

                   {selectedModule === 'marhaenisme' ? (
                     <div className="space-y-4 leading-relaxed text-sm text-gray-300 font-sans">
                       <h3 className="text-2xl font-black text-white font-serif border-b border-red-900/25 pb-2">Ajaran Marhaenisme & Ajaran Bung Karno</h3>
                       
                       <p>
                         <strong>Marhaenisme</strong> adalah asas perjuangan yang menghendaki hilangnya kapitalisme dan imperialisme, serta terwujudnya masyarakat adil makmur di mana tidak ada eksploitasi manusia atas manusia (*l'exploitation de l'homme par l'homme*). Istilah ini pertama kali dicetuskan oleh Bung Karno terinspirasi dari percakapannya dengan seorang petani kecil bernama Pak Marhaen di Bandung Selatan.
                       </p>

                       <h4 className="text-white font-bold text-base mt-4">1. Tiga Unsur Pokok Marhaenisme</h4>
                       <ul className="list-disc pl-6 space-y-1 text-xs">
                         <li><strong>Sosio-Nasionalisme:</strong> Nasionalisme Indonesia yang berperikemanusiaan, menolak chauvinisme (nasionalisme sempit), dan menempatkan kemerdekaan bangsa sebagai jembatan emas menuju persaudaraan dunia (internasionalisme).</li>
                         <li><strong>Sosio-Demokrasi:</strong> Demokrasi politik yang sejalan dengan demokrasi ekonomi. Kita tidak menghendaki adanya parlemen politik yang merdeka namun diiringi dengan kemiskinan dan kelaparan massal akibat monopoli ekonomi kapitalistik.</li>
                         <li><strong>Ketuhanan yang Maha Esa:</strong> Jiwa keagamaan yang berkebudayaan, saling menghargai perbedaan keyakinan, dan melandasi perjuangan sosial dengan nilai kemanusiaan yang luhur.</li>
                       </ul>

                       <h4 className="text-white font-bold text-base mt-4">2. Doktrin Tri Sakti Bung Karno</h4>
                       <p className="text-xs italic bg-pdip-black/40 border-l-2 border-pdip-gold p-3 rounded text-gray-400">
                         "Bila kita hendak berdaulat di bidang politik, maka kita wajib membangun kemandirian (berdikari) di bidang ekonomi dan memegang erat kepribadian yang berkebudayaan lokal."
                       </p>
                       <p>
                         Doktrin ini menjadi pilar utama kader PDI Perjuangan dalam merumuskan kebijakan publik yang berpihak kepada rakyat kecil (*Wong Cilik*), menjaga kedaulatan tanah air dari dominasi asing, dan menguatkan kebudayaan gotong royong nasional.
                       </p>
                     </div>
                   ) : (
                     <div className="space-y-4 leading-relaxed text-sm text-gray-300 font-sans">
                       <h3 className="text-2xl font-black text-white font-serif border-b border-red-900/25 pb-2">Sistem Perekrutan Jaringan & Peta Pemetaan DPT</h3>
                       
                       <p>
                         Pemenangan pemilu modern tidak lagi mengandalkan kampanye massa tradisional saja, melainkan beralih ke strategi **Micro-Targeting** dan **Multi-Level Member (MLM) Advocacy**. Setiap kader yang direkrut memikul tanggung jawab moral untuk merekrut anggota keluarga terdekat, tetangga, hingga mencapai target pemilih tetap (DPT) per TPS.
                       </p>

                       <h4 className="text-white font-bold text-base mt-4">1. Skema Rekrutmen Jaringan Berjenjang</h4>
                       <ul className="list-disc pl-6 space-y-1 text-xs">
                         <li><strong>Korcam (Koordinator Kecamatan):</strong> Mengkoordinir struktur ketua ranting (desa) dan memetakan logistik zona kecamatan.</li>
                         <li><strong>Ketua Ranting (Koordinator Desa):</strong> Membentuk posko pemenangan desa, mengawasi pendaftaran pemilih tetap, dan menentukan koordinator TPS.</li>
                         <li><strong>Relawan Saksi TPS:</strong> Mengunci minimal 5 orang pemilih tetap (DPT) militan di lingkungan sekitar TPS untuk diarahkan ke bilik suara, serta mengawal formulir C1 Plano.</li>
                       </ul>

                       <h4 className="text-white font-bold text-base mt-4">2. Teknik Pemetaan Spasial GIS</h4>
                       <p>
                         Melalui aplikasi GIS ini, setiap rekrutan DPT diverifikasi posisi koordinat GPS rumah tinggalnya. Langkah ini berfungsi untuk meminimalkan klaim suara ganda, mendeteksi zona buta suara (*blank spot*), dan mendistribusikan alat peraga kampanye (APK) secara terukur tepat sasaran langsung ke pintu-pintu pemilih.
                       </p>
                     </div>
                   )}

                   <div className="pt-4 border-t border-red-950/20 flex justify-end">
                     <button
                       onClick={() => {
                         setSelectedModule(null);
                         setQuizStarted(true);
                         setQuizScore(null);
                       }}
                       className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition"
                     >
                       Selesai Membaca & Mulai Ujian Kuis →
                     </button>
                   </div>
                 </div>
               ) : (
                 /* Grid Course List */
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                   {/* Learning Card 1 */}
                   <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 flex flex-col justify-between hover:border-red-900/40 transition">
                     <div className="space-y-3">
                       <span className="text-[10px] bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded border border-red-900/50 uppercase">Ideologi</span>
                       <h3 className="font-bold text-lg text-white">Ajaran Marhaenisme</h3>
                       <p className="text-xs text-gray-405 leading-relaxed">
                         Mempelajari dasar sosio-nasionalisme, sosio-demokrasi serta pilar pemikiran Bung Karno mengenai kemandirian ekonomi perjuangan rakyat.
                       </p>
                     </div>
                     <div className="mt-6 pt-4 border-t border-gray-850 flex items-center justify-between">
                       <button
                         onClick={() => setSelectedModule('marhaenisme')}
                         className="text-xs bg-pdip-darkgray hover:bg-gray-800 text-white font-bold px-3 py-1.5 rounded transition border border-red-900/10"
                       >
                         Baca Materi Lengkap
                       </button>
                       <span className="text-[10px] text-gray-500">Estimasi: 20 Menit</span>
                     </div>
                   </div>

                   {/* Learning Card 2 */}
                   <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 flex flex-col justify-between hover:border-red-900/40 transition">
                     <div className="space-y-3">
                       <span className="text-[10px] bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded border border-red-900/50 uppercase">Strategi</span>
                       <h3 className="font-bold text-lg text-white">Sistem Rekrutmen Jaringan</h3>
                       <p className="text-xs text-gray-405 leading-relaxed">
                         Cara mengembangkan jaringan downline MLM pemenangan secara efektif di tingkat rukun tetangga dan saksi TPS daerah.
                       </p>
                     </div>
                     <div className="mt-6 pt-4 border-t border-gray-850 flex items-center justify-between">
                       <button
                         onClick={() => setSelectedModule('rekrutmen')}
                         className="text-xs bg-pdip-darkgray hover:bg-gray-800 text-white font-bold px-3 py-1.5 rounded transition border border-red-900/10"
                       >
                         Baca Materi Lengkap
                       </button>
                       <span className="text-[10px] text-gray-500">Estimasi: 15 Menit</span>
                     </div>
                   </div>

                   {/* Quiz Card */}
                   <div className="bg-gradient-to-br from-pdip-metal to-pdip-darkred/20 p-6 rounded-xl border border-red-900/30 flex flex-col justify-between shadow-lg">
                     <div className="space-y-3">
                       <span className="text-[10px] bg-pdip-red text-white font-bold px-2 py-0.5 rounded uppercase">Evaluasi</span>
                       <h3 className="font-bold text-lg text-white flex items-center gap-2"><Award className="text-pdip-gold" /> Uji Pemahaman Ideologi</h3>
                       <p className="text-xs text-gray-300 leading-relaxed">
                         Selesaikan ujian singkat ideologi partai dengan skor sempurna (100%) untuk menerbitkan sertifikat kelulusan digital atas nama Anda.
                       </p>
                     </div>
                     <button
                       onClick={() => {
                         setQuizStarted(true);
                         setQuizScore(null);
                       }}
                       className="w-full bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-semibold py-3 rounded-lg mt-6 shadow-md transition"
                     >
                       Mulai Tes Sekarang
                     </button>
                   </div>
                 </div>
               )
             ) : quizStarted ? (
              // Quiz Question Panel
              <div className="max-w-xl mx-auto bg-pdip-metal p-8 rounded-xl border border-red-900/30 space-y-6 shadow-xl">
                {quizScore === null ? (
                  <>
                    <div className="flex justify-between items-center border-b border-red-950/20 pb-4">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pertanyaan {currentQuestionIdx + 1} dari {QUIZ_QUESTIONS.length}</span>
                    </div>

                    <h3 className="text-base font-bold text-white leading-relaxed">
                      {QUIZ_QUESTIONS[currentQuestionIdx].question}
                    </h3>

                    <div className="space-y-3">
                      {QUIZ_QUESTIONS[currentQuestionIdx].options.map((opt, idx) => {
                        const isSelected = selectedAnswers[QUIZ_QUESTIONS[currentQuestionIdx].id] === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswerSelect(QUIZ_QUESTIONS[currentQuestionIdx].id, idx)}
                            className={`w-full text-left p-4 rounded-lg text-sm transition border ${
                              isSelected 
                                ? 'bg-red-950/50 border-pdip-red text-white font-semibold' 
                                : 'bg-pdip-darkgray hover:bg-gray-800 border-red-950/10 text-gray-300'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-red-950/20 mt-6">
                      <button
                        onClick={() => setCurrentQuestionIdx(Math.max(0, currentQuestionIdx - 1))}
                        disabled={currentQuestionIdx === 0}
                        className="text-xs text-gray-400 hover:text-white disabled:opacity-30 font-semibold"
                      >
                        Sebelumnya
                      </button>

                      {currentQuestionIdx < QUIZ_QUESTIONS.length - 1 ? (
                        <button
                          onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                          disabled={selectedAnswers[QUIZ_QUESTIONS[currentQuestionIdx].id] === undefined}
                          className="bg-pdip-darkgray hover:bg-gray-800 text-xs font-semibold px-4 py-2 rounded-lg border border-red-900/10 transition"
                        >
                          Selanjutnya
                        </button>
                      ) : (
                        <button
                          onClick={submitQuiz}
                          disabled={Object.keys(selectedAnswers).length < QUIZ_QUESTIONS.length}
                          className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition"
                        >
                          Kirim Jawaban
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  // Result Panel
                  <div className="text-center space-y-6 py-6">
                    <h3 className="text-xl font-bold text-white">{quizScore === 100 ? 'Selamat! Anda Lulus' : 'Coba Lagi'}</h3>
                    <p className="text-xs text-gray-400">Skor Anda: <strong className="text-red-500">{quizScore}%</strong></p>

                    {quizScore === 100 ? (
                      <div className="space-y-4">
                        <input 
                          type="text" 
                          placeholder="Masukkan nama Anda..."
                          value={candidateName}
                          onChange={(e) => setCandidateName(e.target.value)}
                          className="w-full bg-pdip-black border border-red-900/30 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-pdip-red"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Harap ulas kembali materi dan capai skor 100% untuk sertifikat.</p>
                    )}

                    <div className="flex gap-4 justify-center">
                      <button onClick={resetQuiz} className="bg-pdip-darkgray hover:bg-gray-800 text-xs font-semibold px-4 py-2.5 rounded-lg transition">
                        Ulangi Kuis
                      </button>
                      {quizScore === 100 && candidateName && (
                        <button
                          onClick={() => setShowCertificate(true)}
                          className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition"
                        >
                          Lihat Sertifikat
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Certificate Panel
              <div className="max-w-3xl mx-auto bg-white text-black p-12 rounded-lg border-8 border-double border-red-700 shadow-2xl relative select-none animate-fadeIn font-serif text-center">
                <h1 className="text-xl font-bold text-red-700">DPC PDI PERJUANGAN BANJARNEGARA</h1>
                <h2 className="text-2xl font-black text-black mt-2">SERTIFIKAT KADER PRATAMA</h2>
                <h3 className="text-3xl font-bold underline text-black my-8">{candidateName}</h3>
                <p className="text-xs text-gray-600 max-w-lg mx-auto font-sans leading-relaxed">
                  Telah menyelesaikan ujian pemahaman ideologi Marhaenisme secara digital dengan skor sempurna (100%).
                </p>
                <div className="mt-12 flex justify-center gap-4">
                  <button onClick={resetQuiz} className="bg-gray-900 hover:bg-black text-white text-xs font-sans px-4 py-2 rounded">Kembali</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== LOGISTIK VIEW ==================== */}
        {activeTab === 'logistik' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/20 pb-6">
              <div>
                <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                  <Truck className="text-pdip-red" /> Logistik & Distribusi APK
                </h2>
                <p className="text-xs text-gray-400 mt-1">Pengajuan logistik kampanye, pengelolaan stok inventaris, dan riwayat mutasi</p>
              </div>
              <div className="flex items-center gap-3">
                {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik') && (
                  <button
                    onClick={() => {
                      setStockItemId(logistics[0]?.id || '');
                      setStockMutationType('stock_in');
                      setStockQuantity(0);
                      setStockNotes('');
                      setShowStockMutationModal(true);
                    }}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
                  >
                    <Plus size={16} /> Catat Mutasi Stok
                  </button>
                )}
                <button
                  onClick={() => setShowLogisticsModal(true)}
                  className="bg-pdip-red hover:bg-pdip-brightred text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
                >
                  <Plus size={16} /> Ajukan Logistik
                </button>
              </div>
            </div>

            {/* Warehouse Stock Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {logistics.map((l) => (
                <div key={l.id} className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md space-y-2">
                  <span className="text-[10px] bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded uppercase">{l.category}</span>
                  <h3 className="font-bold text-sm text-white truncate">{l.name}</h3>
                  <div className="pt-2 border-t border-gray-850 flex justify-between items-baseline">
                    <span className="text-xs text-gray-500">Stok:</span>
                    <span className="text-lg font-black text-white">{l.stock.toLocaleString()} Pcs</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Orders list */}
            <div className="bg-pdip-metal rounded-xl border border-red-950/20 overflow-hidden shadow-md">
              <div className="p-5 border-b border-red-950/20">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Pengajuan Logistik Wilayah Kerja</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-pdip-darkgray text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-red-950/20">
                      <th className="px-6 py-4">Pemohon</th>
                      <th className="px-6 py-4">Item & Jumlah</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-950/10 text-sm">
                    {orders.filter(o => {
                      if (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik') return true;
                      if (currentUser.role === 'korcam') return o.kecamatan === currentUser.kecamatan;
                      if (currentUser.role === 'ketua_ranting') return o.kecamatan === currentUser.kecamatan && o.desa === currentUser.desa;
                      return o.requesterName === currentUser.name;
                    }).map((o) => (
                      <tr key={o.id} className="hover:bg-pdip-darkgray/30 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">{o.requesterName}</div>
                          <div className="text-xs text-gray-400">{o.kecamatan} ➔ {o.desa}</div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-200">
                          {o.itemName} <span className="text-red-400">({o.quantity} Pcs)</span>
                        </td>
                        <td className="px-6 py-4 uppercase text-xs font-bold text-red-500">
                          {o.status}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex gap-2 justify-end">
                            {currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik' || (currentUser.role === 'korcam' && o.status === 'draft') ? (
                              <>
                                {o.status === 'draft' && (
                                  <button onClick={() => handleUpdateOrderStatus(o.id, 'approved')} className="bg-amber-600 hover:bg-amber-500 text-[10px] font-bold px-2.5 py-1 rounded">Setujui</button>
                                )}
                                {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik') && o.status === 'approved' && (
                                  <button onClick={() => handleUpdateOrderStatus(o.id, 'packed')} className="bg-blue-600 hover:bg-blue-500 text-[10px] font-bold px-2.5 py-1 rounded">Kemas</button>
                                )}
                                {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik') && o.status === 'packed' && (
                                  <button onClick={() => handleUpdateOrderStatus(o.id, 'shipped')} className="bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold px-2.5 py-1 rounded">Kirim</button>
                                )}
                                {o.status === 'shipped' && (o.requesterName === currentUser.name || currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik') && (
                                  <button onClick={() => handleUpdateOrderStatus(o.id, 'received')} className="bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold px-2.5 py-1 rounded">Terima</button>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-500">No Action</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mutation history (Only visible to admin & leaders) */}
            {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik') && (
              <div className="bg-pdip-metal rounded-xl border border-red-950/20 overflow-hidden shadow-md">
                <div className="p-5 border-b border-red-950/20 flex justify-between items-center">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Riwayat Aliran Mutasi Stok</h3>
                  <span className="text-xs text-gray-400 font-mono">Pencatatan Masuk/Keluar Manual</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-pdip-darkgray text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-red-950/20">
                        <th className="px-6 py-4">Waktu</th>
                        <th className="px-6 py-4">Nama Item</th>
                        <th className="px-6 py-4">Tipe</th>
                        <th className="px-6 py-4">Jumlah</th>
                        <th className="px-6 py-4">Pencatat</th>
                        <th className="px-6 py-4">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-950/10 text-sm">
                      {stockHistory.map((sh) => (
                        <tr key={sh.id} className="hover:bg-pdip-darkgray/30 transition">
                          <td className="px-6 py-4 text-xs font-mono text-gray-400">{sh.date}</td>
                          <td className="px-6 py-4 font-bold text-white">{sh.itemName}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                              sh.type === 'stock_in' 
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' 
                                : 'bg-red-950/40 text-red-400 border-red-900/30'
                            }`}>
                              {sh.type === 'stock_in' ? 'Masuk ➔' : '➔ Keluar'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-black text-gray-200">
                            {sh.quantity.toLocaleString()} Pcs
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-300">{sh.submitterName}</td>
                          <td className="px-6 py-4 text-xs text-gray-400 italic max-w-xs truncate">{sh.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== DANA OPERASIONAL VIEW ==================== */}
        {activeTab === 'pendanaan' && (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'admin_logistik') && (
          <div className="space-y-8 animate-fadeIn text-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/20 pb-6">
              <div>
                <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                  <Coins className="text-pdip-red" /> Dana Operasional & Pemenangan
                </h2>
                <p className="text-xs text-gray-400 mt-1">Manajemen pendanaan gotong royong, kampanye, sosialisasi, dan pembuatan media</p>
              </div>
              <button
                onClick={() => {
                  setFundType('expense');
                  setFundCategory('Kegiatan');
                  setFundAmount(0);
                  setFundTitle('');
                  setFundDescription('');
                  setShowFundModal(true);
                }}
                className="bg-pdip-red hover:bg-pdip-brightred text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
              >
                <Plus size={16} /> Catat Transaksi Keuangan
              </button>
            </div>

            {/* Financial Summary Cards */}
            {(() => {
              const totalIncome = funds.filter(f => f.type === 'income').reduce((sum, f) => sum + f.amount, 0);
              const totalExpense = funds.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
              const balance = totalIncome - totalExpense;

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase font-mono">Pemasukan Kas</span>
                    <p className="text-2xl font-black text-emerald-500 mt-2">Rp {totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
                    <span className="text-[10px] bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded uppercase font-mono">Pengeluaran Kas</span>
                    <p className="text-2xl font-black text-red-500 mt-2">Rp {totalExpense.toLocaleString()}</p>
                  </div>
                  <div className="bg-pdip-metal p-5 rounded-xl border border-red-900/30 shadow-md border-b-2 border-pdip-red">
                    <span className="text-[10px] bg-pdip-red text-white font-bold px-2 py-0.5 rounded uppercase font-mono">Saldo Kas Aktual</span>
                    <p className="text-2xl font-black text-white mt-2">Rp {balance.toLocaleString()}</p>
                  </div>
                </div>
              );
            })()}

            {/* Charts & Summary Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Category Breakdown Pie Chart */}
              <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 shadow-md space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 border-b border-red-950/10 pb-3">Proporsi Pengeluaran Dana</h3>
                {(() => {
                  const expensesByCategory = funds
                    .filter(f => f.type === 'expense')
                    .reduce((acc, f) => {
                      acc[f.category] = (acc[f.category] || 0) + f.amount;
                      return acc;
                    }, {} as Record<string, number>);

                  const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({
                    name,
                    value
                  }));

                  const COLORS = ['#D32F2F', '#F59E0B', '#1E3A8A', '#10B981', '#6B7280'];

                  if (pieData.length === 0) {
                    return (
                      <div className="h-64 flex items-center justify-center text-xs text-gray-500 italic">
                        Belum ada data pengeluaran kas.
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col items-center">
                      <div className="w-full h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: any) => `Rp ${value.toLocaleString()}`}
                              contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] w-full mt-4">
                        {pieData.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 truncate">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="text-gray-400 truncate">{entry.name}:</span>
                            <strong className="text-white">Rp {entry.value.toLocaleString()}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Transactions List */}
              <div className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 shadow-md lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center border-b border-red-950/10 pb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Riwayat Mutasi Arus Kas</h3>
                  <span className="text-xs text-gray-500 font-mono">Total: {funds.length} Transaksi</span>
                </div>
                <div className="overflow-y-auto max-h-[320px] space-y-3 pr-1">
                  {funds.map((f) => (
                    <div key={f.id} className="p-4 bg-pdip-darkgray/40 border border-red-950/10 rounded-xl flex items-center justify-between hover:border-red-900/35 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            f.type === 'income' 
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' 
                              : 'bg-red-950/40 text-red-400 border-red-900/30'
                          }`}>
                            {f.type === 'income' ? 'Masuk' : 'Keluar'}
                          </span>
                          <span className="text-xs font-bold text-white">{f.title}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 max-w-md line-clamp-1">{f.description || '-'}</p>
                        <div className="flex gap-3 text-[9px] text-gray-500">
                          <span>Kategori: <strong>{f.category}</strong></span>
                          <span>Tanggal: <strong>{f.date}</strong></span>
                          <span>Pencatat: <strong>{f.submitterName}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-black text-sm ${f.type === 'income' ? 'text-emerald-500' : 'text-white'}`}>
                          {f.type === 'income' ? '+' : '-'} Rp {f.amount.toLocaleString()}
                        </span>
                        {(currentUser.role === 'super_admin' || currentUser.role === 'admin_logistik') && (
                          <button 
                            onClick={() => handleDeleteFund(f.id)}
                            className="text-gray-500 hover:text-red-500 p-1.5 rounded bg-pdip-black/20 hover:bg-red-950/10 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ASPIRASI VIEW ==================== */}
        {activeTab === 'aspirasi' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/20 pb-6">
              <div>
                <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                  <MessageSquare className="text-pdip-red" /> Aspirasi Warga & DPRD
                </h2>
                <p className="text-xs text-gray-400 mt-1">Layanan aduan masyarakat Banjarnegara ke legislatif Fraksi PDI Perjuangan</p>
              </div>
              <button
                onClick={() => setShowAspirationModal(true)}
                className="bg-pdip-red hover:bg-pdip-brightred text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
              >
                <Plus size={16} /> Kirim Aspirasi
              </button>
            </div>

            {/* Aspirations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {aspirations.filter(a => {
                if (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'anggota_dewan') return true;
                if (currentUser.role === 'korcam') return a.kecamatan === currentUser.kecamatan;
                if (currentUser.role === 'ketua_ranting') return a.kecamatan === currentUser.kecamatan && a.desa === currentUser.desa;
                return false;
              }).map((a) => (
                <div key={a.id} className="bg-pdip-metal p-6 rounded-xl border border-red-950/20 shadow-md space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-base text-white">{a.title}</h3>
                      <p className="text-xs text-gray-400 mt-1">Pengirim: {a.reporterName} ({a.kecamatan} ➔ {a.desa})</p>
                    </div>
                    <span className="text-[10px] bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded">{a.status.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-gray-400 bg-pdip-black/35 p-3 rounded leading-relaxed">{a.description}</p>
                  {a.dewanResponse && (
                    <div className="p-3 bg-red-950/10 border-l-2 border-pdip-red rounded text-xs text-gray-300">
                      <strong className="text-red-400 block font-serif">Tanggapan Dewan:</strong>
                      <p className="italic">"{a.dewanResponse}"</p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-850 flex justify-between items-center text-xs text-gray-500">
                    <span>Masuk: {a.date}</span>
                    {a.status !== 'resolved' && (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'anggota_dewan') && (
                      <button
                        onClick={() => {
                          setRespondingAspirationId(a.id);
                          setDewanResponseText(a.dewanResponse || '');
                        }}
                        className="bg-pdip-red hover:bg-pdip-brightred text-white font-bold px-3 py-1.5 rounded transition flex items-center gap-1"
                      >
                        Tanggapi
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TPS & QUICK COUNT C1 VIEW ==================== */}
        {activeTab === 'quickcount' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/20 pb-6">
              <div>
                <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                  <RefreshCw className="text-pdip-red" /> TPS & Quick Count C1
                </h2>
                <p className="text-xs text-gray-400 mt-1">Unggah formulir C1 perolehan suara TPS di wilayah tugas Anda</p>
              </div>
              <button
                onClick={() => setShowC1Modal(true)}
                className="bg-pdip-red hover:bg-pdip-brightred text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
              >
                <Upload size={16} /> Unggah C1 TPS
              </button>
            </div>

            {/* Quick Count Total Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Suara Masuk</p>
                <p className="text-2xl font-black text-white mt-2">{totalQC.toLocaleString()} Suara</p>
              </div>
              <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
                <p className="text-xs text-gray-400">{candidateNames.c1}</p>
                <p className="text-xl font-bold text-gray-300 mt-2">{totalQC > 0 ? ((qcTotals.c1 / totalQC) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="bg-pdip-metal p-5 rounded-xl border border-red-900/30 shadow-md border-b-2 border-pdip-red">
                <p className="text-xs text-red-400 font-bold">{candidateNames.c2}</p>
                <p className="text-2xl font-black text-red-500 mt-2">{totalQC > 0 ? ((qcTotals.c2 / totalQC) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
                <p className="text-xs text-gray-400">{candidateNames.c3}</p>
                <p className="text-xl font-bold text-yellow-400 mt-2">{totalQC > 0 ? ((qcTotals.c3 / totalQC) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>

            {/* C1 Photo Submissions Gallery */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300 border-b border-red-950/20 pb-3">Daftar C1 TPS Terunggah</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {quickCounts.filter(qc => {
                  if (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') return true;
                  if (currentUser.role === 'korcam') return qc.kecamatan === currentUser.kecamatan;
                  if (currentUser.role === 'ketua_ranting') return qc.kecamatan === currentUser.kecamatan;
                  return qc.submittedBy === currentUser.name;
                }).map((qc, i) => (
                  <div key={i} className="bg-pdip-metal rounded-xl overflow-hidden border border-red-950/20 shadow-md">
                    <div className="h-40 overflow-hidden relative">
                      <img src={qc.c1PhotoUrl} alt="" className="w-full h-full object-cover" />
                      <span className="absolute bottom-2 left-2 bg-pdip-black/80 text-[10px] text-white px-2 py-0.5 rounded font-mono">{qc.timestamp}</span>
                    </div>
                    <div className="p-4 space-y-2">
                      <h4 className="font-bold text-sm text-white">{qc.tps}</h4>
                      <p className="text-[10px] text-gray-400">{qc.kecamatan}</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-gray-850">
                        <div className="bg-pdip-darkgray p-1 rounded"><span className="text-[9px] text-gray-500 block">P1</span><strong>{qc.candidate1Votes}</strong></div>
                        <div className="bg-red-950/30 p-1 rounded border border-red-900/10"><span className="text-[9px] text-red-400 block">PDIP</span><strong className="text-red-500">{qc.candidate2Votes}</strong></div>
                        <div className="bg-pdip-darkgray p-1 rounded"><span className="text-[9px] text-gray-500 block">P3</span><strong>{qc.candidate3Votes}</strong></div>
                      </div>
                      <div className="text-[9px] text-gray-500 text-right pt-2">Saksi: {qc.submittedBy}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== SYSTEM SETTINGS VIEW (SUPER ADMIN ONLY) ==================== */}
        {activeTab === 'pengaturan' && currentUser.role === 'super_admin' && (
          <div className="space-y-8 animate-fadeIn text-sm">
            <div className="border-b border-purple-950/20 pb-6">
              <h2 className="text-2xl font-bold font-serif text-purple-400 flex items-center gap-2">
                <Settings /> Pengaturan Sistem & Otoritas Aplikasi
              </h2>
              <p className="text-xs text-gray-400 mt-1">Konfigurasi variabel global, IP whitelist OpenSID, dan pemantauan aktivitas audit sistem.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Configuration panel */}
              <div className="bg-pdip-metal p-6 rounded-xl border border-purple-950/25 space-y-6 lg:col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 border-b border-purple-950/20 pb-2">Konfigurasi Global</h3>
                
                {/* 1. Candidate Names configuration */}
                <div className="space-y-3">
                  <label className="text-xs text-gray-300 font-bold block">Nama Calon / Pasangan Calon (Quick Count):</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-500 block">Paslon 1</span>
                      <input 
                        type="text" 
                        value={candidateNames.c1} 
                        onChange={(e) => setCandidateNames({ ...candidateNames, c1: e.target.value })}
                        className="w-full bg-pdip-black border border-purple-900/30 rounded p-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-red-400 font-bold block">Paslon 2 (PDIP/Usungan)</span>
                      <input 
                        type="text" 
                        value={candidateNames.c2} 
                        onChange={(e) => setCandidateNames({ ...candidateNames, c2: e.target.value })}
                        className="w-full bg-pdip-black border border-red-900/40 rounded p-2 text-xs text-white font-bold focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-500 block">Paslon 3</span>
                      <input 
                        type="text" 
                        value={candidateNames.c3} 
                        onChange={(e) => setCandidateNames({ ...candidateNames, c3: e.target.value })}
                        className="w-full bg-pdip-black border border-purple-900/30 rounded p-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. OpenSID integration */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-300 font-bold block">Whitelist IP Sinkronisasi DPT OpenSID:</label>
                  <input 
                    type="text" 
                    value={opensidIP} 
                    onChange={(e) => setOpensidIP(e.target.value)}
                    className="w-full max-w-xs bg-pdip-black border border-purple-900/30 rounded p-2.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-gray-500 block">Hanya IP di atas yang diperbolehkan mengirim webhook sync data kependudukan OpenSID.</span>
                </div>

                {/* 3. Maintenance Toggle */}
                <div className="flex items-center justify-between p-4 bg-purple-950/10 border border-purple-900/20 rounded-lg">
                  <div>
                    <strong className="text-white block text-xs">Aktifkan Mode Maintenance Aplikasi</strong>
                    <span className="text-[10px] text-gray-400">Kunci semua akses tulis bagi pengguna tingkat Korcam/Ranting/Relawan.</span>
                  </div>
                  <button
                    onClick={() => {
                      setMaintenanceMode(!maintenanceMode);
                      pushAuditLog(`Mengubah status mode maintenance menjadi: ${!maintenanceMode}`);
                    }}
                    className={`px-4 py-2 rounded font-bold text-xs transition ${
                      maintenanceMode ? 'bg-purple-600 text-white' : 'bg-pdip-darkgray text-gray-400'
                    }`}
                  >
                    {maintenanceMode ? 'MAINTENANCE AKTIF' : 'NON-AKTIF'}
                  </button>
                </div>

                {/* 4. Reset database mock data */}
                <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-lg flex justify-between items-center">
                  <div>
                    <strong className="text-red-400 block text-xs">Reset Semua Data Aplikasi</strong>
                    <span className="text-[10px] text-gray-500">Menghapus semua perubahan local storage dan mengembalikan data awal.</span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Apakah Anda yakin ingin menghapus data dan mereset sistem?")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="bg-red-700 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded transition"
                  >
                    Reset Data
                  </button>
                </div>
              </div>

              {/* Audit trail logs */}
              <div className="bg-pdip-metal p-6 rounded-xl border border-purple-950/25 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 border-b border-purple-950/20 pb-2 flex items-center gap-2">
                  <ListCollapse size={16} /> Audit Trail & System Log
                </h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {auditLogs.map((log, index) => (
                    <div key={index} className="p-2.5 bg-pdip-black/40 rounded border border-purple-950/10 text-xs">
                      <div className="flex justify-between text-[10px] text-purple-400 font-mono">
                        <span>{log.time}</span>
                        <strong>{log.user}</strong>
                      </div>
                      <p className="text-gray-300 mt-1">{log.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ==================== STATISTIK & ANALITIK VIEW ==================== */}
        {activeTab === 'analitik' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                <BarChart3 className="text-pdip-red" /> Statistik & Analitik Kepartaian
              </h2>
              <p className="text-xs text-gray-400 mt-1">Pemetaan sebaran suara, target pemenangan, rasio saksi TPS, dan pertumbuhan kader per kecamatan</p>
            </div>

            {/* Regional Analytics Selector and Detailed Panel */}

            <KecamatanAnalyticsSection 
              members={members} 
              setMembers={setMembers}
              pushAuditLog={pushAuditLog}
              rantingProposals={rantingProposals}
              setRantingProposals={setRantingProposals}
              currentUser={currentUser}
              quickCounts={quickCounts}
              candidateNames={candidateNames}
              isDbConnected={isDbConnected}
            />
          </div>
        )}

        {/* ==================== DEDICATED DPT LIST VIEW ==================== */}
        {activeTab === 'dpt' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="border-b border-red-950/20 pb-6">
              <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                <ListCollapse className="text-pdip-red" /> Daftar DPT (Daftar Pemilih Tetap) Wilayah
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Menampilkan data pemilih tetap per kecamatan se-Kabupaten Banjarnegara berserta info afiliasi politiknya.
              </p>
            </div>

            {/* DPT Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Total DPT', value: members.filter(m => m.id.startsWith('dpt-') || m.partyAffiliation).length, color: 'text-white' },
                { label: 'PDI Perjuangan', value: members.filter(m => m.partyAffiliation === 'PDI Perjuangan').length, color: 'text-red-500' },
                { label: 'Golkar', value: members.filter(m => m.partyAffiliation === 'Golkar').length, color: 'text-yellow-500' },
                { label: 'PKB', value: members.filter(m => m.partyAffiliation === 'PKB').length, color: 'text-emerald-500' },
                { label: 'Demokrat/Gerindra', value: members.filter(m => m.partyAffiliation === 'Demokrat' || m.partyAffiliation === 'Gerindra').length, color: 'text-blue-400' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-pdip-metal p-4 rounded-xl border border-red-950/20 text-center shadow-md">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{stat.label}</span>
                  <span className={`text-2xl font-black font-serif mt-1 block ${stat.color}`}>{stat.value} <span className="text-xs font-normal text-gray-500">Orang</span></span>
                </div>
              ))}
            </div>

            {/* DPT Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
              <div className="relative md:col-span-2">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Cari DPT berdasarkan nama, NIK, No. Telepon..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full bg-pdip-black text-sm text-white pl-10 pr-4 py-2.5 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                />
              </div>
              
              <div>
                <select
                  value={filterKecamatan}
                  onChange={(e) => {
                    setFilterKecamatan(e.target.value);
                    setFilterDesa('');
                  }}
                  className="w-full bg-pdip-black text-sm text-white px-3 py-2.5 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                >
                  <option value="">Semua Kecamatan</option>
                  {Object.keys(BANJARNEGARA_REGIONS).map((kec) => (
                    <option key={kec} value={kec}>{kec}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterDesa}
                  onChange={(e) => setFilterDesa(e.target.value)}
                  disabled={!filterKecamatan}
                  className="w-full bg-pdip-black text-sm text-white px-3 py-2.5 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red disabled:opacity-50"
                >
                  <option value="">Semua Desa</option>
                  {filterKecamatan && BANJARNEGARA_REGIONS[filterKecamatan].map((des) => (
                    <option key={des} value={des}>{des}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* DPT Table */}
            <div className="bg-pdip-metal rounded-xl border border-red-950/20 overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-pdip-darkgray text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-red-950/20">
                      <th className="px-6 py-4">Nama Lengkap</th>
                      <th className="px-6 py-4">NIK (KTP)</th>
                      <th className="px-6 py-4">Kecamatan ➔ Desa</th>
                      <th className="px-6 py-4">TPS</th>
                      <th className="px-6 py-4">No. HP</th>
                      <th className="px-6 py-4">Afiliasi Politik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-950/10 text-sm">
                    {(() => {
                      const filteredDPT = members
                        .filter(m => (m.id.startsWith('dpt-') || m.partyAffiliation))
                        .filter(m => {
                          const matchesSearch = m.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
                                                m.nik.includes(memberSearch) ||
                                                (m.phone && m.phone.includes(memberSearch));
                          const matchesKecamatan = filterKecamatan ? m.kecamatan === filterKecamatan : true;
                          const matchesDesa = filterDesa ? m.desa === filterDesa : true;
                          return matchesSearch && matchesKecamatan && matchesDesa;
                        });

                      const totalItems = filteredDPT.length;
                      const totalPages = Math.ceil(totalItems / dptItemsPerPage);
                      const paginatedDPT = filteredDPT.slice(
                        (dptCurrentPage - 1) * dptItemsPerPage,
                        dptCurrentPage * dptItemsPerPage
                      );

                      if (totalItems === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                              Tidak ada data DPT ditemukan dengan filter ini.
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <>
                          {paginatedDPT.map((m) => (
                            <tr key={m.id} className="hover:bg-pdip-darkgray/30 transition text-xs">
                              <td className="px-6 py-4">
                                <span className="font-bold text-white block">{m.name}</span>
                              </td>
                              <td className="px-6 py-4 font-mono text-gray-400">
                                {m.nik}
                              </td>
                              <td className="px-6 py-4 text-gray-300">
                                {m.kecamatan} ➔ {m.desa}
                              </td>
                              <td className="px-6 py-4 text-red-400 font-bold">
                                {m.tps}
                              </td>
                              <td className="px-6 py-4 text-gray-400">
                                {m.phone}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2.5 py-0.5 rounded font-bold uppercase text-[9px] border ${
                                  m.partyAffiliation === 'PDI Perjuangan' ? 'bg-red-950 text-red-400 border-red-900/40' :
                                  m.partyAffiliation === 'Golkar' ? 'bg-yellow-950 text-yellow-500 border-yellow-900/40' :
                                  m.partyAffiliation === 'PKB' ? 'bg-emerald-950 text-emerald-400 border-emerald-900/40' :
                                  m.partyAffiliation === 'Demokrat' ? 'bg-blue-950 text-blue-400 border-blue-900/40' :
                                  'bg-zinc-900 text-zinc-400 border-zinc-800/40'
                                }`}>
                                  {m.partyAffiliation || 'Lainnya / Tidak Tahu'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          
                          {/* Pagination Row */}
                          {totalPages > 1 && (
                            <tr>
                              <td colSpan={6} className="px-6 py-4 bg-pdip-darkgray/20 border-t border-red-950/20">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                  <span className="text-xs text-gray-400">
                                    Menampilkan <strong className="text-white">{Math.min(totalItems, (dptCurrentPage - 1) * dptItemsPerPage + 1)}-{Math.min(totalItems, dptCurrentPage * dptItemsPerPage)}</strong> dari <strong className="text-white">{totalItems}</strong> DPT
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      disabled={dptCurrentPage === 1}
                                      onClick={() => setDptCurrentPage(prev => Math.max(1, prev - 1))}
                                      className="px-3 py-1.5 rounded bg-pdip-black border border-red-900/20 text-xs font-semibold text-gray-300 hover:border-pdip-red disabled:opacity-30 disabled:pointer-events-none transition"
                                    >
                                      Sebelumnya
                                    </button>
                                    {Array.from({ length: totalPages }).map((_, idx) => {
                                      const pageNum = idx + 1;
                                      return (
                                        <button
                                          key={pageNum}
                                          onClick={() => setDptCurrentPage(pageNum)}
                                          className={`w-8 h-8 rounded text-xs font-bold transition ${
                                            dptCurrentPage === pageNum
                                              ? 'bg-pdip-red text-white'
                                              : 'bg-pdip-black border border-red-900/20 text-gray-400 hover:border-pdip-red'
                                          }`}
                                        >
                                          {pageNum}
                                        </button>
                                      );
                                    })}
                                    <button
                                      disabled={dptCurrentPage === totalPages}
                                      onClick={() => setDptCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                      className="px-3 py-1.5 rounded bg-pdip-black border border-red-900/20 text-xs font-semibold text-gray-300 hover:border-pdip-red disabled:opacity-30 disabled:pointer-events-none transition"
                                    >
                                      Berikutnya
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== LAPORAN & PERISTIWA VIEW ==================== */}
        {activeTab === 'laporan' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/20 pb-6">
              <div>
                <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                  <Award className="text-pdip-red" /> Laporan & Peristiwa Wilayah
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Kader dapat mengirimkan laporan insiden lapangan, kegiatan rutin, atau peristiwa darurat secara langsung.
                </p>
              </div>
              <button
                onClick={() => setShowReportModal(true)}
                className="bg-pdip-red hover:bg-pdip-brightred text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
              >
                <Plus size={16} /> Buat Laporan Baru
              </button>
            </div>

            {/* Reports List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reports
                .filter(r => {
                  // Super admins & Pimpinan DPC see all reports.
                  if (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') return true;
                  // Direct recipient sees the report.
                  if (r.targetMemberId === currentUser.id) return true;
                  // Korcams see reports in their kecamatan.
                  if (currentUser.role === 'korcam') return r.kecamatan === currentUser.kecamatan;
                  // Others see their own reports.
                  return r.submitterId === currentUser.id;
                })
                .map((r) => (
                  <div key={r.id} className="bg-pdip-metal rounded-xl border border-red-950/20 overflow-hidden shadow-md flex flex-col justify-between animate-fadeIn">
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`inline-flex px-2 py-0.5 rounded font-bold uppercase text-[9px] border ${
                            r.category === 'Insiden' ? 'bg-amber-950 text-amber-400 border-amber-900/30' :
                            r.category === 'Darurat' ? 'bg-red-950 text-red-400 border-red-900/30' :
                            r.category === 'Kegiatan Rutin' ? 'bg-emerald-950 text-emerald-400 border-emerald-900/30' :
                            'bg-zinc-900 text-zinc-400 border-zinc-800/30'
                          }`}>
                            {r.category}
                          </span>
                          <h3 className="font-bold text-base text-white mt-2">{r.title}</h3>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{r.timestamp}</p>
                          
                          {r.targetMemberName && (
                            <span className="text-[10px] bg-purple-950/40 text-purple-400 border border-purple-900/30 px-2 py-0.5 rounded font-semibold mt-2 inline-block">
                              Ditujukan ke: {r.targetMemberName}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed bg-pdip-black/30 p-3.5 rounded">
                        {r.details}
                      </p>
                    </div>

                    {r.photoUrl && (
                      <div className="px-6 pb-6">
                        <span className="text-[10px] text-gray-500 block font-bold mb-1.5 uppercase">Dokumentasi Bukti:</span>
                        <div className="h-44 w-full rounded-lg overflow-hidden border border-red-900/20">
                          <img src={r.photoUrl} alt="Dokumentasi Laporan" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}

                    <div className="bg-pdip-darkgray/30 px-6 py-3 border-t border-red-950/10 flex justify-between items-center text-[10px] text-gray-400">
                      <span>Kecamatan: <strong className="text-white">{r.kecamatan}</strong></span>
                      <span>Oleh: <strong className="text-red-400">{r.submittedBy}</strong></span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ==================== PRIVATE MESSAGING VIEW ==================== */}
        {activeTab === 'perpesanan' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="border-b border-red-950/20 pb-6">
              <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                <Mail className="text-pdip-red" /> Perpesanan Internal
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Kirim pesan langsung ke kader lain. {currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' ? 'Sebagai Admin, Anda dapat memantau seluruh riwayat perpesanan di bawah.' : 'Seluruh komunikasi dipantau oleh Admin DPC.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
              {/* Member Contact List */}
              <div className="bg-pdip-metal rounded-xl border border-red-950/20 overflow-hidden shadow-md flex flex-col">
                {/* Search & Filters Header */}
                <div className="p-4 border-b border-red-950/20 bg-pdip-black/20 space-y-3">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Kontak Kader</span>
                  
                  {/* Search bar */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      placeholder="Cari kader..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="w-full bg-pdip-black text-xs text-white pl-8 pr-3 py-2 border border-red-900/10 rounded focus:outline-none focus:border-pdip-red"
                    />
                  </div>

                  {/* Filters Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={contactFilterRole}
                      onChange={(e) => setContactFilterRole(e.target.value)}
                      className="bg-pdip-black text-[10px] text-gray-300 p-1.5 border border-red-900/10 rounded focus:outline-none focus:border-pdip-red"
                    >
                      <option value="">Semua Jabatan</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="pimpinan_dpc">Pimpinan DPC</option>
                      <option value="korcam">Korcam</option>
                      <option value="ketua_ranting">Ketua Ranting</option>
                      <option value="anggota_dewan">Anggota Dewan</option>
                      <option value="bapilu">Bapilu</option>
                      <option value="relawan_terdaftar">Relawan</option>
                      <option value="anggota">Anggota</option>
                    </select>

                    <select
                      value={contactFilterKecamatan}
                      onChange={(e) => setContactFilterKecamatan(e.target.value)}
                      className="bg-pdip-black text-[10px] text-gray-300 p-1.5 border border-red-900/10 rounded focus:outline-none focus:border-pdip-red"
                    >
                      <option value="">Semua Wilayah</option>
                      {Object.keys(BANJARNEGARA_REGIONS).map((kec) => (
                        <option key={kec} value={kec}>{kec}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto divide-y divide-red-950/10">
                  {(() => {
                    const filteredContacts = members
                      .filter(m => m.id !== currentUser.id)
                      .filter(m => {
                        const matchesSearch = m.name.toLowerCase().includes(contactSearch.toLowerCase());
                        const matchesRole = !contactFilterRole || m.role === contactFilterRole;
                        const matchesKecamatan = !contactFilterKecamatan || m.kecamatan === contactFilterKecamatan;
                        return matchesSearch && matchesRole && matchesKecamatan;
                      });

                    if (filteredContacts.length === 0) {
                      return (
                        <div className="p-6 text-center text-xs text-gray-500 italic">
                          Tidak ada kontak yang cocok.
                        </div>
                      );
                    }

                    return filteredContacts.map((m) => {
                      const isSelected = activeChatUserId === m.id;
                      
                      // Count unread messages from this specific contact
                      const contactUnreadCount = messages.filter(
                        msg => msg.senderId === m.id && msg.receiverId === currentUser.id && !msg.read
                      ).length;

                      // Find the last message between currentUser and contact
                      const contactMessages = messages.filter(
                        msg => (msg.senderId === currentUser.id && msg.receiverId === m.id) ||
                               (msg.senderId === m.id && msg.receiverId === currentUser.id)
                      );
                      const lastMsg = contactMessages[contactMessages.length - 1];

                      return (
                        <button
                          key={m.id}
                          onClick={() => setActiveChatUserId(m.id)}
                          className={`w-full text-left p-3.5 flex items-start gap-3 transition ${
                            isSelected ? 'bg-red-950/20 border-r-4 border-pdip-red' : 'hover:bg-pdip-darkgray/30'
                          }`}
                        >
                          <div className="relative shrink-0">
                            <img src={m.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-red-900/20" />
                            {isTyping && typingUserId === m.id && (
                              <span className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-pdip-metal flex items-center justify-center animate-bounce">
                                <span className="w-1 h-1 bg-white rounded-full"></span>
                              </span>
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-baseline gap-1.5">
                              <span className="font-bold text-xs text-white truncate block">{m.name}</span>
                              {lastMsg && (
                                <span className="text-[8px] text-gray-500 shrink-0 font-mono">
                                  {lastMsg.timestamp.slice(11) || lastMsg.timestamp}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] text-gray-400 bg-pdip-black/50 px-1.5 py-0.5 rounded border border-red-900/10 uppercase tracking-wide">
                                {m.role.replace('_', ' ')}
                              </span>
                              {contactUnreadCount > 0 && (
                                <span className="bg-pdip-red text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 border border-red-950">
                                  {contactUnreadCount}
                                </span>
                              )}
                            </div>

                            {/* Last Message Preview */}
                            {lastMsg ? (
                              <p className={`text-[10px] truncate mt-1.5 ${
                                contactUnreadCount > 0 ? 'text-red-400 font-bold' : 'text-gray-500'
                              }`}>
                                {lastMsg.senderId === currentUser.id ? 'Anda: ' : ''}
                                {lastMsg.content}
                              </p>
                            ) : (
                              <p className="text-[10px] text-gray-600 italic mt-1.5">
                                Belum ada obrolan
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Active Conversation and Send Msg */}
              <div className="lg:col-span-2 bg-pdip-metal rounded-xl border border-red-950/20 overflow-hidden shadow-md flex flex-col justify-between">
                {activeChatUserId ? (
                  (() => {
                    const activeChatUser = members.find(m => m.id === activeChatUserId);
                    if (!activeChatUser) return null;

                    // Filter messages between currentUser and activeChatUser
                    const chatHistory = messages.filter(msg => 
                      (msg.senderId === currentUser.id && msg.receiverId === activeChatUser.id) ||
                      (msg.senderId === activeChatUser.id && msg.receiverId === currentUser.id)
                    );

                    return (
                      <>
                        {/* Chat Header */}
                        <div className="bg-pdip-darkgray/40 px-6 py-4 border-b border-red-950/20 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img src={activeChatUser.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-red-500" />
                            <div>
                              <span className="font-bold text-sm text-white block">{activeChatUser.name}</span>
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider">{activeChatUser.role.replace('_', ' ')}</span>
                            </div>
                          </div>
                          
                          {/* Clear Chat Action */}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Apakah Anda yakin ingin menghapus seluruh riwayat pesan dengan ${activeChatUser.name}?`)) {
                                if (isDbConnected) {
                                  fetch('/api/messages/clear', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userA: currentUser.id, userB: activeChatUser.id })
                                  }).catch(err => console.error('Error clearing chat history:', err));
                                }
                                setMessages(prev => 
                                  prev.filter(msg => 
                                    !((msg.senderId === currentUser.id && msg.receiverId === activeChatUser.id) ||
                                      (msg.senderId === activeChatUser.id && msg.receiverId === currentUser.id))
                                  )
                                );
                                pushAuditLog(`Membersihkan riwayat obrolan dengan ${activeChatUser.name}`);
                              }
                            }}
                            className="text-gray-400 hover:text-red-400 text-xs font-semibold px-3 py-1.5 rounded bg-pdip-black/40 border border-red-900/10 hover:border-red-900/30 flex items-center gap-1.5 transition"
                          >
                            <Trash2 size={12} /> Bersihkan Obrolan
                          </button>
                        </div>

                        {/* Chat History Panel */}
                        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-pdip-black/20">
                          {chatHistory.length > 0 ? (
                            <>
                              {chatHistory.map((msg) => {
                                const isMe = msg.senderId === currentUser.id;
                                return (
                                  <div key={msg.id} className={`flex items-center gap-2 group ${isMe ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                                    {isMe && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm("Hapus pesan ini secara permanen?")) {
                                            if (isDbConnected) {
                                              fetch(`/api/messages/${msg.id}`, { method: 'DELETE' })
                                                .catch(err => console.error('Error deleting message:', err));
                                            }
                                            setMessages(prev => prev.filter(m => m.id !== msg.id));
                                            pushAuditLog("Menghapus satu pesan terkirim");
                                          }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1.5 transition-all duration-200 shrink-0"
                                        title="Hapus pesan"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}

                                    <div className={`max-w-md p-3.5 rounded-xl border text-xs shadow-md space-y-1 ${
                                      isMe 
                                        ? 'bg-pdip-red text-white border-red-900/35 rounded-br-none' 
                                        : 'bg-pdip-darkgray text-gray-200 border-red-950/20 rounded-bl-none'
                                    }`}>
                                      <p>{msg.content}</p>
                                      <span className="text-[8px] text-gray-400 block text-right font-mono">{msg.timestamp}</span>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Bouncing Typing Indicator */}
                              {isTyping && typingUserId === activeChatUser.id && (
                                <div className="flex justify-start animate-fadeIn">
                                  <div className="bg-pdip-darkgray border border-red-950/20 text-gray-400 p-3 rounded-xl rounded-bl-none text-xs flex items-center gap-1">
                                    <span className="font-semibold text-[10px]">{activeChatUser.name} sedang mengetik</span>
                                    <span className="flex gap-0.5 ml-1">
                                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                                Belum ada percakapan dengan {activeChatUser.name}. Kirimkan pesan pertama Anda di bawah.
                              </div>

                              {/* Bouncing Typing Indicator for Empty Chat */}
                              {isTyping && typingUserId === activeChatUser.id && (
                                <div className="flex justify-start animate-fadeIn mt-4">
                                  <div className="bg-pdip-darkgray border border-red-950/20 text-gray-400 p-3 rounded-xl rounded-bl-none text-xs flex items-center gap-1">
                                    <span className="font-semibold text-[10px]">{activeChatUser.name} sedang mengetik</span>
                                    <span className="flex gap-0.5 ml-1">
                                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Chat Form */}
                        <form onSubmit={handleSendMsg} className="p-4 bg-pdip-darkgray/30 border-t border-red-950/20 flex gap-3">
                          <input
                            type="text"
                            required
                            value={newMsgContent}
                            onChange={(e) => setNewMsgContent(e.target.value)}
                            placeholder={`Ketik pesan untuk ${activeChatUser.name}...`}
                            className="flex-1 bg-pdip-black text-xs text-white px-4 py-3 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                          />
                          <button
                            type="submit"
                            className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-semibold px-5 py-3 rounded-lg flex items-center gap-1.5 transition"
                          >
                            <Send size={14} /> Kirim
                          </button>
                        </form>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs space-y-3 p-10 text-center">
                    <Mail size={32} className="text-gray-600 animate-bounce" />
                    <span>Silakan pilih kader dari kontak di sebelah kiri untuk memulai obrolan private.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Global Monitor Panel */}
            {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') && (
              <div className="bg-pdip-metal p-6 rounded-xl border border-purple-950/20 shadow-md space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 border-b border-purple-950/15 pb-2 flex items-center gap-2">
                  <Shield size={16} /> Panel Pengawasan Perpesanan DPC (Admin Global)
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {messages.length > 0 ? (
                    messages.map((msg) => (
                      <div key={msg.id} className="p-3 bg-pdip-black/40 border border-purple-950/10 rounded-lg text-xs flex justify-between items-center gap-4 hover:border-purple-900/30 transition">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-gray-400">
                              <strong className="text-white">{msg.senderName}</strong> ➔ <strong className="text-white">{msg.receiverName}</strong>
                            </span>
                            {!msg.read && (
                              <span className="text-[8px] bg-red-950 text-red-400 px-1 border border-red-900/20 rounded font-bold uppercase">
                                Belum Dibaca
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300 italic mt-1 font-sans">"{msg.content}"</p>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[9px] text-gray-500 font-mono">{msg.timestamp}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Moderasi: Apakah Anda yakin ingin menghapus pesan dari "${msg.senderName}" ke "${msg.receiverName}"?`)) {
                                if (isDbConnected) {
                                  fetch(`/api/messages/${msg.id}`, { method: 'DELETE' })
                                    .catch(err => console.error('Error deleting message by moderator:', err));
                                }
                                setMessages(prev => prev.filter(m => m.id !== msg.id));
                                pushAuditLog(`Moderasi Pesan: Menghapus pesan dari "${msg.senderName}" ke "${msg.receiverName}"`);
                              }
                            }}
                            className="bg-red-950/30 hover:bg-red-900 text-red-400 p-1.5 rounded border border-red-900/20 hover:border-red-500/30 transition"
                            title="Hapus / Moderasi Pesan"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-gray-500 italic">
                      Belum ada perpesanan di sistem.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ==================== MODALS ==================== */}

      {/* 1. Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Plus className="text-pdip-red" /> Rekrut Kader / Downline MLM Baru
              </h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Nama Lengkap Anggota:</label>
                  <input
                    type="text"
                    required
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                    placeholder="Contoh: H. Ahmad Yani"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">NIK (16 Digit KTP):</label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{16}"
                    maxLength={16}
                    value={newMember.nik}
                    onChange={(e) => setNewMember({ ...newMember, nik: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white font-mono"
                    placeholder="3304..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">No. Telepon / WA:</label>
                  <input
                    type="text"
                    required
                    value={newMember.phone}
                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                    placeholder="08..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Role / Jabatan:</label>
                  <select
                    value={newMember.role}
                    onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    <option value="anggota">Anggota Biasa</option>
                    <option value="relawan_terdaftar">Relawan Lapangan / Saksi</option>
                    <option value="ketua_ranting">Ketua Ranting (Desa)</option>
                    {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') && (
                      <>
                        <option value="korcam">Korcam (Kecamatan)</option>
                        <option value="bapilu">Bapilu (Kabupaten)</option>
                        <option value="anggota_dewan">Anggota Dewan (DPRD)</option>
                        <option value="pimpinan_dpc">Pimpinan DPC</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Recruiter / Parent selection */}
                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-gray-400">Pemberi Rekomendasi / Pengajak (Parent):</label>
                  {currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' ? (
                    <select
                      value={newMember.parentId}
                      onChange={(e) => setNewMember({ ...newMember, parentId: e.target.value })}
                      className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                    >
                      <option value="">Tanpa Rekomendasi (Pusat / Root)</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.ktaNumber})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-pdip-black text-xs text-gray-400 border border-red-900/20 p-2.5 rounded-lg">
                      Terkunci ke akun Anda: <strong className="text-white">{currentUser.name}</strong> (Anda adalah parent dari anggota baru ini).
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Kecamatan:</label>
                  <select
                    value={newMember.kecamatan}
                    onChange={(e) => {
                      const kec = e.target.value;
                      setNewMember({ 
                        ...newMember, 
                        kecamatan: kec, 
                        desa: BANJARNEGARA_REGIONS[kec][0],
                        lat: KECAMATAN_COORDS[kec].lat + (Math.random() - 0.5) * 0.01,
                        lng: KECAMATAN_COORDS[kec].lng + (Math.random() - 0.5) * 0.01
                      });
                    }}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    {Object.keys(BANJARNEGARA_REGIONS).map((kec) => (
                      <option key={kec} value={kec}>{kec}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Desa/Kelurahan:</label>
                  <select
                    value={newMember.desa}
                    onChange={(e) => setNewMember({ ...newMember, desa: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    {BANJARNEGARA_REGIONS[newMember.kecamatan].map((des) => (
                      <option key={des} value={des}>{des}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-gray-400">TPS Tempat Nyoblos:</label>
                  <input
                    type="text"
                    required
                    value={newMember.tps}
                    onChange={(e) => setNewMember({ ...newMember, tps: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                    placeholder="TPS 01"
                  />
                </div>
              </div>

              {/* Photo Upload Widget */}
              <div className="space-y-2 pt-2">
                <label className="text-xs text-gray-400 block">Foto Identitas Diri:</label>
                <div className="flex items-center gap-4 p-3 bg-pdip-black border border-red-900/20 rounded-lg">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, (url) => setNewMember({ ...newMember, photoUrl: url }))}
                    className="hidden"
                    id="photo-upload-input"
                  />
                  <label htmlFor="photo-upload-input" className="bg-pdip-darkgray hover:bg-gray-800 text-xs font-semibold px-4 py-2 border border-red-900/30 rounded cursor-pointer transition flex items-center gap-2">
                    <Upload size={14} /> Pilih Foto
                  </label>
                  {newMember.photoUrl ? (
                    <img src={newMember.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-red-500" />
                  ) : (
                    <span className="text-[10px] text-gray-500">Pratinjau kosong</span>
                  )}
                </div>
              </div>

              {/* GPS Coordinates Grabber */}
              <div className="space-y-2 pt-2">
                <label className="text-xs text-gray-400 block">Koordinat Rumah Anggota (GPS Spasial):</label>
                <div className="flex gap-3">
                  <div className="flex-1 bg-pdip-black border border-red-900/20 rounded-lg px-3 py-2 text-xs font-mono text-gray-300 flex items-center justify-between">
                    <span>{newMember.lat.toFixed(6)}, {newMember.lng.toFixed(6)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchGPS}
                    disabled={gpsLoading}
                    className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {gpsLoading ? <RefreshCw size={14} className="animate-spin" /> : <MapPin size={14} />} 
                    Dapatkan GPS
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setShowAddMemberModal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-pdip-red text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Simpan & Daftarkan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Request Logistics Modal */}
      {showLogisticsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Truck className="text-pdip-red" /> Formulir Ajukan Logistik APK
              </h3>
              <button onClick={() => setShowLogisticsModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddOrder} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Nama Pemohon:</label>
                <input
                  type="text"
                  required
                  value={newOrder.requesterName}
                  onChange={(e) => setNewOrder({ ...newOrder, requesterName: e.target.value })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  placeholder="Nama lengkap..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Kecamatan:</label>
                  <select
                    value={newOrder.kecamatan}
                    onChange={(e) => {
                      const kec = e.target.value;
                      setNewOrder({ ...newOrder, kecamatan: kec, desa: BANJARNEGARA_REGIONS[kec][0] });
                    }}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    {Object.keys(BANJARNEGARA_REGIONS).map((kec) => (
                      <option key={kec} value={kec}>{kec}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Desa:</label>
                  <select
                    value={newOrder.desa}
                    onChange={(e) => setNewOrder({ ...newOrder, desa: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    {BANJARNEGARA_REGIONS[newOrder.kecamatan].map((des) => (
                      <option key={des} value={des}>{des}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Item APK/Logistik:</label>
                <select
                  value={newOrder.itemId}
                  onChange={(e) => setNewOrder({ ...newOrder, itemId: e.target.value })}
                  required
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                >
                  <option value="">Pilih barang...</option>
                  {logistics.map(l => (
                    <option key={l.id} value={l.id}>{l.name} (Tersedia: {l.stock} Pcs)</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Jumlah (Pcs):</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newOrder.quantity}
                  onChange={(e) => setNewOrder({ ...newOrder, quantity: Number(e.target.value) })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setShowLogisticsModal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-pdip-red text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Kirim Ajuan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2.1. Stock Mutation Modal */}
      {showStockMutationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Truck className="text-pdip-red" /> Pencatatan Mutasi Stok
              </h3>
              <button onClick={() => setShowStockMutationModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddStockMutation} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block font-sans">Pilih Item Logistik:</label>
                <select
                  value={stockItemId}
                  onChange={(e) => setStockItemId(e.target.value)}
                  required
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red"
                >
                  {logistics.map(l => (
                    <option key={l.id} value={l.id}>{l.name} (Stok saat ini: {l.stock} Pcs)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold block">Tipe Mutasi:</label>
                  <select
                    value={stockMutationType}
                    onChange={(e) => setStockMutationType(e.target.value as any)}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red font-bold"
                  >
                    <option value="stock_in">Stok Masuk (+)</option>
                    <option value="stock_out">Stok Keluar (-)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold block">Jumlah (Pcs):</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Catatan / Keterangan:</label>
                <textarea
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red"
                  placeholder="Keterangan mutasi (misal: Penerimaan kiriman DPD, APK dipasang di Kecamatan A)..."
                />
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setShowStockMutationModal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Simpan Mutasi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2.2. Fund Transaction Modal */}
      {showFundModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Coins className="text-pdip-red" /> Catat Transaksi Arus Kas
              </h3>
              <button onClick={() => setShowFundModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddFund} className="p-6 space-y-4 font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold block">Jenis Transaksi:</label>
                  <select
                    value={fundType}
                    onChange={(e) => setFundType(e.target.value as any)}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red font-bold"
                  >
                    <option value="expense">Pengeluaran (-)</option>
                    <option value="income">Pemasukan (+)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold block">Kategori:</label>
                  <select
                    value={fundCategory}
                    onChange={(e) => setFundCategory(e.target.value as any)}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red"
                  >
                    <option value="Kegiatan">Kegiatan</option>
                    <option value="Sosialisasi">Sosialisasi</option>
                    <option value="Pembuatan Media">Pembuatan Media</option>
                    <option value="Logistik">Logistik</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Nominal (Rupiah):</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={fundAmount || ''}
                  onChange={(e) => setFundAmount(Number(e.target.value))}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red font-mono"
                  placeholder="Masukkan nominal Rp..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Nama Transaksi:</label>
                <input
                  type="text"
                  required
                  value={fundTitle}
                  onChange={(e) => setFundTitle(e.target.value)}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red"
                  placeholder="Judul transaksi (misal: Konsolidasi PAC)..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Detail / Keterangan:</label>
                <textarea
                  value={fundDescription}
                  onChange={(e) => setFundDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red"
                  placeholder="Keterangan tambahan..."
                />
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setShowFundModal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-pdip-red text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Simpan Transaksi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Aspiration Modal */}
      {showAspirationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <MessageSquare className="text-pdip-red" /> Form Aspirasi Warga
              </h3>
              <button onClick={() => setShowAspirationModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddAspiration} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Nama Pelapor / Warga:</label>
                <input
                  type="text"
                  required
                  value={newAspiration.reporterName}
                  onChange={(e) => setNewAspiration({ ...newAspiration, reporterName: e.target.value })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  placeholder="Nama lengkap..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Kecamatan:</label>
                  <select
                    value={newAspiration.kecamatan}
                    onChange={(e) => {
                      const kec = e.target.value;
                      setNewAspiration({ ...newAspiration, kecamatan: kec, desa: BANJARNEGARA_REGIONS[kec][0] });
                    }}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    {Object.keys(BANJARNEGARA_REGIONS).map((kec) => (
                      <option key={kec} value={kec}>{kec}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Desa:</label>
                  <select
                    value={newAspiration.desa}
                    onChange={(e) => setNewAspiration({ ...newAspiration, desa: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    {BANJARNEGARA_REGIONS[newAspiration.kecamatan].map((des) => (
                      <option key={des} value={des}>{des}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">No HP / WhatsApp:</label>
                <input
                  type="text"
                  required
                  value={newAspiration.phone}
                  onChange={(e) => setNewAspiration({ ...newAspiration, phone: e.target.value })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  placeholder="08..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Topik/Judul Aduan:</label>
                <input
                  type="text"
                  required
                  value={newAspiration.title}
                  onChange={(e) => setNewAspiration({ ...newAspiration, title: e.target.value })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  placeholder="Topik aduan..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Detail Aspirasi:</label>
                <textarea
                  required
                  rows={3}
                  value={newAspiration.description}
                  onChange={(e) => setNewAspiration({ ...newAspiration, description: e.target.value })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white resize-none"
                  placeholder="Tulis keluhan lengkap Anda..."
                ></textarea>
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setShowAspirationModal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-pdip-red text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Kirim</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Dewan Tanggapan Modal */}
      {respondingAspirationId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Send className="text-pdip-red" /> Tanggapan Anggota Dewan
              </h3>
              <button onClick={() => setRespondingAspirationId(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRespondAspiration} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 block font-semibold">Detail Aspirasi:</label>
                <div className="bg-pdip-black p-3 rounded text-xs text-gray-300">
                  <strong className="text-white">{aspirations.find(a => a.id === respondingAspirationId)?.title}</strong>
                  <p className="mt-1 text-gray-400">{aspirations.find(a => a.id === respondingAspirationId)?.description}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block font-sans">Tindakan/Tanggapan Dewan:</label>
                <textarea
                  required
                  rows={4}
                  value={dewanResponseText}
                  onChange={(e) => setDewanResponseText(e.target.value)}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white resize-none"
                  placeholder="Tuliskan tindak lanjut..."
                ></textarea>
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setRespondingAspirationId(null)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-pdip-red text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Kirim Tanggapan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. C1 Upload Modal */}
      {showC1Modal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Upload className="text-pdip-red" /> Unggah Hasil C1 TPS & Suara
              </h3>
              <button onClick={() => setShowC1Modal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddC1} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-gray-400">Kecamatan TPS:</label>
                  <select
                    value={newC1.kecamatan}
                    onChange={(e) => setNewC1({ ...newC1, kecamatan: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    {Object.keys(BANJARNEGARA_REGIONS).map((kec) => (
                      <option key={kec} value={kec}>{kec}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-gray-400">Nomor / Lokasi TPS:</label>
                  <input
                    type="text"
                    required
                    value={newC1.tps}
                    onChange={(e) => setNewC1({ ...newC1, tps: e.target.value })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                    placeholder="TPS 05 Gumiwang"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Suara Paslon 1:</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newC1.candidate1Votes}
                    onChange={(e) => setNewC1({ ...newC1, candidate1Votes: Number(e.target.value) })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-red-400 font-bold">Suara Paslon 2 (PDIP):</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newC1.candidate2Votes}
                    onChange={(e) => setNewC1({ ...newC1, candidate2Votes: Number(e.target.value) })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Suara Paslon 3:</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newC1.candidate3Votes}
                    onChange={(e) => setNewC1({ ...newC1, candidate3Votes: Number(e.target.value) })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Tidak Sah:</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newC1.tidakSah}
                    onChange={(e) => setNewC1({ ...newC1, tidakSah: Number(e.target.value) })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              {/* Photo C1 */}
              <div className="space-y-2 pt-2">
                <label className="text-xs text-gray-400 block">Foto Formulir C1 Plano:</label>
                <div className="flex items-center gap-4 p-3 bg-pdip-black border border-red-900/20 rounded-lg">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, (url) => setNewC1({ ...newC1, c1PhotoUrl: url }))}
                    className="hidden"
                    id="c1-upload-input"
                  />
                  <label htmlFor="c1-upload-input" className="bg-pdip-darkgray hover:bg-gray-800 text-xs font-semibold px-4 py-2 border border-red-900/30 rounded cursor-pointer transition flex items-center gap-2">
                    <Upload size={14} /> Pilih Foto C1
                  </label>
                  {newC1.c1PhotoUrl ? (
                    <img src={newC1.c1PhotoUrl} alt="" className="w-14 h-10 object-cover border border-red-500 rounded" />
                  ) : (
                    <span className="text-[10px] text-gray-500">Pratinjau kosong</span>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setShowC1Modal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-pdip-red text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Kirim</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Create Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Award className="text-pdip-red" /> Formulir Laporan Baru
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddReport} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Judul Laporan / Peristiwa:</label>
                <input
                  type="text"
                  required
                  value={newReportState.title}
                  onChange={(e) => setNewReportState({ ...newReportState, title: e.target.value })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  placeholder="Contoh: Hambatan Distribusi APK di Desa..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-gray-400">Kategori Laporan:</label>
                  <select
                    value={newReportState.category}
                    onChange={(e) => setNewReportState({ ...newReportState, category: e.target.value as any })}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  >
                    <option value="Kegiatan Rutin">Kegiatan Rutin</option>
                    <option value="Insiden">Insiden Lapangan</option>
                    <option value="Darurat">Keadaan Darurat</option>
                    <option value="Perekrutan">Laporan Perekrutan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Target Recipient Selector */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Ditujukan Kepada (Opsional):</label>
                <select
                  value={newReportState.targetMemberId}
                  onChange={(e) => setNewReportState({ ...newReportState, targetMemberId: e.target.value })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                >
                  <option value="">Semua Admin & Pimpinan DPC (Default)</option>
                  {members
                    .filter(m => m.id !== currentUser.id)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role.replace('_', ' ').toUpperCase()})
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-gray-500 italic block mt-1">
                  Pilih kader tertentu (misal: Anggota Dewan atau Korcam) jika laporan butuh atensi khusus perorangan.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Detail / Kronologi Kejadian:</label>
                <textarea
                  required
                  rows={4}
                  value={newReportState.details}
                  onChange={(e) => setNewReportState({ ...newReportState, details: e.target.value })}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white resize-none"
                  placeholder="Ceritakan detail kejadian secara lengkap dan jujur..."
                ></textarea>
              </div>

              {/* Photo Upload Widget for report */}
              <div className="space-y-2 pt-2">
                <label className="text-xs text-gray-400 block">Foto Dokumentasi Bukti:</label>
                <div className="flex items-center gap-4 p-3 bg-pdip-black border border-red-900/20 rounded-lg">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, (url) => setNewReportState({ ...newReportState, photoUrl: url }))}
                    className="hidden"
                    id="report-photo-upload"
                  />
                  <label htmlFor="report-photo-upload" className="bg-pdip-darkgray hover:bg-gray-800 text-xs font-semibold px-4 py-2 border border-red-900/30 rounded cursor-pointer transition flex items-center gap-2">
                    <Upload size={14} /> Pilih Foto
                  </label>
                  {newReportState.photoUrl ? (
                    <img src={newReportState.photoUrl} alt="" className="w-14 h-10 object-cover border border-red-500 rounded" />
                  ) : (
                    <span className="text-[10px] text-gray-500 font-mono">Pratinjau kosong</span>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setShowReportModal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-pdip-red text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Kirim Laporan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Strategic Book / Anti-Broker Modal */}
      {showStrategicModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center bg-gradient-to-r from-pdip-black to-pdip-metal">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-950/50 rounded-lg text-pdip-gold border border-red-900/30">
                  <Shield size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white font-serif tracking-wide uppercase">
                    Buku Saku Strategis & Sistem Anti-Broker
                  </h3>
                  <p className="text-xs text-gray-400">
                    Nilai Strategis Pemenangan Terstruktur Pemilu PDI Perjuangan
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowStrategicModal(false)} 
                className="text-gray-400 hover:text-white bg-pdip-darkgray hover:bg-pdip-red/20 w-8 h-8 rounded-full flex items-center justify-center transition duration-200"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-pdip-metal">
              
              {/* Introduction Banner */}
              <div className="p-4 bg-red-950/30 border-l-4 border-pdip-gold rounded-r-xl space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-pdip-gold">Doktrin Gerakan Presisi</h4>
                <p className="text-xs text-gray-200 leading-relaxed">
                  "Dalam pertempuran pemilu modern, pemenang bukan mereka yang paling nyaring bersuara di media atau mengklaim basis massa paling besar di atas kertas. Pemenang adalah mereka yang memiliki <strong>data keanggotaan riil yang presisi, terkoordinasi, dan terkunci secara geografis</strong> di setiap RT/RW dan TPS. Sistem ini dibangun untuk menegakkan kedaulatan data partai."
                </p>
              </div>

              {/* Grid of Key Benefits / Explanations */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-300 border-b border-red-950/10 pb-2">
                  5 Pilar Kekuatan Sistem & Cara Mengeliminasi Makelar Pemilu
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Benefit 1: Menghentikan Tim Sukses Fiktif & Spekulan */}
                  <div className="p-4 bg-pdip-black/50 border border-red-900/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1.5 bg-red-950/50 rounded-lg"><Trash2 size={14} /></span>
                      Anti-Broker & Tim Sukses Palsu
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Banyak oportunis pemilu mengklaim memiliki ribuan pengikut untuk meminta anggaran kampanye. 
                      Dengan kewajiban input <strong>NIK unik</strong> dan verifikasi <strong>koordinat GPS</strong> tempat tinggal, partai dapat langsung membuktikan kebenaran basis tersebut. Jika tidak terpetakan di GIS, klaim tersebut dipastikan fiktif.
                    </p>
                  </div>

                  {/* Benefit 2: Perekrutan Berjenjang Berakuntabilitas Tinggi */}
                  <div className="p-4 bg-pdip-black/50 border border-red-900/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1.5 bg-indigo-950/50 rounded-lg"><GitFork size={14} /></span>
                      Transparansi Downline MLM
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Sistem perekrutan berjenjang (downline) melacak penanggung jawab rekrutmen. Setiap kader bertanggung jawab penuh atas validitas anggotanya (downline). Jika ada manipulasi data, sistem secara instan melacak upline yang memasukkan data tersebut untuk tindakan disiplin partai.
                    </p>
                  </div>

                  {/* Benefit 3: Peta GIS untuk Efisiensi Logistik */}
                  <div className="p-4 bg-pdip-black/50 border border-red-900/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1.5 bg-emerald-950/50 rounded-lg"><MapPin size={14} /></span>
                      Pemetaan Kekuatan Wilayah
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Dengan peta desa GeoJSON Banjarnegara, pimpinan partai dapat melihat desa mana yang masih kosong kader (blank spot). Distribusi logistik (kaos, alat peraga, dana ranting) disalurkan secara efisien hanya ke wilayah yang membutuhkan penguatan, mencegah kebocoran dana ke broker.
                    </p>
                  </div>

                  {/* Benefit 4: Komunikasi Terenkripsi & Laporan Riil */}
                  <div className="p-4 bg-pdip-black/50 border border-red-900/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                      <span className="p-1.5 bg-blue-950/50 rounded-lg"><MessageSquare size={14} /></span>
                      Komunikasi Langsung & Verifikatif
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Sistem perpesanan privat internal menghubungkan langsung DPC dengan Ketua Ranting (tingkat Desa) tanpa perantara. Laporan kejadian di lapangan wajib disertai koordinat lokasi dan bukti foto riil, memangkas laporan palsu atau asal bapak senang.
                    </p>
                  </div>

                </div>

                {/* Full Width Row - Benefit 5 */}
                <div className="p-4 bg-pdip-black/50 border border-red-900/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-pdip-gold font-bold text-xs uppercase tracking-wider">
                    <span className="p-1.5 bg-yellow-950/50 rounded-lg"><RefreshCw size={14} /></span>
                    Pengawalan Suara TPS & Quick Count Presisi
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Broker suara sering kali menjanjikan perolehan suara tinggi saat pra-pemilu, namun menghilang saat hari-H. Sistem Quick Count C1 mengunci perolehan suara riil langsung dari TPS oleh saksi yang terverifikasi. Unggahan foto C1 Plano digital mencegah pencurian atau manipulasi suara di tingkat pleno rekapitulasi kecamatan.
                  </p>
                </div>
              </div>

              {/* Strategic Advice summary */}
              <div className="bg-pdip-black/60 border border-red-950/30 p-5 rounded-xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  🛡️ Cara Kerja Fitur Anti-Broker & Keamanan Data
                </h4>
                <ul className="text-xs text-gray-400 space-y-2.5 list-disc pl-4">
                  <li>
                    <strong className="text-gray-300">Deteksi Duplikasi NIK:</strong> Sistem secara otomatis menolak pendaftaran anggota baru jika NIK yang dimasukkan sudah terdaftar. Hal ini menghentikan praktik tim sukses nakal yang menjual data anggota yang sama ke caleg atau partai lain.
                  </li>
                  <li>
                    <strong className="text-gray-300">Klastering Geografis GIS:</strong> Sistem memetakan titik koordinat anggota di dalam desa masing-masing. Jika ada caleg atau tim sukses yang mendaftarkan 100 anggota tetapi titik koordinatnya menumpuk di satu rumah atau di luar wilayah desa, sistem akan menandai data tersebut sebagai "Anomali Data".
                  </li>
                  <li>
                    <strong className="text-gray-300">Audit Trail Aktivitas:</strong> Setiap pembuatan, perubahan, atau penghapusan data anggota dicatat dalam log sistem. Administrator dapat memantau siapa penginput data mencurigakan untuk melacak motif oportunis politik.
                  </li>
                </ul>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-red-950/20 flex justify-between items-center bg-pdip-black/50">
              <span className="text-[10px] text-gray-500 font-mono">DPC PDI Perjuangan Banjarnegara - Pemilu Presisi 2026</span>
              <button 
                onClick={() => setShowStrategicModal(false)}
                className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-bold px-4 py-2 rounded-lg transition duration-200"
              >
                Pahami Doktrin
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 7. Member Detail Modal */}
      {selectedMemberId && (() => {
        const member = members.find(m => m.id === selectedMemberId);
        if (!member) return null;

        const parent = members.find(p => p.id === member.parentId);
        const directDownlines = members.filter(m => m.parentId === member.id);
        const totalDownlines = countDownline(member.id, members);

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scaleUp">
              {/* Header */}
              <div className="p-6 border-b border-red-950/20 flex justify-between items-center bg-pdip-black/20">
                <div className="flex items-center gap-3">
                  <Eye className="text-pdip-red" size={20} />
                  <h3 className="font-bold text-lg text-white font-serif">
                    Detail Profil Anggota
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedMemberId(null)} 
                  className="text-gray-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {/* Photo Profile */}
                  <div className="w-full md:w-1/3 flex flex-col items-center text-center space-y-2">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-red-500 shadow-md">
                      <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                    </div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      member.status === 'ACTIVE' 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' 
                        : 'bg-red-950 text-red-400 border border-red-900/30'
                    }`}>
                      {member.status}
                    </span>
                  </div>

                  {/* Profile info */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="text-xl font-bold text-white font-serif">{member.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">No. KTA: <span className="font-mono text-red-400 font-bold">{member.ktaNumber}</span></p>
                      <p className="text-xs text-gray-500">NIK: <span className="font-mono text-gray-300">{member.nik}</span></p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-gray-400 block">Jabatan / Role:</span>
                        <span className="font-bold text-white uppercase bg-pdip-black/40 px-2 py-1 rounded border border-red-900/10 inline-block">
                          {member.role.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-gray-400 block">No. Telepon:</span>
                        <span className="font-bold text-white">{member.phone}</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-gray-400 block">Tanggal Bergabung:</span>
                        <span className="font-bold text-white">{member.joinDate}</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-gray-400 block">TPS Tempat Nyoblos:</span>
                        <span className="font-bold text-red-400 uppercase">{member.tps}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-red-950/20" />

                {/* Regional Details */}
                <div className="grid grid-cols-2 gap-4 bg-pdip-black/20 p-4 rounded-xl border border-red-900/10 text-xs">
                  <div className="space-y-1">
                    <span className="text-gray-400 block">Kecamatan Tugas:</span>
                    <strong className="text-white">{member.kecamatan}</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-400 block">Desa / Ranting:</span>
                    <strong className="text-white">{member.desa}</strong>
                  </div>
                </div>

                <hr className="border-red-950/20" />

                {/* Jaringan Upline & Downline */}
                <div className="space-y-4">
                  {/* Upline Section */}
                  <div className="space-y-2">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Pemberi Rekomendasi (Upline / Parent):</span>
                    {parent ? (
                      <div 
                        onClick={() => setSelectedMemberId(parent.id)}
                        className="flex items-center gap-3 bg-pdip-black/40 p-3 rounded-xl border border-red-950/10 hover:border-red-500/40 cursor-pointer transition"
                      >
                        <img src={parent.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-red-900/20" />
                        <div>
                          <strong className="text-xs text-white block hover:text-red-400">{parent.name}</strong>
                          <span className="text-[10px] text-gray-400 uppercase">{parent.role.replace('_', ' ')}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-pdip-black/20 rounded-xl border border-red-950/5 text-xs text-gray-500 italic">
                        Kader Tingkat Pusat / Root (Tidak ada pengajak terdaftar)
                      </div>
                    )}
                  </div>

                  {/* Downline Section */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-red-950/15 pb-2">
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                        Anggota Rekrutan Langsung (Direct Downlines):
                      </span>
                      <span className="text-xs bg-red-950 text-red-400 px-2 py-0.5 rounded border border-red-900/40 font-bold">
                        Total Jaringan: {totalDownlines} Kader
                      </span>
                    </div>

                    {directDownlines.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1">
                        {directDownlines.map((child) => (
                          <div 
                            key={child.id}
                            onClick={() => setSelectedMemberId(child.id)}
                            className="flex items-center gap-3 bg-pdip-black/45 p-2 rounded-lg border border-red-950/10 hover:border-red-500/40 cursor-pointer transition"
                          >
                            <img src={child.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-red-900/20" />
                            <div className="min-w-0 flex-1">
                              <strong className="text-[11px] text-white block truncate hover:text-red-400">{child.name}</strong>
                              <span className="text-[9px] text-gray-500 uppercase block truncate">{child.role.replace('_', ' ')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-pdip-black/20 rounded-xl border border-red-950/5 text-xs text-gray-500 text-center italic">
                        Belum merekrut downline / anggota baru.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-6 border-t border-red-950/20 flex gap-3 justify-end bg-pdip-black/10">
                {member.id !== currentUser.id && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedMemberId(null);
                        setActiveChatUserId(member.id);
                        setActiveTab('perpesanan');
                      }}
                      className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition"
                    >
                      <Mail size={14} /> Kirim Pesan
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMemberId(null);
                        setNewReportState({
                          title: '',
                          category: 'Kegiatan Rutin',
                          details: '',
                          photoUrl: '',
                          targetMemberId: member.id
                        });
                        setShowReportModal(true);
                      }}
                      className="bg-pdip-darkgray hover:bg-gray-800 text-gray-300 text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 border border-red-900/20 transition"
                    >
                      <Award size={14} /> Laporkan Masalah
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(null)}
                  className="bg-pdip-black border border-red-900/20 text-gray-400 hover:text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
