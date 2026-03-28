import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000'
  : 'https://thumbframe-api-production.up.railway.app';

// Helper to extract a cropped image using Canvas API
const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (error) => reject(error));
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/png');
};

export default function BrandKitSetupModal({ 
  T, 
  token, 
  brandKitColors, 
  setBrandKitColors, 
  brandKitFace, 
  setBrandKitFace, 
  setShowBrandKitSetup,
  setCmdLog 
}) {
  const [primary, setPrimary] = useState(brandKitColors.primary);
  const [secondary, setSecondary] = useState(brandKitColors.secondary);
  const [uploading, setUploading] = useState(false);

  // Cropper state
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  async function handleFaceUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function confirmCrop() {
    if (!imageSrc || !croppedAreaPixels) return;

    setUploading(true);
    try {
      const croppedImageBase64 = await getCroppedImg(imageSrc, croppedAreaPixels);

      const res = await fetch(`${API_BASE}/brand-kit/upload-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ imageData: croppedImageBase64 }),
      });
      const data = await res.json();
      setBrandKitFace(data.url);
      setImageSrc(null); // Close cropper
    } catch (e) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function saveBrandKit() {
    try {
      const res = await fetch(`${API_BASE}/brand-kit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({
          primaryColor: primary,
          secondaryColor: secondary,
          faceImageUrl: brandKitFace,
        }),
      });
      await res.json();
      setBrandKitColors({ primary, secondary });
      setShowBrandKitSetup(false);
      setCmdLog('✓ Brand Kit saved');
    } catch (e) {
      alert('Save failed');
    }
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowBrandKitSetup(false);}}>
      <div style={{width:480,background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',padding:24}}>
        <div style={{fontSize:18,fontWeight:'700',marginBottom:16,color:T.text}}>Your Brand Kit</div>
        <div style={{fontSize:13,color:T.muted,marginBottom:20,lineHeight:1.6}}>
          Save your brand colors and face image so they're auto-injected into every thumbnail.
        </div>
        
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Primary Color</label>
          <input type="color" value={primary} onChange={e=>setPrimary(e.target.value)} style={{width:'100%',height:40,borderRadius:7,border:`1px solid ${T.border}`,cursor:'pointer'}}/>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Secondary Color</label>
          <input type="color" value={secondary} onChange={e=>setSecondary(e.target.value)} style={{width:'100%',height:40,borderRadius:7,border:`1px solid ${T.border}`,cursor:'pointer'}}/>
        </div>

        <div style={{marginBottom:20}}>
          <label style={{fontSize:12,fontWeight:'600',color:T.text,display:'block',marginBottom:6}}>Your Face (optional)</label>

          {imageSrc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative', width: '100%', height: 250, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setImageSrc(null)} style={{flex:1,padding:8,borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.text,cursor:'pointer',fontSize:12,fontWeight:'600'}}>Cancel Crop</button>
                <button onClick={confirmCrop} disabled={uploading} style={{flex:1,padding:8,borderRadius:5,border:'none',background:T.accent,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:'700', opacity: uploading ? 0.6 : 1}}>{uploading ? 'Uploading...' : 'Confirm Crop'}</button>
              </div>
            </div>
          ) : brandKitFace ? (
            <div style={{position:'relative',width:120,height:120,borderRadius:10,overflow:'hidden',border:`2px solid ${T.border}`}}>
              <img src={brandKitFace} alt="Face" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              <button onClick={()=>setBrandKitFace(null)} style={{position:'absolute',top:4,right:4,padding:'4px 8px',borderRadius:5,background:'rgba(0,0,0,0.8)',color:'#fff',border:'none',fontSize:10,cursor:'pointer'}}>×</button>
            </div>
          ) : (
            <label style={{display:'block',padding:20,borderRadius:10,border:`2px dashed ${T.border}`,textAlign:'center',cursor:'pointer',background:T.input}}>
              <input type="file" accept="image/*" onChange={handleFaceUpload} style={{display:'none'}}/>
              <div style={{fontSize:11,color:T.muted}}>{uploading ? 'Uploading...' : '+ Upload face image'}</div>
            </label>
          )}
        </div>

        {!imageSrc && (
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setShowBrandKitSetup(false)} style={{flex:1,padding:10,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.text,cursor:'pointer',fontSize:13,fontWeight:'600'}}>Cancel</button>
            <button onClick={saveBrandKit} style={{flex:1,padding:10,borderRadius:7,border:'none',background:T.accent,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:'700'}}>Save Brand Kit</button>
          </div>
        )}
      </div>
    </div>
  );
}
