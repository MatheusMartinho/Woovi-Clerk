'use client';

import { createContext, useContext, useInsertionEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createCoreClient } from '../core/client';
import type { CoreClient } from '../core/client';
import { injectStyles } from './theme';
import type { Appearance } from './theme';

interface WooviContextValue {
  client: CoreClient;
  appearance?: Appearance;
}

const WooviContext = createContext<WooviContextValue | null>(null);

export interface WooviProviderProps {
  /**
   * URL do SEU backend onde o createWooviHandler esta montado (ex.: "/api/pix").
   * Nao existe prop de apiKey de proposito: chave em codigo de navegador
   * e chave publica, entao a biblioteca nem oferece o modo inseguro.
   */
  endpoint?: string;
  appearance?: Appearance;
  /** Avancado: client customizado (testes e Storybook). Dispensa endpoint. */
  client?: CoreClient;
  children: ReactNode;
}

export function WooviProvider({ endpoint, appearance, client, children }: WooviProviderProps) {
  if (!endpoint && !client) {
    throw new Error(
      '<WooviProvider> precisa da prop endpoint: a URL do backend onde o createWooviHandler ' +
        'está montado (ex.: "/api/pix"). A chave da API nunca vai no frontend.',
    );
  }

  // useInsertionEffect: injeta o CSS antes de qualquer layout/paint dos filhos.
  useInsertionEffect(() => {
    injectStyles();
  }, []);

  const value = useMemo<WooviContextValue>(
    () => ({ client: client ?? createCoreClient(endpoint!), appearance }),
    [client, endpoint, appearance],
  );

  return <WooviContext.Provider value={value}>{children}</WooviContext.Provider>;
}

export function useWooviContext(): WooviContextValue {
  const ctx = useContext(WooviContext);
  if (!ctx) {
    throw new Error('usePixCharge() e <PixCheckout /> precisam estar dentro de <WooviProvider>.');
  }
  return ctx;
}
