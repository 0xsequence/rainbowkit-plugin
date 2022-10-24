# rainbowkit-plugin

Rainbowkit plugin for the [Sequence](https://sequence.xyz/) wallet.

## Install

```shell
  npm install @0xsequence/rainbowkit-plugin 0xsequence
```
or
```shell
  yarn add @0xsequence/rainbowkit-plugin 0xsequence
```

## Params

* `chains` -- Chains supported by app.

* `connect` -- (optional) Connect options of the Sequence wallet, includes the name of the app and default network id.


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
        shimDisconnect: true,
        connect: {
          app: 'My app',
          networkId: 137
        }
      }),
      ...otherRainbowKitWallets
    ]
  }
])

export const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider
})
```

A full demo is available at: https://github.com/0xsequence/demo-dapp-rainbowkit
