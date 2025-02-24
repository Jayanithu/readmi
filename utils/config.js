import Conf from 'conf';

export const config = new Conf({
  projectName: 'readmi',
  defaults: {
    apiKey: null,
    defaultLicense: 'MIT',
    customPrompts: {},
    outputFormat: 'markdown'
  }
}); 