#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import Conf from 'conf';
import ora from 'ora';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const args = process.argv.slice(2);

const config = new Conf({
  projectName: 'readmi',
  defaults: { apiKey: null }
});

async function analyzeProject(dir) {
  const info = {
    name: '',
    description: '',
    version: '',
    dependencies: {},
    devDependencies: {},
    scripts: {},
    files: [],
    hasTests: false,
    hasDocker: false,
    hasGithubActions: false
  };

  try {
    const packageJson = JSON.parse(await fs.readFile(join(dir, 'package.json'), 'utf8'));
    Object.assign(info, packageJson);

    const files = await fs.readdir(dir);
    info.files = files;
    info.hasTests = files.some(f => f.includes('test') || f.includes('spec'));
    info.hasDocker = files.includes('Dockerfile') || files.includes('docker-compose.yml');
    info.hasGithubActions = files.includes('.github');

    return info;
  } catch (error) {
    return info;
  }
}

class ReadmeGenerator {
  constructor() {
    this.currentDir = process.cwd();
    this.spinner = ora();
  }

  async init() {
    try {
      this.showHeader();
      
      if (args.includes('-v') || args.includes('--version')) {
        this.showVersion();
        return;
      }

      if (args.includes('--update')) {
        const spinner = ora('Checking for updates...').start();
        try {
          execSync('npm install -g @jayanithu/readmi@latest');
          spinner.succeed(chalk.green('Successfully updated to the latest version!'));
          process.exit(0);
        } catch (error) {
          spinner.fail(chalk.red('Update failed: ') + error.message);
          process.exit(1);
        }
      }

      if (args.includes('-h') || args.includes('--help')) {
        this.showHelp();
        return;
      }

      this.spinner.start(chalk.blue('Initializing ReadMI...'));
      const apiKey = await this.getApiKey();
      const projectInfo = await analyzeProject(this.currentDir);
      await this.generateReadme(apiKey, projectInfo);
    } catch (error) {
      this.handleError(error);
    }
  }

  showHeader() {
    console.log('\n' + boxen(
      gradient.pastel.multiline([
        '╭─────────────────────────────╮',
        '│                             │',
        '│   ReadMI - README Builder   │',
        '│         v2.0.2              │',
        '│                             │',
        '╰─────────────────────────────╯'
      ].join('\n')),
      { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
    ));
  }

  showVersion() {
    console.log(chalk.cyan('ReadMI v2.0.0'));
    process.exit(0);
  }

  showHelp() {
    console.log('\n' + boxen(
      gradient.pastel.multiline([
        '📘 ReadMI Commands:',
        '',
        '  readmi          Generate README',
        '  readmi -v       Display version',
        '  readmi --update Update to latest version',
        '  readmi -h       Display help',
        '',
        '✨ Visit: https://github.com/yourusername/readmi'
      ].join('\n')),
      { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'blue' }
    ));
    process.exit(0);
  }

  async getApiKey() {
    const savedApiKey = config.get('apiKey');
    if (savedApiKey) return savedApiKey;

    this.spinner.stop();
    const { apiKey, saveKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: chalk.cyan('Enter your Google AI API Key:'),
        mask: '*'
      },
      {
        type: 'confirm',
        name: 'saveKey',
        message: chalk.cyan('Save this API key for future use?'),
        default: true
      }
    ]);

    if (saveKey) {
      config.set('apiKey', apiKey);
      this.spinner.succeed(chalk.green('API key saved'));
    }

    return apiKey;
  }

  async generateReadme(apiKey, projectInfo) {
    this.spinner.start(chalk.blue('Analyzing project...'));
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `Create a modern README.md for ${projectInfo.name}:

Project Details:
${JSON.stringify(projectInfo, null, 2)}

Generate a README with these sections and emojis:

1. 🚀 Project Title
   - Clear project name with badges
   - One-line catchy description
   - Status badges

2. ✨ Features
   - 🎯 Core feature one
   - 🔥 Core feature two
   - ⚡ Core feature three
   - 💪 Core feature four

3. 📦 Installation
   \`\`\`bash
   npm install ${projectInfo.name}
   \`\`\`

4. 🎮 Quick Start
   - 🔑 API key setup (if needed)
   - 📝 Basic configuration
   - 🎯 First command

5. 💻 Usage Examples
   - 🌟 Basic usage
   - 🔥 Advanced features
   - 💡 Tips and tricks

6. ⚙️ Configuration
   - 🛠️ Available options
   - 🎨 Customization
   - 🔧 Advanced settings

${projectInfo.hasTests ? `7. 🧪 Testing
   - 🎯 Running tests
   - 📊 Coverage info
   - 🐛 Debug tips\n` : ''}

${projectInfo.hasDocker ? `8. 🐳 Docker Support
   - 🏗️ Build instructions
   - 🚀 Run commands
   - 🔧 Configuration\n` : ''}

9. 📝 License & Contributing
   - 📄 License info
   - 🤝 How to contribute
   - 👥 Contributors

Style Requirements:
- Use emojis for all sections and key points
- Keep content concise but informative
- Add code blocks with language tags
- Make it visually appealing
- Use tables for structured data

Important:
- Focus on developer experience
- Include working examples
- Keep it modern and clean
- Add relevant badges
- Make it easy to navigate`;

      const result = await model.generateContent(prompt);
      const readmeContent = result.response.text();
      
      // Post-process to ensure emojis are preserved
      const processedContent = this.postProcessReadme(readmeContent, projectInfo);
      
      await fs.writeFile('README.md', processedContent);
      this.spinner.succeed(chalk.green('✨ README.md generated successfully!'));
    } catch (error) {
      throw new Error(`README generation failed: ${error.message}`);
    }
  }

  postProcessReadme(content, projectInfo) {
    // Add badges with emojis
    const badges = [
      `![Version](https://img.shields.io/badge/version-${projectInfo.version}-blue)`,
      '![License](https://img.shields.io/badge/license-MIT-green)',
      projectInfo.hasTests && '![Tests](https://img.shields.io/badge/tests-passing-brightgreen)',
      projectInfo.hasDocker && '![Docker](https://img.shields.io/badge/docker-ready-blue)',
      '![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)'
    ].filter(Boolean);

    // Add badges and enhance formatting
    let enhancedContent = `${badges.join(' ')}\n\n${content}`;

    // Ensure emojis are preserved and formatting is clean
    enhancedContent = enhancedContent
      .replace(/\n(#+\s)/g, '\n\n$1')
      .replace(/\n##\s/g, '\n\n---\n\n## ')
      .replace(/```(\w+)\n/g, '```$1\n')
      .replace(/\n-\s/g, '\n- ')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n';

    return enhancedContent;
  }

  handleError(error) {
    this.spinner.fail(chalk.red('Error: ') + error.message);
    process.exit(1);
  }
}

console.clear();
new ReadmeGenerator().init().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
