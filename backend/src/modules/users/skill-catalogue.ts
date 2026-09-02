/**
 * The skill catalogue.
 *
 * Free text was the obvious choice and the wrong one: "JS", "js", "Javascript"
 * and "JavaScript" are four different strings to a set intersection, so every
 * skill-overlap score was quietly wrong for anyone who typed a variant. A
 * closed catalogue makes the matching honest.
 *
 * It is served to the client rather than duplicated there, so the list the
 * picker offers and the list the validator accepts cannot drift.
 */

export interface SkillCategory {
  name: string;
  skills: readonly string[];
}

export const SKILL_CATEGORIES: readonly SkillCategory[] = [
  {
    name: 'Languages',
    skills: [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'C', 'Go', 'Rust',
      'Ruby', 'PHP', 'Swift', 'Kotlin', 'Dart', 'Scala', 'R', 'MATLAB', 'Solidity',
      'SQL', 'Bash', 'Lua', 'Elixir', 'Haskell', 'Perl', 'Zig', 'Assembly',
    ],
  },
  {
    name: 'Frontend',
    skills: [
      'React', 'Next.js', 'Vue', 'Nuxt', 'Angular', 'Svelte', 'SvelteKit', 'Astro',
      'Tailwind CSS', 'HTML', 'CSS', 'Sass', 'Redux', 'Three.js', 'WebGL', 'D3.js',
      'Framer Motion', 'Vite', 'Webpack', 'Storybook', 'Accessibility (a11y)',
    ],
  },
  {
    name: 'Backend',
    skills: [
      'Node.js', 'Express', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
      'Ruby on Rails', 'Laravel', '.NET', 'Gin', 'Phoenix', 'GraphQL', 'REST APIs',
      'gRPC', 'WebSockets', 'Microservices', 'Message queues',
    ],
  },
  {
    name: 'Mobile',
    skills: [
      'React Native', 'Flutter', 'SwiftUI', 'Jetpack Compose', 'Expo', 'Ionic',
      'Android SDK', 'iOS (UIKit)',
    ],
  },
  {
    name: 'Data & ML',
    skills: [
      'PyTorch', 'TensorFlow', 'scikit-learn', 'Pandas', 'NumPy', 'Keras',
      'Hugging Face', 'LangChain', 'OpenCV', 'spaCy', 'Jupyter', 'Apache Spark',
      'dbt', 'Airflow', 'Data visualisation', 'Statistics',
    ],
  },
  {
    name: 'AI',
    skills: [
      'Prompt engineering', 'LLM fine-tuning', 'RAG pipelines', 'Vector databases',
      'Computer vision', 'NLP', 'Reinforcement learning', 'Speech recognition',
      'Diffusion models', 'AI agents',
    ],
  },
  {
    name: 'Databases',
    skills: [
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Supabase', 'Firebase',
      'Elasticsearch', 'Neo4j', 'DynamoDB', 'Prisma', 'Cassandra', 'ClickHouse',
    ],
  },
  {
    name: 'DevOps & Cloud',
    skills: [
      'Docker', 'Kubernetes', 'AWS', 'Google Cloud', 'Azure', 'Terraform',
      'GitHub Actions', 'CI/CD', 'Nginx', 'Linux', 'Vercel', 'Netlify', 'Ansible',
      'Cloudflare', 'Monitoring & observability', 'Serverless',
    ],
  },
  {
    name: 'Design',
    skills: [
      'Figma', 'Adobe XD', 'Photoshop', 'Illustrator', 'After Effects', 'Blender',
      'Sketch', 'Framer', 'Canva', 'Procreate', 'UI design', 'UX research',
      'Wireframing', 'Prototyping', 'Design systems', 'Motion design', 'Typography',
      'Illustration', '3D modelling',
    ],
  },
  {
    name: 'Game development',
    skills: [
      'Unity', 'Unreal Engine', 'Godot', 'Phaser', 'Shader programming',
      'Game design', 'Level design', 'Pixel art',
    ],
  },
  {
    name: 'Hardware & IoT',
    skills: [
      'Arduino', 'Raspberry Pi', 'ESP32', '3D printing', 'PCB design', 'Robotics',
      'ROS', 'Embedded C', 'Sensors',
    ],
  },
  {
    name: 'Web3',
    skills: [
      'Smart contracts', 'Ethereum', 'Hardhat', 'web3.js', 'ethers.js', 'IPFS',
      'Solana', 'Tokenomics',
    ],
  },
  {
    name: 'Security',
    skills: [
      'Penetration testing', 'Cryptography', 'OWASP', 'Network security',
      'Reverse engineering', 'Burp Suite', 'Wireshark', 'Threat modelling',
    ],
  },
  {
    name: 'Product & craft',
    skills: [
      'Product management', 'Agile / Scrum', 'User research', 'Pitching',
      'Public speaking', 'Technical writing', 'Data analysis', 'Git',
      'Testing / QA', 'Video editing', 'Copywriting', 'Business modelling',
      'Market research', 'Project management',
    ],
  },
];

