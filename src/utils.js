import chalk from 'chalk';

export function showHeader() {
  console.log(
    '\n' +
    chalk.bold.cyan('  ReadMI') + chalk.gray(' v2.4.7') + '\n' +
    chalk.gray('  AI-powered README generator') + '\n' +
    chalk.gray('  Run ') + chalk.cyan('readmi -h') + chalk.gray(' for help\n')
  );
}

export function showVersion() {
  console.log(
    '\n' +
    chalk.bold.cyan('ReadMI') + ' v2.4.7\n' +
    chalk.gray('Modern README generator powered by AI\n')
  );
  process.exit(0);
}

export function showHelp() {
  console.log(
    '\n' +
    chalk.bold('  Commands\n') +
    '\n' +
    chalk.cyan('  readmi') + chalk.gray('                    Generate README\n') +
    chalk.cyan('  readmi -u') + chalk.gray('                 Update existing README\n') +
    chalk.cyan('  readmi config') + chalk.gray('             Manage configuration\n') +
    '\n' +
    chalk.bold('  Options\n') +
    '\n' +
    chalk.gray('  -v, --version') + chalk.gray('            Show version\n') +
    chalk.gray('  -h, --help') + chalk.gray('               Show help\n') +
    chalk.gray('  --update') + chalk.gray('                 Update to latest\n') +
    chalk.gray('  -u, --update-readme') + chalk.gray('     Smart README update\n') +
    chalk.gray('  -sl, --select-language') + chalk.gray('  Select language\n') +
    '\n' +
    chalk.bold('  Configuration\n') +
    '\n' +
    chalk.gray('  config -r') + chalk.gray('                Remove API key\n') +
    chalk.gray('  config -rm') + chalk.gray('               Remove model\n') +
    chalk.gray('  config -rl') + chalk.gray('               Remove language\n') +
    chalk.gray('  config -l') + chalk.gray('                Set language\n') +
    chalk.gray('  config model') + chalk.gray('             Select model\n') +
    '\n' +
    chalk.gray('  https://github.com/jayanithu/readmi\n')
  );
  process.exit(0);
}

export function getLanguageMap() {
  return {
    'en': 'English',
    'es': 'Spanish (Español)',
    'fr': 'French (Français)',
    'de': 'German (Deutsch)',
    'zh': 'Chinese (中文)',
    'ja': 'Japanese (日本語)',
    'pt': 'Portuguese (Português)',
    'ru': 'Russian (Русский)',
    'hi': 'Hindi (हिन्दी)',
    'ar': 'Arabic (العربية)'
  };
}

export function getLanguageName(code) {
  return getLanguageMap()[code] || code;
}

export function determineProjectType(projectInfo) {
  const projectType = [];
  
  if (projectInfo.bin || Object.keys(projectInfo.bin || {}).length > 0) {
    projectType.push('- This is a command-line interface (CLI) tool');
  } else if (projectInfo.main) {
    projectType.push('- This is a library/package meant to be imported by other projects');
  }
  
  if (projectInfo.dependencies) {
    if (projectInfo.dependencies.react) {
      projectType.push('- This is a React application/component');
    } else if (projectInfo.dependencies.vue) {
      projectType.push('- This is a Vue.js application/component');
    } else if (projectInfo.dependencies.express || projectInfo.dependencies['@nestjs/core']) {
      projectType.push('- This is a Node.js backend/API service');
    } else if (projectInfo.dependencies.electron) {
      projectType.push('- This is an Electron desktop application');
    } else if (projectInfo.dependencies['react-native']) {
      projectType.push('- This is a React Native mobile application');
    }
  }
  
  if (projectInfo.devDependencies) {
    const testingTools = [];
    if (projectInfo.devDependencies.jest) testingTools.push('Jest');
    if (projectInfo.devDependencies.mocha) testingTools.push('Mocha');
    if (projectInfo.devDependencies.cypress) testingTools.push('Cypress');
    if (projectInfo.devDependencies.playwright) testingTools.push('Playwright');
    
    if (testingTools.length > 0) {
      projectType.push(`- Testing is done with: ${testingTools.join(', ')}`);
    }
  }
  
  if (projectInfo.hasDocker) {
    projectType.push('- This project has Docker support');
  }
  
  if (projectInfo.hasGithubActions) {
    projectType.push('- This project uses GitHub Actions for CI/CD');
  }
  
  const fileExtensions = projectInfo.files.map(file => {
    const ext = file.split('.').pop();
    return ext;
  });
  
  if (fileExtensions.includes('py')) {
    projectType.push('- This project uses Python');
  } else if (fileExtensions.includes('go')) {
    projectType.push('- This project uses Go');
  } else if (fileExtensions.includes('rs')) {
    projectType.push('- This project uses Rust');
  } else if (fileExtensions.includes('java') || fileExtensions.includes('kt')) {
    projectType.push('- This project uses Java/Kotlin');
  } else if (fileExtensions.includes('rb')) {
    projectType.push('- This project uses Ruby');
  } else if (fileExtensions.includes('php')) {
    projectType.push('- This project uses PHP');
  } else if (fileExtensions.includes('ts') || fileExtensions.includes('tsx')) {
    projectType.push('- This project uses TypeScript');
  } else if (fileExtensions.includes('js') || fileExtensions.includes('jsx')) {
    projectType.push('- This project uses JavaScript');
  }
  
  if (projectType.length === 0) {
    projectType.push('- Project type could not be automatically determined');
    projectType.push('- Generating a generic README structure');
  }
  
  return projectType;
}

