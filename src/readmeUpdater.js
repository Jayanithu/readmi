import fs from 'fs/promises';
import { existsSync } from 'fs';

// Analyzes existing README structure and sections
export async function analyzeExistingReadme(filePath = 'README.md') {
  if (!existsSync(filePath)) return null;
  const content = await fs.readFile(filePath, 'utf-8');
  return {
    exists: true,
    content,
    sections: extractSections(content),
    metadata: extractMetadata(content),
    customSections: identifyCustomSections(content),
    structure: analyzeStructure(content)
  };
}

// Extract markdown sections
function extractSections(content) {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let currentContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headerMatch) {
      if (currentSection) {
        sections.push({
          ...currentSection,
          content: currentContent.join('\n').trim(),
          endLine: i - 1
        });
      }
      currentSection = {
        level: headerMatch[1].length,
        title: headerMatch[2].trim(),
        startLine: i,
        rawTitle: line
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  
  if (currentSection) {
    sections.push({
      ...currentSection,
      content: currentContent.join('\n').trim(),
      endLine: lines.length - 1
    });
  }
  
  return sections;
}

// Extract metadata (badges, version, links)
function extractMetadata(content) {
  const metadata = { badges: [], version: null, links: [], hasTableOfContents: false };
  const badgeRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = badgeRegex.exec(content)) !== null) {
    metadata.badges.push({ alt: match[1], url: match[2] });
  }
  const versionMatch = content.match(/version[:\s]+(\d+\.\d+\.\d+)/i) || content.match(/v(\d+\.\d+\.\d+)/);
  if (versionMatch) metadata.version = versionMatch[1];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = linkRegex.exec(content)) !== null) {
    if (match[2].startsWith('http') || match[2].startsWith('#')) {
      metadata.links.push({ text: match[1], url: match[2] });
    }
  }
  metadata.hasTableOfContents = /##?\s+Table of Contents/i.test(content);
  return metadata;
}

// Identify custom (non-standard) sections
function identifyCustomSections(content) {
  const standardSections = [
    'installation', 'install', 'getting started', 'usage', 'features',
    'requirements', 'prerequisites', 'contributing', 'license', 'documentation',
    'examples', 'api', 'configuration', 'testing', 'deployment', 'support',
    'changelog', 'roadmap', 'acknowledgments', 'authors', 'faq', 'troubleshooting'
  ];
  const sections = extractSections(content);
  const customSections = [];
  for (const section of sections) {
    const normalizedTitle = section.title.toLowerCase();
    const isStandard = standardSections.some(std => 
      normalizedTitle.includes(std) || std.includes(normalizedTitle)
    );
    if (!isStandard && section.level <= 2) {
      customSections.push({
        title: section.title,
        content: section.content,
        startLine: section.startLine,
        endLine: section.endLine
      });
    }
  }
  return customSections;
}

// Analyze README structure
function analyzeStructure(content) {
  const lines = content.split('\n');
  return {
    totalLines: lines.length,
    hasHeader: /^#\s+.+/.test(content),
    headerStyle: content.startsWith('<div') ? 'html' : 'markdown',
    hasBadges: /!\[.*\]\(.*\)/.test(content),
    hasCodeBlocks: /```/.test(content),
    codeBlockCount: (content.match(/```/g) || []).length / 2,
    hasEmojis: /[\u{1F300}-\u{1F9FF}]/u.test(content),
    hasTables: /\|.*\|.*\|/.test(content)
  };
}

// Detect outdated information
export function detectOutdatedInfo(readmeAnalysis, projectInfo) {
  const issues = [];
  if (!readmeAnalysis || !readmeAnalysis.exists) return issues;
  
  if (readmeAnalysis.metadata.version && projectInfo.version) {
    if (readmeAnalysis.metadata.version !== projectInfo.version) {
      issues.push({
        type: 'version',
        severity: 'medium',
        current: readmeAnalysis.metadata.version,
        expected: projectInfo.version,
        message: `Version in README (${readmeAnalysis.metadata.version}) doesn't match package.json (${projectInfo.version})`
      });
    }
  }
  
  const readmeContent = readmeAnalysis.content.toLowerCase();
  const importantScripts = ['test', 'build', 'start', 'dev'];
  
  if (projectInfo.scripts) {
    for (const script of importantScripts) {
      if (projectInfo.scripts[script] && !readmeContent.includes(`npm run ${script}`) && !readmeContent.includes(script)) {
        issues.push({
          type: 'missing-script',
          severity: 'low',
          script,
          message: `Package.json has "${script}" script but it's not mentioned in README`
        });
      }
    }
  }
  
  if (projectInfo.dependencies) {
    const depCount = Object.keys(projectInfo.dependencies).length;
    const depMention = readmeContent.match(/(\d+)\s+dependencies/i);
    if (depMention && parseInt(depMention[1]) !== depCount) {
      issues.push({
        type: 'dependency-count',
        severity: 'low',
        current: depMention[1],
        expected: depCount,
        message: `README mentions ${depMention[1]} dependencies but package.json has ${depCount}`
      });
    }
  }
  return issues;
}

