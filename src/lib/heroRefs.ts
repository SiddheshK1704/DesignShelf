/**
 * The references shown on the landing page. Each has a duotone illustration
 * (`art`) drawn from its own swatches, a short explainer, and real photos
 * fetched from open-licence sources by scripts/fetch-references.mjs.
 */

export type ArtVariant =
  | 'cup'
  | 'cluster'
  | 'sideboard'
  | 'dial'
  | 'tote'
  | 'poster'
  | 'scooter'
  | 'stair'
  | 'phone';

export type Ratio = '4 / 5' | '1 / 1' | '3 / 4';

export interface HeroRef {
  slug: string;
  subject: string;
  discipline: string;
  ratio: Ratio;
  /** Dark tone, light tone, small accent. Also the caption swatches. */
  swatches: [string, string, string];
  tags: string[];
  /** Words this reference answers to in the search demo. */
  feel: string[];
  art: ArtVariant;
  /** Short factual explainer, one paragraph per entry. */
  about: string[];
  /** What a designer would look at first. */
  notice: string[];
  /** Search queries used to fetch real photos. */
  queries: string[];
}

export const HERO_REFS: HeroRef[] = [
  {
    slug: 'stoneware-cup',
    subject: 'Stoneware cup',
    discipline: 'Industrial',
    ratio: '4 / 5',
    swatches: ['#2A3138', '#CDBB9F', '#8C7A62'],
    tags: ['matte glaze', 'soft radius', 'warm neutral'],
    feel: ['calm', 'soft', 'warm', 'handmade', 'matte', 'quiet'],
    art: 'cup',
    about: [
      'Stoneware is clay fired at roughly 1,200 to 1,300 °C, hot enough for the body to vitrify and hold water even without a glaze.',
      'That density is why a stoneware cup feels heavier and warmer in the hand than porcelain of the same size. Matte glazes thin over edges and pool in recesses, so small changes in radius show up as changes in colour.',
    ],
    notice: [
      'How the glaze thins on the rim and pools near the foot',
      'Wall thickness you can read from the lip',
      'Where the handle joins the body, and how soft that blend is',
      'The unglazed foot ring showing the raw clay colour',
    ],
    queries: ['stoneware mug', 'ceramic cup glaze', 'handmade ceramic mug', 'pottery cup'],
  },
  {
    slug: 'night-cluster',
    subject: 'Night cluster',
    discipline: 'Vehicle',
    ratio: '1 / 1',
    swatches: ['#101716', '#3F7A6E', '#E3A94A'],
    tags: ['low glare', 'amber pointers', 'dark interface'],
    feel: ['technical', 'dark', 'focused', 'night', 'precise', 'premium'],
    art: 'cluster',
    about: [
      'An instrument cluster puts speed, revs and warnings in the driver’s line of sight. It has to work at night as well as by day.',
      'At night designers keep brightness low, use dim warm pointer colours and keep graphics sparse, so a glance stays short and the driver’s eyes stay adjusted to the road.',
    ],
    notice: [
      'Pointer colour against the dial at low brightness',
      'Tick density, and which numerals are left out',
      'Where warning lights sit relative to the main dials',
      'How the hood shades the glass from reflections',
    ],
    queries: ['car instrument cluster night', 'speedometer at night', 'instrument cluster', 'car dashboard gauges'],
  },
  {
    slug: 'walnut-sideboard',
    subject: 'Walnut sideboard',
    discipline: 'Interiors',
    ratio: '3 / 4',
    swatches: ['#3A2A1F', '#D9D1C2', '#7B5536'],
    tags: ['oiled walnut', 'slim legs', 'flush doors'],
    feel: ['warm', 'premium', 'natural', 'calm', 'crafted'],
    art: 'sideboard',
    about: [
      'Walnut is a dense hardwood with a dark, straight to wavy grain that takes an oil finish well.',
      'Mid-century sideboards often pair a long, low case with slim tapered legs, so the mass appears to float. Flush doors cut from one sheet keep the grain running across the front, so it reads as a single surface.',
    ],
    notice: [
      'Whether the grain runs continuously across the doors',
      'Leg taper, and how far the legs sit in from the corners',
      'The edge profile of the top',
      'Pulls, finger grooves or push latches',
    ],
    queries: ['walnut sideboard', 'mid-century sideboard', 'sideboard furniture', 'walnut cabinet'],
  },
  {
    slug: 'aluminium-dial',
    subject: 'Aluminium dial',
    discipline: 'CMF',
    ratio: '1 / 1',
    swatches: ['#3C4249', '#C3C9CF', '#E3A94A'],
    tags: ['brushed finish', 'knurled edge', 'cool metal'],
    feel: ['precise', 'technical', 'cool', 'premium', 'tactile'],
    art: 'dial',
    about: [
      'Brushing drags an abrasive across aluminium in one direction. It leaves fine parallel lines that hide fingerprints and catch light in a band.',
      'Turned knobs often get a spun, circular-brushed face and a knurled edge for grip. The part is usually anodised afterwards, which protects the surface and can add colour.',
    ],
    notice: [
      'Brushing direction, and how the highlight moves as you turn it',
      'Knurl pitch and depth on the edge',
      'The size of the chamfer where face meets side',
      'How the indicator is made: engraved, printed or inlaid',
    ],
    queries: ['knurled knob', 'volume knob', 'aluminium knob', 'amplifier knob', 'synthesizer knobs', 'rotary knob'],
  },
  {
    slug: 'leather-tote',
    subject: 'Saddle leather tote',
    discipline: 'Fashion',
    ratio: '4 / 5',
    swatches: ['#2E211B', '#B9773F', '#E6CFAE'],
    tags: ['veg-tanned', 'edge stitching', 'warm brown'],
    feel: ['warm', 'crafted', 'soft', 'natural', 'premium'],
    art: 'tote',
    about: [
      'Vegetable-tanned leather is tanned with plant tannins rather than chromium salts. It starts pale and firm, then darkens with light and handling, so the bag records how it was used.',
      'Edges are often burnished or painted instead of folded. Hand saddle stitching uses two needles on one thread, so the seam holds even if a stitch breaks.',
    ],
    notice: [
      'Stitch length, and thread colour against the leather',
      'How the edges are finished',
      'How the handles attach: rivets or stitched tabs',
      'Where the body creases and slouches when loaded',
    ],
    queries: ['leather tote bag', 'leather handbag stitching', 'leather bag handmade', 'leather bag'],
  },
  {
    slug: 'grid-poster',
    subject: 'Grid poster',
    discipline: 'Graphic',
    ratio: '3 / 4',
    swatches: ['#E7E1D6', '#B6402F', '#1F2023'],
    tags: ['strict grid', 'red block', 'grotesk type'],
    feel: ['bold', 'graphic', 'loud', 'structured', 'confident'],
    art: 'poster',
    about: [
      'International Typographic Style, often called Swiss style, sets type on a strict modular grid. It favours grotesque sans serifs, asymmetric layouts and large flat areas of colour.',
      'It grew in Switzerland in the 1950s and still shapes editorial layout and interface design.',
    ],
    notice: [
      'The column grid, and whether the type sits on a baseline grid',
      'Scale contrast between the largest and smallest type',
      'How much of the sheet is left empty',
      'How few colours it uses',
    ],
    queries: ['swiss style poster', 'typographic poster', 'international typographic style', 'Müller-Brockmann', 'Basel poster'],
  },
  {
    slug: 'step-through-scooter',
    subject: 'Step-through scooter',
    discipline: 'Vehicle',
    ratio: '1 / 1',
    swatches: ['#24302E', '#8FB8A8', '#E9DFC9'],
    tags: ['step-through frame', 'rounded apron', 'two-tone paint'],
    feel: ['friendly', 'soft', 'retro', 'playful', 'urban', 'warm', 'calm'],
    art: 'scooter',
    about: [
      'A step-through scooter has a low floor between the seat and the steering column, so riders step on instead of swinging a leg over.',
      'The front apron doubles as a leg shield, and small wheels keep the floor low. Bodywork usually wraps the engine or motor, which gives the form its smooth, enclosed look.',
    ],
    notice: [
      'The line from the apron through the floorboard to the rear body',
      'Wheel size relative to the body',
      'Panel split lines, and where the colour changes',
      'Whether the headlight sits on the handlebars or the apron',
    ],
    queries: ['motor scooter', 'scooter parked street', 'electric scooter moped', 'step-through scooter'],
  },
  {
    slug: 'concrete-stair',
    subject: 'Concrete stair',
    discipline: 'Architecture',
    ratio: '4 / 5',
    swatches: ['#2B2C2D', '#9C9A94', '#CFCBC2'],
    tags: ['raw concrete', 'deep shadow', 'stepped mass'],
    feel: ['raw', 'calm', 'heavy', 'monumental', 'quiet'],
    art: 'stair',
    about: [
      'Board-formed concrete is cast against timber planks, so the grain and joints of the boards print into the surface.',
      'Stairs in this material read as stacked mass. Light raking across them picks out every edge and tie hole.',
    ],
    notice: [
      'Board width, and the rhythm of the joints',
      'Tie holes left by the formwork',
      'How crisp the tread edges are',
      'Where the light rakes and where the shadow falls',
    ],
    queries: ['concrete staircase', 'exposed concrete stairs', 'brutalist stairs'],
  },
  {
    slug: 'banking-screen',
    subject: 'Savings app screen',
    discipline: 'UI/UX',
    ratio: '3 / 4',
    swatches: ['#16201E', '#E6ECE8', '#5FA58E'],
    tags: ['generous spacing', 'soft contrast', 'single action'],
    feel: ['calm', 'clean', 'friendly', 'soft', 'trustworthy'],
    art: 'phone',
    about: [
      'People need to trust a finance screen before they act on it.',
      'Calm versions lead with one number, keep a single primary action per screen, and group information with spacing and soft contrast rather than colour. Colour is saved for state: gains, losses and warnings.',
    ],
    notice: [
      'What the eye lands on first',
      'The size of the primary action, and whether a thumb can reach it',
      'The spacing scale between groups',
      'Where colour is used, and what it means',
    ],
    queries: ['mobile banking app', 'smartphone user interface', 'person using smartphone', 'smartphone app', 'phone screen'],
  },
];

export function findRef(slug: string): HeroRef | undefined {
  return HERO_REFS.find((r) => r.slug === slug);
}
