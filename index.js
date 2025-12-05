#!/usr/bin/env node
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { analyzeProject } from './src/analyzer.js';
import { generateReadme, updateReadme } from './src/generator.js';
import { selectModel, chooseModel } from './src/models.js';
import { config, getApiKey, selectLanguage, handleConfig } from './src/config.js';
import { showHeader, showVersion, showHelp } from './src/utils.js';
import { analyzeExistingReadme, detectOutdatedInfo, identifySectionsToUpdate } from './src/readmeUpdater.js';

const args = process.argv.slice(2);

class ReadmeGenerator {
  constructor() {
    this.currentDir = process.cwd();
    this.spinner = ora();
  }

  async init() {
    try {
      showHeader();

      if (args.includes('-v') || args.includes('--version')) {
        showVersion();
        return;
      }

      if (args.includes('--update')) {
        const spinner = ora({
          text: chalk.gray('Checking for updates...'),
          spinner: 'dots'
        }).start();
        try {
          execSync('npm install -g @jayanithu/readmi@latest');
          spinner.succeed(chalk.green.bold('✓ Updated to latest version'));
          process.exit(0);
        } catch (error) {
          spinner.fail(chalk.red('✗ Update failed: ') + error.message);
          process.exit(1);
        }
      }

      if (args.includes('-h') || args.includes('--help')) {
        showHelp();
        return;
      }

      if (args[0] === 'config') {
        const result = await handleConfig(args, this.spinner);
        if (result === 'select-language') {
          await selectLanguage(this.spinner);
        } else if (result === 'select-model') {
          await chooseModel(this.spinner);
        }
        return;
      }
      
      if (args[0] === 'language' || args[0] === 'lang') {
        await selectLanguage(this.spinner);
        return;
      }

      // Check for update mode
      const isUpdateMode = args.includes('--update-readme') || args.includes('-u');

      this.spinner = ora({
        text: chalk.gray('Initializing...'),
        spinner: 'dots'
      }).start();
      const apiKey = await getApiKey(this.spinner);
      
      this.spinner.text = chalk.gray('Analyzing project...');
      const projectInfo = await analyzeProject(this.currentDir);
      
      if (projectInfo.name) {
        this.spinner.stopAndPersist({
          symbol: chalk.cyan('→'),
          text: chalk.white('Project: ') + chalk.cyan(projectInfo.name)
        });
        this.spinner.start();
      }

      // Handle update mode
      if (isUpdateMode) {
        await this.handleUpdateMode(apiKey, projectInfo);
        return;
      }
      
      let language = config.get('preferredLanguage') || 'en';
      if (args.includes('--select-language') || args.includes('-sl')) {
        language = await selectLanguage(this.spinner);
      }
      
      const model = await selectModel(apiKey, this.spinner);
      await generateReadme(apiKey, projectInfo, language, model, this.spinner);
    } catch (error) {
      this.handleError(error);
    }
  }

  handleError(error) {
    this.spinner.fail(chalk.red.bold('✗ ') + error.message);
    if (error.message.includes('API')) {
      console.log(
        '\n' +
        chalk.yellow('💡 Tip') + '\n' +
        chalk.gray('Run ') + chalk.cyan('readmi config') + chalk.gray(' to setup') + '\n'
      );
    }
    process.exit(1);
  }

  async handleUpdateMode(apiKey, projectInfo) {
    try {
      this.spinner.text = chalk.gray('Analyzing existing README...');
      
      const readmeAnalysis = await analyzeExistingReadme('README.md');
      
      if (!readmeAnalysis || !readmeAnalysis.exists) {
        this.spinner.stopAndPersist({
          symbol: chalk.yellow('⚠'),
          text: chalk.yellow('No existing README found')
        });
        console.log(
          '\n' +
          chalk.dim('  → ') + chalk.gray('Run ') + chalk.cyan('readmi') + chalk.gray(' to generate a new README\n')
        );
        process.exit(0);
      }

      this.spinner.succeed(chalk.green.bold('✓ README analyzed'));
      
      // Detect outdated information
      const issues = detectOutdatedInfo(readmeAnalysis, projectInfo);
      
      if (issues.length > 0) {
        console.log(
          '\n' +
          chalk.yellow.bold('Detected Issues') + '\n'
        );
        for (const issue of issues) {
          const icon = issue.severity === 'high' ? chalk.red('•') : issue.severity === 'medium' ? chalk.yellow('•') : chalk.green('•');
          console.log('  ' + icon + ' ' + chalk.gray(issue.message));
        }
        console.log();
      } else {
        console.log(
          '\n' +
          chalk.green.bold('✓ No issues detected') + '\n'
        );
      }
      
      // Get sections that could be updated
      const suggestedSections = identifySectionsToUpdate(readmeAnalysis, projectInfo);
      
      // Ask user what they want to update
      const { updateChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'updateChoice',
          message: 'What would you like to update?',
          choices: [
            { name: '🔄 Update entire README (preserve custom sections)', value: 'full' },
            { name: '📝 Select specific sections to update', value: 'selective' },
            { name: '🔢 Update version numbers only', value: 'version' },
            { name: '❌ Cancel', value: 'cancel' }
          ]
        }
      ]);

      if (updateChoice === 'cancel') {
        console.log(chalk.gray('\n  Update cancelled\n'));
        process.exit(0);
      }

      let sectionsToUpdate = [];
      
      if (updateChoice === 'selective') {
        const sectionChoices = readmeAnalysis.sections
          .filter(s => s.level <= 2)
          .map(s => ({ name: s.title, value: s.title }));
        
        const { selectedSections } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedSections',
            message: 'Select sections to update:',
            choices: sectionChoices,
            validate: (answer) => {
              if (answer.length === 0) {
                return 'Please select at least one section';
              }
              return true;
            }
          }
        ]);
        
        sectionsToUpdate = selectedSections;
      }

      const language = config.get('preferredLanguage') || 'en';
      const model = await selectModel(apiKey, this.spinner);
      
      await updateReadme(
        apiKey,
        projectInfo,
        language,
        model,
        this.spinner,
        readmeAnalysis,
        updateChoice,
        sectionsToUpdate
      );
      
    } catch (error) {
      this.handleError(error);
    }
  }
}

console.clear();
new ReadmeGenerator()
  .init()
  .catch(error => {
    console.error(
      '\n' +
      chalk.red('  Error: ') +
      chalk.red(error.message || error) +
      '\n'
    );
    process.exit(1);
  });
