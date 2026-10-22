
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  // Next.js 16 defaults to Turbopack, which ignores the `webpack()` hook below
  // (kept only as a fallback for `next build --webpack`). An empty config here
  // silences Next's "Turbopack + webpack config" warning.
  turbopack: {},
  experimental: {
    // Lets `next dev`/`next build` automatically apply future security-only
    // patch upgrades the same way this one was applied.
    agentUpgrade: 'security',
    serverActions: {
      // Several flows upload images as base64 data URIs through a server action
      // in one request (e.g. up to 4 customer body photos, or a staff photo +
      // resume together) -- the 1MB default was rejecting these outright with
      // "Body exceeded 1 MB limit.", surfaced to users as a generic error.
      bodySizeLimit: '20mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'dietclinik.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Fix for Node.js modules in client-side code
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        child_process: false,
        http2: false,
        events: false,
        stream: false,
        util: false,
        http: false,
        https: false,
        crypto: false,
        os: false,
        path: false,
        zlib: false,
      };

      // Handle node: protocol imports
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: any) => {
          const mod = resource.request.replace(/^node:/, '');
          resource.request = mod;
        })
      );
    }

    return config;
  },
};

export default nextConfig;
