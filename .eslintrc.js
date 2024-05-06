module.exports = {
  "extends": "airbnb-base",
  "plugins": [],
  "rules": {
    "func-names": "off",
    // doesn't work in node v4 :(
    "strict": "off",
    "prefer-rest-params": "off",
    "react/require-extension" : "off",
    "import/no-extraneous-dependencies" : "off",
    "prefer-promise-reject-errors": 1,
    "comma-dangle": "off",
    "no-unused-expressions": "off",
    "no-console": "off",
    "no-underscore-dangle": 1,
    "function-paren-newline": "off",
  },
  "env": {
    "mocha": true
  },
  "settings": {
    "import/resolver": "webpack"
  }
};
