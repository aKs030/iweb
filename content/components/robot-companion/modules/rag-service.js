export class RAGService {
  constructor() {
    this.pageContent = '';
    this.projectsData = null;
    this.blogData = null;
  }

  /**
   * Scans the current page DOM for relevant text content.
   * Prioritizes headings and paragraphs.
   */
  scanCurrentPage() {
    const main = document.querySelector('main') || document.body;
    // Extract text from important elements, ignoring scripts, styles, and nav/footer for the specific page context
    // We clone to avoid modifying the actual DOM during cleanup
    const clone = main.cloneNode(true);

    // Remove noise
    const noiseSelectors = [
      'script',
      'style',
      'nav',
      'footer',
      '.robot-companion-container',
      '#robot-chat-window',
    ];
    noiseSelectors.forEach((sel) => {
      const els = clone.querySelectorAll(sel);
      els.forEach((el) => el.remove());
    });

    // Strategy: Get structured text
    // We'll just grab innerText for now, which preserves some layout structure (newlines)
    this.pageContent = clone.innerText
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000); // Limit context size
    return this.pageContent;
  }

  /**
   * lazy load project data if needed
   */
  async getProjectsData() {
    if (this.projectsData) return this.projectsData;
    try {
      // Try to fetch from the known apps-config location
      // Note: In the existing codebase, this might be imported.
      // We will try to fetch the JSON file directly if available in public or content.
      // Based on memory, `pages/projekte/apps-config.json` exists.
      const resp = await fetch('/pages/projekte/apps-config.json');
      if (resp.ok) {
        this.projectsData = await resp.json();
      }
    } catch (e) {
      console.warn('RAGService: Could not load projects data', e);
      this.projectsData = [];
    }
    return this.projectsData;
  }

  /**
   * lazy load blog data if needed
   */
  async getBlogData() {
    if (this.blogData) return this.blogData;
    try {
      const resp = await fetch('/content/posts/index.json');
      if (resp.ok) {
        this.blogData = await resp.json();
      }
    } catch (e) {
      console.warn('RAGService: Could not load blog data', e);
      this.blogData = [];
    }
    return this.blogData;
  }

  /**
   * Finds relevant context based on the user query.
   * @param {string} query
   * @returns {Promise<string>}
   */
  async findRelevantContext(query) {
    const lowerQuery = query.toLowerCase();
    let context = `Aktueller Seiteninhalt:\n${this.scanCurrentPage()}\n\n`;

    // Simple keyword matching for global knowledge
    // 1. Projects
    if (
      lowerQuery.includes('projekt') ||
      lowerQuery.includes('app') ||
      lowerQuery.includes('gebaut')
    ) {
      const projects = await this.getProjectsData();
      if (projects && Array.isArray(projects)) {
        const relevantProjects = projects
          .filter(
            (p) =>
              p.title.toLowerCase().includes(lowerQuery) ||
              p.description.toLowerCase().includes(lowerQuery) ||
              JSON.stringify(p.technologies || [])
                .toLowerCase()
                .includes(lowerQuery),
          )
          .slice(0, 3); // Top 3 matches

        if (relevantProjects.length > 0) {
          context += `Gefundene Projekte:\n${relevantProjects.map((p) => `- ${p.title}: ${p.description}`).join('\n')}\n\n`;
        } else {
          // Fallback: Add summaries of all projects if no specific match
          context += `Verfügbare Projekte:\n${projects.map((p) => `- ${p.title}`).join('\n')}\n\n`;
        }
      }
    }

    // 2. Blog
    if (
      lowerQuery.includes('blog') ||
      lowerQuery.includes('artikel') ||
      lowerQuery.includes('post')
    ) {
      const posts = await this.getBlogData();
      if (posts && Array.isArray(posts)) {
        context += `Neueste Blog-Artikel:\n${posts
          .slice(0, 5)
          .map((p) => `- ${p.title} (${p.date})`)
          .join('\n')}\n\n`;
      }
    }

    return context;
  }
}
