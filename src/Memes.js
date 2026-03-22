import { useState, useEffect } from 'react';

const GIPHY_KEY = 'Pm3v1jwqSEXHvxF7PT26Tpp6FHDiMkL5';

const SVG_MEMES = [
  {
    label: 'Surprised',
    category: 'Reactions',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#FFD700" stroke="#333" stroke-width="2"/>
      <circle cx="35" cy="40" r="8" fill="white" stroke="#333" stroke-width="1.5"/>
      <circle cx="65" cy="40" r="8" fill="white" stroke="#333" stroke-width="1.5"/>
      <circle cx="37" cy="40" r="4" fill="#333"/>
      <circle cx="67" cy="40" r="4" fill="#333"/>
      <circle cx="38" cy="39" r="1.5" fill="white"/>
      <circle cx="68" cy="39" r="1.5" fill="white"/>
      <ellipse cx="50" cy="68" rx="12" ry="14" fill="#333"/>
      <ellipse cx="50" cy="70" rx="9" ry="10" fill="#cc0000"/>
      <path d="M25 30 Q35 22 45 30" stroke="#333" stroke-width="2" fill="none"/>
      <path d="M55 30 Q65 22 75 30" stroke="#333" stroke-width="2" fill="none"/>
    </svg>`
  },
  {
    label: 'Gigachad',
    category: 'Reactions',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="90" height="90" rx="8" fill="#1a1a1a"/>
      <ellipse cx="50" cy="55" rx="28" ry="32" fill="#c8a882"/>
      <ellipse cx="50" cy="35" rx="22" ry="18" fill="#c8a882"/>
      <rect x="22" y="50" width="56" height="20" fill="#c8a882"/>
      <ellipse cx="35" cy="48" rx="8" ry="5" fill="#b8956e"/>
      <ellipse cx="65" cy="48" rx="8" ry="5" fill="#b8956e"/>
      <rect x="28" y="30" width="44" height="8" rx="4" fill="#2a1a0a"/>
      <line x1="28" y1="34" x2="72" y2="34" stroke="#1a0a00" stroke-width="3"/>
      <ellipse cx="36" cy="55" rx="5" ry="3" fill="#2a1a0a"/>
      <ellipse cx="64" cy="55" rx="5" ry="3" fill="#2a1a0a"/>
      <path d="M38 68 Q50 75 62 68" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M20 25 Q35 10 50 15 Q65 10 80 25 Q75 5 50 5 Q25 5 20 25Z" fill="#2a1a0a"/>
      <rect x="15" y="85" width="70" height="12" rx="4" fill="#333"/>
      <text x="50" y="95" font-size="8" fill="#FFD700" text-anchor="middle" font-weight="bold">GIGACHAD</text>
    </svg>`
  },
  {
    label: 'Crying Laughing',
    category: 'Reactions',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#FFD700" stroke="#333" stroke-width="2"/>
      <path d="M25 38 Q35 28 45 38" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M55 38 Q65 28 75 38" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M28 55 Q50 80 72 55 Q60 45 50 48 Q40 45 28 55Z" fill="#333"/>
      <path d="M32 57 Q50 75 68 57" fill="#cc0000"/>
      <ellipse cx="40" cy="60" rx="6" ry="4" fill="white"/>
      <ellipse cx="60" cy="60" rx="6" ry="4" fill="white"/>
      <path d="M30 42 Q28 52 25 58 Q22 64 26 66 Q30 68 33 60" fill="#6af" opacity="0.8"/>
      <path d="M70 42 Q72 52 75 58 Q78 64 74 66 Q70 68 67 60" fill="#6af" opacity="0.8"/>
      <path d="M25 58 Q20 65 22 70 Q24 75 27 70" fill="#6af" opacity="0.6"/>
      <path d="M75 58 Q80 65 78 70 Q76 75 73 70" fill="#6af" opacity="0.6"/>
    </svg>`
  },
  {
    label: 'Mind Blown',
    category: 'Reactions',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="58" r="35" fill="#FFD700" stroke="#333" stroke-width="2"/>
      <circle cx="36" cy="52" r="7" fill="white" stroke="#333" stroke-width="1.5"/>
      <circle cx="64" cy="52" r="7" fill="white" stroke="#333" stroke-width="1.5"/>
      <circle cx="38" cy="52" r="3.5" fill="#333"/>
      <circle cx="66" cy="52" r="3.5" fill="#333"/>
      <ellipse cx="50" cy="70" rx="10" ry="8" fill="#333"/>
      <ellipse cx="50" cy="71" rx="7" ry="5" fill="#cc0000"/>
      <circle cx="50" cy="28" r="18" fill="#FF4500" opacity="0.9"/>
      <circle cx="50" cy="28" r="12" fill="#FFD700" opacity="0.8"/>
      <line x1="50" y1="5" x2="50" y2="12" stroke="#FF4500" stroke-width="3" stroke-linecap="round"/>
      <line x1="68" y1="10" x2="64" y2="16" stroke="#FF4500" stroke-width="3" stroke-linecap="round"/>
      <line x1="75" y1="25" x2="68" y2="27" stroke="#FF4500" stroke-width="3" stroke-linecap="round"/>
      <line x1="32" y1="10" x2="36" y2="16" stroke="#FF4500" stroke-width="3" stroke-linecap="round"/>
      <line x1="25" y1="25" x2="32" y2="27" stroke="#FF4500" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  {
    label: 'Pointing Guy',
    category: 'Reactions',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="90" height="90" rx="8" fill="#1a3a5c"/>
      <circle cx="50" cy="30" r="18" fill="#f5c5a3"/>
      <circle cx="44" cy="27" r="3" fill="#333"/>
      <circle cx="56" cy="27" r="3" fill="#333"/>
      <path d="M43 37 Q50 42 57 37" stroke="#c08060" stroke-width="1.5" fill="none"/>
      <rect x="30" y="48" width="40" height="35" rx="5" fill="#2244aa"/>
      <path d="M30 55 L10 50 L8 58 L28 65Z" fill="#f5c5a3"/>
      <path d="M8 54 L2 52 L2 58 L8 58Z" fill="#f5c5a3"/>
      <path d="M70 55 L90 50 L92 58 L72 65Z" fill="#f5c5a3"/>
      <path d="M92 54 L98 52 L98 58 L92 58Z" fill="#f5c5a3"/>
      <rect x="35" y="83" width="30" height="15" rx="3" fill="#1a2a4a"/>
    </svg>`
  },
  {
    label: 'Drake No',
    category: 'Meme Templates',
    svg: `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="100" height="60" fill="#ff6b6b"/>
      <rect x="0" y="60" width="100" height="60" fill="#51cf66"/>
      <circle cx="35" cy="25" r="16" fill="#c8a882"/>
      <path d="M28 22 Q35 16 42 22" stroke="#333" stroke-width="1.5" fill="none"/>
      <circle cx="31" cy="24" r="2.5" fill="#333"/>
      <circle cx="39" cy="24" r="2.5" fill="#333"/>
      <path d="M30 30 Q35 28 40 30" stroke="#c08060" stroke-width="1.5" fill="none"/>
      <path d="M60 15 L70 25 M70 15 L60 25" stroke="#cc0000" stroke-width="4" stroke-linecap="round"/>
      <circle cx="35" cy="85" r="16" fill="#c8a882"/>
      <path d="M28 82 Q35 76 42 82" stroke="#333" stroke-width="1.5" fill="none"/>
      <circle cx="31" cy="84" r="2.5" fill="#333"/>
      <circle cx="39" cy="84" r="2.5" fill="#333"/>
      <path d="M30 90 Q35 94 40 90" stroke="#333" stroke-width="1.5" fill="none"/>
      <path d="M55 95 L65 85" stroke="#00aa00" stroke-width="4" stroke-linecap="round"/>
      <path d="M55 85 L60 95 L75 75" stroke="#00aa00" stroke-width="4" stroke-linecap="round" fill="none"/>
      <text x="75" y="35" font-size="7" fill="white" text-anchor="middle" font-weight="bold">NO</text>
      <text x="75" y="95" font-size="7" fill="white" text-anchor="middle" font-weight="bold">YES</text>
    </svg>`
  },
  {
    label: 'Two Buttons',
    category: 'Meme Templates',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="100" height="100" fill="#2c3e50"/>
      <circle cx="50" cy="45" r="22" fill="#f5c5a3"/>
      <circle cx="43" cy="40" r="3" fill="#333"/>
      <circle cx="57" cy="40" r="3" fill="#333"/>
      <path d="M44 50 Q50 46 56 50" stroke="#c08060" stroke-width="1.5" fill="none"/>
      <path d="M35 58 Q28 65 22 68" stroke="#f5c5a3" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M65 58 Q72 65 78 68" stroke="#f5c5a3" stroke-width="6" stroke-linecap="round" fill="none"/>
      <rect x="14" y="65" width="22" height="14" rx="4" fill="#e74c3c"/>
      <rect x="64" y="65" width="22" height="14" rx="4" fill="#e74c3c"/>
      <text x="25" y="75" font-size="6" fill="white" text-anchor="middle" font-weight="bold">A</text>
      <text x="75" y="75" font-size="6" fill="white" text-anchor="middle" font-weight="bold">B</text>
      <path d="M45 62 L32 68" stroke="#f5c5a3" stroke-width="4" stroke-linecap="round"/>
      <path d="M55 62 L68 68" stroke="#f5c5a3" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="50" cy="25" rx="20" ry="5" fill="#333"/>
    </svg>`
  },
  {
    label: 'This Is Fine',
    category: 'Gaming & Viral',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="100" height="100" fill="#ff6600" opacity="0.9"/>
      <rect x="0" y="60" width="100" height="40" fill="#cc3300"/>
      <circle cx="15" cy="15" r="8" fill="#ffaa00" opacity="0.8"/>
      <circle cx="85" cy="10" r="6" fill="#ffaa00" opacity="0.7"/>
      <circle cx="50" cy="8" r="5" fill="#ffaa00" opacity="0.6"/>
      <rect x="5" y="40" width="90" height="5" rx="2" fill="#cc3300" opacity="0.6"/>
      <circle cx="35" cy="72" r="16" fill="#f5c5a3"/>
      <circle cx="29" cy="69" r="2.5" fill="#333"/>
      <circle cx="41" cy="69" r="2.5" fill="#333"/>
      <path d="M28 77 Q35 82 42 77" stroke="#333" stroke-width="1.5" fill="none"/>
      <rect x="20" y="85" width="30" height="15" rx="3" fill="#8B4513"/>
      <path d="M20 78 L15 85 L50 85 L50 78Z" fill="#f5c5a3"/>
      <text x="72" y="80" font-size="7" fill="white" text-anchor="middle" font-weight="bold">THIS IS</text>
      <text x="72" y="90" font-size="7" fill="white" text-anchor="middle" font-weight="bold">FINE</text>
    </svg>`
  },
  {
    label: "Gru's Plan",
    category: 'Meme Templates',
    svg: `<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="100" height="130" fill="#2c3e50"/>
      <rect x="5" y="5" width="90" height="35" rx="4" fill="#ecf0f1" stroke="#bdc3c7" stroke-width="1"/>
      <rect x="5" y="45" width="90" height="35" rx="4" fill="#ecf0f1" stroke="#bdc3c7" stroke-width="1"/>
      <rect x="5" y="90" width="90" height="35" rx="4" fill="#ecf0f1" stroke="#bdc3c7" stroke-width="1"/>
      <ellipse cx="20" cy="22" rx="10" ry="12" fill="#a0a0c0"/>
      <circle cx="20" cy="14" r="7" fill="#c8c8e8"/>
      <ellipse cx="20" cy="10" rx="5" ry="3" fill="#888"/>
      <circle cx="17" cy="13" r="1.5" fill="#333"/>
      <circle cx="23" cy="13" r="1.5" fill="#333"/>
      <path d="M16 17 Q20 20 24 17" stroke="#888" stroke-width="1" fill="none"/>
      <line x1="35" y1="22" x2="90" y2="22" stroke="#aaa" stroke-width="1.5"/>
      <line x1="35" y1="17" x2="90" y2="17" stroke="#aaa" stroke-width="1.5"/>
      <ellipse cx="20" cy="62" rx="10" ry="12" fill="#a0a0c0"/>
      <circle cx="20" cy="54" r="7" fill="#c8c8e8"/>
      <ellipse cx="20" cy="50" rx="5" ry="3" fill="#888"/>
      <circle cx="17" cy="53" r="1.5" fill="#333"/>
      <circle cx="23" cy="53" r="1.5" fill="#333"/>
      <path d="M16 57 Q20 60 24 57" stroke="#888" stroke-width="1" fill="none"/>
      <line x1="35" y1="62" x2="90" y2="62" stroke="#aaa" stroke-width="1.5"/>
      <line x1="35" y1="57" x2="90" y2="57" stroke="#aaa" stroke-width="1.5"/>
      <ellipse cx="20" cy="107" rx="10" ry="12" fill="#a0a0c0"/>
      <circle cx="20" cy="99" r="7" fill="#c8c8e8"/>
      <ellipse cx="20" cy="95" rx="5" ry="3" fill="#888"/>
      <circle cx="17" cy="98" r="1.5" fill="#333"/>
      <circle cx="23" cy="98" r="1.5" fill="#333"/>
      <path d="M16 104 Q20 100 24 104" stroke="#333" stroke-width="1.5" fill="none"/>
      <line x1="35" y1="107" x2="90" y2="107" stroke="#aaa" stroke-width="1.5"/>
      <line x1="35" y1="102" x2="90" y2="102" stroke="#aaa" stroke-width="1.5"/>
    </svg>`
  },
  {
    label: 'Among Us',
    category: 'Gaming & Viral',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="55" rx="30" ry="35" fill="#cc0000"/>
      <ellipse cx="50" cy="35" rx="28" ry="22" fill="#cc0000"/>
      <ellipse cx="56" cy="30" rx="18" ry="12" fill="#99ccff" opacity="0.9"/>
      <ellipse cx="56" cy="30" rx="14" ry="9" fill="#cce5ff" opacity="0.7"/>
      <rect x="25" y="72" width="16" height="18" rx="5" fill="#aa0000"/>
      <rect x="59" y="72" width="16" height="18" rx="5" fill="#aa0000"/>
      <ellipse cx="50" cy="55" rx="22" ry="12" fill="#aa0000"/>
    </svg>`
  },
];

const MEME_SEARCH_TERMS = [
  'shocked', 'mind blown', 'fire', 'epic', 'win', 'fail', 'gaming',
  'business', 'money', 'celebration', 'funny', 'reaction', 'wow',
  'minecraft', 'excited', 'confused', 'big brain',
];

export default function MemesPanel({ onAddGif, onAddSvg, theme }) {
  const [tab, setTab] = useState('memes');
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [memeText, setMemeText] = useState({ top: '', bottom: '' });
  const [selectedMeme, setSelectedMeme] = useState(null);

  const categories = ['All', ...new Set(SVG_MEMES.map(m => m.category))];
  const filteredMemes = selectedCategory === 'All' ? SVG_MEMES : SVG_MEMES.filter(m => m.category === selectedCategory);

  async function searchGiphy(query) {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=12&rating=g`);
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      console.error('GIPHY error:', err);
    }
    setLoading(false);
  }

  async function loadTrending() {
    setLoading(true);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`);
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      console.error('GIPHY error:', err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (tab === 'gifs') loadTrending();
  }, [tab]);

  const S = {
    tab: (active) => ({
      flex: 1, padding: '7px', borderRadius: '7px',
      border: `1px solid ${active ? theme.accent : theme.border}`,
      background: active ? theme.accent : theme.input,
      color: active ? '#fff' : theme.text,
      fontSize: '12px', cursor: 'pointer', fontWeight: active ? '700' : '400',
    }),
    label: { fontSize: '10px', color: theme.muted, marginBottom: '5px', marginTop: '10px', letterSpacing: '0.8px', fontWeight: '700', textTransform: 'uppercase' },
    input: { padding: '7px 10px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: '12px', width: '100%', boxSizing: 'border-box', outline: 'none' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '5px' }}>
        <button onClick={() => setTab('memes')} style={S.tab(tab === 'memes')}>🎭 Memes</button>
        <button onClick={() => setTab('gifs')} style={S.tab(tab === 'gifs')}>🎬 GIFs</button>
        <button onClick={() => setTab('custom')} style={S.tab(tab === 'custom')}>✏️ Custom</button>
      </div>

      {tab === 'memes' && (
        <div>
          <div style={S.label}>Category</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                style={{ padding: '3px 9px', borderRadius: '20px', border: `1px solid ${selectedCategory === cat ? theme.accent : theme.border}`, background: selectedCategory === cat ? theme.accent : theme.input, color: selectedCategory === cat ? '#fff' : theme.text, fontSize: '10px', cursor: 'pointer', fontWeight: selectedCategory === cat ? '700' : '400' }}>{cat}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
            {filteredMemes.map((meme, i) => (
              <div key={i} onClick={() => onAddSvg(meme.svg, meme.label)}
                style={{ padding: '8px 4px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: theme.input, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}>
                <div style={{ width: '52px', height: '52px' }} dangerouslySetInnerHTML={{ __html: meme.svg }} />
                <span style={{ fontSize: '9px', color: theme.muted, textAlign: 'center', lineHeight: 1.3 }}>{meme.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'gifs' && (
        <div>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchGiphy(searchQuery)}
              placeholder="Search GIFs..." style={{ ...S.input, flex: 1 }} />
            <button onClick={() => searchGiphy(searchQuery)}
              style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', background: theme.accent, color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>Go</button>
          </div>

          <div style={S.label}>Quick search</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {MEME_SEARCH_TERMS.slice(0, 8).map(term => (
              <button key={term} onClick={() => { setSearchQuery(term); searchGiphy(term); }}
                style={{ padding: '3px 8px', borderRadius: '20px', border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: '10px', cursor: 'pointer' }}>{term}</button>
            ))}
          </div>

          {loading && <div style={{ textAlign: 'center', color: theme.muted, fontSize: '12px', padding: '20px' }}>Loading GIFs...</div>}

          {!loading && gifs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
              {gifs.map(gif => (
                <div key={gif.id} onClick={() => onAddGif(gif.images.fixed_height.url, gif.images.fixed_height.width, gif.images.fixed_height.height)}
                  style={{ borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${theme.border}`, aspectRatio: '1', background: '#000' }}>
                  <img src={gif.images.fixed_height_small.url} alt={gif.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          )}

          {!loading && gifs.length === 0 && (
            <div style={{ textAlign: 'center', color: theme.muted, fontSize: '12px', padding: '20px' }}>Search for GIFs above or click a quick search tag!</div>
          )}

          <div style={{ marginTop: '8px', fontSize: '10px', color: theme.muted, textAlign: 'center' }}>Powered by GIPHY</div>
        </div>
      )}

      {tab === 'custom' && (
        <div>
          <div style={S.label}>Pick a meme template</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '10px' }}>
            {SVG_MEMES.map((meme, i) => (
              <div key={i} onClick={() => setSelectedMeme(meme)}
                style={{ padding: '6px 4px', borderRadius: '8px', border: `2px solid ${selectedMeme?.label === meme.label ? theme.accent : theme.border}`, background: selectedMeme?.label === meme.label ? (theme.input) : theme.input, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '40px', height: '40px' }} dangerouslySetInnerHTML={{ __html: meme.svg }} />
                <span style={{ fontSize: '8px', color: theme.muted, textAlign: 'center' }}>{meme.label}</span>
              </div>
            ))}
          </div>

          {selectedMeme && (
            <>
              <div style={S.label}>Top text</div>
              <input value={memeText.top} onChange={e => setMemeText(p => ({ ...p, top: e.target.value }))} placeholder="Top text..." style={S.input} />
              <div style={S.label}>Bottom text</div>
              <input value={memeText.bottom} onChange={e => setMemeText(p => ({ ...p, bottom: e.target.value }))} placeholder="Bottom text..." style={S.input} />
              <button onClick={() => {
                const combined = `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0" y="0" width="100" height="120" fill="black"/>
                  <g transform="translate(0,10)">${selectedMeme.svg.replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>
                  <text x="50" y="12" font-size="9" fill="white" text-anchor="middle" font-weight="bold" font-family="Impact" stroke="black" stroke-width="0.5">${memeText.top.toUpperCase()}</text>
                  <text x="50" y="118" font-size="9" fill="white" text-anchor="middle" font-weight="bold" font-family="Impact" stroke="black" stroke-width="0.5">${memeText.bottom.toUpperCase()}</text>
                </svg>`;
                onAddSvg(combined, selectedMeme.label);
              }} style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: theme.accent, color: '#fff', border: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: '700', width: '100%' }}>
                + Add meme to canvas
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}