require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const Replicate  = require('replicate');
const { v4: uuidv4 } = require('uuid');
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || null;
const stripe     = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;
const fetch      = require('node-fetch');
const FormData   = require('form-data');
const fs         = require('fs');
const path       = require('path');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const OpenAI     = require('openai');
const Anthropic  = require('@anthropic-ai/sdk');
const sharp      = require('sharp');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'thumbframe-secret-2024';

const openai     = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend     = new Resend(process.env.RESEND_API_KEY);
const replicate  = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const supabase   = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

console.log('[INIT] Supabase admin client ready:', !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY);
console.log('[INIT] Resend client ready:', !!process.env.RESEND_API_KEY);

const allowedOrigins = [
  'https://thumbframe.com',
  'https://www.thumbframe.com',
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL?.trim(),
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));

app.options('*', cors());
app.use('/webhook', express.raw({ type:'application/json' }));
app.use(express.json({ limit:'50mb' }));

// ── File storage ───────────────────────────────────────────────────────────────
const KEYS_FILE     = path.join(__dirname,'keys.json');
const USERS_FILE    = path.join(__dirname,'users.json');
const DESIGNS_FILE  = path.join(__dirname,'designs.json');
const TEAMS_FILE    = path.join(__dirname,'teams.json');
const COMMENTS_FILE = path.join(__dirname,'comments.json');
const VERSIONS_FILE    = path.join(__dirname,'versions.json');
const NEWSLETTER_FILE  = path.join(__dirname,'newsletter.json');

function loadKeys(){ try{ return JSON.parse(fs.readFileSync(KEYS_FILE,'utf8')); }catch(e){ return {}; } }
function saveKeys(k){ fs.writeFileSync(KEYS_FILE,JSON.stringify(k,null,2)); }
function loadUsers(){ try{ return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); }catch(e){ return {}; } }
function saveUsers(u){ fs.writeFileSync(USERS_FILE,JSON.stringify(u,null,2)); }
function loadDesigns(){ try{ return JSON.parse(fs.readFileSync(DESIGNS_FILE,'utf8')); }catch(e){ return {}; } }
function saveDesigns(d){ fs.writeFileSync(DESIGNS_FILE,JSON.stringify(d,null,2)); }
function loadTeams(){ try{ return JSON.parse(fs.readFileSync(TEAMS_FILE,'utf8')); }catch(e){ return {}; } }
function saveTeams(t){ fs.writeFileSync(TEAMS_FILE,JSON.stringify(t,null,2)); }
function loadComments(){ try{ return JSON.parse(fs.readFileSync(COMMENTS_FILE,'utf8')); }catch(e){ return {}; } }
function saveComments(c){ fs.writeFileSync(COMMENTS_FILE,JSON.stringify(c,null,2)); }
function loadVersions(){ try{ return JSON.parse(fs.readFileSync(VERSIONS_FILE,'utf8')); }catch(e){ return {}; } }
function saveVersions(v){ fs.writeFileSync(VERSIONS_FILE,JSON.stringify(v,null,2)); }
function loadNewsletter(){ try{ return JSON.parse(fs.readFileSync(NEWSLETTER_FILE,'utf8')); }catch(e){ return []; } }
function saveNewsletter(d){ fs.writeFileSync(NEWSLETTER_FILE,JSON.stringify(d,null,2)); }
function validateKey(key){ const keys=loadKeys(); return keys[key]||null; }

// ── AI Quota System ────────────────────────────────────────────────────────────
function getPlanQuota(plan){
  switch((plan||'free').toLowerCase()){
    case 'agency':  return{limit:Infinity, period:'month'};
    case 'pro':     return{limit:300,      period:'month'};
    case 'starter': return{limit:50,       period:'month'};
    default:        return{limit:3,        period:'day'};
  }
}

function checkAndDecrementQuota(email){
  const users=loadUsers();
  const user=users[email];
  if(!user) return{ok:false,message:'User not found',code:'INVALID_INPUT'};

  const {limit,period}=getPlanQuota(user.plan);
  if(limit===Infinity) return{ok:true};

  const now=Date.now();
  let usage=user.aiUsage||{count:0,resetAt:0};

  if(now>=(usage.resetAt||0)){
    const next=new Date();
    if(period==='day'){next.setDate(next.getDate()+1);next.setHours(0,0,0,0);}
    else{next.setMonth(next.getMonth()+1);next.setDate(1);next.setHours(0,0,0,0);}
    usage={count:0,resetAt:next.getTime()};
  }

  if(usage.count>=limit){
    const planLabel=(user.plan||'free').charAt(0).toUpperCase()+(user.plan||'free').slice(1);
    const msg=(!user.plan||user.plan==='free')
      ?'Free plan: 3 AI actions per day used. Upgrade to Starter for 50/month.'
      :`${planLabel} plan limit (${limit}/${period}) reached. Upgrade to Agency for unlimited.`;
    return{ok:false,message:msg,code:'QUOTA_EXCEEDED'};
  }

  usage.count++;
  users[email]={...user,aiUsage:usage};
  saveUsers(users);
  return{ok:true,remaining:limit-usage.count};
}

function authMiddleware(req,res,next){
  const token=req.headers['authorization']?.split(' ')[1];
  if(!token) return res.status(401).json({error:'No token'});
  try{ req.user=jwt.verify(token,JWT_SECRET); next(); }
  catch(e){ res.status(401).json({error:'Invalid token'}); }
}

// Accepts both custom JWTs and Supabase access tokens.
async function flexAuthMiddleware(req,res,next){
  const token=req.headers['authorization']?.split(' ')[1];
  if(!token) return res.status(401).json({error:'No token'});

  // 1. Try custom JWT
  try{ req.user=jwt.verify(token,JWT_SECRET); return next(); }
  catch{}

  // 2. Try Supabase token via admin client
  if(supabase){
    try{
      const {data:{user},error}=await supabase.auth.getUser(token);
      if(!error && user){
        req.user={email:user.email, id:user.id};
        return next();
      }
    }catch{}
  }

  // 3. Last resort: decode without verify (Supabase tokens are trusted upstream)
  // Preserve the full payload so user_metadata.is_pro etc. are available downstream.
  try{
    const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
    if(payload.email || payload.sub){
      req.user={...payload, email:payload.email||payload.sub, id:payload.sub};
      return next();
    }
  }catch{}

  res.status(401).json({error:'Invalid token'});
}

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/',(req,res)=>res.json({status:'ThumbFrame API running',version:'3.0'}));

// ── Proxy image (CORS fix) ─────────────────────────────────────────────────────
app.get('/proxy-image', async(req,res)=>{
  try{
    const {url}=req.query;
    if(!url) return res.status(400).json({error:'No URL'});
    const response=await fetch(url);
    const buffer=Buffer.from(await response.arrayBuffer());
    res.set('Content-Type',response.headers.get('content-type')||'image/png');
    res.set('Access-Control-Allow-Origin','*');
    res.send(buffer);
  }catch(err){
    console.error('Proxy error:',err);
    res.status(500).json({error:'Proxy failed'});
  }
});

// ── Image Generation Helper Functions ────────────────────────────────────────

async function generateWithDallE3(prompt, size, style) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const validSize = ['1024x1024','1792x1024','1024x1792'].includes(size) ? size : '1792x1024';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: validSize,
        style: style || 'vivid',
        response_format: 'url',
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`DALL-E 3 HTTP ${response.status}: ${errData?.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  if (!data?.data?.[0]?.url) throw new Error('DALL-E 3 returned no image URL');
  return { imageUrl: data.data[0].url };
}

async function generateWithReplicateFlux(prompt) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: '16:9',
          output_format: 'webp',
          num_outputs: 1,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Replicate Flux HTTP ${response.status}: ${errData?.detail || JSON.stringify(errData)}`);
    }

    const data = await response.json();

    if (data.status === 'processing' || data.status === 'starting') {
      const predictionId = data.id;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: { 'Authorization': `Token ${apiKey}` },
        });
        const pollData = await poll.json();
        if (pollData.status === 'succeeded' && pollData.output?.[0]) {
          return { imageUrl: pollData.output[0] };
        }
        if (pollData.status === 'failed') {
          throw new Error(`Replicate Flux prediction failed: ${pollData.error || 'Unknown'}`);
        }
      }
      throw new Error('Replicate Flux timed out waiting for result');
    }

    if (data.output?.[0]) return { imageUrl: data.output[0] };
    throw new Error('Replicate Flux returned no output');
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithReplicateSDXL(prompt) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch('https://api.replicate.com/v1/models/stability-ai/sdxl/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        input: {
          prompt,
          width: 1024,
          height: 576,
          num_outputs: 1,
          scheduler: 'K_EULER',
          num_inference_steps: 25,
          guidance_scale: 7.5,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Replicate SDXL HTTP ${response.status}: ${errData?.detail || JSON.stringify(errData)}`);
    }

    const data = await response.json();
    if (data.output?.[0]) return { imageUrl: data.output[0] };

    if (data.id && (data.status === 'starting' || data.status === 'processing')) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
          headers: { 'Authorization': `Token ${apiKey}` },
        });
        const pollData = await poll.json();
        if (pollData.status === 'succeeded' && pollData.output?.[0]) {
          return { imageUrl: pollData.output[0] };
        }
        if (pollData.status === 'failed') throw new Error('SDXL prediction failed');
      }
    }

    throw new Error('Replicate SDXL returned no output');
  } finally {
    clearTimeout(timeout);
  }
}

// ── POST /api/generate-image — multi-provider fallback pipeline ───────────────
app.post('/api/generate-image', flexAuthMiddleware, async(req, res) => {
  const { prompt, size = '1792x1024', style = 'vivid' } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  const quota = checkAndDecrementQuota(req.user.email);
  if (!quota.ok) return res.status(429).json({ success: false, error: quota.message, code: quota.code });

  const providers = [
    { name: 'dall-e-3',        fn: () => generateWithDallE3(prompt, size, style) },
    { name: 'replicate-flux',  fn: () => generateWithReplicateFlux(prompt) },
    { name: 'replicate-sdxl',  fn: () => generateWithReplicateSDXL(prompt) },
  ];

  for (const provider of providers) {
    try {
      console.log(`[generate-image] Trying ${provider.name} for ${req.user.email}...`);
      const result = await provider.fn();
      console.log(`[generate-image] ${provider.name} succeeded`);
      return res.json({
        success: true,
        image: result.imageUrl || result.imageBase64,
        format: result.imageUrl ? 'url' : 'base64',
        provider: provider.name,
        remaining: quota.remaining,
      });
    } catch (err) {
      console.error(`[generate-image] ${provider.name} failed:`, err.message);
    }
  }

  return res.status(500).json({
    success: false,
    error: 'Image generation is temporarily unavailable. Please try again in a few minutes.',
  });
});

// ── POST /ai-generate — legacy endpoint (kept for compatibility) ──────────────
app.post('/ai-generate', flexAuthMiddleware, async(req,res)=>{
  const { prompt } = req.body;
  if(!prompt) return res.status(400).json({error:'No prompt'});

  const quota = checkAndDecrementQuota(req.user.email);
  if (!quota.ok) return res.status(429).json({ error: quota.message });

  const fullPrompt = `YouTube thumbnail background: ${prompt}. Dramatic lighting, high contrast, vivid colors, cinematic, no text, no watermarks, no logos.`;

  const providers = [
    { name: 'dall-e-3',       fn: () => generateWithDallE3(fullPrompt, '1792x1024', 'vivid') },
    { name: 'replicate-flux', fn: () => generateWithReplicateFlux(fullPrompt) },
    { name: 'replicate-sdxl', fn: () => generateWithReplicateSDXL(fullPrompt) },
  ];

  for (const provider of providers) {
    try {
      console.log(`[ai-generate] Trying ${provider.name}...`);
      const result = await provider.fn();
      console.log(`[ai-generate] ${provider.name} succeeded`);
      const imageUrl = result.imageUrl;
      // Legacy: fetch URL and return base64 so old frontend code still works
      const imgRes = await fetch(imageUrl);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      return res.json({ image: `data:image/png;base64,${buffer.toString('base64')}` });
    } catch (err) {
      console.error(`[ai-generate] ${provider.name} failed:`, err.message);
    }
  }

  res.status(500).json({ error: 'Image generation is temporarily unavailable. Please try again.' });
});

// ── AI Command bar (Claude) ────────────────────────────────────────────────────
app.post('/ai-command', async(req,res)=>{
  try{
    const { command, canvasState } = req.body;
    if(!command) return res.status(400).json({error:'No command'});

    const system = `You are an AI assistant for ThumbFrame, a YouTube thumbnail editor.
The user gives you a plain-English command and the current canvas state.
Respond ONLY with valid JSON — no explanation, no markdown fences.
If a single action is needed return the action object directly.
If multiple actions are needed return { "actions": [...] }.

Canvas state: ${JSON.stringify(canvasState)}

Available actions:

updateLayer      — { action:"updateLayer", id, updates:{opacity,blendMode,brightness,contrast,saturation,hue,blur,x,y,width,height,rotation,visible} }
updateBackground — { action:"updateBackground", updates:{bgColor} }
addText          — { action:"addText", text, fontSize, fontFamily, fontWeight, textColor, strokeColor, strokeWidth, x, y, shadow, shadowColor, shadowBlur }
deleteLayer      — { action:"deleteLayer", id }
moveLayer        — { action:"moveLayer", id, x, y }
resizeLayer      — { action:"resizeLayer", id, width, height }
setBlendMode     — { action:"setBlendMode", id, mode }
adjustBrightness — { action:"adjustBrightness", value }  (value: -100 to 100)
adjustContrast   — { action:"adjustContrast", value }    (value: -100 to 100)
adjustSaturation — { action:"adjustSaturation", value }  (value: -100 to 100)
adjustHue        — { action:"adjustHue", value }         (value: -180 to 180)
adjustBlur       — { action:"adjustBlur", id, value }    (value: 0 to 20)
setOpacity       — { action:"setOpacity", id, value }    (value: 0 to 1)
duplicateLayer   — { action:"duplicateLayer", id }
reorderLayer     — { action:"reorderLayer", id, index }
message          — { action:"message", message:"..." }   (use when command is ambiguous or impossible)

Rules:
- For color changes always use hex strings like "#ff0000"
- For "make text bigger" increase fontSize by 20-40%
- For "darken/brighten" use adjustBrightness with -30 to -60 / +30 to +60
- For "more vibrant/saturated" use adjustSaturation with +40 to +80
- For "increase contrast" use adjustContrast with +30 to +60
- For "add glow" duplicate the text layer then set blendMode:"screen" and blur:6 on the copy
- When the user says "the text" or "the image" and there is only one such layer, use its id
- x/y positions are percentages of canvas width/height (0–100)`;

    const message = await anthropic.messages.create({
      model:      'claude-opus-4-20250514',
      max_tokens: 800,
      system,
      messages:[{ role:'user', content:command }],
    });

    const raw    = message.content[0].text.trim();
    const clean  = raw.replace(/```json|```/g,'').trim();
    console.log('AI command:', clean);

    try{
      const parsed = JSON.parse(clean);
      res.json({ result:parsed, raw:clean });
    }catch(e){
      res.json({ result:null, raw:clean, error:'Could not parse response' });
    }

  }catch(err){
    console.error('AI command error:',err.message);
    res.status(500).json({error:`Command failed: ${err.message}`});
  }
});

// ── Background remover ─────────────────────────────────────────────────────────
app.post('/remove-bg', async(req,res)=>{
  try{
    const {imageUrl, image}=req.body;
    const src=image||imageUrl;
    if(!src) return res.status(400).json({error:'No image'});
    let imageBuffer;
    if(src.startsWith('data:')){
      imageBuffer=Buffer.from(src.split(',')[1],'base64');
    }else{
      const r=await fetch(src);
      imageBuffer=Buffer.from(await r.arrayBuffer());
    }
    const formData=new FormData();
    formData.append('image_file',imageBuffer,{filename:'image.png'});
    formData.append('size','auto');
    const response=await fetch('https://api.remove.bg/v1.0/removebg',{
      method:'POST',
      headers:{'X-Api-Key':process.env.REMOVEBG_API_KEY,...formData.getHeaders()},
      body:formData,
    });
    if(!response.ok){
      const errText=await response.text();
      console.error('remove.bg error:',response.status,errText);
      return res.status(400).json({error:'remove.bg failed'});
    }
    const buffer=Buffer.from(await response.arrayBuffer());
    res.json({image:`data:image/png;base64,${buffer.toString('base64')}`});
  }catch(err){
    console.error('Remove BG error:',err.message,err.type,err.code);
    res.status(500).json({error:`AI tool timed out. ${err.message}`});
  }
});

// ── Auth ───────────────────────────────────────────────────────────────────────
app.post('/auth/signup', async(req,res)=>{
  try{
    const {email,password,name}=req.body;
    if(!email||!password) return res.status(400).json({error:'Email and password required'});
    const users=loadUsers();
    if(users[email]) return res.status(400).json({error:'Email already exists'});
    const hash=await bcrypt.hash(password,10);
    users[email]={email,name:name||email.split('@')[0],hash,created:new Date().toISOString(),plan:'free'};
    saveUsers(users);
    const token=jwt.sign({email,name:users[email].name},JWT_SECRET,{expiresIn:'30d'});

    // Send welcome email
    try{
      await resend.emails.send({
        from:    'ThumbFrame <hello@thumbframe.com>',
        to:      email,
        subject: 'Welcome to ThumbFrame 🎨',
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
            <h1 style="font-size:28px;font-weight:800;color:#1a1612;margin-bottom:8px">
              Welcome to ThumbFrame, ${name||email.split('@')[0]}! 🎨
            </h1>
            <p style="color:#666;font-size:15px;line-height:1.6">
              You now have access to the full ThumbFrame thumbnail editor — completely free.
            </p>
            <div style="margin:24px 0;padding:20px;background:#f5f0e8;border-radius:10px">
              <p style="margin:0;font-weight:700;color:#1a1612;margin-bottom:12px">What you can do:</p>
              <ul style="color:#555;line-height:2;margin:0;padding-left:20px">
                <li>Remove backgrounds with AI</li>
                <li>Add rim lighting like Minecraft thumbnails</li>
                <li>Check your CTR score before posting</li>
                <li>Preview how your thumbnail looks on mobile</li>
                <li>Export PNG, JPG, or WebP</li>
              </ul>
            </div>
            <a href="${process.env.FRONTEND_URL || 'https://thumbframe.com'}/editor"
               style="display:inline-block;padding:14px 28px;background:#c45c2e;color:#fff;
                      text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">
              Open ThumbFrame →
            </a>
            <p style="margin-top:32px;color:#999;font-size:12px">
              Built for YouTubers who care about their craft.
            </p>
          </div>
        `,
      });
    }catch(emailErr){
      console.log('Email send failed (non-critical):',emailErr.message);
    }

    res.json({token,user:{email,name:users[email].name,plan:'free'}});
  }catch(err){
    console.error('Signup error:',err);
    res.status(500).json({error:'Signup failed'});
  }
});

