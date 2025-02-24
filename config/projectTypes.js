export const PROJECT_TYPES = {
  nodejs: {
    files: ['package.json'],
    parser: 'parseNodeProject'
  },
  python: {
    files: ['requirements.txt', 'setup.py'],
    parser: 'parsePythonProject'
  },
  java: {
    files: ['pom.xml', 'build.gradle'],
    parser: 'parseJavaProject'
  },
  rust: {
    files: ['Cargo.toml'],
    parser: 'parseRustProject'
  },
  go: {
    files: ['go.mod'],
    parser: 'parseGoProject'
  }
};

export const FILE_EXTENSIONS = {
  javascript: ['.js', '.jsx', '.ts', '.tsx'],
  python: ['.py'],
  java: ['.java'],
  rust: ['.rs'],
  go: ['.go'],
  ruby: ['.rb'],
  php: ['.php'],
  csharp: ['.cs'],
  cpp: ['.cpp', '.hpp', '.c', '.h']
}; 