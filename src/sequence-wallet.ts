import type { ConnectOptions, ProviderConfig } from '@0xsequence/provider';
import { Chain, Wallet } from '@rainbow-me/rainbowkit';

import { SequenceConnector } from './sequence-connector';

export interface MyWalletOptions {
  chains: Chain[]
  connect?: ConnectOptions
  providerConfig?: Partial<ProviderConfig>
}

export const sequenceWallet = ({ chains, connect, providerConfig }: MyWalletOptions): Wallet => ({
  id: 'sequence',
  name: 'Sequence',
  iconUrl: 'https://user-images.githubusercontent.com/26363061/210380889-f338d084-c42a-477a-ad1e-dd776658ba3f.svg',
  iconBackground: '#fff',
  downloadUrls: {
    browserExtension: 'https://sequence.app',
  },
  createConnector: () => {
    const connector = new SequenceConnector({
      chains,
      options: {
        connect,
        providerConfig
      },
    });

    return {
      connector,
      mobile: {
        getUri: async () => {
          try {
            await connector.connect();
            return window.location.href;
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
}) as Wallet;
