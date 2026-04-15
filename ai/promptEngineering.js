'use strict';

// ── Mode guidance ──────────────────────────────────────────────────────────────
const MODE_GUIDANCE = {
  background: 'background only, no people, no faces, environmental scene, dramatic lighting, suitable as a YouTube thumbnail backdrop',
  scene:      'full scene composition, environment with context, cinematic framing, high visual impact, no text overlays',
  character:  'single subject portrait, upper body, expressive face, dramatic expression, clean separation from background',
  style:      'artistic style transformation, cohesive color grading, consistent visual treatment throughout',
};

// ── Style suffixes ─────────────────────────────────────────────────────────────
const STYLE_SUFFIXES = {
  vivid:      'vibrant colors, high contrast, saturated, eye-catching, punchy',
  natural:    'natural lighting, realistic, true-to-life colors, clean and professional',
  cinematic:  'cinematic color grade, film grain, anamorphic lens, dramatic shadows, movie still quality',
  anime:      'anime art style, cel shading, bold outlines, anime aesthetic, manga-inspired',
  painting:   'digital painting, painterly brush strokes, artistic, concept art style, illustrated',
  pixel_art:  'pixel art, 16-bit style, retro game aesthetic, pixelated, crisp pixels',
};

// ── Niche context ──────────────────────────────────────────────────────────────
const NICHE_CONTEXT = {
  gaming:    'gaming aesthetic, game-related visuals, controller or screen elements, intense and action-oriented',
  fitness:   'fitness and health theme, athletic energy, gym or outdoor setting, motivational feel',
  tech:      'technology theme, clean modern aesthetic, digital or hardware elements, professional',
  vlog:      'lifestyle and personal brand, relatable everyday setting, warm and approachable',
  music:     'music theme, concert or studio atmosphere, rhythmic energy, artistic expression',
  food:      'food photography style, appetizing presentation, warm lighting, close-up detail',
  travel:    'travel and adventure theme, exotic or scenic location, wanderlust energy, wide vistas',
  education: 'educational and informative theme, clear and approachable, knowledge-focused, clean visuals',
  comedy:    'comedic and fun theme, exaggerated expressions, playful colors, entertaining energy',
  news:      'news and current events theme, serious and credible, bold and impactful, journalistic',
};

// ── Placeholder prompts ────────────────────────────────────────────────────────
const PLACEHOLDER_PROMPTS = {
  background: [
    'deep space nebula with glowing purple and blue clouds, dramatic cosmic scene',
    'futuristic neon city at night, rain-soaked streets reflecting colorful lights',
    'epic mountain range at golden hour, dramatic clouds, god rays through peaks',
    'dense jungle with ancient ruins, shafts of light breaking through canopy',
    'underwater ocean floor with bioluminescent creatures and coral reef',
  ],
  scene: [
    'crumbling abandoned mansion overtaken by nature, eerie fog in doorways',
    'crowded futuristic market street, holographic signs, diverse alien merchants',
    'rooftop garden party at sunset, string lights, city skyline in background',
    'medieval blacksmith forge, glowing embers, iron being hammered on anvil',
    'arctic ice cave with frozen waterfall, blue ice walls, explorer silhouette',
  ],
  character: [
    'confident entrepreneur in modern office, power pose, looking directly at camera',
    'athlete mid-sprint on track, intense focus, motion blur behind them',
    'wizard casting bright spell, dramatic side lighting, mystical smoke swirling',
    'chef plating a dish, professional kitchen, concentrated expression, white coat',
    'scientist in lab, surrounded by glowing equipment, eureka expression',
  ],
  style: [
    'apply cyberpunk neon color grading with teal and magenta tones',
    'transform into vintage film photograph with warm sepia tones and grain',
    'apply dark moody cinematic grade with crushed blacks and teal shadows',
    'bright and airy studio look with clean whites and soft pastel accents',
    'high contrast graphic novel style with bold shadows and limited color palette',
  ],
};

// ── Main builder ───────────────────────────────────────────────────────────────

/**
 * Builds a YouTube-thumbnail-optimized prompt string.
 *
 * @param {'background'|'scene'|'character'|'style'} mode
 * @param {string} userPrompt  - The raw user input
 * @param {'vivid'|'natural'|'cinematic'|'anime'|'painting'|'pixel_art'} [style]
 * @param {'gaming'|'fitness'|'tech'|'vlog'|'music'|'food'|'travel'|'education'|'comedy'|'news'} [niche]
 * @returns {string} Fully assembled prompt
 */
function buildPrompt(mode, userPrompt, style, niche) {
  const parts = [];

  // Base YouTube thumbnail requirements — always first
  parts.push('YouTube thumbnail, 16:9 aspect ratio, no text overlay, no watermarks');

  // Mode-specific guidance
  const modeGuidance = MODE_GUIDANCE[mode] || MODE_GUIDANCE.background;
  parts.push(modeGuidance);

  // The user's own creative intent
  const cleanPrompt = (userPrompt || '').trim();
  if (cleanPrompt) {
    parts.push(cleanPrompt);
  }

  // Niche context (optional)
  if (niche && NICHE_CONTEXT[niche]) {
    parts.push(NICHE_CONTEXT[niche]);
  }

  // Style suffix (optional)
  if (style && STYLE_SUFFIXES[style]) {
    parts.push(STYLE_SUFFIXES[style]);
  }

  // Quality boosters — always last
  parts.push('ultra high quality, sharp focus, professional photography, 8k resolution');

  return parts.join(', ');
}

module.exports = {
  buildPrompt,
  PLACEHOLDER_PROMPTS,
  MODE_GUIDANCE,
  STYLE_SUFFIXES,
  NICHE_CONTEXT,
};
