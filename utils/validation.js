export const validateApiKey = (apiKey) => {
  if (!apiKey || apiKey.length < 10) {
    throw new Error('Invalid API key format');
  }
  return true;
};

export const validateProjectStructure = (projectInfo) => {
  if (!projectInfo || !projectInfo.type) {
    throw new Error('Invalid project structure');
  }
  return true;
}; 