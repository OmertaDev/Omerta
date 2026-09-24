// The reusable painted plates carry the house style; the SVG compositor owns all lettering.
export const NFT_MODEL = 'fal-ai/flux-2-pro';
export const NFT_PORTRAIT_MODEL = 'fal-ai/flux-2/klein/4b';
export function nftArtCost(model, { width, height }) {
  const megapixels = Math.max(1, Math.ceil(width * height / 1048576));
  if (model === NFT_PORTRAIT_MODEL) return megapixels * 0.005;
  if (model === NFT_MODEL) return 0.03 + (megapixels - 1) * 0.015;
  throw new Error('Unknown NFT art model.');
}
export const NFT_STYLE = 'Original collectible illustration for OMERTA, a fictional 1940s crime city. '
  + 'Hand-painted gouache and oil on rough ivory paper, angular editorial brushwork, sophisticated vintage noir book jacket, '
  + 'deep ink-black shadows, aged brass gold highlights, desaturated petroleum teal, small oxblood accents, tactile drybrush edges, dramatic chiaroscuro. '
  + 'Rich readable midtones, restrained palette, masterful composition. Single full-bleed artwork, no text, letters, labels, logos, signatures, borders, cards, panels or watermark.';
export const PORTRAIT_STYLE = 'Square image. Waist-up portrait, head and shoulders centered, head entirely visible with generous space above it, '
  + 'expressive face around upper-middle, shoulders fill lower half. Dark abstract architectural background. One fictional adult, not a celebrity. ';
export const PORTRAIT_SUBJECTS = [
  'A sharp-featured olive-skinned man in his early forties, dark wavy slicked-back hair with a silver streak, strong aquiline nose, faint cheek scar, watchful expression. Charcoal three-piece wool suit, loosened burgundy tie, amber light from left and misty teal from right.',
  'A commanding Black man in his early fifties, broad cheekbones, close cropped salt-and-pepper hair, neatly trimmed moustache, steady intelligent gaze. Midnight blue double-breasted wool coat, cream shirt, aged brass collar bar, amber light.',
  'A self-possessed East Asian woman in her late thirties, sharp cheekbones, short waved black bob haircut, strong arched eyebrows, quiet watchful expression. Structured oxblood wool blazer with broad 1940s lapels and ivory blouse, brass stud earrings.',
  'A weathered pale man in his late sixties, deep forehead lines, neatly combed white hair, lean angular face, one raised eyebrow, thin silver moustache. Dark bottle-green herringbone overcoat, cream scarf, softly glowing amber rim light.',
  'A Black woman in her early forties with deep brown skin, sculptural 1940s victory-roll hair, direct confident gaze, broad cheekbones. Black tailored jacket with golden silk blouse, small burgundy brooch.',
  'A Mediterranean man in his thirties, strong heavy jaw, shaved head, short dark beard, broken-looking crooked nose and wide shoulders. Brown leather overcoat over black wool and cream open collar, pale gold rim light.',
  'A woman in her fifties with warm olive skin, striking silver streak through dark swept-up hair, long aquiline nose, knowing half-smile. Teal silk scarf and severe charcoal tailored coat, vintage round tortoiseshell eyeglasses.',
  'An East Asian man in his mid-forties, narrow long face, swept side-parted black hair, thin moustache, small round gold wire eyeglasses, measured thoughtful expression. Deep charcoal pinstriped suit and muted burgundy tie.',
  'A pale freckled woman in her thirties with copper-red shoulder-length waves, strong angular jaw, cool green eyes, reserved determined expression. Dark navy overcoat with high collar and ivory silk scarf.',
  'A broad-shouldered South Asian man in his fifties, warm brown skin, thick salt-and-pepper wavy hair, prominent brow and well-groomed moustache. Charcoal shawl collar overcoat, deep emerald waistcoat, ivory shirt.',
  'A lean olive-skinned man in his late twenties, dark curly hair, dark eyes, clean shaven narrow face, subtle asymmetric smile. Worn charcoal flat cap, rolled ivory shirt collar under a tailored ink-black jacket.',
  'A woman in her sixties with light brown skin, short sculpted silver hair, deep smile lines, piercing dark eyes and a strong chin. Burgundy velvet jacket over cream blouse, a single antique amber pendant.',
];
export const DEED_SUBJECTS = {
  docks: 'An elevated three-quarter view of a magnificent 1940s waterfront city block at dusk. Brick customs warehouses, a long moored black cargo steamer, delicate dock cranes, wet stone quay, amber warehouse windows reflected in dark teal water. Monumental architecture, harbor mist, a few tiny distant figures for scale.',
  neon: 'An elevated three-quarter view of a glamorous 1940s art deco theater city block at blue hour. A grand corner theater with a stepped tower, glowing blank cream marquee, burgundy awnings, elegant jazz club facades, curved glass, wet black pavement reflecting muted amber and teal. Tiny period automobiles for scale.',
  foundry: 'An elevated three-quarter view of a monumental 1940s industrial city block. Red brick foundry halls with tall arched amber-lit windows, riveted steel gantries, copper smokestacks, a short rail spur, steam drifting across a petrol-teal evening sky. Dignified working architecture, controlled furnace glow, no flames.',
  brick: 'An elevated three-quarter view of a dense 1940s brick residential city block at evening. Beautiful russet brownstone row houses, cast iron fire escapes, narrow cobbled lanes, rooftop water towers, one warm corner cafe without signs, laundry lines and glowing windows. Intimate lived-in architecture, tiny figures for scale.',
  canal: 'An elevated three-quarter view of an atmospheric 1940s canal-side city block at dawn. Narrow stone canal bordered by tall faded teal and ochre warehouses, an elegant arched iron footbridge, a low wooden barge, amber lamps, reflections in still black water and pale mist. Beautiful masonry and intricate rooflines.',
  cathedral: 'An elevated three-quarter view of a grand 1940s hilltop city block in evening mist. A magnificent stone cathedral with a rose window and twin towers, elegant art deco apartment buildings, broad stepped plaza, old cypress trees, brass streetlamps and softly glowing amber windows. Monumental dignified city architecture.',
};
export const portraitPrompt = (index) => PORTRAIT_STYLE + PORTRAIT_SUBJECTS[index % PORTRAIT_SUBJECTS.length] + ' ' + NFT_STYLE;
export const deedPrompt = (district) => 'Wide 4:3 composition. The entire city block centered with breathing room around its rooftops. ' + DEED_SUBJECTS[district] + ' ' + NFT_STYLE;
export const NFT_ART_JOBS = [
  ...PORTRAIT_SUBJECTS.map((_, i) => ({ id: `portrait-${String(i).padStart(2, '0')}`, prompt: portraitPrompt(i), model: NFT_PORTRAIT_MODEL })),
  ...Object.keys(DEED_SUBJECTS).map((district) => ({ id: `deed-${district}`, prompt: deedPrompt(district), model: NFT_MODEL })),
];