/** Every skill, flattened. Frozen because it is a lookup, not a working list. */
export const ALL_SKILLS: readonly string[] = Object.freeze(
  SKILL_CATEGORIES.flatMap((category) => category.skills),
);

/**
 * The starter set the profile builder shows before anyone searches.
 *
 * Twenty-five is enough that most people find several without typing, and few
 * enough to scan in one go. Everything else is one search away.
 */
export const POPULAR_SKILLS: readonly string[] = [
  'JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'HTML', 'CSS', 'Git',
  'SQL', 'PostgreSQL', 'Docker', 'Figma', 'Java', 'C++', 'Next.js', 'Tailwind CSS',
  'MongoDB', 'AWS', 'Flutter', 'PyTorch', 'TensorFlow', 'Unity', 'Blender',
  'REST APIs', 'Firebase',
];

/**
 * How good someone is at a skill, 0–100.
 *
 * The number is what gets scored; these are the words shown next to it. A bare
 * "62/100 at Python" means nothing consistent between two people — "Strong"
 * does — so the slider always reads back a label, and the label is the only
 * thing the profile displays at rest.
 *
 * Bands are contiguous and cover 0–100 with no gaps; `bandForLevel` relies on
 * that and on the order.
 */
export const SKILL_LEVELS = [
  { min: 0, max: 19, label: 'Learning', blurb: 'Just started' },
  { min: 20, max: 39, label: 'Familiar', blurb: 'Can follow a tutorial' },
  { min: 40, max: 59, label: 'Comfortable', blurb: 'Can build with it' },
  { min: 60, max: 79, label: 'Strong', blurb: 'Could teach it' },
  { min: 80, max: 100, label: 'Expert', blurb: 'People ask me' },
] as const;

export type SkillBand = (typeof SKILL_LEVELS)[number];

export const MIN_SKILL_LEVEL = 0;
export const MAX_SKILL_LEVEL = 100;

/**
 * The level assumed for a skill somebody selected but never rated.
 *
 * Mid-scale on purpose. Defaulting high would let anyone inflate their profile
 * by adding skills and never touching a slider; defaulting to zero would
 * punish them for the same thing.
 */
export const DEFAULT_SKILL_LEVEL = 50;

/** The band a raw 0–100 value falls in. Clamps, so out-of-range input is safe. */
export function bandForLevel(level: number): SkillBand {
  const clamped = Math.min(MAX_SKILL_LEVEL, Math.max(MIN_SKILL_LEVEL, level));
  // The last band is the fallback rather than an error: `max` on it is 100, so
  // the only way to miss every band is a NaN, and a NaN should not throw here.
  return SKILL_LEVELS.find((band) => clamped <= band.max) ?? SKILL_LEVELS[SKILL_LEVELS.length - 1];
}

/** "Strong" — what the UI shows beside the slider. */
export function labelForLevel(level: number): string {
  return bandForLevel(level).label;
}

export const MAX_SKILLS = 20;

/** Case-insensitive lookup, so a stored value survives a catalogue re-casing. */
const BY_LOWER = new Map(ALL_SKILLS.map((skill) => [skill.toLowerCase(), skill]));

export function canonicaliseSkill(value: string): string | null {
  return BY_LOWER.get(value.trim().toLowerCase()) ?? null;
}

export function isKnownSkill(value: string): boolean {
  return canonicaliseSkill(value) !== null;
}
