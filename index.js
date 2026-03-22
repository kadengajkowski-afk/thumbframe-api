require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const Replicate  = require('replicate');
const { v4: uuidv4 } = require('uuid');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch      = require('node-fetch');
const FormData   = require('form-data');
const fs         = require('fs');
const path       = require('path');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const OpenAI     = require('openai');
const Anthropic  = require('@anthropic-ai/sdk');
const { Resend } = require('resend');

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'thumbframe-secret-2024';

const openai     = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend     = new Resend(process.env.RESEND_API_KEY);
const replicate  = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));

app.options('*', cors());
app.use('/webhook', express.raw({ type:'application/json' }));
app.use(express.json({ limit:'50mb' }));

// ── File storage ───────────────────────────────────────────────────────────────
const KEYS_FILE    = path.join(__dirname,'keys.json');
const USERS_FILE   = path.join(__dirname,'users.json');
const DESIGNS_FILE = path.join(__dirname,'designs.json');

function loadKeys(){ try{ return JSON.parse(fs.readFileSync(KEYS_FILE,'utf8')); }catch(e){ return {}; } }
function saveKeys(k){ fs.writeFileSync(KEYS_FILE,JSON.stringify(k,null,2)); }
function loadUsers(){ try{ return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); }catch(e){ return {}; } }
function saveUsers(u){ fs.writeFileSync(USERS_FILE,JSON.stringify(u,null,2)); }
function loadDesigns(){ try{ return JSON.parse(fs.readFileSync(DESIGNS_FILE,'utf8')); }catch(e){ return {}; } }
function saveDesigns(d){ fs.writeFileSync(DESIGNS_FILE,JSON.stringify(d,null,2)); }
function validateKey(key){ const keys=loadKeys(); return keys[key]||null; }

