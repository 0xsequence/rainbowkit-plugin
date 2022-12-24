import type { ConnectOptions } from '@0xsequence/provider';
import { Chain, Wallet } from '@rainbow-me/rainbowkit';

import { SequenceConnector } from './sequence-connector.js';

export interface MyWalletOptions {
  chains: Chain[];
  connect?: ConnectOptions
}

export const sequenceWallet = ({ chains, connect }: MyWalletOptions): Wallet => ({
  id: 'sequence',
  name: 'Sequence',
  iconUrl: async () => (await import('../images/logo.svg')).default,
  iconBackground: '#fff',
  downloadUrls: {
    browserExtension: 'https://sequence.app',
  },
  createConnector: () => {
    const connector = new SequenceConnector({
      chains,
      options: {
        connect
      },
    });

    return {
      connector,
      mobile: {
        getUri: async () => {
          try {
            await connector.connect();
          } catch (e) {
            console.error('Failed to connect');
          }
          return '';
        },
      },
      desktop: {
        getUri: async () => {
          try {
            await connector.connect();
          } catch (e) {
            console.error('Failed to connect');
          }
          return '';
        },
      },
    };
  },
});
