import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run in Node environment (not browser)
    environment: 'node',
    
    // Enable globals (describe, it, expect) without imports
    globals: true,
    
    // Test file patterns
    include: [
      'tests/**/*.test.ts',
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'mobile/**',
    ],
    
    // Global setup file to initialize PGlite once
    globalSetup: ['./tests/global-setup.ts'],
    
    // Setup environment variables before each test suite
    env: {
      NODE_ENV: 'test',
      DATABASE_PROVIDER: 'pglite',
      JWT_SECRET: 'test-jwt-secret-for-testing-purposes-only-not-production',
    },
    
    // Longer timeout for PGlite schema initialization
    testTimeout: 60000,
    hookTimeout: 60000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/server/**/*.ts'],
      exclude: [
        'src/server/db/schema.sql',
        'src/server/db/seed.ts',
        'node_modules/**',
      ],
    },
    
    // Use threads pool but limit to 1 fork to avoid PGlite conflicts
    pool: 'forks',
    
    // Run test files sequentially to avoid PGlite data directory conflicts
    fileParallelism: false,
    
    // Report failures clearly
    reporters: ['verbose'],
  },
});
