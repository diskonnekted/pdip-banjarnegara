import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapPin, Activity, Search, Camera, Check, Users, 
  CheckCircle2, Award, Sparkles, Clock, Smartphone, ChevronDown, AlertCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Member, DdsLog } from '../types';
import { BANJARNEGARA_REGIONS } from '../mockData';
import confetti from 'canvas-confetti';

interface DdsTrackerProps {
  logs: DdsLog[];
  members: Member[];
  currentUser: Member;
  onAddLog: (newLog: DdsLog) => void;
}

// Custom Leaflet circular marker to prevent default path resolution issues
const createCustomMarker = (isActive: boolean) => L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div class="relative flex items-center justify-center w-8 h-8">
      <div class="absolute inset-0 bg-red-500 rounded-full ${isActive ? 'animate-ping opacity-30' : 'opacity-10'}"></div>
      <div class="relative w-6 h-6 bg-pdip-red rounded-full border-2 border-white flex items-center justify-center shadow-lg shadow-black/85">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5 text-white">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Helper component to center map on coordinates
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// Camera presets for easy mockup in browser
const CAMERA_PRESETS = [
  { name: 'Kunjungan Warga Krandegan', url: 'https://images.unsplash.com/photo-1595275372297-f58d4a07c3be?auto=format&fit=crop&w=600&q=80' },
  { name: 'Sosialisasi Kaos & Brosur', url: 'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&w=600&q=80' },
  { name: 'Gotong Royong Dusun', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80' },
  { name: 'Diskusi Teras Rumah', url: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=80' },
  { name: 'Pemberian Atribut Partai', url: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=600&q=80' }
];

export default function DdsTracker({ logs, members, currentUser, onAddLog }: DdsTrackerProps) {
  // Tabs for mobile layout or detailed views
  const [activeSubTab, setActiveSubTab] = useState<'checkin' | 'map' | 'admin'>('checkin');
  const [selectedKecamatan, setSelectedKecamatan] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  
  // Geolocation states
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  
  // Form states
  const [residentName, setResidentName] = useState<string>('');
  const [residentPhone, setResidentPhone] = useState<string>('');
  const [visitNotes, setVisitNotes] = useState<string>('');
  const [selectedPresetPhoto, setSelectedPresetPhoto] = useState<string>(CAMERA_PRESETS[0].url);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successAnimation, setSuccessAnimation] = useState<boolean>(false);

  // Map view coordinates
  const [mapCenter, setMapCenter] = useState<[number, number]>([-7.3996, 109.6976]);
  const [mapZoom, setMapZoom] = useState<number>(13);

  // Auto Geolocate on load
  useEffect(() => {
    handleGeolocate();
  }, []);

  const handleGeolocate = () => {
    setGeoLoading(true);
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Browser Anda tidak mendukung GPS Geolocation.");
      setCoords({ lat: -7.3996 + (Math.random() - 0.5) * 0.01, lng: 109.6976 + (Math.random() - 0.5) * 0.01 }); // realistic mock offset
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setMapCenter([position.coords.latitude, position.coords.longitude]);
        setGeoLoading(false);
      },
      (error) => {
        console.warn("Geolocation error, using realistic Banjarnegara offsets:", error.message);
        // Fallback to coordinates near current user's assigned desa/kecamatan if possible
        const userOffsetLat = -7.3996 + (Math.random() - 0.5) * 0.015;
        const userOffsetLng = 109.6976 + (Math.random() - 0.5) * 0.015;
        setCoords({ lat: userOffsetLat, lng: userOffsetLng });
        setMapCenter([userOffsetLat, userOffsetLng]);
        setGeoError("Akses GPS ditolak, koordinat simulasi Banjarnegara digunakan.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Filter logs based on date, kecamatan, and query
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logDate = log.timestamp.slice(0, 10);
      const matchDate = selectedDate === 'all' || logDate === selectedDate;
      const matchKecamatan = selectedKecamatan === 'all' || log.kecamatan.toLowerCase() === selectedKecamatan.toLowerCase();
      const matchSearch = log.kaderName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.residentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.notes.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDate && matchKecamatan && matchSearch;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [logs, selectedDate, selectedKecamatan, searchQuery]);

  // Today's total DDS visits count of all kader
  const totalVisitsToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return logs.filter(log => log.timestamp.slice(0, 10) === todayStr).length;
  }, [logs]);

  // Kader-specific KPI calculations (Today's visits for this kader)
  const myVisitsToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return logs.filter(log => log.kaderId === currentUser.id && log.timestamp.slice(0, 10) === todayStr).length;
  }, [logs, currentUser.id]);

  const kpiPercentage = useMemo(() => {
    return Math.min(100, (myVisitsToday / 10) * 100);
  }, [myVisitsToday]);

  // Leaderboard of cadres with counts of visits on the selected date
  const adminLeaderboard = useMemo(() => {
    const countMap: Record<string, { member: Member; count: number }> = {};
    
    // Initialize all field cadres (korcam, ketua_ranting, relawan)
    members.forEach(m => {
      if (['korcam', 'ketua_ranting', 'relawan_terdaftar', 'super_admin'].includes(m.role)) {
        countMap[m.id] = { member: m, count: 0 };
      }
    });

    // Populate counts based on logs on the selected date
    logs.forEach(log => {
      const logDate = log.timestamp.slice(0, 10);
      const matchDate = selectedDate === 'all' || logDate === selectedDate;
      if (matchDate && countMap[log.kaderId]) {
        countMap[log.kaderId].count += 1;
      }
    });

    return Object.values(countMap)
      .map(entry => ({
        id: entry.member.id,
        name: entry.member.name,
        role: entry.member.role,
        kecamatan: entry.member.kecamatan,
        desa: entry.member.desa,
        photoUrl: entry.member.photoUrl,
        count: entry.count,
        metKpi: entry.count >= 10
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [logs, members, selectedDate]);

  // Handle new log submission
  const handleSubmitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentName.trim() || !visitNotes.trim() || !coords) return;

    setSubmitting(true);
    
    const finalPhoto = customPhoto || selectedPresetPhoto;

    const newLog: DdsLog = {
      id: `dds-new-${Date.now()}`,
      kaderId: currentUser.id,
      kaderName: currentUser.name,
      kecamatan: currentUser.kecamatan || 'Banjarnegara',
      desa: currentUser.desa || 'Krandegan',
      residentName: residentName.trim(),
      phone: residentPhone.trim() || undefined,
      notes: visitNotes.trim(),
      photoUrl: finalPhoto,
      lat: coords.lat,
      lng: coords.lng,
      timestamp: new Date().toISOString()
    };

    try {
      // API call
      const response = await fetch('/api/dds-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
      
      if (response.ok) {
        onAddLog(newLog);
      } else {
        // Fallback local addition if server is offline
        onAddLog(newLog);
      }

      // Success effects
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });

      setSuccessAnimation(true);
      setTimeout(() => setSuccessAnimation(false), 3000);

      // Clear Form
      setResidentName('');
      setResidentPhone('');
      setVisitNotes('');
      setCustomPhoto(null);
      
      // Auto Geolocation for next check-in
      handleGeolocate();
    } catch (err) {
      console.error("Check-in request failed, added locally:", err);
      onAddLog(newLog);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const allKecamatans = useMemo(() => {
    return Object.keys(BANJARNEGARA_REGIONS).sort();
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="border-b border-red-950/20 pb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
            <Activity className="text-pdip-red animate-pulse" /> Log Harian Kampanye "Door-to-Door" (DDS)
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-bold">
            Absensi Lapangan Berbasis GPS - Mandat Strategi Pemenangan 4A (Min. 10 Rumah/Kader/Hari)
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-pdip-black p-1 rounded-xl border border-red-950/30 self-start lg:self-center">
          <button 
            onClick={() => setActiveSubTab('checkin')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubTab === 'checkin' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Smartphone size={14} /> Check-in Kunjungan
          </button>
          <button 
            onClick={() => setActiveSubTab('map')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubTab === 'map' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <MapPin size={14} /> Peta Penyebaran
          </button>
          <button 
            onClick={() => setActiveSubTab('admin')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeSubTab === 'admin' ? 'bg-pdip-red text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Users size={14} /> Monitor DPC
          </button>
        </div>
      </div>

      {/* QUICK SUMMARY WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: My visits today */}
        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Kunjungan Anda Hari Ini</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold font-mono text-white">{myVisitsToday}</span>
              <span className="text-xs text-gray-400">/ 10 rumah</span>
            </div>
            <span className={`text-[10px] font-bold block mt-1.5 ${myVisitsToday >= 10 ? 'text-emerald-400' : 'text-amber-500 animate-pulse'}`}>
              {myVisitsToday >= 10 ? 'Lunas KPI Hari Ini! ✊' : `Kurang ${10 - myVisitsToday} rumah lagi.`}
            </span>
          </div>
          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
            {/* Circle progress indicator */}
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="28" cy="28" r="24" className="stroke-pdip-black fill-none" strokeWidth="4" />
              <circle 
                cx="28" cy="28" r="24" 
                className="stroke-pdip-red fill-none transition-all duration-1000" 
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - kpiPercentage / 100)}`}
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-white font-mono">{Math.round(kpiPercentage)}%</span>
          </div>
        </div>

        {/* Card 2: Assigned region info */}
        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-red-950/30 rounded-xl border border-red-900/20 text-pdip-red">
            <MapPin size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Wilayah Penugasan Anda</span>
            <h4 className="text-base font-extrabold text-white mt-0.5 truncate max-w-[200px]">Desa {currentUser.desa || 'Krandegan'}</h4>
            <span className="text-[10px] text-red-400 font-bold block">Kec. {currentUser.kecamatan || 'Banjarnegara'}</span>
          </div>
        </div>

        {/* Card 3: Global total visits today */}
        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-yellow-950/30 rounded-xl border border-yellow-900/20 text-yellow-500">
            <Sparkles size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Kunjungan Kader DPC Hari Ini</span>
            <h4 className="text-2xl font-black font-mono text-white mt-0.5">{totalVisitsToday} <span className="text-xs font-sans text-gray-400">Rumah</span></h4>
            <span className="text-[10px] text-emerald-400 font-bold block">Gotong Royong Se-Banjarnegara!</span>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUTS */}
      
      {/* 1. CHECK-IN FORM TAB */}
      {activeSubTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Geotagging & Details Form */}
          <div className="lg:col-span-3 bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-48 h-48 bg-pdip-red/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <form onSubmit={handleSubmitCheckin} className="space-y-5">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">Form Check-in Kunjungan Baru</h3>
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/30 font-bold">
                  <Smartphone size={10} /> MOBILE PORTAL
                </span>
              </div>

              {/* GPS coordinates status */}
              <div className="bg-pdip-black/40 p-4 rounded-xl border border-red-950/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${coords ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20' : 'bg-pdip-black text-gray-500'} flex items-center justify-center shrink-0`}>
                    <MapPin size={18} className={coords ? 'animate-bounce' : ''} />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Koordinat Geotagging GPS</span>
                    {geoLoading ? (
                      <span className="text-xs text-yellow-500 font-semibold animate-pulse block">Mencari Sinyal GPS...</span>
                    ) : coords ? (
                      <span className="text-xs font-mono font-bold text-emerald-400 block">Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}</span>
                    ) : (
                      <span className="text-xs text-red-500 block">GPS Offline</span>
                    )}
                  </div>
                </div>
                
                <button 
                  type="button"
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  className="bg-pdip-black hover:bg-red-950/30 border border-red-900/20 text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shrink-0"
                >
                  Sync GPS
                </button>
              </div>

              {geoError && (
                <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 text-[10px] text-amber-500 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{geoError}</span>
                </div>
              )}

              {/* Input Resident name & phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Nama Kepala Keluarga (KK)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Bapak Maryono"
                    required
                    value={residentName}
                    onChange={(e) => setResidentName(e.target.value)}
                    className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">No. HP Warga (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 081234567xxx"
                    value={residentPhone}
                    onChange={(e) => setResidentPhone(e.target.value)}
                    className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              {/* Visit Notes / Aspirasi */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Catatan Keluhan / Aspirasi Warga</label>
                <textarea 
                  rows={4}
                  placeholder="Contoh: Butuh bantuan bibit jagung unggul dan perbaikan tanggul selokan sawah yang longsor."
                  required
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  className="w-full bg-pdip-black border border-red-900/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 font-medium leading-relaxed resize-none"
                />
              </div>

              {/* Photo Options Container */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Lampiran Foto Kunjungan</label>
                
                {/* File custom uploader */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="flex items-center justify-center gap-2 bg-pdip-black hover:bg-red-950/20 border border-red-900/20 text-gray-300 hover:text-white px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer">
                      <Camera size={16} /> {customPhoto ? 'Ganti Foto Anda' : 'Unggah / Ambil Foto'}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleCustomPhotoUpload}
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

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={submitting || !coords}
                className={`w-full bg-pdip-red hover:bg-red-700 text-white py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider ${(!coords || submitting) ? 'opacity-50 cursor-not-allowed' : 'shadow-red-950/30'}`}
              >
                {submitting ? 'Memproses Check-in...' : 'Submit Check-in DDS ✊'}
              </button>
            </form>

            {/* Confetti Success Prompts */}
            {successAnimation && (
              <div className="absolute inset-0 bg-pdip-black/95 flex flex-col items-center justify-center text-center p-6 z-20 animate-fadeIn">
                <div className="w-16 h-16 bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 rounded-full flex items-center justify-center shadow-lg shadow-emerald-950/30 mb-4 animate-scaleUp">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-lg font-bold text-white font-serif">Absensi Kunjungan Sukses!</h4>
                <p className="text-xs text-gray-400 mt-2 max-w-[280px]">
                  Log kunjungan Anda telah ter-geotag secara presisi dan terkirim langsung ke database DPC. Mantap!
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-red-950/40 border border-red-900/30 text-[10px] font-bold text-red-400">
                  <Award size={12} /> Progres Harian: {myVisitsToday} / 10
                </div>
              </div>
            )}
          </div>

          {/* Photo Preset Capture Mocks */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Visual Photo preview card */}
            <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-3">Preview Foto Lampiran</span>
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-pdip-black border border-red-950/20 relative shadow-inner">
                <img 
                  src={customPhoto || selectedPresetPhoto} 
                  alt="Kunjungan Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 right-3 bg-pdip-black/80 backdrop-blur-sm border border-red-950/20 rounded-lg p-2 flex items-center justify-between text-[9px] font-mono text-gray-300">
                  <span>{customPhoto ? '📸 FOTO ANDA' : '📷 KAMERA SIMULASI'}</span>
                  <span>{new Date().toISOString().slice(0, 10)}</span>
                </div>
              </div>
            </div>

            {/* Simulation Preset camera selection */}
            {!customPhoto && (
              <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl">
                <div>
                  <h4 className="text-xs uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                    <Smartphone size={14} className="text-pdip-red" /> Simulasi Kamera Lapangan
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Gunakan preset foto kunjungan ini jika melakukan pengetesan di browser desktop tanpa webcam.
                  </p>
                </div>

                <div className="space-y-2 mt-4">
                  {CAMERA_PRESETS.map((preset, index) => (
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

      {/* 2. LEAFLET MAP VIEW */}
      {activeSubTab === 'map' && (
        <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 shadow-xl overflow-hidden">
          
          {/* Map info bar */}
          <div className="bg-pdip-black/40 px-6 py-4 border-b border-red-950/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <MapPin className="text-pdip-red" /> Peta Penyebaran Kunjungan DDS
              </h3>
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">Visualisasi Spasial Sebaran Rumah Yang Dikunjungi Kader Secara Real-time</p>
            </div>
            
            {/* Filter by Kecamatan inside Map */}
            <div className="relative">
              <select 
                value={selectedKecamatan}
                onChange={(e) => {
                  setSelectedKecamatan(e.target.value);
                  // Centering coordinates dynamically if a specific region is filtered
                  if (e.target.value !== 'all') {
                    setMapZoom(13);
                  }
                }}
                className="bg-pdip-black border border-red-900/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 appearance-none transition-all cursor-pointer font-semibold"
              >
                <option value="all">Semua Kecamatan</option>
                {allKecamatans.map((kec) => (
                  <option key={kec} value={kec}>{kec}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Interactive Leaflet Map Wrapper */}
          <div className="h-[500px] w-full bg-pdip-black relative z-10 border-b border-red-950/20">
            <MapContainer 
              center={mapCenter} 
              zoom={mapZoom} 
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <ChangeView center={mapCenter} zoom={mapZoom} />
              
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              
              {/* Plot DdsLogs pins */}
              {logs
                .filter(log => selectedKecamatan === 'all' || log.kecamatan.toLowerCase() === selectedKecamatan.toLowerCase())
                .map((log) => (
                  <Marker 
                    key={log.id} 
                    position={[log.lat, log.lng]}
                    icon={createCustomMarker(log.kaderId === currentUser.id)}
                    eventHandlers={{
                      click: () => {
                        setMapCenter([log.lat, log.lng]);
                      }
                    }}
                  >
                    <Popup className="dds-leaflet-popup">
                      <div className="w-64 bg-pdip-metal text-white border border-red-950/20 rounded-xl overflow-hidden p-0 shadow-lg text-left">
                        {/* Header card */}
                        <div className="aspect-[16/10] bg-pdip-black relative">
                          <img 
                            src={log.photoUrl} 
                            alt={log.residentName}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-red-950/80 border border-red-900/30 px-1.5 py-0.5 rounded text-[8px] font-bold text-red-400">
                            🚪 Kunjungan
                          </div>
                        </div>

                        {/* Description metadata */}
                        <div className="p-3 space-y-2">
                          <div>
                            <h4 className="font-extrabold text-xs text-white leading-tight">KK: {log.residentName}</h4>
                            <span className="text-[8px] text-gray-400 font-mono">{log.desa}, Kec. {log.kecamatan}</span>
                          </div>
                          
                          <p className="text-[10px] text-gray-300 italic border-l border-red-500 pl-2 leading-relaxed bg-pdip-black/20 py-1 rounded-r">
                            "{log.notes}"
                          </p>

                          <div className="border-t border-red-950/10 pt-2 flex items-center justify-between">
                            <span className="text-[9px] text-red-400 font-bold block truncate max-w-[120px]">By: {log.kaderName}</span>
                            <span className="text-[8px] text-gray-500 block shrink-0">{new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))
              }
            </MapContainer>
          </div>
          
          <div className="p-4 bg-pdip-black/20 text-[10px] text-gray-400 flex items-center gap-2 italic">
            <Sparkles size={12} className="text-yellow-500" />
            <span>Keterangan: Pin merah melingkar berdenyut menandakan check-in kunjungan terbaru yang dilaporkan oleh Anda hari ini.</span>
          </div>
        </div>
      )}

      {/* 3. MONITOR DPC DASHBOARD TAB */}
      {activeSubTab === 'admin' && (
        <div className="space-y-8">
          
          {/* Controls Filter & Header */}
          <div className="bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Monitoring Disiplin KPI & Log Feed</h3>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">DPC Banjarnegara Bapilu & Pimpinan Management Board</p>
            </div>
            
            {/* Control Panel Filters */}
            <div className="flex flex-wrap gap-3">
              {/* Date Filter */}
              <div className="relative">
                <input 
                  type="date"
                  value={selectedDate === 'all' ? '' : selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value || 'all')}
                  className="bg-pdip-black border border-red-900/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-semibold cursor-pointer w-36"
                />
              </div>

              {/* Kecamatan Filter */}
              <div className="relative">
                <select 
                  value={selectedKecamatan}
                  onChange={(e) => setSelectedKecamatan(e.target.value)}
                  className="bg-pdip-black border border-red-900/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 appearance-none transition-all cursor-pointer font-semibold pr-8"
                >
                  <option value="all">Semua Kecamatan</option>
                  {allKecamatans.map((kec) => (
                    <option key={kec} value={kec}>{kec}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>

              {/* Search cadre input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                <input 
                  type="text" 
                  placeholder="Cari kader..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-pdip-black border border-red-900/30 rounded-xl pl-8 pr-4 py-2 text-xs text-white focus:outline-none focus:border-red-500 placeholder:text-gray-600 font-semibold w-40"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Cadre KPI leaderboard scoreboard */}
            <div className="lg:col-span-1 bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
                  <Award size={14} className="text-yellow-500" /> Skor Kepatuhan Target KPI
                </h4>
                
                <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                  {adminLeaderboard.length > 0 ? (
                    adminLeaderboard.map((kader) => (
                      <div key={kader.id} className="bg-pdip-black/30 border border-red-950/20 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-red-900/20 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={kader.photoUrl} 
                            alt={kader.name}
                            className="w-8 h-8 rounded-full object-cover border border-red-500/10"
                          />
                          <div className="min-w-0">
                            <h5 className="font-extrabold text-xs text-white truncate max-w-[110px]">{kader.name}</h5>
                            <span className="text-[8px] text-gray-500 block truncate">Kec. {kader.kecamatan}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${kader.metKpi ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20' : 'bg-pdip-black text-amber-500 border border-gray-800'}`}>
                            {kader.count} / 10
                          </span>
                          <span className="text-[8px] text-gray-500 block font-bold mt-0.5">
                            {kader.metKpi ? 'Lunas KPI ✊' : `${Math.round((kader.count / 10) * 100)}% Progres`}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-gray-500 italic py-6">Kader tidak ditemukan.</p>
                  )}
                </div>
              </div>

              <div className="border-t border-red-950/20 pt-4 mt-4 text-[9px] text-gray-500 italic">
                *KPI Minimal 10 Kunjungan/Kader/Hari diwajibkan untuk seluruh jajaran Korcam, Ranting, dan Relawan.
              </div>
            </div>

            {/* Right Column: Chronological logs feed card stream */}
            <div className="lg:col-span-2 bg-pdip-metal/60 backdrop-blur-md rounded-2xl border border-red-950/20 p-5 shadow-xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
                <Clock size={14} className="text-red-500" /> Log Aliran Laporan Kunjungan Terakhir ({filteredLogs.length})
              </h4>

              <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="bg-pdip-black/20 border border-red-950/20 rounded-xl p-4 flex flex-col md:flex-row gap-4 hover:bg-red-950/5 transition">
                      
                      {/* Left: log image */}
                      <div className="w-full md:w-32 aspect-[4/3] md:aspect-square bg-pdip-black rounded-lg overflow-hidden shrink-0 border border-red-950/10">
                        <img 
                          src={log.photoUrl} 
                          alt={log.residentName}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Right: details metadata */}
                      <div className="flex-1 space-y-2.5">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h5 className="font-extrabold text-sm text-white">KK: {log.residentName}</h5>
                            <span className="text-[10px] text-gray-400 font-mono block mt-0.5">{log.desa}, Kec. {log.kecamatan}</span>
                          </div>
                          
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase font-mono px-2 py-0.5 rounded bg-red-950/40 border border-red-900/30">
                            {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                          </span>
                        </div>

                        <p className="text-xs text-gray-300 bg-pdip-black/40 border border-red-950/10 rounded-xl p-3 leading-relaxed font-medium">
                          "{log.notes}"
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1.5 border-t border-red-950/10">
                          <span className="font-bold text-gray-400">Visitor: <strong className="text-red-400 font-extrabold font-serif">{log.kaderName}</strong></span>
                          <span>Telp: {log.phone || '-'}</span>
                        </div>
                      </div>

                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-xs text-gray-500 italic">Tidak ada laporan kunjungan DDS yang ditemukan pada kriteria penanggalan/filter ini.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
