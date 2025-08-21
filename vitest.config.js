import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testumgebung auf jsdom setzen (für Browser-ähnliche DOM-Tests)
    environment: 'jsdom',
    
    // Setup-Datei für globale Test-Konfigurationen
    setupFiles: './tests/setup.js',
    
    // Code-Coverage Konfiguration
    coverage: {
      // Reporter-Typen für Coverage-Berichte
      reporter: ['text', 'lcov', 'html', 'clover'],
      // Welche Dateien sollen in die Coverage einbezogen werden
      include: ['**/*.{js,ts}'],
      // Welche Dateien sollen ausgeschlossen werden
      exclude: [
        '**/*.min.js',
        'dist/**',
        'tests/**',
        'node_modules/**',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
      ],
      // Mindest-Coverage-Schwellenwerte
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      // Coverage-Bericht in separatem Verzeichnis speichern
      reportsDirectory: './coverage',
    },
    
    // Globale Timeout-Einstellung für Tests (in Millisekunden)
    testTimeout: 5000,
    
    // Parallelität der Testausführung
    maxConcurrency: 5,
    
    // Globale Variablen für Tests
    globals: true,
    
    // Mock-Verhalten
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Dateiendungen für Test-Dateien
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    
    // Watch-Modus Einstellungen
    watch: {
      // Ignorierte Verzeichnisse im Watch-Modus
      ignore: ['node_modules', 'dist', 'coverage'],
    },
    
    // Browser-ähnliche APIs für jsdom
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        runScripts: 'dangerously',
      },
    },
    
    // Reporter für Testausgabe
    reporters: ['default', 'html'],
    
    // Ausgabeverzeichnis für HTML-Reports
    outputFile: {
      html: './test-reports/html-report.html',
    },
  },
});