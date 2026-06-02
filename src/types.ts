export interface Member {
  id: string;
  name: string;
  ktaNumber: string;
  nik: string;
  role: 'super_admin' | 'pimpinan_dpc' | 'korcam' | 'ketua_ranting' | 'anggota_dewan' | 'bapilu' | 'relawan_terdaftar' | 'anggota' | 'admin_logistik';
  kecamatan: string;
  desa: string;
  tps: string;
  photoUrl: string;
  lat: number;
  lng: number;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
  joinDate: string;
  parentId?: string; // ID of the member who recruited them
  dapil?: string; // Dapil area for anggota_dewan / legislative members
  partyAffiliation?: string; // Party affiliation for general DPT simulation (e.g. PDIP, Golkar, PKB, Demokrat, etc.)
  approachStatus?: 'tidak_prospektif' | 'prospektif' | 'respek' | 'bergabung';
  approachKaderId?: string;
  approachNotes?: string;
}

export interface LogisticsItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  location: string;
  category: 'Atribut' | 'APK' | 'Konsumsi' | 'Dokumen';
}

export interface LogisticsOrder {
  id: string;
  requesterName: string;
  requesterRole: string;
  kecamatan: string;
  desa: string;
  itemName: string;
  quantity: number;
  status: 'draft' | 'approved' | 'packed' | 'shipped' | 'received';
  createdAt: string;
}

export interface Aspiration {
  id: string;
  reporterName: string;
  kecamatan: string;
  desa: string;
  phone: string;
  title: string;
  description: string;
  status: 'pending' | 'process' | 'resolved';
  date: string;
  dewanResponse?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface QuickCountResult {
  kecamatan: string;
  tps: string;
  candidate1Votes: number; // Paslon 1
  candidate2Votes: number; // Paslon 2 (PDIP/Usungan)
  candidate3Votes: number; // Paslon 3
  sah: number;
  tidakSah: number;
  c1PhotoUrl: string;
  submittedBy: string;
  timestamp: string;
}
export interface MemberReport {
  id: string;
  title: string;
  timestamp: string;
  category: 'Insiden' | 'Kegiatan Rutin' | 'Darurat' | 'Perekrutan' | 'Lainnya';
  details: string;
  photoUrl?: string;
  submittedBy: string; // Member name
  submitterId: string; // Member ID
  kecamatan: string;
  targetMemberId?: string; // Optional: specific member target
  targetMemberName?: string; // Optional: specific member name target
}

export interface PrivateMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  timestamp: string;
  read?: boolean; // Track read status
}

export interface RantingProposal {
  id: string;
  kecamatan: string;
  desa: string;
  proposedKetuaName: string;
  proposedKetuaNik: string;
  proposedKetuaPhone: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface OperationalFund {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: 'Kegiatan' | 'Sosialisasi' | 'Pembuatan Media' | 'Logistik' | 'Lainnya';
  title: string;
  description: string;
  date: string;
  submitterId: string;
  submitterName: string;
}

export interface LogisticsStockHistory {
  id: string;
  itemId: string;
  itemName: string;
  type: 'stock_in' | 'stock_out';
  quantity: number;
  notes: string;
  date: string;
  submitterName: string;
}

export interface PartyActivity {
  id: string;
  title: string;
  type: string;
  executors: Array<{ id: string; name: string; role: string }>;
  date: string;
  location: string;
  status: 'rencana' | 'pengajuan' | 'disetujui' | 'pelaksanaan' | 'selesai';
  budgetTransport: number;
  budgetMeals: number;
  budgetAccommodation: number;
  budgetOther: number;
  budgetTotal: number;
  reportDescription?: string;
  reportPhoto?: string;
}

export interface TpsMapping {
  id: string;
  namaTps: string;
  kecamatan: string;
  desa: string;
  lat: number;
  lng: number;
  zona: 'merah' | 'kuning' | 'hijau';
  dptCount: number;
  lastUpdatedBy: string;
  lastUpdatedDate: string;
  saksi1Id?: string | null;
  saksi1Name?: string | null;
  saksi1Status?: 'belum_pelatihan' | 'terlatih';
  saksi2Id?: string | null;
  saksi2Name?: string | null;
  saksi2Status?: 'belum_pelatihan' | 'terlatih';
}

export interface DdsLog {
  id: string;
  kaderId: string;
  kaderName: string;
  kecamatan: string;
  desa: string;
  residentName: string;
  phone?: string;
  notes: string;
  photoUrl: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface AdvocacyTicket {
  id: string;
  citizenName: string;
  citizenNik: string;
  phone?: string;
  category: 'BPJS' | 'PIP/KIP' | 'Air Bersih' | 'Jalan/Infrastruktur' | 'Lainnya';
  title: string;
  description: string;
  status: 'diusulkan' | 'diproses' | 'selesai';
  kaderId: string;
  kaderName: string;
  kecamatan: string;
  desa: string;
  photoUrl?: string;
  createdAt: string;
  dewanNotes?: string;
  dewanName?: string;
}

export interface Milestone {
  id: string;
  title: string;
  quarter: string;
  year: number;
  phase: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}
