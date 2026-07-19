import next from "eslint-config-next";

/** Next 16 постачає готовий flat-config. */
const eslintConfig = [
  ...next,
  {
    rules: {
      // Нові дорадчі правила React Compiler (Next 16). Лишаємо як попередження:
      // - свідоме завантаження даних у useEffect із setState;
      // - навмисно вузький масив залежностей автозбереження (лише [form]).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "public/sw.js"],
  },
];

export default eslintConfig;
