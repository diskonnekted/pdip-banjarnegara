import React, { useState, useMemo } from 'react';
import { Calculator, Save, RefreshCw, BarChart2, Shield, Filter } from 'lucide-react';

const PARTIES = [
  'PKB', 'GERINDRA', 'PDIP', 'GOLKAR', 'NASDEM', 'BURUH', 'GELORA', 'PKS',
  'PKN', 'HANURA', 'GARUDA', 'PAN', 'PBB', 'DEMOKRAT', 'PSI', 'PERINDO', 'PPP', 'UMMAT'
];

type PartyData = {
  name: string;
  suara2024: number;
  target2029: number;
};

// Initial data hardcoded from images
const INITIAL_DATA: Record<number, PartyData[]> = {
  1: [
    { name: 'PKB', suara2024: 10991, target2029: 9991 },
    { name: 'GERINDRA', suara2024: 5623, target2029: 5623 },
    { name: 'PDIP', suara2024: 15150, target2029: 20150 },
    { name: 'GOLKAR', suara2024: 16891, target2029: 14891 },
    { name: 'NASDEM', suara2024: 15018, target2029: 14018 },
    { name: 'BURUH', suara2024: 0, target2029: 0 },
    { name: 'GELORA', suara2024: 1849, target2029: 1849 },
    { name: 'PKS', suara2024: 11656, target2029: 11656 },
    { name: 'PKN', suara2024: 61, target2029: 61 },
    { name: 'HANURA', suara2024: 426, target2029: 426 },
    { name: 'GARUDA', suara2024: 0, target2029: 0 },
    { name: 'PAN', suara2024: 6049, target2029: 5549 },
    { name: 'PBB', suara2024: 115, target2029: 115 },
    { name: 'DEMOKRAT', suara2024: 21013, target2029: 20513 },
    { name: 'PSI', suara2024: 590, target2029: 590 },
    { name: 'PERINDO', suara2024: 419, target2029: 419 },
    { name: 'PPP', suara2024: 9372, target2029: 9372 },
    { name: 'UMMAT', suara2024: 600, target2029: 600 }
  ],
  2: [
    { name: 'PKB', suara2024: 22600, target2029: 20600 },
    { name: 'GERINDRA', suara2024: 6741, target2029: 6741 },
    { name: 'PDIP', suara2024: 18798, target2029: 23798 },
    { name: 'GOLKAR', suara2024: 6876, target2029: 5876 },
    { name: 'NASDEM', suara2024: 3916, target2029: 3916 },
    { name: 'BURUH', suara2024: 0, target2029: 0 },
    { name: 'GELORA', suara2024: 757, target2029: 757 },
    { name: 'PKS', suara2024: 10448, target2029: 10448 },
    { name: 'PKN', suara2024: 363, target2029: 363 },
    { name: 'HANURA', suara2024: 7127, target2029: 6627 },
    { name: 'GARUDA', suara2024: 0, target2029: 0 },
    { name: 'PAN', suara2024: 5485, target2029: 4985 },
    { name: 'PBB', suara2024: 157, target2029: 157 },
    { name: 'DEMOKRAT', suara2024: 10451, target2029: 9951 },
    { name: 'PSI', suara2024: 193, target2029: 193 },
    { name: 'PERINDO', suara2024: 155, target2029: 155 },
    { name: 'PPP', suara2024: 12777, target2029: 12277 },
    { name: 'UMMAT', suara2024: 722, target2029: 722 }
  ],
  3: [
    { name: 'PKB', suara2024: 17629, target2029: 17129 },
    { name: 'GERINDRA', suara2024: 6031, target2029: 6031 },
    { name: 'PDIP', suara2024: 18964, target2029: 20464 },
    { name: 'GOLKAR', suara2024: 9317, target2029: 9317 },
    { name: 'NASDEM', suara2024: 1074, target2029: 1074 },
    { name: 'BURUH', suara2024: 0, target2029: 0 },
    { name: 'GELORA', suara2024: 404, target2029: 404 },
    { name: 'PKS', suara2024: 16437, target2029: 15937 },
    { name: 'PKN', suara2024: 108, target2029: 108 },
    { name: 'HANURA', suara2024: 7923, target2029: 7923 },
    { name: 'GARUDA', suara2024: 0, target2029: 0 },
    { name: 'PAN', suara2024: 7356, target2029: 7356 },
    { name: 'PBB', suara2024: 116, target2029: 116 },
    { name: 'DEMOKRAT', suara2024: 12122, target2029: 11622 },
    { name: 'PSI', suara2024: 326, target2029: 326 },
    { name: 'PERINDO', suara2024: 243, target2029: 243 },
    { name: 'PPP', suara2024: 5456, target2029: 5456 },
    { name: 'UMMAT', suara2024: 670, target2029: 670 }
  ],
  4: [
    { name: 'PKB', suara2024: 14102, target2029: 13102 },
    { name: 'GERINDRA', suara2024: 5379, target2029: 5379 },
    { name: 'PDIP', suara2024: 12022, target2029: 21022 },
    { name: 'GOLKAR', suara2024: 6428, target2029: 5428 },
    { name: 'NASDEM', suara2024: 6853, target2029: 4853 },
    { name: 'BURUH', suara2024: 0, target2029: 0 },
    { name: 'GELORA', suara2024: 399, target2029: 399 },
    { name: 'PKS', suara2024: 10360, target2029: 9360 },
    { name: 'PKN', suara2024: 497, target2029: 497 },
    { name: 'HANURA', suara2024: 5098, target2029: 3098 },
    { name: 'GARUDA', suara2024: 0, target2029: 0 },
    { name: 'PAN', suara2024: 8294, target2029: 7294 },
    { name: 'PBB', suara2024: 83, target2029: 83 },
    { name: 'DEMOKRAT', suara2024: 20807, target2029: 19307 },
    { name: 'PSI', suara2024: 201, target2029: 201 },
    { name: 'PERINDO', suara2024: 257, target2029: 257 },
    { name: 'PPP', suara2024: 7833, target2029: 7833 },
    { name: 'UMMAT', suara2024: 221, target2029: 221 }
  ],
  5: [
    { name: 'PKB', suara2024: 12637, target2029: 12637 },
    { name: 'GERINDRA', suara2024: 7432, target2029: 7432 },
    { name: 'PDIP', suara2024: 20468, target2029: 23968 },
    { name: 'GOLKAR', suara2024: 8163, target2029: 7163 },
    { name: 'NASDEM', suara2024: 8830, target2029: 7830 },
    { name: 'BURUH', suara2024: 0, target2029: 0 },
    { name: 'GELORA', suara2024: 525, target2029: 525 },
    { name: 'PKS', suara2024: 2316, target2029: 2316 },
    { name: 'PKN', suara2024: 22, target2029: 22 },
    { name: 'HANURA', suara2024: 67, target2029: 67 },
    { name: 'GARUDA', suara2024: 1, target2029: 1 },
    { name: 'PAN', suara2024: 9494, target2029: 8994 },
    { name: 'PBB', suara2024: 85, target2029: 85 },
    { name: 'DEMOKRAT', suara2024: 14239, target2029: 14239 },
    { name: 'PSI', suara2024: 236, target2029: 236 },
    { name: 'PERINDO', suara2024: 147, target2029: 147 },
    { name: 'PPP', suara2024: 5095, target2029: 4095 },
    { name: 'UMMAT', suara2024: 262, target2029: 262 }
  ],
  6: [
    { name: 'PKB', suara2024: 13661, target2029: 13161 },
    { name: 'GERINDRA', suara2024: 19658, target2029: 18658 },
    { name: 'PDIP', suara2024: 7428, target2029: 9928 },
    { name: 'GOLKAR', suara2024: 8845, target2029: 8845 },
    { name: 'NASDEM', suara2024: 438, target2029: 438 },
    { name: 'BURUH', suara2024: 0, target2029: 0 },
    { name: 'GELORA', suara2024: 368, target2029: 368 },
    { name: 'PKS', suara2024: 6961, target2029: 6461 },
    { name: 'PKN', suara2024: 25, target2029: 25 },
    { name: 'HANURA', suara2024: 56, target2029: 56 },
    { name: 'GARUDA', suara2024: 0, target2029: 0 },
    { name: 'PAN', suara2024: 2768, target2029: 2768 },
    { name: 'PBB', suara2024: 63, target2029: 63 },
    { name: 'DEMOKRAT', suara2024: 12403, target2029: 11903 },
    { name: 'PSI', suara2024: 194, target2029: 194 },
    { name: 'PERINDO', suara2024: 56, target2029: 56 },
    { name: 'PPP', suara2024: 1413, target2029: 1413 },
    { name: 'UMMAT', suara2024: 263, target2029: 263 }
  ]
};

