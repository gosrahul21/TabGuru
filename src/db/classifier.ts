// ─── Category Classifier ──────────────────────────────────────────────────────
// Assigns a human-readable category to a purpose based on keywords and domain.

const RULES: Array<{ category: string; domains?: string[]; keywords?: string[] }> = [
  {
    category: 'Programming / Dev',
    domains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'developer.mozilla.org', 'vercel.com', 'netlify.com', 'codepen.io', 'replit.com'],
    keywords: ['code', 'program', 'debug', 'deploy', 'api', 'git', 'commit', 'build', 'test', 'review', 'pr', 'pull request', 'bug', 'fix', 'refactor', 'feature', 'dev', 'backend', 'frontend', 'database', 'server', 'docker', 'ci', 'cd'],
  },
  {
    category: 'Learning / Research',
    domains: ['wikipedia.org', 'arxiv.org', 'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'medium.com', 'substack.com', 'scholar.google.com'],
    keywords: ['learn', 'study', 'research', 'course', 'documentation', 'docs', 'tutorial', 'read', 'article', 'understand', 'explore', 'investigate', 'notes', 'wiki', 'guide', 'how to'],
  },
  {
    category: 'Leisure / Entertainment',
    domains: ['youtube.com', 'netflix.com', 'twitch.tv', 'reddit.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'spotify.com', 'disney.com', 'primevideo.com'],
    keywords: ['watch', 'video', 'music', 'movie', 'show', 'stream', 'browse', 'scroll', 'entertainment', 'game', 'play', 'fun', 'social'],
  },
  {
    category: 'Admin / Shopping',
    domains: ['amazon.com', 'ebay.com', 'booking.com', 'airbnb.com', 'expedia.com', 'google.com/maps', 'paypal.com', 'stripe.com', 'notion.so', 'trello.com', 'jira.com'],
    keywords: ['buy', 'shop', 'order', 'ticket', 'hotel', 'flight', 'book', 'purchase', 'email', 'calendar', 'meeting', 'invoice', 'pay', 'billing', 'admin', 'manage', 'organise', 'organize', 'plan'],
  },
  {
    category: 'Communication',
    domains: ['gmail.com', 'mail.google.com', 'outlook.com', 'slack.com', 'discord.com', 'whatsapp.com', 'telegram.org', 'zoom.us', 'teams.microsoft.com'],
    keywords: ['email', 'message', 'chat', 'reply', 'respond', 'call', 'meeting', 'slack', 'discord'],
  },
];

export function classifyPurpose(purposeText: string, domain: string): string {
  const normalizedPurpose = purposeText.toLowerCase();
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  for (const rule of RULES) {
    // Domain match
    if (rule.domains?.some((d) => normalizedDomain.includes(d.replace(/^www\./, '')))) {
      return rule.category;
    }
    // Keyword match in purpose text
    if (rule.keywords?.some((kw) => normalizedPurpose.includes(kw))) {
      return rule.category;
    }
  }

  return 'Other';
}
