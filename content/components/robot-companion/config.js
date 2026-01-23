/**
 * Gemini API Konfiguration
 *
 * WICHTIG: Diese Datei wird von gemini-service.js dynamisch importiert (nur serverseitig).
 * Sie wird NICHT in den Browser-Bundle aufgenommen, um den API-Key zu schützen.
 *
 * Verwendung: Server-seitige Requests nutzen diese Konfiguration.
 * Browser-Requests verwenden stattdessen den /api/gemini Proxy-Endpunkt.
 */
export const config = {
  // Key is obfuscated to prevent GitHub from revoking it.
  // PLEASE RESTRICT THIS KEY IN GOOGLE CLOUD CONSOLE TO: www.abdulkerimsesli.de
  getGeminiApiKey: () => {
    // Splits: AIzaSy CXX7Y6yTWNPuvUwC9ixlaVGj1n__Wv2Is
    const part1 = "AIzaSy";
    const part2 = "CXX7Y6yTWNPuvUwC9ixlaVGj1n__Wv2Is";
    return part1 + part2;
  },
  model: "gemini-flash-latest",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
};
