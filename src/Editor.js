import { useEffect, useRef, useState, memo } from 'react';
import MemesPanel from './Memes';
import BrushTool, { BrushOverlay } from './Brush';

const PLATFORMS = {
  youtube:   { label:'YouTube',   width:1280, height:720,  preview:{ w:640, h:360 } },
  tiktok:    { label:'TikTok',    width:1080, height:1920, preview:{ w:152, h:270 } },
  instagram: { label:'Instagram', width:1080, height:1080, preview:{ w:270, h:270 } },
  twitter:   { label:'Twitter',   width:1600, height:900,  preview:{ w:480, h:270 } },
  linkedin:  { label:'LinkedIn',  width:1200, height:627,  preview:{ w:480, h:251 } },
};

const FONTS = [
  'Impact','Arial Black','Arial','Georgia','Courier New','Verdana',
  'Trebuchet MS','Times New Roman','Comic Sans MS','Palatino',
  'Garamond','Tahoma','Lucida Console','Century Gothic','Candara',
  'Franklin Gothic Medium','Rockwell','Copperplate','Papyrus',
  'Helvetica','Segoe UI','Calibri','Cambria','Brush Script MT',
];

const FONT_WEIGHTS = [
  {label:'Thin',value:100},{label:'Light',value:300},{label:'Regular',value:400},
  {label:'Medium',value:500},{label:'SemiBold',value:600},{label:'Bold',value:700},
  {label:'ExtraBold',value:800},{label:'Black',value:900},
];

const GRADIENTS = [
  ['#6C63FF','#1a1a2e'],['#FF416C','#FF4B2B'],['#0F6E56','#9FE1CB'],
  ['#185FA5','#00BFFF'],['#FFD700','#FF6347'],['#FF1493','#FF8C00'],
  ['#00FA9A','#006400'],['#9400D3','#4B0082'],['#2a2a2a','#888780'],
  ['#851c1c','#FAC775'],['#00C9FF','#92FE9D'],['#FC466B','#3F5EFB'],
  ['#f7971e','#ffd200'],['#11998e','#38ef7d'],['#4776E6','#8E54E9'],
  ['#eb3349','#f45c43'],['#D4537E','#FBEAF0'],['#FF6347','#FFD700'],
];

const BLEND_MODES = [
  'normal','multiply','screen','overlay','darken','lighten',
  'color-dodge','color-burn','hard-light','soft-light','difference','exclusion',
];

const TEXT_TEMPLATES = [
  { label:'YouTube Bold', text:'WATCH THIS',        fontSize:56, fontFamily:'Impact',     fontWeight:900, textColor:'#ffffff', strokeColor:'#000000', strokeWidth:4, shadowEnabled:true,  letterSpacing:2, lineHeight:1.2, textAlign:'center' },
  { label:'Gaming',       text:'EPIC MOMENT',       fontSize:52, fontFamily:'Arial Black', fontWeight:800, textColor:'#FFD700', strokeColor:'#000000', strokeWidth:3, shadowEnabled:true,  letterSpacing:1, lineHeight:1.2, textAlign:'center' },
  { label:'Clean',        text:'My Title',          fontSize:44, fontFamily:'Helvetica',   fontWeight:700, textColor:'#ffffff', strokeColor:'#000000', strokeWidth:0, shadowEnabled:false, letterSpacing:0, lineHeight:1.3, textAlign:'left'   },
  { label:'Business',     text:'RESULTS',           fontSize:48, fontFamily:'Arial Black', fontWeight:800, textColor:'#ffffff', strokeColor:'#1a1a2e', strokeWidth:2, shadowEnabled:true,  letterSpacing:4, lineHeight:1.2, textAlign:'center' },
  { label:'Viral',        text:"YOU WON'T BELIEVE", fontSize:38, fontFamily:'Impact',      fontWeight:900, textColor:'#FF4444', strokeColor:'#000000', strokeWidth:3, shadowEnabled:true,  letterSpacing:1, lineHeight:1.2, textAlign:'center' },
  { label:'Minimal',      text:'Simple & Clean',    fontSize:36, fontFamily:'Segoe UI',    fontWeight:300, textColor:'#ffffff', strokeColor:'#000000', strokeWidth:0, shadowEnabled:false, letterSpacing:8, lineHeight:1.5, textAlign:'center' },
];

const SHAPES_BASIC = [
  { key:'rect',      label:'Rectangle', icon:'▬' },
  { key:'roundrect', label:'Rounded',   icon:'▢' },
  { key:'circle',    label:'Circle',    icon:'●' },
  { key:'triangle',  label:'Triangle',  icon:'▲' },
  { key:'star',      label:'Star',      icon:'★' },
  { key:'star6',     label:'Star 6pt',  icon:'✦' },
  { key:'arrow',     label:'Arrow →',   icon:'➤' },
  { key:'arrowleft', label:'Arrow ←',   icon:'◄' },
  { key:'diamond',   label:'Diamond',   icon:'◆' },
  { key:'hexagon',   label:'Hexagon',   icon:'⬡' },
  { key:'pentagon',  label:'Pentagon',  icon:'⬠' },
  { key:'cross',     label:'Cross',     icon:'✚' },
  { key:'heart',     label:'Heart',     icon:'♥' },
  { key:'speech',    label:'Speech',    icon:'💬' },
  { key:'badge',     label:'Badge',     icon:'🏷' },
  { key:'line',      label:'Line',      icon:'—' },
];

