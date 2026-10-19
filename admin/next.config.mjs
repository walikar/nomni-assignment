// NEXT_PUBLIC_API_URL is inlined into the browser bundle at build time. On Vercel, refuse to
// build without it rather than ship a site that silently points at http://localhost:4000.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (process.env.VERCEL && !apiUrl) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set for this Vercel build. Add it under Settings → Environment Variables ' +
      `for the "${process.env.VERCEL_ENV}" environment (value: the Render API URL), then redeploy.`,
  );
}
console.log(`Admin will call the API at: ${apiUrl ?? 'http://localhost:4000 (default)'}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The admin's home page is the orders list.
  async redirects() {
    return [{ source: '/', destination: '/orders', permanent: false }];
  },
};

export default nextConfig;
