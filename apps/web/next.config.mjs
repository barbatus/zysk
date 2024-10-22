/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: ["app", "lib", "styles", "ui"],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: true, // Use `true` for permanent redirect (308 status), `false` for temporary (307 status)
      },
    ];
  },
  transpilePackages: ["@zysk/ts-rest", "@zysk/db"],
};

export default nextConfig;
