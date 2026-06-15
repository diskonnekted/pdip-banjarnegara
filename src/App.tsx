import React, { useState, useEffect } from 'react';
import { 
  Users, Map, BookOpen, Truck, MessageSquare, BarChart3, Plus, Search, Calendar,
  MapPin, Award, Settings, ListCollapse, LogOut, Lock, Mail, Wallet, Coins,
  Upload, Shield, RefreshCw, Send, Trash2, GitFork, ChevronDown, ChevronRight as ChevronRightIcon, Eye, Calculator,
  LayoutList, Locate, Target, HeartHandshake
} from 'lucide-react';
import SainteLagueCalculator from './components/SainteLagueCalculator';
import KtaTracker from './components/KtaTracker';
import DdsTracker from './components/DdsTracker';
import AdvocacyManager from './components/AdvocacyManager';
import StrategicTimeline from './components/StrategicTimeline';
import WitnessManager from './components/WitnessManager';
import OrgChartComponent from './components/OrgChartComponent';
import confetti from 'canvas-confetti';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import type { Member, LogisticsItem, LogisticsOrder, Aspiration, QuickCountResult, MemberReport, PrivateMessage, RantingProposal, OperationalFund, LogisticsStockHistory, PartyActivity, TpsMapping, DdsLog, AdvocacyTicket, Milestone } from './types';
import { 
  BANJARNEGARA_REGIONS, KECAMATAN_COORDS, INITIAL_MEMBERS, 
  INITIAL_LOGISTICS, INITIAL_ORDERS, INITIAL_ASPIRATIONS, 
  QUIZ_QUESTIONS, INITIAL_QUICK_COUNT, INITIAL_REPORTS, INITIAL_MESSAGES,
  INITIAL_FUNDS, INITIAL_STOCK_HISTORY, INITIAL_ACTIVITIES, INITIAL_TPS_MAPPING,
  INITIAL_DDS_LOGS, INITIAL_ADVOCACY_TICKETS, INITIAL_MILESTONES
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

// TPS square marker
const createTpsMarker = (zona: 'merah' | 'kuning' | 'hijau') => {
  let color = '#EF4444'; // default red
  if (zona === 'merah') color = '#DC2626'; // red-600
  if (zona === 'kuning') color = '#EAB308'; // yellow-500
  if (zona === 'hijau') color = '#22C55E'; // green-500

  return L.divIcon({
    html: `
      <div class="relative w-8 h-8 flex items-center justify-center">
        <div class="relative w-6 h-6 rounded-md border-2 border-white shadow-lg flex items-center justify-center" style="background-color: ${color};">
          <span class="w-1.5 h-1.5 bg-white rounded-sm"></span>
        </div>
      </div>
    `,
    className: 'tps-marker',
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

  // Mobile layout trigger & tab states
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    return window.innerWidth < 768;
  });
  const [mobileTab, setMobileTab] = useState<'beranda' | 'rekrut' | 'lapor' | 'pesan_broadcast' | 'dds' | 'advokasi' | 'timeline' | 'saksi'>('beranda');

  // Broadcast / Pengumuman State
  const [broadcasts, setBroadcasts] = useState<any[]>(() => {
    const saved = localStorage.getItem('pdip_broadcasts');
    return saved ? JSON.parse(saved) : [
      {
        id: "b-1",
        title: "Instruksi Konsolidasi Saksi TPS",
        content: "Diharapkan seluruh Ketua Ranting mendata Saksi TPS di wilayah masing-masing paling lambat H-7. Pastikan dokumen C1 Plano dipahami sepenuhnya.",
        timestamp: "2026-05-27 08:00",
        senderName: "H. Nuryanto, S.Sos. (Ketua DPC)"
      },
      {
        id: "b-2",
        title: "Pembagian APK Tambahan",
        content: "Pemberitahuan kepada seluruh Korcam: kaos banteng tambahan dan bendera partai gelombang ke-3 sudah tersedia di Gudang DPC Banjarnegara. Silakan berkoordinasi dengan Admin Logistik.",
        timestamp: "2026-05-27 10:30",
        senderName: "Sugeng Wiyono (Bapilu)"
      }
    ];
  });

  // Resize listener for auto mobile trigger
  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'keanggotaan' | 'gis' | 'kaderisasi' | 'logistik' | 'aspirasi' | 'quickcount' | 'analitik' | 'dpt' | 'laporan' | 'perpesanan' | 'pengaturan' | 'pendanaan' | 'kegiatan' | 'sainte-lague' | 'tracker-kta' | 'dds-tracker' | 'advokasi' | 'timeline' | 'saksi'>('dashboard');

  // Keanggotaan sub-tab: list vs tree viewer
  const [memberViewMode, setMemberViewMode] = useState<'list' | 'tree'>('list');
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
                logisticsStockHistory: INITIAL_STOCK_HISTORY,
                activities: INITIAL_ACTIVITIES,
                tpsMapping: INITIAL_TPS_MAPPING,
                ddsLogs: INITIAL_DDS_LOGS
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
              dbStockHistory,
              dbActivities,
              dbTpsMapping,
              dbDdsLogs,
              dbAdvocacy,
              dbMilestones
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
              fetch('/api/logistics/history').then(r => r.json()).catch(() => []),
              fetch('/api/activities').then(r => r.json()).catch(() => []),
              fetch('/api/tps-mapping').then(r => r.json()).catch(() => []),
              fetch('/api/dds-logs').then(r => r.json()).catch(() => []),
              fetch('/api/advocacy-tickets').then(r => r.json()).catch(() => []),
              fetch('/api/milestones').then(r => r.json()).catch(() => [])
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
            if (dbActivities) setActivities(dbActivities);
            if (dbTpsMapping) setTpsData(dbTpsMapping);
            if (dbDdsLogs) setDdsLogs(dbDdsLogs);
            if (dbAdvocacy) setAdvocacyTickets(dbAdvocacy);
            if (dbMilestones) setMilestones(dbMilestones);
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

  // Activities States
  const [activities, setActivities] = useState<PartyActivity[]>(() => {
    const saved = localStorage.getItem('pdip_activities');
    return saved ? JSON.parse(saved) : INITIAL_ACTIVITIES;
  });

  // DDS Tracker Logs State
  const [ddsLogs, setDdsLogs] = useState<DdsLog[]>(() => {
    const saved = localStorage.getItem('pdip_dds_logs');
    return saved ? JSON.parse(saved) : INITIAL_DDS_LOGS;
  });

  // Advocacy Tickets State
  const [advocacyTickets, setAdvocacyTickets] = useState<AdvocacyTicket[]>(() => {
    const saved = localStorage.getItem('pdip_advocacy_tickets');
    return saved ? JSON.parse(saved) : INITIAL_ADVOCACY_TICKETS;
  });

  const handleAddAdvocacyTicket = (newTicket: AdvocacyTicket) => {
    setAdvocacyTickets(prev => [newTicket, ...prev]);
  };

  const handleUpdateAdvocacyTicket = (id: string, status: AdvocacyTicket['status'], dewanNotes?: string, dewanName?: string) => {
    setAdvocacyTickets(prev => prev.map(t => t.id === id ? { ...t, status, dewanNotes, dewanName } : t));
  };

  const handleDeleteAdvocacyTicket = (id: string) => {
    setAdvocacyTickets(prev => prev.filter(t => t.id !== id));
  };

  // Milestones State & Handler
  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    const saved = localStorage.getItem('pdip_milestones');
    return saved ? JSON.parse(saved) : INITIAL_MILESTONES;
  });

  const handleUpdateMilestone = async (id: string, completed: boolean, notes?: string, completedBy?: string) => {
    const completedAt = completed ? new Date().toISOString() : undefined;
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, completed, notes, completedBy, completedAt } : m));

    if (isDbConnected) {
      try {
        const response = await fetch(`/api/milestones/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed, notes, completedBy, completedAt })
        });
        if (!response.ok) {
          throw new Error('Gagal memperbarui milestone di server');
        }
      } catch (err) {
        console.error('Database Sync Error:', err);
      }
    }
  };

  // Activities Form & Modal States
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showActivityReportModal, setShowActivityReportModal] = useState(false);
  const [selectedActivityIdForReport, setSelectedActivityIdForReport] = useState('');
  
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityType, setNewActivityType] = useState('Konsolidasi PAC');
  const [newActivityExecutors, setNewActivityExecutors] = useState<Member[]>([]);
  const [newActivityDate, setNewActivityDate] = useState('');
  const [newActivityLocation, setNewActivityLocation] = useState('');
  const [newActivityBudgetTransport, setNewActivityBudgetTransport] = useState<number>(0);
  const [newActivityBudgetMeals, setNewActivityBudgetMeals] = useState<number>(0);
  const [newActivityBudgetAccommodation, setNewActivityBudgetAccommodation] = useState<number>(0);
  const [newActivityBudgetOther, setNewActivityBudgetOther] = useState<number>(0);
  
  const [newActivityReportDescription, setNewActivityReportDescription] = useState('');
  const [newActivityReportPhoto, setNewActivityReportPhoto] = useState('');
  const [executorSearchText, setExecutorSearchText] = useState('');

  // Filters for activities
  const [filterActivityStatus, setFilterActivityStatus] = useState<string>('ALL');
  const [filterActivityExecutor, setFilterActivityExecutor] = useState<string>('ALL');
  
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
  useEffect(() => {
    localStorage.setItem('pdip_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('pdip_dds_logs', JSON.stringify(ddsLogs));
  }, [ddsLogs]);

  useEffect(() => {
    localStorage.setItem('pdip_advocacy_tickets', JSON.stringify(advocacyTickets));
  }, [advocacyTickets]);

  useEffect(() => {
    localStorage.setItem('pdip_milestones', JSON.stringify(milestones));
  }, [milestones]);

  useEffect(() => {
    localStorage.setItem('pdip_broadcasts', JSON.stringify(broadcasts));
  }, [broadcasts]);

  useEffect(() => {
    const hasLegislator = newActivityExecutors.some(e => e.role === 'anggota_dewan');
    if (hasLegislator) {
      const legislativeTypes = ['Reses', 'Kunjungan Dapil', 'Sosialisasi Perda', 'Lainnya (Legislatif)'];
      if (!legislativeTypes.includes(newActivityType)) {
        setNewActivityType('Reses');
      }
    } else {
      const standardTypes = ['Konsolidasi PAC', 'Rapat Pleno DPC', 'Kerja Bakti Sosial', 'Musyawarah Ranting', 'Pendidikan Politik Kader', 'Lainnya'];
      if (!standardTypes.includes(newActivityType)) {
        setNewActivityType('Konsolidasi PAC');
      }
    }
  }, [newActivityExecutors]);



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

  // DPT Approach Modal States
  const [showApproachModal, setShowApproachModal] = useState(false);
  const [selectedDptForApproach, setSelectedDptForApproach] = useState<Member | null>(null);
  const [approachKaderId, setApproachKaderId] = useState('');
  const [approachStatus, setApproachStatus] = useState<'tidak_prospektif' | 'prospektif' | 'respek' | 'bergabung'>('tidak_prospektif');
  const [approachNotes, setApproachNotes] = useState('');

  // Mobile-specific Form & View States
  const [newMobileMember, setNewMobileMember] = useState({
    name: '',
    nik: '',
    role: 'anggota',
    kecamatan: 'Banjarnegara',
    desa: 'Semarang',
    tps: 'TPS 01',
    phone: '',
    photoUrl: '',
    lat: -7.3996,
    lng: 109.6976
  });

  const [newBroadcastTitle, setNewBroadcastTitle] = useState('');
  const [newBroadcastContent, setNewBroadcastContent] = useState('');

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
  const [gisMode, setGisMode] = useState<'kader' | 'tps'>('kader');
  const [tpsData, setTpsData] = useState<TpsMapping[]>(() => {
    const saved = localStorage.getItem('pdip_tps_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TpsMapping[];
        if (parsed.length < 20) {
          return INITIAL_TPS_MAPPING;
        }
        return parsed.map(t => {
          if (t.kecamatan === 'Banjarnegara' && t.desa === 'Krangandipan') {
            return { ...t, desa: 'Krandegan' };
          }
          if (t.kecamatan === 'Banjarnegara' && t.desa === 'Semampir') {
            return { ...t, desa: 'Semarang' };
          }
          return t;
        });
      } catch (e) {
        return INITIAL_TPS_MAPPING;
      }
    }
    return INITIAL_TPS_MAPPING;
  });
  const [tpsSearch, setTpsSearch] = useState('');

  useEffect(() => {
    localStorage.setItem('pdip_tps_data', JSON.stringify(tpsData));
  }, [tpsData]);

  const handleUpdateWitness = async (
    tpsId: string,
    slot: 1 | 2,
    witnessId: string | null,
    witnessName: string | null,
    witnessStatus?: 'belum_pelatihan' | 'terlatih'
  ) => {
    setTpsData(prev => prev.map(t => {
      if (t.id === tpsId) {
        const updated = { ...t };
        if (slot === 1) {
          updated.saksi1Id = witnessId;
          updated.saksi1Name = witnessName;
          if (witnessStatus !== undefined) updated.saksi1Status = witnessStatus;
        } else {
          updated.saksi2Id = witnessId;
          updated.saksi2Name = witnessName;
          if (witnessStatus !== undefined) updated.saksi2Status = witnessStatus;
        }
        updated.lastUpdatedBy = currentUser.name;
        updated.lastUpdatedDate = new Date().toISOString().slice(0, 10);
        return updated;
      }
      return t;
    }));

    if (isDbConnected) {
      try {
        const payload: any = {
          lastUpdatedBy: currentUser.name,
          lastUpdatedDate: new Date().toISOString().slice(0, 10)
        };
        if (slot === 1) {
          payload.saksi1Id = witnessId;
          payload.saksi1Name = witnessName;
          if (witnessStatus !== undefined) payload.saksi1Status = witnessStatus;
        } else {
          payload.saksi2Id = witnessId;
          payload.saksi2Name = witnessName;
          if (witnessStatus !== undefined) payload.saksi2Status = witnessStatus;
        }

        const res = await fetch(`/api/tps-mapping/${tpsId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          throw new Error('Gagal melakukan pembaruan penugasan saksi di server');
        }
      } catch (err) {
        console.error('MySQL database sync error:', err);
      }
    }
  };

  const filteredTpsData = tpsData.filter(t => 
    t.namaTps.toLowerCase().includes(tpsSearch.toLowerCase()) ||
    t.desa.toLowerCase().includes(tpsSearch.toLowerCase()) ||
    t.kecamatan.toLowerCase().includes(tpsSearch.toLowerCase())
  );

  const handleTpsZoneChange = (id: string, newZone: 'merah' | 'kuning' | 'hijau') => {
    const updatedDate = new Date().toISOString().split('T')[0];
    setTpsData(prev => prev.map(tps => 
      tps.id === id 
        ? { ...tps, zona: newZone, lastUpdatedDate: updatedDate, lastUpdatedBy: currentUser.name } 
        : tps
    ));

    if (isDbConnected) {
      fetch(`/api/tps-mapping/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          zona: newZone, 
          lastUpdatedBy: currentUser.name, 
          lastUpdatedDate: updatedDate 
        })
      }).catch(err => console.error('Error updating TPS zone:', err));
    }

    pushAuditLog(`Mengubah status zona TPS ID: ${id} menjadi ${newZone.toUpperCase()}`);
  };
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

  const toggleExecutor = (member: Member) => {
    if (newActivityExecutors.some(m => m.id === member.id)) {
      setNewActivityExecutors(prev => prev.filter(m => m.id !== member.id));
    } else {
      setNewActivityExecutors(prev => [...prev, member]);
    }
  };

  // Activities Handlers
  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityTitle.trim() || newActivityExecutors.length === 0 || !newActivityDate || !newActivityLocation.trim()) {
      alert("Harap lengkapi semua data kegiatan yang diperlukan.");
      return;
    }

    const totalRAB = newActivityBudgetTransport + newActivityBudgetMeals + newActivityBudgetAccommodation + newActivityBudgetOther;

    const newAct: PartyActivity = {
      id: `act-${Date.now()}`,
      title: newActivityTitle,
      type: newActivityType,
      executors: newActivityExecutors.map(exec => ({
        id: exec.id,
        name: exec.name,
        role: exec.role
      })),
      date: newActivityDate,
      location: newActivityLocation,
      status: 'rencana',
      budgetTransport: newActivityBudgetTransport,
      budgetMeals: newActivityBudgetMeals,
      budgetAccommodation: newActivityBudgetAccommodation,
      budgetOther: newActivityBudgetOther,
      budgetTotal: totalRAB
    };

    if (isDbConnected) {
      fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAct)
      }).catch(err => console.error('Error saving activity to database:', err));
    }

    setActivities(prev => [newAct, ...prev]);
    setShowActivityModal(false);

    // Reset Form
    setNewActivityTitle('');
    setNewActivityType('Konsolidasi PAC');
    setNewActivityExecutors([]);
    setNewActivityDate('');
    setNewActivityLocation('');
    setNewActivityBudgetTransport(0);
    setNewActivityBudgetMeals(0);
    setNewActivityBudgetAccommodation(0);
    setNewActivityBudgetOther(0);
    
    pushAuditLog(`Mendaftarkan rencana kegiatan baru: ${newAct.title}`);
  };

  const handleUpdateActivityStatus = (activityId: string, nextStatus: PartyActivity['status']) => {
    const target = activities.find(a => a.id === activityId);
    if (!target) return;

    if (isDbConnected) {
      fetch(`/api/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: nextStatus,
          submitterId: currentUser.id,
          submitterName: currentUser.name
        })
      }).catch(err => console.error('Error updating activity status in database:', err));
    }

    // Sync financial records locally if approved
    if (nextStatus === 'disetujui' && target.status !== 'disetujui' && target.status !== 'pelaksanaan' && target.status !== 'selesai') {
      const fundId = `f-act-${Date.now()}`;
      const executorsList = target.executors.map(e => `${e.name} (${e.role.toUpperCase()})`).join(', ');
      const fundTitle = `RAB Kegiatan: ${target.title}`;
      const fundDesc = `Pembiayaan kegiatan [${target.type}] di [${target.location}]. Pelaksana: ${executorsList}`;
      const currentDate = new Date().toISOString().slice(0, 10);

      const newFund: OperationalFund = {
        id: fundId,
        type: 'expense',
        amount: target.budgetTotal,
        category: 'Kegiatan',
        title: fundTitle,
        description: fundDesc,
        date: currentDate,
        submitterId: currentUser.id,
        submitterName: currentUser.name
      };

      setFunds(prev => [newFund, ...prev]);
    }

    setActivities(prev => 
      prev.map(a => a.id === activityId ? { ...a, status: nextStatus } : a)
    );

    pushAuditLog(`Mengubah status kegiatan "${target.title}" menjadi ${nextStatus.toUpperCase()}`);
  };

  const handleSubmitActivityReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityReportDescription.trim()) return;

    if (isDbConnected) {
      fetch(`/api/activities/${selectedActivityIdForReport}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'selesai',
          reportDescription: newActivityReportDescription,
          reportPhoto: newActivityReportPhoto || null
        })
      }).catch(err => console.error('Error submitting activity report to database:', err));
    }

    setActivities(prev => 
      prev.map(a => a.id === selectedActivityIdForReport 
        ? { ...a, status: 'selesai', reportDescription: newActivityReportDescription, reportPhoto: newActivityReportPhoto || undefined } 
        : a
      )
    );

    const target = activities.find(a => a.id === selectedActivityIdForReport);
    setShowActivityReportModal(false);
    setSelectedActivityIdForReport('');
    setNewActivityReportDescription('');
    setNewActivityReportPhoto('');
    
    if (target) {
      pushAuditLog(`Mengirimkan laporan pelaksanaan kegiatan: ${target.title}`);
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    const target = activities.find(a => a.id === activityId);
    if (!target) return;

    if (confirm(`Apakah Anda yakin ingin menghapus kegiatan "${target.title}"?`)) {
      if (isDbConnected) {
        fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
          .catch(err => console.error('Error deleting activity from database:', err));
      }

      setActivities(prev => prev.filter(a => a.id !== activityId));
      pushAuditLog(`Menghapus kegiatan: ${target.title}`);
    }
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

  // DPT Approach Helpers & Handlers
  const getApproachStatusColor = (status?: 'tidak_prospektif' | 'prospektif' | 'respek' | 'bergabung') => {
    switch (status) {
      case 'tidak_prospektif': return { dot: 'bg-zinc-800 border-zinc-700', text: 'Tidak Prospektif', badge: 'bg-zinc-950 text-zinc-400 border-zinc-800' };
      case 'prospektif': return { dot: 'bg-yellow-500 border-yellow-400', text: 'Prospektif', badge: 'bg-yellow-950 text-yellow-500 border-yellow-900/40' };
      case 'respek': return { dot: 'bg-blue-500 border-blue-400', text: 'Respek', badge: 'bg-blue-950 text-blue-400 border-blue-900/40' };
      case 'bergabung': return { dot: 'bg-red-600 border-red-500', text: 'Bergabung', badge: 'bg-red-950 text-red-400 border-red-900/40' };
      default: return null;
    }
  };

  const handleOpenApproachModal = (member: Member) => {
    setSelectedDptForApproach(member);
    setApproachKaderId(member.approachKaderId || '');
    setApproachStatus(member.approachStatus || 'tidak_prospektif');
    setApproachNotes(member.approachNotes || '');
    setShowApproachModal(true);
  };

  const handleSaveApproach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDptForApproach) return;

    const updatedMember = {
      ...selectedDptForApproach,
      approachStatus,
      approachKaderId: approachKaderId || undefined,
      approachNotes: approachNotes || undefined,
    };

    // Update in local state
    setMembers(prev => prev.map(m => m.id === selectedDptForApproach.id ? updatedMember : m));

    // Update in DB if connected
    if (isDbConnected) {
      fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMember)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          pushAuditLog(`Mengupdate status pendekatan DPT ${selectedDptForApproach.name} menjadi ${approachStatus}`);
        }
      })
      .catch(err => console.error('Error saving approach to database:', err));
    } else {
      pushAuditLog(`Mengupdate status pendekatan DPT ${selectedDptForApproach.name} menjadi ${approachStatus} (Lokal)`);
    }

    setShowApproachModal(false);
    setSelectedDptForApproach(null);
    setApproachKaderId('');
    setApproachStatus('tidak_prospektif');
    setApproachNotes('');
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

  const handleAddMobileMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMobileMember.name || !newMobileMember.nik) {
      alert("Nama dan NIK wajib diisi!");
      return;
    }

    const nextId = `m-${Date.now()}`;
    const ktaPrefix = newMobileMember.role === 'super_admin' ? 'ADMIN-3304' : 'KTA-3304';
    const nextKta = `${ktaPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const memberToAdd: Member = {
      id: nextId,
      name: newMobileMember.name,
      nik: newMobileMember.nik,
      ktaNumber: nextKta,
      role: newMobileMember.role as Member['role'],
      kecamatan: newMobileMember.kecamatan,
      desa: newMobileMember.desa,
      tps: newMobileMember.tps,
      phone: newMobileMember.phone || '-',
      photoUrl: newMobileMember.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
      lat: newMobileMember.lat,
      lng: newMobileMember.lng,
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

    setMembers(prev => [...prev, memberToAdd]);
    
    // Reset mobile form
    setNewMobileMember({
      name: '',
      nik: '',
      role: 'anggota',
      kecamatan: currentUser.kecamatan || 'Banjarnegara',
      desa: currentUser.desa || 'Semarang',
      tps: 'TPS 01',
      phone: '',
      photoUrl: '',
      lat: -7.3996,
      lng: 109.6976
    });

    pushAuditLog(`Mendaftarkan anggota baru lewat HP: ${memberToAdd.name} (${memberToAdd.ktaNumber})`);
    alert(`Sukses mendaftarkan ${memberToAdd.name} sebagai downline Anda!`);
  };

  const fetchMobileGPS = () => {
    setGpsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewMobileMember(prev => ({
            ...prev,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }));
          setGpsLoading(false);
          alert(`Koordinat GPS Berhasil Diambil: ${position.coords.latitude}, ${position.coords.longitude}`);
        },
        (error) => {
          console.error(error);
          const coords = KECAMATAN_COORDS[newMobileMember.kecamatan] || KECAMATAN_COORDS['Banjarnegara'];
          const offsetLat = coords.lat + (Math.random() - 0.5) * 0.01;
          const offsetLng = coords.lng + (Math.random() - 0.5) * 0.01;
          setNewMobileMember(prev => ({
            ...prev,
            lat: offsetLat,
            lng: offsetLng
          }));
          setGpsLoading(false);
          alert("Gagal mengakses GPS. Menggunakan simulasi koordinat presisi wilayah.");
        }
      );
    } else {
      const coords = KECAMATAN_COORDS[newMobileMember.kecamatan] || KECAMATAN_COORDS['Banjarnegara'];
      setNewMobileMember(prev => ({
        ...prev,
        lat: coords.lat + (Math.random() - 0.5) * 0.01,
        lng: coords.lng + (Math.random() - 0.5) * 0.01
      }));
      setGpsLoading(false);
      alert("Browser tidak mendukung GPS. Menggunakan simulasi koordinat wilayah.");
    }
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
      <div className="min-h-screen w-full flex font-sans bg-white">
        
        {/* Left Side (Form) */}
        <div className="w-full lg:w-5/12 flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white relative z-10">
          
          {/* Logo at top left */}
          <div className="absolute top-8 left-8 sm:left-12 flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="PDI Perjuangan" 
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="font-serif font-black text-lg tracking-widest text-gray-900 leading-none">PDI PERJUANGAN</h1>
              <p className="text-[10px] text-pdip-red uppercase tracking-widest font-bold mt-0.5">DPC KAB. BANJARNEGARA</p>
            </div>
          </div>

          <div className="w-full max-w-sm mx-auto space-y-8 animate-fadeIn mt-24 lg:mt-0">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Mulai perjalanan Anda</p>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Masuk Portal Pemenangan</h2>
            </div>

            {loginError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
                ⚠️ {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-1.5 relative mt-2">
                <label className="text-xs text-pdip-red font-bold absolute -top-2 left-3 bg-white px-1 z-10">No. KTA atau NIK</label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Contoh: KTA-3304-001 / 3304..."
                  className="w-full bg-white border-2 border-gray-200 rounded-lg px-4 py-3.5 text-sm text-gray-800 focus:outline-none focus:border-pdip-red transition shadow-sm"
                />
              </div>

              <div className="space-y-1.5 relative mt-2">
                <label className="text-xs text-pdip-red font-bold absolute -top-2 left-3 bg-white px-1 z-10">Password Sandi</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan password Anda..."
                    className="w-full bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-3.5 text-sm text-gray-800 focus:outline-none focus:border-pdip-red transition shadow-sm"
                  />
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <Lock size={16} />
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-pdip-red to-pdip-darkred hover:from-pdip-brightred hover:to-pdip-red text-white py-3.5 rounded-lg text-sm font-bold shadow-lg shadow-red-500/30 transition duration-200 mt-2"
              >
                Sign In / Masuk
              </button>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-400 uppercase tracking-widest">Atau masuk dengan</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileDevice(!isMobileDevice)}
                className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                {isMobileDevice ? "💻 Beralih Tampilan Desktop" : "📱 Beralih Tampilan Mobile"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side (Image) */}
        <div className="hidden lg:block lg:w-7/12 relative bg-pdip-black overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.1)]">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-10000 hover:scale-105"
            style={{ backgroundImage: 'url("/login.jpg")' }}
          ></div>
        </div>

      </div>
    );
  }



  // MOBILE DEVICE LAYOUT
  if (isLoggedIn && isMobileDevice) {
    const mobileDownlines = members.filter(m => m.parentId === currentUser.id);
    const totalUnreadMessages = messages.filter(m => m.receiverId === currentUser.id && !m.read).length;

    // Handle broadcast submit (for admin roles)
    const handleAddBroadcast = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newBroadcastTitle.trim() || !newBroadcastContent.trim()) {
        alert("Judul dan isi pengumuman wajib diisi!");
        return;
      }
      const newBC = {
        id: `b-${Date.now()}`,
        title: newBroadcastTitle.trim(),
        content: newBroadcastContent.trim(),
        timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        senderName: `${currentUser.name} (${currentUser.role.replace('_', ' ').toUpperCase()})`
      };
      setBroadcasts([newBC, ...broadcasts]);
      setNewBroadcastTitle('');
      setNewBroadcastContent('');
      alert("Pengumuman broadcast berhasil disiarkan!");
    };

    return (
      <div className="min-h-screen bg-pdip-black text-gray-100 flex flex-col font-sans relative pb-20">
        
        {/* Header */}
        <header className="bg-pdip-metal border-b border-red-900/30 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="PDI-P logo" className="w-8 h-8 object-contain" />
            <div>
              <span className="font-bold text-xs text-red-500 font-serif block tracking-wider leading-none">PDI PERJUANGAN</span>
              <span className="text-[8px] text-gray-400 block mt-0.5">DPC Banjarnegara - Portal HP</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <span className="text-[9px] bg-red-950/80 text-red-400 border border-red-900/25 px-2 py-0.5 rounded-full font-bold block max-w-[90px] truncate">
                {currentUser.name}
              </span>
            </div>
            <button 
              onClick={() => setIsMobileDevice(false)} 
              title="Aktifkan Tampilan Desktop"
              className="text-gray-400 hover:text-white p-1.5 bg-pdip-darkgray hover:bg-gray-800 rounded transition"
            >
              <span className="text-xs">💻</span>
            </button>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 p-1.5 bg-pdip-darkgray hover:bg-red-950/40 rounded transition">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Main scrollable body area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          
          {/* TAB 1: BERANDA */}
          {mobileTab === 'beranda' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Profile Card */}
              <div className="bg-gradient-to-r from-pdip-darkred/40 via-pdip-metal to-pdip-metal border border-red-900/25 p-4 rounded-2xl flex items-center gap-4 shadow-lg">
                <img src={currentUser.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-red-500 shadow-md shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider block">Kader Perekrut</span>
                  <h3 className="font-bold text-sm text-white truncate leading-tight">{currentUser.name}</h3>
                  <span className="text-[8px] bg-pdip-black text-gray-400 border border-red-900/20 px-1.5 py-0.5 rounded block w-max mt-1 font-semibold uppercase">
                    {currentUser.role.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Quick statistics widgets */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-pdip-metal p-3 rounded-xl border border-red-950/20 flex flex-col justify-between">
                  <span className="text-[9px] text-gray-400 font-bold uppercase">Downline Anda</span>
                  <h4 className="text-xl font-black text-white mt-1.5">{mobileDownlines.length} <span className="text-[10px] text-gray-500 font-normal">Kader</span></h4>
                </div>
                <div className="bg-pdip-metal p-3 rounded-xl border border-red-950/20 flex flex-col justify-between">
                  <span className="text-[9px] text-gray-400 font-bold uppercase">Wilayah Tugas</span>
                  <h4 className="text-xs font-bold text-red-400 truncate mt-2">{currentUser.kecamatan}</h4>
                </div>
              </div>

              {/* Announcement creation for admins */}
              {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc' || currentUser.role === 'bapilu') && (
                <div className="bg-pdip-metal p-4 rounded-xl border border-red-950/20 shadow space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-pdip-gold flex items-center gap-1">
                    📢 Siarkan Pengumuman (Admin)
                  </h4>
                  <form onSubmit={handleAddBroadcast} className="space-y-2.5">
                    <input 
                      type="text" 
                      placeholder="Judul pengumuman..."
                      value={newBroadcastTitle}
                      onChange={(e) => setNewBroadcastTitle(e.target.value)}
                      required
                      className="w-full bg-pdip-black text-xs text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                    />
                    <textarea 
                      placeholder="Tulis pesan pengumuman untuk seluruh kader..."
                      value={newBroadcastContent}
                      onChange={(e) => setNewBroadcastContent(e.target.value)}
                      required
                      rows={2}
                      className="w-full bg-pdip-black text-xs text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red resize-none"
                    />
                    <button type="submit" className="w-full bg-pdip-red hover:bg-pdip-brightred text-white py-2 rounded-lg text-xs font-bold transition">
                      Kirim Broadcast / Siarkan
                    </button>
                  </form>
                </div>
              )}

              {/* Broadcast announcement feed */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Pengumuman & Instruksi Resmi</h4>
                {broadcasts.length > 0 ? (
                  <div className="space-y-3">
                    {broadcasts.map(bc => (
                      <div key={bc.id} className="bg-pdip-metal p-4 rounded-xl border border-red-900/15 shadow-sm space-y-2.5 animate-fadeIn">
                        <div className="flex justify-between items-start gap-2">
                          <h5 className="font-bold text-xs text-white">{bc.title}</h5>
                          <span className="text-[8px] text-gray-500 font-mono shrink-0">{bc.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed font-sans">{bc.content}</p>
                        <div className="pt-2 border-t border-red-950/10 flex justify-between items-center text-[9px]">
                          <span className="text-red-400 font-semibold">{bc.senderName}</span>
                          <span className="text-[8px] bg-red-950/40 text-red-500 px-1.5 py-0.5 rounded border border-red-900/20 uppercase font-black tracking-wider">RESMI</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-pdip-metal/40 border border-red-950/15 rounded-xl text-center text-xs text-gray-500">
                    Belum ada pengumuman masuk.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: REKRUT */}
          {mobileTab === 'rekrut' && (
            <div className="space-y-5 animate-fadeIn">
              
              <div className="bg-pdip-metal p-4 rounded-xl border border-red-950/20 shadow-md space-y-4">
                <div className="border-b border-red-950/10 pb-2">
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider">Form Perekrutan Downline Baru</h3>
                  <p className="text-[9px] text-gray-400 mt-0.5">Pendataan presisi anggota berbasis foto dan koordinat GPS.</p>
                </div>

                <form onSubmit={handleAddMobileMember} className="space-y-3">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Nama Lengkap Anggota:</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Nama lengkap sesuai KTP..."
                      value={newMobileMember.name}
                      onChange={(e) => setNewMobileMember({...newMobileMember, name: e.target.value})}
                      className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2.5 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">NIK (16 Digit KTP):</label>
                    <input 
                      type="text" 
                      required 
                      maxLength={16}
                      pattern="[0-9]{16}"
                      placeholder="3304..."
                      value={newMobileMember.nik}
                      onChange={(e) => setNewMobileMember({...newMobileMember, nik: e.target.value})}
                      className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2.5 text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">No HP / WhatsApp:</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="08..."
                      value={newMobileMember.phone}
                      onChange={(e) => setNewMobileMember({...newMobileMember, phone: e.target.value})}
                      className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2.5 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">Kecamatan:</label>
                      <select 
                        value={newMobileMember.kecamatan}
                        onChange={(e) => {
                          const kec = e.target.value;
                          setNewMobileMember({
                            ...newMobileMember,
                            kecamatan: kec,
                            desa: BANJARNEGARA_REGIONS[kec][0],
                            lat: KECAMATAN_COORDS[kec].lat + (Math.random() - 0.5) * 0.01,
                            lng: KECAMATAN_COORDS[kec].lng + (Math.random() - 0.5) * 0.01
                          });
                        }}
                        className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2 text-white"
                      >
                        {Object.keys(BANJARNEGARA_REGIONS).map(kec => (
                          <option key={kec} value={kec}>{kec}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">Desa:</label>
                      <select 
                        value={newMobileMember.desa}
                        onChange={(e) => setNewMobileMember({...newMobileMember, desa: e.target.value})}
                        className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2 text-white"
                      >
                        {BANJARNEGARA_REGIONS[newMobileMember.kecamatan].map(des => (
                          <option key={des} value={des}>{des}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">TPS Pilihan:</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="TPS 01"
                        value={newMobileMember.tps}
                        onChange={(e) => setNewMobileMember({...newMobileMember, tps: e.target.value})}
                        className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2 text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">Jabatan/Role:</label>
                      <select 
                        value={newMobileMember.role}
                        onChange={(e) => setNewMobileMember({...newMobileMember, role: e.target.value})}
                        className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2 text-white"
                      >
                        <option value="anggota">Anggota Biasa</option>
                        <option value="relawan_terdaftar">Relawan / Saksi TPS</option>
                        <option value="ketua_ranting">Ketua Ranting</option>
                      </select>
                    </div>
                  </div>

                  {/* Camera / Photo Upload Widget */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold block">Foto KTA / Wajah:</label>
                    <div className="flex items-center gap-3 p-2 bg-pdip-black border border-red-900/20 rounded-lg">
                      <input 
                        type="file" 
                        accept="image/*"
                        id="mobile-photo-upload"
                        onChange={(e) => handlePhotoUpload(e, (url) => setNewMobileMember({...newMobileMember, photoUrl: url}))}
                        className="hidden"
                      />
                      <label htmlFor="mobile-photo-upload" className="bg-pdip-darkgray hover:bg-gray-800 text-[10px] font-bold px-3 py-1.5 border border-red-900/30 rounded cursor-pointer transition flex items-center gap-1">
                        <Upload size={12} /> Pilih Foto
                      </label>
                      {newMobileMember.photoUrl ? (
                        <img src={newMobileMember.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-red-500 shadow-sm" />
                      ) : (
                        <span className="text-[9px] text-gray-500">Pratinjau kosong</span>
                      )}
                    </div>
                  </div>

                  {/* GPS Spasial */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold block">Koordinat Rumah (GPS):</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-pdip-black border border-red-900/20 rounded-lg px-3 py-2 text-[10px] font-mono text-gray-300 flex items-center justify-between">
                        <span>{newMobileMember.lat.toFixed(6)}, {newMobileMember.lng.toFixed(6)}</span>
                      </div>
                      <button 
                        type="button" 
                        disabled={gpsLoading}
                        onClick={fetchMobileGPS}
                        className="bg-pdip-red hover:bg-pdip-brightred text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        {gpsLoading ? <RefreshCw size={12} className="animate-spin" /> : <MapPin size={12} />} GPS
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-gradient-to-r from-pdip-red to-pdip-darkred hover:from-pdip-brightred hover:to-pdip-red text-white py-2.5 rounded-lg text-xs font-bold shadow-md transition pt-2">
                    Simpan Anggota Baru
                  </button>

                </form>
              </div>

              {/* Recruited downlines list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Jaringan Anggota Baru (Kader Downline Anda)</h4>
                {mobileDownlines.length > 0 ? (
                  <div className="space-y-2">
                    {mobileDownlines.map(m => (
                      <div key={m.id} className="bg-pdip-metal p-3 rounded-xl border border-red-950/20 shadow-sm flex items-center gap-3">
                        <img src={m.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-red-900/30 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-xs text-white truncate">{m.name}</h5>
                          <span className="text-[9px] text-red-400 font-mono block leading-none mt-0.5">{m.ktaNumber}</span>
                          <span className="text-[8px] text-gray-400 block mt-1 font-semibold uppercase">{m.role.replace('_', ' ')} &bull; {m.desa}</span>
                        </div>
                        <div className="text-right text-[8px] text-gray-500 font-mono">
                          {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-pdip-metal/40 border border-red-950/15 rounded-xl text-center text-xs text-gray-500">
                    Anda belum mendaftarkan kader downline lewat aplikasi ini.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: LAPOR */}
          {mobileTab === 'lapor' && (
            <div className="space-y-5 animate-fadeIn">
              
              <div className="bg-pdip-metal p-4 rounded-xl border border-red-950/20 shadow-md space-y-4">
                <div className="border-b border-red-950/10 pb-2">
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider">Kirim Laporan Lapangan</h3>
                  <p className="text-[9px] text-gray-400 mt-0.5">Unggah insiden, temuan lapangan, atau kegiatan partai.</p>
                </div>

                <form onSubmit={handleAddReport} className="space-y-3">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Judul Kejadian / Laporan:</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Contoh: Temuan APK Rusak di desa..."
                      value={newReportState.title}
                      onChange={(e) => setNewReportState({...newReportState, title: e.target.value})}
                      className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2.5 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Kategori Laporan:</label>
                    <select 
                      value={newReportState.category}
                      onChange={(e) => setNewReportState({...newReportState, category: e.target.value as any})}
                      className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2 text-white"
                    >
                      <option value="Kegiatan Rutin">Kegiatan Rutin</option>
                      <option value="Insiden">Insiden / Pelanggaran</option>
                      <option value="Darurat">Darurat Lapangan</option>
                      <option value="Perekrutan">Perekrutan Massa</option>
                      <option value="Lainnya">Kategori Lainnya</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold">Detail Kejadian:</label>
                    <textarea 
                      required 
                      rows={3}
                      placeholder="Tuliskan penjelasan lengkap terkait laporan atau kejadian lapangan..."
                      value={newReportState.details}
                      onChange={(e) => setNewReportState({...newReportState, details: e.target.value})}
                      className="w-full bg-pdip-black text-xs border border-red-900/35 rounded-lg p-2.5 text-white resize-none"
                    />
                  </div>

                  {/* Report photo selection */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] text-gray-400 uppercase font-semibold block">Foto Bukti / Dokumentasi:</label>
                    <div className="flex items-center gap-3 p-2 bg-pdip-black border border-red-900/20 rounded-lg">
                      <input 
                        type="file" 
                        accept="image/*"
                        id="mobile-report-photo"
                        onChange={(e) => handlePhotoUpload(e, (url) => setNewReportState({...newReportState, photoUrl: url}))}
                        className="hidden"
                      />
                      <label htmlFor="mobile-report-photo" className="bg-pdip-darkgray hover:bg-gray-800 text-[10px] font-bold px-3 py-1.5 border border-red-900/30 rounded cursor-pointer transition flex items-center gap-1">
                        <Upload size={12} /> Ambil Foto
                      </label>
                      {newReportState.photoUrl ? (
                        <img src={newReportState.photoUrl} alt="" className="w-10 h-8 object-cover border border-red-500 rounded" />
                      ) : (
                        <span className="text-[9px] text-gray-500">Pratinjau kosong</span>
                      )}
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-pdip-red hover:bg-pdip-brightred text-white py-2 rounded-lg text-xs font-bold shadow transition mt-2">
                    Kirim Laporan ke DPC
                  </button>

                </form>
              </div>

              {/* User reports list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Daftar Laporan Anda</h4>
                {reports.filter(r => r.submitterId === currentUser.id).length > 0 ? (
                  <div className="space-y-2">
                    {reports.filter(r => r.submitterId === currentUser.id).map(r => (
                      <div key={r.id} className="bg-pdip-metal p-3.5 rounded-xl border border-red-950/20 shadow-sm space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <h5 className="font-bold text-xs text-white">{r.title}</h5>
                          <span className="text-[8px] bg-red-950/50 text-red-400 border border-red-900/25 px-2 py-0.5 rounded font-mono shrink-0">{r.category}</span>
                        </div>
                        <p className="text-[10px] text-gray-300 leading-normal font-sans">{r.details}</p>
                        {r.photoUrl && (
                          <img src={r.photoUrl} alt="" className="w-full h-32 object-cover rounded-lg border border-red-950/30" />
                        )}
                        <div className="flex justify-between items-center text-[8px] text-gray-500 pt-1 border-t border-red-950/10">
                          <span>Wilayah: {r.kecamatan}</span>
                          <span>{r.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-pdip-metal/40 border border-red-950/15 rounded-xl text-center text-xs text-gray-500">
                    Anda belum mengirimkan laporan apapun hari ini.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: PESAN PRIVATE */}
          {mobileTab === 'pesan_broadcast' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Contact list for chats */}
              <div className="bg-pdip-metal p-4 rounded-xl border border-red-950/20 shadow-md space-y-4">
                <div className="border-b border-red-950/10 pb-2">
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider">Perpesanan Private Antar Kader</h3>
                  <p className="text-[9px] text-gray-400 mt-0.5">Pilih salah satu kontak di bawah untuk memulai chat secure.</p>
                </div>

                {/* Filter and search contact */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    <Search size={12} />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari kontak kader..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full bg-pdip-black text-[11px] text-white pl-8 pr-4 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                  />
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {members
                    .filter(m => m.id !== currentUser.id && m.name.toLowerCase().includes(contactSearch.toLowerCase()))
                    .map(m => {
                      const hasUnread = messages.some(msg => msg.senderId === m.id && msg.receiverId === currentUser.id && !msg.read);
                      return (
                        <button
                          key={m.id}
                          onClick={() => setActiveChatUserId(m.id)}
                          className={`w-full p-2 rounded-lg flex items-center gap-2.5 text-left border transition ${
                            activeChatUserId === m.id
                              ? 'bg-pdip-red/20 border-pdip-red'
                              : 'bg-pdip-black/30 border-red-950/10 hover:bg-pdip-black/60'
                          }`}
                        >
                          <img src={m.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-red-900/20 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-xs text-white block truncate leading-none">{m.name}</span>
                            <span className="text-[8px] text-gray-400 block mt-1 uppercase">{m.role.replace('_', ' ')}</span>
                          </div>
                          {hasUnread && (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Chat room area */}
              <div className="bg-pdip-metal rounded-xl border border-red-950/20 shadow-md overflow-hidden flex flex-col min-h-[300px]">
                {activeChatUserId ? (
                  (() => {
                    const activeChatUser = members.find(m => m.id === activeChatUserId);
                    if (!activeChatUser) return null;

                    // Filter chat history
                    const chatHistory = messages.filter(msg => 
                      (msg.senderId === currentUser.id && msg.receiverId === activeChatUser.id) ||
                      (msg.senderId === activeChatUser.id && msg.receiverId === currentUser.id)
                    );

                    return (
                      <>
                        <div className="bg-pdip-darkgray/40 px-4 py-2.5 border-b border-red-950/20 flex items-center gap-2.5">
                          <img src={activeChatUser.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-red-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-xs text-white block truncate leading-none">{activeChatUser.name}</span>
                            <span className="text-[8px] text-gray-400 block mt-0.5 uppercase tracking-wider">{activeChatUser.role.replace('_', ' ')}</span>
                          </div>
                        </div>

                        {/* Messages panel */}
                        <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-pdip-black/20 max-h-[220px]">
                          {chatHistory.length > 0 ? (
                            chatHistory.map((msg) => {
                              const isMe = msg.senderId === currentUser.id;
                              return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                                  <div className={`max-w-[80%] p-2.5 rounded-xl border text-[11px] leading-normal shadow-sm space-y-1 ${
                                    isMe 
                                      ? 'bg-pdip-red text-white border-red-900/35 rounded-br-none' 
                                      : 'bg-pdip-darkgray text-gray-200 border-red-955/15 rounded-bl-none'
                                  }`}>
                                    <p>{msg.content}</p>
                                    <span className="text-[7px] text-gray-400 block text-right font-mono leading-none">{msg.timestamp}</span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="h-full flex items-center justify-center text-[10px] text-gray-500 p-8 text-center">
                              Mulai obrolan dengan {activeChatUser.name}.
                            </div>
                          )}
                        </div>

                        {/* Send message form */}
                        <form onSubmit={handleSendMsg} className="p-2.5 bg-pdip-darkgray/30 border-t border-red-950/20 flex gap-2">
                          <input
                            type="text"
                            required
                            value={newMsgContent}
                            onChange={(e) => setNewMsgContent(e.target.value)}
                            placeholder="Tulis pesan Anda..."
                            className="flex-1 bg-pdip-black text-xs text-white px-3 py-2 border border-red-900/20 rounded-lg focus:outline-none focus:border-pdip-red"
                          />
                          <button
                            type="submit"
                            className="bg-pdip-red hover:bg-pdip-brightred text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                          >
                            <Send size={11} /> Kirim
                          </button>
                        </form>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-[10px] space-y-2 p-8 text-center">
                    <Mail size={24} className="text-gray-600 animate-bounce" />
                    <span>Silakan pilih kontak kader di atas untuk bertukar pesan.</span>
                  </div>
                )}
              </div>

            </div>
          )}
          {/* TAB 5: DDS TRACKER */}
          {mobileTab === 'dds' && (
            <div className="animate-fadeIn">
              <DdsTracker 
                logs={ddsLogs}
                members={members}
                currentUser={currentUser}
                onAddLog={(newLog) => setDdsLogs(prev => [newLog, ...prev])}
              />
            </div>
          )}
          {/* TAB 6: ADVOKASI RAKYAT */}
          {mobileTab === 'advokasi' && (
            <div className="animate-fadeIn">
              <AdvocacyManager 
                tickets={advocacyTickets}
                currentUser={currentUser}
                onAddTicket={handleAddAdvocacyTicket}
                onUpdateTicket={handleUpdateAdvocacyTicket}
                onDeleteTicket={handleDeleteAdvocacyTicket}
              />
            </div>
          )}
          {/* TAB: SAKSI TPS */}
          {mobileTab === 'saksi' && (
            <div className="animate-fadeIn">
              <WitnessManager 
                tpsList={tpsData}
                members={members}
                currentUser={currentUser}
                onUpdateWitness={handleUpdateWitness}
              />
            </div>
          )}
          {/* TAB 7: TIMELINE STRATEGIS */}
          {mobileTab === 'timeline' && (
            <div className="animate-fadeIn">
              <StrategicTimeline 
                milestones={milestones}
                currentUser={currentUser}
                onUpdateMilestone={handleUpdateMilestone}
              />
            </div>
          )}

        </div>

        {/* BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 inset-x-0 bg-pdip-metal/95 backdrop-blur border-t border-red-900/20 h-16 flex items-center justify-around z-50 shadow-2xl">
          {[
            { id: 'beranda', label: 'Beranda', icon: Shield },
            { id: 'rekrut', label: 'Rekrut', icon: Plus },
            { id: 'dds', label: 'DDS Tracker', icon: MapPin },
            { id: 'advokasi', label: 'Advokasi', icon: HeartHandshake },
            { id: 'saksi', label: 'Saksi TPS', icon: Users },
            { id: 'timeline', label: 'Timeline', icon: Calendar },
            { id: 'lapor', label: 'Lapor', icon: Award },
            { id: 'pesan_broadcast', label: 'Pesan', icon: Mail, badge: totalUnreadMessages }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id as any)}
                className="flex flex-col items-center justify-center relative flex-1 h-full py-1 text-center"
              >
                <div className={`p-1.5 rounded-xl transition ${isActive ? 'text-red-500 bg-red-950/20' : 'text-gray-400'}`}>
                  <Icon size={18} />
                </div>
                <span className={`text-[8px] mt-0.5 font-bold uppercase tracking-wider leading-none ${isActive ? 'text-white' : 'text-gray-500'}`}>
                  {tab.label}
                </span>
                
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute top-2.5 right-6 bg-pdip-red text-white text-[7px] font-black px-1.5 py-0.5 rounded-full border border-red-950 animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

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
              { id: 'tracker-kta', label: 'Tracker Target KTA', icon: Target },
              { id: 'saksi', label: 'Penempatan Saksi 100%', icon: Users },
              { id: 'dds-tracker', label: 'DDS Tracker (Campaign)', icon: MapPin },
              { id: 'advokasi', label: 'Advokasi Bantuan Sosial', icon: HeartHandshake },
              { id: 'timeline', label: 'Timeline Strategis 26-29', icon: Calendar },
              { id: 'dpt', label: 'Daftar DPT Wilayah', icon: ListCollapse },
              { id: 'laporan', label: 'Laporan & Peristiwa', icon: Award },
              { id: 'perpesanan', label: 'Perpesanan Private', icon: Mail },
              { id: 'gis', label: 'GIS & Peta Sebaran', icon: Map },
              { id: 'kaderisasi', label: 'Kaderisasi E-Learning', icon: BookOpen },
              { id: 'logistik', label: 'Logistik & Distribusi', icon: Truck },
              { id: 'aspirasi', label: 'Aspirasi & DPRD', icon: MessageSquare },
              { id: 'kegiatan', label: 'Manajemen Kegiatan', icon: Calendar },
              { id: 'quickcount', label: 'TPS & Quick Count C1', icon: RefreshCw },
              { id: 'sainte-lague', label: 'Simulasi Sainte-Laguë', icon: Calculator },
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

        {/* View Switcher and Logout Buttons */}
        <div className="mt-8 pt-4 border-t border-red-900/20 space-y-2">
          <button
            onClick={() => setIsMobileDevice(!isMobileDevice)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold text-gray-400 hover:bg-pdip-darkgray hover:text-white transition duration-200 border border-red-900/10"
          >
            <span>{isMobileDevice ? "💻" : "📱"}</span>
            <span>Tampilan {isMobileDevice ? "Desktop" : "Mobile (HP)"}</span>
          </button>

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
                        Transparansi Jaringan Organisasi
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
                  <BarChart3 size={16} className="text-pdip-red" /> Jaringan downline Terbanyak di Bawah Anda
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
              <OrgChartComponent 
                members={members}
                tpsList={tpsData}
                onAddMember={() => setShowAddMemberModal(true)}
                onAssignWitness={() => {
                  setActiveTab('saksi');
                }}
              />
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

            {/* GIS Mode Toggler & Statistics */}
            <div className="bg-pdip-metal p-4 rounded-xl border border-red-950/20 shadow-md">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                <div className="flex bg-pdip-black p-1 rounded-lg border border-red-900/30">
                  <button
                    onClick={() => setGisMode('kader')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${gisMode === 'kader' ? 'bg-pdip-red text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                    Sebaran Kader
                  </button>
                  <button
                    onClick={() => setGisMode('tps')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${gisMode === 'tps' ? 'bg-pdip-red text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                    Pemetaan TPS
                  </button>
                </div>
                
                {gisMode === 'tps' && (
                  <div className="flex gap-4">
                    <div className="bg-red-950/30 px-3 py-1.5 rounded-lg border border-red-900/50 flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">TPS Merah</span>
                      <span className="text-lg font-black text-red-500">{tpsData.filter(t => t.zona === 'merah').length}</span>
                    </div>
                    <div className="bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-900/50 flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">TPS Kuning</span>
                      <span className="text-lg font-black text-amber-500">{tpsData.filter(t => t.zona === 'kuning').length}</span>
                    </div>
                    <div className="bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50 flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">TPS Hijau</span>
                      <span className="text-lg font-black text-emerald-500">{tpsData.filter(t => t.zona === 'hijau').length}</span>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => setMapCenter([-7.3996, 109.6976])}
                  className="bg-pdip-darkgray hover:bg-gray-800 text-white font-semibold px-3 py-1.5 rounded border border-red-900/20 transition flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Reset Peta
                </button>
              </div>

              {/* Dynamic Legenda */}
              <div className="flex flex-wrap gap-4 items-center text-xs">
                <span className="font-bold uppercase tracking-wider text-gray-400">Filter Peta Sebaran:</span>
                {gisMode === 'kader' ? (
                  <>
                    <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 bg-purple-600 rounded-full border border-white"></span><span>Super Admin</span></div>
                    <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 bg-amber-500 rounded-full border border-white"></span><span>Pimpinan DPC</span></div>
                    <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 bg-red-600 rounded-full border border-white"></span><span>Anggota Dewan</span></div>
                    <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 bg-red-400 rounded-full border border-white"></span><span>Kader / Downline</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-600 rounded-sm border border-white"></span><span>Merah (Basis Kuat)</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-500 rounded-sm border border-white"></span><span>Kuning (Swing)</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-sm border border-white"></span><span>Hijau (Basis Lawan)</span></div>
                  </>
                )}
              </div>
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
                {gisMode === 'kader' ? (
                  visibleMembersList.map((m) => {
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
                  })
                ) : (
                  tpsData.map((tps) => (
                    <Marker 
                      key={tps.id} 
                      position={[tps.lat, tps.lng]} 
                      icon={createTpsMarker(tps.zona)}
                    >
                      <Popup>
                        <div className="w-56 font-sans">
                          <div className="mb-2 border-b border-red-900/10 pb-2">
                            <h4 className="font-bold text-sm text-white leading-tight">{tps.namaTps}</h4>
                            <span className="text-[10px] text-gray-400 block">{tps.desa}, Kec. {tps.kecamatan}</span>
                          </div>
                          <div className="space-y-2 text-xs text-gray-300 mb-3">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Potensi DPT:</span>
                              <span className="font-bold text-white bg-pdip-black px-2 py-0.5 rounded border border-gray-700">{tps.dptCount}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Status Saat Ini:</span>
                              <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded border ${
                                tps.zona === 'merah' ? 'bg-red-950 text-red-400 border-red-900/50' : 
                                tps.zona === 'kuning' ? 'bg-amber-950 text-amber-400 border-amber-900/50' : 
                                'bg-emerald-950 text-emerald-400 border-emerald-900/50'
                              }`}>{tps.zona}</span>
                            </div>
                            <div className="text-[9px] text-gray-500 italic mt-1">
                              Diperbarui: {tps.lastUpdatedDate} oleh {tps.lastUpdatedBy}
                            </div>
                          </div>
                          
                          <div className="border-t border-red-900/20 pt-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Ubah Status Zona:</span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleTpsZoneChange(tps.id, 'merah')}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold py-1.5 rounded transition"
                              >Merah</button>
                              <button 
                                onClick={() => handleTpsZoneChange(tps.id, 'kuning')}
                                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold py-1.5 rounded transition"
                              >Kuning</button>
                              <button 
                                onClick={() => handleTpsZoneChange(tps.id, 'hijau')}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1.5 rounded transition"
                              >Hijau</button>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))
                )}
              </MapContainer>
            </div>

            {/* TPS Mapping Management Table (Visible in TPS Mode) */}
            {gisMode === 'tps' && (
              <div className="bg-pdip-metal rounded-xl border border-red-950/20 shadow-xl overflow-hidden animate-slideUp">
                <div className="bg-pdip-black/40 px-6 py-4 border-b border-red-900/10 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <LayoutList size={18} className="text-pdip-red" /> Daftar Pemetaan Strategis TPS
                    </h3>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Manajemen Basis Data & Penentuan Status Kerawanan Wilayah</p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-grow md:flex-grow-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                      <input 
                        type="text" 
                        placeholder="Cari TPS/Desa/Kec..." 
                        value={tpsSearch}
                        onChange={(e) => setTpsSearch(e.target.value)}
                        className="bg-pdip-black border border-red-900/30 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 w-full md:w-64 transition-all"
                      />
                    </div>
                    <button className="bg-pdip-red hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-lg shadow-red-900/20">
                      <Plus size={14} /> Tambah TPS
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-pdip-darkgray text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-3 border-b border-red-900/10">Identitas TPS</th>
                        <th className="px-6 py-3 border-b border-red-900/10">Wilayah / Desa</th>
                        <th className="px-6 py-3 border-b border-red-900/10 text-center">Estimasi DPT</th>
                        <th className="px-6 py-3 border-b border-red-900/10">Klasifikasi Zona</th>
                        <th className="px-6 py-3 border-b border-red-900/10">Log Update</th>
                        <th className="px-6 py-3 border-b border-red-900/10 text-right">Navigasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-900/5">
                      {filteredTpsData.length > 0 ? (
                        filteredTpsData.map((tps) => (
                          <tr key={tps.id} className="hover:bg-red-900/5 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">{tps.namaTps}</div>
                              <div className="text-[9px] text-gray-500 font-mono tracking-tighter">{tps.id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs text-gray-300 font-semibold">{tps.desa}</div>
                              <div className="text-[10px] text-gray-500">Kecamatan {tps.kecamatan}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm font-mono font-bold text-white bg-pdip-black px-2 py-1 rounded border border-gray-800">{tps.dptCount}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex gap-1.5">
                                {(['merah', 'kuning', 'hijau'] as const).map((z) => (
                                  <button
                                    key={z}
                                    onClick={() => handleTpsZoneChange(tps.id, z)}
                                    className={`px-2 py-1 rounded text-[8px] font-black uppercase border transition-all ${
                                      tps.zona === z 
                                        ? z === 'merah' ? 'bg-red-600 border-red-400 text-white shadow-[0_0_8px_rgba(220,38,38,0.4)] scale-105' :
                                          z === 'kuning' ? 'bg-amber-500 border-amber-300 text-white shadow-[0_0_8px_rgba(245,158,11,0.4)] scale-105' :
                                          'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)] scale-105'
                                        : 'bg-pdip-black/50 border-gray-800 text-gray-500 hover:border-gray-600 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'
                                    }`}
                                  >
                                    {z}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-[10px] text-gray-300 font-medium">{tps.lastUpdatedBy}</div>
                              <div className="text-[9px] text-gray-500 italic flex items-center gap-1">
                                <Calendar size={10} /> {tps.lastUpdatedDate}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button 
                                onClick={() => {
                                  setMapCenter([tps.lat, tps.lng]);
                                  window.scrollTo({ top: 100, behavior: 'smooth' });
                                }}
                                className="p-2 text-gray-400 hover:text-red-400 transition-all bg-pdip-black/30 rounded-lg border border-red-900/10 hover:border-red-500/30 hover:scale-110 active:scale-95"
                                title="Lihat di Peta"
                              >
                                <Locate size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-30">
                              <Search size={32} />
                              <p className="text-sm font-bold">Data TPS tidak ditemukan</p>
                              <button onClick={() => setTpsSearch('')} className="text-[10px] text-red-500 underline uppercase tracking-widest">Reset Pencarian</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                         Pemenangan pemilu modern tidak lagi mengandalkan kampanye massa tradisional saja, melainkan beralih ke strategi **Micro-Targeting** dan **Multi-Level Member Advocacy**. Setiap kader yang direkrut memikul tanggung jawab moral untuk merekrut anggota keluarga terdekat, tetangga, hingga mencapai target pemilih tetap (DPT) per TPS.
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
                         Cara mengembangkan jaringan downline pemenangan secara efektif di tingkat rukun tetangga dan saksi TPS daerah.
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

        {/* ==================== KEGIATAN VIEW ==================== */}
        {activeTab === 'kegiatan' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-950/20 pb-6">
              <div>
                <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
                  <Calendar className="text-pdip-red" /> Manajemen Kegiatan & RAB
                </h2>
                <p className="text-xs text-gray-400 mt-1">Perencanaan, Pengajuan RAB, Persetujuan Pimpinan, Pelaksanaan, dan Laporan Kegiatan</p>
              </div>
              <button
                onClick={() => {
                  setNewActivityExecutors([]);
                  setNewActivityTitle('');
                  setNewActivityLocation('');
                  setNewActivityDate('');
                  setNewActivityBudgetTransport(0);
                  setNewActivityBudgetMeals(0);
                  setNewActivityBudgetAccommodation(0);
                  setNewActivityBudgetOther(0);
                  setExecutorSearchText('');
                  setShowActivityModal(true);
                }}
                className="bg-pdip-red hover:bg-pdip-brightred text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition"
              >
                <Plus size={16} /> Buat Rencana Kegiatan
              </button>
            </div>

            {/* Summary Statistics */}
            {(() => {
              const totalActivities = activities.length;
              const pendingActivities = activities.filter(a => a.status === 'rencana' || a.status === 'pengajuan').length;
              const ongoingActivities = activities.filter(a => a.status === 'disetujui' || a.status === 'pelaksanaan').length;
              const completedActivities = activities.filter(a => a.status === 'selesai').length;
              const totalApprovedBudget = activities
                .filter(a => a.status === 'disetujui' || a.status === 'pelaksanaan' || a.status === 'selesai')
                .reduce((sum, a) => sum + a.budgetTotal, 0);

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-pdip-metal p-4 rounded-xl border border-red-900/20 shadow-md">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Kegiatan</span>
                    <p className="text-2xl font-black text-white mt-1">{totalActivities}</p>
                  </div>
                  <div className="bg-pdip-metal p-4 rounded-xl border border-red-900/20 shadow-md">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block text-yellow-500">Menunggu Persetujuan</span>
                    <p className="text-2xl font-black text-pdip-gold mt-1">{pendingActivities}</p>
                  </div>
                  <div className="bg-pdip-metal p-4 rounded-xl border border-red-900/20 shadow-md">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block text-blue-400">Sedang Berjalan</span>
                    <p className="text-2xl font-black text-blue-400 mt-1">{ongoingActivities}</p>
                  </div>
                  <div className="bg-pdip-metal p-4 rounded-xl border border-red-900/20 shadow-md">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block text-emerald-500">Selesai Laporan</span>
                    <p className="text-2xl font-black text-emerald-500 mt-1">{completedActivities}</p>
                  </div>
                  <div className="bg-pdip-metal p-4 rounded-xl border border-red-900/20 shadow-md col-span-1 sm:col-span-2 lg:col-span-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block text-pdip-gold">Anggaran Disetujui</span>
                    <p className="text-base font-black text-white mt-1 truncate">Rp {totalApprovedBudget.toLocaleString()}</p>
                  </div>
                </div>
              );
            })()}

            {/* Filters bar */}
            <div className="bg-pdip-metal p-4 rounded-xl border border-red-950/20 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <span className="text-xs text-gray-400 font-semibold mr-2">Status:</span>
                {[
                  { value: 'ALL', label: 'Semua' },
                  { value: 'rencana', label: 'Rencana' },
                  { value: 'pengajuan', label: 'Pengajuan' },
                  { value: 'disetujui', label: 'Disetujui' },
                  { value: 'pelaksanaan', label: 'Pelaksanaan' },
                  { value: 'selesai', label: 'Selesai' }
                ].map(opt => {
                  const isActive = filterActivityStatus === opt.value;
                  const count = opt.value === 'ALL' ? activities.length : activities.filter(a => a.status === opt.value).length;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setFilterActivityStatus(opt.value)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-pdip-red text-white font-bold'
                          : 'bg-pdip-black text-gray-400 hover:text-white border border-red-950/20'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-red-950 text-red-300' : 'bg-pdip-darkgray text-gray-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <span className="text-xs text-gray-400 font-semibold shrink-0">Pelaksana:</span>
                <select
                  value={filterActivityExecutor}
                  onChange={(e) => setFilterActivityExecutor(e.target.value)}
                  className="bg-pdip-black text-xs text-gray-300 border border-red-900/30 rounded-lg p-2 w-full md:w-48 focus:outline-none focus:border-pdip-red"
                >
                  <option value="ALL">Semua Pelaksana</option>
                  {members
                    .filter(m => activities.some(a => a.executors.some(e => e.id === m.id)))
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role.replace('_', ' ').toUpperCase()})</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Activities List */}
            {(() => {
              const filteredActivities = activities.filter(act => {
                const matchesStatus = filterActivityStatus === 'ALL' || act.status === filterActivityStatus;
                const matchesExecutor = filterActivityExecutor === 'ALL' || act.executors.some(e => e.id === filterActivityExecutor);
                return matchesStatus && matchesExecutor;
              });

              if (filteredActivities.length === 0) {
                return (
                  <div className="bg-pdip-metal p-12 rounded-xl border border-red-900/10 text-center space-y-4">
                    <Calendar size={48} className="text-gray-650 mx-auto" />
                    <div>
                      <h3 className="font-bold text-white text-base">Tidak Ada Kegiatan</h3>
                      <p className="text-xs text-gray-400 mt-1">Belum ada kegiatan yang terdaftar untuk filter status dan pelaksana ini.</p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {filteredActivities.map((act) => {
                    const statusColors = {
                      rencana: { bg: 'bg-gray-950/45', text: 'text-gray-450', border: 'border-gray-800/40' },
                      pengajuan: { bg: 'bg-yellow-950/40', text: 'text-pdip-gold', border: 'border-yellow-900/40' },
                      disetujui: { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-900/40' },
                      pelaksanaan: { bg: 'bg-orange-950/40', text: 'text-orange-400', border: 'border-orange-900/40' },
                      selesai: { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-900/40' }
                    };

                    const currentStatusColor = statusColors[act.status] || statusColors.rencana;

                    // Compute current index for timeline
                    const steps = ['rencana', 'pengajuan', 'disetujui', 'pelaksanaan', 'selesai'];
                    const currentIndex = steps.indexOf(act.status);

                    return (
                      <div key={act.id} className="bg-pdip-metal rounded-xl border border-red-900/15 shadow-lg overflow-hidden flex flex-col justify-between relative group">
                        
                        {/* Header & Delete action */}
                        <div className="p-6 pb-4 border-b border-red-950/10 flex justify-between items-start gap-4 bg-pdip-black/10">
                          <div className="space-y-1">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                              act.type.includes('Reses') || act.type.includes('Dapil') || act.type.includes('Perda')
                                ? 'bg-amber-950/60 text-amber-400 border border-amber-900/30'
                                : 'bg-red-950/60 text-pdip-red border border-red-900/30'
                            }`}>
                              {act.type}
                            </span>
                            <h3 className="text-base font-bold text-white font-serif tracking-tight leading-snug">{act.title}</h3>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${currentStatusColor.bg} ${currentStatusColor.text} ${currentStatusColor.border}`}>
                              {act.status}
                            </span>
                            
                            {(currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') && (
                              <button
                                onClick={() => handleDeleteActivity(act.id)}
                                className="p-1.5 text-gray-500 hover:text-red-400 bg-pdip-black/20 hover:bg-red-950/30 rounded transition"
                                title="Hapus Kegiatan"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Body Details */}
                        <div className="p-6 space-y-5 flex-1">
                          {/* Location & Date */}
                          <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-pdip-red" />
                              <span>{act.date}</span>
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin size={14} className="text-pdip-red shrink-0" />
                              <span className="truncate">{act.location}</span>
                            </div>
                          </div>

                          {/* Executors (Multiple) */}
                          <div className="space-y-2 bg-pdip-black/25 p-3 rounded-lg border border-red-950/10">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pelaksana Kegiatan ({act.executors.length}):</span>
                            <div className="flex flex-wrap gap-1.5">
                              {act.executors.map(exec => (
                                <span key={exec.id} className="inline-flex items-center text-[10px] bg-red-950/40 border border-red-900/10 text-gray-300 font-medium px-2 py-0.5 rounded">
                                  {exec.name} <span className="text-pdip-gold ml-1">({exec.role.replace('_', ' ').toUpperCase()})</span>
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Simple RAB */}
                          <div className="bg-pdip-black/30 p-4 rounded-xl border border-red-950/15 space-y-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Rincian Anggaran Biaya (RAB):</span>
                            
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                              <div className="flex justify-between border-b border-red-950/5 pb-1">
                                <span className="text-gray-400">Transportasi:</span>
                                <span className="font-bold text-white font-mono">Rp {act.budgetTransport.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-b border-red-950/5 pb-1">
                                <span className="text-gray-400">Konsumsi:</span>
                                <span className="font-bold text-white font-mono">Rp {act.budgetMeals.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-b border-red-950/5 pb-1">
                                <span className="text-gray-400">Akomodasi:</span>
                                <span className="font-bold text-white font-mono">Rp {act.budgetAccommodation.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-b border-red-950/5 pb-1">
                                <span className="text-gray-400">Lain-lain:</span>
                                <span className="font-bold text-white font-mono">Rp {act.budgetOther.toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="pt-2 flex justify-between items-center text-xs border-t border-red-950/10">
                              <strong className="text-gray-300 font-serif">Total Pengajuan RAB:</strong>
                              <strong className="text-xs text-pdip-gold font-mono font-black bg-yellow-950/20 px-2.5 py-0.5 rounded border border-yellow-900/10">
                                Rp {act.budgetTotal.toLocaleString()}
                              </strong>
                            </div>
                          </div>

                          {/* Timeline Workflow */}
                          <div className="space-y-3 pt-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Progres Timeline:</span>
                            
                            <div className="relative flex justify-between items-center px-2">
                              {/* Horizontal Line background */}
                              <div className="absolute left-6 right-6 top-3 h-[2px] bg-pdip-black -z-10">
                                <div 
                                  className="h-full bg-gradient-to-r from-pdip-red to-pdip-gold transition-all duration-300"
                                  style={{ width: `${(currentIndex / 4) * 100}%` }}
                                ></div>
                              </div>

                              {steps.map((st, idx) => {
                                const isPassed = idx <= currentIndex;
                                const isCurrent = idx === currentIndex;
                                return (
                                  <div key={st} className="flex flex-col items-center z-10">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] transition-all duration-300 ${
                                      isCurrent
                                        ? 'bg-pdip-gold border-2 border-white text-pdip-black shadow-lg scale-110'
                                        : isPassed
                                          ? 'bg-pdip-red text-white'
                                          : 'bg-pdip-darkgray text-gray-500 border border-red-950/10'
                                    }`}>
                                      {idx + 1}
                                    </div>
                                    <span className={`text-[8px] mt-1.5 uppercase font-bold tracking-wider ${
                                      isCurrent ? 'text-pdip-gold font-black' : isPassed ? 'text-gray-300' : 'text-gray-600'
                                    }`}>
                                      {st}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Report View (If completed) */}
                          {act.status === 'selesai' && (
                            <div className="bg-emerald-950/10 p-4 rounded-xl border border-emerald-900/20 space-y-3 mt-4 text-xs">
                              <span className="font-bold text-emerald-400 block font-serif">Laporan Pertanggungjawaban Kegiatan:</span>
                              <p className="text-gray-300 italic">"{act.reportDescription}"</p>
                              {act.reportPhoto && (
                                <div className="border border-emerald-900/30 rounded-lg overflow-hidden max-h-[220px] bg-black">
                                  <img 
                                    src={act.reportPhoto} 
                                    alt="Dokumentasi Kegiatan" 
                                    className="w-full h-full object-cover max-h-[220px] hover:scale-105 transition duration-300" 
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions Footer */}
                        {act.status !== 'selesai' && (
                          <div className="p-6 pt-0 border-t border-red-950/10 bg-pdip-black/10 flex flex-wrap gap-2 justify-end">
                            {/* Option 1: Submit for approval (rencana -> pengajuan) */}
                            {act.status === 'rencana' && (
                              <button
                                onClick={() => handleUpdateActivityStatus(act.id, 'pengajuan')}
                                className="bg-pdip-darkgray hover:bg-gray-800 border border-red-900/25 text-gray-300 hover:text-white font-bold text-xs px-3.5 py-2 rounded-lg transition"
                              >
                                Ajukan Persetujuan DPC
                              </button>
                            )}

                            {/* Option 2: Approve RAB (rencana/pengajuan -> disetujui). Only Pimpinan DPC & Super Admin */}
                            {(act.status === 'rencana' || act.status === 'pengajuan') && (currentUser.role === 'super_admin' || currentUser.role === 'pimpinan_dpc') && (
                              <button
                                onClick={() => handleUpdateActivityStatus(act.id, 'disetujui')}
                                className="bg-pdip-red hover:bg-pdip-brightred text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md transition flex items-center gap-1.5"
                              >
                                <Shield size={12} /> Setujui Kegiatan & RAB
                              </button>
                            )}

                            {/* Option 3: Start Execution (disetujui -> pelaksanaan) */}
                            {act.status === 'disetujui' && (
                              <button
                                onClick={() => handleUpdateActivityStatus(act.id, 'pelaksanaan')}
                                className="bg-pdip-red hover:bg-pdip-brightred text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md transition"
                              >
                                Mulai Pelaksanaan
                              </button>
                            )}

                            {/* Option 4: Report (pelaksanaan -> selesai) */}
                            {act.status === 'pelaksanaan' && (
                              <button
                                onClick={() => {
                                  setSelectedActivityIdForReport(act.id);
                                  setNewActivityReportDescription('');
                                  setNewActivityReportPhoto('');
                                  setShowActivityReportModal(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md transition"
                              >
                                Laporkan Hasil Kegiatan
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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
                      <th className="px-6 py-4 text-center">Aksi</th>
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
                            <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
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
                                <div className="flex items-center gap-2.5">
                                  <span 
                                    className={`w-3.5 h-3.5 rounded-full inline-block border-2 ${
                                      m.approachStatus ? getApproachStatusColor(m.approachStatus)?.dot : 'bg-zinc-900 border-zinc-800'
                                    }`} 
                                    title={m.approachStatus ? getApproachStatusColor(m.approachStatus)?.text : 'Belum Ditentukan'}
                                  />
                                  <div>
                                    <span className="font-bold text-white block">{m.name}</span>
                                    {m.approachStatus && (
                                      <span className="text-[10px] text-gray-500 block mt-0.5">
                                        Status: <span className="font-semibold text-gray-400">{getApproachStatusColor(m.approachStatus)?.text}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
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
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={() => handleOpenApproachModal(m)}
                                  className="bg-pdip-red hover:bg-pdip-brightred text-white px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-sm border border-red-800/30"
                                >
                                  <Users size={12} /> Pendekatan
                                </button>
                              </td>
                            </tr>
                          ))}
                          
                          {/* Pagination Row */}
                          {totalPages > 1 && (
                            <tr>
                              <td colSpan={7} className="px-6 py-4 bg-pdip-darkgray/20 border-t border-red-950/20">
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

        {/* ==================== SAINTE LAGUE CALCULATOR VIEW ==================== */}
        {activeTab === 'sainte-lague' && (
          <SainteLagueCalculator />
        )}

        {/* ==================== TRACKER TARGET KTA VIEW ==================== */}
        {activeTab === 'tracker-kta' && (
          <KtaTracker 
            members={members}
            currentUser={currentUser}
            onOpenAddMemberModal={() => setShowAddMemberModal(true)}
          />
        )}

        {/* ==================== DDS KAMPANYE TRACKER VIEW ==================== */}
        {activeTab === 'dds-tracker' && (
          <DdsTracker 
            logs={ddsLogs}
            members={members}
            currentUser={currentUser}
            onAddLog={(newLog) => setDdsLogs(prev => [newLog, ...prev])}
          />
        )}

        {/* ==================== ADVOKASI RAKYAT BANSOS VIEW ==================== */}
        {activeTab === 'advokasi' && (
          <AdvocacyManager 
            tickets={advocacyTickets}
            currentUser={currentUser}
            onAddTicket={handleAddAdvocacyTicket}
            onUpdateTicket={handleUpdateAdvocacyTicket}
            onDeleteTicket={handleDeleteAdvocacyTicket}
          />
        )}

        {/* ==================== STRATEGIC MILESTONE TIMELINE VIEW ==================== */}
        {activeTab === 'timeline' && (
          <StrategicTimeline 
            milestones={milestones}
            currentUser={currentUser}
            onUpdateMilestone={handleUpdateMilestone}
          />
        )}

        {/* ==================== SAKSI & PENGAWALAN TPS VIEW ==================== */}
        {activeTab === 'saksi' && (
          <WitnessManager 
            tpsList={tpsData}
            members={members}
            currentUser={currentUser}
            onUpdateWitness={handleUpdateWitness}
          />
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
                <Plus className="text-pdip-red" /> Rekrut Kader / Downline Baru
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

      {/* Kegiatan Modals */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center bg-pdip-black/20">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Calendar className="text-pdip-red" /> Buat Rencana Kegiatan & RAB
              </h3>
              <button onClick={() => setShowActivityModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddActivity} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Nama / Judul Kegiatan:</label>
                <input
                  required
                  type="text"
                  value={newActivityTitle}
                  onChange={(e) => setNewActivityTitle(e.target.value)}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  placeholder="Contoh: Konsolidasi Akbar Ranting Desa Semarang"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold block">Tanggal Pelaksanaan:</label>
                  <input
                    required
                    type="date"
                    value={newActivityDate}
                    onChange={(e) => setNewActivityDate(e.target.value)}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold block">Lokasi:</label>
                  <input
                    required
                    type="text"
                    value={newActivityLocation}
                    onChange={(e) => setNewActivityLocation(e.target.value)}
                    className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white"
                    placeholder="Contoh: Aula Kecamatan"
                  />
                </div>
              </div>

              {/* Executors picklist with search */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold block">
                  Pilih Pelaksana Kegiatan <span className="text-red-500 font-bold">*Bisa pilih lebih dari satu orang</span>:
                </label>
                <input
                  type="text"
                  value={executorSearchText}
                  onChange={(e) => setExecutorSearchText(e.target.value)}
                  className="w-full bg-pdip-black text-xs border border-red-900/20 rounded-lg p-2 text-white"
                  placeholder="Cari anggota berdasarkan nama atau jabatan..."
                />
                
                <div className="max-h-[150px] overflow-y-auto border border-red-900/20 bg-pdip-black p-3 rounded-lg space-y-2.5">
                  {(() => {
                    const activeMembers = members.filter(m => m.status === 'ACTIVE');
                    const searched = activeMembers.filter(m => 
                      m.name.toLowerCase().includes(executorSearchText.toLowerCase()) || 
                      m.role.replace('_', ' ').toLowerCase().includes(executorSearchText.toLowerCase())
                    );

                    if (searched.length === 0) {
                      return <p className="text-xs text-gray-500 italic text-center py-2">Tidak ada anggota yang cocok</p>;
                    }

                    return searched.map(member => {
                      const isChecked = newActivityExecutors.some(m => m.id === member.id);
                      return (
                        <label key={member.id} className="flex items-center gap-3 cursor-pointer select-none group text-xs text-gray-300 hover:text-white">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleExecutor(member)}
                            className="w-3.5 h-3.5 rounded text-pdip-red bg-pdip-black border-red-900/30 focus:ring-pdip-red"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-white group-hover:text-red-400 transition-colors block truncate">{member.name}</span>
                            <span className="text-[10px] text-gray-500 uppercase">{member.role.replace('_', ' ')}</span>
                          </div>
                        </label>
                      );
                    });
                  })()}
                </div>

                {/* Selected executors quick badges */}
                {newActivityExecutors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {newActivityExecutors.map(exec => (
                      <span key={exec.id} className="inline-flex items-center text-[10px] bg-red-950/40 text-gray-200 border border-red-900/25 px-2 py-0.5 rounded gap-1">
                        <span>{exec.name}</span>
                        <button 
                          type="button" 
                          onClick={() => toggleExecutor(exec)}
                          className="text-red-500 hover:text-red-400 font-bold ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Activity Type */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Jenis Kegiatan:</label>
                <select
                  value={newActivityType}
                  onChange={(e) => setNewActivityType(e.target.value)}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red"
                >
                  {(() => {
                    const hasLegislator = newActivityExecutors.some(exec => exec.role === 'anggota_dewan');
                    if (hasLegislator) {
                      return (
                        <>
                          <option value="Reses">Reses Dewan</option>
                          <option value="Kunjungan Dapil">Kunjungan Dapil</option>
                          <option value="Sosialisasi Perda">Sosialisasi Perda</option>
                          <option value="Lainnya (Legislatif)">Lainnya (Legislatif)</option>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <option value="Konsolidasi PAC">Konsolidasi PAC</option>
                          <option value="Rapat Pleno DPC">Rapat Pleno DPC</option>
                          <option value="Kerja Bakti Sosial">Kerja Bakti Sosial</option>
                          <option value="Musyawarah Ranting">Musyawarah Ranting</option>
                          <option value="Pendidikan Politik Kader">Pendidikan Politik Kader</option>
                          <option value="Lainnya">Lainnya</option>
                        </>
                      );
                    }
                  })()}
                </select>
              </div>

              {/* RAB Inputs */}
              <div className="space-y-3 p-4 bg-pdip-black/25 rounded-xl border border-red-950/15">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Penyusunan Rencana Anggaran Biaya (RAB):</span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Biaya Transportasi (Rp):</label>
                    <input
                      type="number"
                      min={0}
                      value={newActivityBudgetTransport}
                      onChange={(e) => setNewActivityBudgetTransport(parseFloat(e.target.value) || 0)}
                      className="w-full bg-pdip-black text-xs border border-red-900/20 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Biaya Konsumsi/Makan (Rp):</label>
                    <input
                      type="number"
                      min={0}
                      value={newActivityBudgetMeals}
                      onChange={(e) => setNewActivityBudgetMeals(parseFloat(e.target.value) || 0)}
                      className="w-full bg-pdip-black text-xs border border-red-900/20 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Biaya Akomodasi (Rp):</label>
                    <input
                      type="number"
                      min={0}
                      value={newActivityBudgetAccommodation}
                      onChange={(e) => setNewActivityBudgetAccommodation(parseFloat(e.target.value) || 0)}
                      className="w-full bg-pdip-black text-xs border border-red-900/20 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Biaya Lain-lain (Rp):</label>
                    <input
                      type="number"
                      min={0}
                      value={newActivityBudgetOther}
                      onChange={(e) => setNewActivityBudgetOther(parseFloat(e.target.value) || 0)}
                      className="w-full bg-pdip-black text-xs border border-red-900/20 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-red-950/15 flex justify-between items-center text-xs">
                  <strong className="text-gray-300 font-serif">Total RAB Kegiatan:</strong>
                  <strong className="text-sm text-pdip-gold font-mono font-black">
                    Rp {(newActivityBudgetTransport + newActivityBudgetMeals + newActivityBudgetAccommodation + newActivityBudgetOther).toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Submit & Cancel */}
              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button type="button" onClick={() => setShowActivityModal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-pdip-red text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Simpan Kegiatan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showActivityReportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center bg-pdip-black/20">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Calendar className="text-emerald-400" /> Kirim Laporan Pelaksanaan
              </h3>
              <button onClick={() => setShowActivityReportModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitActivityReport} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Deskripsi Pelaksanaan Kegiatan:</label>
                <textarea
                  required
                  rows={4}
                  value={newActivityReportDescription}
                  onChange={(e) => setNewActivityReportDescription(e.target.value)}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white resize-none"
                  placeholder="Tuliskan deskripsi lengkap hasil pelaksanaan kegiatan..."
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold block">Foto Dokumentasi Kegiatan:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, setNewActivityReportPhoto)}
                    className="hidden"
                    id="activity-report-photo-input"
                  />
                  <label
                    htmlFor="activity-report-photo-input"
                    className="bg-pdip-darkgray hover:bg-gray-800 border border-red-900/30 text-gray-300 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer transition flex items-center gap-2"
                  >
                    <Upload size={14} /> Pilih Foto
                  </label>
                  {newActivityReportPhoto && <span className="text-[10px] text-emerald-400 font-semibold">Foto Terpilih ✓</span>}
                </div>
                {newActivityReportPhoto && (
                  <div className="border border-red-900/30 rounded-lg overflow-hidden max-h-[150px] bg-black mt-2">
                    <img src={newActivityReportPhoto} alt="Preview Laporan" className="w-full h-full object-cover max-h-[150px]" />
                  </div>
                )}
              </div>

              {/* Submit & Cancel */}
              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end bg-pdip-black/5 p-4 rounded-xl">
                <button type="button" onClick={() => setShowActivityReportModal(false)} className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition">Batal</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">Kirim Laporan</button>
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

      {/* 7. DPT Approach Modal */}
      {showApproachModal && selectedDptForApproach && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-pdip-metal border border-red-900/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 border-b border-red-950/20 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <Users className="text-pdip-red" /> Pendekatan DPT Wilayah
              </h3>
              <button onClick={() => { setShowApproachModal(false); setSelectedDptForApproach(null); }} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveApproach} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-pdip-black p-4 rounded-xl border border-red-950/20 space-y-1.5">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Informasi DPT</div>
                <div className="text-sm font-bold text-white">{selectedDptForApproach.name}</div>
                <div className="text-xs text-gray-400 font-mono">NIK: {selectedDptForApproach.nik}</div>
                <div className="text-xs text-red-400 font-bold">{selectedDptForApproach.kecamatan} ➔ {selectedDptForApproach.desa} | {selectedDptForApproach.tps}</div>
              </div>

              {/* Dropdown Kader Pengurus */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Kader Pendamping / Penanggung Jawab:</label>
                <select
                  required
                  value={approachKaderId}
                  onChange={(e) => setApproachKaderId(e.target.value)}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white focus:outline-none focus:border-pdip-red"
                >
                  <option value="">Pilih Kader...</option>
                  {members
                    .filter(m => m.role !== 'anggota' && !m.id.startsWith('dpt-'))
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role.replace('_', ' ').toUpperCase()})
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-gray-500 italic block mt-1">
                  Kader bertanggung jawab penuh untuk mengawal suara pemilih ini.
                </span>
              </div>

              {/* Pilihan Status warna */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold block">Status Pendekatan saat ini:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'tidak_prospektif', color: 'bg-zinc-800 border-zinc-700', label: 'Tidak Prospektif' },
                    { key: 'prospektif', color: 'bg-yellow-500 border-yellow-400', label: 'Prospektif' },
                    { key: 'respek', color: 'bg-blue-500 border-blue-400', label: 'Respek' },
                    { key: 'bergabung', color: 'bg-red-600 border-red-500', label: 'Bergabung' },
                  ].map((s) => (
                    <label 
                      key={s.key}
                      className={`flex items-center gap-2 p-2.5 bg-pdip-black/50 border rounded-lg cursor-pointer transition hover:bg-pdip-black ${
                        approachStatus === s.key ? 'border-pdip-red bg-pdip-black text-white' : 'border-red-950/10 text-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="approachStatus"
                        value={s.key}
                        checked={approachStatus === s.key}
                        onChange={() => setApproachStatus(s.key as any)}
                        className="hidden"
                      />
                      <span className={`w-3.5 h-3.5 rounded-full inline-block border ${s.color}`} />
                      <span className="text-xs font-medium">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Catatan Pendekatan */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-semibold block">Catatan Progress Pendekatan:</label>
                <textarea
                  rows={3}
                  value={approachNotes}
                  onChange={(e) => setApproachNotes(e.target.value)}
                  className="w-full bg-pdip-black text-sm border border-red-900/30 rounded-lg p-2.5 text-white resize-none focus:outline-none focus:border-pdip-red"
                  placeholder="Contoh: Sudah dikunjungi 2 kali, berminat dipasang baliho di pekarangan rumah..."
                ></textarea>
              </div>

              <div className="pt-6 border-t border-red-950/20 flex gap-4 justify-end">
                <button 
                  type="button" 
                  onClick={() => { setShowApproachModal(false); setSelectedDptForApproach(null); }} 
                  className="bg-pdip-darkgray text-xs font-semibold px-4 py-2.5 rounded-lg transition text-gray-300 hover:text-white"
                >
                  Batal
                </button>
                <button type="submit" className="bg-pdip-red hover:bg-pdip-brightred text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-md transition">
                  Simpan Progress
                </button>
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
                      Transparansi Jaringan Downline
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
