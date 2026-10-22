/**
 * Design doc mode: turn a brief into a structured handoff document.
 * Gemini writes JSON against a schema; the Mermaid diagram is checked with
 * mermaid.parse and sent back once for repair if it doesn't parse.
 */
import { shelfMatches } from './assistant';
import { generateJson, withBackoff, type Part } from './gemini';
import { lookFurther } from './lookFurther';
import { checkMermaid, cleanMermaid } from './mermaid';
import { searchOpenImages } from './sources';
import type { DesignDoc, ImageRecord, Lens, SavedDoc } from './types';

const ITEM = {
  type: 'OBJECT',
  properties: { title: { type: 'STRING' }, detail: { type: 'STRING' } },
  required: ['title', 'detail'],
};
const LIST = { type: 'ARRAY', items: { type: 'STRING' } };

const DOC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Short and specific.' },
    summary: { type: 'STRING', description: 'One line.' },
    problem: { type: 'STRING', description: 'Two or three sentences.' },
    audience: { type: 'STRING', description: 'Two or three sentences.' },
    goals: { ...LIST, description: '3 to 5, one line each.' },
    constraints: { ...LIST, description: '3 to 5, one line each.' },
    principles: { type: 'ARRAY', items: ITEM, minItems: 3, maxItems: 5 },
    visual: {
      type: 'OBJECT',
      properties: { form: LIST, material: LIST, colour: LIST, mood: LIST },
      required: ['form', 'material', 'colour', 'mood'],
    },
    lensSection: {
      type: 'OBJECT',
      properties: { heading: { type: 'STRING' }, items: { type: 'ARRAY', items: ITEM } },
      required: ['heading', 'items'],
    },
    queries: {
      type: 'ARRAY',
      maxItems: 3,
      items: {
        type: 'OBJECT',
        properties: { label: { type: 'STRING' }, query: { type: 'STRING' } },
        required: ['label', 'query'],
      },
    },
    risks: LIST,
    questions: LIST,
    architecture: {
      type: 'OBJECT',
      properties: {
        kind: { type: 'STRING', description: 'zones and components, flows, or information architecture' },
        mermaid: { type: 'STRING' },
        explanation: { type: 'STRING' },
      },
      required: ['kind', 'mermaid', 'explanation'],
    },
  },
  required: [
    'title', 'summary', 'problem', 'audience', 'goals', 'constraints', 'principles',
    'visual', 'lensSection', 'queries', 'risks', 'questions', 'architecture',
  ],
};

const MERMAID_RULES = [
  'Start with "flowchart TD" or "flowchart LR".',
  'Use 6 to 18 nodes. Node ids use only letters and digits.',
  'Put every label in double quotes, e.g. A["Charging dock"] --> B["Battery"]. Edge labels also in quotes: A -->|"powers"| B.',
  'You may group nodes with subgraph id["Label"] ... end.',
  'No styling, no classDef, no click, no HTML, no markdown fences, no comments.',
].join(' ');

const SYSTEM = [
  'You write design handoff documents for designers of any discipline.',
  'Plain, specific language. Short sentences. No hype. Avoid brand names unless the brief names them.',
  'Never include URLs, links or image addresses.',
].join('\n');

export interface DocInput {
  brief: string;
  lens: Lens;
  uploads: { mimeType: string; data: string }[];
  board?: { name: string; images: ImageRecord[]; inline: { mimeType: string; data: string }[] };
  /** Most-used tags in the library, per group, so the doc speaks the same language. */
  vocabulary: Record<string, string[]>;
}

export type Stage = 'writing' | 'checking' | 'repairing' | 'references';

function prompt(input: DocInput): string {
  const lines = [`Brief:\n${input.brief.trim()}`, '', `Discipline lens: ${input.lens.name}. This lens looks at ${input.lens.focus}.`];
  if (input.board?.images.length) {
    lines.push('', `Reference board "${input.board.name}". Its references (some are attached as images):`);
    for (const img of input.board.images.slice(0, 12)) {
      const tags = Object.values(img.tags).flat().slice(0, 8).join(', ');
      lines.push(`- ${img.subject || img.name}${tags ? `: ${tags}` : ''}`);
    }
  }
  const vocab = Object.entries(input.vocabulary).filter(([, t]) => t.length);
  if (vocab.length) {
    lines.push('', 'Tag vocabulary already used in this designer’s library. Prefer these words where they fit:');
    for (const [g, t] of vocab) lines.push(`${g}: ${t.join(', ')}`);
  }
  lines.push(
    '',
    'Write the design doc:',
    '- title (short, specific) and summary (one line).',
    '- problem and audience: two or three sentences each.',
    '- goals and constraints: 3 to 5 each, one line each.',
    '- principles: 3 to 5, each a short title and one sentence.',
    '- visual: 3 to 6 lowercase tags (1 to 3 words) each for form, material, colour and mood.',
    `- lensSection: a heading for the ${input.lens.name} lens (for example "CMF directions" or "UI directions"), with 3 to 5 items, each a title and one or two sentences.`,
    '- queries: up to 3 image-search queries of 2 to 4 broad, concrete visual words (they must return photos on Wikimedia Commons, so avoid long or niche phrases).',
    '- risks and questions: 2 to 4 each.',
    '- architecture: pick what fits the brief: zones and components (objects, vehicles, spaces), flows (services, journeys), or information architecture (apps, sites). Name it in kind.',
    `  mermaid: a Mermaid diagram of that structure. ${MERMAID_RULES}`,
    '  explanation: two or three sentences on how to read the diagram.',
  );
  return lines.join('\n');
}

