import Conf from 'conf';
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { getLanguageName } from './utils.js';

export const config = new Conf({
  projectName: 'readmi',
  defaults: { 
    apiKey: null,
    preferredModel: null,
    preferredLanguage: 'en'
  }
});

export async function getApiKey(spinner) {
  const savedApiKey = config.get('apiKey');
  if (savedApiKey) return savedApiKey;

  spinner.stop();
  console.log(chalk.gray('\n  API Key Setup\n'));
  const { apiKey, saveKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: chalk.cyan('  Enter Google AI API Key:'),
      mask: '●',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return chalk.red('  API key cannot be empty');
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'saveKey',
      message: chalk.gray('  Save for future use?'),
      default: true
    }
  ]);

  if (saveKey) {
    config.set('apiKey', apiKey);
    spinner.succeed(chalk.green('  API key saved'));
  }
  return apiKey;
}

export async function selectLanguage(spinner) {
  const savedLanguage = config.get('preferredLanguage');
  
  const languages = [
    { name: '🇺🇸 English', value: 'en' },
    { name: '🇪🇸 Spanish (Español)', value: 'es' },
    { name: '🇫🇷 French (Français)', value: 'fr' },
    { name: '🇩🇪 German (Deutsch)', value: 'de' },
    { name: '🇨🇳 Chinese (中文)', value: 'zh' },
    { name: '🇯🇵 Japanese (日本語)', value: 'ja' },
    { name: '🇵🇹 Portuguese (Português)', value: 'pt' },
    { name: '🇷🇺 Russian (Русский)', value: 'ru' },
    { name: '🇮🇳 Hindi (हिन्दी)', value: 'hi' },
    { name: '🇸🇦 Arabic (العربية)', value: 'ar' }
  ];
  
  spinner.stop();
  console.log(chalk.gray('\n  Language Selection\n'));
  const { language } = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: chalk.cyan('  Select language:'),
      choices: languages.map(l => ({ name: l.name.replace(/^🇺🇸 |^🇪🇸 |^🇫🇷 |^🇩🇪 |^🇨🇳 |^🇯🇵 |^🇵🇹 |^🇷🇺 |^🇮🇳 |^🇸🇦 /, ''), value: l.value })),
      default: languages.findIndex(lang => lang.value === savedLanguage) || 0,
      pageSize: 10
    }
  ]);
  
  const { saveLanguage } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveLanguage',
      message: chalk.gray('  Save as preferred?'),
      default: true
    }
  ]);
  
  if (saveLanguage) {
    config.set('preferredLanguage', language);
    spinner.succeed(chalk.green(`  Language saved: ${getLanguageName(language)}`));
  }
  
  return language;
}

export function handleConfig(args) {
  if (args[1] === '--remove-key' || args[1] === '-r') {
    if (config.has('apiKey')) {
      config.delete('apiKey');
      console.log(chalk.green('\n  API key removed\n'));
    } else {
      console.log(chalk.gray('\n  No API key found\n'));
    }
    return;
  }
  if (args[1] === '--remove-model' || args[1] === '-rm') {
    if (config.has('preferredModel')) {
      config.delete('preferredModel');
      console.log(chalk.green('\n  Model removed\n'));
    } else {
      console.log(chalk.gray('\n  No model found\n'));
    }
    return;
  }
  if (args[1] === '--remove-language' || args[1] === '-rl') {
    if (config.has('preferredLanguage')) {
      config.delete('preferredLanguage');
      console.log(chalk.green('\n  Language removed\n'));
    } else {
      console.log(chalk.gray('\n  No language found\n'));
    }
    return;
  }
  if (args[1] === '--language' || args[1] === '-l') {
    return 'select-language';
  }
  
  const apiKeyStatus = config.has('apiKey') ? chalk.green('saved') : chalk.gray('not set');
  const modelStatus = config.has('preferredModel') ? chalk.cyan(config.get('preferredModel')) : chalk.gray('not set');
  const langStatus = config.has('preferredLanguage') ? chalk.cyan(getLanguageName(config.get('preferredLanguage'))) : chalk.gray('not set');
  
  console.log(
    '\n' +
    chalk.bold('  Configuration\n') +
    '\n' +
    chalk.bold('  Commands\n') +
    '\n' +
    chalk.gray('  config -r') + chalk.gray('                Remove API key\n') +
    chalk.gray('  config -rm') + chalk.gray('               Remove model\n') +
    chalk.gray('  config -rl') + chalk.gray('               Remove language\n') +
    chalk.gray('  config -l') + chalk.gray('                Set language\n') +
    '\n' +
    chalk.bold('  Current\n') +
    '\n' +
    `  API Key:     ${apiKeyStatus}\n` +
    `  Model:       ${modelStatus}\n` +
    `  Language:    ${langStatus}\n`
  );
}

