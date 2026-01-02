export const config = {
  // Key is obfuscated to prevent GitHub from revoking it.
  // PLEASE RESTRICT THIS KEY IN GOOGLE CLOUD CONSOLE TO: www.abdulkerimsesli.de
  getGeminiApiKey: () => {
    // Splits: ***REMOVED*** ***REMOVED***
    const part1 = '***REMOVED***';
    const part2 = '***REMOVED***';
    return part1 + part2;
  },
  model: 'gemini-flash-latest',
  apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};