function tidy(d: DesignDoc): DesignDoc {
  const list = (a?: string[], n = 6) => (a ?? []).map((s) => s.trim()).filter(Boolean).slice(0, n);
  const items = (a?: { title: string; detail: string }[], n = 5) =>
    (a ?? []).filter((x) => x?.title).slice(0, n).map((x) => ({ title: x.title.trim(), detail: (x.detail ?? '').trim() }));
  return {
    title: d.title?.trim() || 'Design doc',
    summary: d.summary?.trim() ?? '',
    problem: d.problem?.trim() ?? '',
    audience: d.audience?.trim() ?? '',
    goals: list(d.goals),
    constraints: list(d.constraints),
    principles: items(d.principles),
    visual: {
      form: list(d.visual?.form).map((t) => t.toLowerCase()),
      material: list(d.visual?.material).map((t) => t.toLowerCase()),
      colour: list(d.visual?.colour).map((t) => t.toLowerCase()),
      mood: list(d.visual?.mood).map((t) => t.toLowerCase()),
    },
    lensSection: { heading: d.lensSection?.heading?.trim() || 'Directions', items: items(d.lensSection?.items) },
    queries: (d.queries ?? []).filter((q) => q?.query?.trim()).slice(0, 3).map((q) => ({ label: q.label.trim() || q.query, query: q.query.trim() })),
    risks: list(d.risks, 4),
    questions: list(d.questions, 4),
    architecture: {
      kind: d.architecture?.kind?.trim() ?? '',
      mermaid: cleanMermaid(d.architecture?.mermaid ?? ''),
      explanation: d.architecture?.explanation?.trim() ?? '',
    },
  };
}

async function repairMermaid(code: string, error: string, brief: string, onWait?: (ms: number) => void): Promise<string> {
  const out = await withBackoff(
    () =>
      generateJson<{ mermaid: string }>(
        [
          {
            text: [
              'This Mermaid diagram failed to parse. Return a corrected version with the same meaning.',
              MERMAID_RULES,
              `Parser error:\n${error}`,
              `Diagram:\n${code}`,
              `It illustrates this brief: ${brief.slice(0, 600)}`,
            ].join('\n\n'),
          },
        ],
        { type: 'OBJECT', properties: { mermaid: { type: 'STRING' } }, required: ['mermaid'] },
        { system: SYSTEM, temperature: 0.2 },
      ),
    onWait,
  );
  return cleanMermaid(out.mermaid ?? '');
}

export async function writeDoc(
  input: DocInput,
  onStage: (s: Stage) => void,
  onWait?: (ms: number) => void,
): Promise<{ doc: DesignDoc; diagram: SavedDoc['diagram'] }> {
  onStage('writing');
  const parts: Part[] = [
    ...input.uploads.map((inlineData) => ({ inlineData })),
    ...(input.board?.inline ?? []).map((inlineData) => ({ inlineData })),
    { text: prompt(input) },
  ];
  const doc = tidy(
    await withBackoff(() => generateJson<DesignDoc>(parts, DOC_SCHEMA, { system: SYSTEM, temperature: 0.5 }), onWait),
  );

  onStage('checking');
  let error = doc.architecture.mermaid ? await checkMermaid(doc.architecture.mermaid) : 'The diagram was empty.';
  if (!error) return { doc, diagram: { ok: true } };

  // One repair attempt, as agreed. If it still fails, the code is shown with the error.
  onStage('repairing');
  // Keep whichever code produced the error we show, so the two always match.
  let shown = doc.architecture.mermaid;
  try {
    const fixed = await repairMermaid(doc.architecture.mermaid, error, input.brief, onWait);
    const again = fixed ? await checkMermaid(fixed) : 'The repaired diagram was empty.';
    if (!again) return { doc: { ...doc, architecture: { ...doc.architecture, mermaid: fixed } }, diagram: { ok: true, repaired: true } };
    if (fixed) shown = fixed;
    error = again;
  } catch (err) {
    error = `${error}\n(Repair request failed: ${(err as Error).message})`;
  }
  return { doc: { ...doc, architecture: { ...doc.architecture, mermaid: shown } }, diagram: { ok: false, error } };
}

