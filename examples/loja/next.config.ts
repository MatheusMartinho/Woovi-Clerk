import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A biblioteca é consumida direto do código-fonte TypeScript do workspace
  // (sem etapa de build de distribuição — decisão R2 do research).
  transpilePackages: ['pixcheckout'],
};

export default nextConfig;
