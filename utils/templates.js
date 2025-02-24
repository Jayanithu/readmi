export const README_TEMPLATES = {
  minimal: {
    sections: ['title', 'description', 'installation', 'usage'],
    prompt: 'Create a minimal README with essential information'
  },
  standard: {
    sections: ['title', 'description', 'installation', 'usage', 'api', 'license'],
    prompt: 'Create a standard README with common sections'
  },
  comprehensive: {
    sections: ['title', 'description', 'installation', 'usage', 'api', 'contributing', 'testing', 'license', 'troubleshooting'],
    prompt: 'Create a detailed README with all sections'
  }
}; 