const DAPIL_SEATS: Record<number, number> = {
  1: 10,
  2: 9,
  3: 9,
  4: 9,
  5: 7,
  6: 6
};

// UI Colors for prominent parties to match mockups
const PARTY_COLORS: Record<string, string> = {
  'PDIP': 'bg-red-600 text-white border-red-700',
  'PKB': 'bg-[#98C222] text-white border-[#84a91c]', // Green
  'GERINDRA': 'bg-[#D3B470] text-black border-[#bfa262]', // Light Gold/Brown
  'DEMOKRAT': 'bg-[#0092D0] text-white border-[#007ba6]', // Blue
  'GOLKAR': 'bg-[#FFD700] text-black border-[#d4b400]', // Yellow
  'NASDEM': 'bg-[#004A8F] text-white border-[#00386e]', // Dark Blue
  'PKS': 'bg-[#F28224] text-white border-[#d8721c]', // Orange
  'HANURA': 'bg-[#F2A900] text-black border-[#d69500]', // Gold/Orange
  'PAN': 'bg-[#00529F] text-white border-[#00407a]', // Blue
  'PPP': 'bg-[#00B050] text-white border-[#009644]' // Green
};

export default function SainteLagueCalculator() {
  const [selectedDapil, setSelectedDapil] = useState<number>(1);
  const [data, setData] = useState<Record<number, PartyData[]>>(INITIAL_DATA);
  const [sortOrder, setSortOrder] = useState<'default' | 'target-desc' | 'target-asc' | 'kursi-desc'>('default');

  const totalSeats = DAPIL_SEATS[selectedDapil];
  
  // Calculate max divisors needed (1, 3, 5). Up to totalSeats theoretically, 
  // but usually 1, 3, 5 is enough for Banjarnegara context. We calculate dynamically.
  // In the PNG they show "Bagi 1", "Bagi 3" mostly. We'll show up to Bagi 5 for safety, 
  // or dynamically based on the max seats a single party wins.
  
  const divisors = [1, 3, 5, 7, 9];

  // Perform calculation
  const calculations = useMemo(() => {
    const currentData = data[selectedDapil];
    
    // Create a list of all possible quotients
    let allQuotients: { party: string; divisor: number; quotient: number }[] = [];
    
    currentData.forEach(party => {
      if (party.target2029 > 0) {
        divisors.forEach(div => {
          allQuotients.push({
            party: party.name,
            divisor: div,
            quotient: party.target2029 / div
          });
        });
      }
    });

    // Sort all quotients descending
    allQuotients.sort((a, b) => b.quotient - a.quotient);

    // Pick top `totalSeats`
    const winningQuotients = allQuotients.slice(0, totalSeats);

    // Map winners to seat order
    const seatOrder = winningQuotients.map((q, index) => ({
      party: q.party,
      seatNumber: index + 1,
      quotient: q.quotient,
      divisor: q.divisor
    }));

    // Calculate total seats per party
    const seatsPerParty: Record<string, number> = {};
    seatOrder.forEach(seat => {
      seatsPerParty[seat.party] = (seatsPerParty[seat.party] || 0) + 1;
    });

    // Helper to check if a specific quotient cell is a winner
    const isWinner = (partyName: string, divisor: number) => {
      return winningQuotients.some(q => q.party === partyName && q.divisor === divisor);
    };

    return { seatOrder, seatsPerParty, isWinner };
  }, [data, selectedDapil, totalSeats]);

  const handleTargetChange = (partyName: string, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value.replace(/\D/g, ''), 10);
    if (isNaN(numValue)) return;

    setData(prev => {
      const currentDapilData = prev[selectedDapil];
      const targetParty = currentDapilData.find(p => p.name === partyName);
      if (!targetParty) return prev;

      const diff = targetParty.target2029 - numValue;

      return {
        ...prev,
        [selectedDapil]: currentDapilData.map(p => {
          if (p.name === partyName) {
            return { ...p, target2029: numValue };
          }
          // Pindahkan selisih suara ke PDIP jika yang diedit bukan PDIP
          if (partyName !== 'PDIP' && p.name === 'PDIP') {
            return { ...p, target2029: Math.max(0, p.target2029 + diff) };
          }
          return p;
        })
      };
    });
  };

  const handleReset = () => {
    setData(INITIAL_DATA);
  };

  const activeData = data[selectedDapil];
  const totalSuaraSah = activeData.reduce((sum, p) => sum + p.target2029, 0);

  const sortedData = useMemo(() => {
    let result = [...activeData];
    if (sortOrder === 'target-desc') {
      result.sort((a, b) => b.target2029 - a.target2029);
    } else if (sortOrder === 'target-asc') {
      result.sort((a, b) => a.target2029 - b.target2029);
    } else if (sortOrder === 'kursi-desc') {
      result.sort((a, b) => {
        const kursiA = calculations.seatsPerParty[a.name] || 0;
        const kursiB = calculations.seatsPerParty[b.name] || 0;
        if (kursiB !== kursiA) return kursiB - kursiA;
        return b.target2029 - a.target2029;
      });
    }
    return result;
  }, [activeData, sortOrder, calculations.seatsPerParty]);

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden animate-fadeIn">
      {/* Header */}
      <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Calculator className="w-5 h-5 text-pdip-red" />
            <h2 className="text-lg font-bold text-white font-serif uppercase tracking-wider">Simulasi Sainte-Laguë 2029</h2>
          </div>
          <p className="text-xs text-gray-400">Kalkulator alokasi kursi DPRD metode Sainte-Laguë (Bagi ganjil: 1, 3, 5, ...)</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white px-3 py-2 rounded-lg border border-red-950/20 hover:border-gray-500 transition"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Data Default
          </button>

          <div className="bg-pdip-black border border-red-900/35 rounded-lg px-2 py-1 flex items-center">
            <Filter className="w-3 h-3 text-gray-400 mr-2" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value="default" className="bg-pdip-black text-white">Urutan Standar</option>
              <option value="target-desc" className="bg-pdip-black text-white">Suara Terbanyak</option>
              <option value="target-asc" className="bg-pdip-black text-white">Suara Terkecil</option>
              <option value="kursi-desc" className="bg-pdip-black text-white">Perolehan Kursi</option>
            </select>
          </div>

          <div className="bg-pdip-black border border-red-900/35 rounded-lg px-2 py-1 flex items-center">
            <label className="text-xs text-gray-400 font-bold px-2 uppercase">Dapil:</label>
            <select
              value={selectedDapil}
              onChange={(e) => setSelectedDapil(Number(e.target.value))}
              className="bg-transparent text-sm text-white font-bold focus:outline-none min-w-[100px] cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6].map(d => (
                <option key={d} value={d} className="bg-pdip-black text-white">Dapil {d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Calculator Table */}
        <div className="lg:col-span-3 bg-pdip-metal rounded-xl border border-red-950/20 shadow-md overflow-hidden">
          <div className="p-4 border-b border-red-950/20 flex justify-between items-center bg-pdip-darkgray/50">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">
              Kalkulasi Dapil {selectedDapil} <span className="text-pdip-red ml-2">({totalSeats} Kursi)</span>
            </h3>
            <div className="text-xs font-mono font-bold text-gray-400">
              TOTAL SUARA SAH: <span className="text-white text-sm">{totalSuaraSah.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-pdip-darkgray text-gray-400 font-bold uppercase border-b border-red-950/20">
                  <th className="px-4 py-3 text-center w-10">NO</th>
                  <th className="px-4 py-3">PARTAI</th>
                  <th className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">SUARA 2024</th>
                  <th className="px-4 py-3 text-right bg-red-950/10">TARGET 2029</th>
                  <th className="px-4 py-3 text-right">BAGI 1</th>
                  <th className="px-4 py-3 text-right">BAGI 3</th>
                  <th className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">BAGI 5</th>
                  <th className="px-4 py-3 text-center bg-pdip-darkgray/80 border-l border-red-950/20">KURSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-950/10 font-mono text-sm">
                {sortedData.map((party, index) => {
                  const bagi1 = Math.floor(party.target2029 / 1);
                  const bagi3 = Math.floor(party.target2029 / 3);
                  const bagi5 = Math.floor(party.target2029 / 5);
                  
                  const isWinner1 = calculations.isWinner(party.name, 1);
                  const isWinner3 = calculations.isWinner(party.name, 3);
                  const isWinner5 = calculations.isWinner(party.name, 5);
                  
                  const totalKursi = calculations.seatsPerParty[party.name] || 0;
                  const isPDIP = party.name === 'PDIP';

                  return (
                    <tr key={party.name} className={`hover:bg-pdip-darkgray/40 transition ${isPDIP ? 'bg-red-950/5' : ''}`}>
                      <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                      <td className={`px-4 py-3 font-bold font-sans ${isPDIP ? 'text-pdip-red' : 'text-gray-300'}`}>
                        {party.name}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                        {party.suara2024.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right bg-red-950/10">
                        <input
                          type="text"
                          value={party.target2029.toLocaleString()}
                          onChange={(e) => handleTargetChange(party.name, e.target.value)}
                          className={`w-24 text-right bg-pdip-black border ${isPDIP ? 'border-pdip-red text-white' : 'border-red-900/30 text-gray-300'} px-2 py-1 rounded focus:outline-none focus:border-pdip-gold transition`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right p-1">
                        <div className={`px-2 py-1 rounded border inline-block min-w-[70px] ${isWinner1 ? PARTY_COLORS[party.name] || 'bg-gray-700 text-white border-gray-500' : 'border-transparent text-gray-400'}`}>
                          {bagi1.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right p-1">
                        <div className={`px-2 py-1 rounded border inline-block min-w-[70px] ${isWinner3 ? PARTY_COLORS[party.name] || 'bg-gray-700 text-white border-gray-500' : 'border-transparent text-gray-400'}`}>
                          {bagi3 > 0 ? bagi3.toLocaleString() : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right p-1 hidden sm:table-cell">
                        <div className={`px-2 py-1 rounded border inline-block min-w-[70px] ${isWinner5 ? PARTY_COLORS[party.name] || 'bg-gray-700 text-white border-gray-500' : 'border-transparent text-gray-500'}`}>
                          {bagi5 > 0 ? bagi5.toLocaleString() : '-'}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-bold text-lg border-l border-red-950/20 bg-pdip-darkgray/30 ${totalKursi > 0 ? (isPDIP ? 'text-pdip-gold' : 'text-white') : 'text-gray-600'}`}>
                        {totalKursi > 0 ? totalKursi : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <div className="bg-pdip-metal rounded-xl border border-red-950/20 shadow-md overflow-hidden">
            <div className="p-4 border-b border-red-950/20 flex gap-2 items-center">
              <Shield className="w-4 h-4 text-pdip-gold" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">Urutan Kursi</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-pdip-darkgray/50 text-gray-500 font-bold uppercase border-b border-red-950/20">
                    <th className="px-4 py-2">Ke</th>
                    <th className="px-4 py-2">Partai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-950/10 font-sans font-bold text-[11px]">
                  {calculations.seatOrder.map((seat) => {
                    const isPDIP = seat.party === 'PDIP';
                    return (
                      <tr key={seat.seatNumber} className={isPDIP ? 'bg-red-900/20' : ''}>
                        <td className="px-4 py-2 text-gray-400 w-10 text-center">{seat.seatNumber}</td>
                        <td className="px-4 py-1">
                          <span className={`inline-block px-2 py-1 rounded border w-full text-center ${PARTY_COLORS[seat.party] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                            {seat.party}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-pdip-metal p-5 rounded-xl border border-red-950/20 shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Analisis Strategis PDIP</h3>
            <div className="space-y-3">
              <div className="bg-pdip-black p-3 rounded border border-red-900/30">
                <span className="text-[10px] text-gray-500 block uppercase font-bold mb-1">Target Suara</span>
                <span className="text-lg font-black text-pdip-red font-mono">
                  {activeData.find(p => p.name === 'PDIP')?.target2029.toLocaleString() || 0}
                </span>
              </div>
              <div className="bg-pdip-black p-3 rounded border border-red-900/30">
                <span className="text-[10px] text-gray-500 block uppercase font-bold mb-1">Perolehan Kursi</span>
                <span className="text-xl font-black text-pdip-gold font-serif">
                  {calculations.seatsPerParty['PDIP'] || 0} <span className="text-xs font-normal text-gray-400">dari {totalSeats}</span>
                </span>
              </div>
              {calculations.seatsPerParty['PDIP'] > 0 && (
                <div className="text-[10px] text-gray-400 font-medium leading-relaxed">
                  PDI Perjuangan mendapatkan kursi urutan ke-{calculations.seatOrder.filter(s => s.party === 'PDIP').map(s => s.seatNumber).join(', ')}.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
