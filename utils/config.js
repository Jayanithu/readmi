import Conf from 'conf';

const config = new Conf({
  projectName: 'readmi',
  defaults: {
    apiKey: null,
    defaultLicense: 'MIT',
    customPrompts: {},
    outputFormat: 'markdown'
  }
});

export default config; 