import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/*
 * Deliberately narrow. The type checker already covers most of what a broad
 * lint would; this exists for the one class of bug it cannot see — hooks
 * called conditionally or in the wrong order, which compiles cleanly and then
 * blanks the page at runtime.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
);