app.post('/auth/login', async(req,res)=>{
  try{
    const {email,password}=req.body;
    if(!email||!password) return res.status(400).json({error:'Email and password required'});
    const users=loadUsers();
    const user=users[email];
    if(!user) return res.status(400).json({error:'No account with that email'});
    const valid=await bcrypt.compare(password,user.hash);
    if(!valid) return res.status(400).json({error:'Incorrect password'});
    const token=jwt.sign({email,name:user.name},JWT_SECRET,{expiresIn:'30d'});
    res.json({token,user:{email,name:user.name,plan:user.plan||'free'}});
  }catch(err){
    console.error('Login error:',err);
    res.status(500).json({error:'Login failed'});
  }
});

app.get('/auth/me', flexAuthMiddleware,(req,res)=>{
  const users=loadUsers();
  const user=users[req.user.email];
  if(!user) return res.status(404).json({error:'User not found'});
  res.json({email:user.email,name:user.name,plan:user.plan||'free'});
});

// /api/me — blueprint-spec endpoint (accepts both custom JWTs and Supabase tokens)
app.get('/api/me', flexAuthMiddleware, async(req,res)=>{
  const users=loadUsers();
  const user=users[req.user.email];
  // First-time Supabase user: auto-create record
  if(!user){
    const newUser={email:req.user.email,plan:'free',createdAt:new Date().toISOString()};
    users[req.user.email]=newUser;
    saveUsers(users);
    return res.json({
      id:req.user.email, email:newUser.email, name:null,
      plan:'free', stripeStatus:null, trialEndsAt:null,
      stripeCustomerId:null, createdAt:newUser.createdAt,
    });
  }
  res.json({
    id:               req.user.email,
    email:            user.email,
    name:             user.name||null,
    plan:             user.plan||'free',
    stripeStatus:     user.stripeStatus||null,
    trialEndsAt:      user.trialEndsAt||null,
    stripeCustomerId: user.stripeCustomerId||null,
    createdAt:        user.createdAt||null,
  });
});

// ── Password reset ─────────────────────────────────────────────────────────────
const resetTokens = {};

app.post('/auth/forgot-password', async(req,res)=>{
  try{
    const {email}=req.body;
    const users=loadUsers();
    if(!users[email]) return res.json({success:true}); // Don't reveal if email exists
    const token=uuidv4();
    resetTokens[token]={email,expires:Date.now()+3600000}; // 1 hour
    try{
      await resend.emails.send({
        from:    'ThumbFrame <hello@thumbframe.com>',
        to:      email,
        subject: 'Reset your ThumbFrame password',
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
            <h1 style="font-size:24px;font-weight:800;color:#1a1612">Reset your password</h1>
            <p style="color:#666;font-size:15px;line-height:1.6">
              Click the button below to reset your password. This link expires in 1 hour.
            </p>
            <a href="${process.env.FRONTEND_URL || 'https://thumbframe.com'}/reset-password?token=${token}"
               style="display:inline-block;padding:14px 28px;background:#c45c2e;color:#fff;
                      text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">
              Reset password →
            </a>
            <p style="margin-top:24px;color:#999;font-size:12px">
              If you didn't request this, ignore this email.
            </p>
          </div>
        `,
      });
    }catch(emailErr){
      console.log('Reset email failed:',emailErr.message);
    }
    res.json({success:true,message:'If that email exists you will receive a reset link'});
  }catch(err){
    res.status(500).json({error:'Reset failed'});
  }
});

app.post('/auth/reset-password', async(req,res)=>{
  try{
    const {token,password}=req.body;
    const reset=resetTokens[token];
    if(!reset||reset.expires<Date.now())
      return res.status(400).json({error:'Invalid or expired token'});
    const users=loadUsers();
    if(!users[reset.email]) return res.status(400).json({error:'User not found'});
    users[reset.email].hash=await bcrypt.hash(password,10);
    saveUsers(users);
    delete resetTokens[token];
    res.json({success:true});
  }catch(err){
    res.status(500).json({error:'Reset failed'});
  }
});

// ── Designs ────────────────────────────────────────────────────────────────────
app.post('/designs/save', flexAuthMiddleware,(req,res)=>{
  try{
    const email=req.user?.email;
    if(!email || typeof email!=='string' || !email.includes('@')){
      return res.status(401).json({error:'Could not resolve user email from token'});
    }
    const {name,platform,layers,brightness,contrast,saturation,hue,thumbnail}=req.body;
    const designs=loadDesigns();
    if(!designs[email]) designs[email]=[];
    const id=Date.now().toString();
    const existing=designs[email].findIndex(d=>d.name===name);
    const design={id,name,platform,layers,brightness,contrast,saturation,hue,
      thumbnail:thumbnail||null,created:new Date().toLocaleDateString(),
      updated:new Date().toISOString()};
    if(existing>=0){
      designs[email][existing]={...designs[email][existing],...design};
    }else{
      designs[email].unshift(design);
    }
    designs[email]=designs[email].slice(0,50);
    saveDesigns(designs);
    res.json({success:true,id:design.id});
  }catch(err){
    res.status(500).json({error:'Save failed'});
  }
});

// /designs/list is an alias kept for frontend compatibility
app.get('/designs/list', flexAuthMiddleware,(req,res)=>{
  const email=req.user?.email;
  if(!email || typeof email!=='string' || !email.includes('@')){
    return res.status(401).json({error:'Could not resolve user email from token'});
  }
  const designs=loadDesigns();
  const list=(designs[email]||[]).map(d=>({
    id:d.id,name:d.name,platform:d.platform,
    created:d.created,updated:d.updated,thumbnail:d.thumbnail,
  }));
  res.json({designs:list});
});

app.get('/designs', flexAuthMiddleware,(req,res)=>{
  const email=req.user?.email;
  if(!email || typeof email!=='string' || !email.includes('@')){
    return res.status(401).json({error:'Could not resolve user email from token'});
  }
  const designs=loadDesigns();
  const list=(designs[email]||[]).map(d=>({
    id:d.id,name:d.name,platform:d.platform,
    created:d.created,updated:d.updated,thumbnail:d.thumbnail,
  }));
  res.json({designs:list});
});

app.get('/designs/:id', flexAuthMiddleware,(req,res)=>{
  const designs=loadDesigns();
  const design=(designs[req.user.email]||[]).find(d=>d.id===req.params.id);
  if(!design) return res.status(404).json({error:'Not found'});
  res.json({design});
});

app.delete('/designs/:id', flexAuthMiddleware,(req,res)=>{
  const designs=loadDesigns();
  if(!designs[req.user.email]) return res.status(404).json({error:'No designs'});
  designs[req.user.email]=designs[req.user.email].filter(d=>d.id!==req.params.id);
  saveDesigns(designs);
  res.json({success:true});
});

// ── Stripe checkout ────────────────────────────────────────────────────────────
app.post('/checkout', async(req,res)=>{
  try{
    console.log('[checkout] request started', {
      body: req.body,
      origin: req.headers.origin,
    });
    console.log('[checkout] STRIPE_SECRET_KEY found:', !!stripeSecretKey);

    const {email}=req.body;
    const priceId=process.env.STRIPE_PRO_PRICE_ID?.trim();

    console.log('[checkout] priceId:', priceId);

    if(!stripeSecretKey){
      throw new Error('Missing STRIPE_SECRET_KEY');
    }

    if(!stripeSecretKey.startsWith('sk_')){
      throw new Error('Invalid STRIPE_SECRET_KEY format. Expected a secret key starting with sk_.');
    }

    if(!priceId){
      throw new Error('Missing STRIPE_PRO_PRICE_ID');
    }

    if(!priceId.startsWith('price_')){
      console.error('ERROR: Invalid Price ID format in Environment Variables.');
      throw new Error('ERROR: Invalid Price ID format in Environment Variables.');
    }

    const session=await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      mode:'subscription',
      allow_promotion_codes:true,
      ...(email && email.trim() ? {customer_email: email.trim()} : {}),
      line_items:[{price:priceId,quantity:1}],
      success_url: `https://thumbframe.com/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://thumbframe.com/pricing`,
    });

    console.log('[checkout] session created:', session.id);
    res.json({url:session.url});
  }catch(err){
    console.error('[checkout] error:', err);
    res.status(500).json({
      error: err.message || 'Checkout failed',
    });
  }
});

// ── Debug Checkout ─────────────────────────────────────────────────────────────
app.post('/api/debug-checkout', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  res.json({
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenLength: token?.length,
    hasStripe: !!stripe,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || 'MISSING',
    frontendUrl: process.env.FRONTEND_URL || 'MISSING',
  });
});

