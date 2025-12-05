import Conf from 'conf';
import inquirer from 'inquirer';
import chalk from 'chalk';
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
  console.log('\n' + chalk.bold.white('API Key Setup') + '\n');
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
  console.log('\n' + chalk.bold.white('Language Selection') + '\n');
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

export async function handleConfig(args, spinner) {
  if (args[1] === '--remove-key' || args[1] === '-r') {
    if (config.has('apiKey')) {
      config.delete('apiKey');
      console.log(chalk.green('\n✓ API key removed\n'));
    } else {
      console.log(chalk.dim('\nNo API key found\n'));
    }
    return;
  }
  if (args[1] === '--remove-model' || args[1] === '-rm') {
    if (config.has('preferredModel')) {
      config.delete('preferredModel');
      console.log(chalk.green('\n✓ Model removed\n'));
    } else {
      console.log(chalk.dim('\nNo model found\n'));
    }
    return;
  }
  if (args[1] === '--remove-language' || args[1] === '-rl') {
    if (config.has('preferredLanguage')) {
      config.delete('preferredLanguage');
      console.log(chalk.green('\n✓ Language removed\n'));
    } else {
      console.log(chalk.dim('\nNo language found\n'));
    }
    return;
  }
  if (args[1] === '--language' || args[1] === '-l') {
    return 'select-language';
  }
  if (args[1] === 'model' || args[1] === 'models') {
    return 'select-model';
  }
  
  const apiKeyStatus = config.has('apiKey') ? chalk.green('✓ saved') : chalk.dim('not set');
  const modelStatus = config.has('preferredModel') ? chalk.cyan(config.get('preferredModel')) : chalk.dim('not set');
  const langStatus = config.has('preferredLanguage') ? chalk.cyan(getLanguageName(config.get('preferredLanguage'))) : chalk.dim('not set');
  
  console.log(
    '\n' +
    chalk.bold.white('Configuration') + '\n\n' +
    chalk.gray('  API Key      ') + apiKeyStatus + '\n' +
    chalk.gray('  Model        ') + modelStatus + '\n' +
    chalk.gray('  Language     ') + langStatus + '\n\n' +
    chalk.bold.white('Commands') + '\n' +
    chalk.cyan('  config -r        ') + chalk.gray('Remove API key') + '\n' +
    chalk.cyan('  config -rm       ') + chalk.gray('Remove model') + '\n' +
    chalk.cyan('  config -rl       ') + chalk.gray('Remove language') + '\n' +
    chalk.cyan('  config -l        ') + chalk.gray('Set language') + '\n' +
    chalk.cyan('  config model     ') + chalk.gray('Select model') + '\n'
  );
}

