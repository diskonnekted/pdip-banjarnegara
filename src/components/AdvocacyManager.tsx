import React, { useState, useMemo } from 'react';
import { 
  HeartHandshake, Plus, Search, Activity, FileText, CheckCircle2, 
  Clock, ShieldAlert, Award, User, ArrowRight, Check, Trash2
} from 'lucide-react';
import type { Member, AdvocacyTicket } from '../types';
import confetti from 'canvas-confetti';

interface AdvocacyManagerProps {
  tickets: AdvocacyTicket[];
  currentUser: Member;
  onAddTicket: (newTicket: AdvocacyTicket) => void;
  onUpdateTicket: (id: string, status: AdvocacyTicket['status'], dewanNotes?: string, dewanName?: string) => void;
  onDeleteTicket?: (id: string) => void;
}

const PRESET_DOCUMENTS = [
  { name: 'Dokumen Kelengkapan BPJS', url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80' },
  { name: 'Kondisi Fisik Rumah Warga', url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80' },
  { name: 'Infrastruktur Pipa Air Bersih', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80' },
  { name: 'Surat Keterangan Tidak Mampu (SKTM)', url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80' }
];

export default function AdvocacyManager({ 
  tickets, 
  currentUser, 
  onAddTicket, 
  onUpdateTicket,
  onDeleteTicket 
}: AdvocacyManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'kader_portal' | 'kasus_list' | 'dprd_board'>('kasus_list');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form states
  const [citizenName, setCitizenName] = useState<string>('');
  const [citizenNik, setCitizenNik] = useState<string>('');
  const [citizenPhone, setCitizenPhone] = useState<string>('');
  const [category, setCategory] = useState<AdvocacyTicket['category']>('BPJS');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedPresetPhoto, setSelectedPresetPhoto] = useState<string>(PRESET_DOCUMENTS[0].url);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successAnimation, setSuccessAnimation] = useState<boolean>(false);

  // Dewan action states
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [dewanNotes, setDewanNotes] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Check role eligibility for Fraksi DPRD Board
  const isDewanOrAdmin = useMemo(() => {
    return ['super_admin', 'pimpinan_dpc', 'anggota_dewan', 'bapilu'].includes(currentUser.role);
  }, [currentUser.role]);

  // Handle custom file upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit new ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizenName.trim() || !citizenNik.trim() || !title.trim() || !description.trim()) return;

    setSubmitting(true);
    const finalPhoto = customPhoto || selectedPresetPhoto;

    const newTicket: AdvocacyTicket = {
      id: `adv-${Date.now()}`,
      citizenName: citizenName.trim(),
      citizenNik: citizenNik.trim(),
      phone: citizenPhone.trim() || undefined,
      category,
      title: title.trim(),
      description: description.trim(),
      status: 'diusulkan',
      kaderId: currentUser.id,
      kaderName: currentUser.name,
      kecamatan: currentUser.kecamatan || 'Banjarnegara',
      desa: currentUser.desa || 'Krandegan',
      photoUrl: finalPhoto,
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/advocacy-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });
      if (res.ok) {
        onAddTicket(newTicket);
      } else {
        onAddTicket(newTicket); // offline fallback
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setSuccessAnimation(true);
      setTimeout(() => setSuccessAnimation(false), 3000);

      // Clear Form
      setCitizenName('');
      setCitizenNik('');
      setCitizenPhone('');
      setCategory('BPJS');
      setTitle('');
      setDescription('');
      setCustomPhoto(null);
    } catch (err) {
      console.error('Failed to submit ticket via API, using fallback:', err);
      onAddTicket(newTicket);
    } finally {
      setSubmitting(false);
    }
  };

  // Update status (Fraksi DPRD action)
  const handleUpdateStatus = async (ticketId: string, status: AdvocacyTicket['status']) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/advocacy-tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          dewanNotes: dewanNotes.trim() || undefined,
          dewanName: currentUser.name
        })
      });
      
      if (res.ok) {
        onUpdateTicket(ticketId, status, dewanNotes.trim() || undefined, currentUser.name);
      } else {
        onUpdateTicket(ticketId, status, dewanNotes.trim() || undefined, currentUser.name);
      }

      if (status === 'selesai') {
        confetti({
          particleCount: 80,
          spread: 60,
          colors: ['#ef4444', '#f59e0b', '#10b981']
        });
      }

      setSelectedTicketId(null);
      setDewanNotes('');
    } catch (err) {
      console.error('Failed to update ticket status via API, using fallback:', err);
      onUpdateTicket(ticketId, status, dewanNotes.trim() || undefined, currentUser.name);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Delete ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus tiket advokasi ini secara permanen?")) return;
    try {
      const res = await fetch(`/api/advocacy-tickets/${ticketId}`, {
        method: 'DELETE'
      });
      if (res.ok && onDeleteTicket) {
        onDeleteTicket(ticketId);
      } else if (onDeleteTicket) {
        onDeleteTicket(ticketId);
      }
    } catch (err) {
      console.error('Failed to delete ticket:', err);
      if (onDeleteTicket) onDeleteTicket(ticketId);
    }
  };

  // Filters
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchCategory = selectedCategory === 'all' || ticket.category === selectedCategory;
      const matchStatus = selectedStatus === 'all' || ticket.status === selectedStatus;
      const matchSearch = ticket.citizenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ticket.kaderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ticket.desa.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchStatus && matchSearch;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tickets, selectedCategory, selectedStatus, searchQuery]);

  // Dynamic statistics
  const stats = useMemo(() => {
    const total = tickets.length;
    const pending = tickets.filter(t => t.status === 'diusulkan').length;
    const active = tickets.filter(t => t.status === 'diproses').length;
    const completed = tickets.filter(t => t.status === 'selesai').length;
    const solvedRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, pending, active, completed, solvedRate };
  }, [tickets]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="border-b border-red-950/20 pb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
            <HeartHandshake className="text-pdip-red animate-pulse" /> Modul Advokasi Rakyat (Bansos & Hibah)
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-bold">
            Program Kerja Prioritas Menengah (2027-2028) - Pendampingan KIP, PIP, BPJS & Gotong Royong
          </p>
        </div>
        
        {/* Navigation Subtabs */}
        <div className="flex bg-pdip-black p-1 rounded-xl border border-red-950/30 self-start lg:self-center">
          <button 
            onClick={() => setActiveSubTab('kasus_list')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubTab === 'kasus_list' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <FileText size={14} /> Daftar Keluhan ({tickets.length})
          </button>
          <button 
            onClick={() => setActiveSubTab('kader_portal')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubTab === 'kader_portal' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Plus size={14} /> Usulkan Kasus Baru
          </button>
          {isDewanOrAdmin && (
            <button 
              onClick={() => setActiveSubTab('dprd_board')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubTab === 'dprd_board' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Award size={14} /> Board Fraksi DPRD
            </button>
          )}
        </div>
      </div>

      {/* QUICK STATS DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Kasus Masuk</span>
            <h4 className="text-3xl font-mono font-black text-white mt-1">{stats.total} <span className="text-xs font-sans text-gray-500">Aduan</span></h4>
          </div>
          <div className="p-3 bg-red-950/30 rounded-xl border border-red-900/20 text-pdip-red">
            <Activity size={22} />
          </div>
        </div>

        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Sedang Diproses Dewan</span>
            <h4 className="text-3xl font-mono font-black text-amber-500 mt-1">{stats.active} <span className="text-xs font-sans text-gray-500">Kasus</span></h4>
          </div>
          <div className="p-3 bg-yellow-950/30 rounded-xl border border-yellow-900/20 text-yellow-500">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Selesai / Bantuan Cair</span>
            <h4 className="text-3xl font-mono font-black text-emerald-400 mt-1">{stats.completed} <span className="text-xs font-sans text-gray-500">Kasus</span></h4>
          </div>
          <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-900/20 text-emerald-400">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Rasio Keberhasilan Fraksi</span>
            <h4 className="text-3xl font-mono font-black text-white mt-1">{stats.solvedRate}%</h4>
          </div>
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="24" cy="24" r="20" className="stroke-pdip-black fill-none" strokeWidth="4" />
              <circle 
                cx="24" cy="24" r="20" 
                className="stroke-pdip-red fill-none transition-all duration-1000" 
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - stats.solvedRate / 100)}`}
              />
            </svg>
            <span className="absolute text-[8px] font-bold text-white font-mono">{stats.solvedRate}%</span>
          </div>
        </div>
      </div>

      {/* 1. PORTAL USULAN KASUS BARU */}
      {activeSubTab === 'kader_portal' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form Card */}
          <div className="lg:col-span-3 bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-48 h-48 bg-pdip-red/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <form onSubmit={handleSubmitTicket} className="space-y-5">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">Form Usulan Advokasi Warga</h3>
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/30 font-bold">
                  Kader Lapangan
                </span>
              </div>

              {/* Citizen Personal details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Nama Warga Penerima</label>
                  <input 
                    type="text" 
                    placeholder="Bapak Maryono"
                    required
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">NIK Warga (KTP)</label>
                  <input 
                    type="text" 
                    placeholder="3304xxxxxxxxxxxx"
                    required
                    maxLength={16}
                    value={citizenNik}
                    onChange={(e) => setCitizenNik(e.target.value)}
                    className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">No. HP Hubungi</label>
                  <input 
                    type="text" 
                    placeholder="081234567xxx"
                    value={citizenPhone}
                    onChange={(e) => setCitizenPhone(e.target.value)}
                    className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              {/* Category & Title */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Jenis Advokasi</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AdvocacyTicket['category'])}
                    className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer font-bold"
                  >
                    <option value="BPJS">BPJS Kesehatan (PBI)</option>
                    <option value="PIP/KIP">PIP / KIP Beasiswa</option>
                    <option value="Air Bersih">Air Bersih (Dusun)</option>
                    <option value="Jalan/Infrastruktur">Jalan / Jembatan Rusak</option>
                    <option value="Lainnya">Kebutuhan Mendesak Lainnya</option>
                  </select>
                </div>
                
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Judul Ringkasan Pengaduan</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Pengajuan Beasiswa PIP Siswa Yatim Piatu Dusun Krajan"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-semibold"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Detail Masalah & Kondisi Warga</label>
                <textarea 
                  rows={4}
                  placeholder="Ceritakan kondisi warga secara spesifik. Contoh: Keluarga Pak Ahmad butuh tangki air bersih karena sumur mengering total sejak 2 bulan lalu. Jumlah warga terdampak 45 KK."
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-medium leading-relaxed resize-none"
                />
              </div>

              {/* File / photo upload */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Lampiran Bukti Kelayakan (SKTM / Foto Kondisi)</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="flex items-center justify-center gap-2 bg-pdip-black hover:bg-red-950/20 border border-red-900/20 text-gray-300 hover:text-white px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer">
                      <FileText size={16} /> {customPhoto ? 'Ganti Dokumen' : 'Ambil Foto / Unggah SKTM'}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {customPhoto && (
                    <button 
                      type="button"
                      onClick={() => setCustomPhoto(null)}
                      className="bg-red-950/40 border border-red-900/20 text-red-500 px-3 py-3 rounded-xl text-xs font-bold transition hover:bg-red-900 hover:text-white"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-pdip-red hover:bg-red-700 text-white py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-red-950/30"
              >
                {submitting ? 'Memproses Pengusulan...' : 'Kirim Usulan Advokasi ke Fraksi DPRD ✊'}
              </button>
            </form>

            {/* Confetti Success Prompts */}
            {successAnimation && (
              <div className="absolute inset-0 bg-pdip-black/95 flex flex-col items-center justify-center text-center p-6 z-20 animate-fadeIn">
                <div className="w-16 h-16 bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 rounded-full flex items-center justify-center shadow-lg shadow-emerald-950/30 mb-4 animate-scaleUp">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-lg font-bold text-white font-serif">Usulan Berhasil Dikirim!</h4>
                <p className="text-xs text-gray-400 mt-2 max-w-[280px]">
                  Kasus advokasi warga telah berhasil terdaftar dan diteruskan langsung ke Dasboard Anggota DPRD Fraksi PDI Perjuangan.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-red-950/40 border border-red-900/30 text-[10px] font-bold text-red-400">
                  Status: DIUSULKAN (Menunggu Respon Fraksi)
                </div>
              </div>
            )}
          </div>

          {/* Preset Preview Box */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-3">Dokumen Penunjang / Bukti Fisik</span>
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-pdip-black border border-red-950/20 relative shadow-inner">
                <img 
                  src={customPhoto || selectedPresetPhoto} 
                  alt="Aspirasi Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 right-3 bg-pdip-black/80 backdrop-blur-sm border border-red-950/20 rounded-lg p-2 flex items-center justify-between text-[9px] font-mono text-gray-300">
                  <span>{customPhoto ? '📸 UPLOAD DOKUMEN' : '📷 PRESISTENT PREVIEW'}</span>
                  <span>{new Date().toISOString().slice(0, 10)}</span>
                </div>
              </div>
            </div>

            {!customPhoto && (
              <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl">
                <div>
                  <h4 className="text-xs uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                    <User size={14} className="text-pdip-red" /> Dokumen Penunjang Simulasi
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Gunakan preset berkas pendukung di bawah jika melakukan pengujian dari browser desktop.
                  </p>
                </div>

                <div className="space-y-2 mt-4">
                  {PRESET_DOCUMENTS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedPresetPhoto(preset.url)}
                      className={`w-full text-left p-2.5 rounded-xl border text-[11px] font-bold transition flex items-center gap-3 ${selectedPresetPhoto === preset.url ? 'border-red-600/30 bg-red-950/20 text-white' : 'border-red-950/10 bg-pdip-black/20 text-gray-400 hover:text-white'}`}
                    >
                      <img 
                        src={preset.url} 
                        alt={preset.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                      <span className="truncate">{preset.name}</span>
                      {selectedPresetPhoto === preset.url && <Check size={12} className="ml-auto text-red-500" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. DAFTAR KASUS & TIMELINE TRACKER */}
      {activeSubTab === 'kasus_list' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Kasus Bantuan Sosial yang Diadvokasi</h3>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">Sistem Pelacakan Kehadiran Nyata Fraksi PDI Perjuangan</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-pdip-black border border-red-900/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer font-semibold"
              >
                <option value="all">Semua Kategori</option>
                <option value="BPJS">BPJS Kesehatan</option>
                <option value="PIP/KIP">PIP / KIP Beasiswa</option>
                <option value="Air Bersih">Air Bersih</option>
                <option value="Jalan/Infrastruktur">Infrastruktur Jalan</option>
                <option value="Lainnya">Lainnya</option>
              </select>

              <select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-pdip-black border border-red-900/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer font-semibold"
              >
                <option value="all">Semua Status</option>
                <option value="diusulkan">Diusulkan</option>
                <option value="diproses">Sedang Diproses</option>
                <option value="selesai">Selesai (Cair)</option>
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                <input 
                  type="text" 
                  placeholder="Cari warga/kader..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-pdip-black border border-red-900/30 rounded-xl pl-8 pr-4 py-2 text-xs text-white focus:outline-none focus:border-red-500 placeholder:text-gray-600 font-semibold w-40"
                />
              </div>
            </div>
          </div>

          {/* Cases Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => {
                const step = ticket.status === 'diusulkan' ? 1 : ticket.status === 'diproses' ? 2 : 3;
                return (
                  <div key={ticket.id} className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pdip-red/5 rounded-full blur-2xl pointer-events-none group-hover:bg-pdip-red/10 transition"></div>
                    
                    <div className="space-y-3">
                      {/* Ticket category badge */}
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          ticket.category === 'BPJS' ? 'bg-blue-950/50 text-blue-400 border border-blue-900/30' :
                          ticket.category === 'PIP/KIP' ? 'bg-yellow-950/50 text-yellow-400 border border-yellow-900/30' :
                          ticket.category === 'Air Bersih' ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-900/30' :
                          'bg-red-950/50 text-red-400 border border-red-900/30'
                        }`}>
                          {ticket.category}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono text-gray-500">{new Date(ticket.createdAt).toLocaleDateString('id-ID')}</span>
                          {currentUser.role === 'super_admin' && (
                            <button 
                              onClick={() => handleDeleteTicket(ticket.id)}
                              className="text-gray-600 hover:text-red-500 p-0.5 transition"
                              title="Hapus Tiket"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title & info */}
                      <div>
                        <h4 className="font-extrabold text-sm text-white group-hover:text-red-500 transition line-clamp-1">{ticket.title}</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1 font-bold">
                          <User size={10} className="text-gray-500" />
                          <span>KK: {ticket.citizenName}</span>
                          <span className="text-gray-600 font-normal">({ticket.desa})</span>
                        </div>
                      </div>

                      {/* Brief description */}
                      <p className="text-xs text-gray-300 leading-relaxed font-medium line-clamp-3 bg-pdip-black/20 p-2.5 rounded-xl border border-red-950/5">
                        "{ticket.description}"
                      </p>

                      {/* Dewan Response if present */}
                      {ticket.dewanNotes && (
                        <div className="bg-emerald-950/15 border border-emerald-900/20 p-2.5 rounded-xl text-[11px] leading-relaxed text-emerald-400 font-medium">
                          <span className="font-bold text-[9px] uppercase tracking-wider block text-emerald-500 mb-0.5">Fraksi DPRD Notes (By: {ticket.dewanName}):</span>
                          "{ticket.dewanNotes}"
                        </div>
                      )}
                    </div>

                    {/* Progress tracking visual timeline */}
                    <div className="border-t border-red-950/10 pt-4 space-y-3">
                      <div className="flex justify-between items-center text-[9px] uppercase font-bold tracking-wider">
                        <span className={`${step >= 1 ? 'text-pdip-red' : 'text-gray-600'}`}>Diusulkan</span>
                        <ArrowRight size={10} className="text-gray-600" />
                        <span className={`${step >= 2 ? 'text-amber-500 animate-pulse' : 'text-gray-600'}`}>Diproses DPRD</span>
                        <ArrowRight size={10} className="text-gray-600" />
                        <span className={`${step >= 3 ? 'text-emerald-400' : 'text-gray-600'}`}>Bantuan Cair</span>
                      </div>
                      
                      {/* Step Progress bar */}
                      <div className="w-full bg-pdip-black h-1.5 rounded-full overflow-hidden flex">
                        <div className={`h-full transition-all duration-500 ${step === 1 ? 'w-1/3 bg-pdip-red' : step === 2 ? 'w-2/3 bg-amber-500' : 'w-full bg-emerald-400'}`}></div>
                      </div>

                      {/* Submitter info */}
                      <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold pt-1">
                        <span className="truncate max-w-[120px]">Kader: {ticket.kaderName}</span>
                        <span className="text-[9px] font-mono text-gray-600">{ticket.kecamatan}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-pdip-metal/40 rounded-2xl border border-red-950/10 p-12 text-center text-gray-500 text-xs italic">
                <HeartHandshake className="mx-auto mb-3 text-gray-700 animate-bounce" size={32} />
                <span>Kasus advokasi belum tersedia atau tidak ditemukan.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. DPRD BOARD ACTION PANEL */}
      {activeSubTab === 'dprd_board' && isDewanOrAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Left: Pending case items needing attention */}
          <div className="lg:col-span-2 bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-red-500" /> Kasus Membutuhkan Tindakan ({tickets.filter(t => t.status !== 'selesai').length})
              </h3>
              <p className="text-[10px] text-gray-500 mt-1">Pilih aduan kader di bawah untuk menindaklanjuti program bansos.</p>
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {tickets.filter(t => t.status !== 'selesai').length > 0 ? (
                tickets.filter(t => t.status !== 'selesai').map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setDewanNotes(ticket.dewanNotes || '');
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border text-[11px] font-bold transition flex flex-col gap-2 ${selectedTicketId === ticket.id ? 'border-red-600/30 bg-red-950/20 text-white' : 'border-red-950/10 bg-pdip-black/20 text-gray-400 hover:text-white hover:border-red-900/20'}`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded font-black ${ticket.status === 'diusulkan' ? 'bg-red-950/50 text-red-500 border border-red-900/30' : 'bg-yellow-950/50 text-yellow-500 border border-yellow-900/30'}`}>
                        {ticket.status === 'diusulkan' ? 'DIUSULKAN' : 'DIPROSES'}
                      </span>
                      <span className="text-[8px] font-mono text-gray-500">{new Date(ticket.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                    <span className="font-extrabold text-white text-xs truncate w-full">{ticket.title}</span>
                    <span className="text-[10px] text-gray-400 block font-semibold truncate w-full">By: {ticket.kaderName} ({ticket.desa})</span>
                  </button>
                ))
              ) : (
                <p className="text-center text-[11px] text-gray-500 italic py-8">Seluruh usulan advokasi telah terselesaikan! Mantap! ✊</p>
              )}
            </div>
          </div>

          {/* Right: Selected Case processing form */}
          <div className="lg:col-span-3 bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-6 shadow-xl relative flex flex-col justify-between">
            {selectedTicketId ? (
              (() => {
                const ticket = tickets.find(t => t.id === selectedTicketId);
                if (!ticket) return null;
                return (
                  <div className="space-y-6">
                    <div className="border-b border-red-950/15 pb-4">
                      <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest block">Advocacy Processing Panel</span>
                      <h3 className="text-lg font-serif font-bold text-white mt-1">{ticket.title}</h3>
                      
                      {/* Case details info */}
                      <div className="grid grid-cols-2 gap-4 mt-4 text-[11px] text-gray-400 bg-pdip-black/20 p-3 rounded-xl border border-red-950/10">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">Nama Warga Penerima</span>
                          <span className="font-extrabold text-white">{ticket.citizenName}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">NIK Warga (KTP)</span>
                          <span className="font-mono font-bold text-white">{ticket.citizenNik}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">Lokasi Desa / Kec</span>
                          <span className="font-bold text-white">{ticket.desa}, Kec. {ticket.kecamatan}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">Kategori Program</span>
                          <span className="font-bold text-pdip-red uppercase tracking-wider">{ticket.category}</span>
                        </div>
                      </div>
                    </div>

                    {/* Case Description */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Aspirasi Awal Kader Lapangan:</span>
                      <p className="text-xs text-gray-300 italic leading-relaxed bg-pdip-black/40 border border-red-950/5 p-3.5 rounded-xl">
                        "{ticket.description}"
                      </p>
                    </div>

                    {/* Follow-up notes */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-400 block">Tanggapan Fraksi & Catatan Tindak Lanjut Anggota Dewan</label>
                      <textarea 
                        rows={4}
                        placeholder="Contoh: Tim DPC / Fraksi sudah memproses data pengajuan bansos ini ke dinas terkait. Pihak kelurahan setempat sudah kami minta verifikasi lapangan..."
                        value={dewanNotes}
                        onChange={(e) => setDewanNotes(e.target.value)}
                        className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-medium leading-relaxed resize-none"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-4 pt-2">
                      {ticket.status === 'diusulkan' && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.id, 'diproses')}
                          disabled={updatingStatus}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/20"
                        >
                          <Activity size={14} /> Proses Kasus
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'selesai')}
                        disabled={updatingStatus}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20"
                      >
                        <Check size={14} /> Selesaikan Kasus (Bantuan Cair)
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 text-xs italic py-12">
                <Award className="text-gray-700 mb-3 animate-pulse" size={40} />
                <span>Pilih salah satu kasus advokasi yang masuk di sebelah kiri untuk diproses oleh Fraksi DPRD.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
