import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const isProd = mode === 'production';

  return {
    // Root directory
    root: '.',
    
    // Public directory for static assets
    publicDir: 'content/assets',
    
    // Build configuration
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      
      // Source maps for debugging
      sourcemap: isDev ? 'inline' : false,
      
      // Minification
      minify: isProd ? 'terser' : false,
      terserOptions: isProd ? {
        compress: {
          drop_console: true, // Remove console.* in production
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug'],
        },
        format: {
          comments: false, // Remove comments
        },
      } : undefined,
      
      // Chunk size warnings
      chunkSizeWarningLimit: 500,
      
      // Rollup options
      rollupOptions: {
        input: {
          // Main pages
          main: resolve(__dirname, 'index.html'),
          about: resolve(__dirname, 'pages/about/index.html'),
          blog: resolve(__dirname, 'pages/blog/index.html'),
          gallery: resolve(__dirname, 'pages/gallery/index.html'),
          projekte: resolve(__dirname, 'pages/projekte/index.html'),
          videos: resolve(__dirname, 'pages/videos/index.html'),
          
          // Blog posts
          'blog-threejs': resolve(__dirname, 'pages/blog/threejs-performance/index.html'),
          'blog-visual': resolve(__dirname, 'pages/blog/visual-storytelling/index.html'),
          'blog-ui': resolve(__dirname, 'pages/blog/modern-ui-design/index.html'),
          'blog-react': resolve(__dirname, 'pages/blog/react-no-build/index.html'),
          
          // Video pages
          'video-1': resolve(__dirname, 'pages/videos/tImMPQKiQVk/index.html'),
          'video-2': resolve(__dirname, 'pages/videos/z8W9UJbUSo4/index.html'),
          'video-3': resolve(__dirname, 'pages/videos/clbOHUT4w5o/index.html'),
          'video-4': resolve(__dirname, 'pages/videos/UorHOTKWtK4/index.html'),
          'video-5': resolve(__dirname, 'pages/videos/1bL8bZd6cpY/index.html'),
          'video-6': resolve(__dirname, 'pages/videos/lpictttLoEk/index.html'),
          'video-7': resolve(__dirname, 'pages/videos/rXMLVt9vhxQ/index.html'),
        },
        
        output: {
          // Manual chunks for better caching (only for modules that exist)
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules')) {
              if (id.includes('three')) {
                return 'vendor-three';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('dompurify')) {
                return 'vendor-dompurify';
              }
              // Other node_modules go to vendor
              return 'vendor';
            }
            
            // Shared utilities
            if (id.includes('/content/utils/')) {
              return 'shared-utils';
            }
            
            // Components
            if (id.includes('/content/components/menu/')) {
              return 'components-menu';
            }
            if (id.includes('/content/components/search/')) {
              return 'components-search';
            }
            if (id.includes('/content/components/footer/')) {
              return 'components-footer';
            }
            if (id.includes('/content/components/particles/')) {
              return 'components-particles';
            }
          },
          
          // Asset file names
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            
            if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext)) {
              return `assets/img/[name]-[hash][extname]`;
            }
            if (/woff2?|ttf|otf|eot/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          
          // Chunk file names
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
      
      // CSS code splitting
      cssCodeSplit: true,
    },
    
    // Server configuration (dev)
    server: {
      port: 8080,
      host: true,
      open: true,
      cors: true,
      
      // Proxy for Cloudflare Workers (local development)
      proxy: {
        '/api': {
          target: 'https://www.abdulkerimsesli.de',
          changeOrigin: true,
          secure: true,
        },
      },
    },
    
    // Preview server (production build preview)
    preview: {
      port: 8080,
      host: true,
      open: true,
    },
    
    // Dependency optimization
    optimizeDeps: {
      include: [
        'dompurify',
      ],
      exclude: [
        // Exclude large dependencies that should be loaded on-demand
      ],
    },
    
    // Environment variables
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      '__DEV__': isDev,
      '__PROD__': isProd,
    },
    
    // Plugins
    plugins: [
      createHtmlPlugin({
        minify: isProd,
        inject: {
          data: {
            title: 'Abdulkerim Sesli - Web Developer & Photographer',
            buildTime: new Date().toISOString(),
          },
        },
      }),
    ],
    
    // CSS configuration
    css: {
      devSourcemap: isDev,
      preprocessorOptions: {
        // Add CSS preprocessor options here if needed
      },
    },
    
    // Resolve configuration
    resolve: {
      alias: {
        '@': resolve(__dirname, './content'),
        '@components': resolve(__dirname, './content/components'),
        '@utils': resolve(__dirname, './content/utils'),
        '@styles': resolve(__dirname, './content/styles'),
        '@pages': resolve(__dirname, './pages'),
      },
    },
    
    // Logging
    logLevel: isDev ? 'info' : 'warn',
  };
});
