import { defineConfig } from 'vite';
import { resolve } from 'path';

// Multi-page vanilla JS app. Every top-level .html file is a real route,
// so pages can be added in later batches without changing this file
// beyond adding one more entry.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname,import { defineConfig } from 'vite';
import { resolve } from 'path';

// Multi-page vanilla JS app. Every top-level .html file is a real route,
// so pages can be added in later batches without changing this file
// beyond adding one more entry.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        signin: resolve(__dirname, 'signin.html'),
        signup: resolve(__dirname, 'signup.html'),
        forgotPassword: resolve(__dirname, 'forgot-password.html'),
        resetPassword: resolve(__dirname, 'reset-password.html')
      }
    }
  }
}); 'index.html'),
        signin: resolve(__dirname, 'signin.html'),
        signup: resolve(__dirname, 'signup.html'),
        forgotPassword: resolve(__dirname, 'forgot-password.html')
      }
    }
  }
});
