export interface Member {
  id: string;
  name: string;
  ktaNumber: string;
  nik: string;
  role: 'super_admin' | 'pimpinan_dpc' | 'korcam' | 'ketua_ranting' | 'anggota_dewan' | 'bapilu' | 'relawan_terdaftar' | 'anggota';
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