function authMiddleware(req,res,next){
  const token=req.headers['authorization']?.split(' ')[1];
  if(!token) return res.status(401).json({error:'No token'});
  try{ req.user=jwt.verify(token,JWT_SECRET); next(); }
  catch(e){ res.status(401).json({error:'Invalid token'}); }
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

app.post('/ai-generate', async(req,res)=>{
  try{
    const { prompt } = req.body;
    if(!prompt) return res.status(400).json({error:'No prompt'});
    console.log('DALL-E 3 generating:',prompt);
    const response = await openai.images.generate({
      model:   'dall-e-3',
      prompt:  `YouTube thumbnail background: ${prompt}. Dramatic lighting, high contrast, vivid colors, cinematic, no text, no watermarks, no logos.`,
      n:       1,
      size:    '1792x1024',
      quality: 'standard',
      style:   'vivid',
    });
    const imageUrl = response.data[0].url;
    const imgRes   = await fetch(imageUrl);
    const buffer   = Buffer.from(await imgRes.arrayBuffer());
    console.log('DALL-E success, size:',buffer.length);
    res.json({ image:`data:image/png;base64,${buffer.toString('base64')}` });
  }catch(err){
    console.error('DALL-E error:',err.message);
    res.status(500).json({error:`Generation failed: ${err.message}`});
  }
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
    const {imageUrl}=req.body;
    if(!imageUrl) return res.status(400).json({error:'No image'});
    let imageBuffer;
    if(imageUrl.startsWith('data:')){
      imageBuffer=Buffer.from(imageUrl.split(',')[1],'base64');
    }else{
      const r=await fetch(imageUrl);
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
    console.error('Remove BG error:',err.message);
    res.status(500).json({error:'Background removal failed'});
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
        from:    'ThumbFrame <onboarding@resend.dev>',
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
            <a href="http://localhost:3000/editor"
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

app.get('/auth/me', authMiddleware,(req,res)=>{
  const users=loadUsers();
  const user=users[req.user.email];
  if(!user) return res.status(404).json({error:'User not found'});
  res.json({email:user.email,name:user.name,plan:user.plan||'free'});
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
        from:    'ThumbFrame <onboarding@resend.dev>',
        to:      email,
        subject: 'Reset your ThumbFrame password',
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
            <h1 style="font-size:24px;font-weight:800;color:#1a1612">Reset your password</h1>
            <p style="color:#666;font-size:15px;line-height:1.6">
              Click the button below to reset your password. This link expires in 1 hour.
            </p>
            <a href="http://localhost:3000/reset-password?token=${token}"
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
app.post('/designs/save', authMiddleware,(req,res)=>{
  try{
    const {name,platform,layers,brightness,contrast,saturation,hue,thumbnail}=req.body;
    const designs=loadDesigns();
    if(!designs[req.user.email]) designs[req.user.email]=[];
    const id=Date.now().toString();
    const existing=designs[req.user.email].findIndex(d=>d.name===name);
    const design={id,name,platform,layers,brightness,contrast,saturation,hue,
      thumbnail:thumbnail||null,created:new Date().toLocaleDateString(),
      updated:new Date().toISOString()};
    if(existing>=0){
      designs[req.user.email][existing]={...designs[req.user.email][existing],...design};
    }else{
      designs[req.user.email].unshift(design);
    }
    designs[req.user.email]=designs[req.user.email].slice(0,50);
    saveDesigns(designs);
    res.json({success:true,id:design.id});
  }catch(err){
    res.status(500).json({error:'Save failed'});
  }
});

app.get('/designs', authMiddleware,(req,res)=>{
  const designs=loadDesigns();
  const list=(designs[req.user.email]||[]).map(d=>({
    id:d.id,name:d.name,platform:d.platform,
    created:d.created,updated:d.updated,thumbnail:d.thumbnail,
  }));
  res.json({designs:list});
});

app.get('/designs/:id', authMiddleware,(req,res)=>{
  const designs=loadDesigns();
  const design=(designs[req.user.email]||[]).find(d=>d.id===req.params.id);
  if(!design) return res.status(404).json({error:'Not found'});
  res.json({design});
});

app.delete('/designs/:id', authMiddleware,(req,res)=>{
  const designs=loadDesigns();
  if(!designs[req.user.email]) return res.status(404).json({error:'No designs'});
  designs[req.user.email]=designs[req.user.email].filter(d=>d.id!==req.params.id);
  saveDesigns(designs);
  res.json({success:true});
});

// ── Stripe checkout ────────────────────────────────────────────────────────────
app.post('/checkout', async(req,res)=>{
  try{
    console.log('Checkout request received:', req.body);
    console.log('Stripe key exists:', !!process.env.STRIPE_SECRET_KEY);
    console.log('Stripe key starts with:', process.env.STRIPE_SECRET_KEY?.substring(0,7));
    console.log('Pro price ID:', process.env.STRIPE_PRO_PRICE_ID);
    const {plan='pro',email}=req.body;
    const prices={
      starter:process.env.STRIPE_STARTER_PRICE_ID,
      pro:    process.env.STRIPE_PRO_PRICE_ID,
    };
    const session=await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      mode:'subscription',
      ...(email && email.trim() ? {customer_email: email.trim()} : {}),
      line_items:[{price:prices[plan]||prices.pro,quantity:1}],
      success_url:`${process.env.SITE_URL||'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${process.env.SITE_URL||'http://localhost:3000'}/pricing`,
    });
    res.json({url:session.url});
  }catch(err){
    console.error('Checkout error full:', err.message, err.type, err.code);
    res.status(500).json({error:`Checkout failed: ${err.message}`});
  }
});

app.post('/webhook', express.raw({type:'application/json'}),(req,res)=>{
  try{
    const sig=req.headers['stripe-signature'];
    const event=stripe.webhooks.constructEvent(req.body,sig,process.env.STRIPE_WEBHOOK_SECRET);
    if(event.type==='checkout.session.completed'){
      const session=event.data.object;
      const email=session.customer_email;
      const apiKey=uuidv4();
      const keys=loadKeys();
      keys[apiKey]={email,plan:'pro',created:new Date().toISOString()};
      saveKeys(keys);
      // Also update user plan
      const users=loadUsers();
      if(users[email]){ users[email].plan='pro'; saveUsers(users); }
      console.log(`New Pro user: ${email}`);
    }
    res.json({received:true});
  }catch(err){
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
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

app.listen(PORT,()=>console.log(`🚀 ThumbFrame API running on port ${PORT}`));
