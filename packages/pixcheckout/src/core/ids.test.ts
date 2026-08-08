import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCorrelationID } from './ids.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createCorrelationID', () => {
  it('usa crypto.randomUUID quando existe', () => {
    expect(createCorrelationID()).toMatch(UUID_V4);
  });

  it('contexto inseguro (celular via IP da rede, sem randomUUID) ainda gera UUID v4 válido', () => {
    // http://192.168.x.x: randomUUID não existe, getRandomValues sim
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i += 1) arr[i] = i * 17 + 3;
        return arr;
      },
    });

    const id = createCorrelationID();
    expect(id).toMatch(UUID_V4);
    expect(new Set([id, createCorrelationID()]).size).toBe(1); // determinístico com o stub — só valida formato
  });

  it('ids consecutivos são distintos no ambiente real', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createCorrelationID()));
    expect(ids.size).toBe(50);
  });
});
