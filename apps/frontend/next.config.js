

const { composePlugins, withNx } = require('@nx/next');

const nextConfig = {

  nx: {},
};

const plugins = [
  
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
