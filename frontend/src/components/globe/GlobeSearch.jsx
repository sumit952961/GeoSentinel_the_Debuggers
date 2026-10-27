import React, { useState, useMemo } from 'react';
import { Search, X, Hospital, Home, Building2, Layers } from 'lucide-react';
import { TYPE } from '../../design-system/tokens';

/**
 * AIDRS — 3D Globe Omni-Search HUD
 * Professional search component: search by Structure ID, Hospital, Shelter, or Scenario.
 */
export default function GlobeSearch({
  buildings = [],
  hospitals = [],
  shelters = [],
  scenarios = [],
  onSelectBuilding,
  onSelectHospital,
  onSelectShelter,
  onSelectScenario,
  isDark = true
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const fontFam = TYPE?.fontFamily || "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Search Results Filter
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    const matches = [];

    // 1. Match Scenarios
    for (const s of scenarios) {
      if (s.name.toLowerCase().includes(q)) {
        matches.push({ type: 'scenario', id: s.id, title: s.name, subtitle: 'Disaster Scenario', data: s });
      }
    }

    // 2. Match Hospitals
    for (const h of hospitals) {
      const name = h.properties?.name || '';
      if (name.toLowerCase().includes(q)) {
        matches.push({ type: 'hospital', id: h.properties?.id, title: name, subtitle: 'Emergency Hospital', data: h });
      }
    }

    // 3. Match Shelters
    for (const s of shelters) {
      const name = s.properties?.name || '';
      if (name.toLowerCase().includes(q)) {
        matches.push({ type: 'shelter', id: s.properties?.id, title: name, subtitle: 'Relief Shelter', data: s });
      }
    }

    // 4. Match Buildings (by ID or damage class)
    const cleanNum = q.replace(/^#/, '').replace(/^b-?/, '');
    for (const b of buildings) {
      const bId = String(b.properties?.buildingId || b.properties?.building_id || b.properties?.id || '');
      const dClass = b.properties?.damageClass || b.properties?.damage_class || '';
      const pLevel = b.properties?.priorityLevel || b.properties?.priority_level || '';

      if (bId === cleanNum || bId.includes(cleanNum) || (q.length > 2 && dClass.toLowerCase().includes(q))) {
        matches.push({
          type: 'building',
          id: bId,
          title: `Structure #${bId}`,
          subtitle: `${dClass.toUpperCase()} • Priority: ${pLevel}`,
          data: b
        });
      }
      if (matches.length >= 8) break;
    }

    return matches.slice(0, 8);
  }, [query, buildings, hospitals, shelters, scenarios]);

  const handleSelect = (item) => {
    setQuery('');
    setIsOpen(false);

    if (item.type === 'building' && onSelectBuilding) {
      onSelectBuilding(item.data);
    } else if (item.type === 'hospital' && onSelectHospital) {
      onSelectHospital(item.data);
    } else if (item.type === 'shelter' && onSelectShelter) {
      onSelectShelter(item.data);
    } else if (item.type === 'scenario' && onSelectScenario) {
      onSelectScenario(item.id);
    }
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'hospital': return <Hospital size={14} color="#059669" />;
      case 'shelter': return <Home size={14} color="#0284c7" />;
      case 'building': return <Building2 size={14} color="#f59e0b" />;
      case 'scenario': return <Layers size={14} color="#8b5cf6" />;
      default: return null;
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      left: '16px',
      zIndex: 1000,
      width: '300px',
      fontFamily: fontFam
    }}>
      {/* Search Input Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
        borderRadius: '8px',
        padding: '7px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(6px)'
      }}>
        <Search size={14} color={isDark ? '#94a3b8' : '#64748b'} />
        <input
          type="text"
          placeholder="Search Structure #ID, Hospital, Shelter..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: isDark ? '#f8fafc' : '#0f172a',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: fontFam
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            style={{ background: 'transparent', border: 'none', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div style={{
          marginTop: '6px',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          maxHeight: '260px',
          overflowY: 'auto'
        }}>
          {results.map((res, idx) => (
            <div
              key={`${res.type}-${res.id}-${idx}`}
              onClick={() => handleSelect(res)}
              style={{
                padding: '8px 12px',
                borderBottom: idx < results.length - 1 ? `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}` : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {getResultIcon(res.type)}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                  {res.title}
                </div>
                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  {res.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
