#!/usr/bin/env node
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { analyzeProject } from './src/analyzer.js';
import { generateReadme } from './src/generator.js';
import { selectModel, chooseModel } from './src/models.js';
import { config, getApiKey, selectLanguage, handleConfig } from './src/config.js';
import { showHeader, showVersion, showHelp } from './src/utils.js';

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
        const spinner = ora(chalk.gray('  Checking for updates...')).start();
        try {
          execSync('npm install -g @jayanithu/readmi@latest');
          spinner.succeed(chalk.green('  Updated to latest version'));
          process.exit(0);
        } catch (error) {
          spinner.fail(chalk.red('  Update failed: ') + error.message);
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

      this.spinner.start(chalk.gray('  Initializing...'));
      const apiKey = await getApiKey(this.spinner);
      
      this.spinner.text = chalk.gray('  Analyzing project...');
      const projectInfo = await analyzeProject(this.currentDir);
      
      if (projectInfo.name) {
        this.spinner.info(chalk.gray(`  Project: ${projectInfo.name}`));
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
    this.spinner.fail(chalk.red('  Error: ') + error.message);
    if (error.message.includes('API')) {
      console.log(chalk.gray('\n  Tip: Run ') + chalk.cyan('readmi config') + chalk.gray(' to manage your API key\n'));
    }
    process.exit(1);
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