export function generateBadges(projectInfo) {
  const badges = [];
  
  if (projectInfo.name && !projectInfo.name.startsWith('@')) {
    badges.push(`[![npm version](https://img.shields.io/npm/v/${projectInfo.name})](https://www.npmjs.com/package/${projectInfo.name})`);
  }
  
  if (projectInfo.license) {
    badges.push(`[![License: ${projectInfo.license}](https://img.shields.io/badge/License-${projectInfo.license}-blue.svg)](LICENSE)`);
  }
  
  if (projectInfo.repository) {
    const repoUrl = typeof projectInfo.repository === 'string' ? projectInfo.repository : projectInfo.repository.url;
    if (repoUrl && repoUrl.includes('github.com')) {
      const repoPath = repoUrl.replace('https://github.com/', '').replace('.git', '');
      badges.push(`[![GitHub stars](https://img.shields.io/github/stars/${repoPath})](https://github.com/${repoPath})`);
    }
  }
  
  if (projectInfo.engines?.node) {
    badges.push(`[![Node](https://img.shields.io/badge/node-%3E%3D${projectInfo.engines.node}-green.svg)]`);
  }
  
  return badges.length > 0 ? badges.join(' ') : 'No badges suggested';
}


export function postProcessReadme(content) {
  let processed = content.trim();
  
  processed = processed.replace(/```markdown/g, '```');
  
  while (processed.trim().startsWith('```')) {
    processed = processed.replace(/^```[a-z]*\s*\n?/i, '');
  }
  
  while (processed.trim().endsWith('```')) {
    processed = processed.replace(/\n?```[a-z]*\s*$/i, '');
  }
  
  processed = processed.trim();
  
  const lines = processed.split('\n');
  if (lines[0] && lines[0].trim().match(/^```/)) {
    lines.shift();
  }
  if (lines[lines.length - 1] && lines[lines.length - 1].trim().match(/^```/)) {
    lines.pop();
  }
  processed = lines.join('\n').trim();
  
  if (processed.startsWith('```')) {
    processed = processed.replace(/^```[a-z]*\s*\n?/i, '');
  }
  if (processed.endsWith('```')) {
    processed = processed.replace(/\n?```[a-z]*\s*$/i, '');
  }
  
  processed = processed.trim();
  
  processed = processed.replace(/##\s*Table\s+of\s+Contents.*?(?=\n##|\n#|$)/gis, '');
  processed = processed.replace(/##\s*Contents.*?(?=\n##|\n#|$)/gis, '');
  processed = processed.replace(/##\s*📑\s*Table\s+of\s+Contents.*?(?=\n##|\n#|$)/gis, '');
  
  processed = processed
    .replace(/\n(#+)\s/g, '\n\n$1 ')
    .replace(/\n-\s/g, '\n• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  processed = processed.replace(codeBlockRegex, (match, lang, code) => {
    if (!lang || lang.trim() === '') {
      const trimmedCode = code.trim();
      const firstLine = trimmedCode.split('\n')[0].trim();
      
      if (firstLine.match(/^(npm|yarn|pnpm|pip|pip3|git|curl|wget|brew|apt|apt-get|sudo|chmod|chown|mkdir|cd|export|echo|node|npx)\s/i) || 
          firstLine.includes('install') || 
          firstLine.includes('run ') ||
          firstLine.startsWith('$ ') ||
          firstLine.match(/^[a-zA-Z0-9_-]+\s+[a-zA-Z]/)) {
        return `\`\`\`bash\n${code}\`\`\``;
      }
      if (trimmedCode.startsWith('{') || trimmedCode.startsWith('[')) {
        return `\`\`\`json\n${code}\`\`\``;
      }
      if (trimmedCode.includes('function') || trimmedCode.includes('const ') || trimmedCode.includes('let ') || trimmedCode.includes('var ') || (trimmedCode.includes('import ') && !trimmedCode.includes('from'))) {
        return `\`\`\`javascript\n${code}\`\`\``;
      }
      if (trimmedCode.includes('def ') || (trimmedCode.includes('import ') && trimmedCode.includes('from'))) {
        return `\`\`\`python\n${code}\`\`\``;
      }
      return `\`\`\`\n${code}\`\`\``;
    }
    return match;
  });
  
  processed = processed
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (processed.startsWith('```')) {
    processed = processed.replace(/^```[a-z]*\s*\n?/i, '');
  }
  if (processed.endsWith('```')) {
    processed = processed.replace(/\n?```[a-z]*\s*$/i, '');
  }
  
  processed = processed.trim();

  processed += '\n\n---\n\n**Made with ❤️ using [ReadMI](https://github.com/jayanithu/readmi) by jayanithu**\n';
  
  return processed;
}

