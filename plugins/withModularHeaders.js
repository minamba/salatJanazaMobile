const { withPodfile } = require('@expo/config-plugins');

module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    const content = config.modResults.contents;

    if (content.includes("pod 'GoogleUtilities', :modular_headers => true")) {
      return config;
    }

    config.modResults.contents = content.replace(
      /(use_expo_modules!)/,
      "$1\n  pod 'GoogleUtilities', :modular_headers => true\n  pod 'RecaptchaInterop', :modular_headers => true"
    );

    return config;
  });
};
