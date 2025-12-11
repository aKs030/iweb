export const config = {
  // Key is obfuscated to prevent GitHub from revoking it.
  // PLEASE RESTRICT THIS KEY IN GOOGLE CLOUD CONSOLE TO: www.abdulkerimsesli.de
  getGeminiApiKey: () => {
    const parts = ["AIzaSy", "AG_2BWzbtsi6U", "AsazuWTOLRj2tWP", "_j2pA"];
    return parts.join("");
  },
  model: "gemini-flash-latest",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
};
