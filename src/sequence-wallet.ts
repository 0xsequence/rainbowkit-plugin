import { Chain, Wallet } from '@rainbow-me/rainbowkit';

import { SequenceConnector } from './sequence-connector';

export interface MyWalletOptions {
  chains: Chain[];
  shimDisconnect?: boolean | undefined;
  appName?: string;
}

export const sequenceConnectDefaultNetwork = 137;

export const sequenceWallet = ({ chains, shimDisconnect, appName }: MyWalletOptions): Wallet => ({
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
        shimDisconnect,
        connect: {
          app: appName || 'app',
          networkId: sequenceConnectDefaultNetwork,
          authorize: false,
        },
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
});
