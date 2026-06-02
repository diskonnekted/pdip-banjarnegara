import { useState, useMemo } from 'react';
import { 
  Calendar, Clock, CheckCircle2, AlertTriangle, ShieldAlert, 
  Award, MessageSquare, Edit3, Check, Filter, AlertCircle
} from 'lucide-react';
import type { Member, Milestone } from '../types';
import confetti from 'canvas-confetti';

interface StrategicTimelineProps {
  milestones: Milestone[];
  currentUser: Member;
  onUpdateMilestone: (id: string, completed: boolean, notes?: string, completedBy?: string) => void;
}

export default function StrategicTimeline({ 
  milestones, 
  currentUser, 
  onUpdateMilestone 
}: StrategicTimelineProps) {
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  
  // Note editing state
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Calculate current quarter dynamically based on June 2, 2026
  const currentQuarterInfo = useMemo(() => {
    // Current date is 2026-06-02
    const currentYear = 2026;
    const currentTW = 'TW II';
    return {
      year: currentYear,
      quarter: currentTW,
      label: `${currentTW} ${currentYear}`
    };
  }, []);

  // Check role authorization
  const canEdit = useMemo(() => {
    return ['super_admin', 'pimpinan_dpc', 'bapilu'].includes(currentUser.role);
  }, [currentUser]);

  // Find currently active milestone
  const activeMilestone = useMemo(() => {
    return milestones.find(m => m.year === currentQuarterInfo.year && m.quarter === currentQuarterInfo.quarter);
  }, [milestones, currentQuarterInfo]);

  // Filter milestones
  const filteredMilestones = useMemo(() => {
    return milestones.filter(m => {
      const matchYear = selectedYear === 'all' || m.year === selectedYear;
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'completed' && m.completed) || 
        (statusFilter === 'pending' && !m.completed);
      return matchYear && matchStatus;
    });
  }, [milestones, selectedYear, statusFilter]);

  // Count completions
  const completionStats = useMemo(() => {
    const total = milestones.length;
    const completed = milestones.filter(m => m.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }, [milestones]);

  // Currently selected milestone detail object
  const selectedMilestone = useMemo(() => {
    if (!selectedMilestoneId) return null;
    return milestones.find(m => m.id === selectedMilestoneId) || null;
  }, [milestones, selectedMilestoneId]);

  // Handle click on milestone card
  const handleSelectMilestone = (m: Milestone) => {
    setSelectedMilestoneId(m.id);
    setNoteText(m.notes || '');
    setIsEditing(false);
  };

  // Toggle milestone completion
  const handleToggleComplete = (m: Milestone) => {
    const nextCompleted = !m.completed;
    
    // Trigger celebration when completed
    if (nextCompleted) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#DE0611', '#FFD700', '#10B981', '#1E3A8A']
      });
    }

    onUpdateMilestone(
      m.id,
      nextCompleted,
      noteText.trim() || undefined,
      nextCompleted ? `${currentUser.name} (${currentUser.role === 'super_admin' ? 'Super Admin' : currentUser.role === 'pimpinan_dpc' ? 'Ketua DPC' : 'Bapilu'})` : undefined
    );
  };

  // Save notes only
  const handleSaveNotes = () => {
    if (!selectedMilestone) return;
    onUpdateMilestone(
      selectedMilestone.id,
      selectedMilestone.completed,
      noteText.trim(),
      selectedMilestone.completed ? selectedMilestone.completedBy : undefined
    );
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 text-gray-200">
      
      {/* HEADER BANNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-br from-red-950/70 via-gray-900 to-black border border-red-900/40 shadow-xl shadow-red-950/15">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wider flex items-center gap-2.5">
            <Calendar className="text-pdip-red animate-pulse" /> 
            Milestone Timeline Strategis (2026 - 2029)
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">
            Program Kerja Prioritas Menengah (PDI Perjuangan DPC Banjarnegara)
          </p>
        </div>

        {/* PROGRESS BOX */}
        <div className="flex items-center gap-4 bg-gray-950/80 px-5 py-3.5 rounded-xl border border-gray-800/80 self-start md:self-auto">
          <div className="relative flex items-center justify-center">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle cx="24" cy="24" r="20" stroke="#1f2937" strokeWidth="4" fill="transparent" />
              <circle cx="24" cy="24" r="20" stroke="#DE0611" strokeWidth="4" fill="transparent"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - completionStats.percentage / 100)} 
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="absolute text-xs font-black text-white">{completionStats.percentage}%</span>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Progres Nasional</div>
            <div className="text-sm font-bold text-white">
              {completionStats.completed} / {completionStats.total} <span className="text-xs font-normal text-gray-400">Target</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🚨 PULSING ACTIVE TARGET BANNER */}
      {activeMilestone && !activeMilestone.completed && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-950/40 via-gray-900 to-black border border-amber-500/40 p-5 shadow-lg shadow-amber-950/10 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded uppercase border border-amber-500/30">
                  Target Aktif Triwulan Ini ({currentQuarterInfo.label})
                </span>
              </div>
              <h3 className="font-extrabold text-base text-white mt-1.5">{activeMilestone.title}</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-2xl">{activeMilestone.description}</p>
            </div>
          </div>

          <button
            onClick={() => handleSelectMilestone(activeMilestone)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-black rounded-lg transition-all duration-200 uppercase tracking-wider shrink-0 flex items-center gap-1.5 border border-amber-400 shadow-md shadow-amber-500/10"
          >
            Tindaklanjuti Target
          </button>
        </div>
      )}

      {/* FILTER & TIMELINE SPLIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: TIMELINE BOARD */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* CONTROL BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/60 p-4 rounded-xl border border-gray-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <Filter className="w-3.5 h-3.5 text-pdip-red" /> Filter Rencana Kerja
            </div>

            <div className="flex items-center gap-2.5">
              {/* Year Select */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-gray-950 border border-gray-800 text-xs text-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-900 transition-colors"
              >
                <option value="all">Semua Tahun (2026 - 2029)</option>
                <option value="2026">2026: Konsolidasi Organisasi</option>
                <option value="2027">2027: Kaderisasi Ideologi</option>
                <option value="2028">2028: Advokasi Rakyat</option>
                <option value="2029">2029: Mobilisasi Total</option>
              </select>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-gray-950 border border-gray-800 text-xs text-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-900 transition-colors"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Belum Terlaksana</option>
                <option value="completed">Selesai</option>
              </select>
            </div>
          </div>

          {/* TIMELINE CARDS GRID */}
          <div className="space-y-4 max-h-[650px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredMilestones.length === 0 ? (
              <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-12 text-center text-gray-500">
                <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-bold">Tidak ada program yang sesuai dengan filter Anda.</p>
              </div>
            ) : (
              filteredMilestones.map((m) => {
                const isActive = m.year === currentQuarterInfo.year && m.quarter === currentQuarterInfo.quarter;
                
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectMilestone(m)}
                    className={`relative overflow-hidden rounded-xl border p-4.5 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      selectedMilestoneId === m.id
                        ? 'bg-red-950/20 border-red-800/70 shadow-lg shadow-red-950/10'
                        : isActive
                          ? 'bg-amber-950/10 border-amber-700/50 hover:border-amber-600/70'
                          : m.completed
                            ? 'bg-emerald-950/5 border-emerald-900/30 hover:border-emerald-800/50'
                            : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    {/* Left Accent Color bar */}
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                      m.completed 
                        ? 'bg-emerald-500' 
                        : isActive 
                          ? 'bg-amber-500 animate-pulse' 
                          : 'bg-gray-700'
                    }`}></div>

                    {/* Milestone Main Info */}
                    <div className="pl-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Quarter Badge */}
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wide border ${
                          m.completed 
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' 
                            : isActive 
                              ? 'bg-amber-950/50 text-amber-400 border-amber-700/50 animate-pulse' 
                              : 'bg-gray-950 text-gray-400 border-gray-800'
                        }`}>
                          {m.quarter} {m.year}
                        </span>

                        {/* Phase Name */}
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          {m.phase}
                        </span>

                        {/* Active label */}
                        {isActive && (
                          <span className="text-[9px] bg-red-950 text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase border border-red-900/30 animate-pulse">
                            Aktif
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-sm text-white group-hover:text-red-400 transition-colors">
                        {m.title}
                      </h4>
                      <p className="text-xs text-gray-400 line-clamp-1 max-w-xl">{m.description}</p>
                    </div>

                    {/* Right side: Status Indicator */}
                    <div className="shrink-0 flex items-center gap-3">
                      {m.completed ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Selesai</span>
                        </div>
                      ) : isActive ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-700/50 font-bold animate-pulse">
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span>Target Berjalan</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-950/80 px-3 py-1.5 rounded-lg border border-gray-800/80">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>Direncanakan</span>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION & DETAILED CHECKLIST PANEL */}
        <div className="lg:col-span-4">
          {selectedMilestone ? (
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-5 sticky top-6 shadow-xl shadow-black/30">
              
              {/* Card Title */}
              <div className="border-b border-gray-800 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-red-950 text-red-400 font-extrabold px-2.5 py-0.5 rounded border border-red-900/50 uppercase">
                    Detail Milestone
                  </span>
                  <span className="text-xs text-gray-400 font-bold">
                    {selectedMilestone.quarter} {selectedMilestone.year}
                  </span>
                </div>
                <h3 className="font-black text-base text-white mt-2 tracking-wide leading-snug">
                  {selectedMilestone.title}
                </h3>
              </div>

              {/* Phase / Desc */}
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Tujuan & Kategori</span>
                  <span className="text-xs text-gray-300 font-bold">{selectedMilestone.phase}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Deskripsi Kerja</span>
                  <p className="text-xs text-gray-400 leading-relaxed mt-1">{selectedMilestone.description}</p>
                </div>
              </div>

              {/* Status info */}
              <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-800/80 space-y-3.5">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Status Terakhir</span>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedMilestone.completed ? (
                      <span className="text-xs text-emerald-400 font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> TERLAKSANA
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500 font-extrabold flex items-center gap-1 animate-pulse">
                        <Clock className="w-4 h-4 text-amber-500" /> MENUNGGU TINDAKAN
                      </span>
                    )}
                  </div>
                </div>

                {selectedMilestone.completed && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800/60 text-xs">
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase tracking-widest block">Diselesaikan Oleh</span>
                      <span className="font-bold text-gray-300 block truncate mt-0.5">{selectedMilestone.completedBy || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase tracking-widest block">Stempel Waktu</span>
                      <span className="font-bold text-gray-300 block mt-0.5">
                        {selectedMilestone.completedAt ? new Date(selectedMilestone.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* DPC NOTES TEXTAREA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-red-500" /> Catatan Implementasi DPC
                  </span>
                  {!isEditing && canEdit && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-bold"
                    >
                      <Edit3 className="w-3 h-3" /> Edit Catatan
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Masukkan progres di lapangan, pencapaian, atau kendala dalam program strategis ini..."
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-red-900 min-h-[90px]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setNoteText(selectedMilestone.notes || '');
                          setIsEditing(false);
                        }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-[10px] font-bold text-gray-400 rounded-md transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-[10px] font-black text-white rounded-md transition-colors"
                      >
                        Simpan Catatan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-950/40 p-3 rounded-lg border border-gray-900 min-h-[70px] flex items-center">
                    {selectedMilestone.notes ? (
                      <p className="text-xs text-gray-400 italic leading-relaxed">"{selectedMilestone.notes}"</p>
                    ) : (
                      <p className="text-xs text-gray-600 italic">Belum ada catatan implementasi dari DPC Banjarnegara.</p>
                    )}
                  </div>
                )}
              </div>

              {/* ACTION BUTTON (CHECKLIST TOGGLE) */}
              <div className="pt-2">
                {canEdit ? (
                  <button
                    onClick={() => handleToggleComplete(selectedMilestone)}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 border shadow-lg ${
                      selectedMilestone.completed
                        ? 'bg-gray-950 hover:bg-red-950/20 text-red-500 border-red-900/40 hover:border-red-800 shadow-red-950/5'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-black border-emerald-400 shadow-emerald-500/10'
                    }`}
                  >
                    {selectedMilestone.completed ? (
                      <>
                        <Clock className="w-4 h-4" /> Batalkan Kelulusan Target
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" /> Centang Target Terlaksana!
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3 bg-red-950/20 rounded-xl border border-red-900/30 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <span className="text-[10px] font-black text-red-400 uppercase tracking-wider block">Otorisasi Terbatas</span>
                      <p className="text-[10px] text-gray-500 leading-normal mt-0.5">
                        Anda masuk sebagai <span className="font-bold text-gray-400">{currentUser.role}</span>. Hanya Super Admin, Pimpinan DPC, atau Bapilu yang berhak mengubah kelulusan program strategis nasional.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-gray-900/20 border border-gray-800/80 border-dashed rounded-xl p-8 text-center text-gray-600 h-64 flex flex-col items-center justify-center">
              <Award className="w-10 h-10 text-gray-700 mb-2.5" />
              <p className="text-xs font-bold">Pilih salah satu program triwulanan di sebelah kiri untuk melihat catatan tindak lanjut DPC.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
