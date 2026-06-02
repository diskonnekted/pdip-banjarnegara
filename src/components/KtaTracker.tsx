import React, { useState, useMemo } from 'react';
import { 
  Target, Trophy, Medal, Users, Search, ChevronDown, ChevronUp, Plus, Shield, Award, Sparkles, UserCheck, Flame
} from 'lucide-react';
import type { Member } from '../types';
import { BANJARNEGARA_REGIONS, INITIAL_MEMBERS } from '../mockData';

interface KtaTrackerProps {
  members: Member[];
  currentUser: Member;
  onOpenAddMemberModal: () => void;
}

const TARGET_KTA = 40000;
const BASE_KTA_COUNT = 5403;

const BADGES = [
  { name: 'Kader Pemula', limit: 1, maxLimit: 5, icon: Medal, color: 'text-amber-500 bg-amber-950/40 border-amber-900/30', badgeBg: 'bg-amber-600/20 text-amber-400', desc: 'Langkah awal gotong royong rekrutmen.' },
  { name: 'Pejuang Marhaen', limit: 6, maxLimit: 15, icon: Award, color: 'text-slate-300 bg-slate-800/40 border-slate-700/30', badgeBg: 'bg-slate-500/20 text-slate-300', desc: 'Kader militan penggalang massa rakyat.' },
  { name: 'Militan Banteng', limit: 16, maxLimit: 30, icon: Trophy, color: 'text-yellow-400 bg-yellow-950/40 border-yellow-900/30', badgeBg: 'bg-yellow-500/20 text-yellow-300', desc: 'Penggerak garda depan perekrutan partai!' },
  { name: 'Panglima Rekrutmen', limit: 31, maxLimit: Infinity, icon: Shield, color: 'text-red-400 bg-red-950/40 border-red-900/30', badgeBg: 'bg-red-500/20 text-red-300', desc: 'Panglima penakluk target KTA utama!' }
];

