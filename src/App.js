import { useState, useEffect, useRef } from 'react';
import Editor from './Editor';

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#f5f0e8',
  bg2:      '#ede8dc',
  bg3:      '#e4ddd0',
  panel:    '#faf7f2',
  border:   '#d9d0c0',
  border2:  '#c9bfaa',
  text:     '#1a1612',
  text2:    '#3d3530',
  muted:    '#8a7d6e',
  accent:   '#c45c2e',
  accent2:  '#a34a22',
  accent3:  '#e8784a',
  success:  '#4a7c59',
  warning:  '#c4882e',
  cream:    '#fdf9f4',
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ open, onClose, setPage }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  const sections = [
    {
      title: 'Projects',
      items: [
        { icon: '✦', label: 'New design',    action: () => { setPage('editor'); onClose(); } },
        { icon: '⊡', label: 'Saved designs', action: () => { setPage('dashboard'); onClose(); } },
        { icon: '↑', label: 'Import image',  action: () => { setPage('editor'); onClose(); } },
        { icon: '↓', label: 'Export / Download', action: () => { setPage('editor'); onClose(); } },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: '◎', label: 'Log in',    action: () => { setPage('login'); onClose(); } },
        { icon: '✚', label: 'Sign up',   action: () => { setPage('signup'); onClose(); } },
        { icon: '⚡', label: 'Go Pro — $15/mo', action: () => { setPage('pricing'); onClose(); }, highlight: true },
      ],
    },
    {
      title: 'Help & info',
      items: [
        { icon: '?', label: 'How it works',   action: () => { setPage('home'); onClose(); } },
        { icon: '✉', label: 'Contact support', action: () => { window.location.href = 'mailto:support@thumbframe.app'; onClose(); } },
        { icon: '★', label: 'Examples',        action: () => { setPage('examples'); onClose(); } },
        { icon: '$', label: 'Pricing',          action: () => { setPage('pricing'); onClose(); } },
      ],
    },
    {
      title: 'Tools',
      items: [
        { icon: '⬜', label: 'Safe zones overlay', action: () => { setPage('editor'); onClose(); } },
        { icon: '📱', label: 'Mobile stamp test',  action: () => { setPage('editor'); onClose(); } },
        { icon: '✂️', label: 'Background remover',  action: () => { setPage('editor'); onClose(); } },
      ],
    },
  ];

  return (
    <>
      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 199,
        background: 'rgba(26,22,18,0.35)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'all' : 'none',
        transition: 'opacity 0.25s',
        backdropFilter: 'blur(2px)',
      }}/>
      {/* Drawer */}
      <div ref={ref} style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
        width: 280,
        background: C.cream,
        borderRight: `1px solid ${C.border}`,
        boxShadow: '4px 0 32px rgba(0,0,0,0.12)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: '800' }}>S</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: '700', color: C.text }}>ThumbFrame</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 18, padding: '2px 6px', borderRadius: 4 }}>×</button>
        </div>

        {/* Open editor CTA */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => { setPage('editor'); onClose(); }} style={{
            width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none',
            background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 13,
            fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            ✦ Open editor
          </button>
        </div>

        {/* Sections */}
        <div style={{ flex: 1, padding: '8px 0' }}>
          {sections.map((section, si) => (
            <div key={si} style={{ marginBottom: 4 }}>
              <div style={{ padding: '10px 20px 4px', fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                {section.title}
              </div>
              {section.items.map((item, ii) => (
                <button key={ii} onClick={item.action} style={{
                  width: '100%', padding: '9px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  color: item.highlight ? C.accent : C.text2, fontSize: 13,
                  fontWeight: item.highlight ? '700' : '400', textAlign: 'left',
                  borderLeft: item.highlight ? `3px solid ${C.accent}` : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg2}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ width: 18, textAlign: 'center', fontSize: 12, opacity: 0.7 }}>{item.icon}</span>
                  {item.label}
                  {item.highlight && <span style={{ marginLeft: 'auto', fontSize: 9, background: C.accent, color: '#fff', padding: '2px 6px', borderRadius: 10, fontWeight: '700' }}>PRO</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
          Built for YouTubers who care about their craft.
        </div>
      </div>
    </>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────────
function Nav({ page, setPage, user, onLogout }) {
  const [scrolled,     setScrolled]     = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} setPage={setPage} />
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(245,240,232,0.95)' : C.bg,
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
        transition: 'all 0.3s',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* Hamburger menu */}
          <button onClick={() => setSidebarOpen(true)} style={{
            background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer',
            padding: '6px 9px', borderRadius: 6, display: 'flex', flexDirection: 'column',
            gap: 4, color: C.text, flexShrink: 0,
          }}>
            <div style={{ width: 16, height: 1.5, background: C.text2, borderRadius: 1 }} />
            <div style={{ width: 16, height: 1.5, background: C.text2, borderRadius: 1 }} />
            <div style={{ width: 16, height: 1.5, background: C.text2, borderRadius: 1 }} />
          </button>

          {/* Logo */}
          <div onClick={() => setPage('home')} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#fff', fontWeight: '800' }}>T</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: '-0.2px' }}>ThumbFrame</span>
          </div>

          {/* Nav links - Hidden on mobile via CSS class */}
          <div className="desktop-nav-links desktop-only" style={{ display: window.innerWidth < 768 ? 'none' : 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
            {[['How it works', 'howitworks'], ['Examples', 'examples'], ['Pricing', 'pricing']].map(([label, key]) => (
              <button key={key} onClick={() => setPage(key)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: page === key ? C.bg2 : 'transparent',
                color: page === key ? C.text : C.muted,
                cursor: 'pointer', fontSize: 13,
                fontWeight: page === key ? '600' : '400',
              }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Right actions */}
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <>
                <span style={{ fontSize: 13, color: C.text2, fontWeight: '500' }}>{user.name}</span>
                <button onClick={() => setPage('dashboard')} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontSize: 13, fontWeight: '500' }}>
                  Dashboard
                </button>
                <button onClick={onLogout} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13 }}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setPage('login')} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13 }}>
                  Log in
                </button>
                <button onClick={() => setPage('signup')} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontSize: 13, fontWeight: '500' }}>
                  Sign up
                </button>
              </>
            )}
            <button onClick={() => setPage('editor')} style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: C.accent, color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: '700',
            }}>
              Open editor →
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

