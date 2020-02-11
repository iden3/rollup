// Eslint configuration file.
// Configuration documentation: http://eslint.org/docs/user-guide/configuring.html
// Rules documentation: http://eslint.org/docs/rules/
//
// Codes:
// 0 - turn the rule off
// 1 - turn the rule on as a warning (doesn't affect exit code)
// 2 - turn the rule on as an error (exit code is 1 when triggered)

const path = require('path');

module.exports = {
  "extends": "airbnb",
  "env": {
    "es6": true,
    "browser": true,
    "node": true,
    "jest": true
  },
  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
  },
  "parser": "babel-eslint", // to use global variables as document along the app
  "rules": {
    "arrow-body-style": [0],
    "class-methods-use-this": [0],
    "no-unused-vars": [2, { "varsIgnorePattern": "export^" }],
    "no-unused-expressions": [0],
    "func-names": [0],
    "global-require": [0],
    "max-len": ["error", { "code": 120, "comments": 800 }],
    "no-underscore-dangle": [0],
    "import/no-extraneous-dependencies": [
      "error",
      {"devDependencies": true, "optionalDependencies": false, "peerDependencies": false}
    ],
    "no-param-reassign": [2, { "props": false }],
    "no-prototype-builtins": [0],
    "no-plusplus": [0],
    "no-restricted-syntax": [0],
    "no-return-assign": [0],
    "no-console": [2, { "allow": ["warn", "error"] }],
    "no-bitwise": [0],
    "quote-props": [0],
    "no-mixed-operators": [0],
    "no-use-before-define": ["error", { "functions": false, "classes": false }],
    "consistent-return": [0],
    "no-async-promise-executor": [0],
    "new-cap": [0],
    "import/no-extraneous-dependencies": [0],
    "import/prefer-default-export": [0],
    "react/no-did-update-set-state": [0],
    "react/prefer-stateless-function": [0],
    "react/jsx-filename-extension": [1, { "extensions": [".js", ".jsx"] }],
    "react/require-default-props": [0],
    "react/destructuring-assignment": [0],
    "react/jsx-closing-bracket-location": [1, 'after-props'],
    "react/forbid-prop-types": [0],
    "react/no-array-index-key": [0],
    "react/no-access-state-in-setstate": [0],
    "react/static-property-placement": [0],
  }
};