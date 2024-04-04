# rainbowkit-plugin

Rainbowkit plugin for the [Sequence](https://sequence.xyz/) wallet.

## Install

```shell
  pnpm install @0xsequence/rainbowkit-plugin 0xsequence
```

or

```shell
  pnpm add @0xsequence/rainbowkit-plugin 0xsequence
```

## Params

- `chains` -- Chains supported by app.

- `connect` -- (optional) Connect options of the Sequence wallet, includes the name of the app and default network id.

## Example of usage

```js
import { sequenceWallet } from '@0xsequence/rainbowkit-plugin'
...other imports

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      sequenceWallet({
        chains,
        defaultNetwork: 1,
        shimDisconnect: true,
        connect: {
          app: 'My app'
        }
      }),
      ...otherRainbowKitWallets
    ]
  }
])

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient
})
```

A full demo is available at: https://github.com/0xsequence/demo-dapp-rainbowkit