// ── Home ───────────────────────────────────────────────────────────────────────
function Home({ setPage }) {
  const struggles = [
    { icon: '💸', title: "Canva charges you just to remove a background", desc: "Background removal is a basic feature. Canva locks it behind a $15/month subscription. ThumbFrame does it free." },
    { icon: '🤯', title: "Photoshop is built for professionals, not creators", desc: "You spend 20 minutes Googling how to do something that should take 20 seconds. ThumbFrame is built around how creators actually work." },
    { icon: '😴', title: "Everyone's using the same templates", desc: "Canva's thumbnail templates are used by thousands of channels. Your thumbnail looks like everyone else's. ThumbFrame gives you tools to build your own style." },
    { icon: '📱', title: "No way to see how it looks on mobile", desc: "70% of YouTube views are on mobile. Most editors don't show you what your thumbnail looks like at 150×84px. ThumbFrame has a live mobile preview built in." },
    { icon: '⏰', title: "Hours spent on thumbnails that don't get clicks", desc: "You agonize over a thumbnail for an hour, post it, and it gets ignored. ThumbFrame shows you the safe zones, the mobile view, and helps you design for clicks — not just looks." },
  ];

  const examples = [
    { bg: 'linear-gradient(135deg, #1a1a2e 0%, #4a3060 100%)',  text: 'WATCH THIS',       textColor: '#FFD700',  tag: 'Gaming'    },
    { bg: 'linear-gradient(135deg, #0f2027 0%, #2c5364 100%)',  text: 'RESULTS',          textColor: '#ffffff',  tag: 'Business'  },
    { bg: 'linear-gradient(135deg, #c45c2e 0%, #f7a642 100%)',  text: "YOU WON'T BELIEVE",textColor: '#ffffff',  tag: 'Viral'     },
    { bg: 'linear-gradient(135deg, #1a472a 0%, #2d6a4f 100%)',  text: 'How I Did It',     textColor: '#95d5b2',  tag: 'Vlog'      },
    { bg: 'linear-gradient(135deg, #2c2c54 0%, #706fd3 100%)',  text: 'EPIC MOMENT',      textColor: '#ffffff',  tag: 'Minecraft' },
    { bg: 'linear-gradient(135deg, #3d0000 0%, #c0392b 100%)',  text: 'GONE WRONG',       textColor: '#ffffff',  tag: 'Challenge' },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Hero ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 24px 70px' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div className="hero-text-container">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 20, border: `1px solid ${C.border2}`, background: C.bg2, marginBottom: 24, fontSize: 12, color: C.muted, fontWeight: '500' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }} />
              Free to use — no account needed
            </div>

            <h1 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: '800', lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20, color: C.text }}>
              Make better<br />thumbnails.<br />
              <span style={{ color: C.accent }}>Get more clicks.</span>
            </h1>

            <p className="hero-paragraph" style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, marginBottom: 12, maxWidth: 440 }}>
              We built ThumbFrame because we were tired of paying for features that should be free, using tools that weren't made for YouTube, and spending hours on thumbnails that didn't perform.
            </p>
            <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.7, marginBottom: 32, maxWidth: 440, fontStyle: 'italic' }}>
              "This is the thumbnail editor we wish existed when we started."
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => setPage('editor')} style={{
                padding: '12px 24px', borderRadius: 8, border: 'none',
                background: C.accent, color: '#fff', cursor: 'pointer',
                fontSize: 15, fontWeight: '700',
                boxShadow: `0 4px 20px ${C.accent}44`,
              }}>
                Start for free →
              </button>
              <button onClick={() => setPage('howitworks')} style={{
                padding: '12px 24px', borderRadius: 8,
                border: `1px solid ${C.border2}`,
                background: 'transparent', color: C.text2,
                cursor: 'pointer', fontSize: 15, fontWeight: '500',
              }}>
                How it works
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.muted }}>No sign up. No watermark. No credit card.</p>
          </div>

          {/* Editor preview */}
          <div className="hero-preview-container" style={{ borderRadius:12, overflow:'hidden', border:`1px solid ${C.border}`, boxShadow:'0 32px 80px rgba(0,0,0,0.18)', background:'#0f0f0f', position:'relative' }}>

  {/* Browser bar */}
  <div style={{ padding:'9px 14px', borderBottom:'1px solid #1f1f1f', display:'flex', alignItems:'center', gap:6, background:'#161616' }}>
    {['#ff5f57','#febc2e','#28c840'].map(c=><div key={c} style={{width:9,height:9,borderRadius:'50%',background:c}}/>)}
    <div style={{ flex:1, height:22, borderRadius:5, background:'#1a1a1a', marginLeft:8, display:'flex', alignItems:'center', paddingLeft:10, gap:6 }}>
      <span style={{ fontSize:10, color:'#444' }}>youtube.com/watch</span>
    </div>
  </div>

  {/* YouTube-style feed */}
  <div style={{ background:'#0f0f0f', padding:'20px 20px 12px' }}>

    {/* Top bar like YouTube */}
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ fontSize:13, color:'#ff0000', fontWeight:'800', letterSpacing:'-0.5px' }}>▶ YouTube</div>
        {['Home','Shorts','Subscriptions','You'].map((t,i)=>(
          <div key={i} style={{ fontSize:11, color: i===0 ? '#fff' : '#555', fontWeight: i===0 ? '600' : '400', cursor:'pointer' }}>{t}</div>
        ))}
      </div>
      <div style={{ width:180, height:20, borderRadius:10, background:'#1a1a1a', display:'flex', alignItems:'center', paddingLeft:10 }}>
        <span style={{ fontSize:9, color:'#333' }}>🔍  Search</span>
      </div>
    </div>

    {/* Video grid */}
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>

      {/* ✅ HERO CARD — the viral thumbnail with cursor and big views */}
      <div style={{ position:'relative', cursor:'pointer' }}>
        {/* Thumbnail */}
        <div style={{
          width:'100%', aspectRatio:'16/9', borderRadius:8, overflow:'hidden',
          position:'relative',
          background:'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 40%, #4a1a6e 100%)',
          boxShadow:'0 8px 32px rgba(196,92,46,0.35)',
          border:'2px solid rgba(196,92,46,0.5)',
        }}>
          {/* Background glow effects */}
          <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,100,0,0.4), transparent)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', bottom:-10, left:-10, width:80, height:80, borderRadius:'50%', background:'radial-gradient(circle, rgba(100,0,255,0.3), transparent)', pointerEvents:'none' }}/>

          {/* Fake person silhouette */}
          <div style={{ position:'absolute', bottom:0, left:'15%', width:55, height:85, background:'linear-gradient(to top, #c45c2e, #e8784a)', borderRadius:'50% 50% 0 0 / 40% 40% 0 0', opacity:0.9 }}/>
          <div style={{ position:'absolute', bottom:63, left:'22%', width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg, #e8c19a, #c4956a)' }}/>

          {/* Shocked expression dots */}
          <div style={{ position:'absolute', bottom:72, left:'24%', width:6, height:6, borderRadius:'50%', background:'#1a1a1a' }}/>
          <div style={{ position:'absolute', bottom:72, left:'33%', width:6, height:6, borderRadius:'50%', background:'#1a1a1a' }}/>
          <div style={{ position:'absolute', bottom:64, left:'26%', width:10, height:6, borderRadius:'0 0 8px 8px', background:'#1a1a1a' }}/>

          {/* Dramatic text */}
          <div style={{ position:'absolute', top:10, right:8, left:'45%' }}>
            <div style={{ fontSize:11, fontWeight:'900', color:'#FFD700', fontFamily:'Impact, sans-serif', textShadow:'2px 2px 0 #000, -1px -1px 0 #000', lineHeight:1.1, letterSpacing:0.5 }}>I CAN'T</div>
            <div style={{ fontSize:11, fontWeight:'900', color:'#FFD700', fontFamily:'Impact, sans-serif', textShadow:'2px 2px 0 #000, -1px -1px 0 #000', lineHeight:1.1, letterSpacing:0.5 }}>BELIEVE</div>
            <div style={{ fontSize:9, fontWeight:'900', color:'#ff4444', fontFamily:'Impact, sans-serif', textShadow:'1px 1px 0 #000', lineHeight:1.2, marginTop:2 }}>THIS WORKED</div>
          </div>

          {/* Arrow pointing at text */}
          <div style={{ position:'absolute', top:38, right:6, fontSize:14, color:'#ff4444', fontWeight:'900', textShadow:'1px 1px 0 #000' }}>←</div>

          {/* Timestamp */}
          <div style={{ position:'absolute', bottom:5, right:5, padding:'2px 5px', borderRadius:3, background:'rgba(0,0,0,0.9)', fontSize:8, color:'#fff', fontFamily:'monospace', fontWeight:'700' }}>12:47</div>

          {/* Hover overlay */}
          <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,0.04)', borderRadius:8 }}/>
        </div>

        {/* ✅ CURSOR on the thumbnail */}
        <div style={{ position:'absolute', top:'35%', left:'52%', pointerEvents:'none', zIndex:10 }}>
          <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
            <path d="M0 0L0 16L4 12L7 18L9.5 17L6.5 11L11 11L0 0Z" fill="white" stroke="#333" strokeWidth="1"/>
          </svg>
        </div>

        {/* ✅ Tooltip popup on hover */}
        <div style={{ position:'absolute', top:'8%', left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.92)', borderRadius:6, padding:'6px 10px', pointerEvents:'none', whiteSpace:'nowrap', zIndex:9, border:'1px solid #333' }}>
          <div style={{ fontSize:9, color:'#fff', fontWeight:'700', marginBottom:2 }}>I Can't Believe This Worked...</div>
          <div style={{ fontSize:8, color:'#aaa' }}>YourChannel • 14 hours ago</div>
        </div>

        {/* Video info */}
        <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'flex-start' }}>
          <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg, #c45c2e, #e8784a)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:'800' }}>Y</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, color:'#fff', fontWeight:'600', lineHeight:1.3, marginBottom:2 }}>I Can't Believe This Actually Worked...</div>
            <div style={{ fontSize:9, color:'#aaa' }}>YourChannel</div>
            {/* ✅ BIG VIEW NUMBER */}
            <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
              <span style={{ fontSize:11, color:'#fff', fontWeight:'800' }}>2.4M</span>
              <span style={{ fontSize:9, color:'#aaa' }}>views</span>
              <span style={{ fontSize:9, color:'#555' }}>•</span>
              <span style={{ fontSize:9, color:'#aaa' }}>14 hours ago</span>
            </div>
            {/* Trending badge */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:3, marginTop:3, background:'rgba(196,92,46,0.2)', border:'1px solid rgba(196,92,46,0.4)', borderRadius:10, padding:'1px 6px' }}>
              <span style={{ fontSize:7, color:'#c45c2e', fontWeight:'800' }}>🔥 TRENDING</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2 */}
      <div style={{ cursor:'pointer' }}>
        <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:8, background:'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', bottom:10, left:10, right:10 }}>
            <div style={{ fontSize:10, fontWeight:'900', color:'#fff', fontFamily:'Impact, sans-serif', textShadow:'1px 1px 0 #000' }}>RESULTS AFTER</div>
            <div style={{ fontSize:10, fontWeight:'900', color:'#00ff88', fontFamily:'Impact, sans-serif', textShadow:'1px 1px 0 #000' }}>30 DAYS</div>
          </div>
          <div style={{ position:'absolute', bottom:5, right:5, padding:'2px 5px', borderRadius:3, background:'rgba(0,0,0,0.9)', fontSize:8, color:'#fff', fontFamily:'monospace' }}>8:21</div>
        </div>
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, color:'#fff', fontWeight:'600', lineHeight:1.3, marginBottom:2 }}>Results After 30 Days...</div>
          <div style={{ fontSize:9, color:'#aaa' }}>Creator Academy</div>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
            <span style={{ fontSize:10, color:'#ddd', fontWeight:'700' }}>847K</span>
            <span style={{ fontSize:9, color:'#aaa' }}>views • 3 days ago</span>
          </div>
        </div>
      </div>

      {/* Card 3 */}
      <div style={{ cursor:'pointer' }}>
        <div style={{ width:'100%', aspectRatio:'16/9', borderRadius:8, background:'linear-gradient(135deg, #2c2c54, #3d3d80)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 70% 40%, rgba(255,215,0,0.25), transparent)' }}/>
          <div style={{ position:'absolute', top:8, left:8, right:8 }}>
            <div style={{ fontSize:11, fontWeight:'900', color:'#FFD700', fontFamily:'Impact, sans-serif', textShadow:'2px 2px 0 #000', letterSpacing:1 }}>EPIC WIN</div>
          </div>
          <div style={{ position:'absolute', bottom:5, right:5, padding:'2px 5px', borderRadius:3, background:'rgba(0,0,0,0.9)', fontSize:8, color:'#fff', fontFamily:'monospace' }}>6:03</div>
        </div>
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, color:'#fff', fontWeight:'600', lineHeight:1.3, marginBottom:2 }}>The Most Epic Win Ever</div>
          <div style={{ fontSize:9, color:'#aaa' }}>GamingPro</div>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
            <span style={{ fontSize:10, color:'#ddd', fontWeight:'700' }}>5.1M</span>
            <span style={{ fontSize:9, color:'#aaa' }}>views • 1 week ago</span>
          </div>
        </div>
      </div>

    </div>

    {/* Bottom bar */}
    <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid #1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      <div style={{ fontSize:10, color:'#555' }}>Your thumbnail could be here.</div>
      <div onClick={()=>setPage('editor')} style={{ fontSize:10, color:'#c45c2e', fontWeight:'700', cursor:'pointer' }}>Make it now →</div>
    </div>
  </div>
