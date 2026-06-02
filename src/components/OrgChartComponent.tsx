import { useState, useMemo, useRef } from 'react';
import { 
  Users, ZoomIn, ZoomOut, RotateCcw, ShieldCheck, MapPin, 
  Phone, Calendar, UserPlus, GitFork, ChevronDown, ChevronRight, X
} from 'lucide-react';
import type { Member, TpsMapping } from '../types';
import { BANJARNEGARA_REGIONS } from '../mockData';

interface OrgChartComponentProps {
  members: Member[];
  tpsList: TpsMapping[];
  onAddMember: () => void;
  onAssignWitness?: (tpsId: string, slot: 1 | 2) => void;
}

interface OrgNode {
  id: string;
  name: string;
  roleTitle: string;
  ktaNumber?: string;
  photoUrl?: string;
  phone?: string;
  joinDate?: string;
  kecamatan?: string;
  desa?: string;
  tps?: string;
  isMock?: boolean;
  isEmpty?: boolean;
  role?: string;
  children?: OrgNode[];
  slotType?: 'saksi1' | 'saksi2';
  tpsId?: string;
}

export default function OrgChartComponent({ 
  members, 
  tpsList, 
  onAddMember, 
  onAssignWitness 
}: OrgChartComponentProps) {
  const [selectedChartMode, setSelectedChartMode] = useState<string>('DPC'); // 'DPC' or Kecamatan name
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const viewportRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom Controls
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.15, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.15, 0.4));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Viewport Drag/Pan Events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click drag
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Toggle Collapse State of a Node
  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper to build simulated/actual DPC tree
  const dpcTree = useMemo<OrgNode>(() => {
    // Find DPC leaders from members list
    const dpcKetua = members.find(m => m.id === 'm-1' || m.role === 'pimpinan_dpc');
    const dpcSekretaris = members.find(m => m.name.toLowerCase().includes('sugeng') || m.id === 'm-2') || {
      id: 'dpc-sekretaris',
      name: 'Sugeng Wiyono',
      roleTitle: 'Sekretaris DPC',
      ktaNumber: 'KTA-3304-0002',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      role: 'pimpinan_dpc'
    };
    const dpcBendahara = members.find(m => m.name.toLowerCase().includes('mega')) || {
      id: 'dpc-bendahara',
      name: 'Mega Wulandari',
      roleTitle: 'Bendahara DPC',
      ktaNumber: 'KTA-3304-0003',
      photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
      role: 'pimpinan_dpc'
    };

    // Level 1: DPC Ketua
    const root: OrgNode = {
      id: dpcKetua?.id || 'dpc-ketua',
      name: dpcKetua?.name || 'HR. Agung Wibowo, S.H.',
      roleTitle: 'Ketua DPC PDI-P Banjarnegara',
      ktaNumber: dpcKetua?.ktaNumber || 'KTA-3304-0001',
      photoUrl: dpcKetua?.photoUrl || 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&h=150&q=80',
      phone: dpcKetua?.phone || '081122334455',
      joinDate: dpcKetua?.joinDate || '2015-06-01',
      role: 'pimpinan_dpc',
      children: []
    };

    // DPC Board level (Sekretaris & Bendahara directly reporting/adjacent)
    const sekretarisNode: OrgNode = {
      id: dpcSekretaris.id,
      name: dpcSekretaris.name,
      roleTitle: 'Sekretaris DPC',
      ktaNumber: dpcSekretaris.ktaNumber,
      photoUrl: dpcSekretaris.photoUrl,
      phone: (dpcSekretaris as Member).phone || '081234567890',
      joinDate: (dpcSekretaris as Member).joinDate || '2016-08-10',
      role: 'pimpinan_dpc',
      children: []
    };

    const bendaharaNode: OrgNode = {
      id: dpcBendahara.id,
      name: dpcBendahara.name,
      roleTitle: 'Bendahara DPC',
      ktaNumber: dpcBendahara.ktaNumber,
      photoUrl: dpcBendahara.photoUrl,
      phone: (dpcBendahara as Member).phone || '085223344101',
      joinDate: (dpcBendahara as Member).joinDate || '2017-02-14',
      role: 'pimpinan_dpc',
      children: []
    };

    // Level 2: PACs (20 Kecamatan)
    const pacNodes: OrgNode[] = Object.keys(BANJARNEGARA_REGIONS).sort().map(kec => {
      // Find actual Korcam for this kecamatan
      const korcam = members.find(m => m.kecamatan === kec && m.role === 'korcam');
      return {
        id: korcam?.id || `pac-${kec.toLowerCase()}`,
        name: korcam?.name || `Ketua PAC ${kec}`,
        roleTitle: `Ketua PAC Kecamatan ${kec}`,
        ktaNumber: korcam?.ktaNumber || `KTA-3304-PAC-${kec.slice(0,3).toUpperCase()}`,
        photoUrl: korcam?.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
        phone: korcam?.phone || '-',
        joinDate: korcam?.joinDate || '-',
        kecamatan: kec,
        isMock: !korcam,
        role: 'korcam',
        children: BANJARNEGARA_REGIONS[kec].slice(0, 3).map(desa => {
          // Show 3 Rantings per PAC to avoid excessive DPC tree size
          const rantingKetua = members.find(m => m.kecamatan === kec && m.desa === desa && m.role === 'ketua_ranting');
          return {
            id: rantingKetua?.id || `ranting-${kec.toLowerCase()}-${desa.toLowerCase()}`,
            name: rantingKetua?.name || `Ketua Ranting ${desa}`,
            roleTitle: `Ketua Pengurus Ranting ${desa}`,
            ktaNumber: rantingKetua?.ktaNumber || `KTA-3304-RTG-${desa.slice(0,3).toUpperCase()}`,
            photoUrl: rantingKetua?.photoUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
            kecamatan: kec,
            desa: desa,
            isMock: !rantingKetua,
            role: 'ketua_ranting'
          };
        })
      };
    });

    // Wire up the DPC structure
    root.children = [sekretarisNode, bendaharaNode, ...pacNodes];
    return root;
  }, [members]);

  // Helper to build Kecamatan tree
  const kecamatanTree = useMemo<OrgNode | null>(() => {
    if (selectedChartMode === 'DPC') return null;

    const kec = selectedChartMode;
    const korcam = members.find(m => m.kecamatan === kec && m.role === 'korcam');
    
    // PAC Board (Ketua PAC / Korcam, Sekretaris, Bendahara)
    const pacKetua: OrgNode = {
      id: korcam?.id || `pac-ketua-${kec.toLowerCase()}`,
      name: korcam?.name || `Ketua PAC ${kec}`,
      roleTitle: `Ketua PAC Kecamatan ${kec}`,
      ktaNumber: korcam?.ktaNumber || `KTA-PAC-${kec.slice(0,3).toUpperCase()}`,
      photoUrl: korcam?.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      phone: korcam?.phone || '-',
      joinDate: korcam?.joinDate || '-',
      kecamatan: kec,
      isMock: !korcam,
      role: 'korcam',
      children: []
    };

    // Sub-board PAC
    const pacSekretaris: OrgNode = {
      id: `pac-sek-${kec.toLowerCase()}`,
      name: `Sekretaris PAC ${kec}`,
      roleTitle: `Sekretaris PAC Kecamatan ${kec}`,
      ktaNumber: `KTA-PAC-SEK-${kec.slice(0,3).toUpperCase()}`,
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      kecamatan: kec,
      isMock: true,
      role: 'korcam'
    };

    const pacBendahara: OrgNode = {
      id: `pac-bend-${kec.toLowerCase()}`,
      name: `Bendahara PAC ${kec}`,
      roleTitle: `Bendahara PAC Kecamatan ${kec}`,
      ktaNumber: `KTA-PAC-BEN-${kec.slice(0,3).toUpperCase()}`,
      photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
      kecamatan: kec,
      isMock: true,
      role: 'korcam'
    };

    // Level 2: Ranting (All Desas in this Kecamatan)
    const desasOfKec = BANJARNEGARA_REGIONS[kec] || [];
    const rantingNodes: OrgNode[] = desasOfKec.map(desa => {
      const rantingKetua = members.find(m => m.kecamatan === kec && m.desa === desa && m.role === 'ketua_ranting');
      
      // Level 3: Anak Ranting (TPS Mapping & Witnesses under this Desa)
      const tpsOfDesa = tpsList.filter(t => t.kecamatan === kec && t.desa === desa);
      const anakRantingNodes: OrgNode[] = tpsOfDesa.map(tps => {
        // Saksi 1 Node
        const saksi1: OrgNode = tps.saksi1Name ? {
          id: `saksi1-${tps.id}`,
          name: tps.saksi1Name,
          roleTitle: `Saksi 1 (TPS ${tps.namaTps.replace(/^\D+/g, '')})`,
          ktaNumber: `KTA-SAKSI-1-${tps.id.toUpperCase()}`,
          photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
          kecamatan: kec,
          desa: desa,
          tps: tps.namaTps,
          role: 'anggota'
        } : {
          id: `saksi1-empty-${tps.id}`,
          name: 'Belum Terisi',
          roleTitle: `Saksi 1 (TPS ${tps.namaTps.replace(/^\D+/g, '')})`,
          isEmpty: true,
          slotType: 'saksi1',
          tpsId: tps.id
        };

        // Saksi 2 Node
        const saksi2: OrgNode = tps.saksi2Name ? {
          id: `saksi2-${tps.id}`,
          name: tps.saksi2Name,
          roleTitle: `Saksi 2 (TPS ${tps.namaTps.replace(/^\D+/g, '')})`,
          ktaNumber: `KTA-SAKSI-2-${tps.id.toUpperCase()}`,
          photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
          kecamatan: kec,
          desa: desa,
          tps: tps.namaTps,
          role: 'anggota'
        } : {
          id: `saksi2-empty-${tps.id}`,
          name: 'Belum Terisi',
          roleTitle: `Saksi 2 (TPS ${tps.namaTps.replace(/^\D+/g, '')})`,
          isEmpty: true,
          slotType: 'saksi2',
          tpsId: tps.id
        };

        return {
          id: `tps-node-${tps.id}`,
          name: tps.namaTps,
          roleTitle: `Pengurus Anak Ranting`,
          kecamatan: kec,
          desa: desa,
          children: [saksi1, saksi2]
        };
      });

      return {
        id: rantingKetua?.id || `ranting-${kec.toLowerCase()}-${desa.toLowerCase()}`,
        name: rantingKetua?.name || `Ketua Ranting ${desa}`,
        roleTitle: `Ketua Ranting Desa ${desa}`,
        ktaNumber: rantingKetua?.ktaNumber || `KTA-RTG-${desa.slice(0,3).toUpperCase()}`,
        photoUrl: rantingKetua?.photoUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
        phone: rantingKetua?.phone || '-',
        joinDate: rantingKetua?.joinDate || '-',
        kecamatan: kec,
        desa: desa,
        isMock: !rantingKetua,
        role: 'ketua_ranting',
        children: anakRantingNodes.length > 0 ? anakRantingNodes : undefined
      };
    });

    pacKetua.children = [pacSekretaris, pacBendahara, ...rantingNodes];
    return pacKetua;
  }, [selectedChartMode, members, tpsList]);

  const currentTreeRoot = selectedChartMode === 'DPC' ? dpcTree : kecamatanTree;

  // Node Renderer
  const renderNode = (node: OrgNode) => {
    const isCollapsed = collapsedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;

    let roleColor = 'border-pdip-red bg-pdip-metal/90 text-red-400';
    if (node.role === 'pimpinan_dpc') roleColor = 'border-amber-500 bg-pdip-metal/90 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]';
    if (node.role === 'korcam') roleColor = 'border-red-500 bg-pdip-metal/90 text-red-400';
    if (node.role === 'ketua_ranting') roleColor = 'border-sky-500 bg-pdip-metal/90 text-sky-400';
    if (node.isEmpty) roleColor = 'border-dashed border-gray-600 bg-pdip-black/40 text-gray-500 hover:border-pdip-red hover:text-red-400';

    return (
      <div className="flex flex-col items-center relative px-4" key={node.id}>
        {/* Node Card */}
        <div 
          onClick={() => {
            if (node.isEmpty) {
              if (onAssignWitness && node.tpsId && node.slotType) {
                onAssignWitness(node.tpsId, node.slotType === 'saksi1' ? 1 : 2);
              } else {
                onAddMember();
              }
            } else {
              setSelectedNode(node);
            }
          }}
          className={`w-64 p-4 rounded-xl border backdrop-blur-md transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 cursor-pointer z-10 ${roleColor}`}
        >
          {node.isEmpty ? (
            <div className="flex flex-col items-center justify-center py-2 text-center space-y-2">
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 group-hover:border-pdip-red group-hover:text-pdip-red transition">
                <UserPlus size={20} />
              </div>
              <div>
                <span className="font-bold text-xs uppercase tracking-wider block">{node.name}</span>
                <span className="text-[10px] text-gray-400 block mt-1">Saksi Kosong</span>
              </div>
              <button className="text-[10px] font-bold px-2 py-1 rounded bg-red-950/40 text-red-400 hover:bg-pdip-red hover:text-white transition">
                Tugaskan Saksi
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {node.photoUrl ? (
                <img 
                  src={node.photoUrl} 
                  alt={node.name} 
                  className={`w-12 h-12 rounded-full object-cover border-2 ${
                    node.role === 'pimpinan_dpc' ? 'border-amber-500' : 'border-pdip-red/50'
                  }`}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-pdip-darkgray flex items-center justify-center text-gray-400 border border-red-900/20">
                  <Users size={20} />
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <span className="font-bold text-white block text-sm truncate">{node.name}</span>
                <span className="text-[10px] text-gray-400 block mt-0.5 font-medium truncate uppercase tracking-wider">{node.roleTitle}</span>
                {node.ktaNumber && (
                  <span className="font-mono text-[9px] text-red-400 font-bold block mt-1">{node.ktaNumber}</span>
                )}
                {node.isMock && (
                  <span className="text-[9px] bg-red-950/60 border border-red-900/30 text-red-400 font-bold px-1.5 py-0.5 rounded block w-max mt-1">Plt / Pjs</span>
                )}
              </div>
            </div>
          )}

          {/* Node Collapse Control */}
          {hasChildren && (
            <button
              onClick={(e) => toggleCollapse(node.id, e)}
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-pdip-metal border border-red-950/20 shadow-md flex items-center justify-center hover:bg-pdip-red hover:text-white transition z-20 text-gray-400"
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>

        {/* Child Nodes Connector */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center w-full">
            {/* Vertical Line under parent */}
            <div className="w-0.5 h-8 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
            
            {/* Subtree Row */}
            <div className="flex justify-center relative pt-4">
              {node.children!.map((child, index) => {
                const isFirst = index === 0;
                const isLast = index === node.children!.length - 1;
                
                return (
                  <div className="flex flex-col items-center relative" key={child.id}>
                    {/* Horizontal connection line segment */}
                    {node.children!.length > 1 && (
                      <div className={`absolute top-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] ${
                        isFirst ? 'left-1/2 right-0' : 
                        isLast ? 'left-0 right-1/2' : 
                        'left-0 right-0'
                      }`} />
                    )}
                    
                    {/* Vertical top connection stub */}
                    <div className="w-0.5 h-4 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                    
                    {renderNode(child)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Selector & Controls panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-red-950/40 text-pdip-red border border-red-900/20">
            <GitFork size={20} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Bagan Organisasi Kepengurusan</h3>
            <p className="text-xs text-gray-400">PDI Perjuangan DPC Kabupaten Banjarnegara</p>
          </div>
        </div>

        {/* Dropdown Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1 uppercase tracking-wider font-semibold">Tingkat Struktur</label>
            <select
              value={selectedChartMode}
              onChange={(e) => {
                setSelectedChartMode(e.target.value);
                handleReset();
              }}
              className="bg-pdip-black text-white text-sm px-4 py-2.5 rounded-lg border border-red-900/30 focus:outline-none focus:border-pdip-red w-64 shadow-inner"
            >
              <option value="DPC">🏛️ DPC (Dewan Pimpinan Cabang)</option>
              <optgroup label="PAC (Tingkat Kecamatan)">
                {Object.keys(BANJARNEGARA_REGIONS).sort().map(kec => (
                  <option key={kec} value={kec}>📍 PAC Kecamatan {kec}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Interactive controls */}
          <div className="flex items-end gap-1.5 h-full pt-5">
            <button 
              onClick={handleZoomIn} 
              className="p-2.5 rounded-lg bg-pdip-black text-gray-400 hover:text-white border border-red-900/20 transition hover:bg-pdip-red"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button 
              onClick={handleZoomOut} 
              className="p-2.5 rounded-lg bg-pdip-black text-gray-400 hover:text-white border border-red-900/20 transition hover:bg-pdip-red"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <button 
              onClick={handleReset} 
              className="p-2.5 rounded-lg bg-pdip-black text-gray-400 hover:text-white border border-red-900/20 transition hover:bg-pdip-red"
              title="Reset Tampilan"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <div 
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-[650px] bg-pdip-black/40 rounded-2xl border border-red-950/20 overflow-hidden relative shadow-2xl cursor-grab active:cursor-grabbing select-none"
      >
        {/* Zoom scale info badge */}
        <div className="absolute top-4 left-4 z-30 bg-pdip-metal/80 backdrop-blur border border-red-950/20 px-3 py-1.5 rounded-lg text-[10px] font-mono text-gray-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-pdip-red animate-ping"></span>
          <span>Skala: {Math.round(scale * 100)}%</span>
        </div>

        {/* Tip Badge */}
        <div className="absolute bottom-4 right-4 z-30 bg-pdip-metal/80 backdrop-blur border border-red-950/20 px-3 py-1.5 rounded-lg text-[10px] text-gray-400 flex items-center gap-1.5">
          <span>💡 Seret/Drag kanvas untuk menggeser bagan ke segala arah</span>
        </div>

        {/* Infinite Canvas */}
        <div 
          className="absolute transition-transform duration-75 origin-top flex flex-col items-center pt-12"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            left: '50%',
            transformOrigin: 'top center',
            marginLeft: '-1000px',
            width: '2000px',
            top: '0'
          }}
        >
          {currentTreeRoot ? (
            <div className="flex flex-col items-center">
              {renderNode(currentTreeRoot)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-24 text-gray-400 space-y-4">
              <GitFork size={48} className="text-red-900/40" />
              <span>Gagal memuat struktur organigram keanggotaan.</span>
            </div>
          )}
        </div>
      </div>

      {/* Slide-out Node Details Profile Drawer */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
          {/* Overlay backdrop */}
          <div 
            onClick={() => setSelectedNode(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer container */}
          <div className="w-full max-w-md bg-pdip-metal h-full border-l border-red-950/20 shadow-2xl relative z-10 flex flex-col p-6 animate-slideInRight text-left overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-red-950/20 pb-4">
              <h4 className="font-bold text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-pdip-red" /> Detail Profil Pengurus
              </h4>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1.5 rounded-lg bg-pdip-black text-gray-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Avatar Card */}
            <div className="mt-6 flex flex-col items-center text-center space-y-3 bg-pdip-black/25 p-5 rounded-2xl border border-red-900/10">
              {selectedNode.photoUrl ? (
                <img 
                  src={selectedNode.photoUrl} 
                  alt={selectedNode.name} 
                  className="w-24 h-24 rounded-full object-cover border-4 border-pdip-red/35 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-pdip-darkgray flex items-center justify-center text-gray-400 border-2 border-dashed border-red-900/30">
                  <Users size={32} />
                </div>
              )}
              <div>
                <h3 className="font-black text-white text-lg">{selectedNode.name}</h3>
                <span className="text-xs text-pdip-red font-bold uppercase tracking-wider block mt-1">{selectedNode.roleTitle}</span>
                {selectedNode.ktaNumber && (
                  <span className="font-mono text-xs text-gray-400 block mt-1.5 bg-pdip-black px-3 py-1 rounded-lg border border-red-900/10">{selectedNode.ktaNumber}</span>
                )}
              </div>
            </div>

            {/* Bio List */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-pdip-black/15 rounded-xl border border-red-950/10">
                <MapPin size={16} className="text-pdip-red shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Wilayah Tugas</span>
                  <span className="text-sm font-bold text-white block mt-0.5">
                    {selectedNode.kecamatan ? `Kec. ${selectedNode.kecamatan}` : 'Kabupaten Banjarnegara'}
                    {selectedNode.desa && ` ➔ Desa ${selectedNode.desa}`}
                    {selectedNode.tps && ` ➔ ${selectedNode.tps}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-pdip-black/15 rounded-xl border border-red-950/10">
                <Phone size={16} className="text-sky-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Nomor Handphone</span>
                  {selectedNode.phone && selectedNode.phone !== '-' ? (
                    <a 
                      href={`https://wa.me/${selectedNode.phone.replace(/^0/, '62')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-sky-400 hover:underline block mt-0.5"
                    >
                      {selectedNode.phone} (Hubungi via WA 🚀)
                    </a>
                  ) : (
                    <span className="text-sm font-bold text-gray-400 block mt-0.5">-</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-pdip-black/15 rounded-xl border border-red-950/10">
                <Calendar size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Tanggal Bergabung</span>
                  <span className="text-sm font-bold text-white block mt-0.5">{selectedNode.joinDate || '2026-05-27'}</span>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="mt-auto pt-6 border-t border-red-950/20">
              <button 
                onClick={() => setSelectedNode(null)}
                className="w-full bg-pdip-black border border-red-900/30 text-white font-bold py-3 rounded-xl hover:bg-pdip-red hover:border-pdip-red transition text-center text-sm shadow-md"
              >
                Tutup Detail Profil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