// ── Stripe Checkout ────────────────────────────────────────────────────────────
app.post('/api/create-checkout-session', flexAuthMiddleware, async (req, res) => {
  console.log('[checkout] HANDLER REACHED — user:', JSON.stringify(req.user), 'stripe:', !!stripe);

  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured — STRIPE_SECRET_KEY missing' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId: req.user.id },
      },
      customer_email: req.user.email,
      success_url: `${process.env.FRONTEND_URL || 'https://thumbframe.com'}/account?checkout=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://thumbframe.com'}/pricing`,
      metadata: { userId: req.user.id },
    });
    console.log('[checkout] session created:', session.id, 'for', req.user.email);
    res.json({ url: session.url });
  } catch (error) {
    console.error('[checkout] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Stripe Customer Portal ─────────────────────────────────────────────────────
app.post('/api/create-portal-session', flexAuthMiddleware, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured — STRIPE_SECRET_KEY missing' });
  try {
    const users = loadUsers();
    const stripeCustomerId = (users[req.user.email] || {}).stripeCustomerId;
    if (!stripeCustomerId) return res.status(400).json({ error: 'No Stripe customer found. Complete a checkout first.' });
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'https://thumbframe.com'}/account`,
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('[portal] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhook', express.raw({type:'application/json'}), async (req,res)=>{
  if(!stripe) return res.status(500).send('Stripe not configured');
  try{
    const sig=req.headers['stripe-signature'];
    const event=stripe.webhooks.constructEvent(req.body,sig,process.env.STRIPE_WEBHOOK_SECRET);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerEmail = session.customer_details?.email;
        const stripeCustomerId = session.customer;

        console.log(`[webhook] checkout.session.completed — email: ${customerEmail}, customer: ${stripeCustomerId}`);

        if (!customerEmail) { console.error('[webhook] No email in session'); break; }

        // Check if subscription has a trial
        let stripeStatus = 'active';
        let trialEndsAt = null;
        if (session.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            if (sub.trial_end && sub.status === 'trialing') {
              stripeStatus = 'trialing';
              trialEndsAt = new Date(sub.trial_end * 1000).toISOString();
            }
          } catch(e) { console.error('[webhook] subscription retrieve failed:', e.message); }
        }

        // Persist to users.json
        const users = loadUsers();
        if (!users[customerEmail]) users[customerEmail] = { email: customerEmail };
        users[customerEmail].plan            = 'pro';
        users[customerEmail].stripeStatus    = stripeStatus;
        users[customerEmail].trialEndsAt     = trialEndsAt;
        users[customerEmail].stripeCustomerId= stripeCustomerId || users[customerEmail].stripeCustomerId;
        saveUsers(users);
        console.log(`[webhook] user upgraded — email: ${customerEmail}, status: ${stripeStatus}, trialEndsAt: ${trialEndsAt}`);

        // Supabase sync (non-fatal) — update profiles table AND auth user_metadata
        if (supabase) {
          (async () => {
            try {
              // 1. Profiles table (requirePro reads this as source of truth)
              const { error: pe } = await supabase.from('profiles')
                .upsert({
                  email: customerEmail,
                  is_pro: true,
                  plan: 'pro',
                  subscription_status: stripeStatus,
                  stripe_customer_id: stripeCustomerId,
                }, { onConflict: 'email' });
              if (pe) console.error('[webhook] profiles upsert failed:', pe.message);
              else console.log(`[webhook] profiles updated for ${customerEmail}`);

              // 2. Auth user_metadata — listUsers() without filter, then find by email
              const { data: authData } = await supabase.auth.admin.listUsers();
              const authUser = authData?.users?.find(u => u.email === customerEmail);
              if (authUser) {
                const { error: ue } = await supabase.auth.admin.updateUserById(authUser.id, { user_metadata: { is_pro: true } });
                if (ue) console.error('[webhook] updateUserById failed:', ue.message);
                else console.log(`[webhook] auth metadata updated for ${customerEmail}`);
              } else {
                console.warn(`[webhook] auth user not found for ${customerEmail} — profiles table updated but JWT won't reflect Pro until re-login`);
              }
            } catch(e) { console.error('[webhook] Supabase sync error:', e.message); }
          })();
        }

        // Welcome email (non-fatal)
        const isTrialing = stripeStatus === 'trialing';
        resend.emails.send({
          from: 'ThumbFrame <onboarding@resend.dev>',
          to: customerEmail,
          subject: isTrialing ? 'Your 7-day ThumbFrame Pro trial has started!' : 'Welcome to ThumbFrame Pro!',
          html: isTrialing
            ? '<h1>Your Pro trial is live!</h1><p>You have 7 days of full Pro access. Make something great.</p><p>No charge until your trial ends — and you can cancel anytime.</p>'
            : '<h1>Welcome to Pro!</h1><p>Your Pro features are now unlocked. Open the editor to get started.</p>',
        }).catch(()=>{});

        break;
      }
      case 'customer.subscription.trial_will_end': {
        // Fires ~3 days before trial ends
        const sub = event.data.object;
        const cid = sub.customer;
        const usersT = loadUsers();
        const entryT = Object.values(usersT).find(u => u.stripeCustomerId === cid);
        if (entryT) {
          entryT.trialEndsAt = new Date(sub.trial_end * 1000).toISOString();
          saveUsers(usersT);
          console.log(`[webhook] trial_will_end — customer: ${cid}, ends: ${entryT.trialEndsAt}`);
          // TODO: send "trial ending soon" reminder email via resend
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const cid = sub.customer;
        const isPro = sub.status === 'active' || sub.status === 'trialing';
        const newPlan = isPro ? 'pro' : 'free';
        // Update users.json cache
        const usersU = loadUsers();
        const entryU = Object.values(usersU).find(u => u.stripeCustomerId === cid);
        if (entryU) {
          entryU.plan = newPlan;
          entryU.stripeStatus = sub.status;
          entryU.trialEndsAt = (sub.status === 'trialing' && sub.trial_end) ? new Date(sub.trial_end * 1000).toISOString() : null;
          saveUsers(usersU);
        }
        // Supabase sync (persistent — survives restarts)
        if (supabase) {
          try {
            const customer = await stripe.customers.retrieve(cid);
            const custEmail = customer.email;
            if (custEmail) {
              await supabase.from('profiles')
                .upsert({ email: custEmail, is_pro: isPro, plan: newPlan, subscription_status: sub.status }, { onConflict: 'email' });
              // Refresh JWT metadata so user's next token refresh picks it up
              const { data: authData } = await supabase.auth.admin.listUsers();
              const authUser = authData?.users?.find(u => u.email === custEmail);
              if (authUser) await supabase.auth.admin.updateUserById(authUser.id, { user_metadata: { is_pro: isPro } });
              console.log(`[webhook] subscription.updated — ${custEmail}, status: ${sub.status}, plan: ${newPlan}`);
            }
          } catch(e) { console.error('[webhook] subscription.updated Supabase sync failed:', e.message); }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const cid = sub.customer;
        // Update users.json cache
        const users2 = loadUsers();
        const entry = Object.values(users2).find(u => u.stripeCustomerId === cid);
        if (entry) { entry.plan = 'free'; entry.stripeStatus = 'canceled'; saveUsers(users2); }
        // Supabase sync (persistent)
        if (supabase) {
          try {
            const customer = await stripe.customers.retrieve(cid);
            const custEmail = customer.email;
            if (custEmail) {
              await supabase.from('profiles')
                .upsert({ email: custEmail, is_pro: false, plan: 'free', subscription_status: 'canceled' }, { onConflict: 'email' });
              const { data: authData } = await supabase.auth.admin.listUsers();
              const authUser = authData?.users?.find(u => u.email === custEmail);
              if (authUser) await supabase.auth.admin.updateUserById(authUser.id, { user_metadata: { is_pro: false } });
              console.log(`[webhook] subscription canceled — ${custEmail}`);
            }
          } catch(e) { console.error('[webhook] subscription.deleted Supabase sync failed:', e.message); }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        const cid2 = inv.customer;
        const users3 = loadUsers();
        const entry2 = Object.values(users3).find(u => u.stripeCustomerId === cid2);
        if (entry2) {
          entry2.stripeStatus = 'past_due';
          saveUsers(users3);
          console.log(`[webhook] payment_failed for customer ${cid2}`);
        }
        break;
      }
      default:
        break;
    }
    res.json({received:true});
  }catch(err){
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// ── Admin: force-pro — sync plan for a user whose webhook was missed ──────────
app.post('/api/admin/force-pro', async(req,res)=>{
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  const {email} = req.body||{};

  // Accept either a configured admin key or the JWT_SECRET as a quick backdoor
  if(adminKey !== process.env.ADMIN_KEY && adminKey !== JWT_SECRET){
    return res.status(403).json({error:'Forbidden'});
  }
  if(!email) return res.status(400).json({error:'email required'});

  // 1. users.json
  const users = loadUsers();
  if(!users[email]) users[email] = {email};
  users[email].plan = 'pro';
  users[email].stripeStatus = 'active';
  saveUsers(users);
  console.log(`[force-pro] users.json updated for ${email}`);

  // 2. Supabase profiles table
  let profilesOk = false;
  if(supabase){
    const {error:pe} = await supabase.from('profiles').upsert({email, is_pro:true, plan:'pro', subscription_status:'active'},{onConflict:'email'});
    profilesOk = !pe;
    if(pe) console.error('[force-pro] profiles upsert failed:', pe.message);
  }

  // 3. Supabase auth user_metadata
  let authOk = false;
  if(supabase){
    const {data, error:le} = await supabase.auth.admin.listUsers();
    if(!le){
      const user = data.users.find(u => u.email === email);
      if(user){
        const {error:ue} = await supabase.auth.admin.updateUserById(user.id, {user_metadata:{is_pro:true}});
        authOk = !ue;
        if(ue) console.error('[force-pro] updateUserById failed:', ue.message);
        else console.log(`[force-pro] auth metadata updated for ${email} (uid: ${user.id})`);
      } else {
        console.warn(`[force-pro] No Supabase auth user found for ${email}`);
      }
    }
  }

  res.json({success:true, email, plan:'pro', profilesOk, authOk});
});

app.get('/validate-key',(req,res)=>{
  const apiKey=req.headers['x-api-key'];
  const keyData=validateKey(apiKey);
  if(!keyData) return res.status(401).json({valid:false});
  res.json({valid:true,plan:keyData.plan,email:keyData.email});
});

app.get('/success',(req,res)=>res.send(`
  <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#f5f0e8;color:#1a1612">
    <h1 style="color:#4a7c59">✅ Payment successful!</h1>
    <p>Your Pro account is now active. Check your email for confirmation.</p>
    <a href="/" style="color:#c45c2e;font-weight:700">← Back to ThumbFrame</a>
  </body></html>
`));

// Keep Railway awake
setInterval(()=>{
  fetch(`https://thumbframe-api-production.up.railway.app/`)
    .then(()=>console.log('Keep-alive ping sent'))
    .catch(()=>console.log('Keep-alive ping failed'));
}, 14 * 60 * 1000);

// ── Smart Subject Detection — SAM 2 via Replicate ─────────────────────────────
app.post('/api/segment', flexAuthMiddleware, async(req,res)=>{
  try{
    const {image}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Invalid image data',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok){
      return res.status(429).json({success:false,error:quota.message,code:quota.code});
    }

    let masks=null;

    // ── Attempt 1: SAM 2 ──────────────────────────────────────────────────────
    try{
      console.log('[SEGMENT] Running SAM 2...');
      const output=await replicate.run('meta/sam-2',{
        input:{
          image,
          points_per_side:        16,   // 16×16 grid — faster than default 32
          pred_iou_thresh:        0.86,
          stability_score_thresh: 0.92,
          min_mask_region_area:   500,  // skip tiny noise masks
        },
      });

      if(Array.isArray(output)&&output.length>0){
        console.log(`[SEGMENT] SAM 2 returned ${output.length} masks`);
        masks=await Promise.all(
          output.slice(0,8).map(async(maskUrl)=>{
            const r=await fetch(maskUrl);
            const buf=Buffer.from(await r.arrayBuffer());
            return`data:image/png;base64,${buf.toString('base64')}`;
          })
        );
      }
    }catch(sam2Err){
      console.warn('[SEGMENT] SAM 2 failed:',sam2Err.message);
    }

    // ── Attempt 2: RMBG-2.0 fallback ─────────────────────────────────────────
    if(!masks||masks.length===0){
      try{
        console.log('[SEGMENT] Falling back to RMBG-2.0...');
        const output=await replicate.run('briaai/rmbg-2.0',{input:{image}});
        const maskUrl=typeof output==='string'?output:output?.[0];
        if(maskUrl){
          const r=await fetch(maskUrl);
          const buf=Buffer.from(await r.arrayBuffer());
          masks=[`data:image/png;base64,${buf.toString('base64')}`];
          console.log('[SEGMENT] RMBG-2.0 fallback succeeded');
        }
      }catch(rmbgErr){
        console.error('[SEGMENT] RMBG-2.0 also failed:',rmbgErr.message);
      }
    }

    if(!masks||masks.length===0){
      return res.status(500).json({success:false,error:'No objects detected. Try a clearer thumbnail.',code:'API_FAILURE'});
    }

    res.json({success:true,masks});
  }catch(err){
    console.error('[SEGMENT] Error:',err.message);
    res.status(500).json({success:false,error:`Segmentation failed: ${err.message}`,code:'API_FAILURE'});
  }
});

app.post('/api/analyze-face', (req, res) => {
  res.json({ faces: [{ x: 100, y: 50, w: 120, h: 120, score: 92 }] });
});

// ── AI Expression Enhancement — SD Inpainting via Replicate ───────────────────
app.post('/api/enhance-expression', flexAuthMiddleware, async(req,res)=>{
  try{
    const{faceCrop,mask,instruction}=req.body;
    if(!faceCrop||!faceCrop.startsWith('data:image/')||!mask||!instruction){
      return res.status(400).json({success:false,error:'Missing faceCrop, mask, or instruction',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok){
      return res.status(429).json({success:false,error:quota.message,code:quota.code});
    }

    const PROMPTS={
      'open mouth more':      'photorealistic portrait, same person, open mouth wide smile, excited energetic expression, sharp focus, high quality',
      'raise eyebrows':       'photorealistic portrait, same person, raised eyebrows, shocked surprised expression, wide eyes, high quality',
      'open eyes wider':      'photorealistic portrait, same person, wide open eyes, shocked surprised energetic expression, high quality',
      'excited expression':   'photorealistic portrait, same person, big smile open mouth raised eyebrows wide eyes, ultra excited expression, high quality',
      'shocked expression':   'photorealistic portrait, same person, shocked open mouth wide eyes raised eyebrows, surprised expression, high quality',
    };
    const prompt=PROMPTS[instruction]||`photorealistic portrait, same person, ${instruction}, high quality`;

    console.log(`[ENHANCE-EXPR] Running SD inpainting: "${instruction}"`);
    const output=await replicate.run('stability-ai/stable-diffusion-inpainting',{
      input:{
        prompt,
        negative_prompt:'blurry, low quality, cartoon, anime, painting, distorted face, ugly, bad anatomy, extra limbs',
        image:faceCrop,
        mask,
        num_inference_steps:20,
        guidance_scale:7.5,
        strength:0.8,
      },
    });

    const imageUrl=Array.isArray(output)?output[0]:output;
    if(!imageUrl) throw new Error('No image returned from model');

    const r=await fetch(imageUrl);
    const buf=Buffer.from(await r.arrayBuffer());
    res.json({success:true,image:`data:image/png;base64,${buf.toString('base64')}`});
  }catch(err){
    console.error('[ENHANCE-EXPR] Error:',err.message);
    res.status(500).json({success:false,error:`Enhancement failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Niche Profiles — Feature J ────────────────────────────────────────────────
const NICHE_PROFILES = {
  gaming: {
    label:'Gaming', emoji:'🎮',
    promptContext:'YouTube gaming channel. Audience is 13-34 male gamers who respond to high-energy reactions, intense competitive moments, shock/hype expressions, bold neon colors, and immediate visual excitement. Reference gaming terminology naturally.',
    defaultColorGrade:'neon',
    defaultBgHint:'dramatic gaming setup, RGB lighting, dark room with glowing monitors, epic gaming moment, no people',
    ctrWeights:{ face_prominence:1.2, text_readability:1.1, color_contrast:1.2, emotional_intensity:1.3, composition:0.9, niche_relevance:1.0 },
  },
  tech: {
    label:'Tech', emoji:'💻',
    promptContext:'YouTube tech channel covering reviews, tutorials, and product deep-dives. Audience values clarity, product close-ups, authoritative confident expressions, and clean modern aesthetics. Avoid hype language — prefer precision.',
    defaultColorGrade:'cool',
    defaultBgHint:'minimal tech workspace, clean desk, soft ambient lighting, modern electronics, subtle gradient, no people',
    ctrWeights:{ face_prominence:1.0, text_readability:1.2, color_contrast:1.0, emotional_intensity:0.9, composition:1.3, niche_relevance:1.2 },
  },
  vlog: {
    label:'Vlog', emoji:'🎥',
    promptContext:'YouTube lifestyle and vlog channel. Audience connects through authentic personal moments, genuine expressions, real locations, and story-driven emotional beats. Relatability beats perfection here.',
    defaultColorGrade:'warm',
    defaultBgHint:'lifestyle photography backdrop, natural outdoor setting, golden hour lighting, relatable everyday scene, no people',
    ctrWeights:{ face_prominence:1.4, text_readability:0.9, color_contrast:0.9, emotional_intensity:1.2, composition:1.1, niche_relevance:1.0 },
  },
  cooking: {
    label:'Cooking', emoji:'🍳',
    promptContext:'YouTube cooking and food channel. Audience responds to appetite-triggering visuals, delicious-looking results, creator reactions to tasting, and clear recipe outcomes. Warm tones and rich food colors are critical.',
    defaultColorGrade:'warm',
    defaultBgHint:'professional kitchen backdrop, warm ambient lighting, fresh colorful ingredients, steam rising from dish, vibrant food colors, no people',
    ctrWeights:{ face_prominence:0.9, text_readability:1.1, color_contrast:1.1, emotional_intensity:1.0, composition:1.2, niche_relevance:1.3 },
  },
  fitness: {
    label:'Fitness', emoji:'💪',
    promptContext:'YouTube fitness and workout channel. Audience responds to transformation results, intense training moments, aspirational physique goals, and motivational high-contrast imagery. Dramatic lighting and strong silhouettes work well.',
    defaultColorGrade:'cinematic',
    defaultBgHint:'modern gym backdrop, dramatic directional lighting, barbells and equipment, motivational atmosphere, strong contrast, no people',
    ctrWeights:{ face_prominence:1.2, text_readability:1.0, color_contrast:1.1, emotional_intensity:1.3, composition:1.0, niche_relevance:1.2 },
  },
  education: {
    label:'Education', emoji:'📚',
    promptContext:'YouTube educational and explainer channel. Audience values trustworthiness, clarity, immediate understanding of what they will learn, and credibility signals. Clean compositions with clear visual hierarchy outperform busy designs.',
    defaultColorGrade:'default',
    defaultBgHint:'clean academic setting, soft natural light, organized desk workspace, professional atmosphere, subtle books or whiteboards, no people',
    ctrWeights:{ face_prominence:1.0, text_readability:1.4, color_contrast:1.0, emotional_intensity:0.8, composition:1.2, niche_relevance:1.2 },
  },
};

function getUserNiche(email){
  const users=loadUsers();
  return users[email]?.niche||null;
}

function getNicheProfile(email){
  const niche=getUserNiche(email);
  return niche ? {niche, profile:NICHE_PROFILES[niche]||null} : {niche:null, profile:null};
}

// ── Niche Set/Get Endpoints ───────────────────────────────────────────────────
app.get('/api/get-niche', flexAuthMiddleware, (req,res)=>{
  const {niche,profile}=getNicheProfile(req.user.email);
  res.json({success:true, niche, profile, nicheSet:!!niche});
});

app.post('/api/set-niche', flexAuthMiddleware, (req,res)=>{
  const {niche}=req.body;
  if(!niche||!NICHE_PROFILES[niche]){
    return res.status(400).json({success:false,error:'Invalid niche. Must be one of: '+Object.keys(NICHE_PROFILES).join(', '),code:'INVALID_INPUT'});
  }
  const users=loadUsers();
  if(!users[req.user.email]) return res.status(404).json({success:false,error:'User not found',code:'NOT_FOUND'});
  users[req.user.email].niche=niche;
  saveUsers(users);
  console.log(`[NICHE] ${req.user.email} set niche to "${niche}"`);
  res.json({success:true, niche, profile:NICHE_PROFILES[niche]});
});

// ── AI Text Engine — Claude Vision API ────────────────────────────────────────
app.post('/api/generate-text', flexAuthMiddleware, async(req,res)=>{
  try{
    const{title,niche,image}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok){
      return res.status(429).json({success:false,error:quota.message,code:quota.code});
    }

    const[,rest]=image.split(',');
    const media_type=image.startsWith('data:image/png')?'image/png':'image/jpeg';

    // Niche context injection — Feature J
    const {niche:storedNiche,profile:nicheProfile}=getNicheProfile(req.user.email);
    const effectiveNiche=niche||storedNiche||'general';
    const nicheCtx=nicheProfile?`\nChannel context: ${nicheProfile.promptContext}`:'';

    const prompt=`You are a YouTube thumbnail headline expert. Analyze this thumbnail${title?` for a video titled "${title}"`:''}${effectiveNiche&&effectiveNiche!=='general'?` in the ${effectiveNiche} niche`:''}${nicheCtx}.

Generate 5 punchy, click-worthy text overlays calibrated to this niche. For each, analyze the image to find the best high-contrast placement zone — avoid faces, busy detail areas, and any text already visible.

Return ONLY a valid JSON array — no markdown, no extra text — in exactly this shape:
[
  {
    "text": "<max 4 words, ALL CAPS, punchy and niche-specific>",
    "x": <0-100, percent from left edge of image>,
    "y": <0-100, percent from top edge of image>,
    "color": "<'light' or 'dark' — which gives better contrast at this zone>",
    "strokeWidth": <0-12 integer — heavier for busier backgrounds>,
    "fontFamily": "<'Anton' or 'Bebas Neue' or 'Oswald'>",
    "fontSize": <36-80 integer, relative to 1280x720 canvas>
  }
]

Rules:
- text: ALL CAPS always, max 4 words, high-energy click-bait phrasing for the niche, never generic
- x/y: exact percent positions identifying a clean region of the actual image
- color: 'light' = white text on dark zone, 'dark' = dark text on light zone
- strokeWidth: 0 for very clean zones, 4-6 for medium, 8-12 for busy
- fontFamily: Anton for blocky bold MrBeast energy, Bebas Neue for sleek cinematic, Oswald for clean editorial
- fontSize: 60-80 for 1-2 word punchy phrases, 42-58 for 3-4 word phrases
- Vary positions across the 5 options — top, bottom, left, right, corners — so they suit different layouts
- Make each text option meaningfully different in wording and energy level
Output only the JSON array.`;

    console.log(`[AITEXT] Generating headlines for ${req.user.email}${title?` — "${title}"`:''}${niche?` [${niche}]`:''}`);
    const response=await anthropic.messages.create({
      model:'claude-opus-4-20250514',
      max_tokens:800,
      messages:[{
        role:'user',
        content:[
          {type:'image',source:{type:'base64',media_type,data:rest}},
          {type:'text',text:prompt},
        ],
      }],
    });

    const raw=response.content[0]?.text?.trim()||'';
    let options;
    try{
      const start=raw.indexOf('[');
      const end=raw.lastIndexOf(']');
      options=JSON.parse(raw.slice(start,end+1));
    }catch(e){
      console.error('[AITEXT] JSON parse failed:',raw.slice(0,300));
      throw new Error('Could not parse Claude response as JSON');
    }

    // Sanitize each option
    options=options.slice(0,5).map(o=>({
      text:   String(o.text||'HEADLINE').toUpperCase().slice(0,40),
      x:      Math.max(0,Math.min(100,Number(o.x)||10)),
      y:      Math.max(0,Math.min(100,Number(o.y)||10)),
      color:  o.color==='dark'?'dark':'light',
      strokeWidth: Math.max(0,Math.min(12,Math.round(Number(o.strokeWidth)||0))),
      fontFamily: ['Anton','Bebas Neue','Oswald'].includes(o.fontFamily)?o.fontFamily:'Anton',
      fontSize:   Math.max(36,Math.min(80,Math.round(Number(o.fontSize)||60))),
    }));

    res.json({success:true,options,remaining:quota.remaining});
  }catch(err){
    console.error('[AITEXT] Error:',err.message);
    res.status(500).json({success:false,error:`Text generation failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Composition AI — Claude Vision API ────────────────────────────────────────
app.post('/api/analyze-composition', flexAuthMiddleware, async(req,res)=>{
  try{
    const{image,title}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok){
      return res.status(429).json({success:false,error:quota.message,code:quota.code});
    }

    const[,rest]=image.split(',');
    const media_type=image.startsWith('data:image/png')?'image/png':'image/jpeg';

    // Niche context injection — Feature J
    const {niche:userNicheComp,profile:nicheProfileComp}=getNicheProfile(req.user.email);
    const nicheCtxComp=nicheProfileComp?` This is a ${nicheProfileComp.label} channel. ${nicheProfileComp.promptContext}`:'';

    const prompt=`You are a YouTube thumbnail composition expert. Analyze this thumbnail${title?` for the video titled "${title}"`:''}${nicheCtxComp}.\n\nReturn ONLY valid JSON — no markdown, no explanation — in exactly this shape:\n{\n  "score": <integer 1-10>,\n  "face_placement": "<one sentence tip about face/subject positioning, or null if no face>",\n  "negative_space": "<one sentence assessment of empty/breathing room>",\n  "focal_point": "<one sentence about what the eye is drawn to first>",\n  "text_zones": [\n    {"label":"<short label>","x":<0-100 pct from left>,"y":<0-100 pct from top>,"w":<width pct>,"h":<height pct>}\n  ],\n  "crop_suggestion": {"x":<pct>,"y":<pct>,"w":<pct>,"h":<pct>},\n  "issues": [\n    "<actionable issue string>"\n  ]\n}\n\nRules:\n- score: 1=terrible, 10=perfect click-worthy composition\n- text_zones: mark 1-3 areas where text could go or already is (avoid busy regions, favour top/bottom thirds or beside subject). x/y/w/h in percent of image dimensions.\n- crop_suggestion: tightest crop that keeps the most important visual elements. If the full frame is already optimal, return {x:0,y:0,w:100,h:100}.\n- issues: 2-5 short, actionable problems. Example issues: "Subject is centered — move left to create tension", "Text clashes with background", "Too much dead space in bottom third", "Face is too small — zoom in", "Bright corner competes with subject".\n- Be honest and specific. Output only the JSON object.`;

    console.log(`[COMP] Analyzing composition for ${req.user.email}${title?` — "${title}"`:''}`)
    const response=await anthropic.messages.create({
      model:'claude-opus-4-20250514',
      max_tokens:900,
      messages:[{
        role:'user',
        content:[
          {type:'image',source:{type:'base64',media_type,data:rest}},
          {type:'text',text:prompt},
        ],
      }],
    });

    const raw=response.content[0]?.text?.trim()||'';
    let parsed;
    try{
      const jsonStart=raw.indexOf('{');
      const jsonEnd=raw.lastIndexOf('}');
      parsed=JSON.parse(raw.slice(jsonStart,jsonEnd+1));
    }catch(e){
      console.error('[COMP] JSON parse failed:',raw.slice(0,200));
      throw new Error('Could not parse Claude response as JSON');
    }

    const score=Math.max(1,Math.min(10,Math.round(Number(parsed.score)||5)));
    res.json({
      success:true,
      score,
      face_placement:parsed.face_placement||null,
      negative_space:parsed.negative_space||null,
      focal_point:parsed.focal_point||null,
      text_zones:Array.isArray(parsed.text_zones)?parsed.text_zones:[],
      crop_suggestion:parsed.crop_suggestion||{x:0,y:0,w:100,h:100},
      issues:Array.isArray(parsed.issues)?parsed.issues:[],
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[COMP] Error:',err.message);
    res.status(500).json({success:false,error:`Composition analysis failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── CTR Prediction Score v2 — Claude Vision API ───────────────────────────────
app.post('/api/ctr-score-v2', flexAuthMiddleware, async(req,res)=>{
  try{
    const{image,title,niche}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const[,imgBase64]=image.split(',');
    const media_type=image.startsWith('data:image/png')?'image/png':'image/jpeg';

    // Niche context + weight injection — Feature J
    const {niche:storedNicheCtr,profile:nicheProfileCtr}=getNicheProfile(req.user.email);
    const effectiveNicheCtr=niche||storedNicheCtr||'general';
    const nicheCtxCtr=nicheProfileCtr?`\n\nChannel context: This is a ${nicheProfileCtr.label} channel. ${nicheProfileCtr.promptContext}\nWeight these categories accordingly for this niche when scoring — a gaming thumbnail doesn't need perfect composition if the energy is extreme, while an education thumbnail must have outstanding text readability.`:'';

    const prompt=`You are a YouTube CTR expert with deep knowledge of what makes thumbnails click-worthy. Analyze this thumbnail${title?` for a video titled "${title}"`:''}${effectiveNicheCtr&&effectiveNicheCtr!=='general'?` in the ${effectiveNicheCtr} niche`:''}${nicheCtxCtr}.

Return ONLY valid JSON — no preamble, no markdown, no explanation — in this exact shape:
{
  "overall": <integer 0-100, overall CTR potential>,
  "predicted_ctr_low": <float, realistic lower-bound CTR % for YouTube, e.g. 3.5>,
  "predicted_ctr_high": <float, realistic upper-bound CTR %, e.g. 7.2>,
  "industry_avg": <float, typical CTR % for ${effectiveNicheCtr||'YouTube'} thumbnails, e.g. 3.1>,
  "categories": {
    "face_prominence":    { "score": <0-20>, "max": 20, "tip": "<specific tip referencing what you see>" },
    "text_readability":   { "score": <0-20>, "max": 20, "tip": "<specific tip referencing what you see>" },
    "color_contrast":     { "score": <0-15>, "max": 15, "tip": "<specific tip referencing what you see>" },
    "emotional_intensity":{ "score": <0-15>, "max": 15, "tip": "<specific tip referencing what you see>" },
    "composition":        { "score": <0-15>, "max": 15, "tip": "<specific tip referencing what you see>" },
    "niche_relevance":    { "score": <0-15>, "max": 15, "tip": "<specific tip referencing what you see>" }
  },
  "issues": ["<2-4 specific issues that hurt CTR — be concrete, reference what you see>"],
  "wins":   ["<1-3 things already working well — be specific>"]
}

Scoring rubric:
- face_prominence (0-20): Clear human face? Emotion visible at small size? Face large in frame?
- text_readability (0-20): Text large, bold, high-contrast, visible at 180×101px mobile size?
- color_contrast (0-15): Strong light/dark separation? Vivid, saturated colors? Stands out in a grid?
- emotional_intensity (0-15): Strong emotion, curiosity gap, or surprise conveyed?
- composition (0-15): Clear focal point? Rule of thirds? Not cluttered? Hierarchy obvious?
- niche_relevance (0-15): Does it immediately signal the topic to the target audience?

CTR benchmarks: avg YouTube 2-5%, good thumbnail 5-10%, excellent 10-15%.
Be honest, specific, and reference exactly what you observe in this image. Output only the JSON object.`;

    console.log(`[CTRV2] Scoring for ${req.user.email}${title?` — "${title}"`:''}${niche?` [${niche}]`:''}`);
    const response=await anthropic.messages.create({
      model:'claude-opus-4-20250514',
      max_tokens:900,
      messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type,data:imgBase64}},
        {type:'text',text:prompt},
      ]}],
    });

    const raw=response.content[0]?.text?.trim()||'';
    let parsed;
    try{
      const s=raw.indexOf('{'), e=raw.lastIndexOf('}');
      parsed=JSON.parse(raw.slice(s,e+1));
    }catch(err){
      console.error('[CTRV2] Parse failed:',raw.slice(0,200));
      throw new Error('Could not parse Claude response as JSON');
    }

    // Sanitize — apply niche weight adjustments — Feature J
    const cats=parsed.categories||{};
    const nw=nicheProfileCtr?.ctrWeights||{};
    const sanitizeCat=(key,max)=>{
      const raw=Math.max(0,Math.min(max,Math.round(Number(cats[key]?.score)||0)));
      const weight=nw[key]||1.0;
      const weighted=Math.max(0,Math.min(max,Math.round(raw*weight)));
      return{score:weighted, max, tip:String(cats[key]?.tip||'No tip available.').slice(0,200)};
    };
    // Recompute overall from weighted categories
    const weightedTotal=
      sanitizeCat('face_prominence',20).score+sanitizeCat('text_readability',20).score+
      sanitizeCat('color_contrast',15).score+sanitizeCat('emotional_intensity',15).score+
      sanitizeCat('composition',15).score+sanitizeCat('niche_relevance',15).score;
    const maxTotal=100;
    const weightedOverall=Math.round((weightedTotal/maxTotal)*100);

    res.json({
      success:true,
      overall:    Math.max(0,Math.min(100,nicheProfileCtr?weightedOverall:Math.round(Number(parsed.overall)||50))),
      predicted_ctr_low:  Math.round(Number(parsed.predicted_ctr_low||2)*10)/10,
      predicted_ctr_high: Math.round(Number(parsed.predicted_ctr_high||5)*10)/10,
      industry_avg:       Math.round(Number(parsed.industry_avg||3)*10)/10,
      categories:{
        face_prominence:    sanitizeCat('face_prominence',20),
        text_readability:   sanitizeCat('text_readability',20),
        color_contrast:     sanitizeCat('color_contrast',15),
        emotional_intensity:sanitizeCat('emotional_intensity',15),
        composition:        sanitizeCat('composition',15),
        niche_relevance:    sanitizeCat('niche_relevance',15),
      },
      issues: Array.isArray(parsed.issues)?parsed.issues.slice(0,5).map(s=>String(s).slice(0,120)):[],
      wins:   Array.isArray(parsed.wins)?parsed.wins.slice(0,4).map(s=>String(s).slice(0,120)):[],
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[CTRV2] Error:',err.message);
    res.status(500).json({success:false,error:`CTR analysis failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Automation Pipeline Orchestrator ─────────────────────────────────────────
app.post('/api/analyze-thumbnail', flexAuthMiddleware, async(req,res)=>{
  try{
    const{image,niche,videoTitle}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }

    // Gate: Pro+ only
    const users=loadUsers();
    const userRecord=users[req.user.email];
    const plan=userRecord?.plan||'free';
    if(plan==='free'||plan==='starter'){
      return res.status(403).json({
        success:false,
        error:'Auto-analyze requires a Pro plan. Upgrade to unlock the full automation pipeline.',
        code:'PLAN_REQUIRED',
        requiredPlan:'pro',
      });
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const[,imgBase64]=image.split(',');
    const imgBuf=Buffer.from(imgBase64,'base64');
    const media_type=image.startsWith('data:image/png')?'image/png':'image/jpeg';
    const effectiveNiche=niche||userRecord?.niche||'general';

    // ── Run analysis in parallel ──────────────────────────────────────────────
    const[colorResult,compositionResult,ctrResult]=await Promise.all([
      // 1. Sharp color analysis — local, instant
      (async()=>{
        try{
          const stats=await sharp(imgBuf).stats();
          const channels=stats.channels;
          const r=channels[0],g=channels[1],b=channels[2];
          const avgBrightness=Math.round((r.mean+g.mean+b.mean)/3);
          const stdDev=Math.round((r.stdev+g.stdev+b.stdev)/3);
          // Estimate saturation from max-min channel spread per pixel (approximate)
          const maxC=Math.max(r.mean,g.mean,b.mean);
          const minC=Math.min(r.mean,g.mean,b.mean);
          const saturation=maxC>0?Math.round(((maxC-minC)/maxC)*100):0;
          return{ok:true,brightness:avgBrightness,contrast:stdDev,saturation,r:Math.round(r.mean),g:Math.round(g.mean),b:Math.round(b.mean)};
        }catch(e){
          console.warn('[ANALYZE] Sharp color failed:',e.message);
          return{ok:false};
        }
      })(),

      // 2. Composition analysis — Claude Vision
      (async()=>{
        try{
          const compPrompt=`Analyze this YouTube thumbnail's composition. Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "focal_point": "<where the main subject is, e.g. 'center-left'>",
  "text_zones": ["<region with text>"],
  "issues": ["<specific issue 1>","<specific issue 2>"],
  "face_count": <integer, number of faces visible>,
  "face_size": "<small|medium|large|none>",
  "background_busyness": "<clean|moderate|busy>"
}`;
          const resp=await anthropic.messages.create({
            model:'claude-haiku-4-5-20251001',
            max_tokens:400,
            messages:[{role:'user',content:[
              {type:'image',source:{type:'base64',media_type,data:imgBase64}},
              {type:'text',text:compPrompt},
            ]}],
          });
          const raw=resp.content[0]?.text?.trim()||'';
          const s=raw.indexOf('{'),e=raw.lastIndexOf('}');
          return{ok:true,...JSON.parse(raw.slice(s,e+1))};
        }catch(e){
          console.warn('[ANALYZE] Composition failed:',e.message);
          return{ok:false};
        }
      })(),

      // 3. CTR quick score — Claude Vision
      (async()=>{
        try{
          const ctrPrompt=`Score this YouTube thumbnail's CTR potential${videoTitle?` for "${videoTitle}"`:''}${effectiveNiche&&effectiveNiche!=='general'?` in the ${effectiveNiche} niche`:''}.
Return ONLY valid JSON:
{
  "overall": <integer 0-100>,
  "text_readability": <integer 0-100>,
  "emotional_impact": <integer 0-100>,
  "color_pop": <integer 0-100>,
  "top_issue": "<the single most impactful thing to fix>"
}`;
          const resp=await anthropic.messages.create({
            model:'claude-haiku-4-5-20251001',
            max_tokens:200,
            messages:[{role:'user',content:[
              {type:'image',source:{type:'base64',media_type,data:imgBase64}},
              {type:'text',text:ctrPrompt},
            ]}],
          });
          const raw=resp.content[0]?.text?.trim()||'';
          const s=raw.indexOf('{'),e=raw.lastIndexOf('}');
          return{ok:true,...JSON.parse(raw.slice(s,e+1))};
        }catch(e){
          console.warn('[ANALYZE] CTR quick score failed:',e.message);
          return{ok:false};
        }
      })(),
    ]);

    // ── Build recommendations from combined results ────────────────────────────
    const recs=[];

    // Face / expression
    if(compositionResult.ok){
      if(compositionResult.face_count===0){
        recs.push({
          id:'add-face',
          priority:1,
          icon:'😮',
          title:'Add a Human Face',
          description:'Thumbnails with expressive human faces get 38% higher CTR on average. Consider adding your face or a reaction shot.',
          action:'segment',
          actionLabel:'Add Subject',
        });
      } else if(compositionResult.face_size==='small'){
        recs.push({
          id:'enlarge-face',
          priority:1,
          icon:'🔍',
          title:'Make the Face Bigger',
          description:'Your face is too small — viewers can\'t read the emotion at thumbnail size. Crop closer or scale up.',
          action:'resize-subject',
          actionLabel:'Resize Subject',
        });
      }
    }

    // Text readability
    if(ctrResult.ok&&ctrResult.text_readability<60){
      recs.push({
        id:'text-contrast',
        priority:2,
        icon:'✏️',
        title:'Boost Text Contrast',
        description:`Text readability scored ${ctrResult.text_readability}/100. Add a dark outline, shadow, or semi-transparent backing to make words pop.`,
        action:'improve-text',
        actionLabel:'Fix Text',
      });
    }

    // Color / brightness
    if(colorResult.ok){
      if(colorResult.brightness<60){
        recs.push({
          id:'brighten',
          priority:2,
          icon:'☀️',
          title:'Brighten the Thumbnail',
          description:`Average brightness is ${colorResult.brightness}/255 — too dark for mobile screens. Apply color grade to lift the overall exposure.`,
          action:'color-grade',
          actionParams:{preset:'default',intensity:70},
          actionLabel:'Auto Color Grade',
        });
      } else if(colorResult.saturation<25){
        recs.push({
          id:'saturate',
          priority:3,
          icon:'🎨',
          title:'Add Vibrant Color',
          description:'Colors look muted. Saturated thumbnails stand out in the feed. Apply the Neon or Warm color grade preset.',
          action:'color-grade',
          actionParams:{preset:'neon',intensity:60},
          actionLabel:'Apply Color Grade',
        });
      }
    }

    // Background busyness
    if(compositionResult.ok&&compositionResult.background_busyness==='busy'){
      recs.push({
        id:'clean-bg',
        priority:3,
        icon:'🧹',
        title:'Simplify the Background',
        description:'The background is cluttered and competing with your subject. Use Smart Cutout to separate subject and replace with a solid or gradient background.',
        action:'remove-bg',
        actionLabel:'Remove Background',
      });
    }

    // Top CTR issue from the model
    if(ctrResult.ok&&ctrResult.top_issue&&recs.length<4){
      recs.push({
        id:'ctr-top-issue',
        priority:recs.length+1,
        icon:'⚡',
        title:'Improve CTR Score',
        description:ctrResult.top_issue,
        action:'ctr-check',
        actionLabel:'Re-Score',
      });
    }

    // Always add expression enhancement if face present
    if(compositionResult.ok&&compositionResult.face_count>0&&recs.length<5){
      recs.push({
        id:'enhance-expression',
        priority:recs.length+1,
        icon:'😄',
        title:'Amplify the Expression',
        description:'Use AI expression enhancement to make the emotion more dramatic — open mouth, raised eyebrows, wider eyes.',
        action:'enhance-expression',
        actionLabel:'Enhance Expression',
      });
    }

    // Sort by priority, keep top 5
    recs.sort((a,b)=>a.priority-b.priority);
    const top5=recs.slice(0,5);

    console.log(`[ANALYZE] ${req.user.email} — ${top5.length} recs, CTR=${ctrResult.ok?ctrResult.overall:'?'}, brightness=${colorResult.ok?colorResult.brightness:'?'}`);

    res.json({
      success:true,
      recommendations:top5,
      metrics:{
        color:colorResult.ok?{brightness:colorResult.brightness,saturation:colorResult.saturation,contrast:colorResult.contrast}:null,
        composition:compositionResult.ok?{score:compositionResult.score,face_count:compositionResult.face_count,face_size:compositionResult.face_size,background_busyness:compositionResult.background_busyness}:null,
        ctr:ctrResult.ok?{overall:ctrResult.overall,text_readability:ctrResult.text_readability,emotional_impact:ctrResult.emotional_impact,color_pop:ctrResult.color_pop}:null,
      },
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[ANALYZE] Error:',err.message);
    res.status(500).json({success:false,error:`Analysis failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Auto Color Grade & Pop — Sharp pipelines ──────────────────────────────────
const COLOR_GRADE_PRESETS = {
  default: {
    gamma:    1.05,
    linear:   [1.15, -18],
    modulate: {brightness:1.04, saturation:1.28, hue:0},
    recomb:   null,
  },
  warm: {
    gamma:    1.10,
    linear:   [1.10, -10],
    modulate: {brightness:1.07, saturation:1.22, hue:10},
    recomb:   [[1.07,0.02,-0.04],[0.01,1.01,-0.01],[-0.05,0.01,0.94]],
  },
  cool: {
    gamma:    0.88,
    linear:   [1.28, -28],
    modulate: {brightness:0.97, saturation:1.18, hue:-14},
    recomb:   [[0.91,0.03,0.05],[0.01,1.00,0.02],[0.03,0.03,1.09]],
  },
  cinematic: {
    gamma:    0.82,
    linear:   [1.18, -22],
    modulate: {brightness:1.05, saturation:0.82, hue:-5},
    recomb:   [[1.03,-0.02,0.04],[0.00,0.97,0.01],[-0.04,0.06,1.04]],
  },
  neon: {
    gamma:    1.0,
    linear:   [1.14, -20],
    modulate: {brightness:1.01, saturation:1.80, hue:6},
    recomb:   [[1.06,-0.02,0.04],[-0.01,1.04,-0.01],[0.04,-0.02,1.09]],
  },
};

async function runColorGradePipeline(imageBuf, presetName, intensity){
  const pr=COLOR_GRADE_PRESETS[presetName]||COLOR_GRADE_PRESETS.default;
  const t=Math.max(0,Math.min(100,intensity))/100;

  // Lerp all params from neutral (identity) → full preset at t=1
  const gamma=1+(pr.gamma-1)*t;
  const [linA,linB]=pr.linear;
  const cA=1+(linA-1)*t;
  const cB=linB*t;
  const bMod=1+(pr.modulate.brightness-1)*t;
  const sMod=1+(pr.modulate.saturation-1)*t;
  const hMod=Math.round(pr.modulate.hue*t);

  let pipeline=sharp(imageBuf);

  // Gamma (S-curve shadow/highlight shaping)
  // Sharp 0.33+ requires gamma >= 1.0; skip the call for values below 1.0
  // (the linear + modulate steps still shape the tone for those presets)
  if(gamma>1.01) pipeline=pipeline.gamma(Math.min(3.0,gamma));

  // Levels (contrast + black point crush)
  pipeline=pipeline.linear(Math.max(0.4,Math.min(2.5,cA)),Math.round(cB));

  // Vibrance (saturation with colour bias via modulate)
  pipeline=pipeline.modulate({
    brightness:Math.max(0.5,Math.min(2.0,bMod)),
    saturation:Math.max(0.1,Math.min(3.5,sMod)),
    hue:hMod,
  });

  // Unsharp mask — only when intensity is meaningful
  if(t>0.15){
    pipeline=pipeline.sharpen({sigma:1.5, m1:0.5*t, m2:0.7*t});
  }

  // Colour matrix (warm/cool/cinematic tint)
  if(pr.recomb&&t>0.05){
    const id=[[1,0,0],[0,1,0],[0,0,1]];
    const lm=pr.recomb.map((row,i)=>row.map((v,j)=>id[i][j]+(v-id[i][j])*t));
    pipeline=pipeline.recomb(lm);
  }

  return pipeline.jpeg({quality:94}).toBuffer();
}

app.post('/api/color-grade', flexAuthMiddleware, async(req,res)=>{
  try{
    const{image,preset='default',intensity=80}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }
    if(!COLOR_GRADE_PRESETS[preset]){
      return res.status(400).json({success:false,error:`Unknown preset: ${preset}`,code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const[,imgBase64]=image.split(',');
    const imageBuf=Buffer.from(imgBase64,'base64');

    console.log(`[COLORGRADE] ${preset} @ ${intensity}% for ${req.user.email}`);
    const outBuf=await runColorGradePipeline(imageBuf,preset,intensity);

    res.json({
      success:true,
      image:`data:image/jpeg;base64,${outBuf.toString('base64')}`,
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[COLORGRADE] Error:',err.message);
    res.status(500).json({success:false,error:`Color grade failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── AI Background Generation & Swap ───────────────────────────────────────────
const NICHE_BG_PROMPTS = {
  gaming:    'neon-lit gaming arena with particle effects, dark atmospheric bokeh, dramatic RGB lighting, no people, no text',
  vlog:      'clean soft lifestyle background, warm bokeh, bright and airy, natural window light, minimal, no people, no text',
  tech:      'dark minimal workspace background, subtle circuit texture, cool-toned depth of field, dark background, no people, no text',
  cooking:   'warm kitchen bokeh background, soft natural light, steam atmosphere, wood and marble surfaces, cozy, no people, no text',
  fitness:   'gym with dramatic lighting, high contrast, motivational dark energy, weight equipment, no people, no text',
  education: 'clean bright whiteboard aesthetic, soft academic warmth, library shelves, open airy light, no people, no text',
};

app.post('/api/generate-background', flexAuthMiddleware, async(req,res)=>{
  try{
    const{niche,customPrompt,subject,intensity=100}=req.body;
    if(!niche&&!customPrompt){
      return res.status(400).json({success:false,error:'Provide a niche or custom prompt',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    // Niche context injection — Feature J: use stored niche hint when no explicit niche provided
    const {profile:bgNicheProfile}=getNicheProfile(req.user.email);
    const nicheBase=NICHE_BG_PROMPTS[niche]||(bgNicheProfile?.defaultBgHint)||'';
    const custom=customPrompt?.trim()||'';
    const fullPrompt=`YouTube thumbnail background: ${[nicheBase,custom].filter(Boolean).join(', ')}. Cinematic, high quality, no watermarks, no logos, no text overlays, no UI elements.`;

    console.log(`[BGGEN] Generating for ${req.user.email} — niche: ${niche||'stored'||'custom'}`);
    // Use multi-provider fallback pipeline
    let bgImageUrl;
    const bgProviders = [
      { name: 'dall-e-3',       fn: () => generateWithDallE3(fullPrompt, '1792x1024', 'vivid') },
      { name: 'replicate-flux', fn: () => generateWithReplicateFlux(fullPrompt) },
      { name: 'replicate-sdxl', fn: () => generateWithReplicateSDXL(fullPrompt) },
    ];
    for (const p of bgProviders) {
      try {
        console.log(`[BGGEN] Trying ${p.name}...`);
        const result = await p.fn();
        bgImageUrl = result.imageUrl;
        console.log(`[BGGEN] ${p.name} succeeded`);
        break;
      } catch (e) {
        console.error(`[BGGEN] ${p.name} failed:`, e.message);
      }
    }
    if (!bgImageUrl) throw new Error('All background generation providers failed');

    const imgFetch=await fetch(bgImageUrl);
    let bgBuf=Buffer.from(await imgFetch.arrayBuffer());

    // Resize to YouTube thumbnail dimensions
    bgBuf=await sharp(bgBuf).resize(1280,720,{fit:'cover'}).jpeg({quality:93}).toBuffer();

    let finalBuf=bgBuf;

    // ── Composite subject if provided ──────────────────────────────────────
    if(subject&&subject.startsWith('data:image/')){
      const[,subBase64]=subject.split(',');
      const subBuf=Buffer.from(subBase64,'base64');

      // Analyse background warmth for lighting temperature match
      const bgStats=await sharp(bgBuf).stats();
      const[bgR,bgG,bgB]=bgStats.channels;
      const bgWarmth=(bgR.mean-bgB.mean)/255;
      const hueShift=Math.round(bgWarmth*18);

      // Feather edges: slight blur softens the mask boundary
      const featheredSubject=await sharp(subBuf)
        .ensureAlpha()
        .modulate({hue:hueShift})          // match lighting temperature
        .blur(0.8)                          // edge feathering
        .toBuffer();

      // Get subject dimensions to position it (right-center, natural thumbnail placement)
      const subMeta=await sharp(featheredSubject).metadata();
      const scale=Math.min(1,720/(subMeta.height||720));
      const scaledW=Math.round((subMeta.width||400)*scale);
      const scaledH=Math.round((subMeta.height||720)*scale);
      const resizedSubject=await sharp(featheredSubject)
        .resize(scaledW,scaledH,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}})
        .toBuffer();

      // Composite: left-of-center, bottom-anchored
      const left=Math.round(1280*0.05);
      const top=720-scaledH;
      finalBuf=await sharp(bgBuf)
        .composite([{input:resizedSubject,blend:'over',left:Math.max(0,left),top:Math.max(0,top)}])
        .jpeg({quality:93})
        .toBuffer();
    }

    res.json({
      success:true,
      image:`data:image/jpeg;base64,${finalBuf.toString('base64')}`,
      prompt:fullPrompt,
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[BGGEN] Error:',err.message);
    res.status(500).json({success:false,error:`Background generation failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Style Transfer — Sharp image processing ────────────────────────────────────
const STYLE_PRESETS = {
  mrbeast: {
    label:'MrBeast', mood:'Punchy & Viral',
    colors:['#f97316','#facc15','#ef4444','#22c55e','#0ea5e9'],
    modulate:{brightness:1.18,saturation:1.55,hue:8},
    linear:[1.28,-22],
  },
  mkbhd: {
    label:'MKBHD', mood:'Clean & Minimal',
    colors:['#0a0a0a','#18181b','#1d4ed8','#60a5fa','#f1f5f9'],
    modulate:{brightness:1.04,saturation:0.78,hue:-6},
    linear:[1.32,-18],
  },
  veritasium: {
    label:'Veritasium', mood:'Natural & Engaging',
    colors:['#1a3d2b','#2d6a4f','#52b788','#f4a261','#fefae0'],
    modulate:{brightness:1.06,saturation:1.18,hue:5},
    linear:[1.14,-8],
  },
  linus: {
    label:'Linus Tech Tips', mood:'Bright & Direct',
    colors:['#f8fafc','#e2e8f0','#3b82f6','#1d4ed8','#fbbf24'],
    modulate:{brightness:1.24,saturation:1.08,hue:0},
    linear:[1.08,-4],
  },
  markrober: {
    label:'Mark Rober', mood:'Vibrant & Bold',
    colors:['#1d4ed8','#ef4444','#f59e0b','#10b981','#7c3aed'],
    modulate:{brightness:1.10,saturation:1.42,hue:3},
    linear:[1.22,-14],
  },
};

function isSafeUrl(u){
  try{
    const p=new URL(u);
    if(p.protocol!=='https:') return false;
    const h=p.hostname.toLowerCase();
    if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(h)) return false;
    if(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    if(h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.localdomain')) return false;
    return true;
  }catch{return false;}
}

function getDominantColors(rawData, count){
  const freq={};
  for(let i=0;i<rawData.length;i+=3){
    const r=Math.round(rawData[i]/32)*32;
    const g=Math.round(rawData[i+1]/32)*32;
    const b=Math.round(rawData[i+2]/32)*32;
    const key=`${r},${g},${b}`;
    freq[key]=(freq[key]||0)+1;
  }
  return Object.entries(freq)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,count)
    .map(([k])=>{
      const [r,g,b]=k.split(',').map(Number);
      return '#'+[r,g,b].map(v=>Math.min(255,v).toString(16).padStart(2,'0')).join('');
    });
}

async function extractStyleMeta(buf){
  const stats=await sharp(buf).stats();
  const[rS,gS,bS]=stats.channels;
  const brightness=(0.299*rS.mean+0.587*gS.mean+0.114*bS.mean)/255;
  const maxCh=Math.max(rS.mean,gS.mean,bS.mean);
  const minCh=Math.min(rS.mean,gS.mean,bS.mean);
  const saturation=maxCh>8?(maxCh-minCh)/maxCh:0;
  const contrast=(rS.stdev+gS.stdev+bS.stdev)/(3*255);
  const warmth=(rS.mean-bS.mean)/255;

  const {data}=await sharp(buf).resize(60,60).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const colors=getDominantColors(data,5);

  let mood;
  if(brightness>0.62) mood=saturation>0.35?'Vivid & Bright':'Clean & Airy';
  else if(brightness<0.38) mood=saturation>0.28?'Dark & Moody':'Cinematic Dark';
  else mood=warmth>0.08?'Warm & Energetic':warmth<-0.08?'Cool & Minimal':'Natural & Balanced';

  return{brightness,saturation,contrast,warmth,colors,mood};
}

async function applyStylePipeline(imageBuf, modulate, linear, intensity){
  const t=Math.max(0,Math.min(100,intensity))/100;
  const bMod=1+(modulate.brightness-1)*t;
  const sMod=1+(modulate.saturation-1)*t;
  const hMod=(modulate.hue||0)*t;
  const [linA,linB]=linear;
  const cA=1+(linA-1)*t;
  const cB=linB*t;
  return sharp(imageBuf)
    .modulate({brightness:Math.max(0.4,Math.min(2.5,bMod)),saturation:Math.max(0.1,Math.min(3.5,sMod)),hue:hMod})
    .linear(Math.max(0.4,Math.min(2.5,cA)),Math.round(cB))
    .jpeg({quality:93})
    .toBuffer();
}

app.post('/api/style-transfer', flexAuthMiddleware, async(req,res)=>{
  try{
    const{image,preset,referenceUrl,intensity=75}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }
    if(!preset&&!referenceUrl){
      return res.status(400).json({success:false,error:'Provide a preset name or referenceUrl',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    const[,imgBase64]=image.split(',');
    const imageBuf=Buffer.from(imgBase64,'base64');

    let styleMeta, processedBuf;

    if(preset){
      // ── Preset mode ────────────────────────────────────────────────────
      const p=STYLE_PRESETS[preset];
      if(!p) return res.status(400).json({success:false,error:`Unknown preset: ${preset}`,code:'INVALID_INPUT'});

      processedBuf=await applyStylePipeline(imageBuf,p.modulate,p.linear,intensity);
      styleMeta={colors:p.colors,mood:p.mood,brightness:p.modulate.brightness,contrast:p.linear[0],saturation:p.modulate.saturation};
      console.log(`[STYLE] Preset "${preset}" applied for ${req.user.email} at intensity ${intensity}%`);
    } else {
      // ── URL mode ───────────────────────────────────────────────────────
      if(!isSafeUrl(referenceUrl)){
        return res.status(400).json({success:false,error:'Invalid or unsafe reference URL',code:'INVALID_INPUT'});
      }
      const refRes=await fetch(referenceUrl,{headers:{'User-Agent':'ThumbFrame/1.0'},timeout:8000});
      if(!refRes.ok) throw new Error(`Failed to fetch reference: ${refRes.status}`);
      const contentType=refRes.headers.get('content-type')||'';
      if(!contentType.startsWith('image/')) throw new Error('Reference URL is not an image');
      const refBuf=Buffer.from(await refRes.arrayBuffer());

      const meta=await extractStyleMeta(refBuf);

      // Convert extracted meta to pipeline params
      const brightnessMod=Math.max(0.6,Math.min(1.8,0.7+meta.brightness*0.8));
      const satMod=Math.max(0.4,Math.min(2.2,0.5+meta.saturation*1.8));
      const contrastA=Math.max(0.8,Math.min(1.8,1.0+meta.contrast*1.5));
      const contrastB=Math.round(-(60*meta.contrast));
      const hue=Math.round(meta.warmth*28);

      processedBuf=await applyStylePipeline(imageBuf,{brightness:brightnessMod,saturation:satMod,hue},[contrastA,contrastB],intensity);
      styleMeta={colors:meta.colors,mood:meta.mood,brightness:meta.brightness,contrast:meta.contrast,saturation:meta.saturation};
      console.log(`[STYLE] URL extraction applied for ${req.user.email} — mood: ${meta.mood}`);
    }

    res.json({
      success:true,
      processedImage:`data:image/jpeg;base64,${processedBuf.toString('base64')}`,
      style:styleMeta,
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[STYLE] Error:',err.message);
    res.status(500).json({success:false,error:`Style transfer failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── AI Variant Generator — Feature I ──────────────────────────────────────────
// Accepts variantType 1-5, returns one {base64,label,description} per call.
// Frontend calls all 5 in parallel for progressive card population.
app.post('/api/generate-variants', flexAuthMiddleware, async(req,res)=>{
  try{
    const{image,title='',niche='gaming',variantType}=req.body;
    if(!image||!image.startsWith('data:image/')){
      return res.status(400).json({success:false,error:'Missing or invalid image',code:'INVALID_INPUT'});
    }
    const vt=parseInt(variantType,10);
    if(!vt||vt<1||vt>5){
      return res.status(400).json({success:false,error:'variantType must be 1–5',code:'INVALID_INPUT'});
    }

    const quota=checkAndDecrementQuota(req.user.email);
    if(!quota.ok) return res.status(429).json({success:false,error:quota.message,code:quota.code});

    // Niche context — Feature J: use stored niche, allow body override
    const {niche:storedNicheVar,profile:nicheProfileVar}=getNicheProfile(req.user.email);
    const effectiveNicheVar=niche||storedNicheVar||'gaming';
    const nicheCtxVar=nicheProfileVar?nicheProfileVar.promptContext:'';

    const[,imgBase64]=image.split(',');
    const imageBuf=Buffer.from(imgBase64,'base64');
    const meta=await sharp(imageBuf).metadata();
    const W=meta.width||1280, H=meta.height||720;

    let outBuf, label, description;

    // ── Variant 1: Tight face crop (1.3×) + Default color grade ──────────────
    if(vt===1){
      const scale=1/1.3;
      const cw=Math.round(W*scale), ch=Math.round(H*scale);
      const cl=Math.round((W-cw)/2), ct=Math.round((H-ch)/2);
      const cropped=await sharp(imageBuf)
        .extract({left:Math.max(0,cl),top:Math.max(0,ct),width:Math.min(cw,W-cl),height:Math.min(ch,H-ct)})
        .resize(1280,720,{fit:'cover',position:'centre'})
        .jpeg({quality:93}).toBuffer();
      outBuf=await runColorGradePipeline(cropped,'default',85);
      label='Tight + Default';
      description='Cropped 1.3× toward center, default color grade for clean punch';
    }

    // ── Variant 2: Wide shot (0.85×) + Warm color grade ──────────────────────
    else if(vt===2){
      const sw=Math.round(1280*0.85), sh=Math.round(720*0.85);
      const pl=Math.round((1280-sw)/2), pt=Math.round((720-sh)/2);
      const scaled=await sharp(imageBuf).resize(sw,sh,{fit:'fill'}).jpeg({quality:93}).toBuffer();
      const canvas=await sharp({
        create:{width:1280,height:720,channels:3,background:{r:8,g:8,b:12}},
      }).composite([{input:scaled,left:pl,top:pt}]).jpeg({quality:93}).toBuffer();
      outBuf=await runColorGradePipeline(canvas,'warm',85);
      label='Wide + Warm';
      description='Zoomed out 0.85× revealing context, warm color grade';
    }

    // ── Variant 3: Original crop + Cool grade + Claude headline ──────────────
    else if(vt===3){
      const graded=await runColorGradePipeline(imageBuf,'cool',82);
      let headline=title?(title.toUpperCase().slice(0,36)):'WAIT FOR IT';
      try{
        const nicheHint=nicheCtxVar?` Channel type: ${effectiveNicheVar}. ${nicheCtxVar}`:'';
        const aiRes=await anthropic.messages.create({
          model:'claude-opus-4-5',max_tokens:60,
          messages:[{role:'user',content:`Write 1 punchy YouTube thumbnail headline in ALL CAPS, max 5 words, no punctuation except !, for the video: "${title}".${nicheHint} Output the headline only, nothing else.`}],
        });
        const raw=aiRes.content[0]?.text?.trim().toUpperCase().replace(/['"]/g,'').slice(0,36);
        if(raw) headline=raw;
      }catch(e){/* use fallback */}
      const safeText=headline.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><text x="56" y="660" font-size="88" font-family="Arial Black,Impact,sans-serif" font-weight="900" fill="#ffffff" stroke="#000000" stroke-width="7" stroke-linejoin="round" paint-order="stroke fill">${safeText}</text></svg>`;
      outBuf=await sharp(graded).composite([{input:Buffer.from(svg),blend:'over'}]).jpeg({quality:93}).toBuffer();
      label='Cool + New Text';
      description=`Cool grade, AI headline: "${headline}"`;
    }

    // ── Variant 4: Original + Cinematic grade + text repositioned right ───────
    else if(vt===4){
      const graded=await runColorGradePipeline(imageBuf,'cinematic',82);
      const safeText=(title||'WATCH THIS').toUpperCase().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0,36);
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><text x="1224" y="660" font-size="88" font-family="Arial Black,Impact,sans-serif" font-weight="900" text-anchor="end" fill="#ffffff" stroke="#000000" stroke-width="7" stroke-linejoin="round" paint-order="stroke fill">${safeText}</text></svg>`;
      outBuf=await sharp(graded).composite([{input:Buffer.from(svg),blend:'over'}]).jpeg({quality:93}).toBuffer();
      label='Cinematic + Right Text';
      description='Cinematic grade, title anchor shifted to right side';
    }

    // ── Variant 5: Original + Neon grade + AI background swap ────────────────
    else{
      const graded=await runColorGradePipeline(imageBuf,'neon',80);
      const nicheKey=(niche||'gaming').toLowerCase();
      const nicheBase=NICHE_BG_PROMPTS[nicheKey]||NICHE_BG_PROMPTS.gaming;
      const bgPrompt=`YouTube thumbnail background: ${nicheBase}. Cinematic, high quality, vibrant neon lighting, no watermarks, no logos, no text overlays.`;
      console.log(`[VARIANTS] Variant 5 — generating neon+background for ${req.user.email}`);
      // Use multi-provider fallback pipeline instead of raw openai call
      let bgUrl;
      const v5providers = [
        { name: 'dall-e-3',       fn: () => generateWithDallE3(bgPrompt, '1792x1024', 'vivid') },
        { name: 'replicate-flux', fn: () => generateWithReplicateFlux(bgPrompt) },
        { name: 'replicate-sdxl', fn: () => generateWithReplicateSDXL(bgPrompt) },
      ];
      for (const p of v5providers) {
        try {
          console.log(`[VARIANTS] Variant 5 trying ${p.name}...`);
          const result = await p.fn();
          bgUrl = result.imageUrl;
          console.log(`[VARIANTS] Variant 5 ${p.name} succeeded`);
          break;
        } catch (e) {
          console.error(`[VARIANTS] Variant 5 ${p.name} failed:`, e.message);
        }
      }
      if (!bgUrl) throw new Error('All background generation providers failed for Variant 5');
      const bgFetch=await fetch(bgUrl);
      let bgBuf=Buffer.from(await bgFetch.arrayBuffer());
      bgBuf=await sharp(bgBuf).resize(1280,720,{fit:'cover'}).jpeg({quality:93}).toBuffer();

      // Crop right 60% of original (subject area) and composite over new background
      const subjectLeft=Math.round(W*0.38);
      const subjectW=W-subjectLeft;
      const subjectCrop=await sharp(graded)
        .extract({left:subjectLeft,top:0,width:subjectW,height:H})
        .jpeg({quality:93}).toBuffer();
      outBuf=await sharp(bgBuf)
        .composite([{input:subjectCrop,left:1280-Math.round(1280*0.62),top:0,blend:'over'}])
        .jpeg({quality:93}).toBuffer();
      label='Neon + AI Background';
      description=`Neon grade, AI-generated ${nicheKey} background swap`;
    }

    console.log(`[VARIANTS] type=${vt} "${label}" — generated for ${req.user.email}`);
    res.json({
      success:true,
      variant:{
        base64:`data:image/jpeg;base64,${outBuf.toString('base64')}`,
        label,
        description,
      },
      remaining:quota.remaining,
    });
  }catch(err){
    console.error('[VARIANTS] Error:',err.message);
    res.status(500).json({success:false,error:`Variant generation failed: ${err.message}`,code:'API_FAILURE'});
  }
});

// ── Prompt-to-Thumbnail Engine ────────────────────────────────────────────────

// Helper: check Pro plan — checks users.json → JWT user_metadata → Supabase profiles (source of truth)
async function requirePro(req, res) {
  const email = req.user?.email;

  // 1. JWT user_metadata (fastest — already decoded by flexAuthMiddleware)
  if (req.user?.user_metadata?.is_pro === true) return false;

  // 2. In-memory store (fast, but ephemeral — wiped on Railway redeploy)
  const users = loadUsers();
  const localPlan = users[email]?.plan?.toLowerCase();
  if (localPlan === 'pro' || localPlan === 'agency') return false;

  // 3. Supabase profiles (authoritative source of truth — persists across restarts)
  if (supabase && email) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_pro, plan')
        .eq('email', email)
        .maybeSingle();
      if (data?.is_pro === true || data?.plan === 'pro' || data?.plan === 'agency') {
        // Cache in local store so next check is faster
        if (!users[email]) users[email] = { email };
        users[email].plan = 'pro';
        saveUsers(users);
        return false;
      }
    } catch(e) { /* non-fatal — fall through to deny */ }
  }

  res.status(403).json({
    success: false,
    error: 'This feature requires a Pro plan.',
    code: 'PLAN_REQUIRED',
    requiredPlan: 'pro',
  });
  return true; // blocked
}

// Helper: apply anti-slop Sharp steps to a buffer, return processed buffer
async function applyAntiSlopSteps(buf, steps) {
  // Expand 'all' shorthand
  const expanded = steps.flatMap(s =>
    s === 'all' ? ['highlight_recovery', 'depth_sharpen', 'chromatic_aberration', 'grain'] : [s]
  );

  let current = buf;

  for (const step of expanded) {
    if (step === 'grain') {
      const { data, info } = await sharp(current).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { width, height } = info;
      const out = Buffer.from(data);
      const strength = 8; // ±8 out of 255 ≈ 3%
      for (let i = 0; i < out.length; i += 4) {
        const n = Math.round((Math.random() - 0.5) * 2 * strength);
        out[i]     = Math.max(0, Math.min(255, out[i]     + n));
        out[i + 1] = Math.max(0, Math.min(255, out[i + 1] + n));
        out[i + 2] = Math.max(0, Math.min(255, out[i + 2] + n));
      }
      current = await sharp(out, { raw: { width, height, channels: 4 } })
        .removeAlpha().jpeg({ quality: 95 }).toBuffer();

    } else if (step === 'chromatic_aberration') {
      const { data, info } = await sharp(current).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { width, height } = info;
      const ch = 4;
      const out = Buffer.from(data);
      const offset = 1; // 1px channel offset
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * ch;
          const rSrcX = Math.max(0, x - offset);
          const bSrcX = Math.min(width - 1, x + offset);
          out[i]     = data[(y * width + rSrcX) * ch];       // R shifted right
          out[i + 2] = data[(y * width + bSrcX) * ch + 2];   // B shifted left
        }
      }
      current = await sharp(out, { raw: { width, height, channels: ch } })
        .removeAlpha().jpeg({ quality: 95 }).toBuffer();

    } else if (step === 'depth_sharpen') {
      current = await sharp(current)
        .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.5 })
        .jpeg({ quality: 95 }).toBuffer();

    } else if (step === 'highlight_recovery') {
      // Pull down brightest 5% of tonal range slightly
      current = await sharp(current)
        .modulate({ brightness: 0.97 })
        .jpeg({ quality: 95 }).toBuffer();
    }
  }

  return current;
}

// Niche calibration string for Claude injection
function buildNicheCalibration(niche) {
  const map = {
    gaming:    'Dark/neon backgrounds, electric colors (cyan/purple/yellow), dense composition. Font: Impact bold with stroke. Mood: high-energy, extreme, competitive.',
    tech:      'Minimal dark workspace, clean product shots, muted palette with breathing room. Font: Montserrat clean. Mood: curious, authoritative, precise.',
    vlog:      'Warm gradients, natural outdoor settings, golden hour. Font: friendly rounded. Mood: authentic, relatable, personal.',
    education: 'Clean bright setting, professional desk/whiteboard. Font: professional sans-serif. Mood: confident, trustworthy, clear.',
    cooking:   'Warm kitchen tones, vibrant food colors, natural light feel. Font: warm serif or clean sans. Mood: appetizing, inviting.',
    fitness:   'Dramatic gym lighting, strong contrast, bold silhouettes. Font: bold condensed. Mood: intense, aspirational, motivational.',
  };
  return map[niche] ? `NICHE: ${niche}. Style: ${map[niche]}` : 'General YouTube thumbnail — clean, high-contrast, attention-grabbing.';
}

// POST /api/thumbnail/prompt-plan
// Claude decomposes a prompt into compositable components
app.post('/api/thumbnail/prompt-plan', flexAuthMiddleware, async (req, res) => {
  try {
    if (await requirePro(req, res)) return;

    const { prompt, niche, hasSubjectPhoto = false } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ success: false, error: 'prompt required', code: 'INVALID_INPUT' });

    // Decrement quota for the Claude call
    const quota = checkAndDecrementQuota(req.user.email);
    if (!quota.ok) return res.status(429).json({ success: false, error: quota.message, code: quota.code });

    // Resolve niche from stored profile if not provided
    const effectiveNiche = niche || getUserNiche(req.user.email) || 'general';
    const nicheCalibration = buildNicheCalibration(effectiveNiche);

    const systemPrompt = `You are a YouTube thumbnail composition planner. Break the user's thumbnail description into individual visual components that will be generated separately and composited as layers.

STRICT RULES:
1. If prompt mentions a person/face/human/creator/me/I: add ONE component with type "photo_required" — NEVER generate a person
2. NEVER put text/words/titles in any "generate" or "asset_or_generate" prompts — always use "text_layer" type
3. Keep background generation prompts cinematic, atmospheric, no people, no text
4. Props/objects: always "isolated on pure black background, no text, no watermarks" in the prompt
5. Backgrounds: always include "no people, no faces, no text, no logos, atmospheric lighting" in the prompt
6. Maximum 6 components total

${nicheCalibration}

Return ONLY valid JSON, no markdown, no explanation:
{
  "components": [
    {
      "id": "background",
      "type": "generate",
      "generationPrompt": "...",
      "position": "fill",
      "notes": "..."
    }
  ],
  "composition": {
    "layout": "subject_left_text_right",
    "colorMood": "dark_dramatic",
    "style": "MrBeast"
  }
}

Valid types: "generate" (backgrounds/scenes), "photo_required" (person — never generate), "asset_or_generate" (props/objects), "text_layer" (ALL text), "effect_layer" (vignette/rim light)
For text_layer, include "content" (the text string) and "style" ({ "font": "Impact", "fill": "#FFFFFF", "strokes": [{"color": "#000000", "width": 8}] })`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Create a YouTube thumbnail: ${prompt}` }],
    });

    const raw = message.content[0]?.text?.trim() || '';
    // Strip any markdown code fences
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let plan;
    try {
      plan = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[PROMPT-PLAN] JSON parse failed:', raw.slice(0, 200));
      return res.status(500).json({ success: false, error: 'Composition planning returned invalid JSON', code: 'PARSE_ERROR' });
    }

    console.log(`[PROMPT-PLAN] ${req.user.email} — ${plan.components?.length || 0} components, layout: ${plan.composition?.layout}`);
    res.json({ success: true, components: plan.components || [], composition: plan.composition || {}, niche: effectiveNiche, remaining: quota.remaining });

  } catch (err) {
    console.error('[PROMPT-PLAN] Error:', err.message);
    res.status(500).json({ success: false, error: `Prompt planning failed: ${err.message}`, code: 'API_FAILURE' });
  }
});

// POST /api/thumbnail/generate-component
// Generate a single component (background, prop, text, etc.)
app.post('/api/thumbnail/generate-component', flexAuthMiddleware, async (req, res) => {
  try {
    if (await requirePro(req, res)) return;

    const { type, generationPrompt, content, style } = req.body;
    if (!type) return res.status(400).json({ success: false, error: 'type required', code: 'INVALID_INPUT' });

    // text_layer and effect_layer don't need generation
    if (type === 'text_layer') {
      return res.json({ success: true, type, textContent: content || generationPrompt || '', style: style || {} });
    }
    if (type === 'effect_layer') {
      return res.json({ success: true, type, effectParams: { vignette: true, rimLight: false } });
    }
    if (type === 'photo_required') {
      return res.json({
        success: true,
        type,
        requiresUpload: true,
        instructions: 'Upload your photo for best results. AI-generated faces get 2-3× fewer clicks.',
      });
    }

    if (!generationPrompt?.trim()) {
      return res.status(400).json({ success: false, error: 'generationPrompt required for generate/asset types', code: 'INVALID_INPUT' });
    }

    // Decrement quota — this is a real generation call
    const quota = checkAndDecrementQuota(req.user.email);
    if (!quota.ok) return res.status(429).json({ success: false, error: quota.message, code: quota.code });

    let fullPrompt;
    let applyBlur = false;

    if (type === 'generate') {
      // Background — enforce no-people, atmospheric
      fullPrompt = `${generationPrompt}. No people, no faces, no text, no logos, no UI, atmospheric, cinematic lighting, high quality, photorealistic.`;
      applyBlur = true; // depth-of-field blur for backgrounds
    } else if (type === 'asset_or_generate') {
      // Prop/object — isolated on black
      fullPrompt = `${generationPrompt}, photorealistic, studio photography, isolated on pure black background, no text, no watermarks, clean product shot.`;
    } else if (type === 'generate_person') {
      // "Generate Anyway" path — Flux Pro, isolated person
      fullPrompt = `${generationPrompt}, single person, full body or torso, isolated on pure white background, no background clutter, photorealistic, professional photo.`;
    } else {
      fullPrompt = generationPrompt;
    }

    let imageUrl;

    // Provider pipeline: DALL-E 3 first, Flux fallback
    const providers = type === 'generate_person'
      ? [
          { name: 'replicate-flux', fn: () => generateWithReplicateFlux(fullPrompt) },
          { name: 'dall-e-3',       fn: () => generateWithDallE3(fullPrompt, '1024x1024', 'vivid') },
        ]
      : [
          { name: 'dall-e-3',       fn: () => generateWithDallE3(fullPrompt, type === 'generate' ? '1792x1024' : '1024x1024', 'vivid') },
          { name: 'replicate-flux', fn: () => generateWithReplicateFlux(fullPrompt) },
        ];

    for (const p of providers) {
      try {
        const result = await p.fn();
        imageUrl = result.imageUrl;
        break;
      } catch (e) {
        console.error(`[GEN-COMPONENT] ${p.name} failed:`, e.message);
      }
    }
    if (!imageUrl) throw new Error('All generation providers failed');

    // Fetch and process with Sharp
    const imgFetch = await fetch(imageUrl);
    let imgBuf = Buffer.from(await imgFetch.arrayBuffer());

    // Resize to YouTube thumbnail size (backgrounds full, assets bounded)
    if (type === 'generate') {
      imgBuf = await sharp(imgBuf).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 93 }).toBuffer();
      if (applyBlur) {
        imgBuf = await sharp(imgBuf).blur(1.5).jpeg({ quality: 93 }).toBuffer(); // depth-of-field
      }
    } else {
      imgBuf = await sharp(imgBuf).resize(600, 600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 93 }).toBuffer();
    }

    const imageBase64 = imgBuf.toString('base64');
    console.log(`[GEN-COMPONENT] ${req.user.email} — type: ${type}, size: ${Math.round(imageBase64.length / 1024)}KB`);
    res.json({ success: true, type, imageBase64, remaining: quota.remaining });

  } catch (err) {
    console.error('[GEN-COMPONENT] Error:', err.message);
    res.status(500).json({ success: false, error: `Component generation failed: ${err.message}`, code: 'API_FAILURE' });
  }
});

// POST /api/thumbnail/anti-slop-process
// Sharp pixel-level post-processing pipeline
app.post('/api/thumbnail/anti-slop-process', flexAuthMiddleware, async (req, res) => {
  try {
    if (await requirePro(req, res)) return;

    const { imageBase64, steps = ['all'] } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, error: 'imageBase64 required', code: 'INVALID_INPUT' });

    let buf = Buffer.from(imageBase64, 'base64');
    buf = await applyAntiSlopSteps(buf, steps);

    res.json({ success: true, processedImageBase64: buf.toString('base64') });

  } catch (err) {
    console.error('[ANTI-SLOP] Error:', err.message);
    res.status(500).json({ success: false, error: `Anti-slop processing failed: ${err.message}`, code: 'API_FAILURE' });
  }
});

// ── Feature L: Team Collaboration & Brand Kit (Expanded) ──────────────────

// Middleware: Agency plan required
function agencyMiddleware(req,res,next){
  const users=loadUsers();
  const user=users[req.user?.email];
  const isAgency=(user?.plan||'free').toLowerCase()==='agency'||user?.email==='kadengajkowski@gmail.com';
  if(!isAgency) return res.status(403).json({success:false,error:'Agency plan required',code:'AGENCY_REQUIRED'});
  next();
}

// POST /api/team/create
app.post('/api/team/create', flexAuthMiddleware, agencyMiddleware, (req,res)=>{
  const {name} = req.body;
  if(!name?.trim()) return res.status(400).json({success:false,error:'Team name required'});
  const teams=loadTeams();
  const teamId=uuidv4();
  teams[teamId]={
    teamId, name:name.trim(),
    owner:req.user.email,
    members:[{email:req.user.email, role:'owner', joinedAt:Date.now()}],
    projects:[],
    createdAt:Date.now(),
  };
  saveTeams(teams);
  // Store teamId on the user
  const users=loadUsers();
  if(users[req.user.email]) users[req.user.email].teamId=teamId;
  saveUsers(users);
  res.json({success:true, team:teams[teamId]});
});

// POST /api/team/invite
app.post('/api/team/invite', flexAuthMiddleware, agencyMiddleware, async(req,res)=>{
  const {teamId, inviteEmail} = req.body;
  if(!teamId||!inviteEmail) return res.status(400).json({success:false,error:'teamId and inviteEmail required'});
  const teams=loadTeams();
  const team=teams[teamId];
  if(!team) return res.status(404).json({success:false,error:'Team not found'});
  if(team.owner!==req.user.email&&!team.members.find(m=>m.email===req.user.email&&m.role==='admin')){
    return res.status(403).json({success:false,error:'Not authorized to invite'});
  }
  const inviteToken=uuidv4();
  if(!team.pendingInvites) team.pendingInvites=[];
  team.pendingInvites.push({email:inviteEmail, token:inviteToken, sentAt:Date.now()});
  saveTeams(teams);

  const frontendUrl=process.env.FRONTEND_URL||'https://www.thumbframe.com';
  const inviteUrl=`${frontendUrl}?team_invite=${inviteToken}&team=${teamId}`;
  try{
    await resend.emails.send({
      from:'ThumbFrame <noreply@thumbframe.com>',
      to:inviteEmail,
      subject:`You've been invited to join "${team.name}" on ThumbFrame`,
      html:`<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#f97316;margin-top:0">Join ${team.name}</h2>
        <p>${req.user.email} has invited you to collaborate on ThumbFrame.</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 28px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">Accept Invite</a>
        <p style="color:#666;font-size:12px">Link expires in 7 days.</p>
      </div>`,
    });
  }catch(emailErr){
    console.warn('[TEAM INVITE] Email send failed:',emailErr.message);
    // Don't fail — invite token was saved, user can share link manually
  }
  res.json({success:true, inviteUrl, teamId});
});

// GET /api/team/join?token=xxx&teamId=xxx
app.get('/api/team/join', flexAuthMiddleware, (req,res)=>{
  const {token, teamId} = req.query;
  if(!token||!teamId) return res.status(400).json({success:false,error:'Missing token or teamId'});
  const teams=loadTeams();
  const team=teams[teamId];
  if(!team) return res.status(404).json({success:false,error:'Team not found'});
  const invite=team.pendingInvites?.find(i=>i.token===token);
  if(!invite) return res.status(403).json({success:false,error:'Invalid or expired invite'});
  // Add member if not already in
  const already=team.members.find(m=>m.email===req.user.email);
  if(!already) team.members.push({email:req.user.email, role:'member', joinedAt:Date.now()});
  // Remove invite
  team.pendingInvites=team.pendingInvites.filter(i=>i.token!==token);
  saveTeams(teams);
  // Update user's teamId
  const users=loadUsers();
  if(users[req.user.email]) users[req.user.email].teamId=teamId;
  saveUsers(users);
  res.json({success:true, team});
});

// GET /api/team/me — get the user's current team
app.get('/api/team/me', flexAuthMiddleware, (req,res)=>{
  const users=loadUsers();
  const teamId=users[req.user.email]?.teamId;
  if(!teamId) return res.json({success:true, team:null});
  const teams=loadTeams();
  const team=teams[teamId]||null;
  res.json({success:true, team});
});

// GET /api/team/projects
app.get('/api/team/projects', flexAuthMiddleware, (req,res)=>{
  const users=loadUsers();
  const teamId=users[req.user.email]?.teamId;
  if(!teamId) return res.json({success:true, projects:[]});
  const designs=loadDesigns();
  const teams=loadTeams();
  const team=teams[teamId];
  if(!team) return res.json({success:true, projects:[]});
  const isMember=team.members.some(m=>m.email===req.user.email);
  if(!isMember) return res.status(403).json({success:false,error:'Not a team member'});
  const teamProjects=(team.projects||[]).map(pid=>designs[pid]).filter(Boolean);
  res.json({success:true, projects:teamProjects, team});
});

// POST /api/team/share-project — add an existing project to the team workspace
app.post('/api/team/share-project', flexAuthMiddleware, (req,res)=>{
  const {teamId, projectId} = req.body;
  if(!teamId||!projectId) return res.status(400).json({success:false,error:'teamId and projectId required'});
  const teams=loadTeams();
  const team=teams[teamId];
  if(!team) return res.status(404).json({success:false,error:'Team not found'});
  if(!team.projects.includes(projectId)) team.projects.push(projectId);
  saveTeams(teams);
  res.json({success:true});
});

// POST /api/comments/add
app.post('/api/comments/add', flexAuthMiddleware, (req,res)=>{
  const {projectId, x, y, text} = req.body;
  if(!projectId||x==null||y==null||!text?.trim()) return res.status(400).json({success:false,error:'projectId, x, y, text required'});
  const comments=loadComments();
  if(!comments[projectId]) comments[projectId]=[];
  const comment={
    id:uuidv4(),
    projectId,
    userId:req.user.email,
    x:parseFloat(x), y:parseFloat(y),
    text:text.trim(),
    timestamp:Date.now(),
    resolved:false,
    replies:[],
  };
  comments[projectId].push(comment);
  saveComments(comments);
  res.json({success:true, comment});
});

// GET /api/comments/:projectId
app.get('/api/comments/:projectId', flexAuthMiddleware, (req,res)=>{
  const comments=loadComments();
  res.json({success:true, comments:comments[req.params.projectId]||[]});
});

// PATCH /api/comments/:commentId/resolve
app.patch('/api/comments/:commentId/resolve', flexAuthMiddleware, (req,res)=>{
  const comments=loadComments();
  for(const projectId of Object.keys(comments)){
    const idx=comments[projectId].findIndex(c=>c.id===req.params.commentId);
    if(idx>=0){
      comments[projectId][idx].resolved=!comments[projectId][idx].resolved;
      saveComments(comments);
      return res.json({success:true, comment:comments[projectId][idx]});
    }
  }
  res.status(404).json({success:false,error:'Comment not found'});
});

// POST /api/comments/:commentId/reply
app.post('/api/comments/:commentId/reply', flexAuthMiddleware, (req,res)=>{
  const {text}=req.body;
  if(!text?.trim()) return res.status(400).json({success:false,error:'text required'});
  const comments=loadComments();
  for(const projectId of Object.keys(comments)){
    const idx=comments[projectId].findIndex(c=>c.id===req.params.commentId);
    if(idx>=0){
      const reply={id:uuidv4(), userId:req.user.email, text:text.trim(), timestamp:Date.now()};
      comments[projectId][idx].replies.push(reply);
      saveComments(comments);
      return res.json({success:true, reply});
    }
  }
  res.status(404).json({success:false,error:'Comment not found'});
});

// POST /api/projects/version — save a canvas snapshot
app.post('/api/projects/version', flexAuthMiddleware, (req,res)=>{
  const {projectId, label, canvasData} = req.body;
  if(!projectId||!canvasData) return res.status(400).json({success:false,error:'projectId and canvasData required'});
  const versions=loadVersions();
  if(!versions[projectId]) versions[projectId]=[];
  const version={
    id:uuidv4(),
    projectId,
    label:label||`Version ${versions[projectId].length+1}`,
    savedBy:req.user.email,
    timestamp:Date.now(),
    canvasData, // base64 or JSON snapshot
  };
  versions[projectId].push(version);
  // Keep last 20 versions per project
  if(versions[projectId].length>20) versions[projectId]=versions[projectId].slice(-20);
  saveVersions(versions);
  res.json({success:true, version:{...version, canvasData:undefined}}); // don't echo the big payload back
});

// GET /api/projects/:projectId/versions
app.get('/api/projects/:projectId/versions', flexAuthMiddleware, (req,res)=>{
  const versions=loadVersions();
  const list=(versions[req.params.projectId]||[]).map(v=>({...v, canvasData:undefined}));
  res.json({success:true, versions:list.reverse()}); // newest first
});

// GET /api/projects/:projectId/versions/:versionId — get full snapshot for restore
app.get('/api/projects/:projectId/versions/:versionId', flexAuthMiddleware, (req,res)=>{
  const versions=loadVersions();
  const v=(versions[req.params.projectId]||[]).find(v=>v.id===req.params.versionId);
  if(!v) return res.status(404).json({success:false,error:'Version not found'});
  res.json({success:true, version:v});
});

// PATCH /api/projects/:projectId/status
app.patch('/api/projects/:projectId/status', flexAuthMiddleware, (req,res)=>{
  const {status} = req.body;
  const VALID=['draft','review','approved'];
  if(!VALID.includes(status)) return res.status(400).json({success:false,error:'status must be draft, review, or approved'});
  const designs=loadDesigns();
  if(!designs[req.params.projectId]) return res.status(404).json({success:false,error:'Project not found'});
  designs[req.params.projectId].status=status;
  designs[req.params.projectId].statusUpdatedAt=Date.now();
  designs[req.params.projectId].statusUpdatedBy=req.user.email;
  saveDesigns(designs);
  res.json({success:true, status, projectId:req.params.projectId});
});

// ── Feature K: YouTube History Intelligence ────────────────────────────────

const {google} = require('googleapis');

function getOAuth2Client(){
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://thumbframe-api-production.up.railway.app/api/youtube/callback'
  );
}

// GET /api/youtube/auth — generate consent URL and redirect
app.get('/api/youtube/auth', flexAuthMiddleware, (req,res)=>{
  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    state: req.user.email, // pass email through so callback knows who to update
  });
  res.json({success:true, url});
});

// GET /api/youtube/callback — handle OAuth callback, store tokens
app.get('/api/youtube/callback', async(req,res)=>{
  const {code, state:email} = req.query;
  if(!code||!email) return res.status(400).send('Missing code or state');
  try{
    const oauth2 = getOAuth2Client();
    const {tokens} = await oauth2.getToken(code);
    const users = loadUsers();
    if(!users[email]) return res.status(404).send('User not found');
    users[email].ytTokens = tokens;
    saveUsers(users);
    // Redirect back to frontend with success flag
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.thumbframe.com';
    res.redirect(`${frontendUrl}?yt_connected=1`);
  }catch(err){
    console.error('[YT CALLBACK] Error:',err.message);
    res.status(500).send('OAuth failed: '+err.message);
  }
});

// GET /api/youtube/thumbnails — fetch last 50 videos with stats
app.get('/api/youtube/thumbnails', flexAuthMiddleware, async(req,res)=>{
  const users = loadUsers();
  const user  = users[req.user.email];
  if(!user?.ytTokens) return res.status(403).json({success:false, error:'YouTube not connected', code:'YT_NOT_CONNECTED'});

  try{
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials(user.ytTokens);

    // Auto-refresh: save updated tokens if they changed
    oauth2.on('tokens', (tokens)=>{
      if(tokens.refresh_token) user.ytTokens.refresh_token = tokens.refresh_token;
      user.ytTokens.access_token = tokens.access_token;
      users[req.user.email] = user;
      saveUsers(users);
    });

    const youtube   = google.youtube({version:'v3', auth:oauth2});
    const analytics = google.youtubeAnalytics({version:'v2', auth:oauth2});

    // Get channel id
    const chRes = await youtube.channels.list({part:'id,snippet', mine:true});
    const channel = chRes.data.items?.[0];
    if(!channel) return res.status(404).json({success:false, error:'No channel found'});

    const channelId    = channel.id;
    const channelTitle = channel.snippet?.title || '';
    const channelAvatar= channel.snippet?.thumbnails?.default?.url || '';

    // Get uploads playlist
    const detailRes  = await youtube.channels.list({part:'contentDetails', id:channelId});
    const uploadsId  = detailRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if(!uploadsId) return res.status(404).json({success:false, error:'No uploads playlist'});

    // Fetch up to 50 video IDs from uploads playlist
    const plRes = await youtube.playlistItems.list({
      part:'snippet', playlistId:uploadsId, maxResults:50,
    });
    const items    = plRes.data.items || [];
    const videoIds = items.map(i=>i.snippet?.resourceId?.videoId).filter(Boolean);
    if(!videoIds.length) return res.json({success:true, videos:[], channelTitle, channelAvatar});

    // Batch fetch snippet + statistics for all video IDs
    const statsRes = await youtube.videos.list({
      part:'snippet,statistics', id:videoIds.join(','),
    });
    const videoMap = {};
    for(const v of statsRes.data.items||[]){
      videoMap[v.id] = {
        id: v.id,
        title: v.snippet?.title||'',
        publishedAt: v.snippet?.publishedAt||'',
        thumbnailUrl: v.snippet?.thumbnails?.maxres?.url
          || v.snippet?.thumbnails?.high?.url
          || v.snippet?.thumbnails?.medium?.url
          || '',
        viewCount: parseInt(v.statistics?.viewCount||'0',10),
        likeCount: parseInt(v.statistics?.likeCount||'0',10),
        commentCount: parseInt(v.statistics?.commentCount||'0',10),
        ctr: null, // filled in from analytics below
        avgViewDuration: null,
      };
    }

    // Try fetching CTR from YouTube Analytics (may fail for newer channels)
    try{
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear()-1);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr   = new Date().toISOString().split('T')[0];
      const analyticsRes = await analytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startStr,
        endDate:   endStr,
        metrics:   'impressionClickThroughRate,averageViewDuration',
        dimensions:'video',
        maxResults: 50,
      });
      for(const row of analyticsRes.data.rows||[]){
        const [vidId, ctr, avgDur] = row;
        if(videoMap[vidId]){
          videoMap[vidId].ctr             = parseFloat((ctr*100).toFixed(2));
          videoMap[vidId].avgViewDuration = Math.round(avgDur);
        }
      }
    }catch(analyticsErr){
      console.warn('[YT THUMBNAILS] Analytics query failed (expected for some channels):',analyticsErr.message);
    }

    const videos = videoIds.map(id=>videoMap[id]).filter(Boolean);
    res.json({success:true, videos, channelTitle, channelAvatar});

  }catch(err){
    console.error('[YT THUMBNAILS] Error:',err.message);
    res.status(500).json({success:false, error:err.message, code:'YT_FETCH_FAILED'});
  }
});

// POST /api/youtube/analyze — send thumbnails + perf data to Claude, get insights
app.post('/api/youtube/analyze', flexAuthMiddleware, async(req,res)=>{
  const users = loadUsers();
  const user  = users[req.user.email];
  if(!user?.ytTokens) return res.status(403).json({success:false, error:'YouTube not connected', code:'YT_NOT_CONNECTED'});

  const quota = checkAndDecrementQuota(req.user.email);
  if(!quota.ok) return res.status(402).json({success:false, error:quota.message, code:quota.code});

  const {videos} = req.body;
  if(!videos?.length) return res.status(400).json({success:false, error:'No videos provided'});

  try{
    // Sort by CTR desc (nulls last) to weight analysis toward real data
    const sorted = [...videos].sort((a,b)=>{
      if(a.ctr==null&&b.ctr==null) return b.viewCount-a.viewCount;
      if(a.ctr==null) return 1;
      if(b.ctr==null) return -1;
      return b.ctr-a.ctr;
    });

    // Build thumbnail summary for Claude (no images — just URLs + stats)
    const videoSummary = sorted.slice(0,50).map((v,i)=>`${i+1}. "${v.title}"
   Views: ${v.viewCount.toLocaleString()} | CTR: ${v.ctr!=null?v.ctr+'%':'n/a'} | Avg watch: ${v.avgViewDuration!=null?v.avgViewDuration+'s':'n/a'}
   Thumbnail URL: ${v.thumbnailUrl}`).join('\n\n');

    const {niche:storedNiche, profile:nicheProfile} = getNicheProfile(req.user.email);
    const nicheCtx = nicheProfile ? `Channel niche: ${nicheProfile.label}. ${nicheProfile.promptContext}` : '';

    const prompt = `You are a YouTube thumbnail analyst. Analyze the following list of videos with their performance metrics and thumbnail URLs.

${nicheCtx}

VIDEO LIST (sorted by CTR desc):
${videoSummary}

Based on the thumbnail URLs and performance data, analyze patterns in visual style correlated with CTR and view count. Identify:
1. Face positioning patterns (left/right/center/no face) and their CTR correlation
2. Dominant color patterns (warm/cool/high-contrast/muted) and performance
3. Text presence, size, and color patterns vs engagement
4. Background complexity (busy/minimal/gradient/solid) vs CTR
5. Thumbnail composition patterns (close-up/wide/action shot) vs performance
6. Any channel-specific patterns unique to this creator's audience

Return a JSON array of insight objects. Each insight must have:
- "category": one of "face", "color", "text", "background", "composition", "channel"
- "headline": short punchy insight title (max 8 words)
- "detail": 1-2 sentence explanation with specific numbers/percentages if derivable
- "impact": "high", "medium", or "low"
- "recommendation": one concrete action the creator should take
- "applyDefault": optional object like {"colorGrade":"warm"} if a default can be auto-applied

Return ONLY valid JSON array, no markdown, no preamble.`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251001',
      max_tokens: 2048,
      messages: [{role:'user', content: prompt}],
    });

    let insights = [];
    const raw = response.content?.[0]?.text?.trim() || '[]';
    try{
      // Strip any markdown fences if present
      const cleaned = raw.replace(/^```(?:json)?\n?/,'').replace(/\n?```$/,'');
      insights = JSON.parse(cleaned);
    }catch(parseErr){
      console.error('[YT ANALYZE] JSON parse error:',parseErr.message,'raw:',raw.slice(0,200));
      insights = [{
        category:'channel',
        headline:'Analysis complete',
        detail:'Could not parse structured insights — check the raw response.',
        impact:'low',
        recommendation:'Try again with more video data.',
      }];
    }

    res.json({success:true, insights, remaining:quota.remaining});
  }catch(err){
    console.error('[YT ANALYZE] Error:',err.message);
    res.status(500).json({success:false, error:err.message, code:'ANALYZE_FAILED'});
  }
});

// ── Tier 3 Item 3: YouTube Search (Competitor Comparison) ─────────────────
// In-memory cache: { term → { data, ts } }
const ytSearchCache = new Map();

// GET /api/youtube/search?q=<term>&maxResults=10
app.get('/api/youtube/search', flexAuthMiddleware, async(req,res)=>{
  const users = loadUsers();
  const user  = users[req.user.email];
  const plan  = (user?.plan||'free').toLowerCase();
  if(plan!=='pro'&&plan!=='agency'&&!user?.is_admin){
    return res.status(403).json({success:false,error:'Pro or Agency plan required for Competitor Comparison.',code:'PLAN_REQUIRED'});
  }

  const q = (req.query.q||'').trim();
  if(!q) return res.status(400).json({success:false,error:'Missing search query'});
  const maxResults = Math.min(parseInt(req.query.maxResults||'10',10),10);

  // Check cache (1 hour TTL)
  const cacheKey = `${q}::${maxResults}`;
  const cached = ytSearchCache.get(cacheKey);
  if(cached && Date.now()-cached.ts < 3600000){
    return res.json({success:true,results:cached.data,fromCache:true});
  }

  const YT_KEY = process.env.YOUTUBE_DATA_API_KEY || process.env.GOOGLE_API_KEY || process.env.YOUTUBE_API_KEY;
  if(!YT_KEY) return res.status(500).json({success:false,error:'YouTube API key not configured'});

  try{
    // Step 1: search.list
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(q)}&key=${YT_KEY}`;
    const searchRes = await fetch(searchUrl);
    if(!searchRes.ok){
      const errText = await searchRes.text();
      console.error('[YT SEARCH] search.list error:',searchRes.status,errText.slice(0,300));
      return res.status(502).json({success:false,error:'YouTube search failed'});
    }
    const searchData = await searchRes.json();
    const items = searchData.items||[];
    if(!items.length) return res.json({success:true,results:[]});

    const videoIds = items.map(i=>i.id?.videoId).filter(Boolean);

    // Step 2: videos.list for statistics
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(',')}&key=${YT_KEY}`;
    const statsRes = await fetch(statsUrl);
    const statsData = statsRes.ok ? await statsRes.json() : {items:[]};
    const statsMap = {};
    for(const v of statsData.items||[]){
      statsMap[v.id] = parseInt(v.statistics?.viewCount||'0',10);
    }

    const results = items.map(item=>{
      const vid = item.id?.videoId;
      const sn  = item.snippet||{};
      return {
        videoId:     vid,
        title:       sn.title||'',
        channelName: sn.channelTitle||'',
        thumbnailUrl:sn.thumbnails?.high?.url||sn.thumbnails?.medium?.url||sn.thumbnails?.default?.url||'',
        viewCount:   statsMap[vid]||0,
        publishedAt: sn.publishedAt||'',
      };
    }).filter(r=>r.videoId);

    // Store in cache
    ytSearchCache.set(cacheKey,{data:results,ts:Date.now()});

    res.json({success:true,results});
  }catch(err){
    console.error('[YT SEARCH] Error:',err.message);
    res.status(500).json({success:false,error:err.message});
  }
});

// POST /api/analyze-competition — Claude Vision competitive analysis
app.post('/api/analyze-competition', flexAuthMiddleware, async(req,res)=>{
  const quota = checkAndDecrementQuota(req.user.email);
  if(!quota.ok) return res.status(402).json({success:false,error:quota.message,code:quota.code});

  const {userThumbnailUrl, competitorThumbnails, searchTerm} = req.body;
  if(!userThumbnailUrl) return res.status(400).json({success:false,error:'Missing userThumbnailUrl'});

  try{
    const competitorList = (competitorThumbnails||[]).slice(0,10).map((c,i)=>
      `${i+1}. "${c.title}" by ${c.channelName} — ${c.viewCount!=null?`${(c.viewCount/1000).toFixed(0)}K views`:''}`
    ).join('\n');

    const base64 = userThumbnailUrl.includes(',') ? userThumbnailUrl.split(',')[1] : userThumbnailUrl;
    const mediaType = userThumbnailUrl.startsWith('data:') ? (userThumbnailUrl.split(';')[0].split(':')[1]||'image/jpeg') : 'image/jpeg';

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251001',
      max_tokens: 1024,
      messages:[{
        role:'user',
        content:[
          {
            type:'image',
            source:{type:'base64',media_type:mediaType,data:base64},
          },
          {
            type:'text',
            text:`You are a YouTube thumbnail strategist. The image above is a creator's thumbnail. They are competing in the "${searchTerm||'YouTube'}" space against these videos:\n\n${competitorList}\n\nAnalyze the creator's thumbnail vs. this competitive landscape. Give 4-6 bullet-point insights covering:\n- Visual differentiation (does it stand out?)\n- Color and contrast compared to typical thumbnails in this space\n- Text clarity and emotional hook\n- Face/subject positioning\n- Specific recommendations to improve CTR against these competitors\n\nRespond with ONLY bullet points (each starting with •), no headers, no preamble.`,
          },
        ],
      }],
    });

    const insights = response.content?.[0]?.text?.trim()||'No insights generated.';
    res.json({success:true,insights,remaining:quota.remaining});
  }catch(err){
    console.error('[ANALYZE-COMPETITION] Error:',err.message);
    res.status(500).json({success:false,error:err.message});
  }
});

// ── POST /api/newsletter/subscribe ────────────────────────────────────────────
app.post('/api/newsletter/subscribe', async(req,res)=>{
  const { email } = req.body;
  if(!email || !email.includes('@')) return res.status(400).json({success:false,error:'Invalid email'});

  const list = loadNewsletter();
  const norm = email.toLowerCase().trim();

  if(list.some(e => e.email === norm)){
    return res.json({success:true,message:'Already subscribed'});
  }

  list.push({ email: norm, subscribedAt: new Date().toISOString() });
  saveNewsletter(list);

  try{
    await resend.emails.send({
      from: 'ThumbFrame <onboarding@resend.dev>',
      to: norm,
      subject: "You're in — welcome to ThumbFrame",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#f4f4f5;background:#0a0a0a;padding:32px 24px;border-radius:12px">
        <div style="font-size:22px;font-weight:800;margin-bottom:8px">You're on the list. <span style="color:#f97316">✦</span></div>
        <p style="color:#a1a1aa;font-size:15px;line-height:1.6">
          Thanks for subscribing to the ThumbFrame newsletter. Every week we send thumbnail tips, new feature announcements, and creator resources straight to your inbox.
        </p>
        <p style="color:#a1a1aa;font-size:14px;margin-top:24px">
          In the meantime, <a href="https://thumbframe.com" style="color:#f97316;text-decoration:none">open the editor</a> and make your next thumbnail.
        </p>
        <hr style="border:none;border-top:1px solid #202020;margin:28px 0" />
        <p style="color:#52525b;font-size:12px">ThumbFrame · <a href="https://thumbframe.com/privacy" style="color:#52525b">Privacy</a></p>
      </div>`,
    });
  }catch(emailErr){
    console.error('[NEWSLETTER] Resend error:',emailErr.message);
  }

  res.json({success:true,message:'Subscribed'});
});

app.get('/api/ping', (req, res) => res.json({ pong: true, time: Date.now() }));

// ── ThumbFriend chat ───────────────────────────────────────────────────────────
// POST /api/thumbfriend/chat
// Body: { message, image (base64 JPEG, no data: prefix), canvasData, conversationHistory, personality }
// Returns: { message, actions, expression, remaining }

const THUMBFRIEND_SYSTEM_PROMPTS = {
  hype_coach: `You are ThumbFriend, a HIGH-ENERGY creative partner inside ThumbFrame — a YouTube thumbnail editor.
You are NOT Claude. You are ThumbFriend. NEVER break character.

PERSONALITY: Energetic, use CAPS for emphasis, push bold choices, celebrate wins, use exclamation points. Hype the creator up!

You can SEE the user's canvas. Give SPECIFIC, ACTIONABLE feedback.`,

  brutally_honest: `You are ThumbFriend, a brutally honest creative partner inside ThumbFrame — a YouTube thumbnail editor.
You are NOT Claude. You are ThumbFriend. Never break character.

PERSONALITY: Direct. No sugarcoating. Short sentences. Get to the point fast. Say what others won't.

You can see the user's canvas. Give specific, actionable feedback.`,

  chill_creative_director: `You are ThumbFriend, a calm creative partner inside ThumbFrame — a YouTube thumbnail editor.
You are NOT Claude. You are ThumbFriend. Never break character.

PERSONALITY: Calm, thoughtful. Use "we/let's". Give options not commands. Collaborative tone.

You can see the user's canvas. Give specific, actionable feedback.`,

  data_nerd: `You are ThumbFriend, a data-driven creative partner inside ThumbFrame — a YouTube thumbnail editor.
You are NOT Claude. You are ThumbFriend. Never break character.

PERSONALITY: Lead with numbers. Cite CTR research. Talk percentages. Be analytical.

You can see the user's canvas. Give specific, actionable feedback.`,

  the_legend: `You are ThumbFriend, a veteran creator mentor inside ThumbFrame — a YouTube thumbnail editor.
You are NOT Claude. You are ThumbFriend. Never break character.

PERSONALITY: Veteran creator vibe. Storytelling approach. Mentoring tone. "In my experience..."

You can see the user's canvas. Give specific, actionable feedback.`,
};

const THUMBFRIEND_SHARED_RULES = `
RULES:
1. Be specific — reference actual layer names, colors, positions you can see in the image
2. Max 3 suggestions at a time — don't overwhelm
3. If suggesting canvas changes, include them as JSON actions in your response
4. Keep responses conversational and concise — this is a chat, not an essay
5. Never suggest changing the video content itself — only what's editable in the editor
6. Use relative benchmarks ONLY — never promise exact CTR percentage increases
7. Never auto-apply anything — always let the user decide

CTR KNOWLEDGE:
- Optimal brightness: 100–110 on 0–255 scale
- Best color for CTR: cyan (+36% relative to average)
- Text: 0–2 words ideal (more text = lower CTR on average)
- Faces help on channels over 200K subs
- High contrast outperforms low contrast by ~15% on average
- Timestamp zone (bottom-right 100×24px) must stay clear

Respond with ONLY valid JSON in this exact format — no markdown, no code fences:
{
  "message": "your conversational response",
  "actions": [],
  "expression": "neutral",
  "memory_updates": []
}

Valid expression values: neutral, thinking, excited, concerned, working, proud

Action format (include in actions array when suggesting canvas changes):
{
  "type": "adjust_brightness|adjust_contrast|adjust_saturation|apply_color_grade|move_layer|resize_layer",
  "target": "layer id or name",
  "target_name": "human readable name",
  "params": {},
  "reason": "one sentence why this helps"
}`;

app.post('/api/thumbfriend/chat', flexAuthMiddleware, async(req, res) => {
  try {
    const { message, image, canvasData, conversationHistory = [], personality = 'chill_creative_director' } = req.body;

    if (!message) return res.status(400).json({ error: 'message is required' });

    // Check pro status (from Supabase user_metadata or profiles table)
    let isPro = false;
    if (supabase && req.user?.id) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('is_pro')
          .eq('id', req.user.id)
          .single();
        isPro = !!data?.is_pro;
      } catch { /* non-fatal — fall back to not-pro */ }
    }

    if (!isPro) {
      return res.status(403).json({ error: 'ThumbFriend requires a Pro subscription.' });
    }

    // Build system prompt
    const basePersonality = THUMBFRIEND_SYSTEM_PROMPTS[personality] || THUMBFRIEND_SYSTEM_PROMPTS.chill_creative_director;
    const systemPrompt = basePersonality + THUMBFRIEND_SHARED_RULES;

    // Build message history for Claude
    const isFirstTurn = conversationHistory.length === 0;
    const messages = [];

    // Add conversation history (text-only turns, no images)
    for (const h of conversationHistory) {
      messages.push({ role: h.role, content: h.content });
    }

    // Build current user message: image (if first turn) + text
    if (isFirstTurn && image) {
      // Image BEFORE text — Anthropic requirement
      messages.push({
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: image },
          },
          {
            type: 'text',
            text: `Canvas info: layers=${canvasData?.layerCount || 0}, hasText=${canvasData?.hasText}, brightness=${canvasData?.brightness}, textContent="${canvasData?.textContent || ''}".\n\n${message}`,
          },
        ],
      });
    } else {
      // Turns 2+: text description only (75% cost saving — no image)
      const ctx = canvasData
        ? ` [Canvas: ${canvasData.layerCount} layers, brightness ${canvasData.brightness}, text: "${canvasData.textContent || 'none'}"]`
        : '';
      messages.push({ role: 'user', content: message + ctx });
    }

    // Select model: Sonnet for Turn 1 (vision), Haiku for subsequent turns
    const model = isFirstTurn
      ? 'claude-sonnet-4-20250514'
      : 'claude-haiku-4-5-20250514';

    const claudeRes = await anthropic.messages.create({
      model,
      max_tokens: 600,
      system:     systemPrompt,
      messages,
    });

    const raw = claudeRes.content?.[0]?.text || '';

    // Parse JSON response from Claude
    let parsed = null;
    try {
      // Strip markdown fences if Claude added them despite instructions
      const clean = raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').trim();
      parsed = JSON.parse(clean);
    } catch {
      // Fallback: extract JSON object with regex
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
      }
    }

    if (!parsed) {
      // Claude didn't return valid JSON — wrap the raw text
      parsed = { message: raw.slice(0, 500), actions: [], expression: 'neutral' };
    }

    res.json({
      message:    parsed.message    || 'I had trouble formulating a response. Try again?',
      actions:    Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
      expression: parsed.expression || 'neutral',
      remaining:  null, // Pro = unlimited
    });

  } catch (err) {
    console.error('[THUMBFRIEND] Error:', err.message);
    res.status(500).json({ error: 'ThumbFriend is having trouble right now. Try again in a moment.' });
  }
});

// ── Phase 12-14: AI Generate, Background Remover, Asset Library ───────────────
try {
  const makeAiGenerateRoutes = require('./routes/aiGenerate.js');
  const makeRemoveBgRoutes   = require('./routes/removeBg.js');
  const makeAssetRoutes      = require('./routes/assets.js');
  app.use('/api/ai',        makeAiGenerateRoutes(supabase, flexAuthMiddleware));
  app.use('/api/remove-bg', makeRemoveBgRoutes(supabase, flexAuthMiddleware));
  app.use('/api/assets',    makeAssetRoutes(supabase, flexAuthMiddleware));
  console.log('[INIT] Phase 12-14 routes mounted: /api/ai, /api/remove-bg, /api/assets');
} catch (err) {
  console.error('[INIT] Failed to mount Phase 12-14 routes:', err.message);
}

// ── Phase 15: YouTube Integration ─────────────────────────────────────────────
try {
  const makeYouTubeRoutes = require('./routes/youtube.js');
  app.use('/api/youtube', makeYouTubeRoutes(supabase, flexAuthMiddleware));
  console.log('[INIT] Phase 15 routes mounted: /api/youtube');
} catch (err) {
  console.error('[INIT] Failed to mount Phase 15 YouTube routes:', err.message);
}

// ── Phase 18: Advanced AI (face enhance, auto-thumbnail, text suggest) ────────
try {
  const makeAiEnhanceRoutes      = require('./routes/aiEnhance.js');
  const makeAutoThumbnailRoutes  = require('./routes/autoThumbnail.js');
  const makeAiTextRoutes         = require('./routes/aiText.js');
  app.use('/api/ai', makeAiEnhanceRoutes(supabase, flexAuthMiddleware));
  app.use('/api/ai', makeAutoThumbnailRoutes(supabase, flexAuthMiddleware));
  app.use('/api/ai', makeAiTextRoutes(supabase, flexAuthMiddleware));
  console.log('[INIT] Phase 18 routes mounted: /api/ai/enhance-face, /api/ai/auto-thumbnail, /api/ai/suggest-text');
} catch (err) {
  console.error('[INIT] Failed to mount Phase 18 AI routes:', err.message);
}

// ── Phase 19: Growth + Monetization ───────────────────────────────────────────
try {
  const makeReferralRoutes  = require('./routes/referrals.js');
  const makeShowcaseRoutes  = require('./routes/showcase.js');
  app.use('/api/referrals', makeReferralRoutes(supabase, flexAuthMiddleware));
  app.use('/api/showcase',  makeShowcaseRoutes(supabase, flexAuthMiddleware));
  console.log('[INIT] Phase 19 routes mounted: /api/referrals, /api/showcase');
} catch (err) {
  console.error('[INIT] Failed to mount Phase 19 Growth routes:', err.message);
}

app.listen(PORT,'0.0.0.0',()=>console.log(`🚀 ThumbFrame API running on port ${PORT}`));