</div>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div style={{ background: C.bg2, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px', display: 'flex', gap: 0, justifyContent: 'space-around', flexWrap: 'wrap' }}>
          {[['Free forever','No subscription needed'],['1-click BG removal','No Photoshop required'],['Mobile preview','See it how viewers see it'],['Full 1280×720','Export at YouTube spec']].map(([stat,desc],i) => (
            <div key={i} style={{ textAlign: 'center', padding: '8px 20px' }}>
              <div style={{ fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 2 }}>{stat}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Struggles section ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ maxWidth: 600, marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>Sound familiar?</div>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: '800', letterSpacing: '-0.8px', lineHeight: 1.2, marginBottom: 16, color: C.text }}>
            Every other tool was built for designers. Not YouTubers.
          </h2>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7 }}>
            We talked to hundreds of creators. These are the five things they said over and over.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {struggles.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 20, padding: '24px 0', borderBottom: `1px solid ${C.border}`, alignItems: 'start' }}>
              <div style={{ fontSize: 28, lineHeight: 1 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, padding: '28px 32px', borderRadius: 10, background: C.bg2, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8 }}>ThumbFrame fixes all of this.</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 20 }}>
            Built specifically for YouTube creators. Every feature was added because a real creator asked for it.
            No bloat. No learning curve. No subscription wall for basic features.
          </div>
          <button onClick={() => setPage('editor')} style={{ padding: '11px 24px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: '700' }}>
            Try it free — no account needed →
          </button>
        </div>
      </div>

      {/* ── Examples grid ── */}
      <div style={{ background: C.bg2, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '70px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>Examples</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: '800', letterSpacing: '-0.5px', color: C.text }}>Made with ThumbFrame</h2>
            </div>
            <button onClick={() => setPage('examples')} style={{ padding: '8px 18px', borderRadius: 6, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontSize: 13, fontWeight: '500' }}>
              See all examples →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {examples.map((ex, i) => (
              <div key={i} onClick={() => setPage('editor')}
                style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ aspectRatio: '16/9', background: ex.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ fontSize: 18, fontWeight: '900', color: ex.textColor, fontFamily: 'Impact, sans-serif', textShadow: '2px 2px 0 rgba(0,0,0,0.6)', letterSpacing: 1, textAlign: 'center', padding: '0 16px', zIndex: 1 }}>
                    {ex.text}
                  </span>
                  <div style={{ position: 'absolute', bottom: 5, right: 5, padding: '1px 5px', borderRadius: 2, background: 'rgba(0,0,0,0.8)', fontSize: 8, color: '#fff', fontFamily: 'monospace' }}>0:00</div>
                </div>
                <div style={{ padding: '10px 14px', background: C.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.text2, fontWeight: '600' }}>{ex.tag}</span>
                  <span style={{ fontSize: 11, color: C.accent, fontWeight: '600' }}>Open →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>What's inside</div>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: 12, color: C.text }}>Everything you need. Nothing you don't.</h2>
          <p style={{ fontSize: 15, color: C.muted, maxWidth: 460, margin: '0 auto' }}>No bloated feature lists. Just the tools that actually help you make thumbnails that get clicked.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {[
            { icon:'📱', title:'Mobile stamp test',       desc:"See your thumbnail at exactly 150×84px — how most people actually see it on their phone before deciding to click.", free:true },
            { icon:'⬜', title:'YouTube safe zones',       desc:'Overlay showing exactly where YouTube\'s UI covers your thumbnail. Timestamp, watch-later, progress bar. Design around them.', free:true },
            { icon:'✂️', title:'Background remover',       desc:'Remove backgrounds with one click. AI-powered, handles hair and complex edges. Free on ThumbFrame.', free:true },
            { icon:'🎨', title:'Non-destructive editing',  desc:'Every effect, filter, and adjustment is editable forever. Change your mind on anything, any time.', free:true },
            { icon:'⚡', title:'AI thumbnail generation', desc:'Describe your thumbnail in plain English. Get a starting point in seconds. Tweak from there.', free:false },
            { icon:'↓',  title:'Full res export',          desc:'Download at 1280×720 — the exact spec YouTube recommends. PNG, JPG, or PNG with transparent background.', free:true },
          ].map((f, i) => (
            <div key={i} style={{ padding: 22, borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel, position: 'relative' }}>
              {!f.free && <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, background: C.accent, color: '#fff', padding: '2px 7px', borderRadius: 10, fontWeight: '700', letterSpacing: '0.5px' }}>PRO</div>}
              <div style={{ fontSize: 22, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: '700', marginBottom: 6, color: C.text }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── vs Canva ── */}
      <div style={{ background: C.bg2, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '70px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Comparison</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: 10, color: C.text }}>Why not just use Canva?</h2>
            <p style={{ fontSize: 15, color: C.muted }}>Canva is a great general design tool. ThumbFrame is built only for thumbnails.</p>
          </div>
          <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', background: C.panel }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', background: C.bg3, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '12px 20px', fontSize: 11, color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Feature</div>
              <div style={{ padding: '12px 20px', fontSize: 11, color: C.accent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center' }}>ThumbFrame</div>
              <div style={{ padding: '12px 20px', fontSize: 11, color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center' }}>Canva</div>
            </div>
            {[
              ['Mobile stamp test (150×84px)', true, false],
              ['YouTube safe zone overlay',    true, false],
              ['Background remover',           true, '💳 Paid'],
              ['Free to use',                  true, '💳 Freemium'],
              ['No watermark on free tier',    true, '💳 Paid'],
              ['Full 1280×720 export',         true, true],
              ['Built only for YouTube',       true, false],
              ['AI generation',                '⚡ Pro', '💳 Paid'],
            ].map(([label, snap, canva], i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : C.bg2 }}>
                <div style={{ padding: '13px 20px', fontSize: 13, color: C.text2 }}>{label}</div>
                <div style={{ padding: '13px 20px', textAlign: 'center', fontSize: 13, color: snap === true ? C.success : snap === false ? '#c0392b' : C.muted, fontWeight: snap === true ? '700' : '400' }}>
                  {snap === true ? '✓' : snap === false ? '✗' : snap}
                </div>
                <div style={{ padding: '13px 20px', textAlign: 'center', fontSize: 13, color: canva === true ? C.success : canva === false ? '#c0392b' : C.muted }}>
                  {canva === true ? '✓' : canva === false ? '✗' : canva}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px 100px' }}>
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel, padding: '56px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🎨</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: 12, color: C.text }}>
            Ready to make thumbnails that actually get clicked?
          </h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
            Free forever. No account required. Open the editor and start in seconds.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setPage('editor')} style={{ padding: '13px 28px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: '700', boxShadow: `0 4px 20px ${C.accent}44` }}>
              Open ThumbFrame free →
            </button>
            <button onClick={() => setPage('signup')} style={{ padding: '13px 28px', borderRadius: 8, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontSize: 15, fontWeight: '500' }}>
              Create account
            </button>
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 14 }}>No credit card. No watermark. No catch.</p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg2, padding: '32px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff', fontWeight: '800' }}>S</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: '700', color: C.text }}>ThumbFrame</span>
            <span style={{ fontSize: 13, color: C.muted, marginLeft: 4 }}>— Built for YouTubers who care about their craft.</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[['Pricing','pricing'],['Examples','examples'],['Log in','login'],['Sign up','signup']].map(([l,k]) => (
              <span key={k} style={{ fontSize: 13, color: C.muted, cursor: 'pointer' }}>{l}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── How it works ───────────────────────────────────────────────────────────────
function HowItWorks({ setPage }) {
  const steps = [
    { n:'01', title:'Upload your image',      desc:'Drag in a photo or start from scratch. Your image is never uploaded to our servers — everything happens in your browser.' },
    { n:'02', title:'Remove the background',  desc:'Click the AI background remover. It handles hair, complex edges, everything. Takes about 3 seconds.' },
    { n:'03', title:'Add text and elements',  desc:'Use our text tool to add bold, high-contrast text. Add shapes, stickers, or elements from the library.' },
    { n:'04', title:'Check the mobile view',  desc:"Toggle the mobile stamp test to see exactly how your thumbnail looks at 150×84px — how most viewers see it before clicking." },
    { n:'05', title:'Check safe zones',        desc:"Turn on the safe zones overlay to make sure nothing important is covered by YouTube's timestamp or watch-later button." },
    { n:'06', title:'Download at full res',    desc:'Export as PNG or JPG at 1280×720 — the exact spec YouTube recommends for thumbnails.' },
  ];
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingTop: 80 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>How it works</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', letterSpacing: '-1px', marginBottom: 14, color: C.text }}>From photo to finished thumbnail in under 5 minutes</h1>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7 }}>No tutorial needed. But here's the flow most creators use.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 20, padding: '28px 0', borderBottom: i < steps.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.bg2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: '800', color: C.accent, fontFamily: 'monospace' }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <button onClick={() => setPage('editor')} style={{ padding: '13px 28px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: '700' }}>
            Try it now — it's free →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pricing ────────────────────────────────────────────────────────────────────
function Pricing({ setPage, onCheckout }) {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingTop: 80 }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', letterSpacing: '-1px', marginBottom: 12, color: C.text }}>Simple, honest pricing</h1>
          <p style={{ fontSize: 15, color: C.muted }}>Most tools charge you for things that should be free. We don't.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ padding: 32, borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 42, fontWeight: '800', letterSpacing: '-1px', color: C.text }}>$0</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>forever, no card needed</div>
            <button onClick={() => setPage('editor')} style={{ width: '100%', padding: '11px', borderRadius: 7, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: '600', marginBottom: 24 }}>
              Start for free
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Full editor','All shapes & text','Mobile stamp test','YouTube safe zones','Background remover','PNG & JPG export','Unlimited designs'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text2 }}>
                  <span style={{ color: C.success, fontSize: 11, fontWeight: '700' }}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: 32, borderRadius: 12, border: `2px solid ${C.accent}`, background: C.panel, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.accent }} />
            <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 10, background: C.accent, color: '#fff', padding: '3px 8px', borderRadius: 10, fontWeight: '700' }}>MOST POPULAR</div>
            <div style={{ fontSize: 12, color: C.accent, fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 42, fontWeight: '800', letterSpacing: '-1px', color: C.text }}>$15</span>
              <span style={{ fontSize: 14, color: C.muted }}>/month</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>cancel anytime</div>
            <button onClick={onCheckout} style={{ width: '100%', padding: '11px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: '700', marginBottom: 24, boxShadow: `0 4px 16px ${C.accent}44` }}>
              Get Pro
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Everything in Free','AI thumbnail generation','HD 4K export','Priority support','Early access to new features','Brand kit (coming soon)'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text2 }}>
                  <span style={{ color: C.accent, fontSize: 11, fontWeight: '700' }}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24, padding: '20px 24px', borderRadius: 8, background: C.bg2, border: `1px solid ${C.border}`, textAlign: 'center', fontSize: 13, color: C.muted }}>
          Both plans include unlimited designs, no watermarks, and no hidden fees. Ever.
        </div>
      </div>
    </div>
  );
}

// ── Examples ───────────────────────────────────────────────────────────────────
function Examples({ setPage }) {
  const all = [
    { bg:'linear-gradient(135deg,#1a1a2e,#4a3060)', text:'WATCH THIS',        textColor:'#FFD700', tag:'Gaming',     desc:'Bold Impact font with gold text' },
    { bg:'linear-gradient(135deg,#0f2027,#2c5364)', text:'RESULTS',           textColor:'#ffffff', tag:'Business',   desc:'Clean and professional' },
    { bg:'linear-gradient(135deg,#c45c2e,#f7a642)', text:"YOU WON'T BELIEVE", textColor:'#ffffff', tag:'Viral',      desc:'High energy, warm tones' },
    { bg:'linear-gradient(135deg,#1a472a,#2d6a4f)', text:'How I Did It',      textColor:'#95d5b2', tag:'Vlog',       desc:'Personal, approachable' },
    { bg:'linear-gradient(135deg,#2c2c54,#706fd3)', text:'EPIC MOMENT',       textColor:'#ffffff', tag:'Minecraft',  desc:'Deep purple gaming style' },
    { bg:'linear-gradient(135deg,#3d0000,#c0392b)', text:'GONE WRONG',        textColor:'#ffffff', tag:'Challenge',  desc:'Dramatic red for high drama' },
    { bg:'linear-gradient(135deg,#f7971e,#ffd200)', text:'5 TIPS',            textColor:'#1a1a1a', tag:'Tutorial',   desc:'Bright and optimistic' },
    { bg:'linear-gradient(135deg,#11998e,#38ef7d)', text:'I TRIED IT',        textColor:'#ffffff', tag:'Lifestyle',  desc:'Fresh green energy' },
    { bg:'linear-gradient(135deg,#4776E6,#8E54E9)', text:'THE TRUTH',         textColor:'#ffffff', tag:'Commentary', desc:'Mysterious purple gradient' },
  ];
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingTop: 80 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Examples</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', letterSpacing: '-1px', marginBottom: 12, color: C.text }}>Made with ThumbFrame</h1>
          <p style={{ fontSize: 15, color: C.muted }}>Click any example to open it in the editor and customize it.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {all.map((ex, i) => (
            <div key={i} onClick={() => setPage('editor')}
              style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, cursor: 'pointer', background: C.panel, transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ aspectRatio: '16/9', background: ex.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                <span style={{ fontSize: 20, fontWeight: '900', color: ex.textColor, fontFamily: 'Impact, sans-serif', textShadow: '2px 2px 0 rgba(0,0,0,0.5)', letterSpacing: 1, textAlign: 'center', padding: '0 16px' }}>
                  {ex.text}
                </span>
                <div style={{ position: 'absolute', bottom: 5, right: 5, padding: '1px 5px', borderRadius: 2, background: 'rgba(0,0,0,0.8)', fontSize: 8, color: '#fff', fontFamily: 'monospace' }}>0:00</div>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.accent, fontWeight: '700', background: `${C.accent}18`, padding: '2px 8px', borderRadius: 10 }}>{ex.tag}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>Open →</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>{ex.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Auth pages ─────────────────────────────────────────────────────────────────
function AuthPage({ mode, setPage, onAuth }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const isSignup = mode === 'signup';

  async function submit() {
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`https://thumbframe-api-production.up.railway.app/auth/${isSignup ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Something went wrong'); return; }
      onAuth(data);
    } catch(e) {
      setError('Connection failed — is the API running?');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 7,
    border: `1px solid ${C.border2}`, background: C.panel,
    color: C.text, fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <button onClick={() => setPage('home')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, marginBottom: 32, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to home
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: '800' }}>S</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: '700', color: C.text }}>ThumbFrame</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: '800', letterSpacing: '-0.5px', marginBottom: 6, color: C.text }}>
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 1.5 }}>
          {isSignup ? 'Save your designs and access them from anywhere.' : 'Log in to access your saved thumbnails.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isSignup && (
            <div>
              <label style={{ fontSize: 12, fontWeight: '600', color: C.text2, display: 'block', marginBottom: 5 }}>Your name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border2}/>
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: '600', color: C.text2, display: 'block', marginBottom: 5 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" style={inputStyle} type="email"
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border2}/>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: '600', color: C.text2, display: 'block', marginBottom: 5 }}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignup ? 'At least 8 characters' : 'Your password'} style={inputStyle} type="password"
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border2}/>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#b91c1c' }}>
              {error}
            </div>
          )}
          <button onClick={submit} disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 7, border: 'none',
            background: loading ? C.muted : C.accent, color: '#fff', cursor: loading ? 'default' : 'pointer',
            fontSize: 14, fontWeight: '700', marginTop: 6,
            boxShadow: loading ? 'none' : `0 4px 16px ${C.accent}44`,
          }}>
            {loading ? 'Please wait…' : isSignup ? 'Create account →' : 'Log in →'}
          </button>
        </div>

        {!isSignup && (
          <p style={{ fontSize: 12, color: C.muted, marginTop: 14, textAlign: 'center' }}>
            <span style={{ color: C.accent, cursor: 'pointer' }}>Forgot password?</span>
          </p>
        )}

        <div style={{ marginTop: 16, padding: '14px', borderRadius: 7, background: C.bg2, border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: C.muted }}>
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          </span>
          <span onClick={() => setPage(isSignup ? 'login' : 'signup')} style={{ fontSize: 13, color: C.accent, cursor: 'pointer', fontWeight: '600' }}>
            {isSignup ? 'Log in' : 'Sign up free'}
          </span>
        </div>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <span onClick={() => { setError(''); setPage('editor'); }} style={{ fontSize: 12, color: C.muted, cursor: 'pointer', textDecoration: 'underline' }}>
            Continue without account
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ setPage, token, apiUrl }) {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${apiUrl}/designs`, { headers: { authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setDesigns(data.designs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, apiUrl]);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingTop: 80 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: '800', letterSpacing: '-0.5px', marginBottom: 4, color: C.text }}>Your designs</h1>
            <p style={{ fontSize: 14, color: C.muted }}>{designs.length} saved design{designs.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setPage('editor')} style={{ padding: '10px 20px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: '700' }}>
            + New design
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted, fontSize: 14 }}>Loading designs…</div>
        ) : designs.length === 0 ? (
          <div style={{ padding: '60px 40px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🎨</div>
            <div style={{ fontSize: 16, fontWeight: '700', marginBottom: 8, color: C.text }}>No saved designs yet</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
              Open the editor, create a thumbnail, and save it with Ctrl+S.<br/>It'll appear here.
            </div>
            <button onClick={() => setPage('editor')} style={{ padding: '10px 22px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: '600' }}>
              Open editor →
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {designs.map((d, i) => (
              <div key={i} onClick={() => setPage('editor')}
                style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel, cursor: 'pointer', overflow: 'hidden', transition: 'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ aspectRatio: '16/9', background: `linear-gradient(135deg, ${C.bg3}, ${C.bg2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {d.thumbnail
                    ? <img src={d.thumbnail} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 24 }}>🎨</span>}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 3 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{d.created} · {d.platform}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
const API = 'https://thumbframe-api-production.up.railway.app';

export default function App() {
  const [page,  setPage]  = useState('home');
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('sf_token') || null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(u => setUser(u))
      .catch(() => { setToken(null); localStorage.removeItem('sf_token'); });
  }, [token]);

  async function handleCheckout(){
    try{
      const res = await fetch(`${API}/checkout`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({plan:'pro', email:user?.email||''}),
      });
      const data = await res.json();
      if(data.url) window.location.href = data.url;
      else alert('Checkout failed — please try again');
    }catch(e){
      alert('Could not connect to server');
    }
  }

  function handleAuth(data) {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('sf_token', data.token);
    setPage('dashboard');
  }

  function handleLogout() {
    setToken(null); setUser(null);
    localStorage.removeItem('sf_token');
    setPage('home');
  }

  if (page === 'editor') return <Editor onExit={() => setPage('home')} user={user} token={token} apiUrl={API} />;

  return (
    <div>
      <Nav page={page} setPage={setPage} user={user} onLogout={handleLogout} />
      {page === 'home'       && <Home         setPage={setPage} />}
      {page === 'howitworks' && <HowItWorks   setPage={setPage} />}
      {page === 'pricing'    && <Pricing      setPage={setPage} onCheckout={handleCheckout}/>}
      {page === 'examples'   && <Examples     setPage={setPage} />}
      {page === 'login'      && <AuthPage     mode="login"  setPage={setPage} onAuth={handleAuth} />}
      {page === 'signup'     && <AuthPage     mode="signup" setPage={setPage} onAuth={handleAuth} />}
      {page === 'dashboard'  && <Dashboard    setPage={setPage} token={token} apiUrl={API} />}
    </div>
  );
}