// Identify sections needing updates
export function identifySectionsToUpdate(readmeAnalysis, projectInfo) {
  if (!readmeAnalysis || !readmeAnalysis.exists) return [];
  const sectionsToUpdate = [];
  const sections = readmeAnalysis.sections.map(s => s.title.toLowerCase());
  
  if (sections.some(s => s.includes('install'))) {
    sectionsToUpdate.push({ name: 'Installation', reason: 'May need updates based on current dependencies', priority: 'medium' });
  }
  if (sections.some(s => s.includes('feature'))) {
    sectionsToUpdate.push({ name: 'Features', reason: 'Project code may have evolved with new features', priority: 'high' });
  }
  if (sections.some(s => s.includes('usage'))) {
    sectionsToUpdate.push({ name: 'Usage', reason: 'Commands or API may have changed', priority: 'high' });
  }
  return sectionsToUpdate;
}

// Merge README content intelligently
export function mergeReadmeContent(existingContent, newContent, options = {}) {
  const { preserveCustomSections = true, preserveHeader = false, sectionsToUpdate = [] } = options;
  const existingSections = extractSections(existingContent);
  const newSections = extractSections(newContent);
  const mergedSections = [];
  const processedSectionTitles = new Set();
  const existingHeader = getHeaderContent(existingContent);
  const newHeader = getHeaderContent(newContent);
  const finalHeader = preserveHeader && existingHeader ? existingHeader : newHeader;
  
  for (const newSection of newSections) {
    const normalizedTitle = normalizeTitle(newSection.title);
    const existingMatch = existingSections.find(s => normalizeTitle(s.title) === normalizedTitle);
    
    if (existingMatch && shouldPreserveSection(normalizedTitle, sectionsToUpdate)) {
      mergedSections.push({ title: existingMatch.rawTitle, content: existingMatch.content, source: 'existing' });
    } else {
      mergedSections.push({ title: newSection.rawTitle, content: newSection.content, source: 'new' });
    }
    processedSectionTitles.add(normalizedTitle);
  }
  
  if (preserveCustomSections) {
    for (const existingSection of existingSections) {
      const normalizedTitle = normalizeTitle(existingSection.title);
      if (!processedSectionTitles.has(normalizedTitle) && isCustomSection(normalizedTitle)) {
        mergedSections.push({ title: existingSection.rawTitle, content: existingSection.content, source: 'custom' });
      }
    }
  }
  
  let result = finalHeader;
  for (const section of mergedSections) {
    result += '\n' + section.title + '\n\n' + section.content + '\n';
  }
  return result.trim() + '\n';
}

// Extract header content
function getHeaderContent(content) {
  const lines = content.split('\n');
  const headerLines = [];
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) break;
    headerLines.push(line);
  }
  return headerLines.join('\n').trim() + '\n\n';
}

// Normalize title for comparison
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Check if section should be preserved
function shouldPreserveSection(normalizedTitle, sectionsToUpdate) {
  if (!sectionsToUpdate || sectionsToUpdate.length === 0) return false;
  return !sectionsToUpdate.some(sectionName => normalizeTitle(sectionName) === normalizedTitle);
}

// Check if section is custom
function isCustomSection(normalizedTitle) {
  const standardSections = [
    'installation', 'install', 'getting started', 'usage', 'features',
    'requirements', 'prerequisites', 'contributing', 'license', 'documentation',
    'examples', 'api', 'configuration', 'testing', 'deployment', 'support',
    'changelog', 'roadmap', 'acknowledgments', 'authors', 'faq', 'troubleshooting',
    'description', 'about', 'commands', 'options', 'how it works'
  ];
  return !standardSections.some(std => normalizedTitle.includes(std) || std.includes(normalizedTitle));
}

// Create diff summary
export function createDiffSummary(existingContent, newContent) {
  const existingSections = extractSections(existingContent);
  const newSections = extractSections(newContent);
  const summary = { added: [], removed: [], modified: [], unchanged: [] };
  const existingTitles = new Set(existingSections.map(s => normalizeTitle(s.title)));
  const newTitles = new Set(newSections.map(s => normalizeTitle(s.title)));
  
  for (const newSection of newSections) {
    const normalized = normalizeTitle(newSection.title);
    if (!existingTitles.has(normalized)) summary.added.push(newSection.title);
  }
  
  for (const existingSection of existingSections) {
    const normalized = normalizeTitle(existingSection.title);
    if (!newTitles.has(normalized)) summary.removed.push(existingSection.title);
  }
  
  for (const newSection of newSections) {
    const normalized = normalizeTitle(newSection.title);
    const existing = existingSections.find(s => normalizeTitle(s.title) === normalized);
    if (existing) {
      if (existing.content.trim() !== newSection.content.trim()) {
        summary.modified.push(newSection.title);
      } else {
        summary.unchanged.push(newSection.title);
      }
    }
  }
  return summary;
}

// Update specific sections
export function updateSpecificSections(existingContent, newContent, sectionsToUpdate) {
  return mergeReadmeContent(existingContent, newContent, {
    preserveCustomSections: true,
    preserveHeader: true,
    sectionsToUpdate
  });
}

// Update version numbers in README
export function updateVersionInReadme(content, newVersion) {
  return content
    .replace(/!\[npm version\]\(https:\/\/img\.shields\.io\/npm\/v\/[^)]+\)/g, 
             `![npm version](https://img.shields.io/npm/v/${newVersion})`)
    .replace(/version[:\s]+\d+\.\d+\.\d+/gi, `version ${newVersion}`)
    .replace(/\bv\d+\.\d+\.\d+\b/g, `v${newVersion}`);
}