const VIRAL_TEMPLATES = [
  {
    id:'mrbeast',
    label:'MrBeast Style',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#FFD700,#FF6B00)', text:'WATCH THIS' },
    layers:[
      { type:'background', bgColor:'#1a1a1a', bgGradient:null },
      { type:'text', text:'YOU WON\'T', fontSize:72, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:80 },
      { type:'text', text:'BELIEVE THIS', fontSize:72, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:170 },
      { type:'shape', shape:'star', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:60, height:60, x:20, y:60 },
      { type:'shape', shape:'star', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:40, height:40, x:360, y:80 },
    ],
  },
  {
    id:'mkbhd',
    label:'MKBHD Style',
    category:'Tech',
    preview:{ bg:'linear-gradient(135deg,#000000,#1a1a1a)', text:'REVIEW' },
    layers:[
      { type:'background', bgColor:'#000000', bgGradient:null },
      { type:'shape', shape:'rect', fillColor:'#FF0000',
        strokeColor:'#FF0000', width:8, height:200, x:40, y:60 },
      { type:'text', text:'THE TRUTH', fontSize:64, fontFamily:'Arial Black',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'left', x:70, y:110 },
      { type:'text', text:'ABOUT THIS', fontSize:32, fontFamily:'Arial',
        fontWeight:400, fontItalic:false, textColor:'#888888',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'left', x:70, y:160 },
    ],
  },
  {
    id:'gaming_epic',
    label:'Epic Gaming',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#2c2c54,#706fd3)', text:'EPIC WIN' },
    layers:[
      { type:'background', bgColor:'#0d0d1a',
        bgGradient:['#0d0d1a','#1a1a3e'] },
      { type:'shape', shape:'star6', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:80, height:80, x:30, y:30 },
      { type:'text', text:'EPIC', fontSize:96, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#FF6B00', strokeWidth:4, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:30, shadowX:4, shadowY:4,
        glowEnabled:true, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:8, lineHeight:1.2, textAlign:'center', x:100, y:80 },
      { type:'text', text:'MOMENT', fontSize:56, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:3, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:120, y:190 },
    ],
  },
  {
    id:'minecraft_glow',
    label:'Minecraft Glow',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#1a472a,#2d6a4f)', text:'MINECRAFT' },
    layers:[
      { type:'background', bgColor:'#0a1628',
        bgGradient:['#0a1628','#1a3a2a'] },
      { type:'shape', shape:'rect', fillColor:'rgba(0,150,255,0.15)',
        strokeColor:'rgba(0,150,255,0.4)', width:400, height:120, x:40, y:180 },
      { type:'text', text:'MINECRAFT', fontSize:68, fontFamily:'Arial Black',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#00ff88', strokeWidth:3, shadowEnabled:true,
        shadowColor:'#00ff88', shadowBlur:30, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#00ff88', arcEnabled:false, arcRadius:120,
        letterSpacing:3, lineHeight:1.2, textAlign:'center', x:40, y:80 },
      { type:'text', text:'BUT EVERYTHING IS DIFFERENT', fontSize:28,
        fontFamily:'Arial Black', fontWeight:700, fontItalic:false,
        textColor:'#88ddff', strokeColor:'#000000', strokeWidth:1,
        shadowEnabled:true, shadowColor:'#000000', shadowBlur:10,
        shadowX:2, shadowY:2, glowEnabled:false, glowColor:'#6C63FF',
        arcEnabled:false, arcRadius:120, letterSpacing:1, lineHeight:1.2,
        textAlign:'center', x:60, y:180 },
    ],
  },
  {
    id:'viral_reaction',
    label:'Reaction',
    category:'Viral',
    preview:{ bg:'linear-gradient(135deg,#FF416C,#FF4B2B)', text:'WAIT WHAT' },
    layers:[
      { type:'background', bgColor:'#FF4B2B',
        bgGradient:['#FF416C','#FF4B2B'] },
      { type:'text', text:'WAIT...', fontSize:88, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:100, y:60 },
      { type:'text', text:'WHAT?!', fontSize:88, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:110, y:170 },
      { type:'shape', shape:'arrow', fillColor:'#FFD700',
        strokeColor:'#000000', width:120, height:40, x:20, y:150 },
    ],
  },
  {
    id:'finance',
    label:'Finance/Business',
    category:'Business',
    preview:{ bg:'linear-gradient(135deg,#0f2027,#2c5364)', text:'$1,000,000' },
    layers:[
      { type:'background', bgColor:'#0a1628',
        bgGradient:['#0a1628','#0f2027'] },
      { type:'shape', shape:'rect', fillColor:'#00C853',
        strokeColor:'#00C853', width:300, height:4, x:80, y:155 },
      { type:'text', text:'HOW I MADE', fontSize:36, fontFamily:'Arial Black',
        fontWeight:700, fontItalic:false, textColor:'#88bbdd',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:120, y:60 },
      { type:'text', text:'$1,000,000', fontSize:76, fontFamily:'Arial Black',
        fontWeight:900, fontItalic:false, textColor:'#00C853',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:true,
        shadowColor:'#00C853', shadowBlur:20, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#00C853', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:100 },
      { type:'text', text:'IN 30 DAYS', fontSize:36, fontFamily:'Arial Black',
        fontWeight:700, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:130, y:180 },
    ],
  },
  {
    id:'vlog_warm',
    label:'Vlog Warm',
    category:'Vlog',
    preview:{ bg:'linear-gradient(135deg,#f7971e,#ffd200)', text:'MY STORY' },
    layers:[
      { type:'background', bgColor:'#1a0a00',
        bgGradient:['#2d1600','#1a0a00'] },
      { type:'shape', shape:'roundrect', fillColor:'#FF6B00',
        strokeColor:'#FF6B00', width:6, height:160, x:40, y:50 },
      { type:'text', text:'my honest', fontSize:40, fontFamily:'Georgia',
        fontWeight:400, fontItalic:true, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'left', x:60, y:80 },
      { type:'text', text:'STORY', fontSize:80, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#FF6B00', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:15, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'left', x:60, y:130 },
    ],
  },
  {
    id:'clickbait',
    label:'Clickbait',
    category:'Viral',
    preview:{ bg:'linear-gradient(135deg,#FF0000,#8B0000)', text:'GONE WRONG' },
    layers:[
      { type:'background', bgColor:'#0d0000',
        bgGradient:['#1a0000','#0d0000'] },
      { type:'shape', shape:'badge', fillColor:'#FF0000',
        strokeColor:'#FFD700', width:100, height:100, x:20, y:30 },
      { type:'text', text:'GONE', fontSize:88, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#FF0000',
        strokeColor:'#000000', strokeWidth:4, shadowEnabled:true,
        shadowColor:'#FF0000', shadowBlur:20, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#FF0000', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:80, y:60 },
      { type:'text', text:'WRONG', fontSize:88, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#FF0000', strokeWidth:4, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:80, y:170 },
    ],
  },
  {
    id:'tutorial',
    label:'Tutorial',
    category:'Education',
    preview:{ bg:'linear-gradient(135deg,#4776E6,#8E54E9)', text:'HOW TO' },
    layers:[
      { type:'background', bgColor:'#0a0a2e',
        bgGradient:['#0a0a2e','#1a1a4e'] },
      { type:'shape', shape:'roundrect', fillColor:'#4776E6',
        strokeColor:'#8E54E9', width:380, height:70, x:40, y:50 },
      { type:'text', text:'HOW TO', fontSize:48, fontFamily:'Arial Black',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:140, y:60 },
      { type:'text', text:'DO THIS', fontSize:80, fontFamily:'Impact',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:3, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:100, y:150 },
      { type:'text', text:'(step by step)', fontSize:24,
        fontFamily:'Arial', fontWeight:400, fontItalic:true,
        textColor:'#aaaaff', strokeColor:'#000000', strokeWidth:0,
        shadowEnabled:false, shadowColor:'#000000', shadowBlur:0,
        shadowX:0, shadowY:0, glowEnabled:false, glowColor:'#6C63FF',
        arcEnabled:false, arcRadius:120, letterSpacing:1, lineHeight:1.2,
        textAlign:'center', x:160, y:240 },
    ],
  },
  {
    id:'minimal_clean',
    label:'Minimal Clean',
    category:'Lifestyle',
    preview:{ bg:'linear-gradient(135deg,#f5f5f5,#e0e0e0)', text:'SIMPLE' },
    layers:[
      { type:'background', bgColor:'#f5f0e8', bgGradient:null },
      { type:'shape', shape:'line', fillColor:'#c45c2e',
        strokeColor:'#c45c2e', width:60, height:4, x:60, y:120 },
      { type:'text', text:'SIMPLE', fontSize:72, fontFamily:'Helvetica',
        fontWeight:300, fontItalic:false, textColor:'#1a1612',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:16, lineHeight:1.2, textAlign:'left', x:60, y:60 },
      { type:'text', text:'& effective', fontSize:32, fontFamily:'Georgia',
        fontWeight:400, fontItalic:true, textColor:'#c45c2e',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#6C63FF', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'left', x:60, y:145 },
    ],
  },
];

const STICKER_CATEGORIES = {
  'Gaming': [
    { label:'Lightning', svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M13 2L4.5 13.5H11L10 22l9.5-12H13.5L13 2z"/></svg>' },
    { label:'Star',      svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
    { label:'Fire',      svg:'<svg viewBox="0 0 24 24" fill="#FF4500"><path d="M12 2c0 0-5 5-5 10a5 5 0 0010 0c0-2-1-4-2-5 0 2-1 3-3 3 2-3 0-8 0-8z"/></svg>' },
    { label:'Diamond',   svg:'<svg viewBox="0 0 24 24" fill="#00BFFF"><path d="M12 2L2 9l10 13 10-13-10-7z"/></svg>' },
    { label:'Crown',     svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M3 18h18l-2-8-4 4-3-6-3 6-4-4-2 8z"/></svg>' },
    { label:'Explosion', svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2l2 4 4-2-2 4 4 2-4 2 2 4-4-2-2 4-2-4-4 2 2-4-4-2 4-2-2-4 4 2 2-4z"/></svg>' },
  ],
  'Business': [
    { label:'Rocket',  svg:'<svg viewBox="0 0 24 24" fill="#6C63FF"><path d="M12 2c0 0 4 4 4 10l-4 2-4-2c0-6 4-10 4-10z"/><path d="M8 16l-2 4 4-2M16 16l2 4-4-2" fill="#FF6347"/></svg>' },
    { label:'Target',  svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#FF4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#FF4444"/></svg>' },
    { label:'Money',   svg:'<svg viewBox="0 0 24 24" fill="#00C853"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>' },
    { label:'Trophy',  svg:'<svg viewBox="0 0 24 24"><path d="M8 21h8m-4-4v4M12 17c-4 0-7-3-7-7V4h14v6c0 4-3 7-7 7z" fill="#FFD700"/></svg>' },
    { label:'Chart',   svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#00C853" stroke-width="2"><path d="M2 20l5-7 4 3 5-8 5 5"/><path d="M15 8h5v5"/></svg>' },
    { label:'Diamond', svg:'<svg viewBox="0 0 24 24" fill="#00BCD4"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/></svg>' },
  ],
  'Nature': [
    { label:'Sun',      svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/></svg>' },
    { label:'Moon',     svg:'<svg viewBox="0 0 24 24" fill="#C0C0C0"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>' },
    { label:'Wave',     svg:'<svg viewBox="0 0 24 24" fill="#0088CC"><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0v8H2v-8z"/></svg>' },
    { label:'Leaf',     svg:'<svg viewBox="0 0 24 24" fill="#00C853"><path d="M17 8C8 10 5 16 5 21c5-2 9-6 12-13z"/></svg>' },
    { label:'Snow',     svg:'<svg viewBox="0 0 24 24" stroke="#00BFFF" stroke-width="1.5" fill="none"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/><circle cx="12" cy="12" r="2" fill="#00BFFF"/></svg>' },
    { label:'Mountain', svg:'<svg viewBox="0 0 24 24" fill="#6B8E23"><path d="M2 20L9 7l4 6 3-4 6 11H2z"/></svg>' },
  ],
  'Arrows': [
    { label:'Up',    svg:'<svg viewBox="0 0 24 24" fill="#00C853"><path d="M12 4l8 8h-5v8H9v-8H4l8-8z"/></svg>' },
    { label:'Right', svg:'<svg viewBox="0 0 24 24" fill="#2196F3"><path d="M20 12l-8 8v-5H4V9h8V4l8 8z"/></svg>' },
    { label:'Check', svg:'<svg viewBox="0 0 24 24" fill="#00C853"><circle cx="12" cy="12" r="10"/><path d="M7 12l4 4 6-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>' },
    { label:'Cross', svg:'<svg viewBox="0 0 24 24" fill="#FF4444"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>' },
    { label:'Burst', svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2l1.5 4 4-1.5-1.5 4 4 1.5-4 1.5 1.5 4-4-1.5-1.5 4-1.5-4-4 1.5 1.5-4-4-1.5 4-1.5-1.5-4 4 1.5L12 2z"/></svg>' },
    { label:'Badge', svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M12 2l2.5 7H22l-6 4.5 2.5 7L12 17l-6.5 3.5 2.5-7L2 9h7.5L12 2z"/></svg>' },
  ],
  'Food': [
    { label:'Pizza',   svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2L2 20h20L12 2z"/><circle cx="10" cy="14" r="1.5" fill="#8B0000"/><circle cx="14" cy="12" r="1.5" fill="#8B0000"/></svg>' },
    { label:'Coffee',  svg:'<svg viewBox="0 0 24 24" fill="#795548"><path d="M4 10h12v7a4 4 0 01-4 4H8a4 4 0 01-4-4v-7z"/><path d="M16 12h2a2 2 0 010 4h-2"/></svg>' },
    { label:'Burger',  svg:'<svg viewBox="0 0 24 24"><path d="M5 10c0-4 14-4 14 0" fill="#D2691E"/><rect x="3" y="12" width="18" height="3" rx="1" fill="#8B4513"/><path d="M5 18c0 2 14 2 14 0" fill="#D2691E"/></svg>' },
    { label:'Cake',    svg:'<svg viewBox="0 0 24 24" fill="#FFB6C1"><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 13V9a5 5 0 0110 0v4" fill="#FF69B4"/><circle cx="12" cy="3" r="1.5" fill="#FF4444"/></svg>' },
    { label:'Lemon',   svg:'<svg viewBox="0 0 24 24" fill="#FFE135"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>' },
    { label:'Avocado', svg:'<svg viewBox="0 0 24 24" fill="#90EE90"><path d="M12 2c-4 0-7 4-7 9s3 9 7 9 7-4 7-9-3-9-7-9z"/><circle cx="12" cy="13" r="3" fill="#8B4513"/></svg>' },
  ],
};

const ALL_COMMANDS = [
  { cmd:'text "..."',    desc:'Add text layer' },
  { cmd:'bg #color',     desc:'Set background color' },
  { cmd:'font Name',     desc:'Set font family' },
  { cmd:'size 48',       desc:'Set font size' },
  { cmd:'opacity 80',    desc:'Set layer opacity' },
  { cmd:'circle',        desc:'Add circle' },
  { cmd:'rect',          desc:'Add rectangle' },
  { cmd:'triangle',      desc:'Add triangle' },
  { cmd:'star',          desc:'Add star' },
  { cmd:'arrow',         desc:'Add arrow' },
  { cmd:'duplicate',     desc:'Duplicate selected' },
  { cmd:'delete',        desc:'Delete selected' },
  { cmd:'hide',          desc:'Hide selected' },
  { cmd:'show',          desc:'Show selected' },
  { cmd:'up',            desc:'Move layer up' },
  { cmd:'down',          desc:'Move layer down' },
  { cmd:'flip h',        desc:'Flip horizontal' },
  { cmd:'flip v',        desc:'Flip vertical' },
  { cmd:'align center',  desc:'Center on canvas' },
  { cmd:'align left',    desc:'Align left' },
  { cmd:'align right',   desc:'Align right' },
  { cmd:'align top',     desc:'Align top' },
  { cmd:'align bottom',  desc:'Align bottom' },
  { cmd:'blend multiply',desc:'Set blend mode' },
  { cmd:'zoom 150',      desc:'Set zoom %' },
  { cmd:'grid',          desc:'Toggle grid' },
  { cmd:'snap',          desc:'Toggle snap' },
  { cmd:'ruler',         desc:'Toggle rulers' },
  { cmd:'new',           desc:'New canvas' },
  { cmd:'save',          desc:'Save design' },
  { cmd:'undo',          desc:'Undo' },
  { cmd:'redo',          desc:'Redo' },
  { cmd:'help',          desc:'Show all commands' },
];

function defaultEffects(){
  return{
    layerBlur:0,brightness:100,contrast:100,saturation:100,
    shadow:{enabled:false,x:4,y:4,blur:12,color:'#000000',opacity:60},
    glow:{enabled:false,color:'#6C63FF',blur:20},
    outline:{enabled:false,color:'#ffffff',width:2},
    mask:{enabled:false,inverted:false,data:null},
  };
}

function getEffectsStyle(effects){
  if(!effects)return{};
  const filters=[];
  if(effects.layerBlur>0)      filters.push(`blur(${effects.layerBlur}px)`);
  if(effects.brightness!==100) filters.push(`brightness(${effects.brightness}%)`);
  if(effects.contrast!==100)   filters.push(`contrast(${effects.contrast}%)`);
  if(effects.saturation!==100) filters.push(`saturate(${effects.saturation}%)`);
  const shadows=[];
  if(effects.shadow?.enabled){
    const r=parseInt(effects.shadow.color.slice(1,3),16)||0;
    const g=parseInt(effects.shadow.color.slice(3,5),16)||0;
    const b=parseInt(effects.shadow.color.slice(5,7),16)||0;
    shadows.push(`${effects.shadow.x}px ${effects.shadow.y}px ${effects.shadow.blur}px rgba(${r},${g},${b},${(effects.shadow.opacity||60)/100})`);
  }
  if(effects.glow?.enabled){
    shadows.push(`0 0 ${effects.glow.blur}px ${effects.glow.color}`);
    shadows.push(`0 0 ${effects.glow.blur*2}px ${effects.glow.color}`);
  }
  const style={};
  if(filters.length)style.filter=filters.join(' ');
  if(shadows.length)style.boxShadow=shadows.join(',');
  if(effects.outline?.enabled&&effects.outline.width>0){
    style.outline=`${effects.outline.width}px solid ${effects.outline.color}`;
    style.outlineOffset='2px';
  }
  return style;
}

function renderShapeSVG(shape,fillColor,strokeColor,width,height){
  const w=width||100,h=height||100,fill=fillColor||'#FF4500',stroke=strokeColor||'#000';
  switch(shape){
    case 'rect':      return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:3}}/>;
    case 'roundrect': return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:Math.min(w,h)*0.2}}/>;
    case 'circle':    return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:'50%'}}/>;
    case 'triangle':  return<div style={{width:0,height:0,borderLeft:`${w/2}px solid transparent`,borderRight:`${w/2}px solid transparent`,borderBottom:`${h}px solid ${fill}`}}/>;
    case 'star':      return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'star6':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,28 86,15 73,40 98,50 73,60 86,85 61,72 50,95 39,72 14,85 27,60 2,50 27,40 14,15 39,28" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'arrow':     return<svg width={w} height={40} viewBox={`0 0 ${w} 40`}><polygon points={`0,15 ${w-20},15 ${w-20},5 ${w},20 ${w-20},35 ${w-20},25 0,25`} fill={fill} stroke={stroke} strokeWidth="1"/></svg>;
    case 'arrowleft': return<svg width={w} height={40} viewBox={`0 0 ${w} 40`}><polygon points={`${w},15 20,15 20,5 0,20 20,35 20,25 ${w},25`} fill={fill} stroke={stroke} strokeWidth="1"/></svg>;
    case 'diamond':   return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 95,50 50,95 5,50" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'hexagon':   return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'pentagon':  return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 97,40 79,95 21,95 3,40" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'cross':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'heart':     return<svg width={w} height={h} viewBox="0 0 100 100"><path d="M50 85 C20 65 5 50 5 35 C5 20 15 10 30 10 C38 10 45 15 50 22 C55 15 62 10 70 10 C85 10 95 20 95 35 C95 50 80 65 50 85Z" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'speech':    return<svg width={w} height={h} viewBox="0 0 100 100"><path d="M10 10 Q10 5 15 5 L85 5 Q90 5 90 10 L90 65 Q90 70 85 70 L30 70 L15 90 L20 70 L15 70 Q10 70 10 65 Z" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'badge':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={fill} stroke={stroke} strokeWidth="2"/><circle cx="50" cy="50" r="18" fill="none" stroke={stroke} strokeWidth="2"/></svg>;
    case 'line':      return<svg width={w} height={8} viewBox={`0 0 ${w} 8`}><line x1="0" y1="4" x2={w} y2="4" stroke={fill} strokeWidth="4" strokeLinecap="round"/></svg>;
    default:          return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:3}}/>;
  }
}

let idCounter=1;
function newId(){return idCounter++;}
function getLayerIcon(obj){if(obj.type==='background')return'▣';if(obj.type==='text')return'T';if(obj.type==='shape')return'○';if(obj.type==='svg')return'◆';if(obj.type==='image')return'▤';return'▪';}
function getLayerColor(obj){if(obj.type==='background')return obj.bgColor||'#6C63FF';if(obj.type==='text')return obj.textColor||'#fff';if(obj.type==='shape')return obj.fillColor||'#FF4500';return'#555';}
function getLayerName(obj){if(obj.type==='background')return'Background';if(obj.type==='text')return obj.text?.slice(0,18)||'Text';if(obj.type==='shape')return(obj.shape?.charAt(0).toUpperCase()+obj.shape?.slice(1))||'Shape';if(obj.type==='svg')return obj.label||'Element';if(obj.type==='image')return'Image';return'Layer';}

function ArcText({obj}){
  const ts=(()=>{const p=[];if(obj.shadowEnabled)p.push(`${obj.shadowX||2}px ${obj.shadowY||2}px ${obj.shadowBlur||14}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);if(obj.glowEnabled)p.push(`0 0 20px ${obj.glowColor||'#6C63FF'}`);return p.length?p.join(','):'none';})();
  const base={fontFamily:obj.fontFamily,fontSize:obj.fontSize,fontWeight:obj.fontWeight||700,fontStyle:obj.fontItalic?'italic':'normal',color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth}px ${obj.strokeColor}`:'none',textShadow:ts,whiteSpace:'nowrap',letterSpacing:`${obj.letterSpacing||0}px`};
  if(!obj.arcEnabled||!obj.text)return<span style={base}>{obj.text}</span>;
  const radius=obj.arcRadius||120,chars=obj.text.split(''),step=(obj.fontSize||48)/radius*1.1,start=-(chars.length-1)*step/2;
  return(<div style={{position:'relative',width:radius*2+60,height:radius+60}}>{chars.map((ch,i)=>{const angle=start+i*step-Math.PI/2,x=radius+Math.cos(angle)*radius,y=radius+Math.sin(angle)*radius+30,rot=(angle+Math.PI/2)*180/Math.PI;return<span key={i} style={{position:'absolute',left:x,top:y,transform:`translate(-50%,-50%) rotate(${rot}deg)`,...base,lineHeight:1}}>{ch}</span>;})}</div>);
}

// ✅ Slider — uses pointer capture so drag works even when mouse leaves the element
function Slider({min,max,step,value,onChange,onCommit,style}){
  const ref=useRef(null);
  const dragging=useRef(false);
  useEffect(()=>{
    if(ref.current&&!dragging.current)ref.current.value=String(value);
  },[value]);
  return(
    <input ref={ref} type="range" min={min} max={max} step={step||1} defaultValue={value} style={style}
      onPointerDown={e=>{
        dragging.current=true;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e=>{
        if(!dragging.current)return;
        onChange(Number(e.currentTarget.value));
      }}
      onPointerUp={e=>{
        dragging.current=false;
        const v=Number(e.currentTarget.value);
        onChange(v);
        if(onCommit)onCommit(v);
      }}
    />
  );
}

export default function Editor({onExit, user, token, apiUrl}){
  const canvasRef       = useRef(null);
  const brushOverlayRef = useRef(null);
  const cmdInputRef     = useRef(null);
  const justSelectedRef = useRef(false);
  const draggingRef     = useRef(null);
  const rimPaintingRef  = useRef(false);
  const resizingRef     = useRef(null);
  const dragOffsetRef   = useRef({x:0,y:0});
  const resizeStartRef  = useRef(null);
  const zoomRef         = useRef(1.5);
  const layersRef       = useRef([]);
  const mountedRef = useRef(true);
  useEffect(()=>{ mountedRef.current=true; return()=>{ mountedRef.current=false; }; },[]);

  const [platform,setPlatform]             = useState('youtube');
  const [activeTool,setActiveTool]         = useState('select');
  const [activeCategory,setActiveCategory] = useState('Gaming');
  const [darkMode,setDarkMode]             = useState(true);
  const [layers,setLayersRaw]              = useState([]);
  const [selectedId,setSelectedId]         = useState(null);
  const [zoom,setZoom]                     = useState(1.5);
  const [showGrid,setShowGrid]             = useState(false);
  const [showRuler,setShowRuler]           = useState(false);
  const [showSafeZones,setShowSafeZones]   = useState(false);
  const [showStampTest,setShowStampTest]   = useState(false);
  const [snapToGrid,setSnapToGrid]         = useState(false);
  const [lockAspect,setLockAspect]         = useState(false);
  const [recentColors,setRecentColors]     = useState(['#ffffff','#000000','#FF4500','#6C63FF','#FFD700','#00C853']);
  const [savedPalette,setSavedPalette]     = useState([]);
  const [clipboard,setClipboard]           = useState(null);
  const [showFileTab,setShowFileTab]       = useState(false);
  const [showDownload,setShowDownload]     = useState(false);
  const [savedDesigns,setSavedDesigns]     = useState([]);
  const [designName,setDesignName]         = useState('My Design');
  const [transparentExport,setTransparentExport] = useState(false);
  const [textInput,setTextInput]           = useState('MY THUMBNAIL');
  const [fontSize,setFontSize]             = useState(48);
  const [fontFamily,setFontFamily]         = useState('Impact');
  const [fontWeight,setFontWeight]         = useState(700);
  const [fontItalic,setFontItalic]         = useState(false);
  const [letterSpacing,setLetterSpacing]   = useState(0);
  const [lineHeight,setLineHeight]         = useState(1.2);
  const [textAlign,setTextAlign]           = useState('left');
  const [shadowEnabled,setShadowEnabled]   = useState(true);
  const [shadowColor,setShadowColor]       = useState('#000000');
  const [shadowBlur,setShadowBlur]         = useState(14);
  const [shadowX,setShadowX]               = useState(2);
  const [shadowY,setShadowY]               = useState(2);
  const [glowEnabled,setGlowEnabled]       = useState(false);
  const [glowColor,setGlowColor]           = useState('#6C63FF');
  const [arcEnabled,setArcEnabled]         = useState(false);
  const [arcRadius,setArcRadius]           = useState(120);
  const [textColor,setTextColor]           = useState('#ffffff');
  const [strokeColor,setStrokeColor]       = useState('#000000');
  const [strokeWidth,setStrokeWidth]       = useState(3);
  const [fillColor,setFillColor]           = useState('#FF4500');
  const [brightness,setBrightness]         = useState(100);
  const [contrast,setContrast]             = useState(110);
  const [saturation,setSaturation]         = useState(110);
  const [hue,setHue]                       = useState(0);
  const [rgbR,setRgbR]                     = useState(108);
  const [rgbG,setRgbG]                     = useState(99);
  const [rgbB,setRgbB]                     = useState(255);
  const [cmdInput,setCmdInput]             = useState('');
  const [cmdLog,setCmdLog]                 = useState('');
  const [cmdHistory,setCmdHistory]         = useState([]);
  const [cmdHistoryIdx,setCmdHistoryIdx]   = useState(-1);
  const [cmdSuggestions,setCmdSuggestions] = useState([]);
  const [cmdOpen,setCmdOpen]               = useState(false);
  const [showCmdHelp,setShowCmdHelp]       = useState(false);
  const [history,setHistory]               = useState([]);
  const [historyIndex,setHistoryIndex]     = useState(-1);
  const historyRef                         = useRef([]);
  const historyIndexRef                    = useRef(-1);
  const historyDebounceRef                 = useRef(null);
  const [layerDragId,setLayerDragId]       = useState(null);
  const [layerDragOver,setLayerDragOver]   = useState(null);
  const [brushTypeState,setBrushTypeState]             = useState('blur');
  const [brushSizeState,setBrushSizeState]             = useState(20);
  const [brushStrengthState,setBrushStrengthState]     = useState(50);
  const [brushEdgeState,setBrushEdgeState]             = useState('soft');
  const [brushColorState,setBrushColorState]           = useState('#ff0000');
  const [brushColorAlpha,setBrushColorAlpha]           = useState(100);
  const [rimLightColor,setRimLightColor]       = useState('#00aaff');
  const [rimLightSize,setRimLightSize]         = useState(40);
  const [rimLightIntensity,setRimLightIntensity] = useState(80);
  const [rimLightSoftness,setRimLightSoftness] = useState(70);
  const [rimLightBlend,setRimLightBlend]       = useState('screen');
  const [rimPickingColor,setRimPickingColor] = useState(false);
  const [rimPickedFrom,setRimPickedFrom]     = useState(null);
  const [ctrScore,setCtrScore]     = useState(null);
  const [ctrBreakdown,setCtrBreakdown] = useState(null);
  const [ctrLoading,setCtrLoading] = useState(false);
  const [abVariants,setAbVariants]   = useState([]);
  const [abLoading,setAbLoading]     = useState(false);
  const [abSelected,setAbSelected]   = useState(null);
  const [resizeExporting,setResizeExporting] = useState(false);
  const [resizeProgress,setResizeProgress]   = useState('');
  const [faceAnalysis,setFaceAnalysis]   = useState(null);
  const [faceLoading,setFaceLoading]     = useState(false);
  const [aiCmd,setAiCmd]           = useState('');
  const [aiCmdLoading,setAiCmdLoading] = useState(false);
  const [aiCmdLog,setAiCmdLog]     = useState('');
  const [showAiBar,setShowAiBar]   = useState(false);
  const aiCmdInputRef              = useRef(null);
  const [maskingLayerId,setMaskingLayerId] = useState(null);
  const [brushFlowState,setBrushFlowState]             = useState(100);
  const [brushStabilizerState,setBrushStabilizerState] = useState(0);

  function setLayers(val){
    if(typeof val==='function'){
      setLayersRaw(prev=>{const next=val(prev);layersRef.current=next;return next;});
    }else{
      layersRef.current=val;
      setLayersRaw(val);
    }
  }

  const p  = PLATFORMS[platform];
  const T  = {
    bg:darkMode?'#0f0f0f':'#f2f2f2',panel:darkMode?'#1a1a1a':'#ffffff',
    sidebar:darkMode?'#161616':'#fafafa',input:darkMode?'#242424':'#ffffff',
    border:darkMode?'#2a2a2a':'#e8e8e8',text:darkMode?'#e8e8e8':'#1a1a1a',
    muted:darkMode?'#5a5a5a':'#9a9a9a',accent:'#6C63FF',
    danger:'#ef4444',success:'#22c55e',warning:'#f59e0b',
  };

  const selectedLayer   = layers.find(l=>l.id===selectedId);
  const bg              = layers.find(l=>l.type==='background');
  const canvasFilter    = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
  const canDrag         = activeTool==='move' || activeTool==='select' || activeTool==='shapes' || activeTool==='stickers';
  // ✅ When brush active on image — that image is ONLY shown in brush overlay, nowhere else
  const brushingImageId = activeTool==='brush'&&(selectedLayer?.type==='image'||selectedLayer?.type==='background') ? selectedId : null;

  useEffect(()=>{zoomRef.current=zoom;},[zoom]);

  useEffect(()=>{
    try{const s=localStorage.getItem('thumbframe_designs');if(s)setSavedDesigns(JSON.parse(s));}catch(e){}
    const b=makeBg(p);
    setLayers([b]);
    historyRef.current=[[b]];
    historyIndexRef.current=0;
    setHistory([[b]]);
    setHistoryIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ✅ Window drag handlers — ONLY fire when draggingRef or resizingRef is set
  // This means sidebar sliders are completely unaffected
  useEffect(()=>{
    function onMove(e){
      if(!draggingRef.current&&!resizingRef.current)return;
      const rs=resizeStartRef.current;
      const z=zoomRef.current;
      if(resizingRef.current&&rs){
        const dx=(e.clientX-rs.mouseX)/z,dy=(e.clientY-rs.mouseY)/z;
        setLayers(prev=>{
          const layer=prev.find(l=>l.id===resizingRef.current);if(!layer)return prev;
          if(layer.type==='text')return prev.map(l=>l.id===resizingRef.current?{...l,fontSize:Math.max(8,Math.round(rs.origFontSize+dx*0.5))}:l);
          const nw=Math.max(20,Math.round(rs.origW+dx));
          const nh=lockAspect?Math.round(nw/rs.aspect):Math.max(20,Math.round(rs.origH+dy));
          return prev.map(l=>l.id===resizingRef.current?{...l,width:nw,height:nh}:l);
        });
        return;
      }
      if(!draggingRef.current||!canvasRef.current)return;
      const rect=canvasRef.current.getBoundingClientRect();
      let x=(e.clientX-rect.left)/z-dragOffsetRef.current.x;
      let y=(e.clientY-rect.top)/z-dragOffsetRef.current.y;
      if(snapToGrid){x=Math.round(x/10)*10;y=Math.round(y/10)*10;}
      x=Math.max(-p.preview.w+10,Math.min(p.preview.w-10,x));
      y=Math.max(-p.preview.h+10,Math.min(p.preview.h-10,y));
      setLayers(prev=>prev.map(l=>l.id===draggingRef.current?{...l,x,y}:l));
    }
    function onUp(){
      if(!draggingRef.current&&!resizingRef.current)return;
      const clone=JSON.parse(JSON.stringify(layersRef.current));
      const newHist=[...historyRef.current.slice(0,historyIndexRef.current+1),clone];
      historyRef.current=newHist;
      historyIndexRef.current=newHist.length-1;
      setHistory(newHist);
      setHistoryIndex(newHist.length-1);
      draggingRef.current=null;
      resizingRef.current=null;
      resizeStartRef.current=null;
    }
    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp);
    return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);};
  },[snapToGrid,lockAspect,p.preview.w,p.preview.h]);

  useEffect(()=>{
    const handler=(e)=>{
      const active=document.activeElement;
      const typing=active.tagName==='INPUT'||active.tagName==='TEXTAREA'||active.tagName==='SELECT';
      if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}
      if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redo();}
      if((e.ctrlKey||e.metaKey)&&e.key==='c'){if(selectedId){const l=layers.find(x=>x.id===selectedId);if(l)setClipboard(l);}}
      if((e.ctrlKey||e.metaKey)&&e.key==='v'){if(clipboard)duplicateLayerFromObj(clipboard);}
      if((e.ctrlKey||e.metaKey)&&e.key==='d'){e.preventDefault();if(selectedId)duplicateLayer(selectedId);}
      if(!typing&&(e.key==='Delete'||e.key==='Backspace')){if(selectedId)deleteLayer(selectedId);}
      if((e.ctrlKey||e.metaKey)&&(e.key==='+'||e.key==='=')){e.preventDefault();setZoom(z=>Math.min(16,+(z+0.1).toFixed(1)));}
      if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();setZoom(z=>Math.max(0.25,+(z-0.1).toFixed(1)));}
      if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault();setZoom(1.5);}
      if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();setCmdOpen(o=>!o);setTimeout(()=>cmdInputRef.current?.focus(),50);}
      if((e.ctrlKey||e.metaKey)&&e.key==='i'){
        e.preventDefault();
        setShowAiBar(o=>!o);
        setTimeout(()=>aiCmdInputRef.current?.focus(),50);
      }
      if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveDesign(designName);}
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedId,layers,clipboard,historyIndex,history,designName]);

  function makeBg(plat){return{id:newId(),type:'background',bgColor:'#ffffff',bgGradient:null,x:0,y:0,width:plat.preview.w,height:plat.preview.h,opacity:100,hidden:false,locked:true,blendMode:'normal',effects:defaultEffects()};}

  function pushHistory(nl){
    const clone=nl.map(l=>{
      if(l.type==='image'){const {src,...rest}=l;return{...JSON.parse(JSON.stringify(rest)),src};}
      return JSON.parse(JSON.stringify(l));
    });
    const newHist=[...historyRef.current.slice(0,historyIndexRef.current+1),clone].slice(-30);
    historyRef.current=newHist;
    historyIndexRef.current=newHist.length-1;
    setHistory(newHist);
    setHistoryIndex(newHist.length-1);
  }
  function pushHistoryDebounced(nl){
    if(historyDebounceRef.current)clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current=setTimeout(()=>pushHistory(nl),400);
  }

  function undo(){
    const ni=historyIndexRef.current-1;if(ni<0)return;
    historyIndexRef.current=ni;setHistoryIndex(ni);
    setLayers(JSON.parse(JSON.stringify(historyRef.current[ni])));
  }
  function redo(){
    const ni=historyIndexRef.current+1;if(ni>=historyRef.current.length)return;
    historyIndexRef.current=ni;setHistoryIndex(ni);
    setLayers(JSON.parse(JSON.stringify(historyRef.current[ni])));
  }

  function addLayer(obj){
    const id=newId();
    const sx=snapToGrid?Math.round((obj.x??40)/10)*10:(obj.x??40);
    const sy=snapToGrid?Math.round((obj.y??40)/10)*10:(obj.y??40);
    const layer={...obj,id,x:sx,y:sy,opacity:100,hidden:false,locked:false,blendMode:'normal',flipH:false,flipV:false,rotation:0,effects:defaultEffects()};
    setLayers(prev=>{const nl=[...prev,layer];pushHistory(nl);return nl;});
    setSelectedId(id);
  }

  function updateLayer(id,updates){setLayers(prev=>{const nl=prev.map(l=>l.id===id?{...l,...updates}:l);pushHistoryDebounced(nl);return nl;});}
  function updateLayerSilent(id,updates){setLayers(prev=>prev.map(l=>l.id===id?{...l,...updates}:l));}
  function updateLayerEffect(id,key,value){setLayers(prev=>{const nl=prev.map(l=>l.id===id?{...l,effects:{...(l.effects||defaultEffects()),[key]:value}}:l);pushHistory(nl);return nl;});}
  function updateLayerEffectSilent(id,key,value){setLayers(prev=>prev.map(l=>l.id===id?{...l,effects:{...(l.effects||defaultEffects()),[key]:value}}:l));}
  function updateLayerEffectNested(id,ek,sk,value){setLayers(prev=>{const nl=prev.map(l=>{if(l.id!==id)return l;return{...l,effects:{...(l.effects||defaultEffects()),[ek]:{...((l.effects||defaultEffects())[ek]||{}),[sk]:value}}};});pushHistory(nl);return nl;});}
  function updateLayerEffectNestedSilent(id,ek,sk,value){setLayers(prev=>prev.map(l=>{if(l.id!==id)return l;return{...l,effects:{...(l.effects||defaultEffects()),[ek]:{...((l.effects||defaultEffects())[ek]||{}),[sk]:value}}};}));}
  function deleteLayer(id){
    const layer=layers.find(l=>l.id===id);
    if(!layer) return;
    // Allow background deletion only if there's another layer
    if(layer.type==='background'){
      if(layers.length<=1) return; // can't delete if only layer
    }
    setLayers(prev=>{const nl=prev.filter(l=>l.id!==id);pushHistory(nl);return nl;});setSelectedId(null);
  }
  function moveLayerUp(id){const idx=layers.findIndex(l=>l.id===id);if(idx>=layers.length-1)return;const nl=[...layers];[nl[idx],nl[idx+1]]=[nl[idx+1],nl[idx]];setLayers(nl);pushHistory(nl);}
  function moveLayerDown(id){const idx=layers.findIndex(l=>l.id===id);if(idx<=0)return;const nl=[...layers];[nl[idx],nl[idx-1]]=[nl[idx-1],nl[idx]];setLayers(nl);pushHistory(nl);}
  function duplicateLayerFromObj(layer){const nl2={...layer,id:newId(),x:layer.x+16,y:layer.y+16};setLayers(prev=>{const nl=[...prev,nl2];pushHistory(nl);return nl;});setSelectedId(nl2.id);}
  function duplicateLayer(id){const layer=layers.find(l=>l.id===id);if(!layer||layer.type==='background')return;duplicateLayerFromObj(layer);}
  function updateBg(updates){const bgL=layers.find(l=>l.type==='background');if(bgL)updateLayer(bgL.id,updates);}
  function getLayerSrc(layer){
    if(layer.type==='image')return layer.src;
    if(layer.type==='background'){
      const tmp=document.createElement('canvas');
      tmp.width=p.preview.w;tmp.height=p.preview.h;
      const ctx=tmp.getContext('2d');
      if(layer.bgGradient){const g=ctx.createLinearGradient(0,0,0,tmp.height);g.addColorStop(0,layer.bgGradient[0]);g.addColorStop(1,layer.bgGradient[1]);ctx.fillStyle=g;}
      else{ctx.fillStyle=layer.bgColor||'#6C63FF';}
      ctx.fillRect(0,0,tmp.width,tmp.height);
      return tmp.toDataURL('image/png');
    }
    return null;
  }
  function addRecentColor(color){setRecentColors(prev=>[color,...prev.filter(c=>c!==color)].slice(0,12));}

  function loadTemplate(template){
    if(!window.confirm(`Load template "${template.label}"? This will replace your current canvas.`)) return;

    // ✅ Find if template has its own background layer
    const templateHasBg = template.layers.some(l=>l.type==='background');

    // Only add a fresh bg if template doesn't include one
    const bg = makeBg(p);

    const templateLayers = template.layers.map(l=>({
      ...l,
      id:newId(),
      x:l.x??40,
      y:l.y??40,
      opacity:100,
      hidden:false,
      locked:l.type==='background'?true:false,
      blendMode:'normal',
      flipH:false,
      flipV:false,
      rotation:0,
      effects:defaultEffects(),
    }));

    // ✅ Use template bg if it has one, otherwise use fresh white bg
    const newLayers = templateHasBg
      ? templateLayers
      : [bg, ...templateLayers];

    setLayers(newLayers);
    pushHistory(newLayers);
    setSelectedId(null);
    setCmdLog(`Loaded: ${template.label}`);
    setActiveTool('select');
  }

  async function executeAiCommand(cmd){
    if(!cmd.trim()) return;
    setAiCmdLoading(true);
    setAiCmdLog('');

    try{
      const canvasState = {
        platform,
        canvasWidth:  p.preview.w,
        canvasHeight: p.preview.h,
        globalBrightness: brightness,
        globalContrast:   contrast,
        globalSaturation: saturation,
        globalHue:        hue,
        selectedLayerId:  selectedId,
        selectedLayerType: selectedLayer?.type,
        layers: layers.map(l=>({
          id:         l.id,
          type:       l.type,
          isSelected: l.id === selectedId,
          isImage:    l.type === 'image',
          label:      l.type==='text' ? `text:"${l.text?.slice(0,30)}"` : l.type==='background' ? 'background' : `${l.type}-layer`,
          x:          l.x,
          y:          l.y,
          width:      l.width,
          height:     l.height,
          hidden:     l.hidden,
          opacity:    l.opacity,
          blendMode:  l.blendMode,
          text:       l.text,
          fontSize:   l.fontSize,
          fontFamily: l.fontFamily,
          fontWeight: l.fontWeight,
          textColor:  l.textColor,
          strokeWidth:l.strokeWidth,
          strokeColor:l.strokeColor,
          shadowEnabled:l.shadowEnabled,
          glowEnabled:l.glowEnabled,
          bgColor:    l.bgColor,
          bgGradient: l.bgGradient,
          imgBrightness: l.imgBrightness,
          imgContrast:   l.imgContrast,
          imgSaturate:   l.imgSaturate,
          imgBlur:       l.imgBlur,
        })),
      };

      const res = await fetch('https://thumbframe-api-production.up.railway.app/ai-command',{
        method:  'POST',
        headers: {'Content-Type':'application/json'},
        body:    JSON.stringify({ command:cmd, canvasState }),
      });
      const data = await res.json();

      if(data.error){
        setAiCmdLog(`Error: ${data.error}`);
        setAiCmdLoading(false);
        return;
      }

      const result = data.result;
      if(!result){
        setAiCmdLog('Could not understand. Try rephrasing.');
        setAiCmdLoading(false);
        return;
      }

      // Handle single or multiple actions
      const actions = result.actions || [result];
      const log = [];

      for(const action of actions){
        if(!action?.action) continue;

        switch(action.action){

          case 'adjustBrightness':
            setBrightness(Math.min(200,Math.max(0,Number(action.value)||100)));
            log.push(`Brightness → ${action.value}%`);
            break;

          case 'adjustContrast':
            setContrast(Math.min(300,Math.max(0,Number(action.value)||100)));
            log.push(`Contrast → ${action.value}%`);
            break;

          case 'adjustSaturation':
            setSaturation(Math.min(300,Math.max(0,Number(action.value)||100)));
            log.push(`Saturation → ${action.value}%`);
            break;

          case 'adjustHue':
            setHue(Math.min(360,Math.max(0,Number(action.value)||0)));
            log.push(`Hue → ${action.value}°`);
            break;

          case 'updateBackground':{
            const bgLayer = layers.find(l=>l.type==='background');
            if(bgLayer){
              updateLayer(bgLayer.id, action.updates||{});
              log.push('Background updated');
            }
            break;
          }

          case 'updateLayer':
            if(action.id){
              const target = layers.find(l=>l.id===action.id);
              if(target){
                updateLayer(action.id, action.updates||{});
                const changes = Object.keys(action.updates||{}).join(', ');
                log.push(`Updated ${target.type==='text'?`"${target.text?.slice(0,15)}"`:target.type}: ${changes}`);
              }
            }
            break;

          case 'addText':
            addLayer({
              type:         'text',
              text:         action.text         || 'NEW TEXT',
              fontSize:     action.fontSize      || 60,
              fontFamily:   action.fontFamily    || 'Impact',
              fontWeight:   action.fontWeight    || 900,
              fontItalic:   action.fontItalic    || false,
              textColor:    action.textColor     || '#ffffff',
              strokeColor:  action.strokeColor   || '#000000',
              strokeWidth:  action.strokeWidth   || 3,
              shadowEnabled:action.shadowEnabled !== false,
              shadowColor:  action.shadowColor   || '#000000',
              shadowBlur:   action.shadowBlur    || 20,
              shadowX:      action.shadowX       || 3,
              shadowY:      action.shadowY       || 3,
              glowEnabled:  action.glowEnabled   || false,
              glowColor:    action.glowColor     || '#6C63FF',
              arcEnabled:   false,
              arcRadius:    120,
              letterSpacing:action.letterSpacing || 2,
              lineHeight:   action.lineHeight    || 1.2,
              textAlign:    action.textAlign     || 'center',
              x:            action.x             || 60,
              y:            action.y             || 80,
            });
            log.push(`Added text: "${action.text}"`);
            break;

          case 'deleteLayer':
            if(action.id){
              const target = layers.find(l=>l.id===action.id);
              if(target && target.type!=='background'){
                deleteLayer(action.id);
                log.push('Layer deleted');
              }
            }
            break;

          case 'moveLayer':
            if(action.id){
              updateLayer(action.id,{
                x: action.x ?? layers.find(l=>l.id===action.id)?.x,
                y: action.y ?? layers.find(l=>l.id===action.id)?.y,
              });
              log.push('Layer moved');
            }
            break;

          case 'resizeLayer':
            if(action.id){
              updateLayer(action.id,{
                width:  action.width  || layers.find(l=>l.id===action.id)?.width,
                height: action.height || layers.find(l=>l.id===action.id)?.height,
              });
              log.push('Layer resized');
            }
            break;

          case 'message':
            setAiCmdLog(action.message||'Done');
            setAiCmdLoading(false);
            return;

          default:
            log.push(`Unknown action: ${action.action}`);
        }
      }

      setAiCmdLog(log.length>0 ? `✓ ${log.join(' · ')}` : '✓ Done');
      setAiCmd('');

    }catch(err){
      console.error('AI command error:',err);
      setAiCmdLog('Failed — make sure API is running on port 5000');
    }

    setAiCmdLoading(false);
  }

  async function analyzeFace(){
    setFaceLoading(true);
    setFaceAnalysis(null);

    try{
      // Find image layers that might have faces
      const imageLayers=layers.filter(l=>l.type==='image'&&!l.hidden);
      if(imageLayers.length===0){
        setFaceAnalysis({
          error:true,
          message:'No image layers found. Upload a photo with a face first.',
        });
        setFaceLoading(false);
        return;
      }

      // Render the canvas for analysis
      const canvas  = document.createElement('canvas');
      canvas.width  = p.preview.w;
      canvas.height = p.preview.h;
      const ctx     = canvas.getContext('2d');

      // Draw background
      const bg=layers.find(l=>l.type==='background');
      if(bg){
        ctx.fillStyle=bg.bgColor||'#000';
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }

      // Draw image layers
      for(const obj of imageLayers){
        await new Promise(resolve=>{
          const img=new Image();
          img.onload=()=>{
            ctx.save();
            ctx.globalAlpha=(obj.opacity??100)/100;
            ctx.drawImage(img,obj.x,obj.y,obj.width,obj.height);
            ctx.restore();
            resolve();
          };
          img.onerror=()=>resolve();
          img.src=obj.src;
        });
      }

      // Analyze pixel data for face-like features
      const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const data      = imageData.data;
      const w         = canvas.width, h = canvas.height;

      // ── Skin tone detection ──────────────────────────────────────────────────
      let skinPixels=0, totalPixels=0;
      let skinCenterX=0, skinCenterY=0, skinCount=0;
      for(let x=0;x<w;x+=2) for(let y=0;y<h;y+=2){
        const i=(y*w+x)*4;
        const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        if(a<128) continue;
        totalPixels++;
        // Skin tone ranges (works for multiple skin tones)
        const isSkin=(
          r>60&&g>40&&b>20&&
          r>g&&r>b&&
          Math.abs(r-g)>10&&
          r-b>10&&
          r<250&&g<220&&b<200&&
          (r-g)<50
        );
        if(isSkin){
          skinPixels++;
          skinCenterX+=x;skinCenterY+=y;skinCount++;
        }
      }

      const skinRatio = totalPixels>0?skinPixels/totalPixels:0;
      const hasFace   = skinRatio>0.03;
      const faceX     = skinCount>0?skinCenterX/skinCount:w/2;
      const faceY     = skinCount>0?skinCenterY/skinCount:h/2;

      // ── Face position analysis ───────────────────────────────────────────────
      const isLeftThird   = faceX<w*0.33;
      const isRightThird  = faceX>w*0.66;
      const isCentered    = !isLeftThird&&!isRightThird;
      const isTopHalf     = faceY<h*0.5;

      // ── Face size analysis ───────────────────────────────────────────────────
      const faceArea = skinPixels*4; // approximate
      const canvasArea = w*h;
      const faceSizeRatio = faceArea/canvasArea;
      const faceIsTooSmall = faceSizeRatio<0.04;
      const faceIsGood     = faceSizeRatio>=0.04&&faceSizeRatio<0.35;

      // ── Brightness at face area ──────────────────────────────────────────────
      let faceBrightness=0, facePxCount=0;
      const fr=30;
      for(let x=Math.max(0,Math.round(faceX)-fr);
          x<Math.min(w,Math.round(faceX)+fr);x++){
        for(let y=Math.max(0,Math.round(faceY)-fr);
            y<Math.min(h,Math.round(faceY)+fr);y++){
          const i=(y*w+x)*4;
          const lum=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
          faceBrightness+=lum;facePxCount++;
        }
      }
      const avgFaceBrightness=facePxCount>0?faceBrightness/facePxCount:128;
      const faceWellLit=avgFaceBrightness>80&&avgFaceBrightness<220;

      // ── Contrast around face ─────────────────────────────────────────────────
      let edgeStrength=0, edgeCount=0;
      for(let x=Math.max(1,Math.round(faceX)-fr);
          x<Math.min(w-1,Math.round(faceX)+fr);x++){
        for(let y=Math.max(1,Math.round(faceY)-fr);
            y<Math.min(h-1,Math.round(faceY)+fr);y++){
          const i=(y*w+x)*4;
          const dx=Math.abs(data[i]-data[(y*w+x+1)*4]);
          const dy=Math.abs(data[i]-data[((y+1)*w+x)*4]);
          edgeStrength+=dx+dy;edgeCount++;
        }
      }
      const avgEdge=edgeCount>0?edgeStrength/edgeCount:0;
      const hasGoodContrast=avgEdge>15;

      // ── Generate scores and tips ─────────────────────────────────────────────
      const scores=[];
      const tips=[];
      const goods=[];

      // Face presence
      if(!hasFace){
        scores.push({label:'Face detected',score:0,max:25});
        tips.push('No face detected. Thumbnails with faces get up to 38% more clicks.');
      } else {
        scores.push({label:'Face detected',score:25,max:25});
        goods.push('Face detected — great start!');
      }

      // Face size
      if(hasFace){
        if(faceIsTooSmall){
          scores.push({label:'Face size',score:5,max:20});
          tips.push('Face is too small. Fill at least 15% of the thumbnail for maximum impact.');
        } else if(faceIsGood){
          scores.push({label:'Face size',score:20,max:20});
          goods.push('Face size is perfect.');
        } else {
          scores.push({label:'Face size',score:12,max:20});
          tips.push('Face might be slightly too large. Leave room for text.');
        }
      } else {
        scores.push({label:'Face size',score:0,max:20});
      }

      // Face position
      if(hasFace){
        if(isRightThird&&isTopHalf){
          scores.push({label:'Positioning',score:20,max:20});
          goods.push('Face is top-right — perfect for text on the left.');
        } else if(isLeftThird&&isTopHalf){
          scores.push({label:'Positioning',score:18,max:20});
          goods.push('Face is top-left — good composition.');
        } else if(isCentered){
          scores.push({label:'Positioning',score:12,max:20});
          tips.push('Face is centered. Try moving it to the right third — leaves room for bold text on the left.');
        } else {
          scores.push({label:'Positioning',score:10,max:20});
          tips.push('Face is in the lower area. Move it higher — faces in the top half get more attention.');
        }
      } else {
        scores.push({label:'Positioning',score:0,max:20});
      }

      // Lighting
      if(hasFace){
        if(faceWellLit){
          scores.push({label:'Lighting',score:20,max:20});
          goods.push('Face is well lit — clear and visible.');
        } else if(avgFaceBrightness<=80){
          scores.push({label:'Lighting',score:8,max:20});
          tips.push('Face looks dark. Increase brightness or add rim lighting to make the face pop.');
        } else {
          scores.push({label:'Lighting',score:10,max:20});
          tips.push('Face may be overexposed. Reduce brightness slightly for a more natural look.');
        }
      } else {
        scores.push({label:'Lighting',score:0,max:20});
      }

      // Contrast
      if(hasFace){
        if(hasGoodContrast){
          scores.push({label:'Stands out',score:15,max:15});
          goods.push('Face stands out from the background.');
        } else {
          scores.push({label:'Stands out',score:5,max:15});
          tips.push('Face blends into background. Remove the background or add a contrasting color behind the subject.');
        }
      } else {
        scores.push({label:'Stands out',score:0,max:15});
      }

      // Calculate total
      const total=scores.reduce((a,s)=>a+s.score,0);
      const maxTotal=scores.reduce((a,s)=>a+s.max,0);
      const pct=Math.round((total/maxTotal)*100);

      // Emotion suggestions based on content
      const emotionTips=[];
      if(hasFace){
        emotionTips.push({
          emotion:'😱 Shocked',
          tip:'Works great for "You won\'t believe..." thumbnails. Wide eyes, open mouth.',
          ctr:'High CTR',
        });
        emotionTips.push({
          emotion:'😄 Excited',
          tip:'Best for positive content, reveals, giveaways. Big smile, eyebrows raised.',
          ctr:'High CTR',
        });
        emotionTips.push({
          emotion:'😤 Determined',
          tip:'Great for challenge/achievement videos. Strong jaw, focused eyes.',
          ctr:'Medium CTR',
        });
        emotionTips.push({
          emotion:'🤔 Curious',
          tip:'Works for "what if" and educational content. Head tilt, raised eyebrow.',
          ctr:'Medium CTR',
        });
      }

      setFaceAnalysis({
        hasFace,
        score:pct,
        total,maxTotal,
        scores,tips,goods,
        emotionTips,
        facePosition:{
          x:Math.round((faceX/w)*100),
          y:Math.round((faceY/h)*100),
        },
        skinRatio:Math.round(skinRatio*100),
      });

    }catch(err){
      console.error('Face analysis error:',err);
      setFaceAnalysis({error:true,message:'Analysis failed. Try again.'});
    }
    setFaceLoading(false);
  }

  async function exportAllPlatforms(){
    setResizeExporting(true);

    const platformList=[
      {key:'youtube',   label:'YouTube',   width:1280, height:720,  preview:{w:480,h:270}},
      {key:'tiktok',    label:'TikTok',    width:1080, height:1920, preview:{w:152,h:270}},
      {key:'instagram', label:'Instagram', width:1080, height:1080, preview:{w:270,h:270}},
      {key:'twitter',   label:'Twitter',   width:1600, height:900,  preview:{w:480,h:270}},
      {key:'linkedin',  label:'LinkedIn',  width:1200, height:627,  preview:{w:480,h:251}},
    ];

    for(const plat of platformList){
      setResizeProgress(`Exporting ${plat.label}...`);

      const canvas  = document.createElement('canvas');
      canvas.width  = plat.width;
      canvas.height = plat.height;
      const ctx     = canvas.getContext('2d');

      // Scale factors from current platform to target
      const scaleX = plat.width  / p.preview.w;
      const scaleY = plat.height / p.preview.h;

      ctx.filter=`brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;

      for(const obj of layers){
        if(obj.hidden) continue;
        ctx.save();
        ctx.globalAlpha=(obj.opacity??100)/100;
        ctx.globalCompositeOperation=obj.blendMode||'normal';

        if(obj.type==='background'){
          ctx.filter='none';
          if(obj.bgGradient){
            const g=ctx.createLinearGradient(0,0,0,canvas.height);
            g.addColorStop(0,obj.bgGradient[0]);
            g.addColorStop(1,obj.bgGradient[1]);
            ctx.fillStyle=g;
          } else ctx.fillStyle=obj.bgColor||'#6C63FF';
          ctx.fillRect(0,0,canvas.width,canvas.height);
        }

        else if(obj.type==='text'){
          const scale=Math.min(scaleX,scaleY);
          ctx.translate(obj.x*scaleX,obj.y*scaleY);
          const fs=(obj.fontSize||48)*scale;
          ctx.font=`${obj.fontItalic?'italic ':''}${obj.fontWeight||700} ${fs}px ${obj.fontFamily}`;
          if(obj.shadowEnabled){
            ctx.shadowColor=obj.shadowColor||'rgba(0,0,0,0.95)';
            ctx.shadowBlur=(obj.shadowBlur||14)*scale;
            ctx.shadowOffsetX=(obj.shadowX||2)*scale;
            ctx.shadowOffsetY=(obj.shadowY||2)*scale;
          }
          if(obj.strokeWidth>0){
            ctx.strokeStyle=obj.strokeColor;
            ctx.lineWidth=obj.strokeWidth*scale*2;
            ctx.strokeText(obj.text,0,fs);
          }
          ctx.fillStyle=obj.textColor;
          ctx.fillText(obj.text,0,fs);
        }

        else if(obj.type==='image'){
          await new Promise(resolve=>{
            const img=new Image();
            img.onload=()=>{
              const x=obj.x*scaleX,y=obj.y*scaleY;
              const w=obj.width*scaleX,h=obj.height*scaleY;
              const cl=(obj.cropLeft||0)*scaleX,ct=(obj.cropTop||0)*scaleY;
              const cr=(obj.cropRight||0)*scaleX,cb=(obj.cropBottom||0)*scaleY;
              ctx.save();
              ctx.beginPath();
              ctx.rect(x+cl,y+ct,w-cl-cr,h-ct-cb);
              ctx.clip();
              if(obj.flipH||obj.flipV){
                ctx.translate(x+w/2,y+h/2);
                ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
                ctx.translate(-(x+w/2),-(y+h/2));
              }
              ctx.filter=`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%)`;
              ctx.drawImage(img,x-cl,y-ct,w,h);
              ctx.restore();
              resolve();
            };
            img.onerror=()=>resolve();
            img.src=obj.src;
          });
        }

        else if(obj.type==='shape'){
          ctx.translate(obj.x*scaleX,obj.y*scaleY);
          const sw=obj.width*scaleX,sh=obj.height*scaleY;
          ctx.fillStyle=obj.fillColor||'#FF4500';
          ctx.strokeStyle=obj.strokeColor||'#000';
          ctx.lineWidth=2*Math.min(scaleX,scaleY);
          ctx.beginPath();
          if(obj.shape==='circle') ctx.ellipse(sw/2,sh/2,sw/2,sh/2,0,0,Math.PI*2);
          else ctx.rect(0,0,sw,sh);
          ctx.fill();ctx.stroke();
        }

        ctx.restore();
      }

      ctx.filter='none';

      // Download this platform
      const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.download=`${designName.replace(/\s+/g,'-')}-${plat.label}-${plat.width}x${plat.height}.png`;
      link.href=url;
      link.click();
      URL.revokeObjectURL(url);

      // Small delay between downloads
      await new Promise(r=>setTimeout(r,500));
    }

    setResizeProgress('All done! 5 files downloaded.');
    setResizeExporting(false);
    setTimeout(()=>setResizeProgress(''),3000);
  }

  function generateVariants(){
    setAbLoading(true);
    setAbVariants([]);
    setAbSelected(null);

    const bg = layers.find(l=>l.type==='background');

    // Variant A — Bold high contrast
    const variantA = layers.map(l=>{
      if(l.type==='background') return{
        ...l,id:newId(),
        bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#6C63FF',-20),
        bgGradient:bg?.bgGradient?[
          shiftColor(bg.bgGradient[0],-20),
          shiftColor(bg.bgGradient[1],-20),
        ]:null,
      };
      if(l.type==='text') return{
        ...l,id:newId(),
        fontSize:Math.round((l.fontSize||48)*1.15),
        fontWeight:900,
        strokeWidth:Math.max(l.strokeWidth||0,3),
        shadowEnabled:true,
        shadowBlur:20,
        letterSpacing:(l.letterSpacing||0)+2,
      };
      if(l.type==='shape') return{
        ...l,id:newId(),
        width:Math.round((l.width||100)*1.1),
        height:Math.round((l.height||100)*1.1),
      };
      return{...l,id:newId()};
    });

    // Variant B — Color shift warm
    const variantB = layers.map(l=>{
      if(l.type==='background') return{
        ...l,id:newId(),
        bgGradient:['#FF6B35','#F7C59F'],
        bgColor:'#FF6B35',
      };
      if(l.type==='text') return{
        ...l,id:newId(),
        textColor: l.textColor==='#ffffff'?'#FFD700':l.textColor,
        strokeColor:'#000000',
        strokeWidth:Math.max(l.strokeWidth||0,2),
        glowEnabled:false,
      };
      if(l.type==='shape') return{
        ...l,id:newId(),
        fillColor:'#FF6B35',
        strokeColor:'#FFD700',
      };
      return{...l,id:newId()};
    });

    // Variant C — Dark dramatic
    const variantC = layers.map(l=>{
      if(l.type==='background') return{
        ...l,id:newId(),
        bgGradient:['#0a0a0a','#1a1a2e'],
        bgColor:'#0a0a0a',
      };
      if(l.type==='text') return{
        ...l,id:newId(),
        textColor: l.textColor==='#000000'?'#ffffff':l.textColor,
        glowEnabled:true,
        glowColor:l.textColor||'#6C63FF',
        shadowEnabled:true,
        shadowBlur:30,
      };
      if(l.type==='shape') return{
        ...l,id:newId(),
        fillColor:shiftColor(l.fillColor||'#FF4500',40),
      };
      return{...l,id:newId()};
    });

    setTimeout(()=>{
      setAbVariants([
        { id:'a', label:'A — Bold',     desc:'Larger text, higher contrast', layers:variantA },
        { id:'b', label:'B — Warm',     desc:'Warm orange tones, energetic',  layers:variantB },
        { id:'c', label:'C — Dramatic', desc:'Dark moody, glowing text',      layers:variantC },
      ]);
      setAbLoading(false);
    },600);
  }

  function shiftColor(hex,amount){
    try{
      const h=hex.replace('#','');
      const r=Math.min(255,Math.max(0,parseInt(h.slice(0,2),16)+amount));
      const g=Math.min(255,Math.max(0,parseInt(h.slice(2,4),16)+amount));
      const b=Math.min(255,Math.max(0,parseInt(h.slice(4,6),16)+amount));
      return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
    }catch(e){ return hex; }
  }

  function applyVariant(variant){
    if(!window.confirm(`Apply variant ${variant.label}? This replaces your current canvas.`)) return;
    setLayers(variant.layers);
    pushHistory(variant.layers);
    setSelectedId(null);
    setAbVariants([]);
    setAbSelected(null);
    setCmdLog(`Applied: ${variant.label}`);
    setActiveTool('select');
  }

  function saveDesign(name){
    try{
      // Generate thumbnail from canvas
      const canvas = canvasRef.current;
      const thumbnail = canvas ? canvas.toDataURL('image/jpeg', 0.5) : null;
      const design={id:Date.now(),name:name||'Untitled',created:new Date().toLocaleDateString(),platform,layers:JSON.parse(JSON.stringify(layers)),brightness,contrast,saturation,hue,thumbnail};
      const updated=[design,...savedDesigns.filter(d=>d.name!==name)].slice(0,20);
      setSavedDesigns(updated);localStorage.setItem('thumbframe_designs',JSON.stringify(updated));
      // Also save to backend if logged in
      if(token && apiUrl){
        fetch(`${apiUrl}/designs/save`,{
          method:'POST',
          headers:{'Content-Type':'application/json','authorization':`Bearer ${token}`},
          body:JSON.stringify({name:name||'Untitled',platform,layers:JSON.parse(JSON.stringify(layers)),brightness,contrast,saturation,hue,thumbnail}),
        }).catch(()=>{});
      }
      setCmdLog(`Saved: ${name}`);
    }catch(e){}
  }
  function loadDesign(d){setLayers(d.layers);setPlatform(d.platform||'youtube');setBrightness(d.brightness||100);setContrast(d.contrast||110);setSaturation(d.saturation||110);setHue(d.hue||0);setSelectedId(null);setShowFileTab(false);}
  function newCanvas(){const b=makeBg(p);setLayers([b]);historyRef.current=[[b]];historyIndexRef.current=0;setHistory([[b]]);setHistoryIndex(0);setSelectedId(null);setShowFileTab(false);}
  function deleteDesign(id){const updated=savedDesigns.filter(d=>d.id!==id);setSavedDesigns(updated);localStorage.setItem('thumbframe_designs',JSON.stringify(updated));}

  async function analyzeCTR(){
    setCtrLoading(true);
    setCtrScore(null);
    setCtrBreakdown(null);

    try{
      // Render the current canvas to analyze
      const canvas  = document.createElement('canvas');
      canvas.width  = p.preview.w;
      canvas.height = p.preview.h;
      const ctx     = canvas.getContext('2d');

      // Draw background
      const bg = layers.find(l=>l.type==='background');
      if(bg){
        if(bg.bgGradient){
          const g=ctx.createLinearGradient(0,0,0,canvas.height);
          g.addColorStop(0,bg.bgGradient[0]);
          g.addColorStop(1,bg.bgGradient[1]);
          ctx.fillStyle=g;
        } else ctx.fillStyle=bg.bgColor||'#000';
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }

      // Draw image layers for analysis
      for(const obj of layers){
        if(obj.hidden||obj.type==='background') continue;
        if(obj.type==='image'){
          await new Promise(resolve=>{
            const img=new Image();
            img.onload=()=>{
              ctx.save();
              ctx.globalAlpha=(obj.opacity??100)/100;
              ctx.drawImage(img,obj.x,obj.y,obj.width,obj.height);
              ctx.restore();
              resolve();
            };
            img.onerror=()=>resolve();
            img.src=obj.src;
          });
        }
      }

      // ── Analyze pixel data ──────────────────────────────────────────────────
      const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const data      = imageData.data;
      const total     = canvas.width*canvas.height;

      // 1. Contrast score — measure luminance variance
      let lumSum=0, lumSumSq=0;
      for(let i=0;i<data.length;i+=4){
        const lum=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
        lumSum+=lum; lumSumSq+=lum*lum;
      }
      const lumMean = lumSum/total;
      const lumVar  = lumSumSq/total - lumMean*lumMean;
      const lumStd  = Math.sqrt(lumVar);
      const contrastScore = Math.min(100, Math.round((lumStd/80)*100));

      // 2. Color vibrancy — measure saturation
      let satSum=0;
      for(let i=0;i<data.length;i+=4){
        const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
        const max=Math.max(r,g,b), min=Math.min(r,g,b);
        satSum+=(max+min>0)?(max-min)/(1-Math.abs(max+min-1)):0;
      }
      const avgSat       = satSum/total;
      const vibrancyScore = Math.min(100, Math.round(avgSat*180));

      // 3. Text presence score — check if text layers exist and are readable
      const textLayers  = layers.filter(l=>l.type==='text'&&!l.hidden);
      const hasText     = textLayers.length>0;
      const hasBoldText = textLayers.some(l=>(l.fontWeight||400)>=700);
      const hasLargeText = textLayers.some(l=>(l.fontSize||0)>=36);
      const hasStroke    = textLayers.some(l=>(l.strokeWidth||0)>0);
      const hasShadow    = textLayers.some(l=>l.shadowEnabled);
      let textScore = 0;
      if(hasText)     textScore+=25;
      if(hasBoldText) textScore+=25;
      if(hasLargeText)textScore+=20;
      if(hasStroke)   textScore+=15;
      if(hasShadow)   textScore+=15;
      textScore = Math.min(100, textScore);

      // 4. Face/subject presence — check if there's an image with transparency
      // (removed background = subject cutout)
      const hasSubject = layers.some(l=>l.type==='image'&&!l.hidden);
      const hasCutout  = layers.some(l=>{
        if(l.type!=='image'||l.hidden) return false;
        // Rough check — if image is smaller than canvas it's probably a cutout
        return l.width<p.preview.w*0.95||l.height<p.preview.h*0.95;
      });
      const subjectScore = hasSubject?(hasCutout?100:60):20;

      // 5. Composition score — check layer count and variety
      const layerCount  = layers.filter(l=>!l.hidden&&l.type!=='background').length;
      const hasShape    = layers.some(l=>l.type==='shape'&&!l.hidden);
      const layerVariety = new Set(layers.filter(l=>!l.hidden).map(l=>l.type)).size;
      let compScore = 0;
      if(layerCount>=2) compScore+=30;
      if(layerCount>=3) compScore+=20;
      if(hasShape)      compScore+=20;
      if(layerVariety>=3) compScore+=30;
      compScore = Math.min(100, compScore);

      // 6. Safe zone score — check if important layers are in safe zone
      const safeTop=20, safeBottom=p.preview.h-40, safeLeft=20, safeRight=p.preview.w-20;
      const layersInSafeZone = layers.filter(l=>{
        if(l.hidden||l.type==='background') return false;
        return l.x>=safeLeft&&l.y>=safeTop&&(l.x+(l.width||100))<=safeRight&&(l.y+(l.height||50))<=safeBottom;
      }).length;
      const totalActiveLayers = layers.filter(l=>!l.hidden&&l.type!=='background').length;
      const safeScore = totalActiveLayers>0
        ? Math.round((layersInSafeZone/totalActiveLayers)*100)
        : 50;

      // ── Calculate overall score (weighted) ─────────────────────────────────
      const weights = {
        contrast:  0.25,
        vibrancy:  0.20,
        text:      0.25,
        subject:   0.15,
        comp:      0.10,
        safe:      0.05,
      };

      const overall = Math.round(
        contrastScore  * weights.contrast  +
        vibrancyScore  * weights.vibrancy  +
        textScore      * weights.text      +
        subjectScore   * weights.subject   +
        compScore      * weights.comp      +
        safeScore      * weights.safe
      );

      // ── Generate tips ───────────────────────────────────────────────────────
      const tips = [];
      if(contrastScore<60)  tips.push({type:'warn', text:'Low contrast — viewers scroll past low-contrast thumbnails. Try a darker background or brighter subject.'});
      if(vibrancyScore<50)  tips.push({type:'warn', text:'Muted colors — saturated thumbnails get 34% more clicks. Boost saturation in Adjustments.'});
      if(!hasText)          tips.push({type:'bad',  text:'No text — thumbnails with bold text get significantly more clicks.'});
      if(hasText&&!hasBoldText) tips.push({type:'warn', text:'Text weight too light — use Bold or Black weight for maximum readability.'});
      if(hasText&&!hasLargeText) tips.push({type:'warn', text:'Text too small — should be at least 36px to read at mobile size.'});
      if(hasText&&!hasStroke)   tips.push({type:'tip',  text:'Add a text outline — makes text readable on any background.'});
      if(!hasSubject)       tips.push({type:'warn', text:'No image layer — thumbnails with a clear subject get more clicks.'});
      if(hasCutout)         tips.push({type:'good', text:'Background removed — great! Subject stands out clearly.'});
      if(compScore<50)      tips.push({type:'tip',  text:'Add more elements — shapes, stickers, or a background image add visual interest.'});
      if(safeScore<70)      tips.push({type:'warn', text:'Elements near edges — YouTube UI covers corners. Keep important content in the center.'});
      if(overall>=80)       tips.push({type:'good', text:'Strong thumbnail! This has the key ingredients for high CTR.'});
      if(overall>=90)       tips.push({type:'good', text:'Excellent! This thumbnail has everything a viral video needs.'});

      setCtrScore(overall);
      setCtrBreakdown({
        contrast:  contrastScore,
        vibrancy:  vibrancyScore,
        text:      textScore,
        subject:   subjectScore,
        comp:      compScore,
        safe:      safeScore,
        tips,
      });
    } catch(err){
      console.error('CTR analyze error:',err);
      setCtrScore(0);
    }
    setCtrLoading(false);
  }

  function applyRimLight(x, y){
    const hex     = rimLightColor.replace('#','');
    const lr      = parseInt(hex.slice(0,2),16);
    const lg      = parseInt(hex.slice(2,4),16);
    const lb      = parseInt(hex.slice(4,6),16);
    const lightR  = Math.round((rimLightSize/100)*Math.max(p.preview.w,p.preview.h)*0.7);
    const intensity = rimLightIntensity/100;
    const softness  = rimLightSoftness/100;

    // Find existing rim light layer or create one
    const existingRim = layers.find(l=>l.isRimLight);

    // Get existing canvas data if rim layer exists
    let existingSrc = null;
    if(existingRim) existingSrc = existingRim.src;

    const tmp = document.createElement('canvas');
    tmp.width  = p.preview.w;
    tmp.height = p.preview.h;
    const ctx  = tmp.getContext('2d');

    // ✅ Draw existing rim light data first so strokes accumulate
    if(existingSrc){
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img,0,0,tmp.width,tmp.height);
        drawGradient();
      };
      img.src = existingSrc;
    } else {
      drawGradient();
    }

    function drawGradient(){
      const gradient = ctx.createRadialGradient(x,y,0,x,y,lightR);
      gradient.addColorStop(0,            `rgba(${lr},${lg},${lb},${intensity*0.6})`);
      gradient.addColorStop(softness*0.5, `rgba(${lr},${lg},${lb},${intensity*0.3})`);
      gradient.addColorStop(1,            `rgba(${lr},${lg},${lb},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0,0,tmp.width,tmp.height);
      const src = tmp.toDataURL('image/png');

      if(existingRim){
        // ✅ Update existing layer silently — no new layer, no history spam
        updateLayerSilent(existingRim.id,{src});
      } else {
        // ✅ Create ONE rim light layer
        const id=newId();
        const layer={
          id,type:'image',src,
          x:0,y:0,width:p.preview.w,height:p.preview.h,
          opacity:Math.round(rimLightIntensity),
          hidden:false,locked:false,
          blendMode:rimLightBlend||'screen',
          flipH:false,flipV:false,
          cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
          imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
          effects:defaultEffects(),
          isRimLight:true,
        };
        setLayers(prev=>{const nl=[...prev,layer];pushHistory(nl);return nl;});
        setSelectedId(id);
      }
    }
  }

  function addMaskToLayer(id){
    const layer=layers.find(l=>l.id===id);
    if(!layer||layer.type==='background') return;
    // Create a white mask canvas (white = show, black = hide)
    const tmp=document.createElement('canvas');
    tmp.width=layer.width||p.preview.w;
    tmp.height=layer.height||p.preview.h;
    const ctx=tmp.getContext('2d');
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,tmp.width,tmp.height);
    updateLayer(id,{
      mask:{
        enabled:true,
        inverted:false,
        data:tmp.toDataURL('image/png'),
        width:tmp.width,
        height:tmp.height,
      }
    });
    setCmdLog('Mask added — paint black to hide, white to reveal');
  }

  function removeMaskFromLayer(id){
    updateLayer(id,{mask:{enabled:false,inverted:false,data:null}});
    if(maskingLayerId===id) setMaskingLayerId(null);
  }

  function applyMaskToLayer(id){
    const layer=layers.find(l=>l.id===id);
    if(!layer?.mask?.enabled||!layer.mask.data) return;
    // Flatten mask into image permanently
    const img=new Image();
    img.onload=()=>{
      const mask=new Image();
      mask.onload=()=>{
        const tmp=document.createElement('canvas');
        tmp.width=layer.width;tmp.height=layer.height;
        const ctx=tmp.getContext('2d');
        ctx.drawImage(img,0,0,layer.width,layer.height);
        ctx.globalCompositeOperation='destination-in';
        ctx.drawImage(mask,0,0,layer.width,layer.height);
        updateLayer(id,{src:tmp.toDataURL('image/png'),mask:{enabled:false,inverted:false,data:null}});
      };
      mask.src=layer.mask.data;
    };
    img.src=layer.src;
  }


  function alignLayer(id,dir){
    const layer=layers.find(l=>l.id===id);if(!layer||layer.type==='background')return;
    const w=layer.width||100,h=layer.height||(layer.fontSize||48);
    let u={};
    if(dir==='center')  u={x:Math.round((p.preview.w-w)/2),y:Math.round((p.preview.h-h)/2)};
    if(dir==='center-h')u={x:Math.round((p.preview.w-w)/2)};
    if(dir==='center-v')u={y:Math.round((p.preview.h-h)/2)};
    if(dir==='left')u={x:0};if(dir==='right')u={x:p.preview.w-w};
    if(dir==='top') u={y:0};if(dir==='bottom')u={y:p.preview.h-h};
    updateLayer(id,u);
  }
  function flipLayer(id,axis){const layer=layers.find(l=>l.id===id);if(!layer)return;if(axis==='h')updateLayer(id,{flipH:!layer.flipH});if(axis==='v')updateLayer(id,{flipV:!layer.flipV});}

  function applyTextTemplate(t){
    setTextInput(t.text);setFontSize(t.fontSize);setFontFamily(t.fontFamily);setFontWeight(t.fontWeight||700);
    setTextColor(t.textColor);setStrokeColor(t.strokeColor);setStrokeWidth(t.strokeWidth);setShadowEnabled(t.shadowEnabled);
    setLetterSpacing(t.letterSpacing||0);setLineHeight(t.lineHeight||1.2);setTextAlign(t.textAlign||'left');
    addLayer({type:'text',text:t.text,fontSize:t.fontSize,fontFamily:t.fontFamily,fontWeight:t.fontWeight||700,fontItalic:false,textColor:t.textColor,strokeColor:t.strokeColor,strokeWidth:t.strokeWidth,shadowEnabled:t.shadowEnabled,shadowColor:'#000000',shadowBlur:14,shadowX:2,shadowY:2,glowEnabled:false,glowColor:'#6C63FF',arcEnabled:false,arcRadius:120,letterSpacing:t.letterSpacing||0,lineHeight:t.lineHeight||1.2,textAlign:t.textAlign||'left'});
  }
  function addText(){addRecentColor(textColor);addLayer({type:'text',text:textInput||'MY THUMBNAIL',fontSize,fontFamily,fontWeight,fontItalic,textColor,strokeColor,strokeWidth,shadowEnabled,shadowColor,shadowBlur,shadowX,shadowY,glowEnabled,glowColor,arcEnabled,arcRadius,letterSpacing,lineHeight,textAlign});}
  function addShape(type){addRecentColor(fillColor);addLayer({type:'shape',shape:type,fillColor,strokeColor,width:100,height:100});}
  function addSvgSticker(svg,label){addLayer({type:'svg',svg,label,width:64,height:64});}

  function handleImageUpload(e){
    Array.from(e.target.files).forEach(file=>{
      const url=URL.createObjectURL(file);
      const img=new Image();
      img.onload=()=>{
        const cW=p.preview.w,cH=p.preview.h,ia=img.width/img.height,ca=cW/cH;
        let w,h;if(ia>ca){h=cH;w=h*ia;}else{w=cW;h=w/ia;}
        addLayer({type:'image',src:url,width:Math.round(w),height:Math.round(h),x:Math.round((cW-w)/2),y:Math.round((cH-h)/2),cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
      };
      img.src=url;
    });
  }

  function updateSuggestions(val){if(!val.trim()){setCmdSuggestions([]);return;}const v=val.toLowerCase();setCmdSuggestions(ALL_COMMANDS.filter(c=>c.cmd.toLowerCase().startsWith(v)||c.desc.toLowerCase().includes(v)).slice(0,6));}
  function handleCmdKey(e){
    if(e.key==='Enter'){runCommand(cmdInput);return;}
    if(e.key==='ArrowUp'){e.preventDefault();const i=Math.min(cmdHistoryIdx+1,cmdHistory.length-1);setCmdHistoryIdx(i);if(cmdHistory[i])setCmdInput(cmdHistory[i]);return;}
    if(e.key==='ArrowDown'){e.preventDefault();const i=Math.max(cmdHistoryIdx-1,-1);setCmdHistoryIdx(i);setCmdInput(i===-1?'':cmdHistory[i]||'');return;}
    if(e.key==='Escape'){setCmdOpen(false);setCmdSuggestions([]);return;}
    if(e.key==='Tab'&&cmdSuggestions.length>0){e.preventDefault();setCmdInput(cmdSuggestions[0].cmd.split(' ')[0]+' ');setCmdSuggestions([]);return;}
  }
  function runCommand(raw){
    const cmd=raw.trim().toLowerCase();if(!cmd)return;
    let log='';
    setCmdHistory(prev=>[raw,...prev.slice(0,19)]);setCmdHistoryIdx(-1);setCmdInput('');setCmdSuggestions([]);
    if(cmd==='help'){setShowCmdHelp(h=>!h);log='Toggled help';}
    else if(cmd==='new'||cmd==='clear'){newCanvas();log='New canvas';}
    else if(cmd==='save'){saveDesign(designName);log=`Saved: ${designName}`;}
    else if(cmd==='undo'){undo();log='Undone';}
    else if(cmd==='redo'){redo();log='Redone';}
    else if(cmd==='dark'){setDarkMode(true);log='Dark mode';}
    else if(cmd==='light'){setDarkMode(false);log='Light mode';}
    else if(cmd==='grid'){setShowGrid(g=>!g);log='Grid toggled';}
    else if(cmd==='ruler'){setShowRuler(r=>!r);log='Ruler toggled';}
    else if(cmd==='snap'){setSnapToGrid(s=>!s);log='Snap toggled';}
    else if(cmd==='delete'){if(selectedId){deleteLayer(selectedId);log='Deleted';}}
    else if(cmd==='duplicate'){if(selectedId){duplicateLayer(selectedId);log='Duplicated';}}
    else if(cmd==='hide'){if(selectedId){updateLayer(selectedId,{hidden:true});log='Hidden';}}
    else if(cmd==='show'){if(selectedId){updateLayer(selectedId,{hidden:false});log='Shown';}}
    else if(cmd==='up'){if(selectedId)moveLayerUp(selectedId);log='Layer up';}
    else if(cmd==='down'){if(selectedId)moveLayerDown(selectedId);log='Layer down';}
    else if(cmd==='flip h'){if(selectedId)flipLayer(selectedId,'h');log='Flipped H';}
    else if(cmd==='flip v'){if(selectedId)flipLayer(selectedId,'v');log='Flipped V';}
    else if(cmd.startsWith('align ')){const dir=cmd.slice(6).trim();if(selectedId)alignLayer(selectedId,dir);log=`Aligned ${dir}`;}
    else if(cmd.startsWith('blend ')){const mode=cmd.slice(6).trim();if(selectedId&&BLEND_MODES.includes(mode)){updateLayer(selectedId,{blendMode:mode});log=`Blend: ${mode}`;}else log='Unknown blend mode';}
    else if(cmd.startsWith('bg ')){const c=raw.slice(3);updateBg({bgColor:c,bgGradient:null});log=`BG: ${c}`;}
    else if(cmd.startsWith('text ')){const t=raw.slice(5);addLayer({type:'text',text:t,fontSize,fontFamily,fontWeight,fontItalic,textColor,strokeColor,strokeWidth,shadowEnabled,shadowColor,shadowBlur,shadowX,shadowY,glowEnabled,glowColor,arcEnabled,arcRadius,letterSpacing,lineHeight,textAlign});log='Added text';}
    else if(cmd.startsWith('font ')){setFontFamily(raw.slice(5));log=`Font: ${raw.slice(5)}`;}
    else if(cmd.startsWith('size ')){const s=parseInt(cmd.slice(5));if(!isNaN(s)){setFontSize(s);log=`Size: ${s}px`;}}
    else if(cmd.startsWith('opacity ')){const o=parseInt(cmd.slice(8));if(!isNaN(o)&&selectedId){updateLayer(selectedId,{opacity:o});log=`Opacity: ${o}%`;}}
    else if(cmd.startsWith('zoom ')){const z=parseInt(cmd.slice(5));if(!isNaN(z)){setZoom(z/100);log=`Zoom: ${z}%`;}}
    else if(['circle','rect','roundrect','triangle','star','arrow','diamond','hexagon','heart','cross','line'].includes(cmd)){addShape(cmd);log=`Added ${cmd}`;}
    else log='Unknown — type "help"';
    setCmdLog(log);
  }

  function onLayerMouseDown(e,id){
    if(activeTool==='rimlight') return;
    if(activeTool==='brush') return;
    const layer=layers.find(l=>l.id===id);if(!layer)return;
    e.stopPropagation();
    justSelectedRef.current=true;
    setSelectedId(id);
    if(layer.type==='background'){setActiveTool('background');return;}
    if(!canDrag||layer.locked)return;
    const rect=canvasRef.current.getBoundingClientRect();
    draggingRef.current=id;
    dragOffsetRef.current={x:(e.clientX-rect.left)/zoomRef.current-layer.x,y:(e.clientY-rect.top)/zoomRef.current-layer.y};
  }

  function onResizeStart(e,id){
    if(!canDrag)return;
    e.stopPropagation();e.preventDefault();
    justSelectedRef.current=true;
    const layer=layers.find(l=>l.id===id);
    resizingRef.current=id;
    resizeStartRef.current={mouseX:e.clientX,mouseY:e.clientY,origW:layer.width||100,origH:layer.height||100,origFontSize:layer.fontSize||48,aspect:(layer.width||100)/(layer.height||100)};
  }

  function onLayerDragStart(e,id){setLayerDragId(id);e.dataTransfer.effectAllowed='move';}
  function onLayerDragOver(e,id){e.preventDefault();if(id!==layerDragId)setLayerDragOver(id);}
  function onLayerDrop(e,targetId){
    e.preventDefault();if(!layerDragId||layerDragId===targetId)return;
    const fromIdx=layers.findIndex(l=>l.id===layerDragId);
    const toIdx=layers.findIndex(l=>l.id===targetId);
    if(fromIdx<0||toIdx<0)return;
    const nl=[...layers];const[removed]=nl.splice(fromIdx,1);nl.splice(toIdx,0,removed);
    setLayers(nl);pushHistory(nl);setLayerDragId(null);setLayerDragOver(null);
  }
  function onLayerDragEnd(){setLayerDragId(null);setLayerDragOver(null);}

  async function exportCanvas(format='png', transparent=false){
    // ✅ Free = 640×360 preview res, Pro = full resolution
    const isPro   = user?.plan==='pro' || token==='test-key-123';
    const exportW = isPro ? p.width  : Math.round(p.width  * 0.5);
    const exportH = isPro ? p.height : Math.round(p.height * 0.5);
    const canvas  = document.createElement('canvas');
    canvas.width  = exportW;
    canvas.height = exportH;
    const ctx     = canvas.getContext('2d');
    const scaleX  = exportW / p.preview.w;
    const scaleY  = exportH / p.preview.h;

    // Apply canvas-wide adjustments
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;

    // Draw each layer in order
    for (const obj of layers) {
      if (obj.hidden) continue;
      if (transparent && obj.type==='background') continue;
      ctx.save();
      ctx.globalAlpha       = (obj.opacity??100)/100;
      ctx.globalCompositeOperation = obj.blendMode||'normal';

      if (obj.type==='background'){
        ctx.filter='none';
        if (obj.bgGradient){
          const g=ctx.createLinearGradient(0,0,0,canvas.height);
          g.addColorStop(0,obj.bgGradient[0]);
          g.addColorStop(1,obj.bgGradient[1]);
          ctx.fillStyle=g;
        } else {
          ctx.fillStyle=obj.bgColor||'#6C63FF';
        }
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }

      else if (obj.type==='text'){
        const scale = Math.min(scaleX,scaleY);
        const centerX=(obj.x+(obj.width||100)/2)*scaleX;
        const centerY=(obj.y+(obj.fontSize||48)/2)*scaleY;
        ctx.translate(centerX,centerY);
        if(obj.rotation) ctx.rotate((obj.rotation||0)*Math.PI/180);
        ctx.translate(-centerX,-centerY);
        ctx.translate(obj.x*scaleX, obj.y*scaleY);
        if(obj.flipH||obj.flipV) ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
        const fs = (obj.fontSize||48)*scale;
        ctx.font=`${obj.fontItalic?'italic ':''}${obj.fontWeight||700} ${fs}px ${obj.fontFamily}`;
        if(obj.shadowEnabled){
          ctx.shadowColor   = obj.shadowColor||'rgba(0,0,0,0.95)';
          ctx.shadowBlur    = (obj.shadowBlur||14)*scale;
          ctx.shadowOffsetX = (obj.shadowX||2)*scale;
          ctx.shadowOffsetY = (obj.shadowY||2)*scale;
        }
        if(obj.strokeWidth>0){
          ctx.strokeStyle = obj.strokeColor;
          ctx.lineWidth   = obj.strokeWidth*scale*2;
          ctx.strokeText(obj.text,0,fs);
        }
        ctx.fillStyle = obj.textColor;
        ctx.fillText(obj.text,0,fs);
      }

      else if (obj.type==='image'){
        await new Promise(resolve=>{
          const img=new Image();
          img.onload=()=>{
            const x=obj.x*scaleX;
            const y=obj.y*scaleY;
            const w=obj.width*scaleX;
            const h=obj.height*scaleY;
            const cl=(obj.cropLeft||0)*scaleX;
            const ct=(obj.cropTop||0)*scaleY;
            const cr=(obj.cropRight||0)*scaleX;
            const cb=(obj.cropBottom||0)*scaleY;

            ctx.save();
            if(obj.mask?.enabled&&obj.mask?.data){
              const maskImg=new Image();
              maskImg.onload=()=>{
                ctx.beginPath();
                ctx.rect(x+cl,y+ct,w-cl-cr,h-ct-cb);
                ctx.clip();
                if(obj.flipH||obj.flipV){
                  ctx.translate(x+w/2,y+h/2);
                  ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
                  ctx.translate(-(x+w/2),-(y+h/2));
                }
                ctx.filter=`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${(obj.imgBlur||0)*Math.min(scaleX,scaleY)}px)`;
                ctx.drawImage(img,x-cl,y-ct,w,h);
                ctx.restore();
                resolve();
              };
              maskImg.src=obj.mask.data;
            } else {
              ctx.save();
              if(obj.rotation){
                const cx2=x+w/2, cy2=y+h/2;
                ctx.translate(cx2,cy2);
                ctx.rotate((obj.rotation||0)*Math.PI/180);
                ctx.translate(-cx2,-cy2);
              }
              ctx.beginPath();
              ctx.rect(x+cl,y+ct,w-cl-cr,h-ct-cb);
              ctx.clip();
              if(obj.flipH||obj.flipV){
                ctx.translate(x+w/2,y+h/2);
                ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
                ctx.translate(-(x+w/2),-(y+h/2));
              }
              ctx.filter=`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${(obj.imgBlur||0)*Math.min(scaleX,scaleY)}px)`;
              ctx.drawImage(img,x-cl,y-ct,w,h);
              ctx.restore();
              resolve();
            }
          };
          img.onerror=()=>resolve();
          img.src=obj.src;
        });
      }

      else if (obj.type==='shape'){
        ctx.translate(obj.x*scaleX, obj.y*scaleY);
        if(obj.flipH||obj.flipV) ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
        const sw=obj.width*scaleX, sh=obj.height*scaleY;
        ctx.fillStyle   = obj.fillColor||'#FF4500';
        ctx.strokeStyle = obj.strokeColor||'#000';
        ctx.lineWidth   = 2*Math.min(scaleX,scaleY);
        ctx.beginPath();
        if(obj.shape==='circle'){
          ctx.ellipse(sw/2,sh/2,sw/2,sh/2,0,0,Math.PI*2);
        } else if(obj.shape==='rect'||obj.shape==='roundrect'){
          const rad=obj.shape==='roundrect'?Math.min(sw,sh)*0.2:0;
          ctx.roundRect(0,0,sw,sh,rad);
        } else {
          ctx.rect(0,0,sw,sh);
        }
        ctx.fill(); ctx.stroke();
      }

      ctx.restore();
    }

    ctx.filter='none';

    // Generate download
    const fname = `${designName.replace(/\s+/g,'-')}-${p.width}x${p.height}`;

    if(format==='webp'){
      const blob = await new Promise(r=>canvas.toBlob(r,'image/webp',0.92));
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fname}.webp`;
      link.href     = url;
      link.click();
      URL.revokeObjectURL(url);
    } else if(format==='jpg'){
      const link = document.createElement('a');
      link.download = `${fname}.jpg`;
      link.href     = canvas.toDataURL('image/jpeg',0.95);
      link.click();
    } else {
      const blob = await new Promise(r=>canvas.toBlob(r,'image/png'));
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fname}.png`;
      link.href     = url;
      link.click();
      URL.revokeObjectURL(url);
    }

    setShowDownload(false);
  }

  function renderCropHandles(obj){
    if(activeTool!=='crop'||obj.type!=='image') return null;
    const cropW=obj.width-(obj.cropLeft||0)-(obj.cropRight||0);
    const cropH=obj.height-(obj.cropTop||0)-(obj.cropBottom||0);

    const handleStyle={
      position:'absolute',background:'rgba(255,255,255,0.95)',
      border:'2px solid #6C63FF',cursor:'pointer',zIndex:1001,
    };
    const lineStyle={
      position:'absolute',background:'rgba(108,99,255,0.6)',
      pointerEvents:'none',
    };

    function startCropDrag(e, edge){
      e.stopPropagation();
      e.preventDefault();
      // ✅ Snapshot starting values at drag begin
      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startCropTop    = obj.cropTop    || 0;
      const startCropBottom = obj.cropBottom || 0;
      const startCropLeft   = obj.cropLeft   || 0;
      const startCropRight  = obj.cropRight  || 0;
      const maxW = obj.width  - 20;
      const maxH = obj.height - 20;

      // ✅ Track current values in a ref so mouseUp reads latest
      const currentRef = {
        cropTop:    startCropTop,
        cropBottom: startCropBottom,
        cropLeft:   startCropLeft,
        cropRight:  startCropRight,
      };

      function onMove(ev){
        const dx = (ev.clientX - startMouseX) / zoom;
        const dy = (ev.clientY - startMouseY) / zoom;
        let updates = {};

        if(edge==='top'){
          updates.cropTop = Math.max(0, Math.min(maxH - startCropBottom, startCropTop + dy));
        }
        if(edge==='bottom'){
          updates.cropBottom = Math.max(0, Math.min(maxH - startCropTop, startCropBottom - dy));
        }
        if(edge==='left'){
          updates.cropLeft = Math.max(0, Math.min(maxW - startCropRight, startCropLeft + dx));
        }
        if(edge==='right'){
          updates.cropRight = Math.max(0, Math.min(maxW - startCropLeft, startCropRight - dx));
        }

        // ✅ Store latest values in ref
        Object.assign(currentRef, updates);
        updateLayerSilent(obj.id, updates);
      }

      function onUp(){
        // ✅ Commit using currentRef values not stale obj values
        updateLayer(obj.id, {
          cropTop:    currentRef.cropTop,
          cropBottom: currentRef.cropBottom,
          cropLeft:   currentRef.cropLeft,
          cropRight:  currentRef.cropRight,
        });
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup',   onUp);
      }

      window.addEventListener('pointermove', onMove, {passive:false});
      window.addEventListener('pointerup',   onUp);
    }

    return(<>
      {/* Crop overlay */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:999}}>
        <div style={{position:'absolute',top:0,left:0,right:0,
          height:obj.cropTop||0,background:'rgba(0,0,0,0.5)'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,
          height:obj.cropBottom||0,background:'rgba(0,0,0,0.5)'}}/>
        <div style={{position:'absolute',top:obj.cropTop||0,left:0,
          width:obj.cropLeft||0,height:cropH,background:'rgba(0,0,0,0.5)'}}/>
        <div style={{position:'absolute',top:obj.cropTop||0,right:0,
          width:obj.cropRight||0,height:cropH,background:'rgba(0,0,0,0.5)'}}/>
        <div style={{position:'absolute',
          top:obj.cropTop||0,left:obj.cropLeft||0,
          width:cropW,height:cropH,
          border:'2px solid #6C63FF',boxSizing:'border-box'}}/>
        {/* Rule of thirds */}
        <div style={{...lineStyle,top:(obj.cropTop||0)+cropH/3,
          left:obj.cropLeft||0,width:cropW,height:1}}/>
        <div style={{...lineStyle,top:(obj.cropTop||0)+cropH*2/3,
          left:obj.cropLeft||0,width:cropW,height:1}}/>
        <div style={{...lineStyle,left:(obj.cropLeft||0)+cropW/3,
          top:obj.cropTop||0,width:1,height:cropH}}/>
        <div style={{...lineStyle,left:(obj.cropLeft||0)+cropW*2/3,
          top:obj.cropTop||0,width:1,height:cropH}}/>
      </div>

      {/* Edge handles */}
      <div onPointerDown={e=>startCropDrag(e,'top')}
        style={{...handleStyle,top:(obj.cropTop||0)-5,
          left:'50%',transform:'translateX(-50%)',
          width:40,height:10,borderRadius:3,cursor:'ns-resize'}}/>
      <div onPointerDown={e=>startCropDrag(e,'bottom')}
        style={{...handleStyle,bottom:(obj.cropBottom||0)-5,
          left:'50%',transform:'translateX(-50%)',
          width:40,height:10,borderRadius:3,cursor:'ns-resize'}}/>
      <div onPointerDown={e=>startCropDrag(e,'left')}
        style={{...handleStyle,left:(obj.cropLeft||0)-5,
          top:'50%',transform:'translateY(-50%)',
          width:10,height:40,borderRadius:3,cursor:'ew-resize'}}/>
      <div onPointerDown={e=>startCropDrag(e,'right')}
        style={{...handleStyle,right:(obj.cropRight||0)-5,
          top:'50%',transform:'translateY(-50%)',
          width:10,height:40,borderRadius:3,cursor:'ew-resize'}}/>

      {/* Corner handles */}
      {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h])=>(
        <div key={v+h}
          onPointerDown={e=>{
            e.stopPropagation();
            e.preventDefault();
            const startMouseX = e.clientX;
            const startMouseY = e.clientY;
            const startCropTop    = obj.cropTop    || 0;
            const startCropBottom = obj.cropBottom || 0;
            const startCropLeft   = obj.cropLeft   || 0;
            const startCropRight  = obj.cropRight  || 0;
            const maxW = obj.width  - 20;
            const maxH = obj.height - 20;
            const currentRef = {
              cropTop:startCropTop,cropBottom:startCropBottom,
              cropLeft:startCropLeft,cropRight:startCropRight,
            };
            function onMove(ev){
              const dx=(ev.clientX-startMouseX)/zoom;
              const dy=(ev.clientY-startMouseY)/zoom;
              const updates={};
              if(v==='top')    updates.cropTop    =Math.max(0,Math.min(maxH-startCropBottom,startCropTop+dy));
              if(v==='bottom') updates.cropBottom =Math.max(0,Math.min(maxH-startCropTop,startCropBottom-dy));
              if(h==='left')   updates.cropLeft   =Math.max(0,Math.min(maxW-startCropRight,startCropLeft+dx));
              if(h==='right')  updates.cropRight  =Math.max(0,Math.min(maxW-startCropLeft,startCropRight-dx));
              Object.assign(currentRef,updates);
              updateLayerSilent(obj.id,updates);
            }
            function onUp(){
              updateLayer(obj.id,{
                cropTop:currentRef.cropTop,cropBottom:currentRef.cropBottom,
                cropLeft:currentRef.cropLeft,cropRight:currentRef.cropRight,
              });
              window.removeEventListener('pointermove',onMove);
              window.removeEventListener('pointerup',onUp);
            }
            window.addEventListener('pointermove',onMove,{passive:false});
            window.addEventListener('pointerup',onUp);
          }}
          style={{...handleStyle,
            [v]:(v==='top'?(obj.cropTop||0):obj.cropBottom||0)-6,
            [h]:(h==='left'?(obj.cropLeft||0):obj.cropRight||0)-6,
            width:12,height:12,borderRadius:2,
            cursor:v==='top'&&h==='left'?'nw-resize':
                   v==='top'&&h==='right'?'ne-resize':
                   v==='bottom'&&h==='left'?'sw-resize':'se-resize',
          }}/>
      ))}
    </>);
  }

  function renderResizeHandles(obj){
    if(!canDrag)return null;
    const hs={position:'absolute',width:8,height:8,background:'#fff',border:`1.5px solid ${T.accent}`,borderRadius:2,zIndex:1000};
    return(<>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,bottom:-4,right:-4,cursor:'se-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,bottom:-4,left:-4,cursor:'sw-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,top:-4,right:-4,cursor:'ne-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,top:-4,left:-4,cursor:'nw-resize'}}/>
      <div style={{
        position:'absolute',top:-20,left:'50%',
        width:2,height:20,
        background:T.accent,
        transform:'translateX(-50%)',
        pointerEvents:'none',
        zIndex:1000,
      }}/>
      <div
        onPointerDown={e=>{
          e.stopPropagation();e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const startAngle=Math.atan2(
            e.clientY-(canvasRef.current.getBoundingClientRect().top+zoomRef.current*(obj.y+(obj.height||50)/2)),
            e.clientX-(canvasRef.current.getBoundingClientRect().left+zoomRef.current*(obj.x+(obj.width||100)/2))
          )*180/Math.PI;
          const startRotation=obj.rotation||0;
          function onMove(ev){
            const angle=Math.atan2(
              ev.clientY-(canvasRef.current.getBoundingClientRect().top+zoomRef.current*(obj.y+(obj.height||50)/2)),
              ev.clientX-(canvasRef.current.getBoundingClientRect().left+zoomRef.current*(obj.x+(obj.width||100)/2))
            )*180/Math.PI;
            const newRot=startRotation+(angle-startAngle);
            updateLayerSilent(obj.id,{rotation:newRot});
          }
          function onUp(){
            updateLayer(obj.id,{rotation:obj.rotation||0});
            window.removeEventListener('pointermove',onMove);
            window.removeEventListener('pointerup',onUp);
          }
          window.addEventListener('pointermove',onMove);
          window.addEventListener('pointerup',onUp);
        }}
        style={{
          position:'absolute',top:-28,left:'50%',
          transform:'translateX(-50%)',
          width:18,height:18,
          background:'#fff',
          border:`2px solid ${T.accent}`,
          borderRadius:'50%',
          cursor:'grab',
          zIndex:1001,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:10,userSelect:'none',
        }}
        title="Rotate">↻</div>
    </>);
  }
  function getLayerCursor(obj){if(activeTool==='brush')return'crosshair';if(canDrag&&!obj.locked)return'grab';return'pointer';}

  function renderLayerElement(obj){
    if(obj.hidden)return null;
    if(obj.id===brushingImageId)return null;
    const isSelected=selectedId===obj.id;
    const zIndex=layers.indexOf(obj)+1;
    const opacityVal=(obj.opacity??100)/100;
    const selStyle=isSelected?{outline:`1.5px solid ${T.accent}`,outlineOffset:2}:{};
    const flipStyle={transform:`rotate(${obj.rotation||0}deg) scale(${obj.flipH?-1:1},${obj.flipV?-1:1})`};
    const blendStyle={mixBlendMode:obj.blendMode||'normal'};
    const cursor=getLayerCursor(obj);
    const effectsStyle=getEffectsStyle(obj.effects);
    const DelBtn=()=>isSelected&&obj.type!=='background'?(<div onClick={e=>{e.stopPropagation();deleteLayer(obj.id);}} style={{position:'absolute',top:-10,right:-10,width:20,height:20,background:T.danger,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',cursor:'pointer',zIndex:999,fontWeight:'bold',userSelect:'none'}}>×</div>):null;

    if(obj.type==='background')return(
      <div key={obj.id} onMouseDown={e=>{e.stopPropagation();justSelectedRef.current=true;setSelectedId(obj.id);setActiveTool('background');}}
        style={{position:'absolute',left:0,top:0,width:p.preview.w,height:p.preview.h,zIndex:0,opacity:opacityVal,background:obj.bgGradient?`linear-gradient(180deg,${obj.bgGradient[0]},${obj.bgGradient[1]})`:obj.bgColor,cursor:'pointer'}}>
        {isSelected&&<div style={{position:'absolute',inset:0,border:`1.5px dashed ${T.accent}`,pointerEvents:'none'}}/>}
        {showGrid&&<div style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:'20px 20px'}}/>}
        {showRuler&&<>
          <div style={{position:'absolute',top:0,left:0,right:0,height:16,background:'rgba(0,0,0,0.5)',pointerEvents:'none',overflow:'hidden'}}>{Array.from({length:Math.floor(p.preview.w/40)}).map((_,i)=>(<div key={i} style={{position:'absolute',left:i*40,fontSize:7,color:'rgba(255,255,255,0.7)',paddingLeft:2,top:4}}>{i*40}</div>))}</div>
          <div style={{position:'absolute',top:0,left:0,bottom:0,width:16,background:'rgba(0,0,0,0.5)',pointerEvents:'none',overflow:'hidden'}}>{Array.from({length:Math.floor(p.preview.h/40)}).map((_,i)=>(<div key={i} style={{position:'absolute',top:i*40+4,left:1,fontSize:7,color:'rgba(255,255,255,0.7)'}}>{i*40}</div>))}</div>
        </>}
      </div>
    );
    if(obj.type==='text'){
      const ts=(()=>{const pts=[];if(obj.shadowEnabled)pts.push(`${obj.shadowX||2}px ${obj.shadowY||2}px ${obj.shadowBlur||14}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);if(obj.glowEnabled)pts.push(`0 0 20px ${obj.glowColor||'#6C63FF'}`);return pts.length?pts.join(','):'none';})();
      return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,userSelect:'none',...selStyle,...blendStyle,...flipStyle,...effectsStyle}}><span style={{fontFamily:obj.fontFamily,fontSize:obj.fontSize,fontWeight:obj.fontWeight||700,fontStyle:obj.fontItalic?'italic':'normal',color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth}px ${obj.strokeColor}`:'none',textShadow:ts,whiteSpace:'nowrap',letterSpacing:`${obj.letterSpacing||0}px`,lineHeight:obj.lineHeight||1.2,display:'block'}}>{obj.arcEnabled?<ArcText obj={obj}/>:obj.text}</span>{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    }
    if(obj.type==='shape')return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,...selStyle,...blendStyle,...flipStyle,...effectsStyle}}>{renderShapeSVG(obj.shape,obj.fillColor,obj.strokeColor,obj.width,obj.height)}{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    if(obj.type==='svg')return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,width:obj.width,height:obj.height,...selStyle,...blendStyle,...flipStyle,...effectsStyle}}><div style={{width:'100%',height:'100%'}} dangerouslySetInnerHTML={{__html:obj.svg}}/>{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    if(obj.type==='image'){
      const cropW=obj.width-(obj.cropLeft||0)-(obj.cropRight||0);
      const cropH=obj.height-(obj.cropTop||0)-(obj.cropBottom||0);
      const hasMask=obj.mask?.enabled&&obj.mask?.data;
      return(
        <div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)}
          style={{
            position:'absolute',left:obj.x,top:obj.y,zIndex,
            opacity:opacityVal,cursor,...selStyle,...blendStyle,
            overflow:'hidden',width:cropW,height:cropH,...effectsStyle,
            WebkitMaskImage: hasMask?`url(${obj.mask.data})`:'none',
            WebkitMaskSize: hasMask?`${cropW}px ${cropH}px`:'none',
            WebkitMaskRepeat:'no-repeat',
            maskImage: hasMask?`url(${obj.mask.data})`:'none',
            maskSize: hasMask?`${cropW}px ${cropH}px`:'none',
            maskRepeat:'no-repeat',
          }}>
          <img src={obj.src} alt="" style={{
            width:obj.width,height:obj.height,display:'block',
            pointerEvents:'none',
            marginLeft:-(obj.cropLeft||0),marginTop:-(obj.cropTop||0),
            transform:`scale(${obj.flipH?-1:1},${obj.flipV?-1:1})`,
            filter:`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${obj.imgBlur||0}px)`,
          }}/>
          {isSelected&&renderResizeHandles(obj)}
          {isSelected&&renderCropHandles(obj)}
          <DelBtn/>
          {obj.mask?.enabled&&(
            <div style={{
              position:'absolute',bottom:-18,left:0,fontSize:9,
              background:'rgba(108,99,255,0.9)',color:'#fff',
              padding:'2px 6px',borderRadius:3,pointerEvents:'none',
              whiteSpace:'nowrap',
            }}>⊡ Mask active</div>
          )}
        </div>
      );
    }
  }

  const css={
    label:   {fontSize:'10px',color:T.muted,marginBottom:4,marginTop:14,letterSpacing:'0.8px',fontWeight:'600',textTransform:'uppercase',display:'block'},
    input:   {padding:'7px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit'},
    color:   {width:'100%',height:36,borderRadius:6,border:`1px solid ${T.border}`,cursor:'pointer',background:'none'},
    pill:    (a)=>({padding:'3px 10px',borderRadius:4,border:`1px solid ${a?T.accent:T.border}`,background:a?T.accent:'transparent',color:a?'#fff':T.text,fontSize:11,cursor:'pointer',fontWeight:a?'600':'400'}),
    iconBtn: (a)=>({padding:'5px 9px',borderRadius:6,border:`1px solid ${a?T.accent:T.border}`,background:a?T.accent:'transparent',color:a?'#fff':T.text,cursor:'pointer',fontSize:12,fontWeight:a?'600':'400'}),
    toolBtn: (a)=>({padding:'7px 10px',borderRadius:6,border:'none',background:a?`${T.accent}18`:'transparent',color:a?T.accent:T.muted,fontSize:12,cursor:'pointer',textAlign:'left',width:'100%',fontWeight:a?'600':'400',display:'flex',alignItems:'center',gap:8,marginBottom:1}),
    addBtn:  {padding:10,borderRadius:7,background:T.accent,color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:'600',width:'100%',marginTop:12},
    section: {padding:10,background:T.input,borderRadius:7,border:`1px solid ${T.border}`,marginTop:8},
    row:     {display:'flex',gap:6,alignItems:'center'},
    divider: {height:1,background:T.border,margin:'10px 0'},
  };

  const tools=[
    {key:'select',    label:'Select',       icon:'↖',  group:'Tools'},
    {key:'move',      label:'Move',         icon:'✋',  group:'Tools'},
    {key:'crop',      label:'Crop',         icon:'⊡',  group:'Tools'},
    null,
    {key:'text',      label:'Text',         icon:'T',   group:'Create'},
    {key:'shapes',    label:'Shapes',       icon:'○',   group:'Create'},
    {key:'stickers',  label:'Elements',     icon:'◆',   group:'Create'},
    {key:'memes',     label:'Memes & GIFs', icon:'▣',   group:'Create'},
    null,
    {key:'brush',     label:'Brush',        icon:'⌀',  group:'Paint'},
    {key:'rimlight',  label:'Rim Light',    icon:'☀',  group:'Paint'},
    null,
    {key:'background',label:'Background',   icon:'▨',   group:'Design'},
    {key:'effects',   label:'Effects',      icon:'✦',   group:'Design'},
    {key:'adjust',    label:'Adjustments',  icon:'◎',   group:'Design'},
    null,
    {key:'templates', label:'Templates',    icon:'⊞',   group:'Analyze'},
    {key:'ctr',       label:'CTR Score',    icon:'◈',   group:'Analyze'},
    {key:'face',      label:'Face Score',   icon:'◉',   group:'Analyze'},
    {key:'ab',        label:'A/B Variants', icon:'⊟',   group:'Analyze'},
    {key:'resize',    label:'All Sizes',    icon:'⊠',   group:'Analyze'},
    null,
    {key:'upload',    label:'Upload',       icon:'↑',   group:'File'},
    {key:'ai',        label:'AI Generate',  icon:'⚡',  group:'File', pro:true},
  ];

  function CropSlider({label,cropKey,layer}){
    const val=layer[cropKey]||0;
    const max=Math.floor((cropKey==='cropLeft'||cropKey==='cropRight')?layer.width*0.8:layer.height*0.8)||300;
    return(
      <div style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
          <span style={{fontSize:11,color:T.muted,fontWeight:'600'}}>{label}</span>
          <span style={{fontSize:10,color:T.text,fontFamily:'monospace'}}>{val}px</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <button onClick={()=>updateLayer(selectedId,{[cropKey]:Math.max(0,val-5)})} style={{padding:'2px 7px',borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11,flexShrink:0}}>−</button>
          <Slider min={0} max={max} value={val}
            onChange={v=>updateLayerSilent(selectedId,{[cropKey]:v})}
            onCommit={v=>updateLayer(selectedId,{[cropKey]:v})}
            style={{flex:1}}/>
          <button onClick={()=>updateLayer(selectedId,{[cropKey]:Math.min(max,val+5)})} style={{padding:'2px 7px',borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11,flexShrink:0}}>+</button>
        </div>
      </div>
    );
  }

  const StampLayer=memo(function StampLayer({obj,scale}){
    if(obj.hidden||obj.type==='background')return null;
    if(obj.type==='text'){
      const ts=(()=>{const pts=[];if(obj.shadowEnabled)pts.push(`${(obj.shadowX||2)*scale}px ${(obj.shadowY||2)*scale}px ${(obj.shadowBlur||14)*scale}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);return pts.length?pts.join(','):'none';})();
      return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,fontSize:obj.fontSize*scale,fontFamily:obj.fontFamily,fontWeight:obj.fontWeight||700,color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth*scale}px ${obj.strokeColor}`:'none',textShadow:ts,whiteSpace:'nowrap',pointerEvents:'none',opacity:(obj.opacity||100)/100}}>{obj.text}</div>;
    }
    if(obj.type==='image'){
      const cropW=(obj.width-(obj.cropLeft||0)-(obj.cropRight||0))*scale;
      const cropH=(obj.height-(obj.cropTop||0)-(obj.cropBottom||0))*scale;
      return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,width:cropW,height:cropH,overflow:'hidden',opacity:(obj.opacity||100)/100,pointerEvents:'none'}}><img src={obj.src} alt="" style={{width:obj.width*scale,height:obj.height*scale,display:'block',marginLeft:-(obj.cropLeft||0)*scale,marginTop:-(obj.cropTop||0)*scale}}/></div>;
    }
    if(obj.type==='shape')return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,opacity:(obj.opacity||100)/100,transform:`scale(${scale})`,transformOrigin:'top left',pointerEvents:'none'}}>{renderShapeSVG(obj.shape,obj.fillColor,obj.strokeColor,obj.width,obj.height)}</div>;
    if(obj.type==='svg')return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,width:obj.width*scale,height:obj.height*scale,opacity:(obj.opacity||100)/100,pointerEvents:'none'}} dangerouslySetInnerHTML={{__html:obj.svg}}/>;
    return null;
  });

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:T.bg,color:T.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',overflow:'hidden'}}>

      {showFileTab&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowFileTab(false);}}>
          <div style={{width:560,maxHeight:'80vh',background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:14,fontWeight:'700'}}>File</div>
              <button onClick={()=>setShowFileTab(false)} style={{padding:'4px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:11}}>Close</button>
            </div>
            <div style={{display:'flex',flex:1,overflow:'hidden'}}>
              <div style={{width:200,borderRight:`1px solid ${T.border}`,
                padding:'12px',display:'flex',flexDirection:'column',gap:4}}>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  New
                </div>
                <button onClick={newCanvas} style={{...css.addBtn,marginTop:0,
                  background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>
                  + New canvas
                </button>

                <div style={{height:1,background:T.border,margin:'10px 0'}}/>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  Save
                </div>
                <input value={designName} onChange={e=>setDesignName(e.target.value)}
                  style={css.input} placeholder="Design name..."/>
                <button onClick={()=>saveDesign(designName)}
                  style={{...css.addBtn,marginTop:6}}>
                  💾 Save design
                </button>

                <div style={{height:1,background:T.border,margin:'10px 0'}}/>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  Export
                </div>
                <button onClick={()=>{setShowFileTab(false);setShowDownload(true);}}
                  style={{...css.addBtn,marginTop:0,background:T.success}}>
                  ↓ Download PNG/JPG
                </button>
                <button onClick={()=>exportAllPlatforms()}
                  style={{...css.addBtn,marginTop:4,background:'transparent',
                    color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>
                  ⊠ Export all platforms
                </button>
              </div>
              <div style={{flex:1,padding:'12px',overflowY:'auto'}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:10}}>Saved ({savedDesigns.length})</div>
                {savedDesigns.length===0&&<div style={{fontSize:12,color:T.muted,padding:'20px 0',textAlign:'center'}}>No saved designs yet.</div>}
                {savedDesigns.map(d=>(<div key={d.id} style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:T.input,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><div style={{fontSize:13,fontWeight:'600'}}>{d.name}</div><div style={{fontSize:10,color:T.muted,marginTop:2}}>{d.created} · {d.platform}</div></div><div style={{display:'flex',gap:5}}><button onClick={()=>loadDesign(d)} style={{padding:'5px 10px',borderRadius:5,border:`1px solid ${T.accent}`,background:'transparent',color:T.accent,fontSize:11,cursor:'pointer',fontWeight:'600'}}>Open</button><button onClick={()=>deleteDesign(d.id)} style={{padding:'5px 8px',borderRadius:5,border:`1px solid ${T.danger}`,background:'transparent',color:T.danger,fontSize:11,cursor:'pointer'}}>×</button></div></div>))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAiBar&&(
        <div style={{
          position:'fixed',inset:0,zIndex:1000,
          display:'flex',alignItems:'flex-start',justifyContent:'center',
          paddingTop:80,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',
        }} onClick={e=>{if(e.target===e.currentTarget)setShowAiBar(false);}}>
          <div style={{
            width:600,background:T.panel,borderRadius:14,
            border:`1px solid ${T.border}`,
            boxShadow:'0 24px 80px rgba(0,0,0,0.6)',overflow:'hidden',
          }}>
            <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`,
              display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>⚡</span>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input
                    ref={aiCmdInputRef}
                    value={aiCmd}
                    onChange={e=>setAiCmd(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==='Enter') executeAiCommand(aiCmd);
                      if(e.key==='Escape') setShowAiBar(false);
                    }}
                    placeholder='Try: "make it cinematic" or "add gold text EPIC"...'
                    style={{flex:1,background:'transparent',border:'none',
                      outline:'none',fontSize:14,color:T.text,fontFamily:'inherit'}}
                    autoFocus
                  />
                  <div style={{
                    fontSize:9,fontWeight:'700',color:'#f59e0b',
                    background:'rgba(245,158,11,0.12)',
                    border:'1px solid rgba(245,158,11,0.3)',
                    padding:'2px 8px',borderRadius:10,
                    letterSpacing:'0.5px',flexShrink:0,
                    textTransform:'uppercase',
                  }}>
                    Experimental
                  </div>
                </div>
              </div>
              {aiCmdLoading&&(
                <span style={{fontSize:12,color:T.muted,flexShrink:0}}>thinking...</span>
              )}
            </div>
            {aiCmdLog&&(
              <div style={{padding:'10px 20px',fontSize:12,
                color:aiCmdLog.startsWith('✓')?T.success:T.warning,
                borderBottom:`1px solid ${T.border}`,fontWeight:'600'}}>
                {aiCmdLog}
              </div>
            )}
            <div style={{padding:'12px 20px'}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:10,fontWeight:'600',
                textTransform:'uppercase',letterSpacing:'0.5px'}}>
                Example commands
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[
                  'Make it cinematic',
                  'Make the colors more vibrant',
                  'Make it darker and more dramatic',
                  'Make the text bigger and bolder',
                  'Add gold glowing text that says EPIC',
                  'Change the background to dark blue',
                  'Make it look like a gaming thumbnail',
                  'Add a text layer that says WATCH THIS',
                  'Delete the top text layer',
                  'Make the image pop more',
                  'Add a drop shadow to the text',
                  'Make it brighter',
                ].map((example,i)=>(
                  <div key={i}
                    onClick={()=>{ setAiCmd(example); aiCmdInputRef.current?.focus(); }}
                    style={{padding:'7px 10px',borderRadius:6,
                      background:T.input,border:`1px solid ${T.border}`,
                      fontSize:11,color:T.muted,cursor:'pointer',lineHeight:1.4}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                    {example}
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:'10px 20px',borderTop:`1px solid ${T.border}`,
              display:'flex',gap:8,alignItems:'center'}}>
              <button onClick={()=>executeAiCommand(aiCmd)} disabled={aiCmdLoading}
                style={{padding:'8px 20px',borderRadius:7,border:'none',
                  background:T.accent,color:'#fff',cursor:'pointer',
                  fontSize:13,fontWeight:'700',opacity:aiCmdLoading?0.6:1}}>
                {aiCmdLoading?'Working...':'Run command'}
              </button>
              <button onClick={()=>setShowAiBar(false)}
                style={{padding:'8px 14px',borderRadius:7,
                  border:`1px solid ${T.border}`,background:'transparent',
                  color:T.muted,cursor:'pointer',fontSize:12}}>
                Close
              </button>
              <span style={{fontSize:10,color:T.muted,marginLeft:'auto'}}>
                Ctrl+I to open · Enter to run · Esc to close
              </span>
            </div>
          </div>
        </div>
      )}

      {showDownload&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowDownload(false);}}>
          <div style={{width:340,background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,padding:'24px',boxShadow:'0 24px 80px rgba(0,0,0,0.8)'}}>
            <div style={{fontSize:15,fontWeight:'700',marginBottom:4}}>Download image</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:8}}>
              {p.label} · {p.width}×{p.height}px
            </div>
            {!(user?.plan==='pro')&&(
              <div style={{...css.section,marginTop:0,marginBottom:12,
                border:`1px solid ${T.warning}`,fontSize:11,lineHeight:1.6}}>
                <div style={{color:T.warning,fontWeight:'700',marginBottom:4}}>
                  ⚡ Free tier exports at {Math.round(p.width*0.5)}×{Math.round(p.height*0.5)}px
                </div>
                <div style={{color:T.muted}}>
                  Upgrade to Pro for full {p.width}×{p.height}px export.
                </div>
                <button onClick={()=>fetch('https://thumbframe-api-production.up.railway.app/checkout',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({plan:'pro'}),
}).then(r=>r.json()).then(d=>{if(d.url)window.location.href=d.url;})}
                  style={{...css.addBtn,marginTop:8,background:T.warning,
                    color:'#000',fontSize:11,fontWeight:'700'}}>
                  Upgrade to Pro — $15/mo
                </button>
              </div>
            )}
            <div style={css.section}><div style={css.row}><input type="checkbox" id="transp" checked={transparentExport} onChange={e=>setTransparentExport(e.target.checked)} style={{width:16,height:16,cursor:'pointer'}}/><label htmlFor="transp" style={{fontSize:12,color:T.text,cursor:'pointer',flex:1}}>Transparent background</label></div></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:14}}>
              <button onClick={()=>exportCanvas('png',transparentExport)}
                style={{padding:'12px',borderRadius:8,border:`1px solid ${T.border}`,
                  background:T.input,color:T.text,fontSize:13,cursor:'pointer',
                  fontWeight:'600',textAlign:'center'}}>
                <div style={{fontSize:20,marginBottom:4}}>PNG</div>
                <div style={{fontSize:10,color:T.muted}}>Lossless</div>
              </button>
              <button onClick={()=>exportCanvas('jpg',false)}
                style={{padding:'12px',borderRadius:8,border:`1px solid ${T.border}`,
                  background:T.input,color:T.text,fontSize:13,cursor:'pointer',
                  fontWeight:'600',textAlign:'center',opacity:transparentExport?0.4:1}}>
                <div style={{fontSize:20,marginBottom:4}}>JPG</div>
                <div style={{fontSize:10,color:T.muted}}>Smaller</div>
              </button>
              <button onClick={()=>exportCanvas('webp',false)}
                style={{padding:'12px',borderRadius:8,border:`1px solid ${T.border}`,
                  background:T.input,color:T.text,fontSize:13,cursor:'pointer',
                  fontWeight:'600',textAlign:'center',opacity:transparentExport?0.4:1}}>
                <div style={{fontSize:20,marginBottom:4}}>WebP</div>
                <div style={{fontSize:10,color:T.muted}}>Best quality</div>
              </button>
            </div>
            <button onClick={()=>exportCanvas('png',true)} style={{...css.addBtn,background:T.success,marginTop:8}}>PNG with transparency</button>
            <button onClick={()=>setShowDownload(false)} style={{width:'100%',padding:9,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:12,cursor:'pointer',marginTop:8}}>Cancel</button>
          </div>
        </div>
      )}

      {cmdOpen&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:80,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget){setCmdOpen(false);setCmdSuggestions([]);}}}>
          <div style={{width:560,background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:14,color:T.muted,fontFamily:'monospace'}}>⌘</span>
              <input ref={cmdInputRef} value={cmdInput} onChange={e=>{setCmdInput(e.target.value);updateSuggestions(e.target.value);}} onKeyDown={handleCmdKey} placeholder='text "Hello", bg #ff0000, save, align center, help...' style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:14,color:T.text,fontFamily:'inherit'}} autoFocus/>
              <span style={{fontSize:10,color:T.muted,background:T.input,padding:'2px 6px',borderRadius:4,border:`1px solid ${T.border}`}}>Esc</span>
            </div>
            {cmdLog&&<div style={{padding:'6px 16px',fontSize:11,color:T.success,borderBottom:`1px solid ${T.border}`}}>✓ {cmdLog}</div>}
            {cmdSuggestions.length>0&&cmdSuggestions.map((s,i)=>(<div key={i} onClick={()=>{setCmdInput(s.cmd);runCommand(s.cmd);}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',cursor:'pointer',borderBottom:`1px solid ${T.border}`}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span style={{fontSize:13,color:T.text,fontFamily:'monospace'}}>{s.cmd}</span><span style={{fontSize:11,color:T.muted}}>{s.desc}</span></div>))}
            {cmdInput===''&&!showCmdHelp&&(<div style={{padding:'10px 16px'}}><div style={{fontSize:10,color:T.muted,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:8}}>Recent</div>{cmdHistory.slice(0,5).map((h,i)=>(<div key={i} onClick={()=>{setCmdInput(h);runCommand(h);}} style={{padding:'6px 8px',fontSize:12,color:T.text,cursor:'pointer',borderRadius:5,fontFamily:'monospace'}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{h}</div>))}{cmdHistory.length===0&&<div style={{fontSize:12,color:T.muted,padding:'4px 8px'}}>No recent commands</div>}</div>)}
            {showCmdHelp&&(<div style={{maxHeight:360,overflowY:'auto',padding:'8px 0'}}>{ALL_COMMANDS.map((c,i)=>(<div key={i} onClick={()=>setCmdInput(c.cmd)} style={{display:'flex',justifyContent:'space-between',padding:'7px 16px',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span style={{fontSize:12,color:T.accent,fontFamily:'monospace'}}>{c.cmd}</span><span style={{fontSize:11,color:T.muted}}>{c.desc}</span></div>))}</div>)}
            <div style={{padding:'8px 16px',borderTop:`1px solid ${T.border}`,display:'flex',gap:12}}>{[['↑↓','History'],['Tab','Complete'],['Enter','Run'],['Esc','Close']].map(([k,d])=>(<div key={k} style={{display:'flex',gap:4,alignItems:'center'}}><span style={{fontSize:10,background:T.input,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.border}`,color:T.text,fontFamily:'monospace'}}>{k}</span><span style={{fontSize:10,color:T.muted}}>{d}</span></div>))}</div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{display:'flex',alignItems:'center',height:46,padding:'0 12px',background:T.panel,borderBottom:`1px solid ${T.border}`,gap:6,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          {onExit&&<button onClick={onExit} style={{padding:'4px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:11}}>← Back</button>}
          <div style={{fontSize:14,fontWeight:'700',color:T.accent,letterSpacing:'-0.3px'}}>ThumbFrame</div>
          <button onClick={()=>setShowFileTab(true)} style={{padding:'5px 12px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:12,fontWeight:'500',display:'flex',alignItems:'center',gap:5}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>📁 File</button>
        </div>
        <button onClick={()=>{setCmdOpen(true);setTimeout(()=>cmdInputRef.current?.focus(),50);}} style={{flex:1,maxWidth:340,display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:T.input,color:T.muted,cursor:'pointer',fontSize:12,textAlign:'left'}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
          <span style={{fontFamily:'monospace',fontSize:13,color:T.accent}}>⌘</span>
          <span style={{flex:1}}>Command palette...</span>
          {cmdLog&&<span style={{fontSize:10,color:T.success,fontWeight:'600',flexShrink:0}}>✓ {cmdLog}</span>}
          <span style={{fontSize:10,background:T.bg,padding:'1px 6px',borderRadius:4,border:`1px solid ${T.border}`,color:T.muted,flexShrink:0}}>Ctrl+K</span>
        </button>
        <button
          onClick={()=>{setShowAiBar(true);setTimeout(()=>aiCmdInputRef.current?.focus(),50);}}
          style={{
            display:'flex',alignItems:'center',gap:6,
            padding:'6px 14px',borderRadius:8,
            border:`1px solid ${T.accent}`,
            background:`${T.accent}18`,
            color:T.accent,cursor:'pointer',fontSize:12,fontWeight:'600',
            flexShrink:0,
          }}
          title="AI command bar (Ctrl+I)">
          ⚡ AI
          <span style={{
            fontSize:8,fontWeight:'700',color:'#f59e0b',
            background:'rgba(245,158,11,0.15)',
            border:'1px solid rgba(245,158,11,0.3)',
            padding:'1px 5px',borderRadius:8,
          }}>BETA</span>
          <span style={{fontSize:10,background:T.bg,padding:'1px 5px',
            borderRadius:4,border:`1px solid ${T.border}`,color:T.muted}}>
            Ctrl+I
          </span>
        </button>
        <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0,marginLeft:'auto'}}>
          <button onClick={undo} disabled={historyIndex<=0} style={{...css.iconBtn(false),opacity:historyIndex<=0?0.3:1}}>↩</button>
          <button onClick={redo} disabled={historyIndex>=history.length-1} style={{...css.iconBtn(false),opacity:historyIndex>=history.length-1?0.3:1}}>↪</button>
          <button onClick={()=>saveDesign(designName)}
            style={{padding:'6px 14px',borderRadius:7,
              border:`1px solid ${T.border}`,
              background:T.input,color:T.text,
              cursor:'pointer',fontSize:12,fontWeight:'600',
              display:'flex',alignItems:'center',gap:5}}>
            💾 Save
          </button>
          <button onClick={()=>selectedId&&duplicateLayer(selectedId)}
            disabled={!selectedId||selectedLayer?.type==='background'}
            style={{padding:'6px 14px',borderRadius:7,
              border:`1px solid ${T.border}`,
              background:T.input,
              color:(!selectedId||selectedLayer?.type==='background')?T.muted:T.text,
              cursor:'pointer',fontSize:12,fontWeight:'500',
              opacity:(!selectedId||selectedLayer?.type==='background')?0.4:1}}>
            ⧉ Duplicate
          </button>
          <div style={{width:1,height:20,background:T.border,margin:'0 2px'}}/>
          <div style={{display:'flex',gap:1,alignItems:'center',background:T.input,borderRadius:6,padding:'2px 5px',border:`1px solid ${T.border}`}}>
            <button onClick={()=>setZoom(z=>Math.max(0.25,+(z-0.1).toFixed(1)))} style={{padding:'2px 6px',borderRadius:4,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13}}>−</button>
            <input
              type="number"
              value={Math.round(zoom*100)}
              onChange={e=>{
                const v=Number(e.target.value);
                if(!isNaN(v)&&v>=10&&v<=1600) setZoom(v/100);
              }}
              style={{
                width:46,textAlign:'center',
                background:'transparent',border:'none',
                outline:'none',fontSize:11,color:T.text,
                fontFamily:'inherit',cursor:'text',
              }}
              onPointerDown={e=>e.stopPropagation()}
              min={10} max={1600}
            />
            <span style={{fontSize:11,color:T.muted}}>%</span>
            <button onClick={()=>setZoom(z=>Math.min(16,+(z+0.1).toFixed(1)))} style={{padding:'2px 6px',borderRadius:4,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13}}>+</button>
            <button onClick={()=>setZoom(1.5)} style={{padding:'2px 5px',borderRadius:4,border:'none',background:'transparent',color:T.muted,cursor:'pointer',fontSize:10}}>fit</button>
          </div>
          <button onClick={()=>setShowGrid(g=>!g)} style={css.iconBtn(showGrid)} title="Grid">⊞</button>
          <button onClick={()=>setShowRuler(r=>!r)} style={css.iconBtn(showRuler)} title="Ruler">⊢</button>
          <button onClick={()=>setSnapToGrid(s=>!s)} style={css.iconBtn(snapToGrid)} title="Snap">⊡</button>
          <button onClick={()=>setLockAspect(l=>!l)} style={css.iconBtn(lockAspect)} title="Lock aspect">⊠</button>
          <button onClick={()=>setShowSafeZones(s=>!s)} style={{...css.iconBtn(showSafeZones),fontSize:10,padding:'5px 8px',whiteSpace:'nowrap'}} title="Safe zones">⬜ Zones</button>
          <button onClick={()=>setShowStampTest(s=>!s)} style={{...css.iconBtn(showStampTest),fontSize:10,padding:'5px 8px',whiteSpace:'nowrap'}} title="Mobile preview">📱 Mobile</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={css.iconBtn(false)}>{darkMode?'○':'●'}</button>
          <div style={{width:1,height:20,background:T.border,margin:'0 2px'}}/>
          <label style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:12,fontWeight:'500',display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
            ↑ Upload
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{display:'none'}}/>
          </label>
          <button onClick={()=>setShowDownload(true)} style={{padding:'6px 16px',borderRadius:8,border:'none',background:T.success,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:'700',display:'flex',alignItems:'center',gap:5,boxShadow:'0 2px 8px rgba(34,197,94,0.35)'}} onMouseEnter={e=>e.currentTarget.style.background='#16a34a'} onMouseLeave={e=>e.currentTarget.style.background=T.success}>↓ Download</button>
          <button onClick={()=>fetch('https://thumbframe-api-production.up.railway.app/checkout',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({plan:'pro'}),
}).then(r=>r.json()).then(d=>{if(d.url)window.location.href=d.url;})}
            style={{
              padding:'7px 14px',borderRadius:7,
              border:'none',
              background:'linear-gradient(135deg, #f59e0b, #ef4444)',
              color:'#fff',cursor:'pointer',fontSize:12,fontWeight:'700',
              boxShadow:'0 2px 8px rgba(245,158,11,0.4)',
              display:'flex',alignItems:'center',gap:5,
            }}>
            ⚡ Pro — $15/mo
          </button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* Left sidebar */}
        <div style={{width:150,background:T.sidebar,borderRight:`1px solid ${T.border}`,padding:'8px 6px',display:'flex',flexDirection:'column',overflowY:'auto',flexShrink:0}}>
          {(()=>{
            let lastGroup = null;
            return tools.map((t,i)=>{
              if(t===null) return <div key={i} style={{height:1,background:T.border,margin:'3px 6px'}}/>;
              const showLabel = t.group !== lastGroup;
              lastGroup = t.group;
              return(
                <div key={t.key}>
                  {showLabel&&<div style={{
                    fontSize:'8px',color:T.muted,fontWeight:'700',
                    letterSpacing:'0.8px',textTransform:'uppercase',
                    padding:'6px 10px 2px',
                  }}>{t.group}</div>}
                  <button onClick={()=>setActiveTool(t.key)} title={t.label}
                    style={css.toolBtn(activeTool===t.key)}>
                    <span style={{fontSize:13,width:16,textAlign:'center',
                      flexShrink:0,color:activeTool===t.key?T.accent:T.muted}}>
                      {t.icon}
                    </span>
                    <span style={{fontSize:11,flex:1}}>{t.label}</span>
                    {t.pro&&<span style={{
                      fontSize:7,
                      background:'linear-gradient(135deg,#f59e0b,#ef4444)',
                      color:'#fff',padding:'1px 4px',borderRadius:4,
                      fontWeight:'700',flexShrink:0,
                    }}>PRO</span>}
                  </button>
                </div>
              );
            });
          })()}
          <div style={css.divider}/>
          <div style={{fontSize:'8px',color:T.muted,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',padding:'6px 10px 2px',marginTop:4}}>Canvas size</div>
          {Object.entries(PLATFORMS).map(([key,val])=>(
            <button key={key} onClick={()=>setPlatform(key)} style={{...css.toolBtn(platform===key),flexDirection:'column',alignItems:'flex-start',gap:1,padding:'6px 10px'}}>
              <span style={{fontSize:11,fontWeight:'600',color:platform===key?T.accent:T.text}}>{val.label}</span>
              <span style={{fontSize:'9px',color:T.muted}}>{val.width}×{val.height}</span>
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:darkMode?'#080808':'#d0d0d0',overflow:'hidden',position:'relative'}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <div style={{transform:`scale(${zoom})`,transformOrigin:'center center',imageRendering:'high-quality'}}>
              <div ref={canvasRef}
                onMouseMove={(e)=>{
                  if(activeTool==='rimlight'){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const cursor=document.getElementById('rim-cursor');
                    if(cursor){
                      cursor.style.display='block';
                      cursor.style.left=(e.clientX-rect.left)/zoom+'px';
                      cursor.style.top=(e.clientY-rect.top)/zoom+'px';
                      // ✅ Show eyedropper cursor when picking
                      if(rimPickingColor){
                        cursor.style.width='20px';
                        cursor.style.height='20px';
                        cursor.style.border='2px solid #fff';
                        cursor.style.background='rgba(255,255,255,0.3)';
                        cursor.style.boxShadow='0 0 0 1px #000, 0 0 8px rgba(0,0,0,0.5)';
                      } else {
                        const size=(rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8;
                        cursor.style.width=size+'px';
                        cursor.style.height=size+'px';
                        cursor.style.border=`2px solid ${rimLightColor}`;
                        cursor.style.background=`radial-gradient(circle, ${rimLightColor}22 0%, transparent 70%)`;
                        cursor.style.boxShadow=`0 0 12px ${rimLightColor}88`;
                      }
                    }
                    if(rimPaintingRef.current){
                      const x=(e.clientX-rect.left)/zoom;
                      const y=(e.clientY-rect.top)/zoom;
                      applyRimLight(x,y);
                    }
                    return;
                  }
                }}
                onMouseDown={(e)=>{
                  if(activeTool==='rimlight'){
                    e.stopPropagation();
                    e.preventDefault();
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;

                    if(rimPickingColor){
                      // ✅ Eyedropper mode — sample color from canvas at click position
                      const sampleCanvas=document.createElement('canvas');
                      sampleCanvas.width=p.preview.w;
                      sampleCanvas.height=p.preview.h;
                      const sCtx=sampleCanvas.getContext('2d');

                      // Draw all visible layers to sample from
                      const drawNext=(index)=>{
                        if(index>=layers.length){
                          // Sample the pixel
                          const px=Math.round(x),py=Math.round(y);
                          const pixel=sCtx.getImageData(
                            Math.max(0,Math.min(px,p.preview.w-1)),
                            Math.max(0,Math.min(py,p.preview.h-1)),
                            1,1
                          ).data;
                          const r=pixel[0],g=pixel[1],b=pixel[2];
                          const hex='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
                          setRimLightColor(hex);
                          setRimPickedFrom({x:px,y:py,color:hex});
                          setRimPickingColor(false);
                          setCmdLog(`Color picked: ${hex} — now paint to apply`);
                          return;
                        }
                        const obj=layers[index];
                        if(obj.hidden){drawNext(index+1);return;}
                        if(obj.type==='background'){
                          if(obj.bgGradient){
                            const g=sCtx.createLinearGradient(0,0,0,p.preview.h);
                            g.addColorStop(0,obj.bgGradient[0]);
                            g.addColorStop(1,obj.bgGradient[1]);
                            sCtx.fillStyle=g;
                          } else sCtx.fillStyle=obj.bgColor||'#000';
                          sCtx.fillRect(0,0,p.preview.w,p.preview.h);
                          drawNext(index+1);
                        } else if(obj.type==='image'){
                          const img=new Image();
                          img.onload=()=>{
                            sCtx.save();
                            sCtx.globalAlpha=(obj.opacity??100)/100;
                            sCtx.globalCompositeOperation=obj.blendMode||'normal';
                            sCtx.drawImage(img,obj.x,obj.y,obj.width,obj.height);
                            sCtx.restore();
                            drawNext(index+1);
                          };
                          img.onerror=()=>drawNext(index+1);
                          img.src=obj.src;
                        } else {
                          drawNext(index+1);
                        }
                      };
                      drawNext(0);
                      return;
                    }

                    // Normal paint mode
                    rimPaintingRef.current=true;
                    applyRimLight(x,y);
                    return;
                  }
                }}
                onMouseUp={(e)=>{
                  if(activeTool==='rimlight'){
                    rimPaintingRef.current=false;
                    return;
                  }
                }}
                onMouseLeave={(e)=>{
                  if(activeTool==='rimlight'){
                    rimPaintingRef.current=false;
                    const cursor=document.getElementById('rim-cursor');
                    if(cursor) cursor.style.display='none';
                    return;
                  }
                }}
                onClick={(e)=>{
                  if(activeTool==='rimlight') return;
                  if(justSelectedRef.current){justSelectedRef.current=false;return;}
                  if(activeTool==='brush') return;
                  setSelectedId(null);
                }}
                style={{width:p.preview.w,height:p.preview.h,position:'relative',overflow:'hidden',borderRadius:4,boxShadow:'0 8px 40px rgba(0,0,0,0.8)',flexShrink:0,cursor:activeTool==='brush'?'crosshair':
                       activeTool==='rimlight'?(rimPickingColor?'crosshair':'crosshair'):
                       'default'}}>

                {/* Filtered visual layer */}
                <div style={{position:'absolute',inset:0,filter:canvasFilter,zIndex:0,pointerEvents:'none'}}>
                  {layers.map(obj=>{
                    if(obj.hidden)return null;
                    if(obj.id===brushingImageId)return null;
                    const opacityVal=(obj.opacity??100)/100;
                    const blendStyle={mixBlendMode:obj.blendMode||'normal'};
                    const flipStyle={transform:`scale(${obj.flipH?-1:1},${obj.flipV?-1:1})`};
                    const effectsStyle=getEffectsStyle(obj.effects);
                    if(obj.type==='background')return(
                      <div key={`f-${obj.id}`} style={{position:'absolute',left:0,top:0,width:p.preview.w,height:p.preview.h,opacity:opacityVal,background:obj.bgGradient?`linear-gradient(180deg,${obj.bgGradient[0]},${obj.bgGradient[1]})`:obj.bgColor}}>
                        {showGrid&&<div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:'20px 20px'}}/>}
                        {showRuler&&<>
                          <div style={{position:'absolute',top:0,left:0,right:0,height:16,background:'rgba(0,0,0,0.5)',overflow:'hidden'}}>{Array.from({length:Math.floor(p.preview.w/40)}).map((_,i)=>(<div key={i} style={{position:'absolute',left:i*40,fontSize:7,color:'rgba(255,255,255,0.7)',paddingLeft:2,top:4}}>{i*40}</div>))}</div>
                          <div style={{position:'absolute',top:0,left:0,bottom:0,width:16,background:'rgba(0,0,0,0.5)',overflow:'hidden'}}>{Array.from({length:Math.floor(p.preview.h/40)}).map((_,i)=>(<div key={i} style={{position:'absolute',top:i*40+4,left:1,fontSize:7,color:'rgba(255,255,255,0.7)'}}>{i*40}</div>))}</div>
                        </>}
                      </div>
                    );
                    if(obj.type==='text'){const ts=(()=>{const pts=[];if(obj.shadowEnabled)pts.push(`${obj.shadowX||2}px ${obj.shadowY||2}px ${obj.shadowBlur||14}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);if(obj.glowEnabled)pts.push(`0 0 20px ${obj.glowColor||'#6C63FF'}`);return pts.length?pts.join(','):'none';})();return<div key={`f-${obj.id}`} style={{position:'absolute',left:obj.x,top:obj.y,opacity:opacityVal,...blendStyle,...flipStyle,...effectsStyle,fontFamily:obj.fontFamily,fontSize:obj.fontSize,fontWeight:obj.fontWeight||700,color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth}px ${obj.strokeColor}`:'none',textShadow:ts,whiteSpace:'nowrap',letterSpacing:`${obj.letterSpacing||0}px`}}>{obj.text}</div>;}
                    if(obj.type==='image')return<div key={`f-${obj.id}`} style={{position:'absolute',left:obj.x,top:obj.y,opacity:opacityVal,...blendStyle,overflow:'hidden',width:obj.width-(obj.cropLeft||0)-(obj.cropRight||0),height:obj.height-(obj.cropTop||0)-(obj.cropBottom||0),...effectsStyle}}><img src={obj.src} alt="" style={{width:obj.width,height:obj.height,display:'block',transform:`scale(${obj.flipH?-1:1},${obj.flipV?-1:1})`,filter:`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${obj.imgBlur||0}px)`,marginLeft:-(obj.cropLeft||0),marginTop:-(obj.cropTop||0),imageRendering:'high-quality',WebkitFontSmoothing:'antialiased'}}/></div>;
                    if(obj.type==='shape')return<div key={`f-${obj.id}`} style={{position:'absolute',left:obj.x,top:obj.y,opacity:opacityVal,...blendStyle,...flipStyle,...effectsStyle}}>{renderShapeSVG(obj.shape,obj.fillColor,obj.strokeColor,obj.width,obj.height)}</div>;
                    if(obj.type==='svg')return<div key={`f-${obj.id}`} style={{position:'absolute',left:obj.x,top:obj.y,opacity:opacityVal,...blendStyle,...flipStyle,...effectsStyle,width:obj.width,height:obj.height}}><div style={{width:'100%',height:'100%'}} dangerouslySetInnerHTML={{__html:obj.svg}}/></div>;
                    return null;
                  })}
                </div>

                {/* Interactive layer */}
                <div style={{position:'absolute',inset:0,zIndex:1}}>
                  {layers.map(obj=>renderLayerElement(obj))}
                </div>

                {/* ✅ Brush overlay — no CSS width/height, no filter, canvas sizes itself */}
                {brushingImageId&&selectedLayer&&(
                  <div style={{
                    position:'absolute',
                    left:  selectedLayer.type==='background' ? 0 : selectedLayer.x,
                    top:   selectedLayer.type==='background' ? 0 : selectedLayer.y,
                    width: selectedLayer.type==='background' ? p.preview.w  : selectedLayer.width-(selectedLayer.cropLeft||0)-(selectedLayer.cropRight||0),
                    height:selectedLayer.type==='background' ? p.preview.h  : selectedLayer.height-(selectedLayer.cropTop||0)-(selectedLayer.cropBottom||0),
                    zIndex:9999,
                    overflow:'hidden',
                    transformOrigin:'top left',
                  }}>
                    <BrushOverlay
                      ref={brushOverlayRef}
                      layer={selectedLayer ? {
                        ...selectedLayer,
                        src: getLayerSrc(selectedLayer),
                        width:  selectedLayer.type==='background' ? p.preview.w  : selectedLayer.width,
                        height: selectedLayer.type==='background' ? p.preview.h  : selectedLayer.height,
                        x: selectedLayer.type==='background' ? 0 : selectedLayer.x,
                        y: selectedLayer.type==='background' ? 0 : selectedLayer.y,
                      } : null}
                      active={true}
                      zoom={zoom}
                      brushType={brushTypeState}
                      brushSize={brushSizeState}
                      brushStrength={brushStrengthState}
                      brushEdge={brushEdgeState}
                      brushFlow={brushFlowState}
                      brushStabilizer={brushStabilizerState}
                      paintColor={brushColorState}
                      paintAlpha={brushColorAlpha}
                      onUpdate={(updates)=>{
                        if(selectedLayer?.type==='background'){
                          updateLayer(selectedId,{bgColor:'transparent',bgGradient:null,src:updates.src,type:'image',
                            x:0,y:0,width:p.preview.w,height:p.preview.h,
                            cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
                            imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0
                          });
                        } else {
                          updateLayer(selectedId,updates);
                        }
                      }}
                    />
                  </div>
                )}

                {activeTool==='rimlight'&&selectedLayer?.type==='image'&&(
                  <div style={{
                    position:'absolute',
                    inset:0,
                    zIndex:9998,
                    cursor:'crosshair',
                    pointerEvents:'none',
                  }}>
                    <div id="rim-cursor" style={{
                      position:'absolute',
                      width: (rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8+'px',
                      height:(rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8+'px',
                      borderRadius:'50%',
                      border:`2px solid ${rimLightColor}`,
                      background:`radial-gradient(circle, ${rimLightColor}22 0%, transparent 70%)`,
                      transform:'translate(-50%,-50%)',
                      pointerEvents:'none',
                      display:'none',
                      boxShadow:`0 0 12px ${rimLightColor}88`,
                    }}/>
                  </div>
                )}

                {/* Safe zones */}
                {showSafeZones&&(
                  <div style={{position:'absolute',inset:0,zIndex:9998,pointerEvents:'none'}}>
                    <div style={{position:'absolute',top:0,left:0,right:0,padding:'3px 6px',background:'rgba(0,0,0,0.65)',display:'flex',gap:10,alignItems:'center'}}>
                      <span style={{fontSize:7,color:'#ff6666',fontWeight:'700'}}>● TIMESTAMP</span>
                      <span style={{fontSize:7,color:'#ff6666',fontWeight:'700'}}>● WATCH LATER</span>
                      <span style={{fontSize:7,color:'rgba(255,255,100,0.8)',fontWeight:'700'}}>- - SAFE ZONE</span>
                    </div>
                    <div style={{position:'absolute',bottom:0,left:0,right:0,height:5,background:'rgba(255,0,0,0.45)',borderTop:'1px solid rgba(255,80,80,0.8)'}}/>
                    <div style={{position:'absolute',bottom:8,right:8,padding:'2px 6px',borderRadius:3,background:'rgba(0,0,0,0.75)',border:'1.5px solid #ff4444',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:8,color:'#ff8888',fontFamily:'monospace',fontWeight:'700'}}>0:00</span>
                    </div>
                    <div style={{position:'absolute',top:20,right:8,width:24,height:24,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'1.5px solid #ff4444',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:10,color:'#ff8888'}}>+</span>
                    </div>
                    <div style={{position:'absolute',top:20,left:8,right:8,bottom:20,border:'1px dashed rgba(255,255,80,0.55)',borderRadius:2}}/>
                  </div>
                )}
              </div>
            </div>
            <div style={{fontSize:10,color:'#444',letterSpacing:'0.3px'}}>
              {p.label} · {p.width}×{p.height}px · {layers.length} layer{layers.length!==1?'s':''} · {Math.round(zoom*100)}%
            </div>
          </div>

          {/* Stamp test */}
          {showStampTest&&(
            <div style={{position:'absolute',bottom:16,right:16,zIndex:200}}>
              <div style={{background:'#111',borderRadius:10,padding:12,border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 8px 40px rgba(0,0,0,0.8)'}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:8,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',textAlign:'center'}}>📱 Mobile · 150×84px</div>
                <div style={{position:'relative',width:150,height:84,borderRadius:4,overflow:'hidden',border:'1px solid rgba(255,255,255,0.12)',background:bg?.bgGradient?`linear-gradient(180deg,${bg.bgGradient[0]},${bg.bgGradient[1]})`:bg?.bgColor||'#6C63FF'}}>
                  {layers.map(obj=><StampLayer key={obj.id} obj={obj} scale={150/p.preview.w}/>)}
                  <div style={{position:'absolute',bottom:3,right:3,padding:'1px 3px',borderRadius:2,background:'rgba(0,0,0,0.85)',fontSize:6,color:'#fff',fontFamily:'monospace',fontWeight:'700'}}>0:00</div>
                </div>
                <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'10px 0'}}/>
                <div style={{background:'#0f0f0f',borderRadius:6,padding:'8px',display:'flex',gap:8,alignItems:'flex-start',width:260}}>
                  <div style={{position:'relative',width:120,height:68,borderRadius:3,overflow:'hidden',flexShrink:0,background:bg?.bgColor||'#6C63FF'}}>
                    <div style={{position:'absolute',inset:0,background:bg?.bgGradient?`linear-gradient(180deg,${bg.bgGradient[0]},${bg.bgGradient[1]})`:bg?.bgColor||'#6C63FF'}}/>
                    {layers.map(obj=><StampLayer key={obj.id} obj={obj} scale={120/p.preview.w}/>)}
                    <div style={{position:'absolute',bottom:2,right:2,padding:'1px 3px',borderRadius:2,background:'rgba(0,0,0,0.85)',fontSize:5,color:'#fff',fontFamily:'monospace',fontWeight:'700'}}>0:00</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:9,color:'#fff',fontWeight:'600',lineHeight:1.3,marginBottom:2}}>Your video title goes here</div>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.45)'}}>Your Channel</div>
                    <div style={{fontSize:7,color:'rgba(255,255,255,0.3)',marginTop:1}}>1.2M views · 2 days ago</div>
                  </div>
                </div>
                <div style={{marginTop:8,fontSize:8,color:'rgba(255,255,255,0.2)',textAlign:'center'}}>Does your text read at this size?</div>
              </div>
            </div>
          )}
        </div>

        {/* ✅ Right sidebar — stopPropagation on pointer events so sliders never leak to canvas */}
        <div
          onPointerDown={e=>e.stopPropagation()}
          style={{width:272,background:T.sidebar,borderLeft:`1px solid ${T.border}`,display:'flex',flexDirection:'column',flexShrink:0}}
        >
          <div style={{flex:1,padding:'10px 12px',overflowY:'auto'}}>

            {activeTool==='select'&&(
              <div>
                <span style={css.label}>Select tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600',lineHeight:1.8}}>
                  ↖ Click any layer to select it.<br/>
                  <span style={{color:T.muted,fontWeight:'400'}}>Switch to Move ✋ to drag.</span>
                </div>
                {selectedLayer&&selectedLayer.type!=='background'&&(<>
                  <span style={css.label}>Selected — {getLayerName(selectedLayer)}</span>
                  <div style={css.section}>
                    <div style={css.row}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>X</span>
                      <input type="number" value={Math.round(selectedLayer.x)} onChange={e=>updateLayer(selectedId,{x:Number(e.target.value)})} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>Y</span>
                      <input type="number" value={Math.round(selectedLayer.y)} onChange={e=>updateLayer(selectedId,{y:Number(e.target.value)})} style={{...css.input,width:'50%'}}/>
                    </div>
                    {selectedLayer.width&&(<div style={{...css.row,marginTop:6}}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>W</span>
                      <input type="number" value={Math.round(selectedLayer.width||0)} onChange={e=>updateLayer(selectedId,{width:Number(e.target.value)})} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>H</span>
                      <input type="number" value={Math.round(selectedLayer.height||0)} onChange={e=>updateLayer(selectedId,{height:Number(e.target.value)})} style={{...css.input,width:'50%'}}/>
                    </div>)}
                    <span style={{...css.label,marginTop:8}}>Opacity — {selectedLayer.opacity??100}%</span>
                    <Slider min={0} max={100} value={selectedLayer.opacity??100}
                      onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                      onCommit={v=>updateLayer(selectedId,{opacity:v})}
                      style={{width:'100%'}}/>
                    {selectedLayer&&selectedLayer.type!=='background'&&(<>
                      <span style={css.label}>Rotation — {Math.round(selectedLayer.rotation||0)}°</span>
                      <div style={css.row}>
                        <Slider min={-180} max={180} value={selectedLayer.rotation||0}
                          onChange={v=>updateLayerSilent(selectedId,{rotation:v})}
                          onCommit={v=>updateLayer(selectedId,{rotation:v})}
                          style={{flex:1}}/>
                        <button onClick={()=>updateLayer(selectedId,{rotation:0})}
                          style={{padding:'3px 8px',borderRadius:4,border:`1px solid ${T.border}`,
                            background:T.input,color:T.muted,cursor:'pointer',fontSize:10}}>
                          Reset
                        </button>
                      </div>
                    </>)}
                    {selectedLayer?.type==='shape'&&(<>
                      <span style={{...css.label,marginTop:8}}>Fill color</span>
                      <input type="color" value={selectedLayer.fillColor||'#FF4500'}
                        onChange={e=>updateLayer(selectedId,{fillColor:e.target.value})}
                        style={css.color}/>
                      <span style={css.label}>Border color</span>
                      <input type="color" value={selectedLayer.strokeColor||'#000000'}
                        onChange={e=>updateLayer(selectedId,{strokeColor:e.target.value})}
                        style={css.color}/>
                    </>)}
                    {selectedLayer?.type==='text'&&(<>
                      <span style={{...css.label,marginTop:8}}>Text color</span>
                      <input type="color" value={selectedLayer.textColor||'#ffffff'}
                        onChange={e=>updateLayer(selectedId,{textColor:e.target.value})}
                        style={css.color}/>
                      <span style={css.label}>Outline color</span>
                      <input type="color" value={selectedLayer.strokeColor||'#000000'}
                        onChange={e=>updateLayer(selectedId,{strokeColor:e.target.value})}
                        style={css.color}/>
                      <span style={css.label}>Font size — {selectedLayer.fontSize}px</span>
                      <Slider min={8} max={120} value={selectedLayer.fontSize||48}
                        onChange={v=>updateLayerSilent(selectedId,{fontSize:v})}
                        onCommit={v=>updateLayer(selectedId,{fontSize:v})}
                        style={{width:'100%'}}/>
                    </>)}
                    {selectedLayer?.type==='image'&&(<>
                      <span style={{...css.label,marginTop:8}}>Brightness — {selectedLayer.imgBrightness||100}%</span>
                      <Slider min={50} max={200} value={selectedLayer.imgBrightness||100}
                        onChange={v=>updateLayerSilent(selectedId,{imgBrightness:v})}
                        onCommit={v=>updateLayer(selectedId,{imgBrightness:v})}
                        style={{width:'100%'}}/>
                      <span style={css.label}>Contrast — {selectedLayer.imgContrast||100}%</span>
                      <Slider min={50} max={200} value={selectedLayer.imgContrast||100}
                        onChange={v=>updateLayerSilent(selectedId,{imgContrast:v})}
                        onCommit={v=>updateLayer(selectedId,{imgContrast:v})}
                        style={{width:'100%'}}/>
                    </>)}
                    <div style={{display:'flex',gap:5,marginTop:10}}>
                      <button onClick={()=>duplicateLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>Duplicate</button>
                      <button onClick={()=>deleteLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:T.danger}}>Delete</button>
                    </div>
                  </div>
                </>)}
                <span style={css.label}>Shortcuts</span>
                <div style={css.section}>
                  {[['Delete','Remove'],['Ctrl+D','Duplicate'],['Ctrl+C/V','Copy/Paste'],['Ctrl+Z/Y','Undo/Redo'],['Ctrl+K','Commands'],['Ctrl+S','Save']].map(([k,d])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:`1px solid ${T.border}`}}>
                      <span style={{fontSize:10,color:T.muted}}>{d}</span>
                      <span style={{fontSize:9,color:T.text,fontFamily:'monospace',background:T.bg,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.border}`}}>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTool==='move'&&(
              <div>
                <span style={css.label}>Move tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600',lineHeight:1.8}}>
                  ✋ Drag any layer to move it.<br/>
                  <span style={{color:T.muted,fontWeight:'400'}}>Corner handles to resize.</span>
                </div>
                {selectedLayer&&selectedLayer.type!=='background'&&(<>
                  <span style={css.label}>Align</span>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                    {[['Center','center'],['H ctr','center-h'],['V ctr','center-v'],['Left','left'],['Right','right'],['Top','top'],['Bottom','bottom']].map(([label,dir])=>(
                      <button key={dir} onClick={()=>alignLayer(selectedId,dir)} style={{padding:'6px 2px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:9,cursor:'pointer',textAlign:'center'}}>{label}</button>
                    ))}
                  </div>
                  <span style={css.label}>Flip</span>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={()=>flipLayer(selectedId,'h')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↔ H</button>
                    <button onClick={()=>flipLayer(selectedId,'v')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↕ V</button>
                  </div>
                  <span style={css.label}>Blend mode</span>
                  <select value={selectedLayer.blendMode||'normal'} onChange={e=>updateLayer(selectedId,{blendMode:e.target.value})} style={css.input}>{BLEND_MODES.map(m=><option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}</select>
                  <span style={css.label}>Position</span>
                  <div style={css.section}>
                    <div style={css.row}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>X</span>
                      <input type="number" value={Math.round(selectedLayer.x)} onChange={e=>updateLayer(selectedId,{x:Number(e.target.value)})} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>Y</span>
                      <input type="number" value={Math.round(selectedLayer.y)} onChange={e=>updateLayer(selectedId,{y:Number(e.target.value)})} style={{...css.input,width:'50%'}}/>
                    </div>
                    {selectedLayer.width&&(<div style={{...css.row,marginTop:6}}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>W</span>
                      <input type="number" value={Math.round(selectedLayer.width||0)} onChange={e=>updateLayer(selectedId,{width:Number(e.target.value)})} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>H</span>
                      <input type="number" value={Math.round(selectedLayer.height||0)} onChange={e=>updateLayer(selectedId,{height:Number(e.target.value)})} style={{...css.input,width:'50%'}}/>
                    </div>)}
                    <span style={{...css.label,marginTop:8}}>Opacity — {selectedLayer.opacity??100}%</span>
                    <Slider min={0} max={100} value={selectedLayer.opacity??100}
                      onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                      onCommit={v=>updateLayer(selectedId,{opacity:v})}
                      style={{width:'100%'}}/>
                    <div style={{display:'flex',gap:5,marginTop:10}}>
                      <button onClick={()=>duplicateLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>Duplicate</button>
                      <button onClick={()=>deleteLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:T.danger}}>Delete</button>
                    </div>
                  </div>
                </>)}
              </div>
            )}

            {activeTool==='crop'&&(
              <div>
                <span style={css.label}>Crop tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Click an image on the canvas, then crop each edge.</div>
                {!selectedLayer||selectedLayer.type!=='image'?(
                  <div style={{...css.section,marginTop:8,fontSize:12,color:T.muted,textAlign:'center',padding:20}}><div style={{fontSize:24,marginBottom:8}}>⊡</div>Click an image to begin cropping</div>
                ):(
                  <>
                    <div style={{...css.section,marginTop:8,padding:12}}>
                      <div style={{fontSize:10,color:T.muted,marginBottom:10,fontWeight:'600',textTransform:'uppercase'}}>Crop edges</div>
                      <CropSlider label="↓ Top"    cropKey="cropTop"    layer={selectedLayer}/>
                      <CropSlider label="↑ Bottom" cropKey="cropBottom" layer={selectedLayer}/>
                      <CropSlider label="→ Left"   cropKey="cropLeft"   layer={selectedLayer}/>
                      <CropSlider label="← Right"  cropKey="cropRight"  layer={selectedLayer}/>
                      <button onClick={()=>updateLayer(selectedId,{cropTop:0,cropBottom:0,cropLeft:0,cropRight:0})} style={{...css.addBtn,marginTop:8,background:'transparent',color:T.muted,border:`1px solid ${T.border}`}}>Reset crop</button>
                    </div>
                    <span style={css.label}>Quick ratios</span>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:5}}>
                      {[['Square','1:1'],['Wide','16:9'],['Portrait','9:16'],['Classic','4:3']].map(([label,ratio])=>(
                        <button key={ratio} onClick={()=>{
                          const [rw,rh]=ratio.split(':').map(Number);
                          const targetH=Math.round(selectedLayer.width/(rw/rh));
                          const diff=selectedLayer.height-targetH;
                          if(diff>0){updateLayer(selectedId,{cropTop:Math.round(diff/2),cropBottom:Math.round(diff/2),cropLeft:0,cropRight:0});}
                          else{const wDiff=selectedLayer.width-Math.round(selectedLayer.height*(rw/rh));updateLayer(selectedId,{cropTop:0,cropBottom:0,cropLeft:Math.round(Math.max(0,wDiff)/2),cropRight:Math.round(Math.max(0,wDiff)/2)});}
                        }} style={{padding:'8px 4px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:11,cursor:'pointer',textAlign:'center'}}>
                          {label}<br/><span style={{fontSize:9,color:T.muted}}>{ratio}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTool==='brush'&&(
              <div>
                <span style={css.label}>Brush tools</span>
                {!selectedLayer||(selectedLayer.type!=='image'&&selectedLayer.type!=='background')?(
                  <div style={{...css.section,marginTop:0,fontSize:12,color:T.muted,textAlign:'center',padding:20}}><div style={{fontSize:24,marginBottom:8}}>⌀</div>Click an image on the canvas first</div>
                ):(
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600'}}>✓ Image selected — paint on the canvas</div>
                )}
                <BrushTool
                  layer={(selectedLayer?.type==='image'||selectedLayer?.type==='background')?selectedLayer:null}
                  theme={T}
                  brushOverlayRef={brushOverlayRef}
                  brushType={brushTypeState}
                  brushSize={brushSizeState}
                  brushStrength={brushStrengthState}
                  brushEdge={brushEdgeState}
                  brushFlow={brushFlowState}
                  brushStabilizer={brushStabilizerState}
                  paintColor={brushColorState}
                  paintAlpha={brushColorAlpha}
                  onBrushTypeChange={setBrushTypeState}
                  onBrushSizeChange={setBrushSizeState}
                  onBrushStrengthChange={setBrushStrengthState}
                  onBrushEdgeChange={setBrushEdgeState}
                  onBrushFlowChange={setBrushFlowState}
                  onBrushStabilizerChange={setBrushStabilizerState}
                  onPaintColorChange={(c)=>{
                    setBrushColorState(c);
                  }}
                  onPaintAlphaChange={setBrushColorAlpha}
                  onUpdate={(updates)=>{if(selectedId)updateLayer(selectedId,updates);}}
                />
              </div>
            )}

            {activeTool==='text'&&(
              <div>
                <span style={css.label}>Templates</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:5,marginBottom:4}}>
                  {TEXT_TEMPLATES.map((t,i)=>(<button key={i} onClick={()=>applyTextTemplate(t)} style={{padding:'7px 6px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer',fontFamily:t.fontFamily,fontWeight:t.fontWeight||700,textAlign:'center'}}>{t.label}</button>))}
                </div>
                <span style={css.label}>Content</span>
                <input value={textInput} onChange={e=>setTextInput(e.target.value)} style={css.input} placeholder="Enter text..."/>
                <span style={css.label}>Font family</span>
                <select value={fontFamily} onChange={e=>setFontFamily(e.target.value)} style={css.input}>{FONTS.map(f=><option key={f}>{f}</option>)}</select>
                <span style={css.label}>Font weight</span>
                <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                  {FONT_WEIGHTS.map(fw=>(<button key={fw.value} onClick={()=>setFontWeight(fw.value)} style={{padding:'4px 7px',borderRadius:4,border:`1px solid ${fontWeight===fw.value?T.accent:T.border}`,background:fontWeight===fw.value?T.accent:'transparent',color:fontWeight===fw.value?'#fff':T.text,fontSize:10,cursor:'pointer',fontWeight:fw.value}}>{fw.label}</button>))}
                </div>
                <span style={css.label}>Size — {fontSize}px</span>
                <div style={css.row}>
                  <Slider min={8} max={120} value={fontSize} onChange={v=>setFontSize(v)} style={{flex:1}}/>
                  <input type="number" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))} style={{...css.input,width:50,padding:'5px 6px',textAlign:'center'}}/>
                </div>
                <span style={css.label}>Letter spacing — {letterSpacing}px</span>
                <Slider min={-5} max={30} value={letterSpacing} onChange={v=>setLetterSpacing(v)} style={{width:'100%'}}/>
                <span style={css.label}>Line height — {lineHeight}</span>
                <Slider min={0.8} max={3} step={0.1} value={lineHeight} onChange={v=>setLineHeight(v)} style={{width:'100%'}}/>
                <span style={css.label}>Alignment</span>
                <div style={{display:'flex',gap:4}}>
                  {[['left','Left'],['center','Center'],['right','Right']].map(([val,label])=>(<button key={val} onClick={()=>setTextAlign(val)} style={{...css.iconBtn(textAlign===val),flex:1,textAlign:'center',fontSize:11}}>{label}</button>))}
                </div>
                <span style={css.label}>Style</span>
                <button onClick={()=>setFontItalic(!fontItalic)} style={{...css.iconBtn(fontItalic),width:'100%',textAlign:'center',fontStyle:'italic'}}>Italic</button>
                <span style={css.label}>Text color</span>
                <input type="color" value={textColor} onChange={e=>{setTextColor(e.target.value);addRecentColor(e.target.value);}} style={css.color}/>
                <span style={css.label}>Outline</span>
                <div style={css.row}>
                  <input type="color" value={strokeColor} onChange={e=>setStrokeColor(e.target.value)} style={{...css.color,width:44,flexShrink:0}}/>
                  <Slider min={0} max={20} value={strokeWidth} onChange={v=>setStrokeWidth(v)} style={{flex:1}}/>
                  <span style={{fontSize:10,color:T.muted,minWidth:24}}>{strokeWidth}px</span>
                </div>
                <span style={css.label}>Drop shadow</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>setShadowEnabled(!shadowEnabled)} style={css.iconBtn(shadowEnabled)}>{shadowEnabled?'On':'Off'}</button></div>
                  {shadowEnabled&&<>
                    <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:36}}>Color</span><input type="color" value={shadowColor} onChange={e=>setShadowColor(e.target.value)} style={{...css.color,height:28}}/></div>
                    {[['Blur',shadowBlur,setShadowBlur,0,40],['X',shadowX,setShadowX,-20,20],['Y',shadowY,setShadowY,-20,20]].map(([l,v,sv,mn,mx])=>(<div key={l} style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:28}}>{l}</span><Slider min={mn} max={mx} value={v} onChange={sv} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:20,textAlign:'right'}}>{v}</span></div>))}
                  </>}
                </div>
                <span style={css.label}>Glow</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>setGlowEnabled(!glowEnabled)} style={css.iconBtn(glowEnabled)}>{glowEnabled?'On':'Off'}</button></div>
                  {glowEnabled&&<div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:36}}>Color</span><input type="color" value={glowColor} onChange={e=>setGlowColor(e.target.value)} style={{...css.color,height:28}}/></div>}
                </div>
                <span style={css.label}>Text on arc</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>setArcEnabled(!arcEnabled)} style={css.iconBtn(arcEnabled)}>{arcEnabled?'On':'Off'}</button></div>
                  {arcEnabled&&<><span style={{...css.label,marginTop:8}}>Radius — {arcRadius}px</span><Slider min={60} max={300} value={arcRadius} onChange={v=>setArcRadius(v)} style={{width:'100%'}}/></>}
                </div>
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{recentColors.map((c,i)=>(<div key={i} onClick={()=>setTextColor(c)} style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>))}</div>
                {selectedLayer?.type==='text'&&(<>
                  <span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span>
                  <Slider min={0} max={100} value={selectedLayer.opacity??100}
                    onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                    onCommit={v=>updateLayer(selectedId,{opacity:v})}
                    style={{width:'100%'}}/>
                  <span style={css.label}>Live edit text</span>
                  <input value={selectedLayer.text} onChange={e=>updateLayer(selectedId,{text:e.target.value})} style={css.input} placeholder="Edit text..."/>
                  <span style={css.label}>Letter spacing</span>
                  <Slider min={-5} max={30} value={selectedLayer.letterSpacing||0}
                    onChange={v=>updateLayerSilent(selectedId,{letterSpacing:v})}
                    onCommit={v=>updateLayer(selectedId,{letterSpacing:v})}
                    style={{width:'100%'}}/>
                </>)}
                <button onClick={addText} style={css.addBtn}>Add text</button>
              </div>
            )}

            {activeTool==='shapes'&&(
              <div>
                <span style={css.label}>Shapes & icons</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                  {SHAPES_BASIC.map(({key,label,icon})=>(<button key={key} onClick={()=>addShape(key)} style={{padding:'10px 4px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:9,cursor:'pointer',textAlign:'center',lineHeight:1.5}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.background=`${T.accent}12`;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.input;}}><div style={{fontSize:16,marginBottom:2}}>{icon}</div><div>{label}</div></button>))}
                </div>
                <span style={css.label}>Fill color</span>
                <input type="color" value={fillColor} onChange={e=>{setFillColor(e.target.value);addRecentColor(e.target.value);if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:e.target.value});}} style={css.color}/>
                <div style={css.section}>
                  {[['R',0],['G',1],['B',2]].map(([l,idx])=>{
                    const hex=fillColor.replace('#','');
                    const vals=[parseInt(hex.slice(0,2),16)||0,parseInt(hex.slice(2,4),16)||0,parseInt(hex.slice(4,6),16)||0];
                    const colors=['#f87171','#4ade80','#60a5fa'];
                    return(
                      <div key={l} style={{...css.row,marginBottom:6}}>
                        <span style={{fontSize:11,color:colors[idx],fontWeight:'700',width:12}}>{l}</span>
                        <Slider min={0} max={255} value={vals[idx]}
                          onChange={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setFillColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayerSilent(selectedId,{fillColor:newHex});
                          }}
                          onCommit={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setFillColor(newHex);addRecentColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:newHex});
                          }}
                          style={{flex:1}}/>
                        <span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{vals[idx]}</span>
                      </div>
                    );
                  })}
                  <div style={{width:'100%',height:28,borderRadius:6,background:fillColor,margin:'4px 0 6px',border:`1px solid ${T.border}`}}/>
                </div>
                <span style={css.label}>Border color</span>
                <input type="color" value={strokeColor} onChange={e=>{setStrokeColor(e.target.value);if(selectedLayer?.type==='shape')updateLayer(selectedId,{strokeColor:e.target.value});}} style={css.color}/>
                <div style={css.section}>
                  {[['R',0],['G',1],['B',2]].map(([l,idx])=>{
                    const hex=strokeColor.replace('#','');
                    const vals=[parseInt(hex.slice(0,2),16)||0,parseInt(hex.slice(2,4),16)||0,parseInt(hex.slice(4,6),16)||0];
                    const colors=['#f87171','#4ade80','#60a5fa'];
                    return(
                      <div key={l} style={{...css.row,marginBottom:6}}>
                        <span style={{fontSize:11,color:colors[idx],fontWeight:'700',width:12}}>{l}</span>
                        <Slider min={0} max={255} value={vals[idx]}
                          onChange={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setStrokeColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayerSilent(selectedId,{strokeColor:newHex});
                          }}
                          onCommit={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setStrokeColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayer(selectedId,{strokeColor:newHex});
                          }}
                          style={{flex:1}}/>
                        <span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{vals[idx]}</span>
                      </div>
                    );
                  })}
                  <div style={{width:'100%',height:28,borderRadius:6,background:strokeColor,margin:'4px 0 6px',border:`1px solid ${T.border}`}}/>
                </div>
                {selectedLayer?.type==='shape'&&(<>
                  <span style={css.label}>Blend mode</span>
                  <select value={selectedLayer.blendMode||'normal'} onChange={e=>updateLayer(selectedId,{blendMode:e.target.value})} style={css.input}>{BLEND_MODES.map(m=><option key={m} value={m}>{m}</option>)}</select>
                  <span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span>
                  <Slider min={0} max={100} value={selectedLayer.opacity??100}
                    onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                    onCommit={v=>updateLayer(selectedId,{opacity:v})}
                    style={{width:'100%'}}/>
                  <div style={{display:'flex',gap:5,marginTop:8}}>
                    <button onClick={()=>flipLayer(selectedId,'h')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↔ H</button>
                    <button onClick={()=>flipLayer(selectedId,'v')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↕ V</button>
                  </div>
                </>)}
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                  {recentColors.map((c,i)=>(
                    <div key={i} onClick={()=>{setFillColor(c);addRecentColor(c);if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:c});}}
                      style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>
                  ))}
                </div>
              </div>
            )}

            {activeTool==='effects'&&(
              <div>
                <span style={css.label}>Layer effects</span>
                {!selectedLayer||selectedLayer.type==='background'?(
                  <div style={{...css.section,marginTop:0,fontSize:12,color:T.muted,textAlign:'center',padding:20}}><div style={{fontSize:24,marginBottom:8}}>✦</div>Click any layer to apply effects</div>
                ):(
                  <>
                    <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600'}}>✦ Non-destructive — editable anytime</div>
                    <span style={css.label}>Blur — {selectedLayer.effects?.layerBlur||0}px</span>
                    <Slider min={0} max={30} value={selectedLayer.effects?.layerBlur||0}
                      onChange={v=>updateLayerEffectSilent(selectedId,'layerBlur',v)}
                      onCommit={v=>updateLayerEffect(selectedId,'layerBlur',v)}
                      style={{width:'100%'}}/>
                    <span style={css.label}>Brightness — {selectedLayer.effects?.brightness||100}%</span>
                    <Slider min={0} max={200} value={selectedLayer.effects?.brightness||100}
                      onChange={v=>updateLayerEffectSilent(selectedId,'brightness',v)}
                      onCommit={v=>updateLayerEffect(selectedId,'brightness',v)}
                      style={{width:'100%'}}/>
                    <span style={css.label}>Contrast — {selectedLayer.effects?.contrast||100}%</span>
                    <Slider min={0} max={300} value={selectedLayer.effects?.contrast||100}
                      onChange={v=>updateLayerEffectSilent(selectedId,'contrast',v)}
                      onCommit={v=>updateLayerEffect(selectedId,'contrast',v)}
                      style={{width:'100%'}}/>
                    <span style={css.label}>Saturation — {selectedLayer.effects?.saturation||100}%</span>
                    <Slider min={0} max={300} value={selectedLayer.effects?.saturation||100}
                      onChange={v=>updateLayerEffectSilent(selectedId,'saturation',v)}
                      onCommit={v=>updateLayerEffect(selectedId,'saturation',v)}
                      style={{width:'100%'}}/>
                    <span style={css.label}>Drop shadow</span>
                    <div style={css.section}>
                      <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>updateLayerEffectNested(selectedId,'shadow','enabled',!(selectedLayer.effects?.shadow?.enabled))} style={css.iconBtn(selectedLayer.effects?.shadow?.enabled)}>{selectedLayer.effects?.shadow?.enabled?'On':'Off'}</button></div>
                      {selectedLayer.effects?.shadow?.enabled&&<>
                        <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:40}}>Color</span><input type="color" value={selectedLayer.effects.shadow.color||'#000000'} onChange={e=>updateLayerEffectNested(selectedId,'shadow','color',e.target.value)} style={{...css.color,height:28}}/></div>
                        {[['X','x',-20,20],['Y','y',-20,20],['Blur','blur',0,40],['Opacity','opacity',0,100]].map(([l,k,mn,mx])=>(<div key={k} style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:40}}>{l}</span><Slider min={mn} max={mx} value={selectedLayer.effects.shadow[k]??0} onChange={v=>updateLayerEffectNestedSilent(selectedId,'shadow',k,v)} onCommit={v=>updateLayerEffectNested(selectedId,'shadow',k,v)} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:24,textAlign:'right'}}>{selectedLayer.effects.shadow[k]??0}</span></div>))}
                      </>}
                    </div>
                    <span style={css.label}>Glow</span>
                    <div style={css.section}>
                      <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>updateLayerEffectNested(selectedId,'glow','enabled',!(selectedLayer.effects?.glow?.enabled))} style={css.iconBtn(selectedLayer.effects?.glow?.enabled)}>{selectedLayer.effects?.glow?.enabled?'On':'Off'}</button></div>
                      {selectedLayer.effects?.glow?.enabled&&<>
                        <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:40}}>Color</span><input type="color" value={selectedLayer.effects.glow.color||'#6C63FF'} onChange={e=>updateLayerEffectNested(selectedId,'glow','color',e.target.value)} style={{...css.color,height:28}}/></div>
                        <div style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:40}}>Blur</span><Slider min={0} max={60} value={selectedLayer.effects.glow.blur||20} onChange={v=>updateLayerEffectNestedSilent(selectedId,'glow','blur',v)} onCommit={v=>updateLayerEffectNested(selectedId,'glow','blur',v)} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:24,textAlign:'right'}}>{selectedLayer.effects.glow.blur||20}</span></div>
                      </>}
                    </div>
                    <span style={css.label}>Outline</span>
                    <div style={css.section}>
                      <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>updateLayerEffectNested(selectedId,'outline','enabled',!(selectedLayer.effects?.outline?.enabled))} style={css.iconBtn(selectedLayer.effects?.outline?.enabled)}>{selectedLayer.effects?.outline?.enabled?'On':'Off'}</button></div>
                      {selectedLayer.effects?.outline?.enabled&&<>
                        <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:40}}>Color</span><input type="color" value={selectedLayer.effects.outline.color||'#ffffff'} onChange={e=>updateLayerEffectNested(selectedId,'outline','color',e.target.value)} style={{...css.color,height:28}}/></div>
                        <div style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:40}}>Width</span><Slider min={0} max={20} value={selectedLayer.effects.outline.width||2} onChange={v=>updateLayerEffectNestedSilent(selectedId,'outline','width',v)} onCommit={v=>updateLayerEffectNested(selectedId,'outline','width',v)} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:24,textAlign:'right'}}>{selectedLayer.effects.outline.width||2}px</span></div>
                      </>}
                    </div>
                    <span style={css.label}>Layer mask</span>
                    <div style={css.section}>
                      {!selectedLayer?.mask?.enabled?(
                        <div>
                          <div style={{fontSize:11,color:T.muted,marginBottom:8,lineHeight:1.6}}>
                            A mask hides parts of a layer non-destructively. Paint black to hide, white to reveal.
                          </div>
                          <button onClick={()=>addMaskToLayer(selectedId)}
                            style={{...css.addBtn,marginTop:0,background:T.accent}}>
                            + Add mask
                          </button>
                        </div>
                      ):(
                        <div>
                          <div style={{...css.row,marginBottom:8}}>
                            <div style={{width:36,height:36,borderRadius:5,border:`2px solid ${T.accent}`,
                              background:`url(${selectedLayer.mask.data}) center/cover`,flexShrink:0}}/>
                            <div style={{flex:1,fontSize:11,color:T.text,lineHeight:1.5}}>
                              Mask active<br/>
                              <span style={{color:T.muted,fontSize:10}}>
                                {selectedLayer.mask.inverted?'Inverted':'Normal'}
                              </span>
                            </div>
                          </div>
                          <div style={{display:'flex',gap:5,flexDirection:'column'}}>
                            <button onClick={()=>updateLayer(selectedId,{
                              mask:{...selectedLayer.mask,inverted:!selectedLayer.mask.inverted}
                            })} style={{...css.addBtn,marginTop:0,background:T.input,
                              color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>
                              ⊞ {selectedLayer.mask.inverted?'Uninvert':'Invert'} mask
                            </button>
                            <button onClick={()=>{
                              const tmp=document.createElement('canvas');
                              tmp.width=selectedLayer.mask.width||selectedLayer.width;
                              tmp.height=selectedLayer.mask.height||selectedLayer.height;
                              const ctx=tmp.getContext('2d');
                              ctx.fillStyle='#ffffff';
                              ctx.fillRect(0,0,tmp.width,tmp.height);
                              updateLayer(selectedId,{mask:{...selectedLayer.mask,data:tmp.toDataURL()}});
                            }} style={{...css.addBtn,marginTop:0,background:T.input,
                              color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>
                              ◻ Clear mask (show all)
                            </button>
                            <button onClick={()=>{
                              const tmp=document.createElement('canvas');
                              tmp.width=selectedLayer.mask.width||selectedLayer.width;
                              tmp.height=selectedLayer.mask.height||selectedLayer.height;
                              const ctx=tmp.getContext('2d');
                              ctx.fillStyle='#000000';
                              ctx.fillRect(0,0,tmp.width,tmp.height);
                              updateLayer(selectedId,{mask:{...selectedLayer.mask,data:tmp.toDataURL()}});
                            }} style={{...css.addBtn,marginTop:0,background:T.input,
                              color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>
                              ◼ Fill mask (hide all)
                            </button>
                            <button onClick={()=>applyMaskToLayer(selectedId)}
                              style={{...css.addBtn,marginTop:0,background:T.warning,
                                color:'#000',border:'none',fontSize:11}}>
                              ✓ Apply mask permanently
                            </button>
                            <button onClick={()=>removeMaskFromLayer(selectedId)}
                              style={{...css.addBtn,marginTop:0,background:T.danger,fontSize:11}}>
                              × Remove mask
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={()=>updateLayer(selectedId,{effects:defaultEffects()})} style={{...css.addBtn,background:'transparent',color:T.muted,border:`1px solid ${T.border}`,marginTop:10}}>Reset all effects</button>
                  </>
                )}
              </div>
            )}

            {activeTool==='stickers'&&(
              <div>
                <span style={css.label}>Category</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>{Object.keys(STICKER_CATEGORIES).map(cat=>(<button key={cat} onClick={()=>setActiveCategory(cat)} style={css.pill(activeCategory===cat)}>{cat}</button>))}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                  {STICKER_CATEGORIES[activeCategory].map((s,i)=>(<div key={i} onClick={()=>addSvgSticker(s.svg,s.label)} style={{padding:'9px 4px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}><div style={{width:32,height:32}} dangerouslySetInnerHTML={{__html:s.svg}}/><span style={{fontSize:9,color:T.muted,textAlign:'center'}}>{s.label}</span></div>))}
                </div>
              </div>
            )}

            {activeTool==='memes'&&(
              <MemesPanel theme={T} onAddSvg={addSvgSticker}
                onAddGif={(url,w,h)=>{
                  const aspect=w/h,cW=p.preview.w,cH=p.preview.h,ca=cW/cH;
                  let fw,fh;if(aspect>ca){fh=cH;fw=fh*aspect;}else{fw=cW;fh=fw/aspect;}
                  addLayer({type:'image',src:url,width:Math.round(fw),height:Math.round(fh),x:Math.round((cW-fw)/2),y:Math.round((cH-fh)/2),cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
                }}
              />
            )}

            {activeTool==='background'&&(
              <div>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Click the background on the canvas to select it.</div>
                <span style={css.label}>Solid color</span>
                <input type="color" value={bg?.bgColor||'#6C63FF'} onChange={e=>{updateBg({bgColor:e.target.value,bgGradient:null});addRecentColor(e.target.value);}} style={css.color}/>
                <span style={css.label}>RGB mixer</span>
                <div style={css.section}>
                  {[['R',rgbR,setRgbR,'#f87171'],['G',rgbG,setRgbG,'#4ade80'],['B',rgbB,setRgbB,'#60a5fa']].map(([l,v,sv,c])=>(<div key={l} style={{...css.row,marginBottom:6}}><span style={{fontSize:11,color:c,fontWeight:'700',width:12}}>{l}</span><Slider min={0} max={255} value={v} onChange={sv} style={{flex:1}}/><span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{Math.round(v)}</span></div>))}
                  <div style={{width:'100%',height:28,borderRadius:6,background:`rgb(${Math.round(rgbR)},${Math.round(rgbG)},${Math.round(rgbB)})`,margin:'4px 0 8px',border:`1px solid ${T.border}`}}/>
                  <button onClick={()=>{const hex='#'+[rgbR,rgbG,rgbB].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');updateBg({bgColor:hex,bgGradient:null});addRecentColor(hex);}} style={{...css.addBtn,marginTop:0}}>Apply</button>
                </div>
                <span style={css.label}>Gradients</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                  {GRADIENTS.map(([c1,c2],i)=>(<div key={i} onClick={()=>updateBg({bgGradient:[c1,c2]})} style={{height:36,borderRadius:6,background:`linear-gradient(135deg,${c1},${c2})`,cursor:'pointer',border:bg?.bgGradient?.[0]===c1?'2px solid #fff':`1px solid ${T.border}`}}/>))}
                </div>
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{recentColors.map((c,i)=>(<div key={i} onClick={()=>updateBg({bgColor:c,bgGradient:null})} style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>))}</div>
                {bg&&(<><span style={css.label}>Opacity — {bg.opacity??100}%</span><Slider min={0} max={100} value={bg.opacity??100} onChange={v=>updateLayerSilent(bg.id,{opacity:v})} onCommit={v=>updateLayer(bg.id,{opacity:v})} style={{width:'100%'}}/></>)}
              </div>
            )}

            {activeTool==='adjust'&&(
              <div>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Canvas-wide adjustments affect everything.</div>
                {[['Brightness',brightness,setBrightness,50,200,'%'],['Contrast',contrast,setContrast,50,300,'%'],['Saturation',saturation,setSaturation,0,300,'%'],['Hue',hue,setHue,0,360,'°']].map(([l,v,sv,mn,mx,u])=>(<div key={l}><span style={css.label}>{l} — {Math.round(v)}{u}</span><Slider min={mn} max={mx} value={v} onChange={sv} style={{width:'100%'}}/></div>))}
                {selectedLayer?.type==='image'&&(<>
                  <div style={css.divider}/>
                  <div style={{fontSize:11,color:T.accent,fontWeight:'600',marginBottom:4}}>Per-image filters</div>
                  {[['Brightness','imgBrightness',50,200,'%'],['Contrast','imgContrast',50,200,'%'],['Saturate','imgSaturate',0,300,'%'],['Blur','imgBlur',0,20,'px']].map(([l,k,mn,mx,u])=>(<div key={k}><span style={css.label}>{l} — {selectedLayer[k]??(k==='imgBlur'?0:100)}{u}</span><Slider min={mn} max={mx} value={selectedLayer[k]??(k==='imgBlur'?0:100)} onChange={v=>updateLayerSilent(selectedId,{[k]:v})} onCommit={v=>updateLayer(selectedId,{[k]:v})} style={{width:'100%'}}/></div>))}
                  <button onClick={()=>updateLayer(selectedId,{imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0})} style={{...css.addBtn,background:'transparent',color:T.muted,border:`1px solid ${T.border}`,marginTop:6}}>Reset image</button>
                </>)}
                {selectedLayer&&selectedLayer.type!=='background'&&(<><div style={css.divider}/><span style={css.label}>Layer opacity — {selectedLayer.opacity??100}%</span><Slider min={0} max={100} value={selectedLayer.opacity??100} onChange={v=>updateLayerSilent(selectedId,{opacity:v})} onCommit={v=>updateLayer(selectedId,{opacity:v})} style={{width:'100%'}}/></>)}
                <button onClick={()=>{setBrightness(100);setContrast(110);setSaturation(110);setHue(0);}} style={{...css.addBtn,background:'transparent',color:T.muted,border:`1px solid ${T.border}`}}>Reset canvas</button>
              </div>
            )}

            {activeTool==='upload'&&(
              <div>
                <span style={css.label}>Upload images</span>
                <label style={{padding:'20px 16px',borderRadius:8,border:`1.5px dashed ${T.border}`,color:T.muted,fontSize:12,cursor:'pointer',textAlign:'center',display:'block',lineHeight:1.9}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                  <div style={{fontSize:24,marginBottom:6}}>↑</div>
                  Click to upload<br/>
                  <span style={{fontSize:10,color:T.muted}}>PNG · JPG · GIF · WEBP</span><br/>
                  <span style={{fontSize:10,color:T.success,fontWeight:'600'}}>Multiple files — each becomes a layer</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{display:'none'}}/>
                </label>
                <span style={css.label}>Color palette</span>
                <div style={css.section}>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                    {savedPalette.map((c,i)=>(<div key={i} style={{position:'relative'}}><div onClick={()=>addRecentColor(c)} style={{width:24,height:24,borderRadius:5,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/><div onClick={()=>setSavedPalette(prev=>prev.filter((_,j)=>j!==i))} style={{position:'absolute',top:-5,right:-5,width:12,height:12,background:T.danger,borderRadius:'50%',fontSize:8,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>×</div></div>))}
                    {savedPalette.length===0&&<div style={{fontSize:10,color:T.muted}}>No saved colors</div>}
                  </div>
                  <div style={css.row}><input type="color" style={{...css.color,width:44,flexShrink:0,height:32}} onChange={e=>setSavedPalette(prev=>[...prev.filter(c=>c!==e.target.value),e.target.value].slice(0,20))}/><span style={{fontSize:10,color:T.muted}}>Click to save color</span></div>
                </div>
                {selectedLayer?.type==='image'&&(<><div style={css.divider}/><span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span><Slider min={0} max={100} value={selectedLayer.opacity??100} onChange={v=>updateLayerSilent(selectedId,{opacity:v})} onCommit={v=>updateLayer(selectedId,{opacity:v})} style={{width:'100%'}}/></>)}
              </div>
            )}

            {activeTool==='face'&&(
              <div>
                <span style={css.label}>Face & emotion score</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Analyze your thumbnail's face placement, size, lighting and get emotion suggestions for maximum CTR.
                </div>

                <button onClick={analyzeFace} disabled={faceLoading}
                  style={{...css.addBtn,marginTop:10,
                    background:faceLoading?T.muted:T.accent,
                    opacity:faceLoading?0.6:1,fontSize:13,fontWeight:'700'}}>
                  {faceLoading?'Analyzing...':'◉ Analyze face & emotion'}
                </button>

                {faceAnalysis&&!faceAnalysis.error&&(
                  <div>
                    {/* Overall score */}
                    <div style={{textAlign:'center',padding:'16px 0 8px'}}>
                      <div style={{
                        fontSize:52,fontWeight:'900',letterSpacing:'-2px',
                        color:faceAnalysis.score>=80?T.success:
                              faceAnalysis.score>=60?T.warning:T.danger,
                      }}>
                        {faceAnalysis.score}
                      </div>
                      <div style={{fontSize:12,color:T.muted}}>face score / 100</div>
                      <div style={{fontSize:13,fontWeight:'700',marginTop:6,
                        color:faceAnalysis.score>=80?T.success:
                              faceAnalysis.score>=60?T.warning:T.danger}}>
                        {faceAnalysis.score>=80?'🔥 Thumbnail ready':
                         faceAnalysis.score>=60?'⚠️ Needs improvement':
                         faceAnalysis.score>=40?'❌ Weak face presence':
                         '❌ No face detected'}
                      </div>
                    </div>

                    {/* Score bar */}
                    <div style={{height:6,borderRadius:3,background:T.border,
                      marginBottom:14,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,
                        width:`${faceAnalysis.score}%`,
                        background:faceAnalysis.score>=80?T.success:
                                   faceAnalysis.score>=60?T.warning:T.danger,
                        transition:'width 0.5s ease'}}/>
                    </div>

                    {/* Breakdown */}
                    <span style={css.label}>Breakdown</span>
                    <div style={css.section}>
                      {faceAnalysis.scores.map((s,i)=>(
                        <div key={i} style={{marginBottom:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                            <span style={{fontSize:11,color:T.text,fontWeight:'600'}}>{s.label}</span>
                            <span style={{fontSize:11,fontWeight:'700',
                              color:s.score/s.max>=0.8?T.success:
                                    s.score/s.max>=0.5?T.warning:T.danger}}>
                              {s.score}/{s.max}
                            </span>
                          </div>
                          <div style={{height:4,borderRadius:2,background:T.border,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:2,
                              width:`${(s.score/s.max)*100}%`,
                              background:s.score/s.max>=0.8?T.success:
                                         s.score/s.max>=0.5?T.warning:T.danger}}/>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Good things */}
                    {faceAnalysis.goods.length>0&&(<>
                      <span style={css.label}>What's working</span>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {faceAnalysis.goods.map((g,i)=>(
                          <div key={i} style={{padding:'7px 10px',borderRadius:6,
                            fontSize:11,color:T.text,lineHeight:1.5,
                            background:`${T.success}18`,
                            border:`1px solid ${T.success}44`}}>
                            ✓ {g}
                          </div>
                        ))}
                      </div>
                    </>)}

                    {/* Tips */}
                    {faceAnalysis.tips.length>0&&(<>
                      <span style={css.label}>Improvements</span>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {faceAnalysis.tips.map((t,i)=>(
                          <div key={i} style={{padding:'7px 10px',borderRadius:6,
                            fontSize:11,color:T.text,lineHeight:1.5,
                            background:`${T.warning}18`,
                            border:`1px solid ${T.warning}44`}}>
                            → {t}
                          </div>
                        ))}
                      </div>
                    </>)}

                    {/* Emotion guide */}
                    {faceAnalysis.hasFace&&faceAnalysis.emotionTips.length>0&&(<>
                      <span style={css.label}>Emotion guide</span>
                      <div style={{...css.section,fontSize:11,color:T.muted,
                        marginBottom:4,lineHeight:1.5}}>
                        The emotion on a face drives clicks. Here are the highest-performing expressions for YouTube:
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {faceAnalysis.emotionTips.map((et,i)=>(
                          <div key={i} style={{padding:'8px 10px',borderRadius:7,
                            background:T.input,border:`1px solid ${T.border}`}}>
                            <div style={{display:'flex',justifyContent:'space-between',
                              alignItems:'center',marginBottom:4}}>
                              <span style={{fontSize:12,fontWeight:'700',color:T.text}}>
                                {et.emotion}
                              </span>
                              <span style={{fontSize:9,fontWeight:'700',
                                color:et.ctr==='High CTR'?T.success:T.warning,
                                background:et.ctr==='High CTR'?`${T.success}20`:`${T.warning}20`,
                                padding:'2px 6px',borderRadius:8}}>
                                {et.ctr}
                              </span>
                            </div>
                            <div style={{fontSize:10,color:T.muted,lineHeight:1.5}}>{et.tip}</div>
                          </div>
                        ))}
                      </div>
                    </>)}

                    <button onClick={()=>setFaceAnalysis(null)}
                      style={{...css.addBtn,marginTop:10,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`}}>
                      Reset
                    </button>
                  </div>
                )}

                {faceAnalysis?.error&&(
                  <div style={{...css.section,marginTop:10,fontSize:12,
                    color:T.danger,textAlign:'center',lineHeight:1.6}}>
                    {faceAnalysis.message}
                  </div>
                )}

                {!faceAnalysis&&!faceLoading&&(
                  <div style={{...css.section,marginTop:10,fontSize:11,
                    color:T.muted,lineHeight:1.7}}>
                    <div style={{fontSize:20,textAlign:'center',marginBottom:8}}>◉</div>
                    Upload a photo with a face, then click analyze. You'll get:<br/><br/>
                    • Face detection and placement score<br/>
                    • Lighting quality analysis<br/>
                    • How well the face stands out<br/>
                    • Emotion suggestions for higher CTR
                  </div>
                )}
              </div>
            )}

            {activeTool==='resize'&&(
              <div>
                <span style={css.label}>Export all platforms</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Export your thumbnail at the correct size for every platform in one click.
                  Downloads 5 files automatically.
                </div>

                {/* Platform list */}
                <span style={css.label}>Platforms included</span>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {[
                    ['YouTube',   '1280×720',  '▶'],
                    ['TikTok',    '1080×1920', '♪'],
                    ['Instagram', '1080×1080', '◉'],
                    ['Twitter',   '1600×900',  '✦'],
                    ['LinkedIn',  '1200×627',  '⊞'],
                  ].map(([name,size,icon])=>(
                    <div key={name} style={{
                      display:'flex',alignItems:'center',gap:10,
                      padding:'8px 10px',borderRadius:7,
                      background:T.input,border:`1px solid ${T.border}`,
                    }}>
                      <span style={{fontSize:14,width:20,textAlign:'center'}}>{icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:'600',color:T.text}}>{name}</div>
                        <div style={{fontSize:10,color:T.muted}}>{size}px</div>
                      </div>
                      <div style={{width:8,height:8,borderRadius:'50%',
                        background:T.success}}/>
                    </div>
                  ))}
                </div>

                {resizeProgress&&(
                  <div style={{...css.section,marginTop:10,fontSize:12,
                    color:T.success,fontWeight:'600',textAlign:'center'}}>
                    {resizeProgress}
                  </div>
                )}

                <button onClick={exportAllPlatforms}
                  disabled={resizeExporting}
                  style={{...css.addBtn,marginTop:12,
                    background:resizeExporting?T.muted:T.success,
                    fontSize:13,fontWeight:'700',
                    opacity:resizeExporting?0.6:1}}>
                  {resizeExporting?resizeProgress||'Exporting...':'↓ Export all 5 platforms'}
                </button>

                <div style={{...css.section,marginTop:10,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  💡 Tip — design at YouTube 1280×720 first then export all.
                  Text and images scale proportionally to each platform size.
                </div>
              </div>
            )}

            {activeTool==='ab'&&(
              <div>
                <span style={css.label}>A/B Variants</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Generate 3 variations of your current thumbnail instantly.
                  Pick the one that feels strongest.
                </div>

                <button onClick={generateVariants} disabled={abLoading}
                  style={{...css.addBtn,marginTop:10,
                    background:abLoading?T.muted:T.accent,
                    opacity:abLoading?0.6:1,fontSize:13,fontWeight:'700'}}>
                  {abLoading?'Generating...':'⊟ Generate 3 variants'}
                </button>

                {abLoading&&(
                  <div style={{textAlign:'center',padding:'20px 0',
                    fontSize:12,color:T.muted}}>
                    Creating variations...
                  </div>
                )}

                {abVariants.length>0&&(
                  <div>
                    <span style={{...css.label,marginTop:16}}>Choose a variant</span>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {abVariants.map(variant=>{
                        const vBg=variant.layers.find(l=>l.type==='background');
                        const vText=variant.layers.find(l=>l.type==='text');
                        const isSelected=abSelected===variant.id;
                        return(
                          <div key={variant.id}
                            onClick={()=>setAbSelected(variant.id)}
                            style={{borderRadius:8,border:`2px solid ${isSelected?T.accent:T.border}`,
                              overflow:'hidden',cursor:'pointer',transition:'all 0.15s',
                              background:isSelected?`${T.accent}08`:'transparent'}}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=isSelected?T.accent:T.border}>
                            {/* Mini preview */}
                            <div style={{
                              height:56,
                              background:vBg?.bgGradient
                                ?`linear-gradient(135deg,${vBg.bgGradient[0]},${vBg.bgGradient[1]})`
                                :vBg?.bgColor||'#1a1a1a',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              position:'relative',overflow:'hidden',
                            }}>
                              {vText&&(
                                <span style={{
                                  fontSize:16,fontWeight:vText.fontWeight||700,
                                  color:vText.textColor||'#fff',
                                  fontFamily:vText.fontFamily||'Impact',
                                  textShadow:vText.shadowEnabled?'2px 2px 0 #000':'none',
                                  WebkitTextStroke:vText.strokeWidth>0
                                    ?`${Math.min(vText.strokeWidth,2)}px ${vText.strokeColor}`:'none',
                                  letterSpacing:1,padding:'0 8px',
                                  textAlign:'center',
                                }}>
                                  {vText.text?.slice(0,20)}
                                </span>
                              )}
                              <div style={{position:'absolute',top:4,left:4,
                                fontSize:9,fontWeight:'800',color:'#fff',
                                background:'rgba(0,0,0,0.6)',padding:'1px 6px',
                                borderRadius:8}}>
                                {variant.label.split(' — ')[0]}
                              </div>
                            </div>
                            {/* Info + apply */}
                            <div style={{padding:'8px 10px',display:'flex',
                              alignItems:'center',justifyContent:'space-between'}}>
                              <div>
                                <div style={{fontSize:11,fontWeight:'600',color:T.text}}>
                                  {variant.label}
                                </div>
                                <div style={{fontSize:10,color:T.muted,marginTop:1}}>
                                  {variant.desc}
                                </div>
                              </div>
                              <button onClick={e=>{e.stopPropagation();applyVariant(variant);}}
                                style={{padding:'5px 12px',borderRadius:5,border:'none',
                                  background:T.accent,color:'#fff',cursor:'pointer',
                                  fontSize:10,fontWeight:'700',flexShrink:0}}>
                                Use this
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{...css.section,marginTop:10,fontSize:11,
                      color:T.muted,lineHeight:1.6}}>
                      💡 Tip — generate variants multiple times for more options.
                      Each run creates different combinations.
                    </div>

                    <button onClick={()=>{setAbVariants([]);setAbSelected(null);}}
                      style={{...css.addBtn,marginTop:8,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`}}>
                      Clear variants
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTool==='templates'&&(
              <div>
                <span style={css.label}>Viral templates</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Click any template to load it. You can customize everything after.
                </div>

                {/* Category filter */}
                {(()=>{
                  const cats=['All',...new Set(VIRAL_TEMPLATES.map(t=>t.category))];
                  const [activeCat,setActiveCat] = [
                    window._snapTemplateCat||'All',
                    (c)=>{ window._snapTemplateCat=c; setActiveTool('templates'); }
                  ];
                  const filtered = activeCat==='All'
                    ? VIRAL_TEMPLATES
                    : VIRAL_TEMPLATES.filter(t=>t.category===activeCat);
                  return(
                    <>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',margin:'8px 0'}}>
                        {cats.map(cat=>(
                          <button key={cat} onClick={()=>setActiveCat(cat)}
                            style={{padding:'3px 10px',borderRadius:10,fontSize:10,
                              border:`1px solid ${activeCat===cat?T.accent:T.border}`,
                              background:activeCat===cat?T.accent:'transparent',
                              color:activeCat===cat?'#fff':T.muted,cursor:'pointer',
                              fontWeight:activeCat===cat?'700':'400'}}>
                            {cat}
                          </button>
                        ))}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {filtered.map(template=>(
                          <div key={template.id}
                            style={{borderRadius:8,border:`1px solid ${T.border}`,
                              overflow:'hidden',cursor:'pointer',transition:'all 0.15s'}}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                            {/* Preview */}
                            <div onClick={()=>loadTemplate(template)}
                              style={{height:60,background:template.preview.bg,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                position:'relative',overflow:'hidden'}}>
                              <span style={{fontSize:16,fontWeight:'900',color:'#fff',
                                fontFamily:'Impact,sans-serif',
                                textShadow:'2px 2px 0 rgba(0,0,0,0.8)',
                                letterSpacing:1}}>
                                {template.preview.text}
                              </span>
                              <div style={{position:'absolute',top:4,right:4,
                                padding:'1px 6px',borderRadius:8,
                                background:'rgba(0,0,0,0.6)',
                                fontSize:8,color:'#fff',fontWeight:'600'}}>
                                {template.category}
                              </div>
                            </div>
                            {/* Info */}
                            <div style={{padding:'8px 10px',background:T.input,
                              display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                              <span style={{fontSize:11,color:T.text,fontWeight:'600'}}>
                                {template.label}
                              </span>
                              <button onClick={()=>loadTemplate(template)}
                                style={{padding:'3px 10px',borderRadius:5,border:'none',
                                  background:T.accent,color:'#fff',cursor:'pointer',
                                  fontSize:10,fontWeight:'700'}}>
                                Use
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {activeTool==='ctr'&&(
              <div>
                <span style={css.label}>CTR Score</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Analyze your thumbnail and get a click-through rate score based on contrast, text, subject and composition.
                </div>

                <button onClick={analyzeCTR} disabled={ctrLoading}
                  style={{...css.addBtn,background:ctrLoading?T.muted:T.accent,
                    marginTop:10,fontSize:13,fontWeight:'700',opacity:ctrLoading?0.6:1}}>
                  {ctrLoading?'Analyzing...':'◈ Analyze thumbnail'}
                </button>

                {ctrScore!==null&&(
                  <div>
                    <div style={{textAlign:'center',padding:'20px 0 10px'}}>
                      <div style={{
                        fontSize:56,fontWeight:'900',
                        color: ctrScore>=80?T.success:ctrScore>=60?T.warning:T.danger,
                        lineHeight:1,letterSpacing:'-2px',
                      }}>{ctrScore}</div>
                      <div style={{fontSize:13,color:T.muted,marginTop:4}}>out of 100</div>
                      <div style={{
                        fontSize:14,fontWeight:'700',marginTop:8,
                        color: ctrScore>=80?T.success:ctrScore>=60?T.warning:T.danger,
                      }}>
                        {ctrScore>=90?'🔥 Viral potential':
                         ctrScore>=80?'✅ Strong thumbnail':
                         ctrScore>=60?'⚠️ Needs work':
                         '❌ Low CTR risk'}
                      </div>
                    </div>

                    <div style={{height:8,borderRadius:4,background:T.border,marginBottom:16,overflow:'hidden'}}>
                      <div style={{
                        height:'100%',borderRadius:4,
                        width:`${ctrScore}%`,
                        background: ctrScore>=80?T.success:ctrScore>=60?T.warning:T.danger,
                        transition:'width 0.5s ease',
                      }}/>
                    </div>

                    <span style={css.label}>Breakdown</span>
                    <div style={css.section}>
                      {[
                        ['Contrast',   ctrBreakdown.contrast, 'How much light/dark variation'],
                        ['Vibrancy',   ctrBreakdown.vibrancy, 'Color saturation and pop'],
                        ['Text',       ctrBreakdown.text,     'Bold readable text present'],
                        ['Subject',    ctrBreakdown.subject,  'Clear main subject'],
                        ['Composition',ctrBreakdown.comp,     'Layer variety and depth'],
                        ['Safe zones', ctrBreakdown.safe,     'Content away from YouTube UI'],
                      ].map(([label,score,desc])=>(
                        <div key={label} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                            <span style={{fontSize:11,color:T.text,fontWeight:'600'}}>{label}</span>
                            <span style={{fontSize:11,fontWeight:'700',
                              color:score>=80?T.success:score>=60?T.warning:T.danger}}>
                              {score}/100
                            </span>
                          </div>
                          <div style={{height:5,borderRadius:3,background:T.border,overflow:'hidden'}}>
                            <div style={{
                              height:'100%',borderRadius:3,
                              width:`${score}%`,
                              background:score>=80?T.success:score>=60?T.warning:T.danger,
                            }}/>
                          </div>
                          <div style={{fontSize:9,color:T.muted,marginTop:2}}>{desc}</div>
                        </div>
                      ))}
                    </div>

                    {ctrBreakdown.tips.length>0&&(<>
                      <span style={css.label}>Suggestions</span>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {ctrBreakdown.tips.map((tip,i)=>(
                          <div key={i} style={{
                            padding:'8px 10px',borderRadius:7,fontSize:11,lineHeight:1.5,
                            background: tip.type==='good'?`${T.success}18`:
                                        tip.type==='bad'?`${T.danger}18`:`${T.warning}18`,
                            border:`1px solid ${
                              tip.type==='good'?T.success:
                              tip.type==='bad'?T.danger:T.warning}44`,
                            color:T.text,
                          }}>
                            <span style={{marginRight:6}}>
                              {tip.type==='good'?'✓':tip.type==='bad'?'✗':'→'}
                            </span>
                            {tip.text}
                          </div>
                        ))}
                      </div>
                    </>)}

                    <button onClick={()=>{setCtrScore(null);setCtrBreakdown(null);}}
                      style={{...css.addBtn,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`,marginTop:10}}>
                      Reset
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTool==='rimlight'&&(
              <div>
                <span style={css.label}>Rim lighting</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.success,fontWeight:'600',lineHeight:1.6}}>
                  ☀ Click anywhere on your image to add light
                </div>

                {(!selectedLayer||selectedLayer.type!=='image')&&(
                  <div style={{...css.section,fontSize:11,color:T.muted,
                    textAlign:'center',padding:16,marginTop:8}}>
                    <div style={{fontSize:24,marginBottom:6}}>☀</div>
                    Select an image layer first
                  </div>
                )}

                <span style={css.label}>Light color</span>
                <div style={css.row}>
                  <input type="color" value={rimLightColor}
                    onChange={e=>{setRimLightColor(e.target.value);setRimPickingColor(false);}}
                    style={{...css.color,flex:1,height:36}}/>
                  <button
                    onClick={()=>setRimPickingColor(p=>!p)}
                    title="Pick color from canvas"
                    style={{
                      padding:'6px 10px',borderRadius:6,flexShrink:0,
                      border:`2px solid ${rimPickingColor?T.accent:T.border}`,
                      background:rimPickingColor?T.accent:'transparent',
                      color:rimPickingColor?'#fff':T.text,
                      cursor:'pointer',fontSize:14,fontWeight:'700',
                      transition:'all 0.15s',
                    }}>
                    🔍
                  </button>
                </div>

                {rimPickingColor&&(
                  <div style={{...css.section,marginTop:6,fontSize:11,
                    color:T.accent,fontWeight:'600',lineHeight:1.6,
                    border:`1px solid ${T.accent}`,textAlign:'center'}}>
                    🔍 Click anywhere on the canvas to pick that color
                  </div>
                )}

                {rimPickedFrom&&!rimPickingColor&&(
                  <div style={{...css.row,marginTop:6,gap:8}}>
                    <div style={{width:20,height:20,borderRadius:4,
                      background:rimPickedFrom.color,
                      border:`1px solid ${T.border}`,flexShrink:0}}/>
                    <span style={{fontSize:10,color:T.muted,fontFamily:'monospace'}}>
                      Picked: {rimPickedFrom.color}
                    </span>
                    <button onClick={()=>setRimPickedFrom(null)}
                      style={{marginLeft:'auto',background:'none',border:'none',
                        color:T.muted,cursor:'pointer',fontSize:12}}>×</button>
                  </div>
                )}

                <span style={css.label}>Presets</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                  {[
                    {label:'Blue',  color:'#0088ff', blend:'screen'},
                    {label:'Gold',  color:'#ffaa00', blend:'screen'},
                    {label:'Red',   color:'#ff2200', blend:'screen'},
                    {label:'Green', color:'#00ff88', blend:'screen'},
                    {label:'Pink',  color:'#ff00aa', blend:'screen'},
                    {label:'White', color:'#ffffff', blend:'soft-light'},
                    {label:'Neon',  color:'#00ffff', blend:'screen'},
                    {label:'Fire',  color:'#ff6600', blend:'overlay'},
                  ].map((preset,i)=>(
                    <button key={i} onClick={()=>{
                      setRimLightColor(preset.color);
                      setRimLightBlend(preset.blend);
                    }} style={{
                      padding:'8px 2px',borderRadius:6,
                      border:`2px solid ${rimLightColor===preset.color?'#fff':'transparent'}`,
                      background:preset.color,
                      fontSize:8,cursor:'pointer',
                      color: ['#ffffff','#ffaa00','#00ff88','#00ffff'].includes(preset.color)?'#000':'#fff',
                      fontWeight:'700',textAlign:'center',
                    }}>{preset.label}</button>
                  ))}
                </div>

                <span style={css.label}>Size — {rimLightSize}%</span>
                <Slider min={5} max={100} value={rimLightSize}
                  onChange={v=>setRimLightSize(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Intensity — {rimLightIntensity}%</span>
                <Slider min={5} max={100} value={rimLightIntensity}
                  onChange={v=>setRimLightIntensity(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Softness — {rimLightSoftness}%</span>
                <Slider min={10} max={100} value={rimLightSoftness}
                  onChange={v=>setRimLightSoftness(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Blend mode</span>
                <select value={rimLightBlend}
                  onChange={e=>setRimLightBlend(e.target.value)}
                  style={css.input}>
                  {['screen','overlay','soft-light','hard-light',
                    'color-dodge','lighten','add'].map(m=>(
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <div style={{...css.section,marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:'700',
                    color:T.text,marginBottom:6}}>💡 Tips</div>
                  <div style={{fontSize:11,color:T.muted,lineHeight:1.7}}>
                    • Click the edge of a subject for rim light<br/>
                    • Blue screen mode = Minecraft glow effect<br/>
                    • Gold overlay = warm sunset lighting<br/>
                    • White soft-light = natural fill light<br/>
                    • Stack multiple lights for drama<br/>
                    • Lower intensity + multiple clicks = build up gradually
                  </div>
                </div>

                <button onClick={()=>{
                  const rimLayer=layers.find(l=>l.isRimLight);
                  if(rimLayer){
                    setLayers(prev=>{
                      const nl=prev.filter(l=>!l.isRimLight);
                      pushHistory(nl);
                      return nl;
                    });
                    setSelectedId(null);
                    setCmdLog('Rim light cleared');
                  }
                }} style={{...css.addBtn,background:'transparent',
                  color:T.muted,border:`1px solid ${T.border}`,marginTop:8}}>
                  × Clear rim light
                </button>
              </div>
            )}

            {activeTool==='ai'&&(
  <div>
    <span style={css.label}>AI features</span>

    <div style={{...css.section,marginTop:0}}>
      <div style={{fontSize:13,color:T.text,fontWeight:'700',marginBottom:4}}>🎨 Background Remover</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:10,lineHeight:1.6}}>
        Remove backgrounds instantly. Select an image layer first.
      </div>
      {selectedLayer?.type==='image'?(
        <div>
          <button
            id="removebg-btn"
            onClick={async()=>{
              const btn=document.getElementById('removebg-btn');
              const orig=btn.textContent;
              btn.textContent='Removing...';
              btn.disabled=true;
              btn.style.opacity='0.6';
              try{
                const response=await fetch(selectedLayer.src);
                const blob=await response.blob();
                const reader=new FileReader();
                reader.onload=async()=>{
                  try{
                    const res=await fetch('https://thumbframe-api-production.up.railway.app/remove-bg',{
                      method:'POST',
                      headers:{'Content-Type':'application/json'},
                      body:JSON.stringify({imageUrl:reader.result}),
                    });
                    const data=await res.json();
                    if(data.error){
                      alert('Error: '+data.error);
                      btn.textContent=orig;btn.disabled=false;btn.style.opacity='1';
                      return;
                    }
                    updateLayer(selectedId,{src:data.image});
                    btn.textContent='Done!';btn.style.background=T.success;
                    setTimeout(()=>{btn.textContent=orig;btn.disabled=false;btn.style.opacity='1';btn.style.background=T.accent;},2000);
                  }catch(e){
                    alert('Failed — make sure your API server is running on port 5000');
                    btn.textContent=orig;btn.disabled=false;btn.style.opacity='1';
                  }
                };
                reader.readAsDataURL(blob);
              }catch(e){
                alert('Failed to read image');
                btn.textContent=orig;btn.disabled=false;btn.style.opacity='1';
              }
            }}
            style={{width:'100%',padding:10,borderRadius:7,background:T.accent,color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:'700',transition:'all 0.2s'}}
          >
            Remove background
          </button>
          <div style={{fontSize:10,color:T.muted,marginTop:5,textAlign:'center'}}>
            Powered by remove.bg · 50 free/month
          </div>
        </div>
      ):(
        <div style={{...css.section,fontSize:11,color:T.muted,textAlign:'center',padding:16}}>
          <div style={{fontSize:20,marginBottom:6}}>✂️</div>
          Click an image on the canvas first
        </div>
      )}
    </div>

    <div style={{...css.section,border:`1px solid ${T.warning}`,marginTop:10}}>
      <div style={{fontSize:13,color:T.warning,fontWeight:'700',marginBottom:4}}>⚡ AI Generate — Pro</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:8,lineHeight:1.6}}>
        Generate a thumbnail from a text prompt.
      </div>
      <input
        id="ai-prompt-input"
        placeholder="Epic gaming moment, dramatic lighting..."
        style={{padding:'7px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit',marginBottom:8}}
      />
      <button
        id="ai-generate-btn"
        onClick={async()=>{
          const btn=document.getElementById('ai-generate-btn');
          const prompt=document.getElementById('ai-prompt-input').value;
          if(!prompt.trim()){alert('Enter a prompt first');return;}
          btn.textContent='Generating...';btn.disabled=true;btn.style.opacity='0.6';
          try{
            const res=await fetch('https://thumbframe-api-production.up.railway.app/ai-generate',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({prompt}),
            });
            const data=await res.json();
            if(data.error){
              alert('Error: '+data.error);
              btn.textContent='Generate';btn.disabled=false;btn.style.opacity='1';
              return;
            }
            const cW=p.preview.w,cH=p.preview.h;
            addLayer({
              type:'image',src:data.image,
              width:cW,height:cH,x:0,y:0,
              cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
              imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
            });
            btn.textContent='✓ Added!';btn.style.background=T.success;
            setTimeout(()=>{
              btn.textContent='Generate';btn.disabled=false;
              btn.style.opacity='1';btn.style.background=T.warning;
            },2000);
          }catch(e){
            alert('Failed — make sure API is running on port 5000');
            btn.textContent='Generate';btn.disabled=false;btn.style.opacity='1';
          }
        }}
        style={{width:'100%',padding:9,borderRadius:7,background:T.warning,color:'#000',border:'none',fontSize:12,cursor:'pointer',fontWeight:'700'}}
      >
        Generate
      </button>
      <div style={{fontSize:10,color:T.muted,marginTop:5,textAlign:'center'}}>
        Pro only · $15/mo
      </div>
    </div>

  </div>
)}

          </div>

          {/* Layers panel */}
          <div style={{borderTop:`1px solid ${T.border}`,background:T.panel,flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px 5px'}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:'10px',color:T.text,fontWeight:'700',letterSpacing:'0.5px',textTransform:'uppercase'}}>Layers</span>
                <span style={{fontSize:10,color:T.muted,background:T.input,padding:'1px 6px',borderRadius:10,border:`1px solid ${T.border}`}}>{layers.length}</span>
              </div>
              <div style={{display:'flex',gap:2}}>
                {[['↑',()=>selectedId&&moveLayerUp(selectedId),'Up'],['↓',()=>selectedId&&moveLayerDown(selectedId),'Down'],['⧉',()=>selectedId&&duplicateLayer(selectedId),'Dupe'],['×',()=>selectedId&&deleteLayer(selectedId),'Del']].map(([icon,action,title])=>(<button key={icon} onClick={action} title={title} style={{padding:'2px 7px',borderRadius:4,border:`1px solid ${icon==='×'?T.danger:T.border}`,background:'transparent',color:icon==='×'?T.danger:T.muted,fontSize:11,cursor:'pointer'}}>{icon}</button>))}
              </div>
            </div>
            <div style={{maxHeight:240,overflowY:'auto',padding:'0 6px 8px'}}>
              {[...layers].reverse().map(layer=>{
                const isDragOver=layerDragOver===layer.id;
                const isBeingDragged=layerDragId===layer.id;
                const color=getLayerColor(layer);
                const hasEffects=layer.effects&&(layer.effects.layerBlur>0||layer.effects.brightness!==100||layer.effects.contrast!==100||layer.effects.saturation!==100||layer.effects.shadow?.enabled||layer.effects.glow?.enabled||layer.effects.outline?.enabled);
                return(
                  <div key={layer.id}
                    draggable
                    onDragStart={e=>onLayerDragStart(e,layer.id)}
                    onDragOver={e=>onLayerDragOver(e,layer.id)}
                    onDrop={e=>onLayerDrop(e,layer.id)}
                    onDragEnd={onLayerDragEnd}
                    onClick={()=>{setSelectedId(layer.id);if(layer.type==='background')setActiveTool('background');}}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',borderRadius:7,marginBottom:2,cursor:'pointer',border:`1px solid ${selectedId===layer.id?T.accent:isDragOver?`${T.accent}66`:'transparent'}`,background:selectedId===layer.id?`${T.accent}12`:isDragOver?`${T.accent}06`:'transparent',opacity:isBeingDragged?0.4:1,transition:'all 0.1s'}}>
                    <div style={{color:T.muted,fontSize:10,cursor:'grab',flexShrink:0,opacity:0.4,userSelect:'none'}}>⠿</div>
                    <div style={{width:4,height:28,borderRadius:2,flexShrink:0,background:layer.type==='background'?(layer.bgGradient?`linear-gradient(180deg,${layer.bgGradient[0]},${layer.bgGradient[1]})`:color):color}}/>
                    <div style={{width:20,height:20,borderRadius:4,background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:'700',color:selectedId===layer.id?T.accent:T.muted,flexShrink:0,border:`1px solid ${T.border}`,fontFamily:'monospace'}}>{getLayerIcon(layer)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:layer.hidden?T.muted:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:layer.hidden?'line-through':'none',fontWeight:selectedId===layer.id?'600':'400'}}>{getLayerName(layer)}</div>
                      <div style={{display:'flex',gap:3,marginTop:1}}>
                        {layer.blendMode&&layer.blendMode!=='normal'&&<span style={{fontSize:7,color:T.accent,background:`${T.accent}15`,padding:'0 3px',borderRadius:2}}>{layer.blendMode.slice(0,5)}</span>}
                        {hasEffects&&<span style={{fontSize:7,color:'#f59e0b',background:'#f59e0b15',padding:'0 3px',borderRadius:2}}>fx</span>}
                        {layer.mask?.enabled&&<span style={{fontSize:7,color:'#60a5fa',background:'#60a5fa15',padding:'0 3px',borderRadius:2}}>mask</span>}
                        {layer.locked&&<span style={{fontSize:7,color:T.muted}}>🔒</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:1,flexShrink:0}}>
                      <button onClick={e=>{e.stopPropagation();updateLayer(layer.id,{hidden:!layer.hidden});}} style={{padding:'2px 4px',borderRadius:3,border:'none',background:'transparent',color:layer.hidden?T.danger:T.muted,fontSize:10,cursor:'pointer'}}>{layer.hidden?'○':'●'}</button>
                      {layer.type!=='background'&&(<button onClick={e=>{e.stopPropagation();updateLayer(layer.id,{locked:!layer.locked});}} style={{padding:'2px 4px',borderRadius:3,border:'none',background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}>{layer.locked?'⊠':'⊡'}</button>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}