import { useState, useMemo } from 'react';
import { 
  Users, Clock, ShieldAlert, Award, Search, Filter, 
  MapPin, UserPlus, Trash2, Sparkles, GraduationCap, X, ChevronRight
} from 'lucide-react';
import type { Member, TpsMapping } from '../types';
import { BANJARNEGARA_REGIONS } from '../mockData';
import confetti from 'canvas-confetti';

interface WitnessManagerProps {
  tpsList: TpsMapping[];
  members: Member[];
  currentUser: Member;
  onUpdateWitness: (
    tpsId: string, 
    slot: 1 | 2, 
    witnessId: string | null, 
    witnessName: string | null, 
    witnessStatus?: 'belum_pelatihan' | 'terlatih'
  ) => void;
}

export default function WitnessManager({ 
  tpsList, 
  members, 
  currentUser, 
  onUpdateWitness 
}: WitnessManagerProps) {
  const [selectedKecamatan, setSelectedKecamatan] = useState<string>('all');
  const [selectedDesa, setSelectedDesa] = useState<string>('all');
  const [completenessFilter, setCompletenessFilter] = useState<'all' | 'incomplete' | 'complete'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Assign modal state
  const [assigningTpsId, setAssigningTpsId] = useState<string | null>(null);
  const [assigningSlot, setAssigningSlot] = useState<1 | 2 | null>(null);
  const [kaderSearch, setKaderSearch] = useState<string>('');
  const [kaderKecamatan, setKaderKecamatan] = useState<string>('all');

  // Verify Role authorizations
  const canEdit = useMemo(() => {
    return ['super_admin', 'pimpinan_dpc', 'bapilu'].includes(currentUser.role);
  }, [currentUser]);

  // List of all unique kecamatans in Kabupaten Banjarnegara
  const kecamatans = useMemo(() => {
    return Object.keys(BANJARNEGARA_REGIONS).sort();
  }, []);

  // List of desas based on selected kecamatan
  const desas = useMemo(() => {
    if (selectedKecamatan === 'all') return [];
    return BANJARNEGARA_REGIONS[selectedKecamatan] || [];
  }, [selectedKecamatan]);

  // Handle changes when selected kecamatan changes
  const handleKecamatanChange = (kec: string) => {
    setSelectedKecamatan(kec);
    setSelectedDesa('all');
  };

  // Filtered TPS data
  const filteredTps = useMemo(() => {
    return tpsList.filter(t => {
      const matchKec = selectedKecamatan === 'all' || t.kecamatan === selectedKecamatan;
      const matchDesa = selectedDesa === 'all' || t.desa === selectedDesa;
      
      const isComplete = t.saksi1Id && t.saksi2Id;
      const matchCompleteness = 
        completenessFilter === 'all' ||
        (completenessFilter === 'complete' && isComplete) ||
        (completenessFilter === 'incomplete' && !isComplete);

      const matchSearch = 
        t.namaTps.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.desa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.saksi1Name && t.saksi1Name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.saksi2Name && t.saksi2Name.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchKec && matchDesa && matchCompleteness && matchSearch;
    });
  }, [tpsList, selectedKecamatan, selectedDesa, completenessFilter, searchQuery]);

  // Calculate high-fidelity KPIs
  const stats = useMemo(() => {
    const totalTps = tpsList.length;
    const totalSlots = totalTps * 2;
    
    let filledSlots = 0;
    let completeTpsCount = 0;
    let trainedSaksiCount = 0;

    tpsList.forEach(t => {
      let slotsFilledThisTps = 0;
      if (t.saksi1Id) {
        filledSlots++;
        slotsFilledThisTps++;
        if (t.saksi1Status === 'terlatih') trainedSaksiCount++;
      }
      if (t.saksi2Id) {
        filledSlots++;
        slotsFilledThisTps++;
        if (t.saksi2Status === 'terlatih') trainedSaksiCount++;
      }
      if (slotsFilledThisTps === 2) {
        completeTpsCount++;
      }
    });

    const coveragePercentage = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    const trainingPercentage = filledSlots > 0 ? Math.round((trainedSaksiCount / filledSlots) * 100) : 0;
    const incompleteTpsCount = totalTps - completeTpsCount;

    return {
      totalTps,
      totalSlots,
      filledSlots,
      completeTpsCount,
      incompleteTpsCount,
      trainedSaksiCount,
      coveragePercentage,
      trainingPercentage
    };
  }, [tpsList]);

  // Filter list of eligible members to assign as witness
  const eligibleWitnesses = useMemo(() => {
    return members.filter(m => {
      const matchSearch = 
        m.name.toLowerCase().includes(kaderSearch.toLowerCase()) ||
        m.ktaNumber.toLowerCase().includes(kaderSearch.toLowerCase());
      
      const matchKec = kaderKecamatan === 'all' || m.kecamatan === kaderKecamatan;
      
      const isAlreadyAssigned = tpsList.some(t => 
        (t.saksi1Id === m.id && !(assigningTpsId === t.id && assigningSlot === 1)) ||
        (t.saksi2Id === m.id && !(assigningTpsId === t.id && assigningSlot === 2))
      );

      return matchSearch && matchKec && !isAlreadyAssigned && m.role !== 'super_admin';
    });
  }, [members, kaderSearch, kaderKecamatan, tpsList, assigningTpsId, assigningSlot]);

  // Open Assign Modal
  const openAssignModal = (tpsId: string, slot: 1 | 2) => {
    const tps = tpsList.find(t => t.id === tpsId);
    setAssigningTpsId(tpsId);
    setAssigningSlot(slot);
    setKaderKecamatan(tps ? tps.kecamatan : 'all');
    setKaderSearch('');
  };

  // Perform assignment
  const handleAssign = (kader: Member) => {
    if (!assigningTpsId || !assigningSlot) return;
    
    onUpdateWitness(
      assigningTpsId,
      assigningSlot,
      kader.id,
      kader.name,
      'belum_pelatihan'
    );

    // Confetti on single completed TPS staffing
    const tpsObj = tpsList.find(t => t.id === assigningTpsId);
    if (tpsObj && ((assigningSlot === 1 && tpsObj.saksi2Id) || (assigningSlot === 2 && tpsObj.saksi1Id))) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#DE0611', '#FFD700', '#FFFFFF']
      });
    }

    setAssigningTpsId(null);
    setAssigningSlot(null);
  };

  // Remove witness
  const handleRemoveWitness = (tpsId: string, slot: 1 | 2) => {
    onUpdateWitness(tpsId, slot, null, null, 'belum_pelatihan');
  };

  // Toggle training status
  const handleToggleTraining = (tps: TpsMapping, slot: 1 | 2) => {
    const currentStatus = slot === 1 ? tps.saksi1Status : tps.saksi2Status;
    const nextStatus = currentStatus === 'terlatih' ? 'belum_pelatihan' : 'terlatih';
    const witnessId = slot === 1 ? tps.saksi1Id : tps.saksi2Id;
    const witnessName = (slot === 1 ? tps.saksi1Name : tps.saksi2Name) || null;

    if (!witnessId) return;

    onUpdateWitness(
      tps.id,
      slot,
      witnessId,
      witnessName,
      nextStatus
    );

    if (nextStatus === 'terlatih') {
      confetti({
        particleCount: 80,
        spread: 50,
        colors: ['#10B981', '#FFFFFF', '#DE0611']
      });
    }
  };

  // Trigger grand celebration if 100% achieved!
  const triggerGrandConfetti = () => {
    confetti({
      particleCount: 300,
      spread: 120,
      origin: { y: 0.5 },
      colors: ['#DE0611', '#FFD700', '#10B981', '#1E3A8A', '#FFFFFF']
    });
  };

  return (
    <div className="space-y-6 text-gray-200 animate-fadeIn">
      
      {/* HEADER HERO BANNER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-br from-red-950/70 via-gray-900 to-black border border-red-900/40 shadow-xl">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white tracking-wider flex items-center gap-3">
            <Users className="text-pdip-red animate-pulse" /> 
            Dasbor Penempatan Saksi TPS 100%
          </h2>
          <p className="text-xs text-gray-400 max-w-2xl leading-relaxed uppercase tracking-wider font-semibold">
            Audit Pengawalan TPS & Pelatihan Saksi Teknis PDI Perjuangan Banjarnegara
          </p>
        </div>

        {/* GRAND CELEBRATION BUTTON IF COVERAGE HIGH */}
        {stats.coveragePercentage === 100 && (
          <button
            onClick={triggerGrandConfetti}
            className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black text-xs font-black rounded-xl uppercase tracking-widest flex items-center gap-2 border border-emerald-400 animate-bounce shadow-lg shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4 text-black animate-spin" />
            Rayakan Saksi 100% Terisi!
          </button>
        )}
      </div>

      {/* KPI METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: SAKSI ASSIGNED / TOTAL */}
        <div className="bg-gray-900/60 p-5 rounded-xl border border-gray-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Cakupan Alokasi</span>
            <div className="text-2xl font-black text-white">
              {stats.filledSlots} <span className="text-xs text-gray-400">/ {stats.totalSlots} Saksi</span>
            </div>
            <span className="text-[10px] text-gray-400 block font-semibold">{stats.completeTpsCount} dari {stats.totalTps} TPS terisi lengkap</span>
          </div>
          <div className="relative flex items-center justify-center">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle cx="28" cy="28" r="23" stroke="#1f2937" strokeWidth="4" fill="transparent" />
              <circle cx="28" cy="28" r="23" stroke="#DE0611" strokeWidth="4" fill="transparent"
                strokeDasharray={2 * Math.PI * 23}
                strokeDashoffset={2 * Math.PI * 23 * (1 - stats.coveragePercentage / 100)} 
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="absolute text-[11px] font-black text-white">{stats.coveragePercentage}%</span>
          </div>
        </div>

        {/* CARD 2: INCOMPLETE TPS */}
        <div className="bg-gray-900/60 p-5 rounded-xl border border-gray-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">TPS Belum Lengkap (Merah Muda)</span>
            <div className="text-2xl font-black text-rose-400">
              {stats.incompleteTpsCount} <span className="text-xs text-gray-400">TPS</span>
            </div>
            <span className="text-[10px] text-rose-500/80 block font-semibold">Butuh penempatan kader segera</span>
          </div>
          <div className="p-3.5 bg-rose-950/40 border border-rose-900/30 text-rose-400 rounded-xl">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
          </div>
        </div>

        {/* CARD 3: TRAINED WITNESSES */}
        <div className="bg-gray-900/60 p-5 rounded-xl border border-gray-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Saksi Lulus Pelatihan</span>
            <div className="text-2xl font-black text-emerald-400">
              {stats.trainedSaksiCount} <span className="text-xs text-gray-400">Saksi</span>
            </div>
            <span className="text-[10px] text-gray-400 block font-semibold">{stats.trainingPercentage}% dari saksi teralokasi</span>
          </div>
          <div className="relative flex items-center justify-center">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle cx="28" cy="28" r="23" stroke="#1f2937" strokeWidth="4" fill="transparent" />
              <circle cx="28" cy="28" r="23" stroke="#10B981" strokeWidth="4" fill="transparent"
                strokeDasharray={2 * Math.PI * 23}
                strokeDashoffset={2 * Math.PI * 23 * (1 - stats.trainingPercentage / 100)} 
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="absolute text-[11px] font-black text-white">{stats.trainingPercentage}%</span>
          </div>
        </div>

        {/* CARD 4: TARGET PEMENANGAN */}
        <div className="bg-gray-900/60 p-5 rounded-xl border border-gray-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Status Pengawalan</span>
            <div className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 mt-1">
              <Award className="w-4 h-4 text-amber-500 animate-spin" />
              <span>SIAP KAWAL SUARA ✊</span>
            </div>
            <span className="text-[10px] text-gray-400 block font-semibold leading-relaxed">Pendidikan Guraklih nasional dan pemetaan C1 digital</span>
          </div>
          <div className="p-3 bg-amber-950/40 border border-amber-900/30 text-amber-500 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* FILTER & DATA CONTROLS */}
      <div className="bg-gray-900/60 p-5 rounded-xl border border-gray-800/80 space-y-4">
        
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Filter className="w-3.5 h-3.5 text-pdip-red" /> Filter Pencarian Saksi TPS
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Kecamatan Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Kecamatan</label>
            <select
              value={selectedKecamatan}
              onChange={(e) => handleKecamatanChange(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-900 transition-colors"
            >
              <option value="all">Semua Kecamatan ({kecamatans.length})</option>
              {kecamatans.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Desa Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Desa / Kelurahan</label>
            <select
              value={selectedDesa}
              onChange={(e) => setSelectedDesa(e.target.value)}
              disabled={selectedKecamatan === 'all'}
              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">Semua Desa</option>
              {desas.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Completeness Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Status Keterisian</label>
            <select
              value={completenessFilter}
              onChange={(e) => setCompletenessFilter(e.target.value as any)}
              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-900 transition-colors"
            >
              <option value="all">Semua TPS</option>
              <option value="incomplete">Kurang Saksi (Merah Muda)</option>
              <option value="complete">Sudah Lengkap (2 Saksi)</option>
            </select>
          </div>

          {/* Keyword Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Cari Nama TPS / Saksi</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="TPS 01, Sri Rahayu, dll..."
                className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-gray-300 focus:outline-none focus:border-red-900 transition-colors"
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
            </div>
          </div>

        </div>

      </div>

      {/* TPS LIST TABLE / CARDS CONTAINER */}
      <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl overflow-hidden shadow-lg">
        
        <div className="bg-gradient-to-r from-gray-950 to-gray-900 px-6 py-4 border-b border-gray-800/60 flex items-center justify-between">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span>Daftar Alokasi TPS ({filteredTps.length} TPS Terfilter)</span>
          </div>
          <span className="text-[10px] text-gray-500 italic">Klik stempel saksi terlatih untuk mengubah status pelatihan</span>
        </div>

        <div className="divide-y divide-gray-800/50 max-h-[600px] overflow-y-auto custom-scrollbar">
          {filteredTps.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ShieldAlert className="w-10 h-10 text-gray-600 mx-auto mb-2.5 animate-bounce" />
              <p className="text-sm font-bold">Tidak ada TPS yang sesuai dengan penyaringan Anda.</p>
            </div>
          ) : (
            filteredTps.map((tps) => {
              const isComplete = tps.saksi1Id && tps.saksi2Id;
              
              return (
                <div
                  key={tps.id}
                  className={`p-5 transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-5 ${
                    !isComplete
                      ? 'bg-rose-950/15 hover:bg-rose-950/20 border-l-4 border-rose-600/80'
                      : 'hover:bg-gray-800/30 border-l-4 border-emerald-600/60'
                  }`}
                >
                  
                  {/* Left Column: TPS basic info */}
                  <div className="space-y-2 lg:max-w-xs shrink-0">
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-extrabold text-sm text-white">{tps.namaTps}</h4>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase ${
                        tps.zona === 'merah'
                          ? 'bg-red-950/60 text-red-400 border-red-900/40'
                          : tps.zona === 'kuning'
                            ? 'bg-amber-950/60 text-amber-400 border-amber-800/40'
                            : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                      }`}>
                        {tps.zona}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" />
                        {tps.kecamatan}, {tps.desa}
                      </span>
                      <span className="text-gray-600">|</span>
                      <span>DPT: <strong className="text-gray-300 font-bold">{tps.dptCount}</strong></span>
                    </div>
                  </div>

                  {/* Middle Column: Saksi Allocations (Slot 1 & Slot 2) */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* SLOT 1 */}
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all duration-200 ${
                      tps.saksi1Id 
                        ? 'bg-gray-950/60 border-gray-800/80' 
                        : 'bg-rose-950/5 border-rose-900/20 border-dashed hover:border-rose-900/50'
                    }`}>
                      <div className="space-y-1 overflow-hidden">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Saksi 1 (Slot A)</span>
                        {tps.saksi1Id ? (
                          <div className="space-y-1">
                            <span className="font-black text-xs text-white block truncate">{tps.saksi1Name}</span>
                            <button
                              onClick={() => canEdit && handleToggleTraining(tps, 1)}
                              disabled={!canEdit}
                              className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 border transition-colors ${
                                tps.saksi1Status === 'terlatih'
                                  ? 'bg-emerald-950 text-emerald-400 border-emerald-900/60 hover:bg-emerald-900/40'
                                  : 'bg-amber-950 text-amber-500 border-amber-900/50 hover:bg-amber-900/30'
                              }`}
                            >
                              {tps.saksi1Status === 'terlatih' ? (
                                <>
                                  <GraduationCap className="w-3 h-3 text-emerald-400" /> Terlatih
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-500" /> Belum Pelatihan
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-400 font-extrabold block italic">Slot Kosong</span>
                        )}
                      </div>

                      {/* Action buttons for Slot 1 */}
                      <div>
                        {tps.saksi1Id ? (
                          canEdit && (
                            <button
                              onClick={() => handleRemoveWitness(tps.id, 1)}
                              className="p-2 text-gray-500 hover:text-red-500 bg-gray-900 border border-gray-800 hover:border-red-950 rounded-lg transition-colors"
                              title="Hapus Penugasan Saksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        ) : (
                          canEdit ? (
                            <button
                              onClick={() => openAssignModal(tps.id, 1)}
                              className="px-3 py-1.5 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 text-xs font-black rounded-lg border border-rose-800/40 flex items-center gap-1 transition-all"
                            >
                              <UserPlus className="w-3.5 h-3.5" /> Alokasikan
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-600 block">Menunggu</span>
                          )
                        )}
                      </div>
                    </div>

                    {/* SLOT 2 */}
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all duration-200 ${
                      tps.saksi2Id 
                        ? 'bg-gray-950/60 border-gray-800/80' 
                        : 'bg-rose-950/5 border-rose-900/20 border-dashed hover:border-rose-900/50'
                    }`}>
                      <div className="space-y-1 overflow-hidden">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Saksi 2 (Slot B)</span>
                        {tps.saksi2Id ? (
                          <div className="space-y-1">
                            <span className="font-black text-xs text-white block truncate">{tps.saksi2Name}</span>
                            <button
                              onClick={() => canEdit && handleToggleTraining(tps, 2)}
                              disabled={!canEdit}
                              className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 border transition-colors ${
                                tps.saksi2Status === 'terlatih'
                                  ? 'bg-emerald-950 text-emerald-400 border-emerald-900/60 hover:bg-emerald-900/40'
                                  : 'bg-amber-950 text-amber-500 border-amber-900/50 hover:bg-amber-900/30'
                              }`}
                            >
                              {tps.saksi2Status === 'terlatih' ? (
                                <>
                                  <GraduationCap className="w-3 h-3 text-emerald-400" /> Terlatih
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-500" /> Belum Pelatihan
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-400 font-extrabold block italic">Slot Kosong</span>
                        )}
                      </div>

                      {/* Action buttons for Slot 2 */}
                      <div>
                        {tps.saksi2Id ? (
                          canEdit && (
                            <button
                              onClick={() => handleRemoveWitness(tps.id, 2)}
                              className="p-2 text-gray-500 hover:text-red-500 bg-gray-900 border border-gray-800 hover:border-red-950 rounded-lg transition-colors"
                              title="Hapus Penugasan Saksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        ) : (
                          canEdit ? (
                            <button
                              onClick={() => openAssignModal(tps.id, 2)}
                              className="px-3 py-1.5 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 text-xs font-black rounded-lg border border-rose-800/40 flex items-center gap-1 transition-all"
                            >
                              <UserPlus className="w-3.5 h-3.5" /> Alokasikan
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-600 block">Menunggu</span>
                          )
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* INTERACTIVE SAKSI ALOCATION MODAL */}
      {assigningTpsId && assigningSlot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black border border-red-900/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleIn">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-950 to-gray-950 px-6 py-4.5 border-b border-red-900/30 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                  Alokasi Saksi {assigningSlot}
                </h3>
                <p className="text-[11px] text-red-400/80 mt-0.5 font-semibold uppercase">
                  {tpsList.find(t => t.id === assigningTpsId)?.namaTps}
                </p>
              </div>
              <button
                onClick={() => {
                  setAssigningTpsId(null);
                  setAssigningSlot(null);
                }}
                className="p-1.5 rounded-lg bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal search inputs */}
            <div className="p-5 border-b border-gray-800/60 bg-gray-950/60 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                
                {/* Kader Search */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Cari Nama Kader / No. KTA</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={kaderSearch}
                      onChange={(e) => setKaderSearch(e.target.value)}
                      placeholder="Sri Rahayu, KTA-..."
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-red-900 transition-colors"
                    />
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
                  </div>
                </div>

                {/* Kader Location filter */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Kecamatan Asal Kader</label>
                  <select
                    value={kaderKecamatan}
                    onChange={(e) => setKaderKecamatan(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 text-xs text-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:border-red-900 transition-colors"
                  >
                    <option value="all">Semua Kecamatan</option>
                    {kecamatans.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* Modal Body: Eligible Kader List */}
            <div className="p-5 max-h-[300px] overflow-y-auto divide-y divide-gray-800/40 custom-scrollbar bg-gray-950/20">
              {eligibleWitnesses.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">
                  <ShieldAlert className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p>Tidak ada kader terverifikasi yang cocok dengan kriteria filter.</p>
                </div>
              ) : (
                eligibleWitnesses.map((kader) => (
                  <div
                    key={kader.id}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-gray-800/10 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full overflow-hidden border border-red-950/20 shrink-0 bg-gray-950">
                        <img 
                          src={kader.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=50&h=50&q=80"} 
                          alt={kader.name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        <span className="font-extrabold text-xs text-white block truncate">{kader.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span className="text-red-400 font-bold block truncate">{kader.ktaNumber}</span>
                          <span className="text-gray-600">•</span>
                          <span className="block truncate">{kader.kecamatan}, {kader.desa}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAssign(kader)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 shrink-0 uppercase tracking-wider"
                    >
                      Pilih <ChevronRight className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-950 px-6 py-4.5 border-t border-gray-800/60 flex justify-end">
              <button
                onClick={() => {
                  setAssigningTpsId(null);
                  setAssigningSlot(null);
                }}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-xs font-black text-gray-400 hover:text-white rounded-lg border border-gray-800 transition-colors"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