export default function KtaTracker({ members, currentUser, onOpenAddMemberModal }: KtaTrackerProps) {
  const [selectedKecamatan, setSelectedKecamatan] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRecruiter, setExpandedRecruiter] = useState<string | null>(null);

  // Dynamic KTA calculations based on current mock database
  const currentKtaCount = useMemo(() => {
    const additionalMembers = Math.max(0, members.length - INITIAL_MEMBERS.length);
    return BASE_KTA_COUNT + additionalMembers;
  }, [members]);

  const progressPercentage = useMemo(() => {
    return parseFloat(((currentKtaCount / TARGET_KTA) * 100).toFixed(2));
  }, [currentKtaCount]);

  const ktaGap = TARGET_KTA - currentKtaCount;

  // Personal user stats
  const myRecruits = useMemo(() => {
    return members.filter(m => m.parentId === currentUser.id).length;
  }, [members, currentUser.id]);

  const currentBadge = useMemo(() => {
    if (myRecruits >= 31) return BADGES[3];
    if (myRecruits >= 16) return BADGES[2];
    if (myRecruits >= 6) return BADGES[1];
    if (myRecruits >= 1) return BADGES[0];
    return null;
  }, [myRecruits]);

  const nextBadge = useMemo(() => {
    if (myRecruits >= 31) return null;
    if (myRecruits >= 16) return BADGES[3];
    if (myRecruits >= 6) return BADGES[2];
    if (myRecruits >= 1) return BADGES[1];
    return BADGES[0];
  }, [myRecruits]);

  const recruitsNeededForNext = useMemo(() => {
    if (!nextBadge) return 0;
    return nextBadge.limit - myRecruits;
  }, [myRecruits, nextBadge]);

  const personalProgressPercent = useMemo(() => {
    if (!nextBadge) return 100;
    const currentMin = currentBadge ? currentBadge.limit : 0;
    const range = nextBadge.limit - currentMin;
    const currentProgress = myRecruits - currentMin;
    return Math.min(100, Math.max(0, (currentProgress / range) * 100));
  }, [myRecruits, currentBadge, nextBadge]);

  // Leaders calculations
  const leaderboardData = useMemo(() => {
    // Group members by parentId (recruiters)
    const recruiterMap: Record<string, { member: Member; count: number; recruits: Member[] }> = {};
    
    // We only rank recruiters who are in the members list
    members.forEach(m => {
      if (m.parentId) {
        const parent = members.find(p => p.id === m.parentId);
        if (parent) {
          if (!recruiterMap[m.parentId]) {
            recruiterMap[m.parentId] = {
              member: parent,
              count: 0,
              recruits: []
            };
          }
          recruiterMap[m.parentId].count += 1;
          recruiterMap[m.parentId].recruits.push(m);
        }
      }
    });

    return Object.values(recruiterMap)
      .map(r => ({
        id: r.member.id,
        name: r.member.name,
        role: r.member.role,
        kecamatan: r.member.kecamatan,
        desa: r.member.desa,
        photoUrl: r.member.photoUrl,
        count: r.count,
        recruits: r.recruits.sort((a, b) => b.joinDate.localeCompare(a.joinDate))
      }))
      .sort((a, b) => b.count - a.count);
  }, [members]);

  // Filtered leaderboard
  const filteredLeaderboard = useMemo(() => {
    return leaderboardData.filter(r => {
      const matchKecamatan = selectedKecamatan === 'all' || r.kecamatan.toLowerCase() === selectedKecamatan.toLowerCase();
      const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.kecamatan.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.desa.toLowerCase().includes(searchQuery.toLowerCase());
      return matchKecamatan && matchSearch;
    });
  }, [leaderboardData, selectedKecamatan, searchQuery]);

  const topThree = useMemo(() => {
    return filteredLeaderboard.slice(0, 3);
  }, [filteredLeaderboard]);


  const toggleExpand = (recruiterId: string) => {
    if (expandedRecruiter === recruiterId) {
      setExpandedRecruiter(null);
    } else {
      setExpandedRecruiter(recruiterId);
    }
  };

  const allKecamatans = useMemo(() => {
    return Object.keys(BANJARNEGARA_REGIONS).sort();
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER TITLE */}
      <div className="border-b border-red-950/20 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
            <Target className="text-pdip-red animate-pulse" /> Tracker Target & Gamifikasi KTA
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-bold">
            Membangun Militansi Gotong Royong Kader Menuju Target 40.000 Anggota Ber-KTA
          </p>
        </div>
        <button 
          onClick={onOpenAddMemberModal}
          className="bg-pdip-red hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-red-950/30 w-fit"
        >
          <Plus size={16} /> Daftarkan Anggota Baru
        </button>
      </div>

      {/* TARGET PROGRESS & THERMOMETER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Thermometer Progress Bar Card */}
        <div className="lg:col-span-2 bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pdip-red/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Status Pencapaian DPC Banjarnegara</span>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/30 font-bold uppercase">
                <Flame size={10} className="text-red-500 animate-bounce" /> Real-time Sync
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-8 mt-6">
              {/* Thermometer Visual representation */}
              <div className="flex flex-col items-center">
                <div className="relative w-12 h-64 bg-pdip-black rounded-full border-2 border-red-900/30 p-1 flex flex-col justify-end overflow-hidden shadow-inner shadow-black/80">
                  {/* Thermometer milestones markings */}
                  <div className="absolute inset-y-0 right-1 flex flex-col justify-between text-[8px] font-mono font-bold text-gray-600 pointer-events-none py-4 z-10">
                    <span>40K</span>
                    <span>30K</span>
                    <span>20K</span>
                    <span>10K</span>
                    <span>0</span>
                  </div>
                  
                  {/* Dynamic red fill with bubbling effect */}
                  <div 
                    className="w-full bg-gradient-to-t from-red-800 via-red-600 to-pdip-red rounded-full transition-all duration-1000 relative shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                    style={{ height: `${Math.min(100, Math.max(8, progressPercentage))}%` }}
                  >
                    {/* Glowing head of thermometer */}
                    <div className="absolute top-0 left-0 right-0 h-4 bg-white/20 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Termometer KTA</span>
              </div>

              {/* Progress detail texts */}
              <div className="flex-1 space-y-5">
                <div>
                  <h3 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-400 to-amber-500 font-mono tracking-tight">
                    {currentKtaCount.toLocaleString('id-ID')}
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">KTA Terdaftar Saat Ini</p>
                </div>

                {/* Progress bar and numeric targets */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-gray-300">
                    <span>Progres: {progressPercentage}%</span>
                    <span>Target: {TARGET_KTA.toLocaleString('id-ID')} KTA</span>
                  </div>
                  <div className="h-3 w-full bg-pdip-black rounded-full overflow-hidden p-0.5 border border-red-950/20 shadow-inner">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-red-800 via-pdip-red to-yellow-500 shadow-lg shadow-red-600/30 transition-all duration-1000 relative"
                      style={{ width: `${Math.min(100, progressPercentage)}%` }}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress-bar-stripes_1s_linear_infinite]"></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-pdip-black/40 border border-red-900/10 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Sisa Gap Target</span>
                    <span className="text-lg font-bold font-mono text-red-500">-{ktaGap.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="bg-pdip-black/40 border border-red-900/10 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Kecamatan Aktif</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">20 / 20</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-red-950/20 pt-4 mt-6 text-xs text-gray-400 flex items-center gap-2 italic">
            <Sparkles size={14} className="text-yellow-500" />
            <span>KTA Banjarnegara dikompilasi secara real-time dari registrasi keanggotaan offline & sistem DPC.</span>
          </div>
        </div>

        {/* Gamifikasi Personal Card */}
        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div>
            <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block mb-4">Profil Pencapaian Anda</span>
            
            {/* Header info */}
            <div className="flex items-center gap-3.5 bg-pdip-black/30 p-3 rounded-xl border border-red-900/10 mb-5">
              <img 
                src={currentUser.photoUrl} 
                alt={currentUser.name}
                className="w-12 h-12 rounded-full object-cover border border-red-500/30 group-hover:scale-105 transition duration-300"
              />
              <div>
                <h4 className="font-extrabold text-sm text-white truncate max-w-[150px]">{currentUser.name}</h4>
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">{currentUser.role.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Badges system */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-300">Total Rekrutan:</span>
                <span className="text-sm font-bold font-mono text-white bg-pdip-black px-2 py-0.5 rounded border border-gray-800">
                  {myRecruits} KTA
                </span>
              </div>

              {/* Current Badge Status Display */}
              <div className="bg-pdip-black/40 border border-red-950/20 rounded-xl p-4 flex items-center gap-4 text-left transition hover:border-yellow-600/30">
                {currentBadge ? (
                  <>
                    <div className={`p-3 rounded-xl border ${currentBadge.color} flex items-center justify-center shrink-0`}>
                      <currentBadge.icon size={22} className="animate-[spin_10s_linear_infinite]" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-yellow-500 tracking-wider block">Lencana Aktif</span>
                      <h5 className="font-bold text-sm text-white leading-tight">{currentBadge.name}</h5>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{currentBadge.desc}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-xl border border-gray-800 bg-pdip-black text-gray-600 flex items-center justify-center shrink-0">
                      <Medal size={22} />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider block">Lencana Aktif</span>
                      <h5 className="font-bold text-sm text-gray-400 leading-tight">Belum Memiliki Lencana</h5>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Daftarkan 1 anggota baru untuk membuka lencana pertama Anda!</p>
                    </div>
                  </>
                )}
              </div>

              {/* Progress to next badge */}
              {nextBadge && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Rank Berikutnya: <strong className="text-white">{nextBadge.name}</strong></span>
                    <span>Kurang: {recruitsNeededForNext} Anggota</span>
                  </div>
                  <div className="h-2 w-full bg-pdip-black rounded-full overflow-hidden p-0.5 border border-red-950/10">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                      style={{ width: `${personalProgressPercent}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-gray-500 mt-6 border-t border-red-950/20 pt-4 flex items-center gap-1 justify-center">
            <UserCheck size={12} className="text-emerald-400" />
            <span>Mendaftarkan anggota otomatis menautkannya sebagai downline KTA Anda.</span>
          </div>
        </div>

      </div>

      {/* BADGES METRICS */}
      <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-6 shadow-xl">
        <h3 className="text-sm uppercase font-bold text-gray-400 tracking-wider mb-5 flex items-center gap-2">
          <Award size={16} className="text-yellow-500" /> Daftar Klasifikasi Lencana Militansi Kader
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {BADGES.map((badge, idx) => {
            const IconComponent = badge.icon;
            const isUnlocked = myRecruits >= badge.limit;
            return (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                  isUnlocked 
                    ? 'border-yellow-600/30 bg-gradient-to-b from-yellow-950/10 to-pdip-black shadow-md' 
                    : 'border-red-950/10 bg-pdip-black/20 opacity-60'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`p-2 rounded-lg border ${badge.color}`}>
                      <IconComponent size={20} />
                    </div>
                    {isUnlocked ? (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900/30">
                        Unlocked
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-pdip-black text-gray-600 border border-gray-800">
                        {badge.limit === badge.maxLimit ? `${badge.limit} Recruits` : `${badge.limit}-${badge.maxLimit} Recruits`}
                      </span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-sm text-white mb-1">{badge.name}</h4>
                  <p className="text-[10px] text-gray-400 leading-snug">{badge.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LEADERBOARD & RECRUITER RANKINGS */}
      <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 shadow-xl overflow-hidden">
        
        {/* Controls header */}
        <div className="bg-pdip-black/40 px-6 py-5 border-b border-red-950/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="text-yellow-500" /> Peringkat Kader Rekruter Terbaik
            </h3>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">Daftar Perekrut Anggota KTA Paling Militan Berdasarkan Kecamatan</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Kecamatan dropdown filter */}
            <div className="relative">
              <select 
                value={selectedKecamatan}
                onChange={(e) => setSelectedKecamatan(e.target.value)}
                className="bg-pdip-black border border-red-900/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 w-full sm:w-48 appearance-none transition-all cursor-pointer font-semibold"
              >
                <option value="all">Semua Kecamatan</option>
                {allKecamatans.map((kec) => (
                  <option key={kec} value={kec}>{kec}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            {/* Live Search bar */}
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input 
                type="text" 
                placeholder="Cari nama kader..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-pdip-black border border-red-900/30 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-red-500 w-full sm:w-60 transition-all placeholder:text-gray-600 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Podium Top 3 Recruiters */}
        {filteredLeaderboard.length > 0 && (
          <div className="bg-pdip-black/20 p-8 border-b border-red-950/10 flex flex-col md:flex-row justify-center items-end gap-6 md:gap-12 lg:gap-16">
            
            {/* Rank 2 (Silver) */}
            {topThree[1] && (
              <div className="flex flex-col items-center order-2 md:order-1 mt-6">
                <div className="relative mb-3">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-1 bg-slate-400 rounded-full border border-white text-pdip-black shadow flex items-center justify-center shrink-0 w-6 h-6">
                    <span className="text-[10px] font-extrabold">2</span>
                  </div>
                  <img 
                    src={topThree[1].photoUrl} 
                    alt={topThree[1].name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-slate-400/50 shadow-lg shadow-slate-900/30"
                  />
                </div>
                <div className="text-center">
                  <h4 className="font-extrabold text-sm text-white leading-tight truncate max-w-[120px]">{topThree[1].name}</h4>
                  <span className="text-[9px] text-gray-400 block font-semibold">{topThree[1].kecamatan}</span>
                  <span className="inline-block bg-slate-800/40 text-slate-300 border border-slate-700/30 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono mt-2 shadow-sm">
                    {topThree[1].count} KTA
                  </span>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            {topThree[0] && (
              <div className="flex flex-col items-center order-1 md:order-2">
                <div className="relative mb-3">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 p-1.5 bg-yellow-400 rounded-full border-2 border-white text-pdip-black shadow-lg flex items-center justify-center shrink-0 w-8 h-8 animate-bounce">
                    <Trophy size={14} className="fill-yellow-600 text-yellow-600" />
                  </div>
                  <img 
                    src={topThree[0].photoUrl} 
                    alt={topThree[0].name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-yellow-400 shadow-xl shadow-yellow-950/20"
                  />
                </div>
                <div className="text-center">
                  <h4 className="font-black text-base text-white leading-tight truncate max-w-[140px]">{topThree[0].name}</h4>
                  <span className="text-[10px] text-yellow-400 block font-bold">{topThree[0].kecamatan}</span>
                  <span className="inline-block bg-yellow-950/40 text-yellow-300 border border-yellow-900/30 px-3 py-1 rounded-full text-xs font-black font-mono mt-2 shadow-lg shadow-yellow-950/30">
                    🥇 {topThree[0].count} KTA
                  </span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {topThree[2] && (
              <div className="flex flex-col items-center order-3 mt-8">
                <div className="relative mb-3">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-1 bg-amber-700 rounded-full border border-white text-white shadow flex items-center justify-center shrink-0 w-6 h-6">
                    <span className="text-[10px] font-extrabold">3</span>
                  </div>
                  <img 
                    src={topThree[2].photoUrl} 
                    alt={topThree[2].name}
                    className="w-14 h-14 rounded-full object-cover border-4 border-amber-700/50 shadow-lg shadow-amber-950/30"
                  />
                </div>
                <div className="text-center">
                  <h4 className="font-extrabold text-sm text-white leading-tight truncate max-w-[120px]">{topThree[2].name}</h4>
                  <span className="text-[9px] text-gray-400 block font-semibold">{topThree[2].kecamatan}</span>
                  <span className="inline-block bg-amber-900/10 text-amber-500 border border-amber-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono mt-2 shadow-sm">
                    {topThree[2].count} KTA
                  </span>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Leaderboard Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-pdip-darkgray text-gray-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4 border-b border-red-950/10">Peringkat & Profil Rekruter</th>
                <th className="px-6 py-4 border-b border-red-950/10">Wilayah Penugasan</th>
                <th className="px-6 py-4 border-b border-red-950/10">Lencana Pangkat</th>
                <th className="px-6 py-4 border-b border-red-950/10 text-center">Total Rekrutan</th>
                <th className="px-6 py-4 border-b border-red-950/10 text-right">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-950/5">
              {filteredLeaderboard.length > 0 ? (
                filteredLeaderboard.map((recruiter, index) => {
                  const rank = index + 1;
                  const recruiterBadge = recruiter.count >= 31 ? BADGES[3] :
                                          recruiter.count >= 16 ? BADGES[2] :
                                          recruiter.count >= 6 ? BADGES[1] :
                                          recruiter.count >= 1 ? BADGES[0] :
                                          null;
                  const isExpanded = expandedRecruiter === recruiter.id;
                  
                  return (
                    <React.Fragment key={recruiter.id}>
                      <tr className={`hover:bg-red-950/5 transition-colors group ${isExpanded ? 'bg-red-950/5' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-4">
                            {/* Rank Indicator */}
                            <div className="w-8 shrink-0 flex items-center justify-center font-mono font-black text-sm text-gray-400">
                              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                            </div>
                            {/* Profile Image & Name */}
                            <div className="flex items-center gap-3">
                              <img 
                                src={recruiter.photoUrl} 
                                alt={recruiter.name}
                                className="w-9 h-9 rounded-full object-cover border border-red-900/10"
                              />
                              <div>
                                <div className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">{recruiter.name}</div>
                                <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{recruiter.role.replace('_', ' ')}</div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-300 font-semibold">{recruiter.desa}</div>
                          <div className="text-[10px] text-gray-500">Kec. {recruiter.kecamatan}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {recruiterBadge ? (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${recruiterBadge.color}`}>
                              <recruiterBadge.icon size={10} /> {recruiterBadge.name}
                            </span>
                          ) : (
                            <span className="text-[9px] text-gray-600 uppercase font-bold italic">Tanpa Lencana</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-xs font-mono font-bold text-white bg-pdip-black px-2 py-1 rounded border border-gray-800">
                            {recruiter.count} KTA
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button 
                            onClick={() => toggleExpand(recruiter.id)}
                            className="text-gray-400 hover:text-white p-1 hover:bg-pdip-black rounded-lg transition"
                            title="Tampilkan daftar rekrutan"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>

                      {/* Recruits list accordion details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-pdip-black/50 px-8 py-5 border-y border-red-950/10 animate-slideDown">
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-red-400 flex items-center gap-1.5">
                                <Users size={12} /> Anggota KTA yang Direkrut oleh {recruiter.name}
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {recruiter.recruits.map((recruit) => (
                                  <div key={recruit.id} className="flex items-center gap-3 bg-pdip-metal/30 p-3 rounded-xl border border-red-950/20 shadow-sm">
                                    <img 
                                      src={recruit.photoUrl} 
                                      alt={recruit.name}
                                      className="w-8 h-8 rounded-full object-cover border border-red-500/10"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h5 className="font-bold text-xs text-white truncate">{recruit.name}</h5>
                                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono mt-0.5">
                                        <span>{recruit.ktaNumber}</span>
                                        <span>{recruit.joinDate}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs text-gray-500 italic">
                    Tidak ada rekruter KTA yang ditemukan untuk kriteria filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