/** Board references first, then the best hybrid-search matches from the rest of the shelf. */
export async function pickReferences(images: ImageRecord[], brief: string, doc: DesignDoc, boardIds: string[], useEmbeddings: boolean) {
  const fromBoard = boardIds.slice(0, 8);
  const matches = await shelfMatches(
    images.filter((i) => !fromBoard.includes(i.id)),
    brief,
    { summary: '', directions: [], queries: doc.queries },
    useEmbeddings,
    6,
  ).catch(() => []);
  return [...fromBoard, ...matches.map((m) => m.id)];
}

/** Most-used tags per group across the library. */
export function vocabulary(images: ImageRecord[], perGroup = 15): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of ['form', 'material', 'colour', 'mood']) {
    const counts = new Map<string, number>();
    for (const img of images) for (const t of img.tags[g] ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    out[g] = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, perGroup).map(([t]) => t);
  }
  return out;
}

/* ---------- Markdown ---------- */

const bullets = (a: string[]) => a.map((x) => `- ${x}`).join('\n');
const esc = (s: string) => s.replace(/([[\]])/g, '\\$1');

export async function toMarkdown(saved: SavedDoc, shelf: ImageRecord[], lensName: string, boardName?: string): Promise<string> {
  const d = saved.doc;
  const out: string[] = [
    `# ${d.title}`,
    '',
    `_${d.summary}_`,
    '',
    `> Lens: ${lensName}${boardName ? ` · Board: ${boardName}` : ''} · Written ${new Date(saved.createdAt).toLocaleDateString()}`,
    '',
    '## Brief',
    '',
    saved.brief.trim(),
    '',
    '## Problem and audience',
    '',
    `**Problem.** ${d.problem}`,
    '',
    `**Audience.** ${d.audience}`,
    '',
    '## Goals and constraints',
    '',
    '### Goals',
    '',
    bullets(d.goals),
    '',
    '### Constraints',
    '',
    bullets(d.constraints),
    '',
    '## Design principles',
    '',
    d.principles.map((p) => `- **${p.title}.** ${p.detail}`).join('\n'),
    '',
    '## Visual direction',
    '',
    `- **Form:** ${d.visual.form.join(', ')}`,
    `- **Material:** ${d.visual.material.join(', ')}`,
    `- **Colour:** ${d.visual.colour.join(', ')}`,
    `- **Mood:** ${d.visual.mood.join(', ')}`,
    '',
    `## ${d.lensSection.heading}`,
    '',
    d.lensSection.items.map((i) => `- **${i.title}.** ${i.detail}`).join('\n'),
    '',
    '## References',
    '',
    '### From the shelf',
    '',
    shelf.length
      ? shelf.map((i) => `- ${i.subject || i.name}${i.description ? `: ${i.description.split(/(?<=\.)\s/)[0]}` : ''}`).join('\n')
      : '- None yet.',
    '',
  ];

  if (d.queries.length) {
    out.push('### Open images', '');
    // All queries at once; each source has its own short timeout.
    const results = await Promise.allSettled(d.queries.map((q) => searchOpenImages(q.query, 4)));
    for (const [i, q] of d.queries.entries()) {
      out.push(`**${q.label}** (“${q.query}”)`, '');
      const res = results[i];
      if (res.status === 'fulfilled') {
        const r = res.value;
        if (r.usedQuery) out.push(`_Nothing matched the full phrase; these are for “${r.usedQuery}”._`, '');
        out.push(
          r.images.length
            ? r.images
                .map((img) => `- [${esc(img.title)}](${img.sourceUrl}) by ${img.creator}, ${img.licenceUrl ? `[${img.licence}](${img.licenceUrl})` : img.licence}, via ${img.provider}`)
                .join('\n')
            : '- No open-licensed photos found.',
        );
      } else {
        out.push('- Could not reach the open image sources when this file was made.');
      }
      out.push('');
    }
    out.push('### Look further', '');
    for (const q of d.queries) {
      out.push(`- **${q.label}:** ${lookFurther(q.query).map((l) => `[${l.site}](${l.href})`).join(' · ')}`);
    }
    out.push('');
  }

  out.push(
    '## Risks and open questions',
    '',
    '### Risks',
    '',
    bullets(d.risks),
    '',
    '### Open questions',
    '',
    bullets(d.questions),
    '',
    '## Architecture',
    '',
    d.architecture.kind ? `_${d.architecture.kind}_\n` : '',
    '```mermaid',
    d.architecture.mermaid,
    '```',
    '',
    saved.diagram.ok ? '' : `> This diagram didn’t pass Mermaid’s parser: ${saved.diagram.error?.split('\n')[0] ?? ''}\n`,
    d.architecture.explanation,
    '',
  );
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export function fileName(title: string): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'design-doc'}.md`;
}
